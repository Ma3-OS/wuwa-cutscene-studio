use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::AppHandle;

use crate::config::ConfigState;
use crate::commands::downloader::get_tools_dir;
use crate::commands::log::emit_log;

/// Index all .wem files in export_dir recursively into a map of lowercase_filename -> full_path
pub fn index_wem_files(export_dir: &Path) -> HashMap<String, PathBuf> {
    let mut map = HashMap::new();
    let mut dirs = vec![export_dir.to_path_buf()];
    while let Some(dir) = dirs.pop() {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    dirs.push(path);
                } else if path.extension().and_then(|s| s.to_str()).map(|s| s.to_lowercase()) == Some("wem".to_string()) {
                    if let Some(file_name) = path.file_name().and_then(|s| s.to_str()) {
                        map.insert(file_name.to_lowercase(), path);
                    }
                }
            }
        }
    }
    map
}

/// Patch a .txtp file so that all referenced .wem files point to their real absolute paths on disk
pub fn resolve_wem_paths_in_txtp(txtp_path: &Path, wem_map: &HashMap<String, PathBuf>) -> Result<(), String> {
    let content = fs::read_to_string(txtp_path).map_err(|e| e.to_string())?;
    let mut new_lines = Vec::new();
    let mut changed = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            new_lines.push(line.to_string());
            continue;
        }

        // Look for .wem reference in the line
        if let Some(wem_idx) = line.to_lowercase().find(".wem") {
            let before_wem = &line[..wem_idx + 4];
            let after_wem = &line[wem_idx + 4..];

            // Extract the filename (e.g. 554131082.wem)
            let token = before_wem.split_whitespace().last().unwrap_or("");
            let file_name = token.replace('\\', "/");
            let just_name = file_name.split('/').last().unwrap_or("").to_lowercase();

            if let Some(real_path) = wem_map.get(&just_name) {
                let formatted_path = real_path.display().to_string().replace('\\', "/");
                let new_line = format!("{}{}", formatted_path, after_wem);
                new_lines.push(new_line);
                changed = true;
                continue;
            }
        }

        new_lines.push(line.to_string());
    }

    if changed {
        fs::write(txtp_path, new_lines.join("\n")).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Fix all .txtp files inside txtp_dir to resolve their .wem paths
pub fn fix_all_txtp_wem_paths(txtp_dir: &Path, export_dir: &Path) -> Result<usize, String> {
    if !txtp_dir.exists() {
        return Ok(0);
    }
    let wem_map = index_wem_files(export_dir);
    if wem_map.is_empty() {
        return Ok(0);
    }

    let mut fixed_count = 0;
    if let Ok(entries) = fs::read_dir(txtp_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()).map(|s| s.to_lowercase()) == Some("txtp".to_string()) {
                if resolve_wem_paths_in_txtp(&path, &wem_map).is_ok() {
                    fixed_count += 1;
                }
            }
        }
    }
    Ok(fixed_count)
}

/// Execute Wwiser on a specific set of .bnk files
pub fn run_wwiser_for_banks(
    app: &AppHandle,
    export_dir: &Path,
    bnk_files: &[PathBuf],
) -> Result<(), String> {
    if bnk_files.is_empty() {
        return Ok(());
    }

    let tools_dir = get_tools_dir(app);
    let wwiser_py = tools_dir.join("wwiser-master").join("wwiser.py");
    if !wwiser_py.exists() {
        return Err("wwiser.py not found. Please download tools first.".to_string());
    }

    let txtp_dir = export_dir.join("txtp");
    let _ = fs::create_dir_all(&txtp_dir);

    let config_path = txtp_dir.join("wwconfig_targeted.txt");
    let mut config_content = String::new();
    config_content.push_str("-g\n-go\n");
    config_content.push_str(&format!("\"{}\"\n", txtp_dir.display().to_string().replace('\\', "/")));
    config_content.push_str("-gw\n\"../Media\"\n");
    for bnk in bnk_files {
        config_content.push_str(&format!("\"{}\"\n", bnk.display().to_string().replace('\\', "/")));
    }
    fs::write(&config_path, config_content).map_err(|e| e.to_string())?;

    let status = Command::new("python")
        .arg(&wwiser_py)
        .arg(format!("--config={}", config_path.display()))
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map_err(|e| format!("Failed to spawn python worker: {}", e))?;

    let _ = fs::remove_file(&config_path);

    if !status.success() {
        return Err("Wwiser worker returned non-zero exit code.".to_string());
    }

    // Auto-resolve wem paths for the generated txtp
    let _ = fix_all_txtp_wem_paths(&txtp_dir, export_dir);
    Ok(())
}

#[tauri::command]
pub async fn run_wwiser(app: AppHandle, state: tauri::State<'_, ConfigState>, target_files: Option<Vec<String>>) -> Result<(), String> {
    let config = state.0.lock().unwrap().clone();
    let export_dir = PathBuf::from(config.export_dir);
    
    if !export_dir.exists() {
        return Err("Export directory does not exist or is not set.".to_string());
    }
    
    let tools_dir = get_tools_dir(&app);
    let wwiser_py = tools_dir.join("wwiser-master").join("wwiser.py");
    if !wwiser_py.exists() {
        return Err("wwiser.py not found. Please download tools first.".to_string());
    }
    
    let txtp_dir = export_dir.join("txtp");

    // Fast check: if target_files is None and txtp already exists with files, skip extraction
    if target_files.is_none() && txtp_dir.exists() {
        let has_txtp = txtp_dir.read_dir().map(|mut d| d.next().is_some()).unwrap_or(false);
        if has_txtp {
            emit_log(&app, "Audio banks already cached in txtp/. Skipping full Wwiser extraction.");
            let _ = fix_all_txtp_wem_paths(&txtp_dir, &export_dir);
            return Ok(());
        }
    }

    // If target files provided, run targeted extraction
    if let Some(files) = target_files {
        let bnk_paths: Vec<PathBuf> = files.into_iter().map(PathBuf::from).collect();
        emit_log(&app, &format!("Extracting {} targeted bank(s)...", bnk_paths.len()));
        run_wwiser_for_banks(&app, &export_dir, &bnk_paths)?;
        emit_log(&app, "Targeted bank extraction complete.");
        return Ok(());
    }

    emit_log(&app, "Scanning for .bnk files across export directory...");
    
    // Find all .bnk
    let mut bnk_files = Vec::new();
    let mut dirs_to_visit = vec![export_dir.clone()];
    while let Some(dir) = dirs_to_visit.pop() {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    dirs_to_visit.push(path);
                } else if path.extension().and_then(|s| s.to_str()).map(|s| s.to_lowercase()) == Some("bnk".to_string()) {
                    bnk_files.push(path);
                }
            }
        }
    }

    if bnk_files.is_empty() {
        return Err("No .bnk files found in export directory.".to_string());
    }

    let num_threads = 4;
    let chunk_size = std::cmp::max(1, bnk_files.len() / num_threads);
    let chunks: Vec<Vec<PathBuf>> = bnk_files.chunks(chunk_size).map(|c| c.to_vec()).collect();

    emit_log(&app, &format!("Found {} .bnk files. Running {} parallel wwiser workers...", bnk_files.len(), chunks.len()));

    let _ = fs::create_dir_all(&txtp_dir);

    let mut config_paths = Vec::new();
    for (i, chunk) in chunks.iter().enumerate() {
        let config_path = txtp_dir.join(format!("wwconfig_args_{}.txt", i));
        config_paths.push(config_path.clone());
        let mut config_content = String::new();
        config_content.push_str("-g\n-go\n");
        config_content.push_str(&format!("\"{}\"\n", txtp_dir.display().to_string().replace('\\', "/")));
        config_content.push_str("-gw\n\"../Media\"\n");
        for bnk in chunk {
            config_content.push_str(&format!("\"{}\"\n", bnk.display().to_string().replace('\\', "/")));
        }
        fs::write(&config_path, config_content).map_err(|e| e.to_string())?;
    }

    let total_banks = bnk_files.len();
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    let running = Arc::new(AtomicBool::new(true));
    let r_clone = running.clone();
    let app_clone = app.clone();
    let txtp_dir_clone = txtp_dir.clone();

    std::thread::spawn(move || {
        let mut last_count = 0;
        let mut seconds = 0;
        while r_clone.load(Ordering::Relaxed) {
            std::thread::sleep(std::time::Duration::from_secs(2));
            if r_clone.load(Ordering::Relaxed) && txtp_dir_clone.exists() {
                seconds += 2;
                let mut count = 0;
                if let Ok(entries) = fs::read_dir(&txtp_dir_clone) {
                    for entry in entries.flatten() {
                        if entry.path().extension().and_then(|s| s.to_str()).map(|s| s.to_lowercase()) == Some("txtp".to_string()) {
                            count += 1;
                        }
                    }
                }
                if count != last_count {
                    last_count = count;
                    emit_log(&app_clone, &format!("Extracting audio banks... (Generated {} .txtp files from {} .bnk files)", count, total_banks));
                } else if count == 0 {
                    if seconds % 10 == 0 {
                        emit_log(&app_clone, &format!("Wwiser is parsing audio banks... ({}s elapsed)", seconds));
                    }
                }
            }
        }
    });

    let mut children = Vec::new();
    for config_path in &config_paths {
        let child = Command::new("python")
            .arg(&wwiser_py)
            .arg(format!("--config={}", config_path.display()))
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| {
                running.store(false, Ordering::Relaxed);
                format!("Failed to spawn python worker: {}", e)
            })?;
        children.push(child);
    }

    let mut success = true;
    for mut child in children {
        if let Ok(status) = child.wait() {
            if !status.success() {
                success = false;
            }
        } else {
            success = false;
        }
    }

    running.store(false, Ordering::Relaxed);
    for config_path in &config_paths {
        let _ = fs::remove_file(config_path);
    }

    if !success {
        return Err("One or more Wwiser parallel workers failed.".to_string());
    }

    emit_log(&app, "Resolving .wem file paths for all generated audio...");
    let fixed = fix_all_txtp_wem_paths(&txtp_dir, &export_dir)?;
    emit_log(&app, &format!("Extraction completed! Fixed paths for {} .txtp files.", fixed));
    Ok(())
}

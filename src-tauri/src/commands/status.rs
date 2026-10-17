use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use crate::commands::downloader::get_tools_dir;

#[derive(serde::Serialize)]
pub struct DependencyStatus {
    ffmpeg: bool,
    wwiser: bool,
    vgmstream: bool,
    json_data: bool,
}

#[tauri::command]
pub fn check_dependencies(app: AppHandle) -> DependencyStatus {
    let tools_dir = get_tools_dir(&app);
    let data_dir = crate::commands::downloader::get_data_dir(&app);
    
    let ffmpeg_exists = tools_dir.join("ffmpeg.exe").exists();
    let wwiser_exists = tools_dir.join("wwiser-master").join("wwiser.py").exists();
    let vgmstream_exists = tools_dir.join("vgmstream-cli.exe").exists();
    
    let has_multitext = data_dir.join("MultiText.json").exists() || 
                        data_dir.join("Textmaps").exists() ||
                        fs::read_dir(&data_dir).map(|entries| {
                            entries.flatten().any(|e| e.file_name().to_string_lossy().starts_with("MultiText_"))
                        }).unwrap_or(false);

    let videodata_exists = data_dir.join("BinData").join("cgVedio").join("videodata.json").exists() || data_dir.join("videodata.json").exists();
    let videosound_exists = data_dir.join("BinData").join("cgVedio").join("videosound.json").exists() || data_dir.join("videosound.json").exists();
    let videocaption_exists = data_dir.join("BinData").join("cgVedio").join("videocaption.json").exists() || data_dir.join("videocaption.json").exists();

    let json_exists = videodata_exists &&
                      videosound_exists &&
                      videocaption_exists &&
                      has_multitext;
                      
    DependencyStatus {
        ffmpeg: ffmpeg_exists,
        wwiser: wwiser_exists,
        vgmstream: vgmstream_exists,
        json_data: json_exists,
    }
}

                // Removed Auto-Detect as per user request (FModel output is separate)

const ALLOWED_OPEN_EXTENSIONS: &[&str] = &[
    "mp4", "mkv", "avi", "webm", "srt", "ass", "txt", "log", "json", "jpg", "jpeg", "png", "wav"
];

fn is_safe_local_path(path_str: &str) -> Result<PathBuf, String> {
    let trimmed = path_str.trim();
    if trimmed.is_empty() {
        return Err("Path cannot be empty".to_string());
    }
    // Block remote UNC paths (\\attacker\share or //attacker/share)
    if trimmed.starts_with(r"\\") || trimmed.starts_with("//") {
        return Err("Network UNC paths are forbidden for security reasons".to_string());
    }
    let p = PathBuf::from(trimmed);
    if !p.is_absolute() {
        return Err("Only absolute paths are allowed".to_string());
    }
    Ok(p)
}

#[tauri::command]
pub fn show_in_folder(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    
    // Resolve target path if file exists, or fallback to parent directory
    let (target_file, target_dir) = if p.exists() {
        if p.is_file() {
            (Some(p.clone()), p.parent().map(|d| d.to_path_buf()))
        } else {
            (None, Some(p.clone()))
        }
    } else if let Some(parent) = p.parent() {
        if parent.exists() && parent.is_dir() {
            (None, Some(parent.to_path_buf()))
        } else {
            return Err("ไม่พบไฟล์หรือโฟลเดอร์ที่ระบุ".to_string());
        }
    } else {
        return Err("ไม่พบไฟล์หรือโฟลเดอร์ที่ระบุ".to_string());
    };

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("explorer.exe");
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        if let Some(file) = target_file {
            // raw_arg prevents Rust from double-quoting the argument
            cmd.raw_arg(format!("/select,\"{}\"", file.display()));
        } else if let Some(dir) = target_dir {
            cmd.raw_arg(format!("\"{}\"", dir.display()));
        }

        let _ = cmd.spawn().map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Some(file) = target_file {
            if let Some(parent) = file.parent() {
                open::that(parent).map_err(|e| e.to_string())?;
            } else {
                open::that(&file).map_err(|e| e.to_string())?;
            }
        } else if let Some(dir) = target_dir {
            open::that(&dir).map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    show_in_folder(path)
}

#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    open_media_external(path)
}

#[tauri::command]
pub fn open_media_external(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() || !p.is_file() {
        return Err("ไม่พบไฟล์วิดีโอที่ระบุ".to_string());
    }
    open::that(&p).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_output_dir(app: AppHandle, state: tauri::State<'_, crate::config::ConfigState>) -> Result<(), String> {
    let config = state.0.lock().unwrap().clone();
    let render_dir = config.get_effective_render_dir();
    let _ = fs::create_dir_all(&render_dir);
    open::that(&render_dir).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_source_folder(
    app: AppHandle,
    cg_name: Option<String>,
    state: tauri::State<'_, crate::config::ConfigState>,
) -> Result<(), String> {
    let config = state.0.lock().unwrap().clone();
    let export_dir = config.get_effective_export_dir();
    let cutscenes_dir = export_dir.join("cutscenes");

    if let Some(name) = cg_name.filter(|n| !n.trim().is_empty()) {
        let clean = name.trim();
        let direct_bundle = export_dir.join(clean);
        if direct_bundle.exists() {
            let _ = open::that(&direct_bundle);
            return Ok(());
        }

        let target_bundle = cutscenes_dir.join(clean);
        if target_bundle.exists() {
            let _ = open::that(&target_bundle);
            return Ok(());
        }

        let nan_bundle = cutscenes_dir.join(format!("{}_nan", clean));
        if nan_bundle.exists() {
            let _ = open::that(&nan_bundle);
            return Ok(());
        }

        let nv_bundle = cutscenes_dir.join(format!("{}_nv", clean));
        if nv_bundle.exists() {
            let _ = open::that(&nv_bundle);
            return Ok(());
        }

        // Check legacy cache
        let old_cache = crate::commands::downloader::get_base_dir(&app).join("cache").join("cutscenes").join(clean);
        if old_cache.exists() {
            let _ = open::that(&old_cache);
            return Ok(());
        }
    }

    if cutscenes_dir.exists() {
        let _ = open::that(&cutscenes_dir);
        return Ok(());
    }

    let _ = fs::create_dir_all(&export_dir);
    open::that(&export_dir).map_err(|e| e.to_string())?;
    Ok(())
}

fn dir_size_recursive(dir: &Path) -> u64 {
    let mut total = 0;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                total += dir_size_recursive(&p);
            } else if let Ok(meta) = p.metadata() {
                total += meta.len();
            }
        }
    }
    total
}

#[tauri::command]
pub fn get_cache_size(app: AppHandle) -> u64 {
    let app_dir = crate::commands::downloader::get_base_dir(&app);
    let thumbnails_dir = app_dir.join("thumbnails");
    let temp_dir = app_dir.join("temp");
    let logs_dir = app_dir.join("logs");
    
    dir_size_recursive(&thumbnails_dir) + dir_size_recursive(&temp_dir) + dir_size_recursive(&logs_dir)
}

#[tauri::command]
pub fn clear_app_cache(app: AppHandle) -> Result<u64, String> {
    let app_dir = crate::commands::downloader::get_base_dir(&app);
    let thumbnails_dir = app_dir.join("thumbnails");
    let temp_dir = app_dir.join("temp");
    let logs_dir = app_dir.join("logs");
    
    let freed = dir_size_recursive(&thumbnails_dir) + dir_size_recursive(&temp_dir) + dir_size_recursive(&logs_dir);
    
    let _ = fs::remove_dir_all(&thumbnails_dir);
    let _ = fs::remove_dir_all(&temp_dir);
    let _ = fs::remove_dir_all(&logs_dir);
    
    let _ = fs::create_dir_all(&thumbnails_dir);
    let _ = fs::create_dir_all(&temp_dir);
    
    crate::commands::log::emit_log(&app, &format!("Cache cleared: {:.2} MB freed.", (freed as f64) / (1024.0 * 1024.0)));
    Ok(freed)
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct StorageStats {
    pub cache_size: u64,
    pub export_size: u64,
    pub render_size: u64,
    pub total_size: u64,
    pub cache_formatted: String,
    pub export_formatted: String,
    pub render_formatted: String,
    pub total_formatted: String,
}

fn format_bytes(bytes: u64) -> String {
    let mb = bytes as f64 / (1024.0 * 1024.0);
    if mb > 1024.0 {
        format!("{:.2} GB", mb / 1024.0)
    } else {
        format!("{:.1} MB", mb)
    }
}

#[tauri::command]
pub fn get_storage_breakdown(
    _app: AppHandle,
    state: tauri::State<'_, crate::config::ConfigState>,
) -> StorageStats {
    let config = state.0.lock().unwrap().clone();
    let proj_root = crate::config::get_project_root();
    let cache_dir = proj_root.join("cache");
    let export_dir = config.get_effective_export_dir();
    let render_dir = config.get_effective_render_dir();

    let cache_sz = dir_size_recursive(&cache_dir);
    let export_sz = dir_size_recursive(&export_dir);
    let render_sz = dir_size_recursive(&render_dir);
    let total_sz = cache_sz + export_sz + render_sz;

    StorageStats {
        cache_size: cache_sz,
        export_size: export_sz,
        render_size: render_sz,
        total_size: total_sz,
        cache_formatted: format_bytes(cache_sz),
        export_formatted: format_bytes(export_sz),
        render_formatted: format_bytes(render_sz),
        total_formatted: format_bytes(total_sz),
    }
}

#[tauri::command]
pub fn clear_project_cache() -> Result<u64, String> {
    let proj_root = crate::config::get_project_root();
    let cache_dir = proj_root.join("cache");
    let freed = dir_size_recursive(&cache_dir);
    if cache_dir.exists() {
        let _ = fs::remove_dir_all(&cache_dir);
        let _ = fs::create_dir_all(&cache_dir);
    }
    Ok(freed)
}

#[tauri::command]
pub fn system_power_action(action: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if action == "sleep" {
            let _ = Command::new("rundll32.exe")
                .args(["powrprof.dll,SetSuspendState", "0,1,0"])
                .spawn();
        } else if action == "shutdown" {
            let _ = Command::new("shutdown")
                .args(["/s", "/t", "60", "/c", "Wuthering Waves Cutscene Studio completed queue processing."])
                .spawn();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn app_minimize(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn app_toggle_maximize(window: tauri::Window) -> Result<bool, String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
pub fn app_close(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn app_is_maximized(window: tauri::Window) -> Result<bool, String> {
    Ok(window.is_maximized().unwrap_or(false))
}

#[tauri::command]
pub fn app_start_dragging(window: tauri::Window) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}



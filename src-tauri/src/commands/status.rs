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
                        fs::read_dir(&data_dir).map(|entries| {
                            entries.flatten().any(|e| e.file_name().to_string_lossy().starts_with("MultiText_"))
                        }).unwrap_or(false);

    let json_exists = data_dir.join("videodata.json").exists() &&
                      data_dir.join("videosound.json").exists() &&
                      data_dir.join("videocaption.json").exists() &&
                      has_multitext;
                      
    DependencyStatus {
        ffmpeg: ffmpeg_exists,
        wwiser: wwiser_exists,
        vgmstream: vgmstream_exists,
        json_data: json_exists,
    }
}

                // Removed Auto-Detect as per user request (FModel output is separate)

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    let target = if p.is_file() {
        p.parent().map(|par| par.to_path_buf()).unwrap_or(p)
    } else {
        p
    };
    if target.exists() {
        open::that(&target).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Folder does not exist".to_string())
    }
}

#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.exists() {
        open::that(p).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("File does not exist".to_string())
    }
}

#[tauri::command]
pub fn open_output_dir(app: AppHandle, state: tauri::State<'_, crate::config::ConfigState>) -> Result<(), String> {
    let config = state.0.lock().unwrap().clone();
    let output_dir = if !config.output_dir.is_empty() {
        PathBuf::from(&config.output_dir)
    } else {
        crate::commands::downloader::get_data_dir(&app).join("output")
    };
    let _ = fs::create_dir_all(&output_dir);
    open::that(output_dir).map_err(|e| e.to_string())?;
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
    let app_dir = crate::commands::downloader::get_tools_dir(&app).parent().unwrap_or(&PathBuf::from(".")).to_path_buf();
    let thumbnails_dir = app_dir.join("thumbnails");
    let temp_dir = app_dir.join("temp");
    let logs_dir = app_dir.join("logs");
    
    dir_size_recursive(&thumbnails_dir) + dir_size_recursive(&temp_dir) + dir_size_recursive(&logs_dir)
}

#[tauri::command]
pub fn clear_app_cache(app: AppHandle) -> Result<u64, String> {
    let app_dir = crate::commands::downloader::get_tools_dir(&app).parent().unwrap_or(&PathBuf::from(".")).to_path_buf();
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


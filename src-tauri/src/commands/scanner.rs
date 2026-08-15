use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use crate::commands::log::emit_log;

pub fn scan_directory_recursive(dir: &Path, extensions: &[&str]) -> Vec<PathBuf> {
    let mut found_files = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                found_files.extend(scan_directory_recursive(&path, extensions));
            } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if extensions.contains(&ext.to_lowercase().as_str()) {
                    found_files.push(path);
                }
            }
        }
    }
    found_files
}

#[tauri::command]
pub fn get_exported_videos(app: AppHandle, export_dir: String) -> Result<Vec<String>, String> {
    if export_dir.is_empty() {
        return Ok(vec![]);
    }
    
    emit_log(&app, &format!("Scanning for exported videos in: {}", export_dir));
    let path = PathBuf::from(export_dir);
    
    if (!path.exists()) {
        return Err("Export directory does not exist".into());
    }
    
    let videos = scan_directory_recursive(&path, &["mp4", "mkv", "avi", "bk2"]);
    
    let mut video_names = Vec::new();
    for v in videos {
        if let Some(name) = v.file_name().and_then(|n| n.to_str()) {
            video_names.push(v.to_string_lossy().to_string());
        }
    }
    
    video_names.sort();
    Ok(video_names)
}

#[tauri::command]
pub fn scan_audio_banks(app: AppHandle, export_dir: String) -> Result<Vec<String>, String> {
    if export_dir.is_empty() {
        return Ok(vec![]);
    }
    
    emit_log(&app, &format!("Scanning for exported audio banks in: {}", export_dir));
    let path = PathBuf::from(export_dir);
    
    if (!path.exists()) {
        return Err("Export directory does not exist".into());
    }
    
    let banks = scan_directory_recursive(&path, &["bnk", "wem", "txtp"]);
    
    let mut bank_paths = Vec::new();
    for b in banks {
        bank_paths.push(b.to_string_lossy().to_string());
    }
    
    Ok(bank_paths)
}

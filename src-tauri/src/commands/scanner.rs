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

fn base64_encode(data: &[u8]) -> String {
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    let mut i = 0;
    while i < data.len() {
        let b0 = data[i] as usize;
        let b1 = if i + 1 < data.len() { data[i + 1] as usize } else { 0 };
        let b2 = if i + 2 < data.len() { data[i + 2] as usize } else { 0 };

        let triple = (b0 << 16) | (b1 << 8) | b2;

        out.push(CHARSET[(triple >> 18) & 0x3F] as char);
        out.push(CHARSET[(triple >> 12) & 0x3F] as char);
        if i + 1 < data.len() {
            out.push(CHARSET[(triple >> 6) & 0x3F] as char);
        } else {
            out.push('=');
        }
        if i + 2 < data.len() {
            out.push(CHARSET[triple & 0x3F] as char);
        } else {
            out.push('=');
        }
        i += 3;
    }
    out
}

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VideoMeta {
    pub thumbnail: String,
    pub duration_secs: f64,
    pub duration_formatted: String,
    pub resolution: String,
}

#[tauri::command]
pub fn get_video_meta(app: AppHandle, video_path: String) -> Result<VideoMeta, String> {
    if video_path.is_empty() {
        return Err("Video path is empty".into());
    }

    let p = PathBuf::from(&video_path);
    if !p.exists() {
        return Err("Video file not found".into());
    }

    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("video");
    let cache_dir = crate::commands::downloader::get_tools_dir(&app).parent().unwrap().join("thumbnails");
    let _ = fs::create_dir_all(&cache_dir);
    let thumb_file = cache_dir.join(format!("{}.jpg", stem));
    let meta_file = cache_dir.join(format!("{}.meta.json", stem));

    // Return cached metadata if already available
    if thumb_file.exists() && meta_file.exists() {
        if let Ok(meta_str) = fs::read_to_string(&meta_file) {
            if let Ok(meta) = serde_json::from_str::<VideoMeta>(&meta_str) {
                return Ok(meta);
            }
        }
    }

    // Locate FFmpeg
    let ffmpeg_exe = crate::commands::downloader::get_tools_dir(&app).join("ffmpeg.exe");
    let ffmpeg_cmd = if ffmpeg_exe.exists() {
        ffmpeg_exe.to_string_lossy().to_string()
    } else {
        "ffmpeg".to_string()
    };

    use std::process::Command;
    let mut cmd = Command::new(&ffmpeg_cmd);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    cmd.args([
        "-y",
        "-ss", "00:00:01",
        "-i", &video_path,
        "-vframes", "1",
        "-q:v", "4",
        "-vf", "scale=360:-1",
        &thumb_file.to_string_lossy(),
    ]);

    let output = cmd.output();
    let mut stderr_str = String::new();

    let success = match output {
        Ok(o) => {
            stderr_str = String::from_utf8_lossy(&o.stderr).to_string();
            o.status.success() && thumb_file.exists()
        }
        Err(_) => false,
    };

    // If 1s failed (e.g. video < 1s), retry at 0.2s
    if !success {
        let mut retry_cmd = Command::new(&ffmpeg_cmd);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            retry_cmd.creation_flags(0x08000000);
        }
        retry_cmd.args([
            "-y",
            "-ss", "00:00:00.2",
            "-i", &video_path,
            "-vframes", "1",
            "-q:v", "4",
            "-vf", "scale=360:-1",
            &thumb_file.to_string_lossy(),
        ]);
        if let Ok(ro) = retry_cmd.output() {
            stderr_str = String::from_utf8_lossy(&ro.stderr).to_string();
        }
    }

    let thumbnail = if thumb_file.exists() {
        if let Ok(bytes) = fs::read(&thumb_file) {
            format!("data:image/jpeg;base64,{}", base64_encode(&bytes))
        } else {
            "".to_string()
        }
    } else {
        "".to_string()
    };

    // Parse Duration and Resolution from FFmpeg stderr
    let mut duration_secs = 0.0;
    let mut duration_formatted = "00:00".to_string();
    let mut resolution = "1920x1080".to_string();

    // Regex / string search for Duration: HH:MM:SS.ms
    if let Some(dur_idx) = stderr_str.find("Duration:") {
        let after_dur = &stderr_str[dur_idx + 9..];
        if let Some(comma_idx) = after_dur.find(',') {
            let dur_str = after_dur[..comma_idx].trim();
            let parts: Vec<&str> = dur_str.split(':').collect();
            if parts.len() == 3 {
                let h: f64 = parts[0].trim().parse().unwrap_or(0.0);
                let m: f64 = parts[1].trim().parse().unwrap_or(0.0);
                let s: f64 = parts[2].trim().parse().unwrap_or(0.0);
                duration_secs = h * 3600.0 + m * 60.0 + s;
                let total_s = s.round() as u64;
                let total_m = m as u64;
                let total_h = h as u64;
                if total_h > 0 {
                    duration_formatted = format!("{}:{:02}:{:02}", total_h, total_m, total_s);
                } else {
                    duration_formatted = format!("{:02}:{:02}", total_m, total_s);
                }
            }
        }
    }

    // Search for Video: ..., WIDTHxHEIGHT
    if let Some(vid_idx) = stderr_str.find("Video:") {
        let after_vid = &stderr_str[vid_idx + 6..];
        for token in after_vid.split(',') {
            let t = token.trim();
            if let Some(x_pos) = t.find('x') {
                let (w_str, h_str) = t.split_at(x_pos);
                let h_clean = &h_str[1..].split_whitespace().next().unwrap_or("");
                if let (Ok(w), Ok(h)) = (w_str.trim().parse::<u32>(), h_clean.parse::<u32>()) {
                    if w >= 320 && h >= 240 {
                        resolution = format!("{}x{}", w, h);
                        break;
                    }
                }
            }
        }
    }

    let meta = VideoMeta {
        thumbnail,
        duration_secs,
        duration_formatted,
        resolution,
    };

    // Cache metadata
    if let Ok(meta_json) = serde_json::to_string(&meta) {
        let _ = fs::write(&meta_file, meta_json);
    }

    Ok(meta)
}

#[tauri::command]
pub fn get_video_thumbnail(app: AppHandle, video_path: String) -> Result<String, String> {
    let meta = get_video_meta(app, video_path)?;
    if !meta.thumbnail.is_empty() {
        Ok(meta.thumbnail)
    } else {
        Err("Could not generate thumbnail".into())
    }
}

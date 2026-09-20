use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};
use reqwest::Client;
use futures::StreamExt;
use serde::Serialize;
use zip::ZipArchive;

use crate::commands::log::emit_log;

#[derive(Clone, Serialize)]
struct ProgressPayload {
    task: String,
    progress: f32, // 0.0 to 1.0
}

fn emit_progress(app: &AppHandle, task: &str, progress: f32) {
    let _ = app.emit("downloader-progress", ProgressPayload { task: task.to_string(), progress });
}

fn get_base_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."))
}

pub fn get_tools_dir(app: &AppHandle) -> PathBuf {
    get_base_dir(app).join("tools")
}

pub fn get_data_dir(app: &AppHandle) -> PathBuf {
    get_base_dir(app).join("data")
}

async fn download_file(url: &str, dest_path: &Path, app: &AppHandle, task_name: &str) -> Result<(), String> {
    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) WuWaCutsceneStudio/1.0")
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Download failed with HTTP status {}: {}", res.status(), url));
    }

    let total_size = res.content_length().unwrap_or(0) as f32;
    
    let mut stream = res.bytes_stream();
    let mut file = File::create(dest_path).map_err(|e| e.to_string())?;
    
    let mut downloaded = 0.0;
    
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as f32;
        
        if total_size > 0.0 {
            emit_progress(app, task_name, downloaded / total_size);
        }
    }
    
    emit_progress(app, task_name, 1.0);
    Ok(())
}

fn extract_zip(zip_path: &Path, dest_dir: &Path, app: &AppHandle, task_name: &str) -> Result<(), String> {
    emit_log(app, &format!("Extracting {}...", task_name));
    
    let file = File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        
        // Enforce enclosed_name to eliminate Zip Slip (Path Traversal)
        let safe_rel_path = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => {
                return Err(format!("Unsafe path detected in zip archive: {}", file.name()));
            }
        };

        // Handle ffmpeg rename logic
        let mut outpath = dest_dir.join(&safe_rel_path);
        if safe_rel_path.to_string_lossy().ends_with("ffmpeg.exe") {
            outpath = dest_dir.join("ffmpeg.exe");
        }

        if file.is_dir() {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
            }
            let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }
    
    emit_log(app, &format!("Extraction of {} completed.", task_name));
    Ok(())
}

#[tauri::command]
pub async fn download_tools(app: AppHandle) -> Result<(), String> {
    let tools_dir = get_tools_dir(&app);
    fs::create_dir_all(&tools_dir).map_err(|e| e.to_string())?;
    
    // FFmpeg
    let ffmpeg_exe = tools_dir.join("ffmpeg.exe");
    if !ffmpeg_exe.exists() {
        emit_log(&app, "Downloading FFmpeg...");
        let zip_path = tools_dir.join("ffmpeg.zip");
        download_file("https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip", &zip_path, &app, "FFmpeg").await?;
        extract_zip(&zip_path, &tools_dir, &app, "FFmpeg")?;
        let _ = fs::remove_file(zip_path);
    } else {
        emit_log(&app, "FFmpeg already exists.");
    }
    
    // vgmstream
    let vgmstream_exe = tools_dir.join("vgmstream-cli.exe");
    if !vgmstream_exe.exists() {
        emit_log(&app, "Downloading vgmstream...");
        let zip_path = tools_dir.join("vgmstream.zip");
        // Fallback URL
        let url = "https://github.com/vgmstream/vgmstream/releases/download/r2117/vgmstream-win64.zip";
        download_file(url, &zip_path, &app, "vgmstream").await?;
        extract_zip(&zip_path, &tools_dir, &app, "vgmstream")?;
        let _ = fs::remove_file(zip_path);
    } else {
        emit_log(&app, "vgmstream already exists.");
    }
    
    // wwiser
    let wwiser_py = tools_dir.join("wwiser-master").join("wwiser.py");
    if !wwiser_py.exists() {
        emit_log(&app, "Downloading wwiser...");
        let zip_path = tools_dir.join("wwiser.zip");
        let url = "https://github.com/bnnm/wwiser/archive/refs/heads/master.zip";
        download_file(url, &zip_path, &app, "wwiser").await?;
        extract_zip(&zip_path, &tools_dir, &app, "wwiser")?;
        let _ = fs::remove_file(zip_path);
    } else {
        emit_log(&app, "wwiser already exists.");
    }

    emit_log(&app, "All tools ready.");
    Ok(())
}

#[tauri::command]
pub async fn download_data(app: AppHandle, textmap_lang: Option<String>) -> Result<(), String> {
    let lang = textmap_lang.unwrap_or_else(|| "th".to_string());
    let json_dir = get_data_dir(&app);
    fs::create_dir_all(&json_dir).map_err(|e| e.to_string())?;
    
    // Instead of resolving branch dynamically to save time, we use a fixed branch for this rewrite or default to 3.5.
    let branch = "3.5";
    emit_log(&app, &format!("Using database branch: {} (Language: {})", branch, lang));
    
    let common_json_urls = vec![
        ("videodata.json", format!("https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/{}/BinData/cgVedio/videodata.json", branch)),
        ("videosound.json", format!("https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/{}/BinData/cgVedio/videosound.json", branch)),
        ("videocaption.json", format!("https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/{}/BinData/cgVedio/videocaption.json", branch)),
    ];
    
    for (name, url) in common_json_urls {
        let file_path = json_dir.join(name);
        if !file_path.exists() {
            emit_log(&app, &format!("Downloading {}...", name));
            download_file(&url, &file_path, &app, name).await?;
        }
    }

    // Language specific MultiText cache (merged with 1sthalf & 2ndhalf unmasked text)
    let lang_file_name = format!("MultiText_{}.json", lang);
    let lang_file_path = json_dir.join(&lang_file_name);
    
    if !lang_file_path.exists() {
        emit_log(&app, &format!("Downloading and merging textmaps for '{}' (Base, 1stHalf, 2ndHalf, Subtitles)...", lang));
        
        let sub_textmap_sources = vec![
            format!("https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/{}/Textmaps/{}/multi_text/MultiText.json", branch, lang),
            format!("https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/{}/Textmaps/{}/multi_text_1sthalf/MultiText.json", branch, lang),
            format!("https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/{}/Textmaps/{}/multi_text_2ndhalf/MultiText.json", branch, lang),
            format!("https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/{}/Textmaps/{}/subtitle_text/SubtitleText.json", branch, lang),
        ];

        let mut merged_map: std::collections::HashMap<String, serde_json::Value> = std::collections::HashMap::new();
        let client = Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) WuWaCutsceneStudio/1.0")
            .timeout(std::time::Duration::from_secs(90))
            .build()
            .map_err(|e| e.to_string())?;

        for (idx, url) in sub_textmap_sources.iter().enumerate() {
            emit_progress(&app, &format!("Textmap ({}/{})", idx + 1, sub_textmap_sources.len()), (idx as f32) / (sub_textmap_sources.len() as f32));
            if let Ok(res) = client.get(url).send().await {
                if res.status().is_success() {
                    if let Ok(items) = res.json::<Vec<serde_json::Value>>().await {
                        for item in items {
                            if let Some(id) = item.get("Id").and_then(|v| v.as_str()) {
                                let content = item.get("Content").and_then(|v| v.as_str()).unwrap_or("");
                                let is_non_star = content.trim().chars().any(|c| c != '*' && c != ' ' && c != '\t' && c != '\r' && c != '\n');
                                if is_non_star || !merged_map.contains_key(id) {
                                    merged_map.insert(id.to_string(), item);
                                }
                            }
                        }
                    }
                }
            }
        }
        emit_progress(&app, "Textmap", 1.0);

        let final_list: Vec<&serde_json::Value> = merged_map.values().collect();
        let serialized = serde_json::to_string(&final_list).map_err(|e| e.to_string())?;
        fs::write(&lang_file_path, serialized).map_err(|e| e.to_string())?;
        emit_log(&app, &format!("Merged {} text entries into {}", final_list.len(), lang_file_name));
    }
    
    // Keep active MultiText.json copy
    let _ = fs::copy(&lang_file_path, json_dir.join("MultiText.json"));
    
    emit_log(&app, &format!("JSON Data for language '{}' synchronized successfully.", lang));
    Ok(())
}

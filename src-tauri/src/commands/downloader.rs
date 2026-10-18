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

pub fn get_base_dir(_app: &AppHandle) -> PathBuf {
    let dir = crate::config::get_project_root().join("cache");
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn get_tools_dir(_app: &AppHandle) -> PathBuf {
    let dir = crate::config::get_project_root().join("tools");
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn get_data_dir(_app: &AppHandle) -> PathBuf {
    let dir = crate::config::get_project_root().join("data");
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn get_fonts_dir(_app: &AppHandle) -> PathBuf {
    let dir = crate::config::get_project_root().join("fonts");
    let _ = fs::create_dir_all(&dir);
    dir
}

async fn download_file(url: &str, dest_path: &Path, app: &AppHandle, task_name: &str) -> Result<(), String> {
    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) WuWaCutsceneStudio/1.0")
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())?;

    let mut last_err = String::new();
    for attempt in 1..=3 {
        if attempt > 1 {
            emit_log(app, &format!("กำลังลองดาวน์โหลดใหม่ {} ครั้งที่ {}", task_name, attempt));
            tokio::time::sleep(std::time::Duration::from_millis(1500 * attempt as u64)).await;
        }

        match client.get(url).send().await {
            Ok(res) => {
                if !res.status().is_success() {
                    last_err = format!("ดาวน์โหลดไม่สำเร็จ รหัสสถานะ HTTP {} สำหรับ {}", res.status(), task_name);
                    continue;
                }

                let total_size = res.content_length().unwrap_or(0) as f32;
                let mut stream = res.bytes_stream();
                let temp_dest = dest_path.with_extension("download_tmp");

                let file_res = File::create(&temp_dest);
                if let Err(e) = file_res {
                    last_err = e.to_string();
                    continue;
                }
                let mut file = file_res.unwrap();
                let mut downloaded = 0.0;
                let mut stream_failed = false;

                while let Some(chunk_res) = stream.next().await {
                    match chunk_res {
                        Ok(chunk) => {
                            if let Err(e) = file.write_all(&chunk) {
                                last_err = e.to_string();
                                stream_failed = true;
                                break;
                            }
                            downloaded += chunk.len() as f32;
                            if total_size > 0.0 {
                                emit_progress(app, task_name, downloaded / total_size);
                            }
                        }
                        Err(e) => {
                            last_err = e.to_string();
                            stream_failed = true;
                            break;
                        }
                    }
                }

                if stream_failed {
                    let _ = fs::remove_file(&temp_dest);
                    continue;
                }

                let _ = file.flush();
                let _ = fs::rename(&temp_dest, dest_path);
                emit_progress(app, task_name, 1.0);
                return Ok(());
            }
            Err(e) => {
                last_err = e.to_string();
            }
        }
    }

    Err(format!("ดาวน์โหลดล้มเหลวหลังจากลอง 3 ครั้ง {}", last_err))
}

fn extract_zip(zip_path: &Path, dest_dir: &Path, app: &AppHandle, task_name: &str) -> Result<(), String> {
    emit_log(app, &format!("Extracting {}...", task_name));
    
    let file = File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        
        let safe_rel_path = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => {
                let entry_name = file.name().map(|n| n.to_string()).unwrap_or_else(|_| "invalid entry".to_string());
                return Err(format!("Unsafe path detected in zip archive: {}", entry_name));
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

use crate::config::tools_manifest::{FFMPEG_TOOL, VGMSTREAM_TOOL, WWISER_TOOL, DATABASE_BRANCH};
use crate::core::checksum::verify_sha256;

#[tauri::command]
pub async fn download_tools(app: AppHandle) -> Result<(), String> {
    let tools_dir = get_tools_dir(&app);
    fs::create_dir_all(&tools_dir).map_err(|e| e.to_string())?;
    
    // FFmpeg
    let ffmpeg_exe = tools_dir.join("ffmpeg.exe");
    if !ffmpeg_exe.exists() {
        emit_log(&app, "Downloading FFmpeg...");
        let zip_path = tools_dir.join("ffmpeg.zip");
        download_file(FFMPEG_TOOL.url, &zip_path, &app, FFMPEG_TOOL.name).await?;
        if let Some(expected) = FFMPEG_TOOL.expected_sha256 {
            verify_sha256(&zip_path, expected).map_err(|e| e.to_string())?;
            emit_log(&app, "FFmpeg SHA-256 integrity verified.");
        }
        extract_zip(&zip_path, &tools_dir, &app, FFMPEG_TOOL.name)?;
        let _ = fs::remove_file(zip_path);
    } else {
        emit_log(&app, "FFmpeg already exists.");
    }
    
    // vgmstream
    let vgmstream_exe = tools_dir.join("vgmstream-cli.exe");
    if !vgmstream_exe.exists() {
        emit_log(&app, "Downloading vgmstream...");
        let zip_path = tools_dir.join("vgmstream.zip");
        download_file(VGMSTREAM_TOOL.url, &zip_path, &app, VGMSTREAM_TOOL.name).await?;
        if let Some(expected) = VGMSTREAM_TOOL.expected_sha256 {
            verify_sha256(&zip_path, expected).map_err(|e| e.to_string())?;
            emit_log(&app, "vgmstream SHA-256 integrity verified.");
        }
        extract_zip(&zip_path, &tools_dir, &app, VGMSTREAM_TOOL.name)?;
        let _ = fs::remove_file(zip_path);
    } else {
        emit_log(&app, "vgmstream already exists.");
    }
    
    // wwiser
    let wwiser_py = tools_dir.join("wwiser-master").join("wwiser.py");
    if !wwiser_py.exists() {
        emit_log(&app, "Downloading wwiser...");
        let zip_path = tools_dir.join("wwiser.zip");
        download_file(WWISER_TOOL.url, &zip_path, &app, WWISER_TOOL.name).await?;
        if let Some(expected) = WWISER_TOOL.expected_sha256 {
            verify_sha256(&zip_path, expected).map_err(|e| e.to_string())?;
            emit_log(&app, "wwiser SHA-256 integrity verified.");
        }
        extract_zip(&zip_path, &tools_dir, &app, WWISER_TOOL.name)?;
        let _ = fs::remove_file(zip_path);
    } else {
        emit_log(&app, "wwiser already exists.");
    }

    emit_log(&app, "All tools ready.");
    Ok(())
}

#[tauri::command]
pub async fn download_data(app: AppHandle, textmap_lang: Option<String>) -> Result<(), String> {
    let raw_lang = textmap_lang.unwrap_or_else(|| "th".to_string());
    let lang = match raw_lang.trim() {
        "zh" | "zh-cn" | "zh-hans" | "zh_hans" | "zh_cn" => "zh-Hans".to_string(),
        "zh-tw" | "zh-hk" | "zh-hant" | "zh_hant" | "zh_tw" => "zh-Hant".to_string(),
        other => other.to_string(),
    };
    let json_dir = get_data_dir(&app);
    fs::create_dir_all(&json_dir).map_err(|e| e.to_string())?;
    
    let branch = DATABASE_BRANCH;
    let version_file = json_dir.join("version.txt");
    let current_version = if version_file.exists() {
        fs::read_to_string(&version_file).unwrap_or_default().trim().to_string()
    } else {
        String::new()
    };

    let needs_force_refresh = current_version != branch;
    if needs_force_refresh {
        emit_log(&app, &format!("ตรวจพบฐานข้อมูลรุ่นเก่าหรือยังไม่ได้ซิงค์ กำลังอัปเดตเป็นรุ่น {}", branch));
    } else {
        emit_log(&app, &format!("Using database branch: {} (Language: {})", branch, lang));
    }
    
    let common_json_configs = vec![
        ("videodata.json", "BinData/cgVedio/videodata.json", format!("https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/{}/BinData/cgVedio/videodata.json", branch)),
        ("videosound.json", "BinData/cgVedio/videosound.json", format!("https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/{}/BinData/cgVedio/videosound.json", branch)),
        ("videocaption.json", "BinData/cgVedio/videocaption.json", format!("https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/{}/BinData/cgVedio/videocaption.json", branch)),
        ("musicsubtitle.json", "BinData/MusicSubTitle/musicsubtitle.json", format!("https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/{}/BinData/MusicSubTitle/musicsubtitle.json", branch)),
        ("keys.json", "keys.json", "https://raw.githubusercontent.com/yarik0chka/wuwa-keys/main/keys.json".to_string()),
    ];
    
    for (root_name, rel_path, url) in common_json_configs {
        let hierarchical_path = json_dir.join(rel_path);
        let root_path = json_dir.join(root_name);

        if let Some(parent) = hierarchical_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        if needs_force_refresh || !hierarchical_path.exists() {
            emit_log(&app, &format!("Downloading {} (branch: {})...", root_name, branch));
            let _ = download_file(&url, &hierarchical_path, &app, root_name).await;
        }

        // Maintain root copy for seamless compatibility
        if hierarchical_path.exists() && (!root_path.exists() || needs_force_refresh) {
            let _ = fs::copy(&hierarchical_path, &root_path);
        }
    }

    // Language specific MultiText cache (merged with 1sthalf & 2ndhalf unmasked text + flows)
    let lang_file_name = format!("MultiText_{}.json", lang);
    let lang_file_path = json_dir.join(&lang_file_name);
    
    if needs_force_refresh || !lang_file_path.exists() {
        emit_log(&app, &format!("Downloading and merging textmaps for '{}' (Base, 1stHalf, 2ndHalf, Subtitles, Flows)...", lang));
        
        let sub_textmap_sources = vec![
            format!("https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/{}/Textmaps/{}/multi_text/MultiText.json", branch, lang),
            format!("https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/{}/Textmaps/{}/multi_text_1sthalf/MultiText.json", branch, lang),
            format!("https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/{}/Textmaps/{}/multi_text_2ndhalf/MultiText.json", branch, lang),
            format!("https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/{}/Textmaps/{}/subtitle_text/SubtitleText.json", branch, lang),
            format!("https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/{}/Textmaps/{}/flow_text/FlowText.json", branch, lang),
            format!("https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/{}/Textmaps/{}/custom_sequence/CustomSequence.json", branch, lang),
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

        if !merged_map.is_empty() {
            let final_list: Vec<&serde_json::Value> = merged_map.values().collect();
            let serialized = serde_json::to_string(&final_list).map_err(|e| e.to_string())?;

            // 1. Save in Arikatsu Textmaps hierarchy
            let hierarchical_textmap_dir = json_dir.join("Textmaps").join(&lang).join("multi_text");
            let _ = fs::create_dir_all(&hierarchical_textmap_dir);
            let _ = fs::write(hierarchical_textmap_dir.join("MultiText.json"), &serialized);

            // 2. Save root convenience copy
            fs::write(&lang_file_path, serialized).map_err(|e| e.to_string())?;
            let _ = fs::write(&version_file, branch);
            emit_log(&app, &format!("Merged {} text entries into {}", final_list.len(), lang_file_name));
        }
    }
    
    emit_log(&app, &format!("JSON Data for language '{}' synchronized successfully.", lang));
    Ok(())
}

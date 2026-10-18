use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tokio::io::AsyncWriteExt;
use tokio::sync::oneshot;

use crate::config::ConfigState;
use crate::commands::downloader::get_data_dir;
use crate::commands::log::emit_log;

pub fn strip_event_prefix(name: &str) -> &str {
    let prefixes = [
        "play_video_all_sound_",
        "play_seq_all_sound_",
        "play_all_sound_",
        "play_sequence_music_",
        "play_story_music_",
        "play_sfx_lva_",
        "play_sfx_lvb_",
        "play_sound_",
        "play_sfx_",
        "play_vo_story_",
    ];
    let mut curr = name;
    for prefix in prefixes {
        if let Some(stripped) = curr.strip_prefix(prefix) {
            curr = stripped;
            break;
        }
    }
    curr
}

pub fn resolve_videodata_file(data_dir: &Path) -> PathBuf {
    let p = data_dir.join("BinData").join("cgVedio").join("videodata.json");
    if p.exists() { p } else { data_dir.join("videodata.json") }
}

pub fn resolve_videosound_file(data_dir: &Path) -> PathBuf {
    let p = data_dir.join("BinData").join("cgVedio").join("videosound.json");
    if p.exists() { p } else { data_dir.join("videosound.json") }
}

pub fn resolve_videocaption_file(data_dir: &Path) -> PathBuf {
    let p = data_dir.join("BinData").join("cgVedio").join("videocaption.json");
    if p.exists() { p } else { data_dir.join("videocaption.json") }
}

pub fn resolve_multitext_file(data_dir: &Path, lang: &str) -> PathBuf {
    let norm_lang = match lang.trim() {
        "zh" | "zh-cn" | "zh-hans" | "zh_hans" | "zh_cn" => "zh-Hans",
        "zh-tw" | "zh-hk" | "zh-hant" | "zh_hant" | "zh_tw" => "zh-Hant",
        other => other,
    };
    let p = data_dir.join("Textmaps").join(norm_lang).join("multi_text").join("MultiText.json");
    if p.exists() {
        p
    } else {
        let p2 = data_dir.join(format!("MultiText_{}.json", norm_lang));
        if p2.exists() {
            p2
        } else {
            let p_raw = data_dir.join(format!("MultiText_{}.json", lang));
            if p_raw.exists() {
                p_raw
            } else if data_dir.join("MultiText_en.json").exists() {
                data_dir.join("MultiText_en.json")
            } else {
                data_dir.join("MultiText.json")
            }
        }
    }
}

pub fn strip_event_suffix(name: &str) -> &str {
    let suffixes = [
        "_nvzhu",
        "_nanzhu",
        "_nv",
        "_nan",
        "_girl",
        "_boy",
        "_female",
        "_male",
        "_cam010",
        "_cam020",
        "_cam030",
        "_ja",
        "_en",
        "_ko",
        "_zh",
        "_de",
        "_fr",
        "_es",
        "_ru",
        "_id",
        "_th",
        "_vi",
        "_zho",
        "_jpn",
        "_eng",
        "_kor",
    ];
    let mut curr = name;
    for suffix in suffixes {
        if let Some(stripped) = curr.strip_suffix(suffix) {
            curr = stripped;
            break;
        }
    }
    curr
}

pub fn strip_rover_suffix(name: &str) -> String {
    let lower = name.to_lowercase();
    let suffixes = ["_nvzhu", "_nanzhu", "_nv", "_nan", "_girl", "_boy", "_female", "_male"];
    for s in suffixes {
        if lower.ends_with(s) {
            return name[..name.len() - s.len()].to_string();
        }
    }
    name.to_string()
}

pub fn heal_and_validate_video_path(
    raw_path: &str,
    app: &AppHandle,
    cg_name_hint: Option<&str>,
) -> Result<PathBuf, String> {
    let mut cleaned = raw_path.trim().to_string();

    // 1. If path contains masked username e.g. *** or ~USER~, heal dynamically using USERPROFILE / HOME
    if cleaned.contains("***") || cleaned.contains("~USER~") {
        if let Ok(profile) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
            cleaned = cleaned.replace("~USER~", &profile);
            if let Ok(user) = std::env::var("USERNAME").or_else(|_| std::env::var("USER")) {
                cleaned = cleaned.replace("***", &user);
            }
        }
    }

    // 2. Strip compound uniqueId prefix if present e.g. M0374_Neutral_Folder_C:\...
    if let Some(pos) = cleaned.rfind(":\\").or_else(|| cleaned.rfind(":/")) {
        if pos >= 1 {
            let drive_char = cleaned.as_bytes()[pos - 1];
            if drive_char.is_ascii_alphabetic() {
                cleaned = cleaned[pos - 1..].to_string();
            }
        }
    }

    let candidate = PathBuf::from(&cleaned);

    // 3. If candidate is a valid existing file, return it directly
    if candidate.is_file() {
        return Ok(candidate);
    }

    // 4. If candidate is a directory (e.g. C:\Users\ or C:\Users) or does not exist on disk:
    // Search project cutscenes folder using cg_name_hint or filename stem
    let config_state = app.state::<crate::config::ConfigState>();
    let export_dir = config_state.0.lock().unwrap().get_effective_export_dir();
    let app_cache_dir = crate::commands::extractor::get_cache_cutscenes_dir(app);

    let mut search_names = Vec::new();
    if let Some(h) = cg_name_hint {
        if !h.is_empty() {
            search_names.push(h.to_string());
            search_names.push(crate::commands::extractor::extract_base_cg_name(h));
        }
    }
    let stem = candidate.file_stem().and_then(|s| s.to_str()).unwrap_or("");
    if !stem.is_empty() && !stem.eq_ignore_ascii_case("users") && !stem.eq_ignore_ascii_case("home") {
        search_names.push(stem.to_string());
        search_names.push(crate::commands::extractor::extract_base_cg_name(stem));
    }
    search_names.dedup();

    for name in &search_names {
        if name.is_empty() {
            continue;
        }
        let candidate_dirs = [
            export_dir.join("cutscenes").join(name).join("video"),
            export_dir.join("cutscenes").join(name),
            app_cache_dir.join(name),
            export_dir.join("cutscenes").join(name).join("preview"),
        ];

        for dir in &candidate_dirs {
            if dir.is_dir() {
                if let Ok(entries) = fs::read_dir(dir) {
                    for entry in entries.flatten() {
                        let p = entry.path();
                        if p.is_file() {
                            if let Some(ext) = p.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()) {
                                if ext == "mp4" || ext == "bk2" || ext == "mkv" || ext == "webm" {
                                    return Ok(p);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 5. If candidate is a directory, reject it explicitly so FFmpeg is never launched on a directory!
    if candidate.is_dir() {
        return Err(format!("Invalid video path: target is a directory ({}), not a video file", candidate.display()));
    }

    Ok(candidate)
}

pub fn sanitize_video_path_input(raw_input: &str) -> String {
    let path = Path::new(raw_input);
    if path.is_file() {
        return raw_input.to_string();
    }

    if raw_input.contains('_') && (raw_input.contains(":\\") || raw_input.contains(":/")) {
        let parts: Vec<&str> = raw_input.split('_').collect();
        for i in 0..parts.len() {
            let candidate = parts[i..].join("_");
            let p = Path::new(&candidate);
            if p.is_file() {
                return candidate;
            }
        }
        if let Some(pos) = raw_input.rfind(":\\").or_else(|| raw_input.rfind(":/")) {
            if pos >= 1 {
                let drive_start = pos - 1;
                let candidate = &raw_input[drive_start..];
                if Path::new(candidate).is_file() {
                    return candidate.to_string();
                }
            }
        }
    }
    raw_input.to_string()
}

pub fn contains_word_boundary(text: &str, pat: &str) -> bool {
    if text == pat {
        return true;
    }
    let pat_len = pat.len();
    if pat_len == 0 || text.len() < pat_len {
        return false;
    }

    let mut start = 0;
    while let Some(idx) = text[start..].find(pat) {
        let actual_idx = start + idx;
        let before_ok = actual_idx == 0 || {
            let prev_char = text[..actual_idx].chars().next_back().unwrap();
            prev_char == '_' || prev_char == ' ' || prev_char == '(' || prev_char == '.' || prev_char == '/' || prev_char == '\\'
        };
        let after_idx = actual_idx + pat_len;
        let after_ok = after_idx == text.len() || {
            let next_char = text[after_idx..].chars().next().unwrap();
            next_char == '_' || next_char == ' ' || next_char == '(' || next_char == ')' || next_char == '.' || next_char == '/' || next_char == '\\'
        };

        if before_ok && after_ok {
            return true;
        }
        start = actual_idx + 1;
    }
    false
}

/// Directly extract 32-bit .wem media IDs from the DIDX chunk of a Wwise .bnk file
pub fn extract_wem_ids_from_bnk_bytes(data: &[u8]) -> Vec<u32> {
    let mut ids = Vec::new();
    let mut cursor = 0;
    while cursor + 8 <= data.len() {
        let tag = &data[cursor..cursor + 4];
        let len = u32::from_le_bytes(match data[cursor + 4..cursor + 8].try_into() {
            Ok(b) => b,
            Err(_) => break,
        }) as usize;
        cursor += 8;

        if tag == b"DIDX" {
            let mut entry_cursor = cursor;
            let end = (cursor + len).min(data.len());
            while entry_cursor + 12 <= end {
                if let Ok(id_bytes) = data[entry_cursor..entry_cursor + 4].try_into() {
                    let wem_id = u32::from_le_bytes(id_bytes);
                    if wem_id > 0 && !ids.contains(&wem_id) {
                        ids.push(wem_id);
                    }
                }
                entry_cursor += 12;
            }
            break;
        }
        cursor += len;
    }
    ids
}

pub fn extract_wem_ids_from_bnk_file(path: &Path) -> Vec<u32> {
    if let Ok(data) = fs::read(path) {
        extract_wem_ids_from_bnk_bytes(&data)
    } else {
        Vec::new()
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VideoInfo {
    pub cg_name: String,
    pub cg_file: String,
    #[serde(default)]
    pub girl_or_boy: String,
    pub sounds: Vec<String>,
    pub srt_path: Option<String>,
    pub ass_path: Option<String>,
}

#[tauri::command]
pub async fn generate_single_video_info(
    app: AppHandle,
    state: tauri::State<'_, ConfigState>,
    mp4_path: String,
    locale: String,
    girl_or_boy: String,
    subtitle_lang: Option<String>,
) -> Result<VideoInfo, String> {
    let mut config = state.0.lock().unwrap().clone();
    if let Some(sub_l) = subtitle_lang {
        let trimmed = sub_l.trim();
        if !trimmed.is_empty() {
            config.subtitle_lang = trimmed.to_string();
        }
    }
    let export_dir = config.get_effective_export_dir();
    let data_dir = get_data_dir(&app);
    let render_dir = config.get_effective_render_dir();
    let app_cache_dir = crate::commands::extractor::get_cache_cutscenes_dir(&app);
    let txtp_dir = export_dir.join("txtp");

    let cg_hint = if mp4_path.contains('_') {
        let first = mp4_path.split('_').next().unwrap_or("");
        if (first.starts_with('M') || first.starts_with('C') || first.starts_with('P') || first.starts_with('R')) && first.len() >= 3 {
            Some(first)
        } else {
            None
        }
    } else {
        None
    };

    let mut mp4 = heal_and_validate_video_path(&mp4_path, &app, cg_hint)?;

    // If the path points to preview_muxed.mp4, resolve the raw pristine video from bundle/video
    if mp4.file_name().and_then(|f| f.to_str()) == Some("preview_muxed.mp4") {
        if let Some(parent) = mp4.parent() {
            if let Some(bundle) = parent.parent() {
                let video_dir = bundle.join("video");
                if video_dir.exists() {
                    if let Ok(entries) = fs::read_dir(&video_dir) {
                        for entry in entries.flatten() {
                            let p = entry.path();
                            if let Some(ext) = p.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()) {
                                if (ext == "mp4" || ext == "bk2" || ext == "mkv") && p.is_file() {
                                    mp4 = p;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    if !mp4.exists() {
        let fn_only = Path::new(&mp4_path).file_name().unwrap_or_default().to_string_lossy().to_string();
        let stem_only = Path::new(&mp4_path).file_stem().unwrap_or_default().to_string_lossy().to_string().to_lowercase();
        
        let mut found_match: Option<PathBuf> = None;

        // 1. Check direct candidates including cutscene bundles
        let direct_candidates = [
            export_dir.join("cutscenes").join(&stem_only).join("video").join(&fn_only),
            export_dir.join("cutscenes").join(&stem_only).join(&fn_only),
            render_dir.join(&fn_only),
            export_dir.join(&fn_only),
            export_dir.join("Movies").join(&fn_only),
            app_cache_dir.join(&fn_only),
        ];
        for c in direct_candidates {
            if c.exists() && c.is_file() {
                found_match = Some(c);
                break;
            }
        }

        // 2. Recursive search in app_cache_dir (e.g. cutscenes/<cg_name>/<filename>)
        if found_match.is_none() && app_cache_dir.exists() {
            let mut stack = vec![app_cache_dir.clone()];
            while let Some(dir) = stack.pop() {
                if let Ok(entries) = fs::read_dir(&dir) {
                    for entry in entries.flatten() {
                        let p = entry.path();
                        if p.is_dir() {
                            stack.push(p);
                        } else if p.is_file() {
                            let curr_fn = p.file_name().unwrap_or_default().to_string_lossy().to_string();
                            let curr_stem = p.file_stem().unwrap_or_default().to_string_lossy().to_string().to_lowercase();
                            if curr_fn.eq_ignore_ascii_case(&fn_only) || curr_stem == stem_only {
                                found_match = Some(p);
                                break;
                            }
                        }
                    }
                }
                if found_match.is_some() {
                    break;
                }
            }
        }

        // 3. Recursive search in export_dir
        if found_match.is_none() && export_dir.exists() {
            let mut stack = vec![export_dir.clone()];
            while let Some(dir) = stack.pop() {
                if let Ok(entries) = fs::read_dir(&dir) {
                    for entry in entries.flatten() {
                        let p = entry.path();
                        if p.is_dir() {
                            stack.push(p);
                        } else if p.is_file() {
                            let curr_fn = p.file_name().unwrap_or_default().to_string_lossy().to_string();
                            let curr_stem = p.file_stem().unwrap_or_default().to_string_lossy().to_string().to_lowercase();
                            if curr_fn.eq_ignore_ascii_case(&fn_only) || curr_stem == stem_only {
                                found_match = Some(p);
                                break;
                            }
                        }
                    }
                }
                if found_match.is_some() {
                    break;
                }
            }
        }

        if let Some(f) = found_match {
            mp4 = f;
        }
    }

    if !mp4.is_file() {
        return Err(format!("ไม่พบไฟล์วิดีโอบนดิสก์ {}", mp4.display()));
    }

    let fn_display = mp4.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "cutscene".to_string());
    emit_log(&app, &format!("Parsing metadata for {}...", fn_display));

    let lang = if config.subtitle_lang.is_empty() { "th".to_string() } else { config.subtitle_lang.clone() };
    let videodata_path = resolve_videodata_file(&data_dir);
    let videosound_path = resolve_videosound_file(&data_dir);
    let videocaption_path = resolve_videocaption_file(&data_dir);
    let multitext_path = resolve_multitext_file(&data_dir, &lang);

    let version_file = data_dir.join("version.txt");
    let current_version = if version_file.exists() {
        fs::read_to_string(&version_file).unwrap_or_default().trim().to_string()
    } else {
        String::new()
    };
    let needs_version_sync = current_version != crate::config::tools_manifest::DATABASE_BRANCH;

    if needs_version_sync || !videodata_path.exists() || !videosound_path.exists() || !videocaption_path.exists() || !multitext_path.exists() {
        emit_log(&app, &format!("ตรวจพบฐานข้อมูลยังไม่สมบูรณ์ กำลังซิงค์ข้อมูลสาขา {} ภาษา {}", crate::config::tools_manifest::DATABASE_BRANCH, lang));
        let _ = crate::commands::downloader::download_data(app.clone(), Some(lang)).await;
    }

    let videodata_str = fs::read_to_string(&videodata_path).map_err(|e| e.to_string())?;
    let videosound_str = fs::read_to_string(&videosound_path).map_err(|e| e.to_string())?;

    let videodata: Vec<Value> = serde_json::from_str(&videodata_str).map_err(|e| e.to_string())?;
    let videosound: Vec<Value> = serde_json::from_str(&videosound_str).map_err(|e| e.to_string())?;

    let base_name = mp4.file_stem().map(|s| s.to_string_lossy().to_string().to_lowercase()).unwrap_or_default();
    let clean_base = strip_rover_suffix(&base_name);
    
    // Auto-detect Rover gender strictly from video filename if explicitly specified
    let effective_gender = if base_name.contains("_nvzhu") || base_name.contains("_girl") || base_name.contains("_female") || base_name.ends_with("_nv") {
        "Girl".to_string()
    } else if base_name.contains("_nanzhu") || base_name.contains("_boy") || base_name.contains("_male") || base_name.ends_with("_nan") {
        "Boy".to_string()
    } else {
        girl_or_boy.clone()
    };

    // Find matching CgName: Level 0 (cg_hint), Level 1 (Exact match) and Level 2 (Rover suffix stripped fallback)
    let mut target_cg_name = String::new();
    let target_gender_num = if effective_gender == "Girl" { 0 } else { 1 };
    
    // Level 0: Direct match against cg_hint if available
    if let Some(hint) = cg_hint {
        for item in &videodata {
            if let Some(cg_name_val) = item.get("CgName").and_then(|v| v.as_str()) {
                if cg_name_val.eq_ignore_ascii_case(hint) {
                    target_cg_name = cg_name_val.to_string();
                    break;
                }
            }
        }
    }
    
    // Level 1: Exact match against CgName or CgFile
    for item in &videodata {
        if let Some(cg_name_val) = item.get("CgName").and_then(|v| v.as_str()) {
            if cg_name_val.eq_ignore_ascii_case(&base_name) {
                target_cg_name = cg_name_val.to_string();
                break;
            }
        }
        if let Some(cg_file) = item.get("CgFile").and_then(|v| v.as_str()) {
            let fn_name = cg_file.split('/').last().unwrap_or("").split('.').next().unwrap_or("").to_lowercase();
            if fn_name == base_name {
                target_cg_name = item.get("CgName").and_then(|v| v.as_str()).unwrap_or("").to_string();
                break;
            }
        }
    }

    // Level 2: Rover suffix stripped fallback
    if target_cg_name.is_empty() {
        for item in &videodata {
            if let Some(cg_name_val) = item.get("CgName").and_then(|v| v.as_str()) {
                let clean_cg_name = strip_rover_suffix(cg_name_val);
                if clean_cg_name.eq_ignore_ascii_case(&clean_base) {
                    target_cg_name = cg_name_val.to_string();
                    break;
                }
            }
            if let Some(cg_file) = item.get("CgFile").and_then(|v| v.as_str()) {
                let fn_name = cg_file.split('/').last().unwrap_or("").split('.').next().unwrap_or("").to_lowercase();
                let clean_fn = strip_rover_suffix(&fn_name);
                if clean_fn == clean_base || base_name.contains(&clean_fn) || fn_name.contains(&clean_base) {
                    target_cg_name = item.get("CgName").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    break;
                }
            }
        }
    }

    if target_cg_name.is_empty() {
        emit_log(&app, &format!("Note: '{}' is a UI/Activity video clip (no story dialogue or subtitle metadata).", base_name));
        target_cg_name = base_name.clone();
    } else {
        emit_log(&app, &format!("Found CgName: {}", target_cg_name));
    }

    // Find sounds matching this CG and Gender from videosound.json
    let mut events = Vec::new();
    let clean_target_cg = strip_rover_suffix(&target_cg_name).to_lowercase();
    for item in &videosound {
        if let Some(cg_name) = item.get("CgName").and_then(|v| v.as_str()) {
            let cg_lower = cg_name.to_lowercase();
            let clean_item_cg = strip_rover_suffix(cg_name).to_lowercase();
            let matches_cg = cg_name.eq_ignore_ascii_case(&target_cg_name)
                || clean_item_cg == clean_target_cg
                || (!clean_target_cg.is_empty() && (cg_lower.contains(&clean_target_cg) || clean_target_cg.contains(&clean_item_cg)));
                
            if matches_cg {
                let sound_gender = item.get("GirlOrBoy").and_then(|v| v.as_i64()).unwrap_or(2);
                if sound_gender == 2 || sound_gender == target_gender_num as i64 {
                    if let Some(event_path) = item.get("EventPath").and_then(|v| v.as_str()) {
                        let event = event_path.split('/').last().unwrap_or("").split('.').next().unwrap_or("").to_string();
                        if !events.contains(&event) {
                            events.push(event);
                        }
                    }
                }
            }
        }
    }

    // Scan all bnk files in export_dir, app_output_dir, app_cache_dir, and video parent folders
    let mut all_bnks = Vec::new();
    let mut dirs_to_visit = Vec::new();
    if export_dir.exists() {
        dirs_to_visit.push(export_dir.clone());
    }
    if render_dir.exists() {
        dirs_to_visit.push(render_dir.clone());
    }
    if app_cache_dir.exists() {
        dirs_to_visit.push(app_cache_dir.clone());
    }
    if let Some(parent) = mp4.parent() {
        if parent.exists() && !dirs_to_visit.contains(&parent.to_path_buf()) {
            dirs_to_visit.push(parent.to_path_buf());
        }
        if let Some(grandparent) = parent.parent() {
            if grandparent.exists() && !dirs_to_visit.contains(&grandparent.to_path_buf()) {
                dirs_to_visit.push(grandparent.to_path_buf());
            }
        }
    }

    while let Some(dir) = dirs_to_visit.pop() {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    dirs_to_visit.push(path);
                } else if path.extension().and_then(|s| s.to_str()).map(|s| s.to_lowercase()) == Some("bnk".to_string()) {
                    all_bnks.push(path);
                }
            }
        }
    }

    // Find any companion BGM/state banks specifically associated with this CG
    let cg_lower = target_cg_name.to_lowercase();
    let clean_cg_lower = if clean_target_cg.is_empty() {
        strip_rover_suffix(&target_cg_name).to_lowercase()
    } else {
        clean_target_cg.clone()
    };
    let mut companion_bgm_tracks: Vec<(String, Vec<u32>)> = Vec::new();
    let mut banks_to_extract = Vec::new();

    let scan_companion_banks = |bnk_list: &[PathBuf],
                                evs: &mut Vec<String>,
                                to_extract: &mut Vec<PathBuf>,
                                comp_tracks: &mut Vec<(String, Vec<u32>)>| {
        for bnk in bnk_list {
            let bnk_stem = bnk.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
            // Check if the bank explicitly names this specific CG (e.g. set_state_boss_3_3_aliefuyi_m0357_stage3_loop.bnk, play_sequence_music_m0357.bnk, or play_all_sound_m0389_music_lyric.bnk)
            let is_cg_match = bnk_stem == cg_lower
                || bnk_stem == clean_cg_lower
                || bnk_stem.contains(&format!("_{}", cg_lower))
                || bnk_stem.contains(&format!("{}_", cg_lower))
                || (!clean_cg_lower.is_empty() && (bnk_stem.contains(&format!("_{}", clean_cg_lower)) || bnk_stem.contains(&format!("{}_", clean_cg_lower))));

            if is_cg_match {
                if bnk_stem.starts_with("play_sequence_music_")
                    || bnk_stem.starts_with("play_story_music_")
                    || bnk_stem.contains("_music")
                    || bnk_stem.contains("_lyric")
                    || bnk_stem.contains("bgm_story_plot")
                {
                    if !evs.contains(&bnk_stem) {
                        evs.push(bnk_stem.clone());
                    }
                    if !to_extract.contains(bnk) {
                        to_extract.push(bnk.clone());
                    }
                } else if bnk_stem.starts_with("set_state_") || bnk_stem.starts_with("set_music_") {
                    let cleaned = bnk_stem.replace("set_state_", "").replace("set_music_", "");
                    let tokens: Vec<&str> = cleaned.split('_').collect();
                    let mut matched_parent_bank: Option<PathBuf> = None;
                    for k in (2..=tokens.len()).rev() {
                        let candidate_music = format!("play_music_{}", tokens[..k].join("_"));
                        if let Some(pb) = bnk_list.iter().find(|b| b.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase() == candidate_music) {
                            matched_parent_bank = Some(pb.clone());
                            break;
                        }
                        let candidate_bgm = format!("play_bgm_{}", tokens[..k].join("_"));
                        if let Some(pb) = bnk_list.iter().find(|b| b.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase() == candidate_bgm) {
                            matched_parent_bank = Some(pb.clone());
                            break;
                        }
                    }

                    if let Some(parent_bnk) = matched_parent_bank {
                        let state_ids = extract_state_ids_from_small_bnk(bnk);
                        let parent_stem = parent_bnk.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
                        if !to_extract.contains(&parent_bnk) {
                            to_extract.push(parent_bnk);
                        }
                        if !to_extract.contains(bnk) {
                            to_extract.push(bnk.clone());
                        }
                        if !comp_tracks.iter().any(|(p, _)| p == &parent_stem) {
                            comp_tracks.push((parent_stem, state_ids));
                        }
                    }
                }
            }
        }
    };

    scan_companion_banks(&all_bnks, &mut events, &mut banks_to_extract, &mut companion_bgm_tracks);

    // If events was not found in videosound.json, look for direct exact bnk matches for base_name
    if events.is_empty() {
        let clean_base = strip_event_suffix(&base_name);
        let possible_stems = [
            format!("play_video_all_sound_{}", clean_base),
            format!("play_seq_all_sound_{}", clean_base),
            format!("play_all_sound_{}", clean_base),
            format!("play_sound_{}", clean_base),
            format!("play_sequence_music_{}", clean_base),
            format!("play_story_music_{}", clean_base),
            format!("play_sfx_lva_{}", clean_base),
            format!("play_sfx_lvb_{}", clean_base),
            format!("play_sfx_{}", clean_base),
            format!("play_vo_story_{}", clean_base),
            clean_base.to_string(),
        ];
        for bnk in &all_bnks {
            let bnk_stem = bnk.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
            for ps in &possible_stems {
                if bnk_stem == *ps || contains_word_boundary(&bnk_stem, ps) {
                    events.push(bnk_stem.clone());
                    break;
                }
            }
        }
    }

    let clean_target_cg = strip_rover_suffix(&target_cg_name).to_string();
    let bundle_dir = if export_dir.join("cutscenes").join(&target_cg_name).exists() {
        export_dir.join("cutscenes").join(&target_cg_name)
    } else {
        export_dir.join("cutscenes").join(&clean_target_cg)
    };
    let _ = fs::create_dir_all(&bundle_dir);
    let cg_cache_folder = if app_cache_dir.join(&target_cg_name).exists() {
        app_cache_dir.join(&target_cg_name)
    } else {
        app_cache_dir.join(&clean_target_cg)
    };

    let _ = fs::create_dir_all(&txtp_dir);

    // Initial check for existing .bnk or .txtp
    let mut txtp_cache = Vec::new();
    let initial_txtp_search_dirs = [
        txtp_dir.clone(),
        export_dir.join("txtp"),
        bundle_dir.join("txtp"),
        bundle_dir.clone(),
        cg_cache_folder.join("txtp"),
        cg_cache_folder.clone(),
        app_cache_dir.join(&clean_target_cg).join("txtp"),
        app_cache_dir.join(&clean_target_cg),
        app_cache_dir.join(&target_cg_name).join("txtp"),
        app_cache_dir.join(&target_cg_name),
    ];
    for dir in &initial_txtp_search_dirs {
        if dir.exists() {
            let mut found = index_directory(dir, "txtp");
            txtp_cache.append(&mut found);
        }
    }
    txtp_cache.sort();
    txtp_cache.dedup();

    // Self-Healing Audio Pipeline: If sound events exist (or clean_target_cg is a story cutscene) but no matching .bnk or .txtp exists on disk, extract from game PAKs automatically
    let has_existing_audio = events.iter().any(|ev| {
        let ev_lower = ev.to_lowercase();
        all_bnks.iter().any(|b| {
            let s = b.file_stem().and_then(|x| x.to_str()).unwrap_or("").to_lowercase();
            s == ev_lower || contains_word_boundary(&s, &ev_lower)
        }) || txtp_cache.iter().any(|t| is_event_txtp_match(t, ev))
    });

    if (!events.is_empty() || !clean_target_cg.is_empty()) && !has_existing_audio {
        emit_log(&app, &format!("ตรวจพบไฟล์เสียงสำหรับ {} ยังไม่มีบนดิสก์ กำลังเปิดระบบ Self Healing สกัดจากแพ็กเกจเกม", target_cg_name));
        let extractor_state = app.state::<crate::commands::extractor::ExtractorState>();
        let config_state = app.state::<crate::config::ConfigState>();
        let _ = crate::commands::extractor::ensure_daemon_alive(&app, &extractor_state, &config_state).await;

        let heal_id = format!("heal_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0));
        let extract_cmd = json!({
            "cmd": "extract",
            "id": heal_id,
            "cg_name": clean_target_cg,
            "video_path": mp4.to_string_lossy().to_string(),
            "sound_events": events,
            "output_dir": bundle_dir.to_string_lossy().to_string(),
            "export_dir": export_dir.to_string_lossy().to_string(),
            "gender": effective_gender,
            "locale": locale
        });

        let (tx, rx) = oneshot::channel();
        let sent_heal = {
            let mut manager_lock = extractor_state.0.lock().await;
            if let Some(manager) = manager_lock.as_mut() {
                manager.pending.lock().await.insert(heal_id.clone(), tx);
                let line = format!("{}\n", extract_cmd);
                let res = manager.stdin.write_all(line.as_bytes()).await;
                if res.is_ok() {
                    manager.stdin.flush().await.is_ok()
                } else {
                    false
                }
            } else {
                false
            }
        };

        if sent_heal {
            let _ = tokio::time::timeout(Duration::from_secs(45), rx).await;
        }

        // Re-scan all_bnks after daemon extraction
        for dir in [
            &bundle_dir,
            &bundle_dir.join("audio"),
            &cg_cache_folder,
            &app_cache_dir.join(&clean_target_cg),
            &app_cache_dir.join(&clean_target_cg).join("audio"),
        ] {
            if dir.exists() {
                if let Ok(entries) = fs::read_dir(dir) {
                    for entry in entries.flatten() {
                        let p = entry.path();
                        if p.extension().and_then(|s| s.to_str()).map(|s| s.to_lowercase()) == Some("bnk".to_string()) {
                            if !all_bnks.contains(&p) {
                                all_bnks.push(p);
                            }
                        }
                    }
                }
            }
        }

        scan_companion_banks(&all_bnks, &mut events, &mut banks_to_extract, &mut companion_bgm_tracks);
    }

    // Collect banks to extract on-demand if missing with multi-pattern fuzzy matching
    for event in &events {
        let ev_lower = event.to_lowercase();
        let stripped_ev = strip_event_suffix(strip_event_prefix(&ev_lower));

        for bnk in &all_bnks {
            let file_stem = bnk.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
            if file_stem == ev_lower
                || contains_word_boundary(&file_stem, &ev_lower)
                || (!stripped_ev.is_empty() && stripped_ev.len() >= 3 && contains_word_boundary(&file_stem, stripped_ev))
            {
                banks_to_extract.push(bnk.clone());
            }
        }
    }

    // Also check direct base_cg bnk files
    for bnk in &all_bnks {
        let file_stem = bnk.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
        if file_stem.contains(&clean_target_cg.to_lowercase()) {
            if !banks_to_extract.contains(bnk) {
                banks_to_extract.push(bnk.clone());
            }
        }
    }

    if !banks_to_extract.is_empty() {
        banks_to_extract.sort();
        banks_to_extract.dedup();
        emit_log(&app, &format!("Extracting {} missing sound & music bank(s)...", banks_to_extract.len()));
        let effective_export = if bundle_dir.exists() {
            bundle_dir.clone()
        } else if export_dir.exists() {
            export_dir.clone()
        } else {
            cg_cache_folder.clone()
        };
        let _ = crate::commands::wwiser::run_wwiser_for_banks(&app, &effective_export, &banks_to_extract).await;
    }

    // Re-index all .txtp directories comprehensively
    txtp_cache.clear();
    let txtp_search_dirs = [
        txtp_dir.clone(),
        export_dir.join("txtp"),
        bundle_dir.join("txtp"),
        bundle_dir.clone(),
        cg_cache_folder.join("txtp"),
        cg_cache_folder.clone(),
        app_cache_dir.join(&clean_target_cg).join("txtp"),
        app_cache_dir.join(&clean_target_cg),
        app_cache_dir.join(&target_cg_name).join("txtp"),
        app_cache_dir.join(&target_cg_name),
    ];
    for dir in &txtp_search_dirs {
        if dir.exists() {
            let mut found = index_directory(dir, "txtp");
            txtp_cache.append(&mut found);
        }
    }
    txtp_cache.sort();
    txtp_cache.dedup();

    // Auto-resolve .wem paths for matched files across all audio directories
    let mut wem_map = crate::commands::wwiser::index_wem_files_multiple(&[
        &export_dir,
        &render_dir,
        &app_cache_dir,
        &bundle_dir,
        &cg_cache_folder,
    ]);

    // Filter sounds by gender and locale
    let mut sounds = Vec::new();
    let norm_locale = locale.to_lowercase();
    let all_locales = ["ja", "en", "ko", "zh-hans", "zh-hant", "zh"];

    // 1. Match primary cutscene dialogue/SFX/Music events strictly
    for event in &events {
        let mut matched = Vec::new();
        for txtp in &txtp_cache {
            if is_event_txtp_match(txtp, event) {
                matched.push(txtp.clone());
            }
        }
        
        for m in matched {
            if !is_txtp_gender_and_locale_match(&m, &effective_gender, &norm_locale, &all_locales) {
                continue;
            }

            let txtp_path = PathBuf::from(&m);
            let _ = crate::commands::wwiser::resolve_wem_paths_in_txtp(&txtp_path, &wem_map);
            if !sounds.contains(&m) {
                sounds.push(m);
            }
        }
    }

    // 2. Match companion BGM tracks matching the exact state IDs
    for (parent_stem, state_ids) in companion_bgm_tracks {
        for txtp in &txtp_cache {
            let p = Path::new(txtp);
            let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
            if stem.starts_with(&parent_stem) {
                let is_state_match = state_ids.iter().any(|&sid| stem.contains(&format!("={})", sid)));
                if is_state_match && is_txtp_gender_and_locale_match(txtp, &effective_gender, &norm_locale, &all_locales) {
                    let txtp_path = PathBuf::from(txtp);
                    let _ = crate::commands::wwiser::resolve_wem_paths_in_txtp(&txtp_path, &wem_map);
                    if !sounds.contains(txtp) {
                        sounds.push(txtp.clone());
                    }
                }
            }
        }
    }

    // 3. Fallback: If no .txtp matched events, include all .txtp in cutscene bundle and cache matching gender and locale
    if sounds.is_empty() {
        for txtp in &txtp_cache {
            if is_txtp_gender_and_locale_match(txtp, &effective_gender, &norm_locale, &all_locales) {
                let txtp_path = PathBuf::from(txtp);
                let _ = crate::commands::wwiser::resolve_wem_paths_in_txtp(&txtp_path, &wem_map);
                if !sounds.contains(txtp) {
                    sounds.push(txtp.clone());
                }
            }
        }
    }

    // 4. Verify all referenced .wem files in sounds and auto-extract any missing streams from PAKs
    let mut missing_wems = Vec::new();
    let re = &*crate::commands::wwiser::WEM_ID_REGEX;
    for s in &sounds {
        if s.to_lowercase().ends_with(".txtp") {
            if let Ok(content) = fs::read_to_string(s) {
                for cap in re.captures_iter(&content) {
                    if let Some(m) = cap.get(1) {
                        let id = m.as_str().to_string();
                        let wem_file = format!("{}.wem", id).to_lowercase();
                        if !wem_map.contains_key(&wem_file) && !missing_wems.contains(&id) {
                            missing_wems.push(id);
                        }
                    }
                }
            }
        }
    }

    if !missing_wems.is_empty() {
        emit_log(&app, &format!("ตรวจพบไฟล์สตรีมเสียง .wem ที่ยังขาดอยู่ {} ไฟล์ กำลังดึงจากแพ็กเกจเกม...", missing_wems.len()));
        let config_state = app.state::<crate::config::ConfigState>();
        let extractor_state = app.state::<crate::commands::extractor::ExtractorState>();
        let wem_target = if bundle_dir.exists() {
            bundle_dir.clone()
        } else if export_dir.exists() {
            export_dir.clone()
        } else {
            cg_cache_folder.clone()
        };
        let _ = crate::commands::extractor::extract_wem_batch_internal(
            &app,
            &extractor_state,
            &config_state,
            missing_wems,
            &wem_target,
            &norm_locale,
        ).await;

        wem_map = crate::commands::wwiser::index_wem_files_multiple(&[
            &export_dir,
            &render_dir,
            &app_cache_dir,
            &bundle_dir,
            &cg_cache_folder,
        ]);
        for s in &sounds {
            if s.to_lowercase().ends_with(".txtp") {
                let _ = crate::commands::wwiser::resolve_wem_paths_in_txtp(Path::new(s), &wem_map);
            }
        }
    }

    // Filter sounds to keep only resolvable audio files
    let mut valid_sounds = Vec::new();
    for s in &sounds {
        let p = Path::new(s);
        let ext = p.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()).unwrap_or_default();
        if ext == "txtp" {
            if crate::commands::wwiser::is_txtp_resolvable(p) {
                valid_sounds.push(s.clone());
            } else {
                let fname = p.file_name().unwrap_or_default().to_string_lossy().to_string();
                emit_log(&app, &format!("ข้ามแทร็กเสียงที่ไม่สมบูรณ์เนื่องจากขาดไฟล์สตรีม {}", fname));
            }
        } else if p.is_file() {
            valid_sounds.push(s.clone());
        }
    }
    sounds = valid_sounds;

    sounds.sort();
    sounds.dedup();

    emit_log(&app, &format!("Ready to mix {} authoritative audio track(s):", sounds.len()));
    for s in &sounds {
        let fname = PathBuf::from(s).file_name().unwrap_or_default().to_string_lossy().to_string();
        emit_log(&app, &format!("  -> {}", fname));
    }

    // Generate SRT & ASS Subtitles
    let (srt_path, ass_path) = generate_captions(&app, &target_cg_name, &config, &locale).unwrap_or_else(|e| {
        emit_log(&app, &format!("Warning: Could not generate subtitles: {}", e));
        (None, None)
    });

    let actual_cg_file = mp4.to_string_lossy().to_string();
    Ok(VideoInfo {
        cg_name: target_cg_name,
        cg_file: actual_cg_file,
        girl_or_boy: effective_gender,
        sounds,
        srt_path,
        ass_path,
    })
}

fn index_directory(root: &Path, ext: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut dirs_to_visit = vec![root.to_path_buf()];
    
    while let Some(dir) = dirs_to_visit.pop() {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    dirs_to_visit.push(path);
                } else if path.extension().and_then(|s| s.to_str()).map(|s| s.to_lowercase()) == Some(ext.to_string()) {
                    result.push(path.to_string_lossy().to_string());
                }
            }
        }
    }
    result
}

fn hex_to_ass_color(hex: &str) -> String {
    let clean = hex.trim_start_matches('#');
    if clean.len() == 6 {
        let r = &clean[0..2];
        let g = &clean[2..4];
        let b = &clean[4..6];
        format!("&H00{}{}{}", b, g, r)
    } else {
        "&H00FFFFFF".to_string()
    }
}

// Re-export modular subtitle operations from crate::subtitles
pub use crate::subtitles::{
    clean_subtitle_text,
    clean_subtitle_for_ass,
    generate_captions,
    sanitize_cutscene_filename,
    format_srt_time,
    format_ass_time,
    CutsceneSubtitleLine,
};

#[tauri::command]
pub fn get_video_audio_event(app: AppHandle, video_name: String) -> Result<Vec<String>, String> {
    let data_dir = get_data_dir(&app);
    let videodata_path = resolve_videodata_file(&data_dir);
    let videosound_path = resolve_videosound_file(&data_dir);

    if !videodata_path.exists() || !videosound_path.exists() {
        return Ok(vec![]);
    }

    let videodata_str = fs::read_to_string(&videodata_path).map_err(|e| e.to_string())?;
    let videosound_str = fs::read_to_string(&videosound_path).map_err(|e| e.to_string())?;

    let videodata: Vec<Value> = serde_json::from_str(&videodata_str).map_err(|e| e.to_string())?;
    let videosound: Vec<Value> = serde_json::from_str(&videosound_str).map_err(|e| e.to_string())?;

    let clean_input = sanitize_video_path_input(&video_name);
    let mp4 = PathBuf::from(&clean_input);
    let base_name = mp4.file_stem().unwrap_or_default().to_string_lossy().to_string().to_lowercase();
    let clean_base = strip_rover_suffix(&base_name);
    
    let mut target_cg_name = String::new();
    for item in &videodata {
        if let Some(cg_name) = item.get("CgName").and_then(|v| v.as_str()) {
            if cg_name.eq_ignore_ascii_case(&base_name) || strip_rover_suffix(cg_name).to_lowercase() == clean_base {
                target_cg_name = cg_name.to_string();
                break;
            }
        }
        if let Some(cg_file) = item.get("CgFile").and_then(|v| v.as_str()) {
            let fn_name = cg_file.split('/').last().unwrap_or("").split('.').next().unwrap_or("").to_lowercase();
            let clean_fn = strip_rover_suffix(&fn_name);
            if fn_name == base_name || clean_fn == clean_base || contains_word_boundary(&fn_name, &clean_base) || contains_word_boundary(&base_name, &clean_fn) {
                target_cg_name = item.get("CgName").and_then(|v| v.as_str()).unwrap_or("").to_string();
                break;
            }
        }
    }

    if target_cg_name.is_empty() {
        target_cg_name = clean_base.to_string();
    }

    let clean_target_cg = strip_rover_suffix(&target_cg_name).to_lowercase();
    let mut events = Vec::new();
    for item in &videosound {
        if let Some(cg_name) = item.get("CgName").and_then(|v| v.as_str()) {
            let cg_lower = cg_name.to_lowercase();
            let clean_item_cg = strip_rover_suffix(cg_name).to_lowercase();
            let matches_cg = cg_name.eq_ignore_ascii_case(&target_cg_name)
                || clean_item_cg == clean_target_cg
                || (!clean_target_cg.is_empty() && (cg_lower.contains(&clean_target_cg) || clean_target_cg.contains(&clean_item_cg)));

            if matches_cg {
                if let Some(event_path) = item.get("EventPath").and_then(|v| v.as_str()) {
                    let event = event_path.split('/').last().unwrap_or("").split('.').next().unwrap_or("").to_string();
                    if !events.contains(&event) {
                        events.push(event);
                    }
                }
            }
        }
    }
    
    Ok(events)
}

fn is_event_txtp_match(txtp_path_str: &str, event_name: &str) -> bool {
    let p = Path::new(txtp_path_str);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    let ev = event_name.to_lowercase();
    
    if stem == ev {
        return true;
    }
    if stem.starts_with(&format!("{} ", ev))
        || stem.starts_with(&format!("{}(", ev))
        || stem.starts_with(&format!("{}.", ev)) {
        return true;
    }

    if let Some(rest) = stem.strip_prefix(&format!("{}_", ev)) {
        let first_token = rest.split(|c: char| c == '_' || c == '.' || c == ' ' || c == '(').next().unwrap_or("");
        let allowed_suffixes = [
            "nvzhu", "nanzhu", "nv", "nan", "girl", "boy", "female", "male",
            "ja", "en", "ko", "zh", "de", "fr", "es", "ru", "id", "th", "vi", "zho", "jpn", "eng", "kor",
            "cam010", "cam020", "cam030", "part1", "part2", "01", "02", "1", "2"
        ];
        if allowed_suffixes.contains(&first_token) || first_token.chars().all(|c| c.is_ascii_digit()) {
            return true;
        }
    }

    let core_ev = strip_event_suffix(strip_event_prefix(&ev));
    let stem_no_args = stem.split(|c: char| c == ' ' || c == '(').next().unwrap_or(&stem);
    let core_stem = strip_event_suffix(strip_event_prefix(stem_no_args));

    if !core_ev.is_empty() && core_ev.len() >= 3 {
        if core_stem == core_ev {
            return true;
        }
    }

    false
}

fn is_txtp_gender_and_locale_match(
    txtp_str: &str,
    girl_or_boy: &str,
    norm_locale: &str,
    all_locales: &[&str],
) -> bool {
    let lower_m = txtp_str.to_lowercase();

    // 1. Strict Gender Exclusion
    if girl_or_boy == "Girl" {
        if lower_m.contains("(3313202977=3111576190)")
            || lower_m.contains("_nanzhu")
            || lower_m.contains("_nan.")
            || lower_m.contains("_nan_")
            || lower_m.contains("_boy")
            || lower_m.contains("_male")
        {
            return false;
        }
    } else {
        if lower_m.contains("(3313202977=2204441813)")
            || lower_m.contains("_nvzhu")
            || lower_m.contains("_nv.")
            || lower_m.contains("_nv_")
            || lower_m.contains("_girl")
            || lower_m.contains("_female")
        {
            return false;
        }
    }

    // 2. Strict Locale Exclusion
    for other_loc in all_locales {
        if *other_loc != norm_locale {
            let switch_pattern = format!("={})", other_loc);
            let switch_pattern2 = format!("_{}.", other_loc);
            let switch_pattern3 = format!("_{}_", other_loc);
            if lower_m.contains(&switch_pattern) || lower_m.contains(&switch_pattern2) || lower_m.contains(&switch_pattern3) {
                return false;
            }
        }
    }

    true
}

fn extract_state_ids_from_small_bnk(bnk_path: &Path) -> Vec<u32> {
    let mut ids = Vec::new();
    if let Ok(data) = fs::read(bnk_path) {
        for i in 0..data.len().saturating_sub(3) {
            let val = u32::from_le_bytes([data[i], data[i+1], data[i+2], data[i+3]]);
            if val > 100000 && val != 2234941458 {
                ids.push(val);
            }
        }
    }
    ids
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DialogueMatch {
    pub cg_name: String,
    pub caption_id: i64,
    pub show_moment: f64,
    pub time_formatted: String,
    pub content: String,
}


#[tauri::command]
pub fn search_dialogue(
    app: AppHandle,
    query: String,
    lang: Option<String>,
) -> Result<Vec<DialogueMatch>, String> {
    let clean_query = query.trim().to_lowercase();
    if clean_query.is_empty() {
        return Ok(vec![]);
    }

    let data_dir = get_data_dir(&app);
    let l = lang.unwrap_or_else(|| "th".to_string());
    let videocaption_path = resolve_videocaption_file(&data_dir);
    let multitext_path = resolve_multitext_file(&data_dir, &l);

    if !videocaption_path.exists() || !multitext_path.exists() {
        return Ok(vec![]);
    }

    let vc_str = fs::read_to_string(&videocaption_path).map_err(|e| e.to_string())?;
    let videocaptions: Vec<Value> = serde_json::from_str(&vc_str).map_err(|e| e.to_string())?;

    let mut caption_map: std::collections::HashMap<String, Vec<(String, f64, i64)>> = std::collections::HashMap::new();
    for vc in videocaptions {
        let cg_name = vc.get("CgName").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let cap_id = vc.get("CaptionId").and_then(|v| v.as_i64()).unwrap_or(0);
        let show_moment = vc.get("ShowMoment").and_then(|v| v.as_f64()).unwrap_or(0.0);
        if let Some(text_key) = vc.get("CaptionText").and_then(|v| v.as_str()) {
            caption_map.entry(text_key.to_string()).or_default().push((cg_name, show_moment, cap_id));
        }
    }

    let mt_str = fs::read_to_string(&multitext_path).map_err(|e| e.to_string())?;
    let multitext: Vec<Value> = serde_json::from_str(&mt_str).map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    let mut seen_cg: std::collections::HashSet<String> = std::collections::HashSet::new();

    for mt in &multitext {
        let content = mt.get("Content").and_then(|v| v.as_str()).unwrap_or("");
        if content.to_lowercase().contains(&clean_query) {
            let id = mt.get("Id").and_then(|v| v.as_str()).unwrap_or("");
            if let Some(matches) = caption_map.get(id) {
                let cleaned_text = clean_subtitle_text(content);
                if cleaned_text.is_empty() {
                    continue;
                }
                for (cg_name, show_moment, cap_id) in matches {
                    let key = format!("{}:{}", cg_name, cap_id);
                    if !seen_cg.contains(&key) {
                        seen_cg.insert(key);
                        let start_ms = (*show_moment * (1000.0 / 30.0)) as i64;
                        let time_str = format_srt_time(start_ms);
                        results.push(DialogueMatch {
                            cg_name: cg_name.clone(),
                            caption_id: *cap_id,
                            show_moment: *show_moment,
                            time_formatted: time_str,
                            content: cleaned_text.clone(),
                        });
                        if results.len() >= 60 {
                            break;
                        }
                    }
                }
            }
        }
        if results.len() >= 60 {
            break;
        }
    }

    Ok(results)
}

#[tauri::command]
pub fn get_cutscene_dialogue(
    app: AppHandle,
    cg_name: String,
    lang: Option<String>,
) -> Result<Vec<CutsceneSubtitleLine>, String> {
    let data_dir = get_data_dir(&app);
    let l = lang.unwrap_or_else(|| "th".to_string());

    let multitext_path = resolve_multitext_file(&data_dir, &l);
    if !multitext_path.exists() {
        let app_handle = app.clone();
        let target_lang = l.clone();
        tokio::spawn(async move {
            let _ = crate::commands::downloader::download_data(app_handle, Some(target_lang)).await;
        });
    }

    let config_state = app.state::<crate::config::ConfigState>();
    let cfg = config_state.0.lock().unwrap().clone();
    let ruby_cfg = crate::subtitles::RubyConfig {
        enabled: cfg.ruby_enabled,
        font_name: cfg.ruby_font.clone(),
        size: cfg.ruby_size,
        outline: cfg.ruby_outline,
        shadow: cfg.ruby_shadow,
        offset_y: cfg.ruby_offset_y,
        color: cfg.ruby_color.clone(),
    };
    let lyric_cfg = crate::subtitles::LyricConfig {
        font_name: cfg.lyric_font.clone(),
        size: cfg.lyric_size,
        outline: cfg.lyric_outline,
        shadow: cfg.lyric_shadow,
        margin_x: cfg.lyric_margin_x,
        margin_y: cfg.lyric_margin_y,
        bilingual: cfg.lyric_bilingual,
        color: cfg.lyric_color.clone(),
    };

    let (_, mut dialogue_lines) =
        crate::subtitles::load_cutscene_dialogues_for_cg(
            &data_dir,
            &cg_name,
            &l,
            "ja",
            &cfg.sub_font,
            cfg.sub_size as f32,
            cfg.sub_margin_v,
            Some(&ruby_cfg),
        );
    let (_, mut lyric_lines) = crate::subtitles::load_music_lyrics_for_cg(&data_dir, &cg_name, &l, cfg.sub_size as f32, Some(&lyric_cfg));

    let mut all_lines = Vec::new();
    all_lines.append(&mut dialogue_lines);
    all_lines.append(&mut lyric_lines);

    all_lines.sort_by(|a, b| {
        a.show_moment
            .partial_cmp(&b.show_moment)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(all_lines)
}

#[tauri::command]
pub fn export_subtitles_bundle(
    app: AppHandle,
    state: tauri::State<'_, crate::config::ConfigState>,
    cg_name: String,
    lang: Option<String>,
) -> Result<Vec<String>, String> {
    let mut config = state.0.lock().unwrap().clone();
    if let Some(l) = lang {
        let trimmed = l.trim();
        if !trimmed.is_empty() {
            config.subtitle_lang = trimmed.to_string();
        }
    }
    let export_dir = config.get_effective_export_dir();
    let safe_name = sanitize_cutscene_filename(&cg_name);
    let target_dir = export_dir.join("cutscenes").join(&safe_name).join("subtitles");
    let _ = fs::create_dir_all(&target_dir);

    let (srt, ass) = generate_captions(&app, &cg_name, &config, "ja")?;
    let mut files = Vec::new();
    if let Some(s) = srt { files.push(s); }
    if let Some(a) = ass { files.push(a); }
    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_cutscene_filename_traversal() {
        assert_eq!(sanitize_cutscene_filename("../../evil_path"), "__evil_path");
        assert_eq!(sanitize_cutscene_filename("..\\..\\windows\\system32"), "__windows_system32");
    }

    #[test]
    fn test_sanitize_cutscene_filename_illegal_chars() {
        assert_eq!(sanitize_cutscene_filename("SP01_Boss:Fight*Final?"), "SP01_Boss_Fight_Final_");
        assert_eq!(sanitize_cutscene_filename("<Aki_Cutscene_01>"), "_Aki_Cutscene_01_");
    }

    #[test]
    fn test_sanitize_cutscene_filename_empty_fallback() {
        assert_eq!(sanitize_cutscene_filename("   "), "cutscene_caption");
        assert_eq!(sanitize_cutscene_filename("..."), "cutscene_caption");
        assert_eq!(sanitize_cutscene_filename("___"), "cutscene_caption");
    }

    #[test]
    fn test_is_event_txtp_match() {
        // Exact and gamesync matches
        assert!(is_event_txtp_match("play_all_sound_m0389.txtp", "play_all_sound_m0389"));
        assert!(is_event_txtp_match("play_all_sound_m0389 (3313202977=3111576190).txtp", "play_all_sound_m0389"));
        assert!(is_event_txtp_match("play_all_sound_m0389_nvzhu.txtp", "play_all_sound_m0389"));
        assert!(is_event_txtp_match("play_all_sound_m0389_ja.txtp", "play_all_sound_m0389"));
        assert!(is_event_txtp_match("play_video_all_sound_m0389.txtp", "play_all_sound_m0389"));

        // Suffixes that belong to different events MUST NOT match
        assert!(!is_event_txtp_match("play_all_sound_m0389_music_lyric.txtp", "play_all_sound_m0389"));
        assert!(!is_event_txtp_match("play_all_sound_m0389_ambient.txtp", "play_all_sound_m0389"));
        assert!(!is_event_txtp_match("play_all_sound_m0389_extra_track.txtp", "play_all_sound_m0389"));

        // Companion music events match their exact corresponding txtp
        assert!(is_event_txtp_match("play_all_sound_m0389_music_lyric.txtp", "play_all_sound_m0389_music_lyric"));
        assert!(is_event_txtp_match("play_all_sound_m0390_lyric.txtp", "play_all_sound_m0390_lyric"));
        assert!(is_event_txtp_match("play_sequence_music_m0357.txtp", "play_sequence_music_m0357"));
    }

    #[test]
    fn test_rover_gender_and_locale_matching() {
        let all_locales = ["ja", "en", "ko", "zh-hans", "zh-hant", "zh"];
        
        // Music lyric track is universal for all genders and locales
        assert!(is_txtp_gender_and_locale_match(
            "play_all_sound_m0389_music_lyric.txtp",
            "Girl",
            "ja",
            &all_locales
        ));
        assert!(is_txtp_gender_and_locale_match(
            "play_all_sound_m0389_music_lyric.txtp",
            "Boy",
            "ja",
            &all_locales
        ));

        // Dialogue girl switch vs boy switch
        assert!(is_txtp_gender_and_locale_match(
            "play_all_sound_m0389 (3313202977=2204441813).txtp",
            "Girl",
            "ja",
            &all_locales
        ));
        assert!(!is_txtp_gender_and_locale_match(
            "play_all_sound_m0389 (3313202977=2204441813).txtp",
            "Boy",
            "ja",
            &all_locales
        ));
        assert!(is_txtp_gender_and_locale_match(
            "play_all_sound_m0389 (3313202977=3111576190).txtp",
            "Boy",
            "ja",
            &all_locales
        ));
        assert!(!is_txtp_gender_and_locale_match(
            "play_all_sound_m0389 (3313202977=3111576190).txtp",
            "Girl",
            "ja",
            &all_locales
        ));
    }
}

use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;

use crate::config::ConfigState;
use crate::commands::downloader::get_data_dir;
use crate::commands::log::emit_log;

#[derive(Serialize, Deserialize, Debug)]
pub struct VideoInfo {
    pub cg_name: String,
    pub cg_file: String,
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
) -> Result<VideoInfo, String> {
    let config = state.0.lock().unwrap().clone();
    let export_dir = PathBuf::from(&config.export_dir);
    let data_dir = get_data_dir(&app);
    let txtp_dir = export_dir.join("txtp");
    let mp4 = PathBuf::from(&mp4_path);

    if !mp4.exists() {
        return Err(format!("Video file not found: {}", mp4_path));
    }

    emit_log(&app, &format!("Parsing metadata for {}...", mp4.file_name().unwrap().to_string_lossy()));

    let lang = if config.subtitle_lang.is_empty() { "th".to_string() } else { config.subtitle_lang.clone() };
    let videodata_path = data_dir.join("videodata.json");
    let videosound_path = data_dir.join("videosound.json");
    let videocaption_path = data_dir.join("videocaption.json");
    let multitext_lang_path = data_dir.join(format!("MultiText_{}.json", lang));
    let multitext_path = if multitext_lang_path.exists() {
        multitext_lang_path
    } else {
        data_dir.join("MultiText.json")
    };

    if !videodata_path.exists() || !videosound_path.exists() || !videocaption_path.exists() || !multitext_path.exists() {
        emit_log(&app, &format!("Required JSON data for language '{}' missing. Auto-downloading...", lang));
        let _ = crate::commands::downloader::download_data(app.clone(), Some(lang)).await;
    }

    let videodata_str = fs::read_to_string(&videodata_path).map_err(|e| e.to_string())?;
    let videosound_str = fs::read_to_string(&videosound_path).map_err(|e| e.to_string())?;

    let videodata: Vec<Value> = serde_json::from_str(&videodata_str).map_err(|e| e.to_string())?;
    let videosound: Vec<Value> = serde_json::from_str(&videosound_str).map_err(|e| e.to_string())?;

    let base_name = mp4.file_stem().unwrap().to_string_lossy().to_string().to_lowercase();
    
    // Find matching CgName
    let mut target_cg_name = String::new();
    let target_gender_num = if girl_or_boy == "Girl" { 0 } else { 1 };
    
    for item in videodata {
        if let Some(cg_file) = item.get("CgFile").and_then(|v| v.as_str()) {
            let fn_name = cg_file.split('/').last().unwrap().split('.').next().unwrap().to_lowercase();
            if fn_name == base_name || base_name.contains(&fn_name) || fn_name.contains(&base_name) {
                target_cg_name = item.get("CgName").and_then(|v| v.as_str()).unwrap_or("").to_string();
                break;
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
    for item in videosound {
        if let Some(cg_name) = item.get("CgName").and_then(|v| v.as_str()) {
            if cg_name == target_cg_name {
                let sound_gender = item.get("GirlOrBoy").and_then(|v| v.as_i64()).unwrap_or(2);
                if sound_gender == 2 || sound_gender == target_gender_num as i64 {
                    if let Some(event_path) = item.get("EventPath").and_then(|v| v.as_str()) {
                        let event = event_path.split('/').last().unwrap().split('.').next().unwrap().to_string();
                        events.push(event);
                    }
                }
            }
        }
    }

    // Scan all bnk files in export_dir to extract missing banks on-demand
    let mut all_bnks = Vec::new();
    let mut dirs_to_visit = vec![export_dir.clone()];
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
    let mut companion_bgm_tracks: Vec<(String, Vec<u32>)> = Vec::new();
    let mut banks_to_extract = Vec::new();

    for bnk in &all_bnks {
        let bnk_stem = bnk.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
        // Check if the bank explicitly names this specific CG (e.g. set_state_boss_3_3_aliefuyi_m0357_stage3_loop.bnk or play_sequence_music_m0357.bnk)
        if bnk_stem.contains(&format!("_{}", cg_lower)) || bnk_stem.contains(&format!("{}_", cg_lower)) || bnk_stem == cg_lower {
            if bnk_stem.starts_with("play_sequence_music_") || bnk_stem.starts_with("play_story_music_") {
                if !events.contains(&bnk_stem) {
                    events.push(bnk_stem);
                }
            } else if bnk_stem.starts_with("set_state_") || bnk_stem.starts_with("set_music_") {
                let cleaned = bnk_stem.replace("set_state_", "").replace("set_music_", "");
                let tokens: Vec<&str> = cleaned.split('_').collect();
                let mut matched_parent_bank: Option<PathBuf> = None;
                for k in (2..=tokens.len()).rev() {
                    let candidate_music = format!("play_music_{}", tokens[..k].join("_"));
                    if let Some(pb) = all_bnks.iter().find(|b| b.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase() == candidate_music) {
                        matched_parent_bank = Some(pb.clone());
                        break;
                    }
                    let candidate_bgm = format!("play_bgm_{}", tokens[..k].join("_"));
                    if let Some(pb) = all_bnks.iter().find(|b| b.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase() == candidate_bgm) {
                        matched_parent_bank = Some(pb.clone());
                        break;
                    }
                }

                if let Some(parent_bnk) = matched_parent_bank {
                    let state_ids = extract_state_ids_from_small_bnk(bnk);
                    let parent_stem = parent_bnk.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
                    banks_to_extract.push(parent_bnk);
                    banks_to_extract.push(bnk.clone());
                    companion_bgm_tracks.push((parent_stem, state_ids));
                }
            }
        }
    }

    // If events was not found in videosound.json, look for direct exact bnk matches for base_name
    if events.is_empty() {
        let possible_stems = [
            format!("play_all_sound_{}", base_name),
            format!("play_sound_{}", base_name),
            format!("play_sfx_lva_{}", base_name),
            format!("play_sfx_{}", base_name),
            format!("play_sequence_music_{}", base_name),
            base_name.clone(),
        ];
        for bnk in &all_bnks {
            let bnk_stem = bnk.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
            for ps in &possible_stems {
                if bnk_stem == *ps || bnk_stem.starts_with(&format!("{}_", ps)) || bnk_stem.starts_with(&format!("{} ", ps)) {
                    events.push(bnk_stem.clone());
                    break;
                }
            }
        }
    }

    let _ = fs::create_dir_all(&txtp_dir);
    let mut txtp_cache = index_directory(&txtp_dir, "txtp");

    // Collect banks to extract on-demand if missing
    for event in &events {
        let exists = txtp_cache.iter().any(|p| is_event_txtp_match(p, event));
        if !exists {
            let ev_lower = event.to_lowercase();
            for bnk in &all_bnks {
                let file_stem = bnk.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
                if file_stem == ev_lower || file_stem.starts_with(&format!("{}_", ev_lower)) || file_stem.starts_with(&format!("{} ", ev_lower)) {
                    banks_to_extract.push(bnk.clone());
                    break;
                }
            }
        }
    }

    if !banks_to_extract.is_empty() {
        banks_to_extract.sort();
        banks_to_extract.dedup();
        emit_log(&app, &format!("Extracting {} missing sound & music bank(s)...", banks_to_extract.len()));
        let _ = crate::commands::wwiser::run_wwiser_for_banks(&app, &export_dir, &banks_to_extract).await;
        txtp_cache = index_directory(&txtp_dir, "txtp");
    }

    // Auto-resolve .wem paths for matched files
    let wem_map = crate::commands::wwiser::index_wem_files(&export_dir);

    // Filter sounds by gender and locale
    let mut sounds = Vec::new();
    let gender_param = if girl_or_boy == "Girl" { "(3313202977=2204441813)" } else { "(3313202977=3111576190)" };
    let other_gender_param = if girl_or_boy == "Girl" { "(3313202977=3111576190)" } else { "(3313202977=2204441813)" };
    
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
            let lower_m = m.to_lowercase();
            if lower_m.contains(other_gender_param) {
                continue;
            }

            let mut is_other_locale = false;
            for other_loc in all_locales {
                if other_loc != norm_locale.as_str() {
                    let switch_pattern = format!("={})", other_loc);
                    let switch_pattern2 = format!("_{}.", other_loc);
                    if lower_m.contains(&switch_pattern) || lower_m.contains(&switch_pattern2) {
                        is_other_locale = true;
                        break;
                    }
                }
            }
            if is_other_locale {
                continue;
            }

            let txtp_path = PathBuf::from(&m);
            let _ = crate::commands::wwiser::resolve_wem_paths_in_txtp(&txtp_path, &wem_map);
            sounds.push(m);
        }
    }

    // 2. Match companion BGM tracks matching the exact state IDs
    for (parent_stem, state_ids) in companion_bgm_tracks {
        for txtp in &txtp_cache {
            let p = Path::new(txtp);
            let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
            if stem.starts_with(&parent_stem) {
                let is_state_match = state_ids.iter().any(|&sid| stem.contains(&format!("={})", sid)));
                if is_state_match {
                    let txtp_path = PathBuf::from(txtp);
                    let _ = crate::commands::wwiser::resolve_wem_paths_in_txtp(&txtp_path, &wem_map);
                    sounds.push(txtp.clone());
                }
            }
        }
    }

    sounds.sort();
    sounds.dedup();

    emit_log(&app, &format!("Ready to mix {} authoritative audio track(s):", sounds.len()));
    for s in &sounds {
        let fname = PathBuf::from(s).file_name().unwrap_or_default().to_string_lossy().to_string();
        emit_log(&app, &format!("  -> {}", fname));
    }

    // Generate SRT & ASS Subtitles
    let (srt_path, ass_path) = generate_captions(&app, &target_cg_name, &config).unwrap_or_else(|e| {
        emit_log(&app, &format!("Warning: Could not generate subtitles: {}", e));
        (None, None)
    });

    Ok(VideoInfo {
        cg_name: target_cg_name,
        cg_file: mp4_path,
        girl_or_boy,
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

/// Clean game dialogue tags for SRT
pub fn clean_subtitle_text(raw: &str) -> String {
    // 0. Filter out developer censorship placeholders (e.g. ********************)
    let non_star = raw.trim().chars().filter(|&c| c != '*' && c != ' ' && c != '\t' && c != '\n' && c != '\r').count();
    if non_star == 0 {
        return String::new();
    }

    let mut text = raw.to_string();

    // 1. Replace <ano=RubyText>BaseText</ano> with BaseText
    while let Some(start) = text.find("<ano=") {
        if let Some(tag_end) = text[start..].find('>') {
            let after_tag = start + tag_end + 1;
            if let Some(close_tag) = text[after_tag..].find("</ano>") {
                let base_text = text[after_tag..after_tag + close_tag].to_string();
                let full_len = (after_tag + close_tag + 6) - start;
                text.replace_range(start..start + full_len, &base_text);
            } else {
                let full_tag = text[start..start + tag_end + 1].to_string();
                text = text.replace(&full_tag, "");
            }
        } else {
            break;
        }
    }

    // 2. Intelligent game placeholder replacement (Human dialogue polish)
    // Replace {PlayerName} with standard in-game Rover title
    text = text.replace("{PlayerName}", "ผู้พเนจร");
    text = text.replace("{Rover}", "ผู้พเนจร");
    text = text.replace("{Cus:Ipt,Touch=แตะ PC=คลิก Gamepad=กด}", "คลิก");
    text = text.replace("{Touch=แตะ PC=คลิก Gamepad=กด}", "คลิก");

    // 3. Remove any remaining XML/HTML tags
    let mut clean_chars = String::new();
    let mut in_tag = false;
    for ch in text.chars() {
        if ch == '<' {
            in_tag = true;
        } else if ch == '>' {
            in_tag = false;
        } else if !in_tag {
            clean_chars.push(ch);
        }
    }

    // 4. Remove unhandled bracket placeholders like {0}, {1}, {Score}
    let mut res = String::new();
    let mut in_bracket = false;
    for ch in clean_chars.chars() {
        if ch == '{' {
            in_bracket = true;
        } else if ch == '}' {
            in_bracket = false;
        } else if !in_bracket {
            res.push(ch);
        }
    }

    // 5. Clean extra spaces per line & skip pure asterisk censor strings
    let lines: Vec<String> = res
        .lines()
        .map(|line| line.split_whitespace().collect::<Vec<&str>>().join(" "))
        .filter(|line| !line.is_empty() && line.chars().any(|c| c != '*' && c != ' '))
        .collect();

    lines.join("\n")
}

/// Format dialogue tags for ASS with 2-line Ruby style tags:
/// Top Line: {\rRuby}RubyAnnotation
/// Bottom Line: {\rDefault}Full Base Dialogue Sentence
pub fn clean_subtitle_for_ass(raw: &str) -> String {
    let mut rubies = Vec::new();
    let mut text = raw.to_string();

    while let Some(start) = text.find("<ano=") {
        if let Some(tag_end) = text[start..].find('>') {
            let ruby_text = text[start + 5..start + tag_end].trim().to_string();
            let after_tag = start + tag_end + 1;
            
            if let Some(close_tag) = text[after_tag..].find("</ano>") {
                let base_text = text[after_tag..after_tag + close_tag].to_string();
                let full_len = (after_tag + close_tag + 6) - start;
                if !ruby_text.is_empty() {
                    rubies.push(ruby_text);
                }
                text.replace_range(start..start + full_len, &base_text);
            } else {
                let full_tag = text[start..start + tag_end + 1].to_string();
                text = text.replace(&full_tag, "");
            }
        } else {
            break;
        }
    }

    // Clean base dialogue text
    let clean_base = clean_subtitle_text(&text);
    if clean_base.is_empty() {
        return String::new();
    }

    if !rubies.is_empty() {
        let ruby_line = rubies.join(" ");
        format!("{{\\rRuby}}{}\\N{{\\rDefault}}{}", ruby_line, clean_base)
    } else {
        clean_base
    }
}

// Generate both standard .srt and reference-canvas .ass subtitles
fn generate_captions(
    app: &AppHandle, 
    cg_name: &str,
    config: &crate::config::AppConfig
) -> Result<(Option<String>, Option<String>), String> {
    let data_dir = get_data_dir(app);
    let lang = if config.subtitle_lang.is_empty() { "th".to_string() } else { config.subtitle_lang.clone() };
    let videocaption_path = data_dir.join("videocaption.json");
    let multitext_lang_path = data_dir.join(format!("MultiText_{}.json", lang));
    let multitext_path = if multitext_lang_path.exists() {
        multitext_lang_path
    } else {
        data_dir.join("MultiText.json")
    };
    
    if !videocaption_path.exists() || !multitext_path.exists() {
        emit_log(app, &format!("Subtitles skipped: videocaption.json or MultiText (lang: {}) not found in data dir.", lang));
        return Ok((None, None));
    }

    let vc_str = fs::read_to_string(&videocaption_path).map_err(|e| e.to_string())?;
    let videocaptions: Vec<Value> = serde_json::from_str(&vc_str).map_err(|e| e.to_string())?;

    let mut dest_captions = Vec::new();
    for vc in videocaptions {
        if vc.get("CgName").and_then(|v| v.as_str()) == Some(cg_name) {
            dest_captions.push(vc);
        }
    }
    
    if dest_captions.is_empty() {
        emit_log(app, &format!("No subtitle captions found for CgName: {}", cg_name));
        return Ok((None, None));
    }

    let mut needed_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    for vc in &dest_captions {
        if let Some(id) = vc.get("CaptionText").and_then(|v| v.as_str()) {
            needed_ids.insert(id.to_string());
        }
    }

    let mt_str = fs::read_to_string(&multitext_path).map_err(|e| e.to_string())?;
    let multitext: Vec<Value> = serde_json::from_str(&mt_str).map_err(|e| e.to_string())?;
    
    let mut text_map = std::collections::HashMap::new();
    for mt in multitext {
        if let Some(id) = mt.get("Id").and_then(|v| v.as_str()) {
            if needed_ids.contains(id) {
                if let Some(content) = mt.get("Content").and_then(|v| v.as_str()) {
                    text_map.insert(id.to_string(), content.to_string());
                }
            }
        }
    }
    
    dest_captions.sort_by_key(|c| c.get("CaptionId").and_then(|v| v.as_i64()).unwrap_or(0));

    let font_name = if config.sub_font.is_empty() { "Kanit Medium" } else { &config.sub_font };
    let font_size = if config.sub_size == 0 { 38 } else { config.sub_size };
    let ruby_size = (font_size as f32 * 0.65).max(18.0) as u32;
    let outline = if config.sub_outline < 0.0 { 0.0 } else { config.sub_outline };
    let ruby_outline = (outline * 0.8).max(0.0);
    let shadow = if config.sub_shadow < 0.0 { 0.0 } else { config.sub_shadow };
    let ruby_shadow = (shadow * 0.8).max(0.0);
    let margin_v = if config.sub_margin_v == 0 { 54 } else { config.sub_margin_v };
    let primary_color = hex_to_ass_color(&config.sub_color);

    let mut ass_content = format!(
        "[Script Info]\nTitle: WuWa Cutscene - {cg_name}\nScriptType: v4.00+\nWrapStyle: 0\nScaledBorderAndShadow: yes\nYCbCr Matrix: TV.709\nPlayResX: 1920\nPlayResY: 1080\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,{font_name},{font_size},{primary_color},&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,{outline:.2},{shadow:.2},2,40,40,{margin_v},1\nStyle: Ruby,{font_name},{ruby_size},{primary_color},&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,{ruby_outline:.2},{ruby_shadow:.2},2,40,40,{margin_v},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    );

    let mut srt_content = String::new();
    let mut index = 1;

    for cap in dest_captions {
        let text_id = cap.get("CaptionText").and_then(|v| v.as_str()).unwrap_or("");
        let raw_content = text_map.get(text_id).map(|s| s.as_str()).unwrap_or("");
        let srt_text = clean_subtitle_text(raw_content);
        let ass_text = clean_subtitle_for_ass(raw_content);
        
        if srt_text.is_empty() { continue; }

        let show_moment = cap.get("ShowMoment").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let duration = cap.get("Duration").and_then(|v| v.as_f64()).unwrap_or(0.0);

        let start_ms = (show_moment * (1000.0 / 30.0)) as i64;
        let end_ms = start_ms + (duration * (1000.0 / 30.0)) as i64;

        let start_srt = format_srt_time(start_ms);
        let end_srt = format_srt_time(end_ms);
        srt_content.push_str(&format!("{}\n{} --> {}\n{}\n\n", index, start_srt, end_srt, srt_text));

        let start_ass = format_ass_time(start_ms);
        let end_ass = format_ass_time(end_ms);
        ass_content.push_str(&format!("Dialogue: 0,{},{},Default,,0,0,0,,{}\n", start_ass, end_ass, ass_text));

        index += 1;
    }

    if srt_content.is_empty() {
        emit_log(app, "Subtitle text mapping empty after processing.");
        return Ok((None, None));
    }

    let out_dir = get_data_dir(app).join("captions");
    let _ = fs::create_dir_all(&out_dir);
    
    let safe_name = sanitize_cutscene_filename(cg_name);
    let srt_path = out_dir.join(format!("{}.srt", safe_name));
    fs::write(&srt_path, srt_content).map_err(|e| e.to_string())?;

    let ass_path = out_dir.join(format!("{}.ass", safe_name));
    fs::write(&ass_path, ass_content).map_err(|e| e.to_string())?;

    emit_log(app, &format!("Generated {} subtitle caption(s) for {}", index - 1, safe_name));
    Ok((Some(srt_path.to_string_lossy().to_string()), Some(ass_path.to_string_lossy().to_string())))
}

pub fn sanitize_cutscene_filename(name: &str) -> String {
    let clean: String = name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            other => other,
        })
        .collect();
    
    // Prevent directory traversal by stripping ".."
    let no_traversal = clean.replace("..", "");
    let trimmed = no_traversal.trim().trim_matches(|c| c == '.' || c == ' ');
    if trimmed.is_empty() || trimmed.chars().all(|c| c == '_') {
        "cutscene_caption".to_string()
    } else {
        trimmed.to_string()
    }
}

fn format_srt_time(ms: i64) -> String {
    let s = ms / 1000;
    let ms_part = ms % 1000;
    let m = s / 60;
    let s_part = s % 60;
    let h = m / 60;
    let m_part = m % 60;
    format!("{:02}:{:02}:{:02},{:03}", h, m_part, s_part, ms_part)
}

fn format_ass_time(ms: i64) -> String {
    let s = ms / 1000;
    let ms_part = ms % 1000;
    let m = s / 60;
    let s_part = s % 60;
    let h = m / 60;
    let m_part = m % 60;
    format!("{}:{:02}:{:02}.{:02}", h, m_part, s_part, ms_part / 10)
}

#[tauri::command]
pub fn get_video_audio_event(app: AppHandle, video_name: String) -> Result<Vec<String>, String> {
    let data_dir = get_data_dir(&app);
    let videodata_path = data_dir.join("videodata.json");
    let videosound_path = data_dir.join("videosound.json");

    if !videodata_path.exists() || !videosound_path.exists() {
        return Ok(vec![]);
    }

    let videodata_str = fs::read_to_string(&videodata_path).map_err(|e| e.to_string())?;
    let videosound_str = fs::read_to_string(&videosound_path).map_err(|e| e.to_string())?;

    let videodata: Vec<Value> = serde_json::from_str(&videodata_str).map_err(|e| e.to_string())?;
    let videosound: Vec<Value> = serde_json::from_str(&videosound_str).map_err(|e| e.to_string())?;

    let mp4 = PathBuf::from(video_name);
    let base_name = mp4.file_stem().unwrap().to_string_lossy().to_string().to_lowercase();
    
    let mut target_cg_name = String::new();
    for item in videodata {
        if let Some(cg_file) = item.get("CgFile").and_then(|v| v.as_str()) {
            let fn_name = cg_file.split('/').last().unwrap().split('.').next().unwrap().to_lowercase();
            if fn_name == base_name || base_name.contains(&fn_name) || fn_name.contains(&base_name) {
                target_cg_name = item.get("CgName").and_then(|v| v.as_str()).unwrap_or("").to_string();
                break;
            }
        }
    }

    if target_cg_name.is_empty() {
        return Ok(vec![]);
    }

    let mut events = Vec::new();
    for item in videosound {
        if let Some(cg_name) = item.get("CgName").and_then(|v| v.as_str()) {
            if cg_name == target_cg_name {
                if let Some(event_path) = item.get("EventPath").and_then(|v| v.as_str()) {
                    let event = event_path.split('/').last().unwrap().split('.').next().unwrap().to_string();
                    events.push(event);
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
        || stem.starts_with(&format!("{}_", ev))
        || stem.starts_with(&format!("{}(", ev))
        || stem.starts_with(&format!("{}.", ev)) {
        return true;
    }
    false
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
}

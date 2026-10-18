use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use serde_json::Value;

use super::ass_writer::hex_to_ass_color;
use super::lyrics::extract_clean_cg_tag;
use super::ruby::{clean_subtitle_for_ass, clean_subtitle_text, parse_ruby_segments};
use super::types::{CutsceneSubtitleLine, RubyConfig, SubtitleEvent};

pub fn resolve_multitext_file(data_dir: &Path, lang: &str) -> std::path::PathBuf {
    let norm_lang = match lang.trim() {
        "zh" | "zh-cn" | "zh-hans" | "zh_hans" | "zh_cn" => "zh-Hans",
        "zh-tw" | "zh-hk" | "zh-hant" | "zh_hant" | "zh_tw" => "zh-Hant",
        other => other,
    };

    // 1. Hierarchical structure from Arikatsu: Textmaps/<norm_lang>/multi_text/MultiText.json
    let p_hier = data_dir.join("Textmaps").join(norm_lang).join("multi_text").join("MultiText.json");
    if p_hier.exists() {
        return p_hier;
    }

    // 2. Flat named file: MultiText_<norm_lang>.json
    let p_norm = data_dir.join(format!("MultiText_{}.json", norm_lang));
    if p_norm.exists() {
        return p_norm;
    }

    // 3. Raw lang name if different from norm_lang
    let trimmed = lang.trim();
    if trimmed != norm_lang {
        let p_raw = data_dir.join(format!("MultiText_{}.json", trimmed));
        if p_raw.exists() {
            return p_raw;
        }
    }

    // 4. Fallback to MultiText.json ONLY for Thai ("th")
    if norm_lang.eq_ignore_ascii_case("th") {
        let p_default = data_dir.join("MultiText.json");
        if p_default.exists() {
            return p_default;
        }
    }

    // Return expected candidate path so that .exists() returns false when file is missing
    p_norm
}

pub fn load_cutscene_dialogues_for_cg(
    data_dir: &Path,
    cg_name: &str,
    lang: &str,
    audio_locale: &str,
    sub_font: &str,
    sub_size: f32,
    sub_margin_v: u32,
    ruby_cfg: Option<&RubyConfig>,
) -> (Vec<SubtitleEvent>, Vec<CutsceneSubtitleLine>) {
    let videocaption_path = data_dir.join("videocaption.json");
    if !videocaption_path.exists() {
        return (Vec::new(), Vec::new());
    }

    let vc_str = match fs::read_to_string(&videocaption_path) {
        Ok(s) => s,
        Err(_) => return (Vec::new(), Vec::new()),
    };

    let videocaptions: Vec<Value> = match serde_json::from_str(&vc_str) {
        Ok(v) => v,
        Err(_) => return (Vec::new(), Vec::new()),
    };

    let clean_target = extract_clean_cg_tag(cg_name);
    let mut dest_captions = Vec::new();
    let mut needed_ids = HashSet::new();

    for vc in &videocaptions {
        if let Some(name) = vc.get("CgName").and_then(|v| v.as_str()) {
            let name_clean = extract_clean_cg_tag(name);
            if name.eq_ignore_ascii_case(cg_name)
                || name_clean == clean_target
                || clean_target.starts_with(&name_clean)
                || name_clean.starts_with(&clean_target)
            {
                if let Some(id) = vc.get("CaptionText").and_then(|v| v.as_str()) {
                    needed_ids.insert(id.to_string());
                }
                dest_captions.push(vc.clone());
            }
        }
    }

    if dest_captions.is_empty() {
        return (Vec::new(), Vec::new());
    }

    let multitext_path = resolve_multitext_file(data_dir, lang);
    if !multitext_path.exists() {
        return (Vec::new(), Vec::new());
    }

    let mt_str = match fs::read_to_string(&multitext_path) {
        Ok(s) => s,
        Err(_) => return (Vec::new(), Vec::new()),
    };

    let multitext: Vec<Value> = match serde_json::from_str(&mt_str) {
        Ok(v) => v,
        Err(_) => return (Vec::new(), Vec::new()),
    };

    let mut text_map = HashMap::new();
    for mt in multitext {
        if let Some(id) = mt.get("Id").and_then(|v| v.as_str()) {
            if needed_ids.contains(id) {
                if let Some(content) = mt.get("Content").and_then(|v| v.as_str()) {
                    text_map.insert(id.to_string(), content.to_string());
                }
            }
        }
    }

    let (moment_key, dur_key) = match audio_locale.to_lowercase().as_str() {
        "ja" => ("ShowMomentJa", "DurationJa"),
        "en" => ("ShowMomentEn", "DurationEn"),
        "ko" => ("ShowMomentKo", "DurationKo"),
        "zh" | "zh-hans" | "zh-hant" => ("ShowMomentZh", "DurationZh"),
        _ => ("ShowMoment", "Duration"),
    };

    dest_captions.sort_by_key(|c| {
        c.get(moment_key)
            .and_then(|v| v.as_f64())
            .or_else(|| c.get("ShowMoment").and_then(|v| v.as_f64()))
            .map(|f| (f * 1000.0) as i64)
            .unwrap_or(0)
    });

    let mut events = Vec::new();
    let mut lines = Vec::new();

    let default_ruby = RubyConfig::default();
    let r_cfg = ruby_cfg.unwrap_or(&default_ruby);
    let ruby_size = if r_cfg.size > 0 {
        r_cfg.size
    } else {
        ((sub_size * 0.52).round() as u32).max(18)
    };
    let ruby_ass_color = hex_to_ass_color(if r_cfg.color.is_empty() { "#E0E0E0" } else { &r_cfg.color });

    for cap in dest_captions {
        let text_id = cap.get("CaptionText").and_then(|v| v.as_str()).unwrap_or("");
        let raw_content = text_map.get(text_id).map(|s| s.as_str()).unwrap_or("");
        let ruby_res = parse_ruby_segments(raw_content, sub_font, sub_size, sub_margin_v, r_cfg.offset_y);
        let srt_text = clean_subtitle_text(raw_content);
        let ass_text = ruby_res.clean_base_text.clone();

        if srt_text.is_empty() {
            continue;
        }

        let mut show_moment = cap.get(moment_key).and_then(|v| v.as_f64()).unwrap_or(0.0);
        let mut duration = cap.get(dur_key).and_then(|v| v.as_f64()).unwrap_or(0.0);

        if show_moment <= 0.0 && duration <= 0.0 {
            show_moment = cap.get("ShowMoment").and_then(|v| v.as_f64()).unwrap_or(0.0);
            duration = cap.get("Duration").and_then(|v| v.as_f64()).unwrap_or(0.0);
        }

        if duration <= 0.0 {
            duration = 90.0;
        }

        let start_ms = (show_moment * (1000.0 / 30.0)) as i64;
        let end_ms = start_ms + (duration * (1000.0 / 30.0)) as i64;

        events.push(SubtitleEvent {
            layer: 0,
            start_ms,
            end_ms,
            style: "Default".to_string(),
            margin_l: 40,
            margin_r: 40,
            margin_v: sub_margin_v,
            ass_text,
            srt_text: srt_text.clone(),
        });

        if r_cfg.enabled {
            for anno in ruby_res.annotations {
                events.push(SubtitleEvent {
                    layer: 1,
                    start_ms,
                    end_ms,
                    style: "Ruby".to_string(),
                    margin_l: 0,
                    margin_r: 0,
                    margin_v: 0,
                    ass_text: format!(r"{{\an2\pos({:.0},{:.0})\fs{}\c{}}}{}", anno.pos_x, anno.pos_y, ruby_size, ruby_ass_color, anno.ruby_text),
                    srt_text: String::new(),
                });
            }
        }

        let cap_id = cap.get("CaptionId").and_then(|v| v.as_i64()).unwrap_or(0);
        let s = start_ms / 1000;
        let m = s / 60;
        let s_part = s % 60;
        let h = m / 60;
        let m_part = m % 60;
        let time_formatted = format!("{:02}:{:02}:{:02}", h, m_part, s_part);

        lines.push(CutsceneSubtitleLine {
            caption_id: cap_id,
            show_moment,
            duration,
            time_formatted,
            content: srt_text,
        });
    }

    (events, lines)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_multitext_file_thai_fallback() {
        let unique_name = format!("wuwa_test_th_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        let test_dir = std::env::temp_dir().join(unique_name);
        let _ = fs::create_dir_all(&test_dir);

        // When only MultiText.json exists, "th" resolves to it
        let legacy_file = test_dir.join("MultiText.json");
        fs::write(&legacy_file, "[]").unwrap();
        assert_eq!(resolve_multitext_file(&test_dir, "th"), legacy_file);

        // When MultiText_th.json exists, "th" prefers it
        let th_file = test_dir.join("MultiText_th.json");
        fs::write(&th_file, "[]").unwrap();
        assert_eq!(resolve_multitext_file(&test_dir, "th"), th_file);

        let _ = fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_resolve_multitext_file_non_thai_no_fallback() {
        let unique_name = format!("wuwa_test_non_th_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        let test_dir = std::env::temp_dir().join(unique_name);
        let _ = fs::create_dir_all(&test_dir);

        // MultiText.json exists (Thai text)
        let legacy_file = test_dir.join("MultiText.json");
        fs::write(&legacy_file, "[]").unwrap();

        // Requesting "en" must NOT fall back to Thai MultiText.json
        let en_path = resolve_multitext_file(&test_dir, "en");
        assert_eq!(en_path, test_dir.join("MultiText_en.json"));
        assert!(!en_path.exists());

        // Requesting "ja" must NOT fall back to Thai MultiText.json
        let ja_path = resolve_multitext_file(&test_dir, "ja");
        assert_eq!(ja_path, test_dir.join("MultiText_ja.json"));
        assert!(!ja_path.exists());

        let _ = fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_resolve_multitext_file_chinese_variants() {
        let unique_name = format!("wuwa_test_zh_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        let test_dir = std::env::temp_dir().join(unique_name);
        let _ = fs::create_dir_all(&test_dir);

        let zh_path = resolve_multitext_file(&test_dir, "zh");
        assert_eq!(zh_path, test_dir.join("MultiText_zh-Hans.json"));

        let zh_hant_path = resolve_multitext_file(&test_dir, "zh-Hant");
        assert_eq!(zh_hant_path, test_dir.join("MultiText_zh-Hant.json"));

        let _ = fs::remove_dir_all(&test_dir);
    }
}

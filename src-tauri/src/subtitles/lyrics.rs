use std::collections::HashMap;
use std::fs;
use std::path::Path;
use serde_json::Value;

use super::ass_writer::hex_to_ass_color;
use super::ruby::strip_html_tags;
use super::types::{CutsceneSubtitleLine, LyricConfig, MusicLyricRaw, SubtitleEvent};

pub fn extract_clean_cg_tag(cg_name: &str) -> String {
    let filename = cg_name
        .split('/')
        .last()
        .unwrap_or(cg_name)
        .split('\\')
        .last()
        .unwrap_or(cg_name);

    let lower = filename.to_lowercase();
    let without_ext = if let Some(pos) = lower.rfind(".mp4") {
        &lower[..pos]
    } else {
        &lower
    };

    let stripped = without_ext
        .replace("_nvzhu", "")
        .replace("_nanzhu", "")
        .replace("_girl", "")
        .replace("_boy", "")
        .replace("_male", "")
        .replace("_female", "")
        .replace("_neutral", "");

    stripped.trim().to_string()
}

pub fn load_music_lyrics_for_cg(
    data_dir: &Path,
    cg_name: &str,
    lang: &str,
    sub_size: f32,
    lyric_cfg: Option<&LyricConfig>,
) -> (Vec<SubtitleEvent>, Vec<CutsceneSubtitleLine>) {
    let lyrics_json_path = data_dir.join("musicsubtitle.json");
    if !lyrics_json_path.exists() {
        return (Vec::new(), Vec::new());
    }

    let raw_data = match fs::read_to_string(&lyrics_json_path) {
        Ok(s) => s,
        Err(_) => return (Vec::new(), Vec::new()),
    };

    let all_lyrics: Vec<MusicLyricRaw> = match serde_json::from_str(&raw_data) {
        Ok(items) => items,
        Err(_) => return (Vec::new(), Vec::new()),
    };

    let clean_target = extract_clean_cg_tag(cg_name);
    let mut matching_raw = Vec::new();

    for item in all_lyrics {
        let tag = item.group_tag.as_deref().unwrap_or("").trim().to_lowercase();
        if tag.is_empty() {
            continue;
        }

        let is_match = if tag == "1" {
            clean_target == "1"
        } else if clean_target == tag {
            true
        } else if clean_target.starts_with(&tag) || tag.starts_with(&clean_target) {
            true
        } else {
            clean_target.contains(&tag)
        };

        if is_match {
            matching_raw.push(item);
        }
    }

    if matching_raw.is_empty() {
        return (Vec::new(), Vec::new());
    }

    matching_raw.sort_by(|a, b| {
        let sa = a.start_time.unwrap_or(0.0);
        let sb = b.start_time.unwrap_or(0.0);
        sa.partial_cmp(&sb).unwrap_or(std::cmp::Ordering::Equal)
    });

    let norm_lang = match lang.trim() {
        "zh" | "zh-cn" | "zh-hans" | "zh_hans" | "zh_cn" => "zh-Hans",
        "zh-tw" | "zh-hk" | "zh-hant" | "zh_hant" | "zh_tw" => "zh-Hant",
        other => other,
    };
    let trans_hier = data_dir.join("Textmaps").join(norm_lang).join("multi_text").join("MultiText.json");
    let trans_file = data_dir.join(format!("MultiText_{}.json", norm_lang));
    let trans_raw = data_dir.join(format!("MultiText_{}.json", lang));
    let trans_path = if trans_hier.exists() {
        trans_hier
    } else if trans_file.exists() {
        trans_file
    } else if trans_raw.exists() {
        trans_raw
    } else if data_dir.join("MultiText_en.json").exists() {
        data_dir.join("MultiText_en.json")
    } else {
        data_dir.join("MultiText.json")
    };

    let orig_file_zh = data_dir.join("MultiText_zh-Hans.json");
    let orig_path = if orig_file_zh.exists() {
        orig_file_zh
    } else if data_dir.join("MultiText_zh.json").exists() {
        data_dir.join("MultiText_zh.json")
    } else {
        data_dir.join("MultiText.json")
    };

    let trans_map = load_text_map(&trans_path);
    let orig_map = if orig_path.exists() {
        load_text_map(&orig_path)
    } else {
        trans_map.clone()
    };

    let mut events = Vec::new();
    let mut lines = Vec::new();

    for lyric in matching_raw {
        let sid = lyric.id;
        let trans_key = format!("LyricsText_{}_Translation", sid);
        let orig_key = format!("LyricsText_{}_Original", sid);

        let raw_trans = trans_map.get(&trans_key).cloned().unwrap_or_default();
        let raw_orig = orig_map.get(&orig_key).cloned().unwrap_or_default();

        let clean_trans = strip_html_tags(&raw_trans);
        let clean_orig = strip_html_tags(&raw_orig);

        if clean_trans.is_empty() && clean_orig.is_empty() {
            continue;
        }

        let start_sec = lyric.start_time.unwrap_or(0.0);
        let end_sec = lyric.end_time.unwrap_or(start_sec + 4.0);
        let start_ms = (start_sec * 1000.0) as i64;
        let end_ms = (end_sec * 1000.0) as i64;

        let display_trans = if !clean_trans.is_empty() {
            clean_trans.clone()
        } else {
            clean_orig.clone()
        };

        let primary_font = if display_trans.chars().all(|c| c.is_ascii() || c.is_whitespace() || c.is_ascii_punctuation()) {
            "Arial"
        } else {
            "Kanit Medium"
        };

        let default_lyric = LyricConfig::default();
        let l_cfg = lyric_cfg.unwrap_or(&default_lyric);

        let th_fs = if l_cfg.size > 0 {
            l_cfg.size
        } else {
            ((sub_size * 0.85).round() as u32).max(34)
        };
        let zh_fs = ((th_fs as f32 * 0.76).round() as u32).max(26);
        let lyric_color_ass = hex_to_ass_color(if l_cfg.color.is_empty() { "#FFFFFF" } else { &l_cfg.color });

        let ass_text = if l_cfg.bilingual && !clean_orig.is_empty() && clean_orig != display_trans {
            format!(
                r"{{\an7\fn{}\i1\fs{}\c{}}}{}\N{{\fnMicrosoft YaHei\i1\fs{}\c{}}}{}",
                primary_font, th_fs, lyric_color_ass, display_trans, zh_fs, lyric_color_ass, clean_orig
            )
        } else {
            format!(
                r"{{\an7\fn{}\i1\fs{}\c{}}}{}",
                primary_font, th_fs, lyric_color_ass, display_trans
            )
        };

        let srt_text = if l_cfg.bilingual && !clean_orig.is_empty() && clean_orig != display_trans {
            format!("{}\n{}", display_trans, clean_orig)
        } else {
            display_trans.clone()
        };

        events.push(SubtitleEvent {
            layer: 1,
            start_ms,
            end_ms,
            style: "Lyric".to_string(),
            margin_l: l_cfg.margin_x.max(20),
            margin_r: 40,
            margin_v: l_cfg.margin_y.max(10),
            ass_text,
            srt_text,
        });

        let s = start_ms / 1000;
        let m = s / 60;
        let s_part = s % 60;
        let h = m / 60;
        let m_part = m % 60;
        let time_formatted = format!("{:02}:{:02}:{:02}", h, m_part, s_part);

        lines.push(CutsceneSubtitleLine {
            caption_id: sid,
            show_moment: start_sec * 30.0,
            duration: (end_sec - start_sec) * 30.0,
            time_formatted,
            content: display_trans,
        });
    }

    (events, lines)
}

fn load_text_map(path: &Path) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return map,
    };

    if let Ok(items) = serde_json::from_str::<Vec<Value>>(&content) {
        for it in items {
            if let Some(id) = it.get("Id").and_then(|v| v.as_str()) {
                if let Some(c) = it.get("Content").and_then(|v| v.as_str()) {
                    map.insert(id.to_string(), c.to_string());
                }
            }
        }
    }

    map
}

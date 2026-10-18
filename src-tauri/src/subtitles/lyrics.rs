use std::collections::HashMap;
use std::fs;
use std::path::Path;
use serde_json::Value;

use super::ass_writer::hex_to_ass_color;
use super::dialogue::resolve_multitext_file;
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

    let trans_path = resolve_multitext_file(data_dir, lang);
    if !trans_path.exists() {
        return (Vec::new(), Vec::new());
    }

    let orig_path = resolve_multitext_file(data_dir, "zh-Hans");

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

        let is_chinese_sub = lang.trim().starts_with("zh");

        let primary_font = if is_chinese_sub {
            "Microsoft YaHei"
        } else if display_trans.chars().all(|c| c.is_ascii() || c.is_whitespace() || c.is_ascii_punctuation()) {
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

        let show_bilingual = l_cfg.bilingual && !is_chinese_sub && !clean_orig.is_empty() && clean_orig != display_trans;

        let ass_text = if show_bilingual {
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

        let srt_text = if show_bilingual {
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

        let orig_display = if !clean_orig.is_empty() && clean_orig != display_trans {
            Some(clean_orig.clone())
        } else {
            None
        };

        lines.push(CutsceneSubtitleLine {
            caption_id: sid,
            show_moment: start_sec * 30.0,
            duration: (end_sec - start_sec) * 30.0,
            time_formatted,
            content: display_trans,
            ruby_text: None,
            is_lyric: true,
            lyric_orig: orig_display,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chinese_lyrics_no_duplicate() {
        let norm_lang = "zh-Hans";
        let is_chinese_sub = norm_lang.starts_with("zh");
        assert!(is_chinese_sub);

        let clean_orig = "原版中文歌词";
        let display_trans = "原版中文歌詞"; // e.g. subtle discrepancy
        let bilingual = true;

        let show_bilingual = bilingual && !is_chinese_sub && !clean_orig.is_empty() && clean_orig != display_trans;
        assert!(!show_bilingual, "Chinese subtitles must never enable bilingual stacking");
    }

    #[test]
    fn test_non_chinese_lyrics_bilingual() {
        let norm_lang = "th";
        let is_chinese_sub = norm_lang.starts_with("zh");
        assert!(!is_chinese_sub);

        let clean_orig = "原版中文歌词";
        let display_trans = "เนื้อเพลงแปลภาษาไทย";
        let bilingual = true;

        let show_bilingual = bilingual && !is_chinese_sub && !clean_orig.is_empty() && clean_orig != display_trans;
        assert!(show_bilingual, "Non-Chinese subtitles should display bilingual lines when enabled");
    }
}

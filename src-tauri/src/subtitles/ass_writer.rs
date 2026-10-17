use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

use crate::commands::log::emit_log;
use super::dialogue::load_cutscene_dialogues_for_cg;
use super::lyrics::load_music_lyrics_for_cg;
use super::types::{AssStyleConfig, LyricConfig, RubyConfig, SubtitleEvent};

pub fn format_ass_time(ms: i64) -> String {
    let s = ms / 1000;
    let cs = (ms % 1000) / 10;
    let m = s / 60;
    let s_part = s % 60;
    let h = m / 60;
    let m_part = m % 60;
    format!("{}:{:02}:{:02}.{:02}", h, m_part, s_part, cs)
}

pub fn format_srt_time(ms: i64) -> String {
    let s = ms / 1000;
    let ms_part = ms % 1000;
    let m = s / 60;
    let s_part = s % 60;
    let h = m / 60;
    let m_part = m % 60;
    format!("{:02}:{:02}:{:02},{:03}", h, m_part, s_part, ms_part)
}

pub fn sanitize_cutscene_filename(name: &str) -> String {
    let clean: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            other => other,
        })
        .collect();

    let no_traversal = clean.replace("..", "");
    let trimmed = no_traversal.trim().trim_matches(|c| c == '.' || c == ' ');
    if trimmed.is_empty() || trimmed.chars().all(|c| c == '_') {
        "cutscene_caption".to_string()
    } else {
        trimmed.to_string()
    }
}

pub fn hex_to_ass_color(hex: &str) -> String {
    let clean = hex.trim().trim_start_matches('#');
    if clean.len() >= 6 {
        let r = &clean[0..2];
        let g = &clean[2..4];
        let b = &clean[4..6];
        format!("&H00{}{}{}&", b, g, r)
    } else {
        "&H00FFFFFF&".to_string()
    }
}

pub fn build_ass_script(
    cg_name: &str,
    style_cfg: &AssStyleConfig,
    events: &[SubtitleEvent],
) -> String {
    let font_name = if style_cfg.font_name.is_empty() {
        "Kanit Medium"
    } else {
        &style_cfg.font_name
    };
    let font_size = if style_cfg.font_size == 0 { 54 } else { style_cfg.font_size };
    let ruby_font = if style_cfg.ruby.font_name.is_empty() {
        font_name
    } else {
        &style_cfg.ruby.font_name
    };
    let ruby_size = if style_cfg.ruby.size > 0 {
        style_cfg.ruby.size
    } else {
        ((font_size as f32 * 0.52).round() as u32).max(18)
    };
    let ruby_color = hex_to_ass_color(if style_cfg.ruby.color.is_empty() { "#E0E0E0" } else { &style_cfg.ruby.color });
    let ruby_outline = style_cfg.ruby.outline.max(0.0);
    let ruby_shadow = style_cfg.ruby.shadow.max(0.0);

    let lyric_font = if style_cfg.lyric.font_name.is_empty() {
        font_name
    } else {
        &style_cfg.lyric.font_name
    };
    let lyric_th_size = if style_cfg.lyric.size > 0 {
        style_cfg.lyric.size
    } else {
        ((font_size as f32 * 0.85).round() as u32).max(34)
    };
    let lyric_margin_l = style_cfg.lyric.margin_x.max(20);
    let lyric_margin_v = style_cfg.lyric.margin_y.max(10);
    let lyric_color = hex_to_ass_color(if style_cfg.lyric.color.is_empty() { "#FFFFFF" } else { &style_cfg.lyric.color });
    let lyric_outline = style_cfg.lyric.outline.max(0.0);
    let lyric_shadow = style_cfg.lyric.shadow.max(0.0);

    let outline = style_cfg.outline.max(0.0);
    let shadow = style_cfg.shadow.max(0.0);
    let margin_v = if style_cfg.margin_v == 0 { 54 } else { style_cfg.margin_v };
    let primary_color = hex_to_ass_color(&style_cfg.primary_color);

    let mut content = format!(
        "[Script Info]\n\
        Title: WuWa Cutscene - {cg_name}\n\
        ScriptType: v4.00+\n\
        PlayResX: 1920\n\
        PlayResY: 1080\n\
        WrapStyle: 1\n\
        ScaledBorderAndShadow: yes\n\
        YCbCr Matrix: TV.709\n\n\
        [V4+ Styles]\n\
        Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n\
        Style: Default,{font_name},{font_size},{primary_color},&H000000FF,&H33000000,&H80000000,0,0,0,0,100,100,0,0,1,{outline:.2},{shadow:.2},2,220,220,{margin_v},1\n\
        Style: Ruby,{ruby_font},{ruby_size},{ruby_color},&H000000FF,&H33000000,&H80000000,0,0,0,0,100,100,0,0,1,{ruby_outline:.2},{ruby_shadow:.2},2,0,0,0,1\n\
        Style: Lyric,{lyric_font},{lyric_th_size},{lyric_color},&H000000FF,&H33000000,&H80000000,0,-1,0,0,100,100,0,0,1,{lyric_outline:.2},{lyric_shadow:.2},7,{lyric_margin_l},40,{lyric_margin_v},1\n\n\
        [Events]\n\
        Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    );

    for ev in events {
        let start_str = format_ass_time(ev.start_ms);
        let end_str = format_ass_time(ev.end_ms);
        content.push_str(&format!(
            "Dialogue: {},{},{},{},,{},{},{},,{}\n",
            ev.layer,
            start_str,
            end_str,
            ev.style,
            ev.margin_l,
            ev.margin_r,
            ev.margin_v,
            ev.ass_text
        ));
    }

    content
}

pub fn build_srt_script(events: &[SubtitleEvent]) -> String {
    let mut content = String::new();
    let mut index = 1;

    for ev in events {
        if ev.srt_text.trim().is_empty() {
            continue;
        }
        let start_str = format_srt_time(ev.start_ms);
        let end_str = format_srt_time(ev.end_ms);
        content.push_str(&format!(
            "{}\n{} --> {}\n{}\n\n",
            index, start_str, end_str, ev.srt_text
        ));
        index += 1;
    }

    content
}

pub fn generate_captions(
    app: &AppHandle,
    cg_name: &str,
    config: &crate::config::AppConfig,
    audio_locale: &str,
) -> Result<(Option<String>, Option<String>), String> {
    let data_dir = crate::commands::downloader::get_data_dir(app);
    let lang = if config.subtitle_lang.is_empty() {
        "th".to_string()
    } else {
        config.subtitle_lang.clone()
    };

    let ruby_cfg = RubyConfig {
        enabled: config.ruby_enabled,
        font_name: config.ruby_font.clone(),
        size: config.ruby_size,
        outline: config.ruby_outline,
        shadow: config.ruby_shadow,
        offset_y: config.ruby_offset_y,
        color: config.ruby_color.clone(),
    };

    let lyric_cfg = LyricConfig {
        font_name: config.lyric_font.clone(),
        size: config.lyric_size,
        outline: config.lyric_outline,
        shadow: config.lyric_shadow,
        margin_x: config.lyric_margin_x,
        margin_y: config.lyric_margin_y,
        bilingual: config.lyric_bilingual,
        color: config.lyric_color.clone(),
    };

    let (mut dialogue_events, _) = load_cutscene_dialogues_for_cg(
        &data_dir,
        cg_name,
        &lang,
        audio_locale,
        &config.sub_font,
        config.sub_size as f32,
        config.sub_margin_v,
        Some(&ruby_cfg),
    );
    let (mut lyric_events, _) = load_music_lyrics_for_cg(
        &data_dir,
        cg_name,
        &lang,
        config.sub_size as f32,
        Some(&lyric_cfg),
    );

    if dialogue_events.is_empty() && lyric_events.is_empty() {
        emit_log(
            app,
            &format!("ไม่พบบทสนทนาหรือเนื้อเพลงสำหรับคัตซีน {}", cg_name),
        );
        return Ok((None, None));
    }

    let mut all_events = Vec::new();
    all_events.append(&mut dialogue_events);
    all_events.append(&mut lyric_events);

    all_events.sort_by_key(|e| (e.start_ms, e.layer));

    let style_cfg = AssStyleConfig {
        font_name: if config.sub_font.is_empty() {
            "Kanit Medium".to_string()
        } else {
            config.sub_font.clone()
        },
        font_size: if config.sub_size == 0 { 54 } else { config.sub_size },
        primary_color: config.sub_color.clone(),
        outline: if config.sub_outline < 0.0 { 1.2 } else { config.sub_outline },
        shadow: if config.sub_shadow < 0.0 { 0.0 } else { config.sub_shadow },
        margin_v: if config.sub_margin_v == 0 { 54 } else { config.sub_margin_v },
        ruby: ruby_cfg,
        lyric: lyric_cfg,
    };

    let ass_content = build_ass_script(cg_name, &style_cfg, &all_events);
    let srt_content = build_srt_script(&all_events);

    let safe_name = sanitize_cutscene_filename(cg_name);
    let export_dir = config.get_effective_export_dir();
    let bundle_sub_dir = export_dir
        .join("cutscenes")
        .join(&safe_name)
        .join("subtitles");
    let out_dir = if bundle_sub_dir.parent().map(|p| p.exists()).unwrap_or(false) {
        bundle_sub_dir
    } else {
        export_dir.join("captions")
    };
    let _ = fs::create_dir_all(&out_dir);

    let srt_path = out_dir.join(format!("{}.srt", safe_name));
    fs::write(&srt_path, srt_content).map_err(|e| e.to_string())?;

    let ass_path = out_dir.join(format!("{}.ass", safe_name));
    fs::write(&ass_path, ass_content).map_err(|e| e.to_string())?;

    emit_log(
        app,
        &format!(
            "สร้างซับไตเติลสำเร็จ {} รายการสำหรับคัตซีน {}",
            all_events.len(),
            safe_name
        ),
    );

    Ok((
        Some(srt_path.to_string_lossy().to_string()),
        Some(ass_path.to_string_lossy().to_string()),
    ))
}

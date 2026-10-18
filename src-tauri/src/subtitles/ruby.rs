use std::sync::LazyLock;
use regex::Regex;
use super::font_metrics::measure_text_width;

pub static ANO_TAG_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"<ano=([^>]+)>([\s\S]*?)</ano>").expect("invalid ano regex")
});

#[derive(Debug, Clone)]
pub struct RubyAnnotation {
    pub ruby_text: String,
    pub base_text: String,
    pub pos_x: f32,
    pub pos_y: f32,
}

#[derive(Debug, Clone)]
pub struct RubyLineResult {
    pub clean_base_text: String,
    pub annotations: Vec<RubyAnnotation>,
}

/// Clean game dialogue tags for SRT export
pub fn clean_subtitle_text(raw: &str) -> String {
    let non_star = raw
        .trim()
        .chars()
        .filter(|&c| c != '*' && c != ' ' && c != '\t' && c != '\n' && c != '\r')
        .count();
    if non_star == 0 {
        return String::new();
    }

    // Replace <ano=RubyText>BaseText</ano> with BaseText directly using static precompiled regex
    let mut text = ANO_TAG_REGEX.replace_all(raw, "$2").to_string();

    // Remove any unclosed stray <ano=...> tags
    while let Some(start) = text.find("<ano=") {
        if let Some(tag_end) = text[start..].find('>') {
            let full_tag = text[start..start + tag_end + 1].to_string();
            text = text.replace(&full_tag, "");
        } else {
            break;
        }
    }

    // Replace game specific placeholders
    text = text.replace("{PlayerName}", "ผู้พเนจร");
    text = text.replace("{Rover}", "ผู้พเนจร");
    text = text.replace("{Cus:Ipt,Touch=แตะ PC=คลิก Gamepad=กด}", "คลิก");
    text = text.replace("{Touch=แตะ PC=คลิก Gamepad=กด}", "คลิก");

    // Remove any remaining XML HTML tags such as <i> and </i>
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

    // Remove unhandled bracket placeholders
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

    // Clean whitespace and empty lines
    let lines: Vec<String> = res
        .lines()
        .map(|line| line.split_whitespace().collect::<Vec<&str>>().join(" "))
        .filter(|line| !line.is_empty() && line.chars().any(|c| c != '*' && c != ' '))
        .collect();

    lines.join("\n")
}

/// Strip any remaining HTML tags from raw string
pub fn strip_html_tags(raw: &str) -> String {
    let mut clean = String::new();
    let mut in_tag = false;
    for ch in raw.chars() {
        if ch == '<' {
            in_tag = true;
        } else if ch == '>' {
            in_tag = false;
        } else if !in_tag {
            clean.push(ch);
        }
    }
    clean
        .lines()
        .map(|l| l.split_whitespace().collect::<Vec<&str>>().join(" "))
        .filter(|l| !l.is_empty())
        .collect::<Vec<String>>()
        .join(" ")
}

/// Format dialogue tags for ASS cutscene subtitles
pub fn clean_subtitle_for_ass(raw: &str) -> String {
    clean_subtitle_text(raw)
}

/// Parse ruby segments matching Wuthering Waves LGUI LGUITextGenerator.h layout
pub fn parse_ruby_segments(
    raw: &str,
    font_name: &str,
    font_size: f32,
    margin_v: u32,
    ruby_offset_y: i32,
) -> RubyLineResult {
    let clean_full = clean_subtitle_text(raw);

    // If no <ano= tag is present return clean text directly
    if !raw.contains("<ano=") {
        return RubyLineResult {
            clean_base_text: clean_full,
            annotations: Vec::new(),
        };
    }

    let mut annotations = Vec::new();
    let total_width = measure_text_width(&clean_full, font_name, font_size);
    let x_start = (1920.0 - total_width) / 2.0;

    // Base Y anchor for \an2 (bottom-center)
    // The top edge of base glyph is roughly margin_v + font_size * 0.74 from the screen bottom
    // Positive ruby_offset_y elevates the ruby higher above the base text
    let y_ruby = 1080.0 - (margin_v as f32) - (font_size * 0.74) - (ruby_offset_y as f32);

    // Find all <ano=Ruby>Base</ano> tags using precompiled ANO_TAG_REGEX
    let mut prefix_accumulator = String::new();
    let mut last_end = 0;

    for caps in ANO_TAG_REGEX.captures_iter(raw) {
        let full_match = caps.get(0).unwrap();
        let ruby_cap = caps.get(1).unwrap();
        let base_cap = caps.get(2).unwrap();

        let raw_prefix_segment = &raw[last_end..full_match.start()];
        prefix_accumulator.push_str(&clean_subtitle_text(raw_prefix_segment));

        let ruby_text = ruby_cap.as_str().trim().to_string();
        let base_text = clean_subtitle_text(base_cap.as_str());

        let prefix_width = measure_text_width(&prefix_accumulator, font_name, font_size);
        let base_width = measure_text_width(&base_text, font_name, font_size);
        let pos_x = x_start + prefix_width + (base_width / 2.0);

        annotations.push(RubyAnnotation {
            ruby_text,
            base_text: base_text.clone(),
            pos_x,
            pos_y: y_ruby,
        });

        prefix_accumulator.push_str(&base_text);
        last_end = full_match.end();
    }

    RubyLineResult {
        clean_base_text: clean_full,
        annotations,
    }
}

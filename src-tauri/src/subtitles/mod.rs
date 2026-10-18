pub mod types;
pub mod font_metrics;
pub mod ruby;
pub mod lyrics;
pub mod dialogue;
pub mod ass_writer;

pub use types::*;
pub use ruby::{clean_subtitle_text, clean_subtitle_for_ass, strip_html_tags, parse_ruby_segments, RubyAnnotation, RubyLineResult};
pub use lyrics::{load_music_lyrics_for_cg, extract_clean_cg_tag};
pub use dialogue::{load_cutscene_dialogues_for_cg, resolve_multitext_file};
pub use ass_writer::{
    generate_captions,
    build_ass_script,
    build_srt_script,
    sanitize_cutscene_filename,
    format_srt_time,
    format_ass_time,
    hex_to_ass_color,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_clean_cg_tag() {
        assert_eq!(extract_clean_cg_tag("M0389_Nvzhu"), "m0389");
        assert_eq!(extract_clean_cg_tag("M0389_Nanzhu.mp4"), "m0389");
        assert_eq!(extract_clean_cg_tag("LevelA_Seq/03_7/M0389_Girl.mp4"), "m0389");
        assert_eq!(extract_clean_cg_tag("M3_13_03_1_Nvzhu"), "m3_13_03_1");
    }

    #[test]
    fn test_clean_subtitle_text_no_parentheses_or_brackets() {
        let raw = "สวัสดี <ano=เจี่ยหนิง>Jiening</ano> {PlayerName} <i>ข้อความ</i>";
        let cleaned = clean_subtitle_text(raw);
        assert!(!cleaned.contains('<'));
        assert!(!cleaned.contains('>'));
        assert!(!cleaned.contains('('));
        assert!(!cleaned.contains(')'));
        assert!(!cleaned.contains('['));
        assert!(!cleaned.contains(']'));
        assert!(cleaned.contains("Jiening"));
        assert!(cleaned.contains("ผู้พเนจร"));
    }

    #[test]
    fn test_clean_subtitle_for_ass_clean_dialogue() {
        let raw = "ข้าคือ <ano=ผู้พิทักษ์>จินซี</ano> แห่งจินโจว";
        let ass_str = clean_subtitle_for_ass(raw);
        assert_eq!(ass_str, "ข้าคือ จินซี แห่งจินโจว");
    }

    #[test]
    fn test_build_ass_script_resolution_and_styles() {
        let cfg = AssStyleConfig::default();
        let events = vec![
            SubtitleEvent {
                layer: 1,
                start_ms: 56330,
                end_ms: 60000,
                style: "Lyric".to_string(),
                margin_l: 135,
                margin_r: 40,
                margin_v: 48,
                ass_text: format!(
                    "{}{}{}",
                    "{\\an7\\fad(250,250)\\fnKanit\\b1\\i1\\fs44}",
                    "เนื้อเพลงไทย",
                    "\\N{\\fnMicrosoft YaHei\\b1\\i1\\fs32\\c&HFFFFFF&}中文歌词"
                ),
                srt_text: "เนื้อเพลงไทย".to_string(),

            },
            SubtitleEvent {
                layer: 0,
                start_ms: 65000,
                end_ms: 68000,
                style: "Default".to_string(),
                margin_l: 40,
                margin_r: 40,
                margin_v: 54,
                ass_text: "บทสนทนาปกติ".to_string(),
                srt_text: "บทสนทนาปกติ".to_string(),
            },
        ];

        let script = build_ass_script("M0389_Nvzhu", &cfg, &events);
        assert!(script.contains("PlayResX: 1920"));
        assert!(script.contains("PlayResY: 1080"));
        assert!(script.contains("ScaledBorderAndShadow: yes"));
        assert!(script.contains("Style: Default"));
        assert!(script.contains("Style: Ruby"));
        assert!(script.contains("Style: Lyric"));
        assert!(script.contains("Dialogue: 1,0:00:56.33,0:01:00.00,Lyric,,135,40,48,,{\\an7\\fad(250,250)\\fnKanit\\b1\\i1\\fs44}"));
        assert!(script.contains("Dialogue: 0,0:01:05.00,0:01:08.00,Default,,40,40,54,,บทสนทนาปกติ"));
    }

    #[test]
    fn test_parse_ruby_segments_positions() {
        let raw = "หากเป็นเจ้า วันนี้<ano=Xuanqing>นาง</ano>อาจจะยังมีชีวิตอยู่ก็เป็นได้...";
        let res = parse_ruby_segments(raw, "Kanit Medium", 38.0, 54, 0);
        assert_eq!(res.clean_base_text, "หากเป็นเจ้า วันนี้นางอาจจะยังมีชีวิตอยู่ก็เป็นได้...");
        assert_eq!(res.annotations.len(), 1);
        let anno = &res.annotations[0];
        assert_eq!(anno.ruby_text, "Xuanqing");
        assert_eq!(anno.base_text, "นาง");
        assert!(anno.pos_x > 800.0 && anno.pos_x < 950.0);
        assert!(anno.pos_y > 970.0 && anno.pos_y < 1010.0);
    }

    #[test]
    fn test_m0389_ruby_dialogue_in_events() {
        let mut data_dir = std::path::PathBuf::from("../data");
        if !data_dir.exists() {
            data_dir = std::path::PathBuf::from("data");
        }
        if data_dir.exists() {
            let (events, _) = load_cutscene_dialogues_for_cg(&data_dir, "M0389", "th", "ja", "Kanit Medium", 54.0, 54, None);
            let ruby_events: Vec<_> = events.iter().filter(|e| e.style == "Ruby").collect();
            assert!(!ruby_events.is_empty());
            assert!(ruby_events[0].ass_text.contains("Xuanqing"));
            assert!(ruby_events[0].ass_text.contains(r"\pos("));
            assert!(ruby_events[0].ass_text.contains(r"\fs28"));
        }
    }
}

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CutsceneSubtitleLine {
    pub caption_id: i64,
    pub show_moment: f64,
    pub duration: f64,
    pub time_formatted: String,
    pub content: String,
}

#[derive(Clone, Debug)]
pub struct SubtitleEvent {
    pub layer: u32,
    pub start_ms: i64,
    pub end_ms: i64,
    pub style: String,
    pub margin_l: u32,
    pub margin_r: u32,
    pub margin_v: u32,
    pub ass_text: String,
    pub srt_text: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MusicLyricRaw {
    #[serde(alias = "Id")]
    pub id: i64,
    #[serde(alias = "SubtitleGroupTag", alias = "GroupTag")]
    pub group_tag: Option<String>,
    #[serde(alias = "AppearTime", alias = "StartTime")]
    pub start_time: Option<f64>,
    #[serde(alias = "EndTime")]
    pub end_time: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RubyConfig {
    pub enabled: bool,
    pub font_name: String,
    pub size: u32,
    pub outline: f32,
    pub shadow: f32,
    pub offset_y: i32,
    pub color: String,
}

impl Default for RubyConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            font_name: "Kanit Medium".to_string(),
            size: 0,
            outline: 1.0,
            shadow: 0.6,
            offset_y: 0,
            color: "#E0E0E0".to_string(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LyricConfig {
    pub font_name: String,
    pub size: u32,
    pub outline: f32,
    pub shadow: f32,
    pub margin_x: u32,
    pub margin_y: u32,
    pub bilingual: bool,
    pub color: String,
}

impl Default for LyricConfig {
    fn default() -> Self {
        Self {
            font_name: "Kanit Medium".to_string(),
            size: 0,
            outline: 1.0,
            shadow: 0.6,
            margin_x: 160,
            margin_y: 30,
            bilingual: true,
            color: "#FFFFFF".to_string(),
        }
    }
}

#[derive(Clone, Debug)]
pub struct AssStyleConfig {
    pub font_name: String,
    pub font_size: u32,
    pub primary_color: String,
    pub outline: f32,
    pub shadow: f32,
    pub margin_v: u32,
    pub ruby: RubyConfig,
    pub lyric: LyricConfig,
}

impl Default for AssStyleConfig {
    fn default() -> Self {
        Self {
            font_name: "Kanit Medium".to_string(),
            font_size: 54,
            primary_color: "#FFFFFF".to_string(),
            outline: 1.0,
            shadow: 0.6,
            margin_v: 54,
            ruby: RubyConfig::default(),
            lyric: LyricConfig::default(),
        }
    }
}

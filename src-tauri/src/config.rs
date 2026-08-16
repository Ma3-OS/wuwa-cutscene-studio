use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

fn default_girl() -> String { "Girl".to_string() }
fn default_ja() -> String { "ja".to_string() }
fn default_th() -> String { "th".to_string() }
fn default_hardsub() -> String { "Hard-sub".to_string() }
fn default_sub_font() -> String { "Kanit Medium".to_string() }
fn default_sub_size() -> u32 { 38 }
fn default_sub_outline() -> f32 { 3.0 }
fn default_sub_shadow() -> f32 { 1.5 }
fn default_sub_color() -> String { "#FFFFFF".to_string() }
fn default_sub_margin_v() -> u32 { 45 }

fn default_original_res() -> String { "Exact In-Game Cutscene (1080p Match)".to_string() }
fn default_app_lang() -> String { "th".to_string() }
fn default_app_font() -> String { "Kanit".to_string() }
fn default_theme_accent() -> String { "purple".to_string() }
fn default_true() -> bool { true }
fn default_false() -> bool { false }
fn default_volume() -> f32 { 0.7 }

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfig {
    #[serde(default)]
    pub ffmpeg_path: String,
    #[serde(default)]
    pub vgmstream_path: String,
    #[serde(default)]
    pub export_dir: String,
    #[serde(default)]
    pub output_dir: String,
    #[serde(default = "default_original_res")]
    pub render_resolution: String,
    #[serde(default = "default_girl")]
    pub char_selection: String,
    #[serde(default = "default_ja")]
    pub locale_selection: String,
    #[serde(default = "default_th")]
    pub subtitle_lang: String,
    #[serde(default = "default_hardsub")]
    pub subtitle_mode: String,
    
    // Subtitle Customization
    #[serde(default = "default_sub_font")]
    pub sub_font: String,
    #[serde(default = "default_sub_size")]
    pub sub_size: u32,
    #[serde(default = "default_sub_outline")]
    pub sub_outline: f32,
    #[serde(default = "default_sub_shadow")]
    pub sub_shadow: f32,
    #[serde(default = "default_sub_color")]
    pub sub_color: String,
    #[serde(default = "default_sub_margin_v")]
    pub sub_margin_v: u32,

    // App Preferences (Non-Video Settings)
    #[serde(default = "default_app_lang")]
    pub app_language: String,
    #[serde(default = "default_app_font")]
    pub app_font: String,
    #[serde(default = "default_theme_accent")]
    pub theme_accent: String,
    #[serde(default = "default_true")]
    pub enable_glow: bool,
    #[serde(default = "default_true")]
    pub enable_ui_sounds: bool,
    #[serde(default = "default_volume")]
    pub ui_sound_volume: f32,
    #[serde(default = "default_false")]
    pub auto_open_output: bool,
    #[serde(default = "default_true")]
    pub enable_notifications: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            ffmpeg_path: String::new(),
            vgmstream_path: String::new(),
            export_dir: String::new(),
            output_dir: String::new(),
            render_resolution: default_original_res(),
            char_selection: default_girl(),
            locale_selection: default_ja(),
            subtitle_lang: default_th(),
            subtitle_mode: default_hardsub(),
            sub_font: default_sub_font(),
            sub_size: default_sub_size(),
            sub_outline: default_sub_outline(),
            sub_shadow: default_sub_shadow(),
            sub_color: default_sub_color(),
            sub_margin_v: default_sub_margin_v(),
            app_language: default_app_lang(),
            app_font: default_app_font(),
            theme_accent: default_theme_accent(),
            enable_glow: true,
            enable_ui_sounds: true,
            ui_sound_volume: 0.7,
            auto_open_output: false,
            enable_notifications: true,
        }
    }
}

pub struct ConfigState(pub Mutex<AppConfig>);

fn get_config_path(app: &AppHandle) -> PathBuf {
    app.path().app_config_dir().unwrap().join("config.json")
}

pub fn init_config(app: &AppHandle) {
    let config_path = get_config_path(app);
    
    // Ensure directory exists
    if let Some(parent) = config_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let config = if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            AppConfig::default()
        }
    } else {
        AppConfig::default()
    };

    app.manage(ConfigState(Mutex::new(config)));
}

#[tauri::command]
pub fn get_config(state: tauri::State<ConfigState>) -> AppConfig {
    state.0.lock().unwrap().clone()
}

#[tauri::command]
pub fn update_config(app: tauri::AppHandle, state: tauri::State<ConfigState>, new_config: AppConfig) -> Result<(), String> {
    let mut config = state.0.lock().unwrap();
    *config = new_config.clone();
    
    let config_path = get_config_path(&app);
    let content = serde_json::to_string_pretty(&new_config).map_err(|e| e.to_string())?;
    fs::write(config_path, content).map_err(|e| e.to_string())?;
    
    Ok(())
}

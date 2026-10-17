use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub mod tools_manifest;

fn default_girl() -> String { "Girl".to_string() }
fn default_ja() -> String { "ja".to_string() }
fn default_th() -> String { "th".to_string() }
fn default_hardsub() -> String { "Hard-sub".to_string() }
fn default_sub_font() -> String { "Kanit Medium".to_string() }
fn default_sub_size() -> u32 { 54 }
fn default_sub_outline() -> f32 { 1.2 }
fn default_sub_shadow() -> f32 { 0.0 }
fn default_sub_color() -> String { "#FFFFFF".to_string() }
fn default_sub_margin_v() -> u32 { 54 }

fn default_ruby_enabled() -> bool { true }
fn default_ruby_size() -> u32 { 0 }
fn default_ruby_offset_y() -> i32 { 0 }
fn default_ruby_color() -> String { "#E0E0E0".to_string() }

fn default_lyric_size() -> u32 { 0 }
fn default_lyric_margin_x() -> u32 { 160 }
fn default_lyric_margin_y() -> u32 { 30 }
fn default_lyric_bilingual() -> bool { true }
fn default_lyric_color() -> String { "#FFFFFF".to_string() }

fn default_original_res() -> String { "1920x1080".to_string() }
fn default_app_lang() -> String { "th".to_string() }
fn default_app_font() -> String { "Kanit".to_string() }
fn default_theme_accent() -> String { "monochrome".to_string() }
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

    // Ruby Customization
    #[serde(default = "default_ruby_enabled")]
    pub ruby_enabled: bool,
    #[serde(default = "default_ruby_size")]
    pub ruby_size: u32,
    #[serde(default = "default_ruby_offset_y")]
    pub ruby_offset_y: i32,
    #[serde(default = "default_ruby_color")]
    pub ruby_color: String,

    // Lyric Customization
    #[serde(default = "default_lyric_size")]
    pub lyric_size: u32,
    #[serde(default = "default_lyric_margin_x")]
    pub lyric_margin_x: u32,
    #[serde(default = "default_lyric_margin_y")]
    pub lyric_margin_y: u32,
    #[serde(default = "default_lyric_bilingual")]
    pub lyric_bilingual: bool,
    #[serde(default = "default_lyric_color")]
    pub lyric_color: String,

    // Game Archives & Extraction Engine
    #[serde(default)]
    pub game_paks_dir: String,
    #[serde(default)]
    pub keys_file_path: String,

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

    // Audio Engine Controls
    #[serde(default = "default_100")]
    pub voice_volume: u32,
    #[serde(default = "default_100")]
    pub bgm_volume: u32,
    #[serde(default = "default_bitrate")]
    pub audio_bitrate: String,
    #[serde(default = "default_true")]
    pub normalize_audio: bool,
}

fn default_100() -> u32 { 100 }
fn default_bitrate() -> String { "320k".to_string() }

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
            ruby_enabled: default_ruby_enabled(),
            ruby_size: default_ruby_size(),
            ruby_offset_y: default_ruby_offset_y(),
            ruby_color: default_ruby_color(),
            lyric_size: default_lyric_size(),
            lyric_margin_x: default_lyric_margin_x(),
            lyric_margin_y: default_lyric_margin_y(),
            lyric_bilingual: default_lyric_bilingual(),
            lyric_color: default_lyric_color(),
            game_paks_dir: String::new(),
            keys_file_path: String::new(),
            app_language: default_app_lang(),
            app_font: default_app_font(),
            theme_accent: default_theme_accent(),
            enable_glow: true,
            enable_ui_sounds: true,
            ui_sound_volume: 0.7,
            auto_open_output: false,
            enable_notifications: true,
            voice_volume: 100,
            bgm_volume: 100,
            audio_bitrate: "320k".to_string(),
            normalize_audio: true,
        }
    }
}

pub fn get_user_documents_dir() -> PathBuf {
    if let Ok(profile) = std::env::var("USERPROFILE") {
        let docs = PathBuf::from(profile).join("Documents");
        if docs.exists() {
            return docs;
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        let docs = PathBuf::from(home).join("Documents");
        if docs.exists() {
            return docs;
        }
    }
    PathBuf::from(".")
}

pub fn get_project_root() -> PathBuf {
    // 1. Current working directory checks
    if let Ok(cwd) = std::env::current_dir() {
        if cwd.join("package.json").exists() {
            return cwd;
        }
        if cwd.file_name().and_then(|n| n.to_str()) == Some("src-tauri") {
            if let Some(parent) = cwd.parent() {
                if parent.join("package.json").exists() {
                    return parent.to_path_buf();
                }
            }
        }
        if cwd.join("src-tauri").exists() {
            return cwd;
        }
    }

    // 2. Walk up from current executable
    if let Ok(exe) = std::env::current_exe() {
        let mut cur = exe.parent();
        while let Some(dir) = cur {
            if dir.join("package.json").exists() {
                return dir.to_path_buf();
            }
            cur = dir.parent();
        }
    }

    // 3. Current dir as fallback
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

pub fn get_default_export_dir() -> PathBuf {
    let dir = get_project_root().join("export");
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn get_default_render_dir() -> PathBuf {
    let dir = get_project_root().join("output");
    let _ = fs::create_dir_all(&dir);
    dir
}

impl AppConfig {
    pub fn get_effective_export_dir(&self) -> PathBuf {
        let trimmed = self.export_dir.trim();
        if !trimmed.is_empty() {
            let p = PathBuf::from(trimmed);
            let abs_path = if p.is_relative() { get_project_root().join(p) } else { p };
            let _ = fs::create_dir_all(&abs_path);
            return abs_path;
        }
        get_default_export_dir()
    }

    pub fn get_effective_render_dir(&self) -> PathBuf {
        let trimmed = self.output_dir.trim();
        if !trimmed.is_empty() {
            let p = PathBuf::from(trimmed);
            let abs_path = if p.is_relative() { get_project_root().join(p) } else { p };
            let _ = fs::create_dir_all(&abs_path);
            return abs_path;
        }
        get_default_render_dir()
    }
}

pub struct ConfigState(pub Mutex<AppConfig>);

pub fn get_config_path(app: &AppHandle) -> PathBuf {
    let project_config = get_project_root().join("config.json");
    if project_config.exists() {
        return project_config;
    }
    // Check if AppData config exists and copy over
    let appdata_config = app.path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("config.json");
    if appdata_config.exists() {
        let _ = fs::copy(&appdata_config, &project_config);
        return project_config;
    }
    project_config
}

pub fn auto_migrate_from_appdata(app: &AppHandle) {
    let proj_root = get_project_root();
    let tools_dir = proj_root.join("tools");
    let data_dir = proj_root.join("data");
    let fonts_dir = proj_root.join("fonts");
    let cache_dir = proj_root.join("cache");
    let _ = fs::create_dir_all(&tools_dir);
    let _ = fs::create_dir_all(&data_dir);
    let _ = fs::create_dir_all(&fonts_dir);
    let _ = fs::create_dir_all(&cache_dir);
    let _ = fs::create_dir_all(proj_root.join("export"));
    let _ = fs::create_dir_all(proj_root.join("render"));
    let _ = fs::create_dir_all(proj_root.join("logs"));

    if let Ok(app_data) = app.path().app_data_dir() {
        let app_tools = app_data.join("tools");
        if app_tools.exists() {
            if let Ok(entries) = fs::read_dir(&app_tools) {
                for entry in entries.flatten() {
                    let dest = tools_dir.join(entry.file_name());
                    if !dest.exists() {
                        let _ = fs::copy(entry.path(), dest);
                    }
                }
            }
        }
        let app_data_dir = app_data.join("data");
        if app_data_dir.exists() {
            if let Ok(entries) = fs::read_dir(&app_data_dir) {
                for entry in entries.flatten() {
                    let dest = data_dir.join(entry.file_name());
                    if !dest.exists() {
                        let _ = fs::copy(entry.path(), dest);
                    }
                }
            }
        }
    }
}

pub fn init_config(app: &AppHandle) {
    auto_migrate_from_appdata(app);
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
pub fn get_default_paths() -> serde_json::Value {
    serde_json::json!({
        "project_root": get_project_root().to_string_lossy(),
        "export_dir": get_default_export_dir().to_string_lossy(),
        "render_dir": get_default_render_dir().to_string_lossy(),
    })
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

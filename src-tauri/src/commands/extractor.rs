use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, OnceLock, RwLock};
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, BufWriter};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{oneshot, Mutex};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

use crate::config::ConfigState;
use crate::commands::downloader::{get_data_dir, get_tools_dir};
use crate::commands::log::emit_log;

pub fn clean_path_string(path: &Path) -> String {
    let s = path.to_string_lossy().to_string();
    if let Some(stripped) = s.strip_prefix(r"\\?\") {
        stripped.to_string()
    } else {
        s
    }
}

pub fn canonical_path_string(path: &Path) -> String {
    if let Ok(canon) = std::fs::canonicalize(path) {
        clean_path_string(&canon)
    } else {
        clean_path_string(path)
    }
}

static VIDEO_INDEX_CACHE: OnceLock<RwLock<Option<HashMap<String, PathBuf>>>> = OnceLock::new();
static NEGATIVE_THUMB_CACHE: OnceLock<RwLock<HashSet<String>>> = OnceLock::new();

fn get_video_index_cache() -> &'static RwLock<Option<HashMap<String, PathBuf>>> {
    VIDEO_INDEX_CACHE.get_or_init(|| RwLock::new(None))
}

fn get_negative_thumb_cache() -> &'static RwLock<HashSet<String>> {
    NEGATIVE_THUMB_CACHE.get_or_init(|| RwLock::new(HashSet::new()))
}

pub fn get_or_build_video_index(app: &AppHandle, config: &crate::config::AppConfig) -> HashMap<String, PathBuf> {
    let cache_lock = get_video_index_cache();
    {
        if let Ok(reader) = cache_lock.read() {
            if let Some(ref map) = *reader {
                return map.clone();
            }
        }
    }
    let mut map = HashMap::new();
    let cache_cutscenes = get_cache_cutscenes_dir(app);
    if cache_cutscenes.exists() {
        index_directory_videos(&cache_cutscenes, &mut map);
    }
    let export_path = config.get_effective_export_dir();
    if export_path.exists() {
        index_directory_videos(&export_path, &mut map);
    }
    for root in get_system_drive_roots() {
        let fmodel_export = PathBuf::from(format!(r"{}Datamine\Datamine\FModel\Output\Exports\Client\Content\Aki\Movies", root));
        if fmodel_export.exists() {
            index_directory_videos(&fmodel_export, &mut map);
            break;
        }
    }
    let out_path = config.get_effective_render_dir();
    if out_path.exists() {
        index_directory_videos(&out_path, &mut map);
    }
    if let Ok(mut writer) = cache_lock.write() {
        *writer = Some(map.clone());
    }
    map
}

#[tauri::command]
pub fn clear_video_index_cache() {
    if let Ok(mut writer) = get_video_index_cache().write() {
        *writer = None;
    }
    if let Ok(mut writer) = get_negative_thumb_cache().write() {
        writer.clear();
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GameEnvironmentDto {
    pub game_paks_found: bool,
    pub paks_dir: String,
    pub paks_count: usize,
    pub keys_found: bool,
    pub keys_path: String,
    pub dynamic_keys_count: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExtractedAssetResult {
    pub status: String,
    pub id: String,
    pub cg_name: String,
    pub video_file: String,
    pub audio_files: Vec<String>,
    pub elapsed_ms: u64,
    pub is_cached: bool,
    pub thumbnail_base64: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CatalogItemDto {
    pub cg_name: String,
    pub cg_file: String,
    pub is_cached: bool,
    pub local_video_path: Option<String>,
    pub audio_ready: bool,
    pub girl_or_boy: i32,
    pub can_skip: bool,
    pub aspect: f64,
    pub category_folder: String,
    pub has_video: bool,
    pub is_level_sequence: bool,
    pub base_cg_name: Option<String>,
    pub file_size: Option<u64>,
    pub asset_kind: String,
    pub video_format: String,
}

pub fn sanitize_game_subfolder(path: &str) -> String {
    let clean = if let Some(last_slash) = path.rfind('/') {
        let last_part = &path[last_slash + 1..];
        if last_part.contains('.') {
            &path[..last_slash]
        } else {
            path
        }
    } else if path.contains('.') {
        "Aki/Movies"
    } else {
        path
    };

    let mut t = clean.trim_matches('/').to_string();
    if t.is_empty() || t.contains(':') || t.contains("export") || t.contains("cache") || t.contains("cutscenes") {
        return "Aki/Movies".to_string();
    }

    // Unify Sequence -> Movies to merge cutscene story branches
    t = t.replace("/Sequence/", "/Movies/");
    if t.starts_with("Sequence/") {
        t = format!("Movies/{}", &t[9..]);
    } else if t == "Sequence" {
        t = "Movies".to_string();
    } else if t.starts_with("Aki/Sequence/") {
        t = format!("Aki/Movies/{}", &t[13..]);
    } else if t == "Aki/Sequence" {
        t = "Aki/Movies".to_string();
    }

    // Strip /Main/ from /Main/03_x
    t = t.replace("/Main/", "/");
    if t.ends_with("/Main") {
        t = t[..t.len() - 5].to_string();
    }

    // Strip per-cutscene leaf folder such as M0388, C0030, P0056, CE
    if let Some(last_slash) = t.rfind('/') {
        let leaf = &t[last_slash + 1..];
        let is_cutscene_leaf = (leaf.starts_with('M') || leaf.starts_with('C') || leaf.starts_with('P') || leaf.starts_with('E') || leaf.starts_with('R'))
            && leaf.len() >= 4
            && leaf.chars().nth(1).map(|c| c.is_ascii_digit()).unwrap_or(false);
        if is_cutscene_leaf || leaf == "CE" {
            t = t[..last_slash].to_string();
        }
    }

    if !t.starts_with("Aki/") {
        return format!("Aki/{}", t);
    }
    t
}

pub fn normalize_catalog_folder(raw_path: &str) -> String {
    let norm = raw_path.replace('\\', "/");
    let trimmed = norm.trim_matches('/');
    if trimmed.is_empty() {
        return "Aki/Movies".to_string();
    }

    // 1. If path contains /Aki/, extract starting from Aki/
    if let Some(pos) = trimmed.find("/Aki/") {
        let sub = &trimmed[pos + 1..];
        return sanitize_game_subfolder(sub);
    } else if trimmed.starts_with("Aki/") {
        return sanitize_game_subfolder(trimmed);
    } else if let Some(stripped) = trimmed.strip_prefix("Client/Content/Aki/") {
        return sanitize_game_subfolder(&format!("Aki/{}", stripped));
    } else if let Some(stripped) = trimmed.strip_prefix("Game/Aki/") {
        return sanitize_game_subfolder(&format!("Aki/{}", stripped));
    }

    // 2. Check if it starts with Movies/ or Sequence/
    if trimmed.starts_with("Movies/") || trimmed.starts_with("Sequence/") {
        return sanitize_game_subfolder(&format!("Aki/{}", trimmed));
    }

    // 3. Check for LevelA_Seq, LevelB_Seq, LevelC_Seq, Quest, etc.
    if trimmed.starts_with("LevelA_Seq")
        || trimmed.starts_with("LevelB_Seq")
        || trimmed.starts_with("LevelC_Seq")
        || trimmed.starts_with("LevelD_Seq")
        || trimmed.starts_with("Quest")
        || trimmed.starts_with("Vision")
        || trimmed.starts_with("UI")
        || trimmed.starts_with("Fight")
    {
        return sanitize_game_subfolder(&format!("Aki/Movies/{}", trimmed));
    }

    // 4. Default fallback to Aki/Movies
    sanitize_game_subfolder(trimmed)
}

pub fn extract_relative_game_folder(cg_file: &str) -> String {
    normalize_catalog_folder(cg_file)
}

/// Helper: Extract clean base identifier without Rover gender suffixes
pub fn extract_base_cg_name(name: &str) -> String {
    let stem = name.trim();
    let lower = stem.to_lowercase();
    for suffix in [
        "_nanzhu", "_nvzhu", "_nan", "_nv", "_a", "_b", "_m", "_f",
    ] {
        if lower.ends_with(suffix) {
            return stem[..stem.len() - suffix.len()].to_string();
        }
    }
    stem.to_string()
}

pub struct ExtractorDaemonManager {
    pub child: Child,
    pub stdin: BufWriter<ChildStdin>,
    pub pending: Arc<Mutex<HashMap<String, oneshot::Sender<Value>>>>,
}

impl ExtractorDaemonManager {
    pub fn is_alive(&mut self) -> bool {
        match self.child.try_wait() {
            Ok(None) => true,
            _ => false,
        }
    }
}

pub struct ExtractorState(pub Arc<Mutex<Option<ExtractorDaemonManager>>>);

pub fn get_cache_cutscenes_dir(_app: &AppHandle) -> PathBuf {
    let dir = crate::config::get_project_root().join("cache").join("cutscenes");
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn get_extractor_binary(app: &AppHandle) -> Option<PathBuf> {
    // 1. tools directory in app data
    let app_tools = get_tools_dir(app).join("wuwa-extractor.exe");
    if app_tools.exists() {
        return Some(app_tools);
    }

    // 2. Local src-tauri/tools/wuwa-extractor.exe
    let local_tools = PathBuf::from("tools").join("wuwa-extractor.exe");
    if local_tools.exists() {
        return Some(local_tools);
    }
    let local_dev = PathBuf::from("src-tauri").join("tools").join("wuwa-extractor.exe");
    if local_dev.exists() {
        return Some(local_dev);
    }

    // 3. extractor build output
    let bin_path = PathBuf::from("src-tauri")
        .join("extractor")
        .join("bin")
        .join("Release")
        .join("net10.0")
        .join("win-x64")
        .join("wuwa-extractor.exe");
    if bin_path.exists() {
        return Some(bin_path);
    }

    None
}

/// Discovers active Windows system drive letters dynamically without hardcoding C:\ or D:\
pub fn get_system_drive_roots() -> Vec<String> {
    let mut roots = Vec::new();
    for c in b'C'..=b'Z' {
        let drive = format!("{}:\\", c as char);
        if Path::new(&drive).exists() {
            roots.push(drive);
        }
    }
    if roots.is_empty() {
        roots.push("C:\\".to_string());
    }
    roots
}

fn count_paks_recursive(dir: &Path) -> usize {
    let mut count = 0;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                count += count_paks_recursive(&path);
            } else if path
                .extension()
                .map(|ext| ext.eq_ignore_ascii_case("pak"))
                .unwrap_or(false)
            {
                count += 1;
            }
        }
    }
    count
}

pub fn detect_game_env_internal(
    app: &AppHandle,
    config: &crate::config::AppConfig,
) -> GameEnvironmentDto {
    let drive_roots = get_system_drive_roots();

    // 1. Probe for Paks folder dynamically
    let relative_pak_subdirs = [
        r"Game\Wuthering Waves Game\Client\Content\Paks",
        r"Wuthering Waves Game\Client\Content\Paks",
        r"WutheringWavesBetaGame\Client\Content\Paks",
        r"Program Files\Wuthering Waves\Client\Content\Paks",
        r"Program Files (x86)\Wuthering Waves\Client\Content\Paks",
        r"Games\Wuthering Waves\Client\Content\Paks",
        r"Epic Games\Wuthering Waves\Client\Content\Paks",
        r"Wuthering Waves\Client\Content\Paks",
    ];

    let mut paks_candidates = Vec::new();
    if !config.game_paks_dir.trim().is_empty() {
        paks_candidates.push(config.game_paks_dir.clone());
    }
    for root in &drive_roots {
        for sub in &relative_pak_subdirs {
            paks_candidates.push(format!("{}{}", root, sub));
        }
    }

    let mut found_paks_dir = String::new();
    let mut paks_count = 0;

    for candidate in paks_candidates {
        if !candidate.trim().is_empty() {
            let p = Path::new(&candidate);
            if p.exists() && p.is_dir() {
                let count = count_paks_recursive(p);
                if count > 0 {
                    found_paks_dir = candidate;
                    paks_count = count;
                    break;
                }
            }

        }
    }

    // 2. Probe for AES keys dynamically
    let relative_keys_subdirs = [
        r"WutheringWavesBetaGame\wuwa-keys-main\vid.json",
        r"WutheringWavesBetaGame\wuwa-keys-main\keys.json",
        r"WutheringWavesBetaGame\wuwa-keys\vid.json",
        r"wuwa-keys\vid.json",
        r"wuwa-keys\keys.json",
    ];

    let mut keys_candidates = Vec::new();
    // 1. Project data directory (Local First)
    let proj_data_vid = get_data_dir(app).join("vid.json");
    if proj_data_vid.exists() {
        keys_candidates.push(proj_data_vid.to_string_lossy().to_string());
    }
    let proj_data_keys = get_data_dir(app).join("keys.json");
    if proj_data_keys.exists() {
        keys_candidates.push(proj_data_keys.to_string_lossy().to_string());
    }

    // 2. Configured custom path
    if !config.keys_file_path.trim().is_empty() {
        let p = PathBuf::from(&config.keys_file_path);
        let abs_p = if p.is_relative() { crate::config::get_project_root().join(p) } else { p };
        keys_candidates.push(abs_p.to_string_lossy().to_string());
    }

    // 3. Project tools dir
    let app_tools_key = get_tools_dir(app).join("vid.json");
    if app_tools_key.exists() {
        keys_candidates.push(app_tools_key.to_string_lossy().to_string());
    }
    for root in &drive_roots {
        for sub in &relative_keys_subdirs {
            keys_candidates.push(format!("{}{}", root, sub));
        }
    }

    let mut found_keys_path = String::new();
    let mut dynamic_keys_count = 0;

    for candidate in keys_candidates {
        if !candidate.trim().is_empty() {
            let p = Path::new(&candidate);
            if p.exists() && p.is_file() {
                if let Ok(content) = fs::read_to_string(p) {
                    if let Ok(val) = serde_json::from_str::<Value>(&content) {
                        let dyn_count = val
                            .get("dynamicKeys")
                            .and_then(|k| k.as_array())
                            .map(|a| a.len())
                            .unwrap_or(0);
                        found_keys_path = candidate;
                        dynamic_keys_count = dyn_count;
                        break;
                    }
                }
            }
        }
    }

    GameEnvironmentDto {
        game_paks_found: !found_paks_dir.is_empty(),
        paks_dir: found_paks_dir,
        paks_count,
        keys_found: !found_keys_path.is_empty(),
        keys_path: found_keys_path,
        dynamic_keys_count,
    }
}

#[tauri::command]
pub async fn detect_game_environment(
    app: AppHandle,
    state: tauri::State<'_, ConfigState>,
) -> Result<GameEnvironmentDto, String> {
    let config = state.0.lock().unwrap().clone();
    Ok(detect_game_env_internal(&app, &config))
}

#[tauri::command]
pub async fn start_extractor_daemon(
    app: AppHandle,
    extractor_state: tauri::State<'_, ExtractorState>,
    config_state: tauri::State<'_, ConfigState>,
    paks_dir: String,
    keys_file: String,
) -> Result<bool, String> {
    start_extractor_daemon_internal(&app, &extractor_state, &config_state, paks_dir, keys_file).await
}

pub async fn start_extractor_daemon_internal(
    app: &AppHandle,
    extractor_state: &ExtractorState,
    config_state: &ConfigState,
    paks_dir: String,
    keys_file: String,
) -> Result<bool, String> {
    let mut manager_lock = extractor_state.0.lock().await;

    // If already running and process is alive, return true
    if let Some(mgr) = manager_lock.as_mut() {
        if mgr.is_alive() {
            return Ok(true);
        }
    }
    *manager_lock = None;

    let exe_path = get_extractor_binary(app).ok_or_else(|| {
        "Extractor worker binary (wuwa-extractor.exe) not found".to_string()
    })?;

    emit_log(app, &format!("Launching CUE4Parse Worker daemon: {}", exe_path.display()));

    let mut child = Command::new(&exe_path)
        .current_dir(crate::config::get_project_root())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn extractor worker: {}", e))?;

    let child_stdin = child.stdin.take().ok_or("Failed to open child stdin")?;
    let child_stdout = child.stdout.take().ok_or("Failed to open child stdout")?;
    let child_stderr = child.stderr.take();

    let pending: Arc<Mutex<HashMap<String, oneshot::Sender<Value>>>> = Arc::new(Mutex::new(HashMap::new()));
    let pending_clone = pending.clone();
    let app_handle = app.clone();

    // Background listener task for worker stdout (Line-delimited JSON)
    tokio::spawn(async move {
        let mut reader = BufReader::new(child_stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            // If line is not a JSON object, route to standard log
            if !trimmed.starts_with('{') || !trimmed.ends_with('}') {
                emit_log(&app_handle, &format!("[WORKER RAW] {}", trimmed));
                continue;
            }

            if let Ok(val) = serde_json::from_str::<Value>(trimmed) {
                if let Some(status) = val.get("status").and_then(|s| s.as_str()) {
                    if status == "log" {
                        if let Some(msg) = val.get("message").and_then(|m| m.as_str()) {
                            emit_log(&app_handle, msg);
                        }
                    }
                }

                if let Some(id) = val.get("id").and_then(|i| i.as_str()) {
                    let mut lock = pending_clone.lock().await;
                    if let Some(sender) = lock.remove(id) {
                        let _ = sender.send(val);
                    }
                } else if let Some(status) = val.get("status").and_then(|s| s.as_str()) {
                    if status == "error" {
                        if let Some(msg) = val.get("message").and_then(|m| m.as_str()) {
                            emit_log(&app_handle, &format!("Worker: {}", msg));
                        }
                    } else if status != "log" {
                        emit_log(&app_handle, &format!("Worker Event: {}", status));
                    }
                }
            }
        }

    });

    // Background listener task for worker stderr (Captures C# crash/unhandled logs)
    if let Some(err_stream) = child_stderr {
        let app_handle_err = app.clone();
        tokio::spawn(async move {
            let mut err_reader = BufReader::new(err_stream).lines();
            while let Ok(Some(err_line)) = err_reader.next_line().await {
                let trimmed = err_line.trim();
                if !trimmed.is_empty() {
                    emit_log(&app_handle_err, &format!("[WORKER STDERR] {}", trimmed));
                }
            }
        });
    }

    let (init_tx, init_rx) = oneshot::channel();
    let init_id = "__daemon_init__".to_string();
    pending.lock().await.insert(init_id.clone(), init_tx);

    let mut writer = BufWriter::new(child_stdin);
    let export_dir = config_state.0.lock().unwrap().get_effective_export_dir().to_string_lossy().to_string();

    let paks_dir_abs = {
        let p = PathBuf::from(paks_dir.trim());
        let abs_p = if p.is_relative() { crate::config::get_project_root().join(p) } else { p };
        abs_p.to_string_lossy().to_string()
    };

    let keys_file_abs = {
        let trimmed = keys_file.trim();
        let p = PathBuf::from(trimmed);
        let abs_p = if p.is_relative() { crate::config::get_project_root().join(p) } else { p };
        if abs_p.exists() {
            abs_p.to_string_lossy().to_string()
        } else {
            let data_vid = get_data_dir(app).join("vid.json");
            if data_vid.exists() {
                data_vid.to_string_lossy().to_string()
            } else {
                abs_p.to_string_lossy().to_string()
            }
        }
    };

    // Send init command with tracking id
    let init_cmd = json!({
        "cmd": "init",
        "id": init_id,
        "paks_dir": paks_dir_abs,
        "keys_file": keys_file_abs,
        "export_dir": export_dir
    });

    let line = format!("{}\n", init_cmd);
    writer
        .write_all(line.as_bytes())
        .await
        .map_err(|e| format!("Failed to send init to worker: {}", e))?;
    writer
        .flush()
        .await
        .map_err(|e| format!("Failed to flush init to worker: {}", e))?;

    // Await provider readiness up to 30s
    let init_response = tokio::time::timeout(Duration::from_secs(30), init_rx)
        .await
        .map_err(|_| "Extractor worker initialization timed out after 30 seconds".to_string())?
        .map_err(|_| "Extractor worker channel disconnected during initialization".to_string())?;

    let init_status = init_response.get("status").and_then(|s| s.as_str()).unwrap_or("error");
    if init_status != "ready" {
        let msg = init_response.get("message").and_then(|m| m.as_str()).unwrap_or("Failed to initialize CUE4Parse worker");
        return Err(msg.to_string());
    }

    let paks_mounted = init_response.get("mounted_paks").and_then(|p| p.as_i64()).unwrap_or(0);
    let files_count = init_response.get("files_count").and_then(|f| f.as_i64()).unwrap_or(0);
    emit_log(app, &format!("CUE4Parse Engine ready: {} paks mounted, {} files loaded", paks_mounted, files_count));

    *manager_lock = Some(ExtractorDaemonManager {
        child,
        stdin: writer,
        pending,
    });

    Ok(true)
}

/// Ensures the daemon is running and healthy. If disconnected, automatically respawns it.
pub async fn ensure_daemon_alive(
    app: &AppHandle,
    extractor_state: &ExtractorState,
    config_state: &ConfigState,
) -> Result<(), String> {
    let mut lock = extractor_state.0.lock().await;
    let is_alive = if let Some(mgr) = lock.as_mut() {
        mgr.is_alive()
    } else {
        false
    };

    if !is_alive {
        *lock = None;
        drop(lock);

        let config = config_state.0.lock().unwrap().clone();
        let env = detect_game_env_internal(app, &config);
        if !env.game_paks_found {
            return Err("ไม่พบไดเรกทอรีแพ็กเกจเกม กรุณากำหนดค่าในแถบตั้งค่า".into());
        }

        let paks = if !config.game_paks_dir.is_empty() {
            let p = PathBuf::from(config.game_paks_dir.trim());
            let abs_p = if p.is_relative() { crate::config::get_project_root().join(p) } else { p };
            if abs_p.exists() {
                abs_p.to_string_lossy().to_string()
            } else {
                env.paks_dir
            }
        } else {
            env.paks_dir
        };

        let keys = {
            let p = PathBuf::from(config.keys_file_path.trim());
            let abs_p = if p.is_relative() { crate::config::get_project_root().join(p) } else { p };
            if abs_p.exists() {
                abs_p.to_string_lossy().to_string()
            } else if !env.keys_path.is_empty() && Path::new(&env.keys_path).exists() {
                env.keys_path
            } else {
                get_data_dir(app).join("vid.json").to_string_lossy().to_string()
            }
        };

        start_extractor_daemon_internal(app, extractor_state, config_state, paks, keys).await?;
    }

    Ok(())
}

pub async fn create_preview_muxed_video(
    app: &AppHandle,
    bundle_dir: &Path,
    raw_video_path: &Path,
    cg_name: &str,
) -> Option<PathBuf> {
    let preview_dir = bundle_dir.join("preview");
    let _ = fs::create_dir_all(&preview_dir);
    let preview_muxed = preview_dir.join("preview_muxed.mp4");

    if !raw_video_path.exists() {
        return None;
    }

    let config_state = app.state::<ConfigState>();
    let config = config_state.0.lock().unwrap().clone();
    let export_dir = config.get_effective_export_dir();

    let tools_dir = get_tools_dir(app);
    let ffmpeg_bin = tools_dir.join("ffmpeg.exe");
    let ffmpeg_cmd = if ffmpeg_bin.exists() { ffmpeg_bin } else { PathBuf::from("ffmpeg") };
    let vgmstream_bin = tools_dir.join("vgmstream-cli.exe");

    if !vgmstream_bin.exists() {
        return None;
    }

    // 1. Automatically run Wwiser for any soundbanks in bundle_dir if not yet done
    let mut bnk_files = Vec::new();
    for dir in [&bundle_dir.to_path_buf(), &bundle_dir.join("audio")] {
        if dir.exists() {
            if let Ok(entries) = fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()) == Some("bnk".to_string()) {
                        bnk_files.push(p);
                    }
                }
            }
        }
    }
    bnk_files.sort();
    bnk_files.dedup();

    if !bnk_files.is_empty() {
        let _ = crate::commands::wwiser::run_wwiser_for_banks(app, bundle_dir, &bnk_files).await;
    }

    // 2. Index all .wem files and resolve paths in .txtp
    let wem_map = crate::commands::wwiser::index_wem_files_multiple(&[bundle_dir, &export_dir]);

    // 3. Collect all candidate .txtp / .wav files
    let mut candidate_tracks: Vec<PathBuf> = Vec::new();
    let search_dirs = [
        bundle_dir.join("txtp"),
        bundle_dir.join("audio"),
        bundle_dir.to_path_buf(),
        export_dir.join("txtp"),
    ];

    let other_gender_param = if config.char_selection == "female" || config.char_selection == "0" || config.char_selection == "Girl" {
        "(3313202977=3111576190)"
    } else {
        "(3313202977=2204441813)"
    };

    let norm_locale = if config.locale_selection.is_empty() { "ja" } else { &config.locale_selection };
    let all_locales = ["ja", "en", "ko", "zh-hans", "zh-hant", "zh"];

    let cg_lower = cg_name.to_lowercase();
    for dir in search_dirs {
        if dir.exists() {
            if let Ok(entries) = fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    let ext = p.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()).unwrap_or_default();
                    if ext == "txtp" || ext == "wav" {
                        let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
                        if crate::commands::generator::contains_word_boundary(&stem, &cg_lower) {
                            if stem.contains(other_gender_param) {
                                continue;
                            }
                            let mut is_other_loc = false;
                            for other_loc in all_locales {
                                if other_loc != norm_locale {
                                    let p1 = format!("={})", other_loc);
                                    let p2 = format!("_{}.", other_loc);
                                    if stem.contains(&p1) || stem.contains(&p2) {
                                        is_other_loc = true;
                                        break;
                                    }
                                }
                            }
                            if is_other_loc {
                                continue;
                            }
                            if !candidate_tracks.contains(&p) {
                                candidate_tracks.push(p);
                            }
                        }
                    }
                }
            }
        }
    }

    if candidate_tracks.is_empty() {
        return None;
    }

    // 4. Resolve .wem paths in all matched .txtp files
    for track in &candidate_tracks {
        if track.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()) == Some("txtp".to_string()) {
            let _ = crate::commands::wwiser::resolve_wem_paths_in_txtp(track, &wem_map);
        }
    }

    // 5. Decode each candidate track into temporary WAV
    let temp_audio_dir = crate::config::get_project_root().join("cache").join("temp_audio");
    let _ = fs::create_dir_all(&temp_audio_dir);

    let mut decoded_wavs = Vec::new();
    for (idx, track) in candidate_tracks.iter().enumerate() {
        let temp_wav = temp_audio_dir.join(format!("{}_{}_track.wav", cg_name, idx));
        if track.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()) == Some("wav".to_string()) {
            decoded_wavs.push(track.clone());
        } else {
            let mut vgm_cmd = Command::new(&vgmstream_bin);
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                vgm_cmd.creation_flags(0x08000000);
            }
            let res = vgm_cmd.args(["-o", &temp_wav.to_string_lossy(), &track.to_string_lossy()]).output().await;
            if res.is_ok() && temp_wav.exists() && fs::metadata(&temp_wav).map(|m| m.len() > 1000).unwrap_or(false) {
                decoded_wavs.push(temp_wav);
            }
        }
    }

    if decoded_wavs.is_empty() {
        return None;
    }

    emit_log(app, &format!("กำลังรวมสัญญาณเสียง {} แทร็กเข้ากับภาพพรีวิวสำหรับคัตซีน {}", decoded_wavs.len(), cg_name));

    let mut mux_cmd = Command::new(&ffmpeg_cmd);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        mux_cmd.creation_flags(0x08000000);
    }

    let mut ffmpeg_args = vec![
        "-y".to_string(),
        "-i".to_string(),
        raw_video_path.to_string_lossy().to_string(),
    ];

    for wav in &decoded_wavs {
        ffmpeg_args.push("-i".to_string());
        ffmpeg_args.push(wav.to_string_lossy().to_string());
    }

    if decoded_wavs.len() == 1 {
        ffmpeg_args.push("-map".to_string());
        ffmpeg_args.push("0:v:0".to_string());
        ffmpeg_args.push("-map".to_string());
        ffmpeg_args.push("1:a:0".to_string());
    } else {
        let mut filter_inputs = String::new();
        for i in 0..decoded_wavs.len() {
            filter_inputs.push_str(&format!("[{}:a]", i + 1));
        }
        let filter_str = format!("{}amix=inputs={}:duration=longest:dropout_transition=0[aout]", filter_inputs, decoded_wavs.len());
        ffmpeg_args.push("-filter_complex".to_string());
        ffmpeg_args.push(filter_str);
        ffmpeg_args.push("-map".to_string());
        ffmpeg_args.push("0:v:0".to_string());
        ffmpeg_args.push("-map".to_string());
        ffmpeg_args.push("[aout]".to_string());
    }

    ffmpeg_args.push("-c:v".to_string());
    ffmpeg_args.push("copy".to_string());
    ffmpeg_args.push("-c:a".to_string());
    ffmpeg_args.push("aac".to_string());
    ffmpeg_args.push("-b:a".to_string());
    ffmpeg_args.push("192k".to_string());
    ffmpeg_args.push("-shortest".to_string());
    ffmpeg_args.push(preview_muxed.to_string_lossy().to_string());

    let mux_res = mux_cmd.args(&ffmpeg_args).output().await;

    // Clean up temporary wav files
    for wav in &decoded_wavs {
        if wav.starts_with(&temp_audio_dir) {
            let _ = fs::remove_file(wav);
        }
    }

    if mux_res.is_ok() && preview_muxed.exists() && fs::metadata(&preview_muxed).map(|m| m.len() > 10_000).unwrap_or(false) {
        emit_log(app, &format!("สร้างวิดีโอพรีวิวพร้อมเสียงสำเร็จ {}", preview_muxed.display()));
        return Some(preview_muxed);
    }

    None
}

async fn generate_thumbnail_fallback(ffmpeg_cmd: &Path, video_path: &Path, thumb_dest: &Path) {
    let seeks = ["00:00:01", "00:00:00.2", "00:00:00"];
    for seek in seeks {
        let mut cmd = Command::new(ffmpeg_cmd);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }
        let _ = cmd
            .args([
                "-y",
                "-ss", seek,
                "-i", &video_path.to_string_lossy(),
                "-vframes", "1",
                "-q:v", "5",
                "-vf", "scale=480:-1",
                &thumb_dest.to_string_lossy(),
            ])
            .output()
            .await;

        if thumb_dest.exists() && fs::metadata(thumb_dest).map(|m| m.len() > 500).unwrap_or(false) {
            break;
        }
    }
}

#[tauri::command]
pub async fn extract_cutscene_on_demand(
    app: AppHandle,
    state: tauri::State<'_, ConfigState>,
    extractor_state: tauri::State<'_, ExtractorState>,
    cg_name: String,
    cg_file: String,
    sound_events: Vec<String>,
    request_id: String,
) -> Result<ExtractedAssetResult, String> {
    let config = state.0.lock().unwrap().clone();
    let export_dir = config.get_effective_export_dir();
    let base_cg = extract_base_cg_name(&cg_name);
    let bundle_dir = if export_dir.join("cutscenes").join(&cg_name).exists() {
        export_dir.join("cutscenes").join(&cg_name)
    } else {
        export_dir.join("cutscenes").join(&base_cg)
    };
    let _ = fs::create_dir_all(&bundle_dir);
    let _ = fs::create_dir_all(bundle_dir.join("video"));
    let _ = fs::create_dir_all(bundle_dir.join("audio"));
    let _ = fs::create_dir_all(bundle_dir.join("wem"));
    let _ = fs::create_dir_all(bundle_dir.join("txtp"));
    let _ = fs::create_dir_all(bundle_dir.join("subtitles"));
    let _ = fs::create_dir_all(bundle_dir.join("preview"));

    let base_cache = get_cache_cutscenes_dir(&app);
    let cg_cache_dir = if base_cache.join(&cg_name).exists() {
        base_cache.join(&cg_name)
    } else {
        base_cache.join(&base_cg)
    };

    // Dynamic resolution of sound hints from videosound.json first
    let mut effective_sounds = sound_events.clone();
    if effective_sounds.is_empty() {
        let data_dir = crate::commands::downloader::get_data_dir(&app);
        let videosound_path = data_dir.join("videosound.json");
        if let Ok(content) = fs::read_to_string(&videosound_path) {
            if let Ok(videosound) = serde_json::from_str::<Vec<Value>>(&content) {
                let target_gender_num = if config.char_selection == "female" || config.char_selection == "0" || config.char_selection == "Girl" { 0 } else { 1 };
                let clean_base = base_cg.to_lowercase();
                for item in videosound {
                    let item_cg = item.get("CgName").and_then(|v| v.as_str()).unwrap_or("");
                    let clean_item = extract_base_cg_name(item_cg).to_lowercase();
                    if item_cg.eq_ignore_ascii_case(&cg_name) || clean_item == clean_base {
                        let sound_gender = item.get("GirlOrBoy").and_then(|v| v.as_i64()).unwrap_or(2);
                        if sound_gender == 2 || sound_gender == target_gender_num as i64 {
                            if let Some(event_path) = item.get("EventPath").and_then(|v| v.as_str()) {
                                let event = event_path.split('/').last().unwrap_or("").split('.').next().unwrap_or("").to_string();
                                if !event.is_empty() && !effective_sounds.contains(&event) {
                                    effective_sounds.push(event);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Check if video already exists in bundle dir or legacy cache
    let mut cached_video: Option<PathBuf> = None;
    for check_dir in [
        &bundle_dir,
        &bundle_dir.join("video"),
        &cg_cache_dir,
        &base_cache.join(&cg_name),
        &base_cache.join(&base_cg),
        &export_dir.join("cutscenes").join(&cg_name),
        &export_dir.join("cutscenes").join(&base_cg),
    ] {
        if check_dir.exists() && check_dir.is_dir() {
            if let Ok(entries) = fs::read_dir(check_dir) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                        if (ext.eq_ignore_ascii_case("mp4") || ext.eq_ignore_ascii_case("bk2") || ext.eq_ignore_ascii_case("mkv"))
                            && p.metadata().map(|m| m.len() > 100_000).unwrap_or(false)
                        {
                            cached_video = Some(p);
                            break;
                        }
                    }
                }
            }
        }
        if cached_video.is_some() {
            break;
        }
    }

    if cached_video.is_none() {
        let mut map = HashMap::new();
        for root in get_system_drive_roots() {
            let fmodel_export = PathBuf::from(format!(r"{}Datamine\Datamine\FModel\Output\Exports\Client\Content\Aki\Movies", root));
            if fmodel_export.exists() {
                index_directory_videos(&fmodel_export, &mut map);
                break;
            }
        }
        if export_dir.exists() {
            index_directory_videos(&export_dir, &mut map);
        }
        let clean_base = base_cg.to_lowercase();
        let clean_cg_low = cg_name.trim().to_lowercase();
        let file_stem = Path::new(&cg_file).file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();

        if let Some(p) = map.get(&clean_cg_low) {
            cached_video = Some(p.clone());
        } else if let Some(p) = map.get(&clean_base) {
            cached_video = Some(p.clone());
        } else if !file_stem.is_empty() {
            if let Some(p) = map.get(&file_stem) {
                cached_video = Some(p.clone());
            }
        }
    }

    let mut audio_files = Vec::new();
    for check_dir in [
        &bundle_dir,
        &cg_cache_dir,
        &bundle_dir.join("audio"),
        &base_cache.join(&cg_name),
        &base_cache.join(&base_cg),
        &export_dir.join("cutscenes").join(&cg_name),
        &export_dir.join("cutscenes").join(&base_cg),
    ] {
        if check_dir.exists() && check_dir.is_dir() {
            if let Ok(entries) = fs::read_dir(check_dir) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                        if ext.eq_ignore_ascii_case("bnk") || ext.eq_ignore_ascii_case("wem") || ext.eq_ignore_ascii_case("txtp") {
                            let s = p.to_string_lossy().to_string();
                            if !audio_files.contains(&s) {
                                audio_files.push(s);
                            }
                        }
                    }
                }
            }
        }
    }

    let has_audio_on_disk = !audio_files.is_empty() || effective_sounds.is_empty();

    if let Some(ref existing_vid) = cached_video {
        if has_audio_on_disk {
            emit_log(&app, &format!("พบคัตซีน {} ในเครื่องแล้ว {}", cg_name, existing_vid.display()));

            // Ensure pristine video is located in project bundle/video directory
            let video_dir = bundle_dir.join("video");
            let _ = fs::create_dir_all(&video_dir);
            let mut resolved_existing = existing_vid.clone();
            if let Some(v_name) = existing_vid.file_name() {
                let bundle_vid = video_dir.join(v_name);
                if !bundle_vid.exists() && existing_vid.exists() {
                    let _ = fs::copy(existing_vid, &bundle_vid);
                }
                if bundle_vid.exists() {
                    resolved_existing = bundle_vid;
                }
            }

            // Ensure isolated thumbnail exists on disk and return compact base64
            let thumb_cache_dir = crate::commands::downloader::get_base_dir(&app).join("thumbnails");
            let _ = fs::create_dir_all(&thumb_cache_dir);
            let vid_stem = resolved_existing.file_stem().and_then(|s| s.to_str()).unwrap_or(&cg_name);
            let clean_cg = cg_name.trim();
            let default_thumb = thumb_cache_dir.join(format!("thumb_{}.jpg", vid_stem));
            let target_thumb_plain = thumb_cache_dir.join(format!("{}.jpg", vid_stem));
            let target_cg_thumb = thumb_cache_dir.join(format!("thumb_{}.jpg", clean_cg));
            let target_cg_plain = thumb_cache_dir.join(format!("{}.jpg", clean_cg));
            let bundle_thumb = bundle_dir.join("preview").join(format!("thumb_{}.jpg", vid_stem));
            let bundle_thumb_direct = bundle_dir.join("preview").join("thumbnail.jpg");
            let mut thumb_base64: Option<String> = None;

            let sync_thumbs = |src: &Path| {
                let _ = fs::copy(src, &default_thumb);
                let _ = fs::copy(src, &target_thumb_plain);
                let _ = fs::copy(src, &target_cg_thumb);
                let _ = fs::copy(src, &target_cg_plain);
                let _ = fs::copy(src, &bundle_thumb);
                let _ = fs::copy(src, &bundle_thumb_direct);
            };

            let existing_thumb = [&default_thumb, &target_thumb_plain, &target_cg_thumb, &target_cg_plain, &bundle_thumb, &bundle_thumb_direct]
                .into_iter()
                .find(|p| p.exists() && fs::metadata(p).map(|m| m.len() > 1000).unwrap_or(false));

            if let Some(t_found) = existing_thumb {
                sync_thumbs(t_found);
                if let Ok(bytes) = fs::read(t_found) {
                    thumb_base64 = Some(format!("data:image/jpeg;base64,{}", crate::commands::scanner::base64_encode(&bytes)));
                }
            } else {
                let tools_dir = get_tools_dir(&app);
                let ffmpeg_bin = tools_dir.join("ffmpeg.exe");
                let ffmpeg_cmd = if ffmpeg_bin.exists() { ffmpeg_bin } else { PathBuf::from("ffmpeg") };
                generate_thumbnail_fallback(&ffmpeg_cmd, &existing_vid, &default_thumb).await;

                if default_thumb.exists() {
                    sync_thumbs(&default_thumb);
                    if let Ok(bytes) = fs::read(&default_thumb) {
                        thumb_base64 = Some(format!("data:image/jpeg;base64,{}", crate::commands::scanner::base64_encode(&bytes)));
                    }
                }
            }

            let mut return_video_path = existing_vid.clone();
            let preview_muxed = bundle_dir.join("preview").join("preview_muxed.mp4");
            if preview_muxed.exists() && fs::metadata(&preview_muxed).map(|m| m.len() > 10_000).unwrap_or(false) {
                return_video_path = preview_muxed;
            } else if let Some(muxed) = create_preview_muxed_video(&app, &bundle_dir, existing_vid, &cg_name).await {
                return_video_path = muxed;
            }

            return Ok(ExtractedAssetResult {
                status: "ok".into(),
                id: request_id,
                cg_name,
                video_file: return_video_path.to_string_lossy().to_string(),
                audio_files,
                elapsed_ms: 0,
                is_cached: true,
                thumbnail_base64: thumb_base64,
            });
        } else {
            emit_log(&app, &format!("พบคัตซีน {} แล้วแต่ยังไม่มีไฟล์เสียง กำลังสกัดเสียงจากแพ็กเกจเกม", cg_name));
        }
    }

    emit_log(&app, &format!("เริ่มกระบวนการสกัดไฟล์คัตซีน {} จากแพ็กเกม", cg_name));

    // Emit Stage 1
    use tauri::Emitter;
    let _ = app.emit("extraction-progress", json!({
        "cg_name": &cg_name,
        "stage": 1,
        "status_text": "กำลังค้นหาตำแหน่งไฟล์ในแพ็กเกจเกม",
        "percent": 20
    }));

    let config = state.0.lock().unwrap().clone();
    let extract_cmd = json!({
        "cmd": "extract",
        "id": request_id,
        "cg_name": cg_name,
        "video_path": cg_file,
        "sound_events": effective_sounds,
        "output_dir": bundle_dir.to_string_lossy().to_string(),
        "export_dir": export_dir.to_string_lossy().to_string(),
        "gender": config.char_selection,
        "locale": config.locale_selection
    });

    emit_log(&app, &format!("ส่งคำขอสกัดคัตซีน {} ไปยัง CUE4Parse Worker รหัส {}", cg_name, request_id));

    // Auto-recovering pipe transmission: Retries once if the pipe broke
    let mut retried = false;
    let rx = loop {
        ensure_daemon_alive(&app, &extractor_state, &state).await?;
        let mut manager_lock = extractor_state.0.lock().await;

        if let Some(manager) = manager_lock.as_mut() {
            let (tx, rx) = oneshot::channel();
            manager.pending.lock().await.insert(request_id.clone(), tx);

            let line = format!("{}\n", extract_cmd);
            let write_res = manager.stdin.write_all(line.as_bytes()).await;
            let flush_res = if write_res.is_ok() { manager.stdin.flush().await } else { write_res };

            if let Err(e) = flush_res {
                emit_log(&app, &format!("ตรวจพบท่อส่งคำสั่งตัดการเชื่อมต่อ รหัสข้อผิดพลาด {} กำลังกู้คืน Worker...", e));
                *manager_lock = None;
                if !retried {
                    retried = true;
                    continue;
                }
                return Err(format!("Worker communication error: {}", e));
            }
            break rx;
        } else {
            return Err("Extractor daemon not available".into());
        }
    };

    // Wait for response with 120 second timeout
    let response = tokio::time::timeout(Duration::from_secs(120), rx)
        .await
        .map_err(|_| {
            let msg = format!("การสกัดคัตซีน {} หมดเวลาหลังจาก 120 วินาที", cg_name);
            emit_log(&app, &msg);
            msg
        })?
        .map_err(|_| {
            let msg = format!("การเชื่อมต่อกับ CUE4Parse Worker ขาดหายระหว่างสกัด {}", cg_name);
            emit_log(&app, &msg);
            msg
        })?;

    let status = response.get("status").and_then(|s| s.as_str()).unwrap_or("error");
    if status == "cancelled" {
        emit_log(&app, &format!("การสกัดคัตซีน {} ถูกยกเลิกโดยผู้ใช้", cg_name));
        return Err("CANCELLED".into());
    }
    if status == "ok" {
        let mut video_file = response.get("video_file").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if video_file.is_empty() {
            if let Some(ref cv) = cached_video {
                video_file = cv.to_string_lossy().to_string();
            }
        }

        let _ = app.emit("extraction-progress", json!({
            "cg_name": &cg_name,
            "stage": 2,
            "status_text": "กำลังสกัดสตรีมวิดีโอความละเอียดสูง",
            "percent": 50
        }));

        // Transcode .bk2 to .mp4 using FFmpeg if needed
        if video_file.to_lowercase().ends_with(".bk2") {
            let mp4_dest = PathBuf::from(&video_file).with_extension("mp4");
            if !mp4_dest.exists() {
                emit_log(&app, &format!("กำลังแปลงรูปแบบ BK2 เป็น MP4 สำหรับคัตซีน {}", cg_name));
                let tools_dir = get_tools_dir(&app);
                let ffmpeg_bin = tools_dir.join("ffmpeg.exe");
                let ffmpeg_cmd = if ffmpeg_bin.exists() {
                    ffmpeg_bin
                } else {
                    PathBuf::from("ffmpeg")
                };

                let _ = Command::new(ffmpeg_cmd)
                    .args([
                        "-y",
                        "-i", &video_file,
                        "-c:v", "libx264",
                        "-pix_fmt", "yuv420p",
                        "-c:a", "aac",
                        &mp4_dest.to_string_lossy(),
                    ])
                    .output()
                    .await;
            }
            if mp4_dest.exists() {
                video_file = mp4_dest.to_string_lossy().to_string();
                emit_log(&app, &format!("แปลงไฟล์ MP4 สำเร็จ {}", video_file));
            }
        }

        if !video_file.is_empty() {
            let video_dir = bundle_dir.join("video");
            let _ = fs::create_dir_all(&video_dir);
            let v_path = PathBuf::from(&video_file);
            if let Some(v_name) = v_path.file_name() {
                let in_sub = video_dir.join(v_name);
                if !in_sub.exists() && v_path.exists() {
                    let _ = fs::copy(&v_path, &in_sub);
                }
            }
        }

        let _ = app.emit("extraction-progress", json!({
            "cg_name": &cg_name,
            "stage": 3,
            "status_text": "กำลังสกัดธนาคารเสียงและสตรีมเสียง Wwise",
            "percent": 75
        }));

        let _ = app.emit("extraction-progress", json!({
            "cg_name": &cg_name,
            "stage": 4,
            "status_text": "กำลังประมวลผลโครงสร้างเสียงและดัชนี",
            "percent": 88
        }));

        let mut thumb_base64: Option<String> = None;

        // Auto-extract thumbnail frame if video exists
        if !video_file.is_empty() && Path::new(&video_file).exists() {
            let _ = app.emit("extraction-progress", json!({
                "cg_name": &cg_name,
                "stage": 5,
                "status_text": "กำลังสร้างภาพตัวอย่างและเตรียมความพร้อม",
                "percent": 95
            }));

            let thumb_cache_dir = crate::commands::downloader::get_base_dir(&app).join("thumbnails");
            let _ = fs::create_dir_all(&thumb_cache_dir);
            let vid_stem = Path::new(&video_file).file_stem().and_then(|s| s.to_str()).unwrap_or(&cg_name);
            let clean_cg = cg_name.trim();
            let target_thumb = thumb_cache_dir.join(format!("thumb_{}.jpg", vid_stem));
            let target_thumb_plain = thumb_cache_dir.join(format!("{}.jpg", vid_stem));
            let target_cg_thumb = thumb_cache_dir.join(format!("thumb_{}.jpg", clean_cg));
            let target_cg_plain = thumb_cache_dir.join(format!("{}.jpg", clean_cg));
            let bundle_thumb = bundle_dir.join("preview").join(format!("thumb_{}.jpg", vid_stem));
            let bundle_thumb_direct = bundle_dir.join("preview").join("thumbnail.jpg");

            let tools_dir = get_tools_dir(&app);
            let ffmpeg_bin = tools_dir.join("ffmpeg.exe");
            let ffmpeg_cmd = if ffmpeg_bin.exists() {
                ffmpeg_bin
            } else {
                PathBuf::from("ffmpeg")
            };

            generate_thumbnail_fallback(&ffmpeg_cmd, Path::new(&video_file), &target_thumb).await;

            if target_thumb.exists() {
                let _ = fs::copy(&target_thumb, &target_thumb_plain);
                let _ = fs::copy(&target_thumb, &target_cg_thumb);
                let _ = fs::copy(&target_thumb, &target_cg_plain);
                let _ = fs::copy(&target_thumb, &bundle_thumb);
                let _ = fs::copy(&target_thumb, &bundle_thumb_direct);

                if let Ok(bytes) = fs::read(&target_thumb) {
                    thumb_base64 = Some(format!("data:image/jpeg;base64,{}", crate::commands::scanner::base64_encode(&bytes)));
                }
            }
        }

        let audio_files = response
            .get("audio_files")
            .and_then(|a| a.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|i| i.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();
        let elapsed_ms = response.get("elapsed_ms").and_then(|e| e.as_u64()).unwrap_or(0);

        let log_dest = if video_file.is_empty() {
            cg_cache_dir.to_string_lossy().to_string()
        } else {
            video_file.clone()
        };
        // Mux preview video with sound if audio is present (preserves raw video in bundle/video)
        let raw_video_path = PathBuf::from(&video_file);
        if let Some(muxed) = create_preview_muxed_video(&app, &bundle_dir, &raw_video_path, &cg_name).await {
            video_file = muxed.to_string_lossy().to_string();
        }

        let _ = app.emit("extraction-progress", json!({
            "cg_name": &cg_name,
            "stage": 5,
            "status_text": "กำลังสร้างภาพตัวอย่างและเตรียมความพร้อม",
            "percent": 100
        }));

        let is_cached = !video_file.is_empty();

        Ok(ExtractedAssetResult {
            status: "ok".into(),
            id: request_id,
            cg_name,
            video_file,
            audio_files,
            elapsed_ms,
            is_cached,
            thumbnail_base64: thumb_base64,
        })
    } else {
        let msg = response.get("message").and_then(|m| m.as_str()).unwrap_or("Extraction failed");
        emit_log(&app, &format!("การสกัดคัตซีน {} ล้มเหลว: {}", cg_name, msg));
        Err(msg.to_string())
    }
}

fn index_directory_videos(dir: &Path, map: &mut HashMap<String, PathBuf>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                index_directory_videos(&p, map);
            } else if p.is_file() {
                if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                    if (ext.eq_ignore_ascii_case("mp4") || ext.eq_ignore_ascii_case("bk2") || ext.eq_ignore_ascii_case("mkv"))
                        && p.metadata().map(|m| m.len() > 0).unwrap_or(false)
                    {
                        if let Some(stem) = p.file_stem().and_then(|s| s.to_str()) {
                            map.insert(stem.to_lowercase(), p.clone());
                        }
                        if let Some(name) = p.file_name().and_then(|s| s.to_str()) {
                            map.insert(name.to_lowercase(), p.clone());
                        }
                    }
                }
            }
        }
    }
}

#[tauri::command]
pub async fn cancel_extraction(
    app: AppHandle,
    extractor_state: tauri::State<'_, ExtractorState>,
    request_id: String,
) -> Result<(), String> {
    let mut manager_lock = extractor_state.0.lock().await;
    if let Some(manager) = manager_lock.as_mut() {
        let cancel_cmd = json!({
            "cmd": "cancel",
            "id": &request_id
        });
        let line = format!("{}\n", cancel_cmd);
        let _ = manager.stdin.write_all(line.as_bytes()).await;
        let _ = manager.stdin.flush().await;

        if let Some(tx) = manager.pending.lock().await.remove(&request_id) {
            let _ = tx.send(json!({
                "status": "cancelled",
                "id": request_id
            }));
        }
    }
    emit_log(&app, "ส่งสัญญาณยกเลิกการสกัดคัตซีนเรียบร้อยแล้ว");
    Ok(())
}

#[allow(dead_code)]
fn is_audio_ready_on_disk(
    base_cg: &str,
    full_cg: &str,
    export_dir: &Path,
    cache_dir: &Path,
) -> bool {
    let check_dirs = [
        export_dir.join("cutscenes").join(base_cg),
        export_dir.join("cutscenes").join(base_cg).join("audio"),
        export_dir.join("cutscenes").join(base_cg).join("wem"),
        export_dir.join("cutscenes").join(full_cg),
        export_dir.join("cutscenes").join(full_cg).join("audio"),
        export_dir.join("cutscenes").join(full_cg).join("wem"),
        cache_dir.join(base_cg),
        cache_dir.join(base_cg).join("audio"),
        cache_dir.join(full_cg),
        cache_dir.join(full_cg).join("audio"),
        export_dir.join("txtp"),
    ];
    for dir in &check_dirs {
        if dir.exists() && dir.is_dir() {
            if let Ok(entries) = fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    let file_stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
                    if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                        let is_audio_ext = ext.eq_ignore_ascii_case("bnk") || ext.eq_ignore_ascii_case("txtp") || ext.eq_ignore_ascii_case("wav") || ext.eq_ignore_ascii_case("wem");
                        if is_audio_ext {
                            if dir.ends_with("txtp") {
                                if file_stem.contains(&base_cg.to_lowercase()) || file_stem.contains(&full_cg.to_lowercase()) {
                                    return true;
                                }
                            } else {
                                return true;
                            }
                        }
                    }
                }
            }
        }
    }
    false
}

#[tauri::command]
pub async fn get_full_catalog_with_status(
    app: AppHandle,
    state: tauri::State<'_, ConfigState>,
    extractor_state: tauri::State<'_, ExtractorState>,
) -> Result<Vec<CatalogItemDto>, String> {
    let data_dir = get_data_dir(&app);
    let videodata_path = data_dir.join("videodata.json");
    let videosound_path = data_dir.join("videosound.json");

    let config = state.0.lock().unwrap().clone();
    let export_dir = config.get_effective_export_dir();
    let cache_dir = get_cache_cutscenes_dir(&app);

    let mut cg_requiring_audio = std::collections::HashSet::new();
    if videosound_path.exists() {
        if let Ok(content) = fs::read_to_string(&videosound_path) {
            if let Ok(videosound) = serde_json::from_str::<Vec<Value>>(&content) {
                for item in videosound {
                    if let Some(cg) = item.get("CgName").and_then(|v| v.as_str()) {
                        cg_requiring_audio.insert(cg.to_lowercase());
                        cg_requiring_audio.insert(extract_base_cg_name(cg).to_lowercase());
                    }
                }
            }
        }
    }

    // 1. Index videos using high-performance cached index
    let export_files_map = get_or_build_video_index(&app, &config);

    // Pre-scan local extracted cutscenes cache once (0ms subsequent checks)
    let mut cached_videos_map: HashMap<String, PathBuf> = HashMap::new();
    if cache_dir.exists() && cache_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(&cache_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    let folder_name = p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_lowercase();
                    if let Ok(sub_entries) = fs::read_dir(&p) {
                        for sub in sub_entries.flatten() {
                            let sub_p = sub.path();
                            if let Some(ext) = sub_p.extension().and_then(|e| e.to_str()) {
                                if (ext.eq_ignore_ascii_case("mp4") || ext.eq_ignore_ascii_case("bk2") || ext.eq_ignore_ascii_case("mkv") || ext.eq_ignore_ascii_case("webm") || ext.eq_ignore_ascii_case("usm"))
                                    && sub_p.metadata().map(|m| m.len() > 50_000).unwrap_or(false)
                                {
                                    cached_videos_map.insert(folder_name.clone(), sub_p);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Pre-scan audio on disk once to eliminate thousands of file checks in the loop
    let mut audio_ready_stems: std::collections::HashSet<String> = std::collections::HashSet::new();
    let cutscenes_dir = export_dir.join("cutscenes");
    for base in [&cutscenes_dir, &cache_dir] {
        if base.exists() && base.is_dir() {
            if let Ok(subdirs) = fs::read_dir(base) {
                for sub in subdirs.flatten() {
                    let p = sub.path();
                    if p.is_dir() {
                        let folder_stem = p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_lowercase();
                        let mut has_audio = false;
                        for dir_to_check in [&p, &p.join("audio"), &p.join("wem")] {
                            if dir_to_check.exists() && dir_to_check.is_dir() {
                                if let Ok(files) = fs::read_dir(dir_to_check) {
                                    for f in files.flatten() {
                                        let fp = f.path();
                                        if let Some(ext) = fp.extension().and_then(|e| e.to_str()) {
                                            if ext.eq_ignore_ascii_case("bnk") || ext.eq_ignore_ascii_case("txtp") || ext.eq_ignore_ascii_case("wav") || ext.eq_ignore_ascii_case("wem") {
                                                has_audio = true;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                            if has_audio { break; }
                        }
                        if has_audio {
                            audio_ready_stems.insert(folder_stem);
                        }
                    }
                }
            }
        }
    }

    let txtp_dir = export_dir.join("txtp");
    if txtp_dir.exists() && txtp_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(&txtp_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                    if ext.eq_ignore_ascii_case("txtp") || ext.eq_ignore_ascii_case("wav") {
                        let file_stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
                        audio_ready_stems.insert(file_stem);
                    }
                }
            }
        }
    }

    let check_audio_ready = |base_cg: &str, cg_name: &str| -> bool {
        let b_low = base_cg.to_lowercase();
        let c_low = cg_name.to_lowercase();
        audio_ready_stems.contains(&c_low)
            || audio_ready_stems.contains(&b_low)
            || audio_ready_stems.iter().any(|s| s.contains(&b_low) || (!b_low.is_empty() && s.contains(&c_low)))
    };

    // 2. Query mounted videos from CUE4Parse Worker daemon (FModel style: ALL 97 videos in PAKs)
    let mut mounted_videos_map: HashMap<String, Value> = HashMap::new();
    let mut mounted_videos_list: Vec<Value> = Vec::new();

    let _ = ensure_daemon_alive(&app, &extractor_state, &state).await;
    let list_req_id = "catalog_list_videos".to_string();
    let (tx, rx) = oneshot::channel();

    let sent_query = {
        let mut manager_lock = extractor_state.0.lock().await;
        if let Some(manager) = manager_lock.as_mut() {
            manager.pending.lock().await.insert(list_req_id.clone(), tx);
            let cmd = json!({
                "cmd": "list_videos",
                "id": list_req_id
            });
            let line = format!("{}\n", cmd);
            let res = manager.stdin.write_all(line.as_bytes()).await;
            if res.is_ok() {
                manager.stdin.flush().await.is_ok()
            } else {
                false
            }
        } else {
            false
        }
    };

    if sent_query {
        if let Ok(Ok(resp)) = tokio::time::timeout(Duration::from_secs(25), rx).await {
            if let Some(arr) = resp.get("videos").and_then(|v| v.as_array()) {
                for item in arr {
                    if let Some(stem) = item.get("stem").and_then(|s| s.as_str()) {
                        mounted_videos_map.insert(stem.to_lowercase(), item.clone());
                    }
                    if let Some(fn_str) = item.get("filename").and_then(|f| f.as_str()) {
                        mounted_videos_map.insert(fn_str.to_lowercase(), item.clone());
                    }
                    if let Some(base_stem) = item.get("base_stem").and_then(|b| b.as_str()) {
                        if !base_stem.is_empty() {
                            mounted_videos_map.entry(base_stem.to_lowercase()).or_insert_with(|| item.clone());
                        }
                    }
                    mounted_videos_list.push(item.clone());
                }
            }
        }
    }

    let mut catalog: Vec<CatalogItemDto> = Vec::new();
    let mut seen_keys: std::collections::HashSet<String> = std::collections::HashSet::new();

    // 3. Process items from videodata.json (the 309 items)
    if videodata_path.exists() {
        if let Ok(videodata_str) = fs::read_to_string(&videodata_path) {
            if let Ok(videodata) = serde_json::from_str::<Vec<Value>>(&videodata_str) {
                for item in videodata {
                    let cg_name = item.get("CgName").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let cg_file = item.get("CgFile").and_then(|v| v.as_str()).unwrap_or("").to_string();

                    if cg_name.is_empty() || cg_file.is_empty() {
                        continue;
                    }

                    let filename = Path::new(&cg_file)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("");
                    let file_stem = Path::new(&cg_file)
                        .file_stem()
                        .and_then(|n| n.to_str())
                        .unwrap_or("");

                    let girl_or_boy = item.get("GirlOrBoy").and_then(|v| v.as_i64()).unwrap_or(-1) as i32;
                    let can_skip = item.get("CanSkip").and_then(|v| v.as_bool()).unwrap_or(false);
                    let aspect = item.get("Aspect").and_then(|v| v.as_f64()).unwrap_or(1.777);

                    let cg_lower = cg_name.to_lowercase();
                    let fn_lower = filename.to_lowercase();
                    let stem_lower = file_stem.to_lowercase();
                    let clean_seq_stem = stem_lower.split('.').next().unwrap_or(&stem_lower).to_string();
                    let clean_seq_base = extract_base_cg_name(&clean_seq_stem).to_lowercase();
                    let base_cg = extract_base_cg_name(&cg_name);
                    let base_lower = base_cg.to_lowercase();

                    // Check local cache from in-memory pre-scanned index
                    let mut found_local: Option<PathBuf> = cached_videos_map.get(&cg_lower).cloned();

                    // Check export_dir

                    if found_local.is_none() && !export_files_map.is_empty() {
                        if let Some(p) = export_files_map.get(&cg_lower)
                            .or_else(|| export_files_map.get(&clean_seq_stem))
                            .or_else(|| export_files_map.get(&clean_seq_base))
                            .or_else(|| export_files_map.get(&base_lower))
                            .or_else(|| export_files_map.get(&stem_lower))
                            .or_else(|| export_files_map.get(&fn_lower))
                            .or_else(|| export_files_map.get(&format!("{}_nanzhu", cg_lower)))
                            .or_else(|| export_files_map.get(&format!("{}_nvzhu", cg_lower)))
                            .or_else(|| export_files_map.get(&format!("{}_nanzhu", clean_seq_stem)))
                            .or_else(|| export_files_map.get(&format!("{}_nvzhu", clean_seq_stem)))
                            .or_else(|| export_files_map.get(&format!("{}_nanzhu", clean_seq_base)))
                            .or_else(|| export_files_map.get(&format!("{}_nvzhu", clean_seq_base)))
                            .or_else(|| export_files_map.get(&format!("{}.mp4", cg_lower)))
                        {
                            found_local = Some(p.clone());
                        }
                    }

                    // Check mounted videos from CUE4Parse
                    let matched_mounted = mounted_videos_map.get(&cg_lower)
                        .or_else(|| mounted_videos_map.get(&clean_seq_stem))
                        .or_else(|| mounted_videos_map.get(&clean_seq_base))
                        .or_else(|| mounted_videos_map.get(&base_lower))
                        .or_else(|| mounted_videos_map.get(&stem_lower))
                        .or_else(|| mounted_videos_map.get(&fn_lower))
                        .or_else(|| mounted_videos_map.get(&format!("{}_nanzhu", cg_lower)))
                        .or_else(|| mounted_videos_map.get(&format!("{}_nvzhu", cg_lower)))
                        .or_else(|| mounted_videos_map.get(&format!("{}_nanzhu", clean_seq_stem)))
                        .or_else(|| mounted_videos_map.get(&format!("{}_nvzhu", clean_seq_stem)))
                        .or_else(|| mounted_videos_map.get(&format!("{}_nanzhu", clean_seq_base)))
                        .or_else(|| mounted_videos_map.get(&format!("{}_nvzhu", clean_seq_base)))
                        .or_else(|| mounted_videos_map.get(&format!("{}_nanzhu", base_lower)))
                        .or_else(|| mounted_videos_map.get(&format!("{}_nvzhu", base_lower)));

                    let is_cached = found_local.is_some();
                    let local_path = found_local.map(|p| p.to_string_lossy().to_string());
                    let has_video = is_cached
                        || matched_mounted.is_some()
                        || cg_file.to_lowercase().ends_with(".mp4")
                        || cg_file.to_lowercase().ends_with(".bk2")
                        || cg_file.to_lowercase().ends_with(".webm")
                        || cg_file.to_lowercase().ends_with(".usm")
                        || export_files_map.contains_key(&cg_lower)
                        || export_files_map.contains_key(&stem_lower)
                        || export_files_map.contains_key(&clean_seq_stem)
                        || export_files_map.contains_key(&base_lower);

                    let is_level_sequence = !has_video;
                    let asset_kind = if has_video { "video".to_string() } else { "sequence".to_string() };

                    let video_format = if let Some(m) = matched_mounted {
                        m.get("format").and_then(|f| f.as_str()).unwrap_or("mp4").to_string()
                    } else if cg_file.to_lowercase().ends_with(".mp4") {
                        "mp4".to_string()
                    } else if cg_file.to_lowercase().ends_with(".bk2") {
                        "bk2".to_string()
                    } else if cg_file.to_lowercase().ends_with(".webm") {
                        "webm".to_string()
                    } else if cg_file.to_lowercase().ends_with(".usm") {
                        "usm".to_string()
                    } else {
                        "uasset".to_string()
                    };

                    // Standardize unified category folder
                    let category_folder = if let Some(m) = matched_mounted {
                        let f = m.get("category_folder").and_then(|f| f.as_str()).unwrap_or("");
                        normalize_catalog_folder(f)
                    } else {
                        normalize_catalog_folder(&cg_file)
                    };

                    let base_cg = extract_base_cg_name(&cg_name);
                    let requires_audio = cg_requiring_audio.contains(&cg_lower) || cg_requiring_audio.contains(&base_cg.to_lowercase());
                    let audio_on_disk = check_audio_ready(&base_cg, &cg_name);
                    let audio_ready = if requires_audio {
                        audio_on_disk
                    } else {
                        true
                    };

                    let base_cg_name = Some(base_cg);
                    let comp_key = format!("{}_{}_{}", cg_lower, girl_or_boy, category_folder.to_lowercase());
                    seen_keys.insert(comp_key);
                    seen_keys.insert(format!("{}_{}_{}", stem_lower, girl_or_boy, category_folder.to_lowercase()));
                    seen_keys.insert(format!("{}_{}_{}", fn_lower, girl_or_boy, category_folder.to_lowercase()));

                    catalog.push(CatalogItemDto {
                        cg_name,
                        cg_file,
                        is_cached,
                        local_video_path: local_path,
                        audio_ready,
                        girl_or_boy,
                        can_skip,
                        aspect,
                        category_folder,
                        has_video,
                        is_level_sequence,
                        base_cg_name,
                        file_size: matched_mounted.and_then(|m| m.get("size").and_then(|s| s.as_u64())),
                        asset_kind,
                        video_format,
                    });
                }
            }
        }
    }

    // 4. Merge all mounted and loose video files from CUE4Parse Worker daemon (100% full-spectrum discovery)
    for vid in mounted_videos_list {
        let v_path = vid.get("path").and_then(|p| p.as_str()).unwrap_or("").to_string();
        let v_fn = vid.get("filename").and_then(|p| p.as_str()).unwrap_or("").to_string();
        let v_stem = vid.get("stem").and_then(|p| p.as_str()).unwrap_or("").to_string();
        let v_fmt = vid.get("format").and_then(|p| p.as_str()).unwrap_or("mp4").to_string();
        let v_folder_raw = vid.get("category_folder").and_then(|p| p.as_str()).unwrap_or("Aki/Movies").to_string();
        let v_folder = normalize_catalog_folder(&v_folder_raw);
        let v_gender = vid.get("gender").and_then(|p| p.as_i64()).unwrap_or(-1) as i32;
        let v_size = vid.get("size").and_then(|p| p.as_u64());

        if v_stem.is_empty() {
            continue;
        }

        let stem_lower = v_stem.to_lowercase();
        let comp_key = format!("{}_{}_{}", stem_lower, v_gender, v_folder.to_lowercase());

        if !seen_keys.contains(&comp_key) {
            seen_keys.insert(comp_key);

            // Check cache from in-memory pre-scanned index
            let mut found_local: Option<PathBuf> = cached_videos_map.get(&stem_lower).cloned();
            if found_local.is_none() {
                if let Some(p) = export_files_map.get(&stem_lower).or_else(|| export_files_map.get(&v_fn.to_lowercase())) {
                    found_local = Some(p.clone());
                }
            }

            let is_cached = found_local.is_some();
            let local_path = found_local.map(|p| p.to_string_lossy().to_string());
            let base_cg = extract_base_cg_name(&v_stem);
            let requires_audio = cg_requiring_audio.contains(&stem_lower) || cg_requiring_audio.contains(&base_cg.to_lowercase());
            let audio_on_disk = check_audio_ready(&base_cg, &v_stem);
            let audio_ready = if requires_audio {
                audio_on_disk
            } else {
                true
            };
            let base_cg_name = Some(base_cg);

            catalog.push(CatalogItemDto {
                cg_name: v_stem.clone(),
                cg_file: v_path,
                is_cached,
                local_video_path: local_path,
                audio_ready,
                girl_or_boy: v_gender,
                can_skip: false,
                aspect: 1.777,
                category_folder: v_folder,
                has_video: true,
                is_level_sequence: false,
                base_cg_name,
                file_size: v_size,
                asset_kind: "video".to_string(),
                video_format: v_fmt,
            });
        }
    }

    // 5. Merge any remaining loose files from export_files_map (ensures 03_7 and uncatalogued exports appear 100%)
    for (stem_lower, path) in &export_files_map {
        let p_str = path.to_string_lossy().replace('\\', "/");
        let norm_folder = normalize_catalog_folder(&p_str);

        let g_val = if stem_lower.ends_with("_nvzhu") || stem_lower.contains("_nv_") || stem_lower.ends_with("_nv") || stem_lower.contains("girl") {
            0
        } else if stem_lower.ends_with("_nanzhu") || stem_lower.contains("_nan_") || stem_lower.ends_with("_nan") || stem_lower.contains("boy") {
            1
        } else {
            -1
        };

        let comp_key = format!("{}_{}_{}", stem_lower, g_val, norm_folder.to_lowercase());
        if !seen_keys.contains(&comp_key) {
            seen_keys.insert(comp_key);
            let fname = path.file_stem().and_then(|f| f.to_str()).unwrap_or(stem_lower).to_string();
            let base_cg = extract_base_cg_name(&fname);
            let requires_audio = cg_requiring_audio.contains(stem_lower) || cg_requiring_audio.contains(&base_cg.to_lowercase());
            let audio_on_disk = check_audio_ready(&base_cg, &fname);
            let audio_ready = if requires_audio {
                audio_on_disk
            } else {
                true
            };
            let base_cg_name = Some(base_cg);
            let size = path.metadata().map(|m| m.len()).ok();
            let fmt = path.extension().and_then(|e| e.to_str()).unwrap_or("mp4").to_lowercase();

            catalog.push(CatalogItemDto {
                cg_name: fname,
                cg_file: p_str.clone(),
                is_cached: true,
                local_video_path: Some(p_str),
                audio_ready,
                girl_or_boy: g_val,
                can_skip: false,
                aspect: 1.777,
                category_folder: norm_folder,
                has_video: true,
                is_level_sequence: false,
                base_cg_name,
                file_size: size,
                asset_kind: "video".to_string(),
                video_format: fmt,
            });
        }
    }

    Ok(catalog)
}

#[tauri::command]
pub async fn get_cutscene_thumbnail(
    app: AppHandle,
    extractor_state: tauri::State<'_, ExtractorState>,
    state: tauri::State<'_, ConfigState>,
    cg_name: String,
    cg_file: String,
    gender: i32,
) -> Result<String, String> {
    let clean_cg_name = cg_name.trim();
    if clean_cg_name.is_empty() {
        return Err("cg_name is empty".into());
    }

    // 0. Check Negative Cache: instant 0ms return for cutscenes already known to lack thumbnails
    if let Ok(neg_cache) = get_negative_thumb_cache().read() {
        if neg_cache.contains(clean_cg_name) {
            return Err("Thumbnail not found in negative cache".into());
        }
    }

    let cache_dir = crate::commands::downloader::get_base_dir(&app).join("thumbnails");
    let _ = fs::create_dir_all(&cache_dir);

    let gender_suffix = if gender == 0 { "_nv" } else if gender == 1 { "_nan" } else { "" };
    let file_stem = Path::new(&cg_file).file_stem().and_then(|s| s.to_str()).unwrap_or("");
    let clean_seq_stem = file_stem.split('.').next().unwrap_or(file_stem);

    let mut candidate_names = vec![
        format!("thumb_{}{}.jpg", clean_cg_name, gender_suffix),
        format!("thumb_{}.jpg", clean_cg_name),
        format!("{}{}.jpg", clean_cg_name, gender_suffix),
        format!("{}.jpg", clean_cg_name),
        format!("{}_nvzhu.jpg", clean_cg_name.to_lowercase()),
        format!("{}_nanzhu.jpg", clean_cg_name.to_lowercase()),
        format!("thumb_{}_nvzhu.jpg", clean_cg_name.to_lowercase()),
        format!("thumb_{}_nanzhu.jpg", clean_cg_name.to_lowercase()),
        format!("{}_nvzhu.jpg", clean_cg_name),
        format!("{}_nanzhu.jpg", clean_cg_name),
        format!("thumb_{}_nvzhu.jpg", clean_cg_name),
        format!("thumb_{}_nanzhu.jpg", clean_cg_name),
    ];

    if !clean_seq_stem.is_empty() {
        candidate_names.push(format!("thumb_{}.jpg", clean_seq_stem));
        candidate_names.push(format!("{}.jpg", clean_seq_stem));
        candidate_names.push(format!("{}.jpg", clean_seq_stem.to_lowercase()));
        candidate_names.push(format!("thumb_{}.jpg", clean_seq_stem.to_lowercase()));
    }

    // 1. Check local thumbnail cache on disk with prefix prioritization - return absolute canonical path
    for c_name in &candidate_names {
        let t_path = cache_dir.join(c_name);
        if t_path.exists() && fs::metadata(&t_path).map(|m| m.len() >= 3500).unwrap_or(false) {
            return Ok(canonical_path_string(&t_path));
        }
    }

    // Case-insensitive scan in cache_dir
    if let Ok(entries) = fs::read_dir(&cache_dir) {
        let clean_lower = clean_cg_name.to_lowercase();
        let stem_lower = clean_seq_stem.to_lowercase();
        for entry in entries.flatten() {
            let p = entry.path();
            if let Some(fname) = p.file_name().and_then(|n| n.to_str()) {
                let f_lower = fname.to_lowercase();
                if f_lower.ends_with(".jpg") && (f_lower.contains(&clean_lower) || (!stem_lower.is_empty() && f_lower.contains(&stem_lower))) {
                    if fs::metadata(&p).map(|m| m.len() >= 3500).unwrap_or(false) {
                        return Ok(canonical_path_string(&p));
                    }
                }
            }
        }
    }

    // 2. Check if local video exists in cache or export dir, and generate frame with FFmpeg
    let config = state.0.lock().unwrap().clone();
    let video_cache_dir = get_cache_cutscenes_dir(&app).join(clean_cg_name);
    let mut local_video: Option<PathBuf> = None;

    if video_cache_dir.exists() {
        if let Ok(entries) = fs::read_dir(&video_cache_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                    if (ext.eq_ignore_ascii_case("mp4") || ext.eq_ignore_ascii_case("bk2"))
                        && p.metadata().map(|m| m.len() > 100_000).unwrap_or(false)
                    {
                        local_video = Some(p);
                        break;
                    }
                }
            }
        }
    }

    if local_video.is_none() {
        let map = get_or_build_video_index(&app, &config);
        let target_stem = clean_cg_name.to_lowercase();
        let file_stem = Path::new(&cg_file).file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();

        if let Some(p) = map.get(&target_stem) {
            local_video = Some(p.clone());
        } else if !file_stem.is_empty() {
            if let Some(p) = map.get(&file_stem) {
                local_video = Some(p.clone());
            }
        }
    }

    if let Some(vid_path) = local_video {
        let tools_dir = get_tools_dir(&app);
        let ffmpeg_bin = tools_dir.join("ffmpeg.exe");
        let ffmpeg_cmd = if ffmpeg_bin.exists() {
            ffmpeg_bin
        } else {
            PathBuf::from("ffmpeg")
        };

        let thumb_file = cache_dir.join(format!("thumb_{}{}.jpg", clean_cg_name, gender_suffix));
        let default_thumb_file = cache_dir.join(format!("{}.jpg", clean_cg_name));

        let seek_points = ["00:00:03.500", "00:00:07.000", "00:00:01.000"];
        for seek in seek_points {
            let mut thumb_cmd = Command::new(&ffmpeg_cmd);
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                thumb_cmd.creation_flags(0x08000000);
            }
            let res = thumb_cmd
                .args([
                    "-y",
                    "-ss", seek,
                    "-i", &vid_path.to_string_lossy(),
                    "-vf", "scale=480:-1",
                    "-vframes", "1",
                    "-q:v", "4",
                    &thumb_file.to_string_lossy(),
                ])
                .output()
                .await;

            if res.is_ok() && thumb_file.exists() && fs::metadata(&thumb_file).map(|m| m.len() >= 3500).unwrap_or(false) {
                if !default_thumb_file.exists() {
                    let _ = fs::copy(&thumb_file, &default_thumb_file);
                }
                return Ok(canonical_path_string(&thumb_file));
            }
        }
    }

    // 3. Ask CUE4Parse Worker daemon (uses instant O(1) texture dictionary)
    ensure_daemon_alive(&app, &extractor_state, &state).await?;

    let req_id = format!("thumb_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0));
    let cmd_json = json!({
        "cmd": "get_thumbnail",
        "id": req_id,
        "cg_name": clean_cg_name,
        "cg_file": cg_file,
        "gender": gender,
        "output_dir": cache_dir.to_string_lossy(),
    });

    let (tx, rx) = oneshot::channel();
    {
        let mut manager_lock = extractor_state.0.lock().await;
        if let Some(manager) = manager_lock.as_mut() {
            manager.pending.lock().await.insert(req_id.clone(), tx);
            let line = format!("{}\n", cmd_json);
            manager.stdin.write_all(line.as_bytes()).await.map_err(|e| e.to_string())?;
            manager.stdin.flush().await.map_err(|e| e.to_string())?;
        } else {
            return Err("Extractor daemon not available".into());
        }
    }

    let response = tokio::time::timeout(Duration::from_secs(15), rx)
        .await
        .map_err(|_| "Thumbnail extraction timed out".to_string())?
        .map_err(|_| "Daemon channel dropped".to_string())?;

    if let Some(status) = response.get("status").and_then(|s| s.as_str()) {
        if status == "ok" {
            if let Some(path_str) = response.get("path").and_then(|p| p.as_str()) {
                let p = PathBuf::from(path_str);
                if p.exists() && fs::metadata(&p).map(|m| m.len() >= 3500).unwrap_or(false) {
                    return Ok(canonical_path_string(&p));
                }
            }
            if let Some(base64) = response.get("base64").and_then(|b| b.as_str()) {
                return Ok(base64.to_string());
            }
        } else if status == "not_found" {
            if let Ok(mut neg_cache) = get_negative_thumb_cache().write() {
                neg_cache.insert(clean_cg_name.to_string());
            }
            return Err("Thumbnail not found".into());
        }
    }

    if let Ok(mut neg_cache) = get_negative_thumb_cache().write() {
        neg_cache.insert(clean_cg_name.to_string());
    }
    Err("Thumbnail not found".into())
}

pub async fn extract_wem_batch_internal(
    app: &AppHandle,
    extractor_state: &ExtractorState,
    config_state: &ConfigState,
    wem_ids: Vec<String>,
    output_dir: &Path,
    locale: &str,
) -> Result<usize, String> {
    if wem_ids.is_empty() {
        return Ok(0);
    }

    ensure_daemon_alive(app, extractor_state, config_state).await?;

    let req_id = format!("wem_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0));
    let cmd_json = json!({
        "cmd": "extract_wem_batch",
        "id": req_id,
        "wems": wem_ids,
        "output_dir": output_dir.to_string_lossy().to_string(),
        "locale": locale
    });

    let (tx, rx) = oneshot::channel();
    {
        let mut manager_lock = extractor_state.0.lock().await;
        if let Some(manager) = manager_lock.as_mut() {
            manager.pending.lock().await.insert(req_id.clone(), tx);
            let line = format!("{}\n", cmd_json);
            manager.stdin.write_all(line.as_bytes()).await.map_err(|e| e.to_string())?;
            manager.stdin.flush().await.map_err(|e| e.to_string())?;
        } else {
            return Err("Extractor daemon not available".into());
        }
    }

    let response = tokio::time::timeout(Duration::from_secs(15), rx)
        .await
        .map_err(|_| "WEM batch extraction timed out".to_string())?
        .map_err(|_| "Daemon channel dropped".to_string())?;

    let count = response.get("extracted_count").and_then(|c| c.as_u64()).unwrap_or(0) as usize;
    Ok(count)
}

#[tauri::command]
pub async fn extract_wem_batch(
    app: AppHandle,
    state: tauri::State<'_, ConfigState>,
    extractor_state: tauri::State<'_, ExtractorState>,
    wems: Vec<String>,
    output_dir: String,
    locale: String,
) -> Result<usize, String> {
    extract_wem_batch_internal(&app, &extractor_state, &state, wems, &PathBuf::from(output_dir), &locale).await
}


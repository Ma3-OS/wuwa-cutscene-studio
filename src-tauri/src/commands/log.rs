use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

static LOG_FILE_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);
static LOG_WRITE_LOCK: Mutex<()> = Mutex::new(());

/// Formats current UTC timestamp as YYYY-MM-DD HH:MM:SS.mmm without external crate dependencies
fn current_timestamp() -> String {
    let now = std::time::SystemTime::now();
    let d = now.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    let total_secs = d.as_secs();
    let millis = d.subsec_millis();

    let sec = total_secs % 60;
    let min = (total_secs / 60) % 60;
    let hour = (total_secs / 3600) % 24;

    let mut days = total_secs / 86400;
    let mut year = 1970;
    loop {
        let leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
        let days_in_year = if leap { 366 } else { 365 };
        if days < days_in_year {
            break;
        }
        days -= days_in_year;
        year += 1;
    }

    let leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
    let days_in_months = [
        31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ];
    let mut month = 1;
    for &dim in &days_in_months {
        if days < dim {
            break;
        }
        days -= dim;
        month += 1;
    }
    let day = days + 1;

    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}.{:03}",
        year, month, day, hour, min, sec, millis
    )
}

/// Redacts sensitive information from log messages:
/// - Masks Windows username and user profile paths
/// - Redacts 64-character hex strings (AES keys)
/// - Normalizes paths to remove personal identity traces
pub fn sanitize_log_message(msg: &str) -> String {
    let mut sanitized = msg.to_string();

    // 1. Redact Windows USERPROFILE / HOME directory
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        if !userprofile.is_empty() {
            let userprofile_forward = userprofile.replace('\\', "/");
            sanitized = sanitized.replace(&userprofile, "~USER~");
            sanitized = sanitized.replace(&userprofile_forward, "~USER~");
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        if !home.is_empty() {
            let home_forward = home.replace('\\', "/");
            sanitized = sanitized.replace(&home, "~USER~");
            sanitized = sanitized.replace(&home_forward, "~USER~");
        }
    }

    // 2. Redact username explicitly (e.g. C:\Users\<username> -> C:\Users\***)
    if let Ok(username) = std::env::var("USERNAME") {
        if !username.is_empty() && username.len() > 1 {
            sanitized = sanitized.replace(&username, "***");
        }
    }

    // 3. Redact AES key hex strings (64 hex characters or 0x + 64 hex characters)
    let words: Vec<&str> = sanitized.split_whitespace().collect();
    let mut replaced_words = Vec::new();
    for word in words {
        let clean = word.trim_matches(|c: char| !c.is_alphanumeric());
        let is_aes_hex = (clean.len() == 64 && clean.chars().all(|c| c.is_ascii_hexdigit()))
            || (clean.starts_with("0x") && clean.len() == 66 && clean[2..].chars().all(|c| c.is_ascii_hexdigit()));

        if is_aes_hex {
            replaced_words.push("[REDACTED_KEY]");
        } else {
            replaced_words.push(word);
        }
    }
    sanitized = replaced_words.join(" ");

    sanitized
}

/// Helper to get compact timestamp string YYYYMMDD_HHMMSS
fn compact_timestamp() -> String {
    let now = std::time::SystemTime::now();
    let d = now.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    let total_secs = d.as_secs();

    let sec = total_secs % 60;
    let min = (total_secs / 60) % 60;
    let hour = (total_secs / 3600) % 24;

    let mut days = total_secs / 86400;
    let mut year = 1970;
    loop {
        let leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
        let days_in_year = if leap { 366 } else { 365 };
        if days < days_in_year {
            break;
        }
        days -= days_in_year;
        year += 1;
    }

    let leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
    let days_in_months = [
        31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ];
    let mut month = 1;
    for &dim in &days_in_months {
        if days < dim {
            break;
        }
        days -= dim;
        month += 1;
    }
    let day = days + 1;

    format!(
        "{:04}{:02}{:02}_{:02}{:02}{:02}",
        year, month, day, hour, min, sec
    )
}

pub fn get_log_dir(_app: &AppHandle) -> PathBuf {
    let log_dir = crate::config::get_project_root().join("logs");
    let _ = fs::create_dir_all(&log_dir);
    log_dir
}

/// Initialize the persistent file logger with session rotation
pub fn init_logger(app: &AppHandle) {
    let log_dir = get_log_dir(app);
    let log_path = log_dir.join("studio_debug.log");

    {
        let mut lock = LOG_FILE_PATH.lock().unwrap();
        *lock = Some(log_path.clone());
    }

    // Session Rotation: If previous studio_debug.log exists and has content, archive it
    if let Ok(meta) = fs::metadata(&log_path) {
        if meta.len() > 0 {
            let archive_dir = log_dir.join("archive");
            let _ = fs::create_dir_all(&archive_dir);
            let archive_filename = format!("studio_debug_{}.log", compact_timestamp());
            let archive_path = archive_dir.join(archive_filename);
            let _ = fs::rename(&log_path, &archive_path);

            // Prune archive to keep only the 5 most recent session logs
            if let Ok(entries) = fs::read_dir(&archive_dir) {
                let mut log_files: Vec<PathBuf> = entries
                    .flatten()
                    .map(|e| e.path())
                    .filter(|p| p.is_file() && p.extension().and_then(|s| s.to_str()) == Some("log"))
                    .collect();

                log_files.sort_by(|a, b| b.cmp(a)); // Sort descending (newest first)
                if log_files.len() > 5 {
                    for old_file in log_files.into_iter().skip(5) {
                        let _ = fs::remove_file(old_file);
                    }
                }
            }
        }
    }

    // Write fresh session banner
    let sanitized_log_path = sanitize_log_message(&log_path.to_string_lossy());
    let banner = format!(
        "================================================================================\n\
         [{}] [INFO] [SYSTEM] WuWa Cutscene Studio Session Initialized\n\
         [{}] [INFO] [SYSTEM] Log File: {}\n\
         ================================================================================\n",
        current_timestamp(),
        current_timestamp(),
        sanitized_log_path
    );

    let _guard = LOG_WRITE_LOCK.lock().unwrap();
    if let Ok(mut file) = OpenOptions::new().create(true).write(true).truncate(true).open(&log_path) {
        let _ = file.write_all(banner.as_bytes());
        let _ = file.flush();
    }
}

/// Core function to write a formatted line to the persistent log file
pub fn write_to_log_file(level: &str, component: &str, sanitized_msg: &str) {
    let path = {
        let lock = LOG_FILE_PATH.lock().unwrap();
        lock.clone()
    };

    if let Some(log_path) = path {
        let line = format!(
            "[{}] [{}] [{}] {}\n",
            current_timestamp(),
            level.to_uppercase(),
            component.to_uppercase(),
            sanitized_msg
        );

        let _guard = LOG_WRITE_LOCK.lock().unwrap();
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) {
            let _ = file.write_all(line.as_bytes());
            let _ = file.flush();
        }
    }
}

/// Emit log to frontend and record to persistent sanitized log file
pub fn emit_log(app: &AppHandle, message: &str) {
    emit_log_with_level(app, "info", "BACKEND", message);
}

/// Emit log with specific level and component to frontend and persistent file
pub fn emit_log_with_level(app: &AppHandle, level: &str, component: &str, message: &str) {
    let sanitized = sanitize_log_message(message);

    // Write to persistent file
    write_to_log_file(level, component, &sanitized);

    // Emit to frontend event
    let _ = app.emit("backend-log", &sanitized);
}

#[tauri::command]
pub fn log_client_event(
    _app: AppHandle,
    level: String,
    component: String,
    message: String,
) -> Result<(), String> {
    let sanitized = sanitize_log_message(&message);
    write_to_log_file(&level, &component, &sanitized);
    // Explicitly do not emit backend-log event to prevent infinite UI-Backend reflection loop
    Ok(())
}

#[tauri::command]
pub fn get_log_file_path(app: AppHandle) -> Result<String, String> {
    let log_path = get_log_dir(&app).join("studio_debug.log");
    Ok(log_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_log_file(app: AppHandle, max_lines: Option<usize>) -> Result<String, String> {
    let log_path = get_log_dir(&app).join("studio_debug.log");

    if !log_path.exists() {
        return Ok("No log records found yet.".to_string());
    }

    let mut file = File::open(&log_path).map_err(|e| e.to_string())?;
    let mut content = String::new();
    file.read_to_string(&mut content).map_err(|e| e.to_string())?;

    let limit = max_lines.unwrap_or(500);
    let lines: Vec<&str> = content.lines().collect();
    if lines.len() > limit {
        let sliced = &lines[lines.len() - limit..];
        Ok(sliced.join("\n"))
    } else {
        Ok(content)
    }
}

#[tauri::command]
pub fn clear_log_file(app: AppHandle) -> Result<(), String> {
    let log_path = get_log_dir(&app).join("studio_debug.log");

    if log_path.exists() {
        let _guard = LOG_WRITE_LOCK.lock().unwrap();
        let _ = fs::write(&log_path, "");
    }
    emit_log(&app, "Log file cleared by user request.");
    Ok(())
}

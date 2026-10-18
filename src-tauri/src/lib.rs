#![allow(warnings)]
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::Manager;

mod config;
pub mod commands;
pub mod errors;
pub mod core;
pub mod subtitles;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            config::init_config(app.handle());
            commands::log::init_logger(app.handle());
            commands::scanner::purge_black_thumbnails_on_startup(app.handle());
            app.manage(commands::extractor::ExtractorState(Arc::new(Mutex::new(None))));
            app.manage(commands::renderer::RenderState(Arc::new(Mutex::new(Vec::new()))));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config::get_config,
            config::update_config,
            config::get_default_paths,
            commands::downloader::download_tools,
            commands::downloader::download_data,
            commands::wwiser::run_wwiser,
            commands::status::check_dependencies,
            commands::status::open_folder,
            commands::status::open_file,
            commands::status::show_in_folder,
            commands::status::open_media_external,
            commands::status::open_output_dir,
            commands::status::open_source_folder,
            commands::status::get_cache_size,
            commands::status::clear_app_cache,
            commands::status::get_storage_breakdown,
            commands::status::clear_project_cache,
            commands::status::system_power_action,
            commands::status::app_minimize,
            commands::status::app_toggle_maximize,
            commands::status::app_close,
            commands::status::app_is_maximized,
            commands::status::app_start_dragging,
            commands::generator::generate_single_video_info,
            commands::generator::get_video_audio_event,
            commands::generator::search_dialogue,
            commands::generator::get_cutscene_dialogue,
            commands::generator::export_subtitles_bundle,
            commands::renderer::render_video,
            commands::renderer::cancel_render,
            commands::scanner::get_exported_videos,
            commands::scanner::scan_audio_banks,
            commands::scanner::get_video_thumbnail,
            commands::scanner::get_video_meta,
            commands::scanner::is_game_running,
            commands::scanner::detect_game_path,
            commands::extractor::detect_game_environment,
            commands::extractor::start_extractor_daemon,
            commands::extractor::extract_cutscene_on_demand,
            commands::extractor::cancel_extraction,
            commands::extractor::extract_wem_batch,
            commands::extractor::dump_local_configdb,
            commands::extractor::get_full_catalog_with_status,
            commands::extractor::get_cutscene_thumbnail,
            commands::extractor::clear_video_index_cache,
            commands::log::log_client_event,
            commands::log::get_log_file_path,
            commands::log::read_log_file,
            commands::log::clear_log_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

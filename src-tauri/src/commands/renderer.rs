use std::fs;
use std::path::{PathBuf};
use std::process::Command;
use tauri::AppHandle;

use crate::commands::downloader::get_tools_dir;
use crate::commands::generator::VideoInfo;
use crate::commands::log::emit_log;

use crate::config::ConfigState;

fn hex_to_ass_color(hex: &str) -> String {
    let clean = hex.trim_start_matches('#');
    if clean.len() == 6 {
        let r = &clean[0..2];
        let g = &clean[2..4];
        let b = &clean[4..6];
        format!("&H00{}{}{}", b, g, r)
    } else {
        "&H00FFFFFF".to_string()
    }
}

#[tauri::command]
pub async fn render_video(
    app: AppHandle,
    state: tauri::State<'_, ConfigState>,
    video_info: VideoInfo,
    subtitle_mode: String,
) -> Result<String, String> {
    let config = state.0.lock().unwrap().clone();
    let tools_dir = get_tools_dir(&app);
    let vgmstream_exe = tools_dir.join("vgmstream-cli.exe");
    let ffmpeg_exe = tools_dir.join("ffmpeg.exe");

    if !vgmstream_exe.exists() { return Err("vgmstream-cli.exe not found".into()); }
    if !ffmpeg_exe.exists() { return Err("ffmpeg.exe not found".into()); }

    let output_dir = if !config.output_dir.is_empty() {
        PathBuf::from(&config.output_dir)
    } else {
        crate::commands::downloader::get_data_dir(&app).join("output")
    };
    let _ = fs::create_dir_all(&output_dir);

    // 1. Convert txtp to wav
    let mut wav_paths = Vec::new();
    for sound in &video_info.sounds {
        let sound_path = PathBuf::from(sound);
        let wav_name = format!("{}.wav", sound_path.file_stem().unwrap().to_string_lossy());
        let wav_path = output_dir.join(&wav_name);
        
        if !wav_path.exists() {
            emit_log(&app, &format!("Converting {} to wav...", sound_path.file_name().unwrap().to_string_lossy()));
            let output = Command::new(&vgmstream_exe)
                .args(["-o", &wav_path.to_string_lossy(), &sound_path.to_string_lossy()])
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .output()
                .map_err(|e| e.to_string())?;
                
            if !output.status.success() {
                let err = String::from_utf8_lossy(&output.stderr);
                emit_log(&app, &format!("vgmstream error: {}", err));
                return Err(format!("Audio conversion failed for {}", sound_path.display()));
            }
        }
        wav_paths.push(wav_path);
    }
    emit_log(&app, "Audio tracks prepared successfully.");

    // 2. Build FFmpeg command
    let has_sub = video_info.ass_path.is_some() || video_info.srt_path.is_some();
    let is_hardsub = subtitle_mode == "Hard-sub" && has_sub;
    let is_softsub = subtitle_mode == "Soft-sub" && has_sub;
    let is_rescaling = config.render_resolution != "original" && !config.render_resolution.is_empty();

    let out_name = format!("{}_{}_{}.mp4", video_info.cg_name, config.char_selection, config.locale_selection);
    let out_path = output_dir.join(&out_name).to_string_lossy().to_string();

    let srt_path = video_info.srt_path.unwrap_or_default();

    let mut cmd = Command::new(&ffmpeg_exe);
    cmd.arg("-y");
    cmd.args(["-i", &video_info.cg_file]);

    let audio_count = wav_paths.len();
    for wav in &wav_paths {
        cmd.args(["-i", &wav.to_string_lossy()]);
    }

    if is_softsub {
        cmd.args(["-i", &srt_path]);
    }

    // Build filter complex
    let mut filter_parts = Vec::new();
    let mut video_map = "-map 0:v:0".to_string();
    let mut video_codec = vec!["-c:v", "copy"];

    if is_hardsub || is_rescaling {
        let mut v_filter_chain = Vec::new();

        if is_rescaling {
            if config.render_resolution.contains("21:9") || config.render_resolution.contains("2560") || config.render_resolution == "2560x1080" {
                // 21:9 UltraWide fitted to 1920x1080 screen with Letterboxing
                v_filter_chain.push("scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black".to_string());
            } else if config.render_resolution.contains("16:9") || config.render_resolution.contains("1920") || config.render_resolution.contains("1080p") {
                // 16:9 Full Screen: Zoom and Crop to fill full 1920x1080
                v_filter_chain.push("scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080".to_string());
            } else if config.render_resolution.contains("4K") || config.render_resolution.contains("3840") {
                v_filter_chain.push("scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160".to_string());
            }
        }

        if is_hardsub {
            if let Some(ass_file) = &video_info.ass_path {
                let escaped_ass = ass_file.replace('\\', "/").replace(":", "\\:");
                v_filter_chain.push(format!("subtitles='{}':fontsdir='C\\:/Windows/Fonts'", escaped_ass));
            } else {
                let escaped_srt = srt_path.replace('\\', "/").replace(":", "\\:");
                let font_name = if config.sub_font.is_empty() { "Kanit Medium" } else { &config.sub_font };
                let font_size = if config.sub_size == 0 { 38 } else { config.sub_size };
                let outline = if config.sub_outline < 0.0 { 0.0 } else { config.sub_outline };
                let shadow = if config.sub_shadow < 0.0 { 0.0 } else { config.sub_shadow };
                let margin_v = config.sub_margin_v;
                let primary_color = hex_to_ass_color(&config.sub_color);

                let style = format!(
                    "Fontname={},Fontsize={},PrimaryColour={},OutlineColour=&H00000000,BackColour=&H80000000,Outline={:.2},Shadow={:.2},Alignment=2,MarginV={}",
                    font_name, font_size, primary_color, outline, shadow, margin_v
                );
                v_filter_chain.push(format!("subtitles='{}':force_style='{}':fontsdir='C\\:/Windows/Fonts'", escaped_srt, style));
            }
        }

        let combined_v_filter = v_filter_chain.join(",");
        filter_parts.push(format!("[0:v]{}[vout]", combined_v_filter));
        video_map = "-map [vout]".to_string();
        video_codec = vec!["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-threads", "0"];
    }

    let mut audio_map: Option<String> = None;
    let mut audio_codec = vec!["-c:a", "aac", "-b:a", "320k"];

    if audio_count == 1 {
        filter_parts.push("[1:a]aformat=channel_layouts=stereo|5.1|7.1,pan=stereo|c0=c0+0.707*c2+0.707*c4+0.5*c3|c1=c1+0.707*c2+0.707*c5+0.5*c3,aresample=async=1,aformat=channel_layouts=stereo[aout]".to_string());
        audio_map = Some("-map [aout]".to_string());
    } else if audio_count > 1 {
        let mut pre_mix_labels = Vec::new();
        for j in 0..audio_count {
            let in_idx = j + 1;
            let label = format!("a{}", in_idx);
            filter_parts.push(format!(
                "[{}:a]aformat=channel_layouts=stereo|5.1|7.1,pan=stereo|c0=c0+0.707*c2+0.707*c4+0.5*c3|c1=c1+0.707*c2+0.707*c5+0.5*c3,aresample=async=1[{}]",
                in_idx, label
            ));
            pre_mix_labels.push(format!("[{}]", label));
        }
        let amix_inputs = pre_mix_labels.join("");
        filter_parts.push(format!(
            "{}amix=inputs={}:duration=first:normalize=0:dropout_transition=0,dynaudnorm=f=150:g=15,aformat=channel_layouts=stereo[aout]",
            amix_inputs, audio_count
        ));
        audio_map = Some("-map [aout]".to_string());
    }

    if !filter_parts.is_empty() {
        let filter_complex = filter_parts.join(";");
        cmd.args(["-filter_complex", &filter_complex]);
    }

    // Apply video map & codec
    for arg in video_map.split_whitespace() {
        cmd.arg(arg);
    }
    cmd.args(&video_codec);

    // Apply audio map & codec
    if let Some(amap) = audio_map {
        for arg in amap.split_whitespace() {
            cmd.arg(arg);
        }
        cmd.args(&audio_codec);
    }

    // Apply soft-sub map & codec
    if is_softsub {
        let srt_index = 1 + audio_count;
        cmd.args(["-map", &format!("{}:0", srt_index), "-c:s", "mov_text"]);
    }

    cmd.arg("-shortest");
    cmd.arg(&out_path);

    emit_log(&app, &format!("Rendering final video ({}) with FFmpeg...", out_name));

    let output = cmd.output().map_err(|e| e.to_string())?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        emit_log(&app, &format!("FFmpeg error: {}", stderr));
        return Err("Video rendering failed".into());
    }

    emit_log(&app, &format!("Finished {}", out_name));

    // Cleanup temporary wav files
    for wav in wav_paths {
        let _ = fs::remove_file(wav);
    }

    Ok(out_path)
}

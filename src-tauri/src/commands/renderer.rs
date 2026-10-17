use std::fs;
use std::path::{Path, PathBuf};
use tokio::process::Command;
use tauri::AppHandle;

use crate::commands::downloader::get_tools_dir;
use crate::commands::generator::VideoInfo;
use crate::commands::log::emit_log;

use crate::config::ConfigState;

use std::sync::Arc;
use tokio::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

pub struct ActiveRenderHandle {
    pub pid: Option<u32>,
    pub partial_file: Option<PathBuf>,
    pub is_cancelled: Arc<AtomicBool>,
}

pub struct RenderState(pub Arc<Mutex<Option<ActiveRenderHandle>>>);

fn hex_to_ass_color(hex: &str) -> String {
    let clean = hex.trim_start_matches('#');
    if clean.len() == 6 && clean.chars().all(|c| c.is_ascii_hexdigit()) {
        let r = &clean[0..2];
        let g = &clean[2..4];
        let b = &clean[4..6];
        format!("&H00{}{}{}", b, g, r)
    } else {
        "&H00FFFFFF".to_string()
    }
}

fn sanitize_ffmpeg_path(path_str: &str) -> String {
    path_str
        .replace('\\', "/")
        .replace(':', "\\:")
        .replace('\'', "'\\''")
        .replace('[', "\\[")
        .replace(']', "\\]")
        .replace(';', "\\;")
        .replace(',', "\\,")
}

fn sanitize_font_name(font: &str) -> String {
    font.chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-' || *c == '_')
        .collect()
}

fn get_system_fonts_dir_escaped() -> String {
    let windir = std::env::var("WINDIR")
        .or_else(|_| std::env::var("SystemRoot"))
        .unwrap_or_else(|_| {
            let sysdrive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".to_string());
            format!("{}\\Windows", sysdrive)
        });
    let fonts_path = format!("{}/Fonts", windir.replace('\\', "/"));
    sanitize_ffmpeg_path(&fonts_path)
}

#[tauri::command]
pub async fn cancel_render(
    app: AppHandle,
    render_state: tauri::State<'_, RenderState>,
) -> Result<(), String> {
    let mut lock = render_state.0.lock().await;
    if let Some(handle) = lock.take() {
        handle.is_cancelled.store(true, Ordering::SeqCst);
        if let Some(pid) = handle.pid {
            emit_log(&app, &format!("กำลังสั่งหยุดโพรเซสเรนเดอร์หมายเลข {}", pid));
            #[cfg(target_os = "windows")]
            {
                let _ = std::process::Command::new("taskkill")
                    .args(["/F", "/T", "/PID", &pid.to_string()])
                    .output();
            }
            #[cfg(not(target_os = "windows"))]
            {
                let _ = std::process::Command::new("kill")
                    .args(["-9", &pid.to_string()])
                    .output();
            }
        }
        if let Some(partial) = handle.partial_file {
            if partial.exists() {
                let _ = fs::remove_file(&partial);
                emit_log(&app, "ลบไฟล์วิดีโอชั่วคราวที่ไม่สมบูรณ์เรียบร้อยแล้ว");
            }
        }
    }
    emit_log(&app, "ยกเลิกการเรนเดอร์เรียบร้อยแล้ว");
    Ok(())
}

static DETECTED_ENCODER: OnceLock<String> = OnceLock::new();

pub fn probe_video_encoder(ffmpeg_exe: &Path) -> &'static str {
    DETECTED_ENCODER.get_or_init(|| {
        let candidates = ["h264_nvenc", "h264_amf", "h264_qsv"];
        for enc in candidates {
            let mut probe = std::process::Command::new(ffmpeg_exe);
            probe.args([
                "-v", "error",
                "-f", "lavfi",
                "-i", "color=c=black:s=64x64:d=0.04",
                "-frames:v", "1",
                "-c:v", enc,
                "-f", "null",
                "-",
            ]);
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                probe.creation_flags(0x08000000);
            }
            if let Ok(status) = probe.status() {
                if status.success() {
                    return enc.to_string();
                }
            }
        }
        "libx264".to_string()
    }).as_str()
}

fn build_ffmpeg_args(
    cg_file: &str,
    wav_paths: &[PathBuf],
    srt_path: &str,
    is_softsub: bool,
    filter_complex: Option<&str>,
    video_map: &str,
    video_codec: &[&str],
    audio_map: Option<&str>,
    audio_codec: &[&str],
    out_path: &str,
) -> Vec<String> {
    let mut args = Vec::new();
    args.push("-y".to_string());
    args.push("-i".to_string());
    args.push(cg_file.to_string());

    for wav in wav_paths {
        args.push("-i".to_string());
        args.push(wav.to_string_lossy().to_string());
    }

    if is_softsub {
        args.push("-i".to_string());
        args.push(srt_path.to_string());
    }

    if let Some(fc) = filter_complex {
        args.push("-filter_complex".to_string());
        args.push(fc.to_string());
    }

    for arg in video_map.split_whitespace() {
        args.push(arg.to_string());
    }
    for vc in video_codec {
        args.push(vc.to_string());
    }

    if let Some(amap) = audio_map {
        for arg in amap.split_whitespace() {
            args.push(arg.to_string());
        }
        for ac in audio_codec {
            args.push(ac.to_string());
        }
    }

    if is_softsub {
        let srt_index = 1 + wav_paths.len();
        args.push("-map".to_string());
        args.push(format!("{}:0", srt_index));
        args.push("-c:s".to_string());
        args.push("mov_text".to_string());
    }

    args.push("-shortest".to_string());
    args.push(out_path.to_string());
    args
}

async fn generate_smart_thumbnail(
    ffmpeg_exe: &Path,
    video_path: &Path,
    target_thumb_path: &Path,
) -> bool {
    if let Some(p) = target_thumb_path.parent() {
        let _ = fs::create_dir_all(p);
    }
    let seek_points = ["00:00:03.500", "00:00:07.000", "00:00:01.000"];
    for seek in seek_points {
        let mut cmd = Command::new(ffmpeg_exe);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }
        let res = cmd
            .args([
                "-y",
                "-ss", seek,
                "-i", &video_path.to_string_lossy(),
                "-vf", "scale=480:-1",
                "-vframes", "1",
                "-q:v", "4",
                &target_thumb_path.to_string_lossy(),
            ])
            .output()
            .await;
        if res.is_ok()
            && target_thumb_path.exists()
            && fs::metadata(target_thumb_path).map(|m| m.len() >= 3500).unwrap_or(false)
        {
            return true;
        }
    }
    false
}

#[tauri::command]
pub async fn render_video(
    app: AppHandle,
    state: tauri::State<'_, ConfigState>,
    render_state: tauri::State<'_, RenderState>,
    video_info: VideoInfo,
    subtitle_mode: String,
) -> Result<String, String> {
    let config = state.0.lock().unwrap().clone();
    let tools_dir = get_tools_dir(&app);
    
    // Priority 1: User-configured custom path -> Priority 2: Project root tools dir
    let vgmstream_exe = if !config.vgmstream_path.is_empty() && Path::new(&config.vgmstream_path).exists() {
        PathBuf::from(&config.vgmstream_path)
    } else {
        tools_dir.join("vgmstream-cli.exe")
    };

    let ffmpeg_exe = if !config.ffmpeg_path.is_empty() && Path::new(&config.ffmpeg_path).exists() {
        PathBuf::from(&config.ffmpeg_path)
    } else {
        tools_dir.join("ffmpeg.exe")
    };

    if !vgmstream_exe.exists() { 
        return Err(format!("vgmstream-cli.exe not found. Please download tools or specify path in Settings. (Checked: {})", vgmstream_exe.display())); 
    }
    if !ffmpeg_exe.exists() { 
        return Err(format!("ffmpeg.exe not found. Please download tools or specify path in Settings. (Checked: {})", ffmpeg_exe.display())); 
    }

    // Save strictly to project render directory
    let output_dir = config.get_effective_render_dir();
    let _ = fs::create_dir_all(&output_dir);

    // 1. Convert txtp/wem to wav in parallel using tokio::task::JoinSet
    let temp_audio_dir = crate::config::get_project_root().join("cache").join("temp_audio");
    let _ = fs::create_dir_all(&temp_audio_dir);

    let is_cancelled = Arc::new(AtomicBool::new(false));
    {
        let mut lock = render_state.0.lock().await;
        *lock = Some(ActiveRenderHandle {
            pid: None,
            partial_file: None,
            is_cancelled: is_cancelled.clone(),
        });
    }

    let mut set = tokio::task::JoinSet::new();
    for sound in &video_info.sounds {
        if is_cancelled.load(Ordering::SeqCst) {
            let mut lock = render_state.0.lock().await;
            *lock = None;
            return Err("CANCELLED".into());
        }

        let sound_path = PathBuf::from(sound);
        let vgm_exe = vgmstream_exe.clone();
        let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
        let wav_name = format!("{}_{}.wav", ts, sound_path.file_stem().unwrap_or_default().to_string_lossy());
        let wav_path = temp_audio_dir.join(&wav_name);
        let cancel = is_cancelled.clone();

        set.spawn(async move {
            if cancel.load(Ordering::SeqCst) {
                return Err("CANCELLED".to_string());
            }
            let mut vgm_cmd = Command::new(&vgm_exe);
            if let Some(parent) = sound_path.parent() {
                vgm_cmd.current_dir(parent);
            }
            vgm_cmd.args(["-o", &wav_path.to_string_lossy(), &sound_path.to_string_lossy()]);
            vgm_cmd.kill_on_drop(true);
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                vgm_cmd.creation_flags(0x08000000);
            }
            let output = vgm_cmd.output().await.map_err(|e| e.to_string())?;
            if !output.status.success() {
                let err = String::from_utf8_lossy(&output.stderr);
                return Err(format!("Audio conversion failed for {}: {}", sound_path.display(), err));
            }
            Ok(wav_path)
        });
    }

    let mut wav_paths = Vec::new();
    while let Some(res) = set.join_next().await {
        match res {
            Ok(Ok(wav)) => wav_paths.push(wav),
            Ok(Err(e)) => {
                emit_log(&app, &format!("ข้ามแทร็กเสียงที่ไม่สมบูรณ์ {}", e));
            }
            Err(join_err) => {
                emit_log(&app, &format!("เกิดข้อผิดพลาดกับแทร็กเสียงคู่ขนาน {}", join_err));
            }
        }
    }
    if wav_paths.is_empty() && !video_info.sounds.is_empty() {
        let mut lock = render_state.0.lock().await;
        *lock = None;
        return Err("ไม่สามารถแปลงแทร็กเสียงใดๆ ได้เลย กรุณาตรวจสอบไฟล์เสียง".into());
    }
    wav_paths.sort();
    emit_log(&app, "เตรียมสตรีมเสียงแบบคู่ขนานสำเร็จ");

    // 2. Build FFmpeg command with Hardware Acceleration Probe
    let has_sub = video_info.ass_path.is_some() || video_info.srt_path.is_some();
    let is_hardsub = subtitle_mode == "Hard-sub" && has_sub;
    let is_softsub = subtitle_mode == "Soft-sub" && has_sub;
    let is_rescaling = config.render_resolution != "original" && !config.render_resolution.is_empty();

    let safe_cg_name: String = video_info.cg_name.chars().filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-').collect();
    let char_to_use = if !video_info.girl_or_boy.is_empty() {
        &video_info.girl_or_boy
    } else if !config.char_selection.is_empty() {
        &config.char_selection
    } else {
        "Rover"
    };
    let safe_char: String = char_to_use.chars().filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-').collect();
    let safe_locale: String = config.locale_selection.chars().filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-').collect();
    let out_name = format!("{}_{}_{}.mp4", 
        if safe_cg_name.is_empty() { "cutscene" } else { &safe_cg_name },
        if safe_char.is_empty() { "Rover" } else { &safe_char },
        if safe_locale.is_empty() { "ja" } else { &safe_locale }
    );
    let out_path = output_dir.join(&out_name).to_string_lossy().to_string();

    let srt_path = video_info.srt_path.unwrap_or_default();
    let proj_root = crate::config::get_project_root();

    // Probe hardware encoder
    let detected_encoder = probe_video_encoder(&ffmpeg_exe);
    emit_log(&app, &format!("ตรวจพบตัวเข้ารหัสวิดีโอ {}", detected_encoder));

    let mut filter_parts = Vec::new();
    let mut video_map = "-map 0:v:0".to_string();
    let mut video_codec = vec!["-c:v", "copy"];

    if is_hardsub || is_rescaling {
        let mut v_filter_chain = Vec::new();

        if is_rescaling {
            if config.render_resolution.contains("9:16") || config.render_resolution.contains("1080x1920") || config.render_resolution.contains("vertical") {
                v_filter_chain.push("split[v0][v1];[v0]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg];[v1]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1".to_string());
            } else if config.render_resolution.contains("zoom") || config.render_resolution.contains("crop") {
                v_filter_chain.push("scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1".to_string());
            } else if config.render_resolution.contains("21:9") || config.render_resolution.contains("2560x1080") {
                v_filter_chain.push("scale=2560:1080:force_original_aspect_ratio=decrease,pad=2560:1080:(ow-iw)/2:(oh-ih)/2,setsar=1".to_string());
            } else if config.render_resolution.contains("4K") || config.render_resolution.contains("3840") {
                v_filter_chain.push("scale=3840:2160:force_original_aspect_ratio=decrease,pad=3840:2160:(ow-iw)/2:(oh-ih)/2,setsar=1".to_string());
            } else if config.render_resolution.contains("2560x1440") || config.render_resolution.contains("2K") {
                v_filter_chain.push("scale=2560:1440:force_original_aspect_ratio=decrease,pad=2560:1440:(ow-iw)/2:(oh-ih)/2,setsar=1".to_string());
            } else if config.render_resolution.contains("1280x720") || config.render_resolution.contains("720") {
                v_filter_chain.push("scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1".to_string());
            } else {
                v_filter_chain.push("scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1".to_string());
            }
        }

        // Subtitles filter placed strictly AFTER pad for native sharpness and clean rendering over black bars
        if is_hardsub {
            let fontsdir = if proj_root.join("fonts").exists() {
                "fonts".to_string()
            } else {
                get_system_fonts_dir_escaped()
            };

            if let Some(ass_file) = &video_info.ass_path {
                let p = Path::new(ass_file);
                let escaped_ass = if let Ok(rel) = p.strip_prefix(&proj_root) {
                    rel.to_string_lossy().replace('\\', "/")
                } else {
                    sanitize_ffmpeg_path(ass_file)
                };
                v_filter_chain.push(format!("subtitles='{}':fontsdir='{}'", escaped_ass, fontsdir));
            } else {
                let p = Path::new(&srt_path);
                let escaped_srt = if let Ok(rel) = p.strip_prefix(&proj_root) {
                    rel.to_string_lossy().replace('\\', "/")
                } else {
                    sanitize_ffmpeg_path(&srt_path)
                };
                let raw_font = if config.sub_font.is_empty() { "Kanit Medium" } else { &config.sub_font };
                let font_name = sanitize_font_name(raw_font);
                let font_size = if config.sub_size == 0 { 38 } else { config.sub_size };
                let outline = if config.sub_outline < 0.0 { 0.0 } else { config.sub_outline };
                let shadow = if config.sub_shadow < 0.0 { 0.0 } else { config.sub_shadow };
                let margin_v = config.sub_margin_v;
                let primary_color = hex_to_ass_color(&config.sub_color);

                let style = format!(
                    "Fontname={},Fontsize={},PrimaryColour={},OutlineColour=&H00000000,BackColour=&H80000000,Outline={:.2},Shadow={:.2},Alignment=2,MarginV={}",
                    font_name, font_size, primary_color, outline, shadow, margin_v
                );
                v_filter_chain.push(format!("subtitles='{}':force_style='{}':fontsdir='{}'", escaped_srt, style, fontsdir));
            }
        }

        let combined_v_filter = v_filter_chain.join(",");
        filter_parts.push(format!("[0:v]{}[vout]", combined_v_filter));
        video_map = "-map [vout]".to_string();

        video_codec = match detected_encoder {
            "h264_nvenc" => vec!["-c:v", "h264_nvenc", "-preset", "p5", "-cq", "19", "-pix_fmt", "yuv420p"],
            "h264_amf" => vec!["-c:v", "h264_amf", "-quality", "quality", "-rc", "cqp", "-qp_i", "19", "-qp_p", "19", "-pix_fmt", "yuv420p"],
            "h264_qsv" => vec!["-c:v", "h264_qsv", "-global_quality", "19", "-pix_fmt", "yuv420p"],
            _ => vec!["-c:v", "libx264", "-preset", "superfast", "-crf", "18", "-pix_fmt", "yuv420p", "-threads", "0"],
        };
    }

    let audio_count = wav_paths.len();
    let voice_multiplier = (config.voice_volume as f32 / 100.0).max(0.0).min(3.0);
    let bgm_multiplier = (config.bgm_volume as f32 / 100.0).max(0.0).min(3.0);
    let bitrate_str = if config.audio_bitrate.is_empty() { "320k" } else { &config.audio_bitrate };

    let mut audio_map: Option<String> = None;
    let mut audio_codec = vec!["-c:a", "aac", "-b:a", bitrate_str];

    if audio_count == 1 {
        let sound_name = wav_paths.first().and_then(|p| p.file_name()).map(|s| s.to_string_lossy().to_lowercase()).unwrap_or_default();
        let is_bgm_track = sound_name.contains("_music")
            || sound_name.contains("_lyric")
            || sound_name.contains("bgm")
            || sound_name.contains("music")
            || sound_name.contains("song");
        let vol = if is_bgm_track { bgm_multiplier } else { voice_multiplier };

        filter_parts.push(format!(
            "[1:a]volume={:.2},aformat=channel_layouts=stereo|5.1|7.1,pan=stereo|c0=c0+0.707*c2+0.707*c4+0.5*c3|c1=c1+0.707*c2+0.707*c5+0.5*c3,aresample=async=1000:min_hard_comp=0.100000:first_pts=0,aformat=channel_layouts=stereo[aout]",
            vol
        ));
        audio_map = Some("-map [aout]".to_string());
    } else if audio_count > 1 {
        let mut pre_mix_labels = Vec::new();
        for j in 0..audio_count {
            let in_idx = j + 1;
            let label = format!("a{}", in_idx);
            let sound_name = wav_paths.get(j).and_then(|p| p.file_name()).map(|s| s.to_string_lossy().to_lowercase()).unwrap_or_default();
            let is_bgm_track = sound_name.contains("_music")
                || sound_name.contains("_lyric")
                || sound_name.contains("bgm")
                || sound_name.contains("music")
                || sound_name.contains("song");
            let vol = if is_bgm_track { bgm_multiplier } else { voice_multiplier };

            filter_parts.push(format!(
                "[{}:a]volume={:.2},aformat=channel_layouts=stereo|5.1|7.1,pan=stereo|c0=c0+0.707*c2+0.707*c4+0.5*c3|c1=c1+0.707*c2+0.707*c5+0.5*c3,aresample=async=1000:min_hard_comp=0.100000:first_pts=0[{}]",
                in_idx, vol, label
            ));
            pre_mix_labels.push(format!("[{}]", label));
        }
        let amix_inputs = pre_mix_labels.join("");
        filter_parts.push(format!(
            "{}amix=inputs={}:duration=longest:normalize=0:dropout_transition=0,dynaudnorm=f=150:g=15,aformat=channel_layouts=stereo[aout]",
            amix_inputs, audio_count
        ));
        audio_map = Some("-map [aout]".to_string());
    } else {
        emit_log(&app, "คำเตือน: ไม่พบแทร็กเสียงสำหรับคัตซีนนี้ คลิปที่เรนเดอร์อาจไม่มีเสียง");
        audio_map = Some("-map 0:a:0?".to_string());
        audio_codec = vec!["-c:a", "copy"];
    }

    let filter_complex_str = if !filter_parts.is_empty() {
        Some(filter_parts.join(";"))
    } else {
        None
    };

    let validated_input = crate::commands::generator::heal_and_validate_video_path(
        &video_info.cg_file,
        &app,
        Some(&video_info.cg_name),
    ).map_err(|e| format!("Input video verification failed: {}", e))?;

    if !validated_input.is_file() {
        return Err(format!("Input video is not a valid file: {}", validated_input.display()));
    }
    let validated_input_str = validated_input.to_string_lossy().to_string();

    let args = build_ffmpeg_args(
        &validated_input_str,
        &wav_paths,
        &srt_path,
        is_softsub,
        filter_complex_str.as_deref(),
        &video_map,
        &video_codec,
        audio_map.as_deref(),
        &audio_codec,
        &out_path,
    );

    let mut cmd = Command::new(&ffmpeg_exe);
    cmd.current_dir(&proj_root);
    cmd.kill_on_drop(true);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    cmd.args(&args);

    emit_log(&app, &format!("กำลังเรนเดอร์วิดีโอ {} ด้วย FFmpeg", out_name));

    if is_cancelled.load(Ordering::SeqCst) {
        for wav in &wav_paths {
            let _ = fs::remove_file(wav);
        }
        let mut lock = render_state.0.lock().await;
        *lock = None;
        return Err("CANCELLED".into());
    }

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let pid = child.id();

    {
        let mut lock = render_state.0.lock().await;
        *lock = Some(ActiveRenderHandle {
            pid,
            partial_file: Some(PathBuf::from(&out_path)),
            is_cancelled: is_cancelled.clone(),
        });
    }

    let mut output_res = child.wait_with_output().await;

    // Auto-fallback: if hardware encoder failed and we didn't cancel, retry with libx264
    if let Ok(ref out) = output_res {
        if !out.status.success() && detected_encoder != "libx264" && !is_cancelled.load(Ordering::SeqCst) {
            emit_log(&app, "การเรนเดอร์ด้วยฮาร์ดแวร์ขัดข้อง กำลังสลับไปใช้ซีพียู libx264 อัตโนมัติ");
            let fallback_codec = ["-c:v", "libx264", "-preset", "superfast", "-crf", "18", "-pix_fmt", "yuv420p", "-threads", "0"];
            let fallback_args = build_ffmpeg_args(
                &video_info.cg_file,
                &wav_paths,
                &srt_path,
                is_softsub,
                filter_complex_str.as_deref(),
                &video_map,
                &fallback_codec,
                audio_map.as_deref(),
                &audio_codec,
                &out_path,
            );

            let mut fb_cmd = Command::new(&ffmpeg_exe);
            fb_cmd.current_dir(&proj_root);
            fb_cmd.kill_on_drop(true);
            fb_cmd.stdout(std::process::Stdio::piped());
            fb_cmd.stderr(std::process::Stdio::piped());
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                fb_cmd.creation_flags(0x08000000);
            }
            fb_cmd.args(&fallback_args);

            if let Ok(mut fb_child) = fb_cmd.spawn() {
                {
                    let mut lock = render_state.0.lock().await;
                    *lock = Some(ActiveRenderHandle {
                        pid: fb_child.id(),
                        partial_file: Some(PathBuf::from(&out_path)),
                        is_cancelled: is_cancelled.clone(),
                    });
                }
                output_res = fb_child.wait_with_output().await;
            }
        }
    }

    // Reset render state
    {
        let mut lock = render_state.0.lock().await;
        *lock = None;
    }

    // Cleanup temporary wav files
    for wav in wav_paths {
        let _ = fs::remove_file(wav);
    }

    if is_cancelled.load(Ordering::SeqCst) {
        if Path::new(&out_path).exists() {
            let _ = fs::remove_file(&out_path);
        }
        return Err("CANCELLED".into());
    }

    let output = output_res.map_err(|e| e.to_string())?;
    if !output.status.success() {
        if Path::new(&out_path).exists() {
            let _ = fs::remove_file(&out_path);
        }
        let stderr = String::from_utf8_lossy(&output.stderr);
        let err_msg = if !stderr.trim().is_empty() {
            stderr.to_string()
        } else {
            format!("Exit code {:?}, Command arguments: {:?}", output.status.code(), args)
        };
        emit_log(&app, &format!("FFmpeg error: {}", err_msg));
        return Err(format!("Video rendering failed: {}", err_msg));
    }

    emit_log(&app, &format!("เรนเดอร์สำเร็จ {}", out_name));

    // Smart thumbnail generation for completed render
    let thumb_cache_dir = crate::commands::downloader::get_base_dir(&app).join("thumbnails");
    let _ = fs::create_dir_all(&thumb_cache_dir);
    let effective_export = config.get_effective_export_dir();
    let bundle_preview_dir = effective_export.join("cutscenes").join(&video_info.cg_name).join("preview");
    let _ = fs::create_dir_all(&bundle_preview_dir);

    let bundle_thumb = bundle_preview_dir.join("thumbnail.jpg");
    let cache_cg_thumb = thumb_cache_dir.join(format!("thumb_{}.jpg", video_info.cg_name));
    let cache_cg_default = thumb_cache_dir.join(format!("{}.jpg", video_info.cg_name));
    let out_stem = Path::new(&out_name).file_stem().and_then(|s| s.to_str()).unwrap_or(&out_name);
    let cache_out_thumb = thumb_cache_dir.join(format!("thumb_{}.jpg", out_stem));
    let cache_out_plain = thumb_cache_dir.join(format!("{}.jpg", out_stem));
    let original_stem = Path::new(&video_info.cg_file).file_stem().and_then(|s| s.to_str()).unwrap_or(&video_info.cg_name);
    let cache_orig_thumb = thumb_cache_dir.join(format!("thumb_{}.jpg", original_stem));
    let cache_orig_plain = thumb_cache_dir.join(format!("{}.jpg", original_stem));

    let out_video_path = PathBuf::from(&out_path);
    if generate_smart_thumbnail(&ffmpeg_exe, &out_video_path, &cache_cg_thumb).await {
        let _ = fs::copy(&cache_cg_thumb, &bundle_thumb);
        let _ = fs::copy(&cache_cg_thumb, &cache_cg_default);
        let _ = fs::copy(&cache_cg_thumb, &cache_out_thumb);
        let _ = fs::copy(&cache_cg_thumb, &cache_out_plain);
        let _ = fs::copy(&cache_cg_thumb, &cache_orig_thumb);
        let _ = fs::copy(&cache_cg_thumb, &cache_orig_plain);
    }

    Ok(out_path)
}

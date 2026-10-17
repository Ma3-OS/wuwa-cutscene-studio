# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Automated companion BGM audio waveform visualization.
- Batch cutscene export queue with multi-threading hardware acceleration.

---

## [1.0.0] - 2026-10-17

### Added
- **Zero-Extract Asset Discovery:** Rapid filesystem scanner indexing video files and mapping Audiokinetic Wwise soundbanks without requiring pre-decompression.
- **Wwise Multi-Track Audio Engine:** Automated pipeline integrating Wwiser and vgmstream to parse `.bnk` sound structures into `.txtp` configurations and decode 48kHz Opus streams.
- **5.1-to-Stereo Matrix Downmixer:** Phase-compensated channel folding matrix designed to preserve spatial ambiance while keeping center dialogue intelligible.
- **Dynamic Audio Peak Limiter:** Built-in volume limiter to eliminate digital clipping across multi-layer soundscapes.
- **Sub-Pixel Ruby Alignment Engine:** Calibrated typographic engine placing Furigana / Ruby reading annotations over corresponding dialogue words with zero horizontal drift.
- **Libass Font Scale Calibration:** Empirically verified font scaling factor ($0.635$) guaranteeing exact parity between web canvas preview and rendered video frames.
- **Corner Lyrics Display Module:** Independent top-left lyrics renderer with granular font size, line spacing, margins, and outline styling.
- **Multi-Resolution Video Framing:**
  - 16:9 Standard Zoom Fill (1920x1080) with intelligent center-cropping.
  - 21:9 UltraWide Letterbox (2560x1080) with cinematic top and bottom borders.
  - Native Resolution preservation.
  - 4K UHD (3840x2160) high-bitrate upscaling.
- **Monochrome Neutral Dark UI:** React 19 desktop interface styled with Tailwind CSS v4 in dark neutral zinc tones.
- **Offline SQLite ConfigDB Extraction:** Integrated native C# worker decoding game `ConfigDB/*.db` Base64-encoded `BinData` into clean JSON, adapted from research by Hiro420 ([WuwaTools](https://github.com/Hiro420/WuwaTools)).
- **Standardized Game Data Hierarchy:** Aligned cutscene metadata, video sound bindings, and localized textmaps with the standardized schema established by Arikatsu ([WutheringWaves_Data](https://github.com/Arikatsu/WutheringWaves_Data)).
- **Comprehensive Project Credits:** Full attribution documentation in [`CREDITS.md`](CREDITS.md) acknowledging game copyright holders, open-source researchers, and underlying multimedia frameworks.
- **Automation & CI/CD:** GitHub Actions workflows for continuous integration testing and automated Windows 64-bit release packaging with SHA-256 verification.


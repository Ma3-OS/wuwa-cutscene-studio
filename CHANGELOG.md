# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-10-18

### Added
- **Zero-Hardcoded i18n Architecture:** Complete removal of hardcoded UI strings across all frontend components. Seamless runtime language switching (Thai ⇄ English) across menus, tooltips, dialogs, badges, and notification toasts with 100% key parity across 485 translation keys.
- **Strict Thai Typographic Standard:** Zero parentheses `()` and zero brackets `[]` compliance across all Thai localizations and system messages.
- **Rust 2024 Modernization:** Upgraded Rust backend edition to Rust 2024 (`edition = "2024"` in `Cargo.toml`), adopting strict `unsafe extern` FFI semantics and passing all subtitle alignment unit test suites.
- **Enhanced Subtitle Lab Customizer:** Expanded typographic parameter controls for Dialogue, Ruby annotations, and Corner Lyrics (default 54pt size, 1.0 outline, 0.6 shadow, 54px margin), integrated with live video background and 3D level sequence preview modes.
- **Desktop Folder Navigation Experience:** Direct top-level focus behavior when opening export and output directories in Windows Explorer.

## [1.0.0] - 2026-10-18

### Added
- **Multi-Item Batch Queue:** Enqueue and render dozens of cutscenes with distinct gender, language, subtitle mode, and resolution settings with automated power management (Sleep, Shutdown, or Open Output Folder).
- **Performance Optimization:** Integrated DOM `content-visibility: auto` virtualization, 100ms dwell timer queue, and in-memory filesystem pre-indexing for fast cutscene cataloging.
- **Interactive Subtitle Lab:** Subtitle and corner lyrics preview canvas with safe area framing guides, video background, and typography parameter controls.
- **Wwise Multi-Track Audio Engine:** Automated pipeline integrating Wwiser and vgmstream to parse `.bnk` sound structures into `.txtp` configurations and decode 48kHz Opus streams.
- **5.1-to-Stereo Matrix Downmixer:** Phase-compensated channel folding matrix designed to preserve spatial ambiance while keeping center dialogue intelligible.
- **Dynamic Audio Peak Limiter:** Built-in volume limiter to eliminate digital clipping across multi-layer soundscapes.
- **Ruby Alignment:** Accurately places Furigana and Ruby reading annotations over corresponding dialogue words.
- **Libass Font Scale Calibration:** Font scaling factor ($0.635$) ensuring parity between web canvas preview and rendered video frames.
- **Corner Lyrics Display Module:** Independent top-left lyrics renderer with customizable font size, line spacing, margins, and outline styling.
- **Multi-Resolution Video Framing:**
  - 16:9 Standard Zoom Fill (1920x1080) with intelligent center-cropping.
  - 21:9 UltraWide Letterbox (2560x1080) with cinematic top and bottom borders.
  - Native Resolution preservation.
  - 4K UHD (3840x2160) upscaling.
- **Monochrome Neutral Dark UI:** React 19 desktop interface styled with Tailwind CSS v4 in a monochrome dark theme with custom app branding (`Logo.png`).
- **Offline SQLite ConfigDB Extraction:** Integrated native C# worker decoding game `ConfigDB/*.db` Base64-encoded `BinData` into clean JSON, adapted from research by Hiro420 ([WuwaTools](https://github.com/Hiro420/WuwaTools)).
- **Standardized Game Data Hierarchy:** Aligned cutscene metadata, video sound bindings, and localized textmaps with the standardized schema established by Arikatsu ([WutheringWaves_Data](https://github.com/Arikatsu/WutheringWaves_Data)).
- **Comprehensive Project Credits:** Full attribution documentation in [`CREDITS.md`](CREDITS.md) acknowledging game copyright holders, open-source researchers, and underlying multimedia frameworks.
- **Automation & CI/CD:** GitHub Actions workflows for continuous integration testing and automated Windows 64-bit release packaging with SHA-256 verification.


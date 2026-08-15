# 🎬 WuWa Cutscene Studio

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?style=for-the-badge)
![Tauri](https://img.shields.io/badge/Tauri_v2-24C8D8?style=for-the-badge&logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Rust](https://img.shields.io/badge/Rust-DEA584?style=for-the-badge&logo=rust&logoColor=white)
![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

**An all-in-one, ultra-fast desktop suite to extract, customize, preview, and render Wuthering Waves cinematic cutscenes with full audio mixing, localized subtitles, and resolution scaling.**

</div>

---

## ✨ Features

- 🎮 **Automated Asset Discovery & Extraction:**
  - Fast recursive scanner for `.mp4` video exports, `.bnk` Wwise audio banks, and `.wem` audio files.
  - Automatically downloads required game metadata (`videodata.json`, `videosound.json`, `videocaption.json`, `MultiText.json`).

- 🎧 **Multi-Track Audio Engine & Wwise Integration:**
  - Automated targeted `.bnk` extraction using **Wwiser** into `.txtp` format.
  - High-fidelity **vgmstream** decoding (supports Japanese, English, Korean, and Chinese voice lines).
  - **Companion Music Auto-Linker:** Automatically associates sequence music and interactive boss battle themes (`set_state_...` / `play_music_...`) with cutscene dialogue and SFX tracks.
  - **Studio 5.1-to-Stereo Matrix Downmixing:** Preserves dialog (Center), music (Surround), and bass (LFE) without phase cancellation or volume drop.
  - Dynamic audio normalization (`dynaudnorm`) to eliminate audio clipping.

- 📝 **Subtitle Studio & Typography Engine:**
  - Real-time WYSIWYG Subtitle Preview with 1:1 Actual 1080p pixel canvas and proportional scaling.
  - **Two-Line Ruby Tag Parsing:** Formats Furigana/Ruby annotations cleanly above the main dialogue line without breaking sentence rhythm.
  - Support for **Hard-sub (.ass / libass)** and **Soft-sub (.srt)** modes.
  - Preset styles: *🎮 In-Game 1080p*, *🇹🇭 Thai Cutscene*, *🟡 Anime Fansub*, *⚪ Clean Minimal*, *💥 Bold Impact*.
  - Full customizable typography: Font Family, Font Size, Stroke/Outline, Shadow, Colors, Vertical Margins, and Bold weights.

- 📺 **Resolution & Aspect Ratio Engine:**
  - **1920x1080 Fullscreen Zoom/Fill:** Intelligently center-crops 21:9 ultrawide cutscenes to full 16:9 frame without black letterbox bars.
  - Native **2560x1080 Ultrawide** & **4K 3840x2160** rendering.
  - Synchronized audio-video duration (`-shortest`) preventing trailing frozen frames.

- 🚀 **Modern Desktop Architecture:**
  - High-performance **Rust Backend** powered by **Tauri v2**.
  - Sleek **React 19 + Tailwind CSS** UI with glassmorphism, Framer Motion micro-animations, and true fullscreen preview.

---

## 🛠️ Prerequisites

Before running or building the app, make sure you have:

1. [Node.js](https://nodejs.org/) (v18 or newer) & `npm`
2. [Rust & Cargo](https://rustup.rs/) (latest stable)
3. [Python 3](https://www.python.org/) (installed and added to system `PATH` for Wwiser audio bank processing)

---

## 🚀 Quick Start & Development

### 1. Clone the repository
```bash
git clone https://github.com/your-username/wuwa-cutscene-studio.git
cd wuwa-cutscene-studio
```

### 2. Install frontend dependencies
```bash
npm install
```

### 3. Run in development mode
```bash
npm run tauri dev
```

### 4. Build standalone production release
```bash
npm run tauri build
```
The compiled standalone executable will be generated at:
`src-tauri/target/release/WuWa Cutscene Studio.exe`

---

## 📖 How to Use

1. **Initial Setup (Setup Tab):**
   - Click **"Sync All Dependencies & Databases"** to download external CLI tools (**FFmpeg**, **vgmstream**, **Wwiser**) and game text databases automatically.
   - Set your **FModel Export Directory** (the folder containing exported `Client/Content/Aki/` data).
   - Set your **Output Directory** where finished videos will be saved.

2. **Subtitle Studio (Subtitles Tab):**
   - Pick your desired font (e.g. `Kanit Medium`, `Segoe UI`, `Tahoma`).
   - Adjust Font Size, Stroke Outline, Shadow, and Vertical Margins.
   - Test in real-time using the **Live Preview** or click **Fullscreen** for 100% monitor canvas preview.
   - Click **"Save Style"** to persist your settings.

3. **Gallery & Batch Renderer (Gallery Tab):**
   - Select your character gender (**Girl / Boy Rover**).
   - Select your preferred voice language (**Japanese, English, Korean, Chinese**).
   - Select individual cutscenes or click **"Render All"** for batch queue processing.

---

## 📂 Project Structure

```
wuwa-cutscene-studio/
├── src/                          # React 19 Frontend
│   ├── components/               # Reusable UI components & layouts
│   ├── views/                    # Studio Pages (Gallery, Subtitles, Audio, Setup, Logs)
│   ├── types.ts                  # Shared TypeScript data models
│   ├── App.tsx                   # Main application container & navigation
│   └── main.tsx                  # React entrypoint
├── src-tauri/                    # Rust Backend (Tauri v2)
│   ├── src/
│   │   ├── commands/             # Modular IPC commands
│   │   │   ├── downloader.rs     # CLI tools & database download manager
│   │   │   ├── generator.rs      # Audio matching, Subtitle & ASS generator
│   │   │   ├── renderer.rs       # FFmpeg video rendering & audio mixing engine
│   │   │   ├── scanner.rs        # Fast directory & video scanner
│   │   │   ├── wwiser.rs         # Wwise bank processing & WEM path resolver
│   │   │   └── log.rs            # Real-time event log emitter
│   │   ├── config.rs             # Persistent user settings
│   │   └── lib.rs                # Tauri command registry
│   ├── Cargo.toml                # Rust dependencies & metadata
│   └── tauri.conf.json           # Tauri application configuration
├── package.json                  # Node dependencies & scripts
├── .gitignore                    # Git ignore rules
└── README.md                     # Documentation
```

---

## 📜 License

This project is open-source under the [MIT License](LICENSE).

*Disclaimer: Wuthering Waves and its assets, audio, and cutscenes are trademarks and copyrights of Kuro Games. This project is an unofficial fan-made tool created for educational and community archiving purposes.*

# 🎬 WuWa Cutscene Studio

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?style=for-the-badge)
![Tauri](https://img.shields.io/badge/Tauri_v2-24C8D8?style=for-the-badge&logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Rust](https://img.shields.io/badge/Rust_2021-DEA584?style=for-the-badge&logo=rust&logoColor=white)
![FFmpeg](https://img.shields.io/badge/FFmpeg_7-007808?style=for-the-badge&logo=ffmpeg&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript_5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

**An all-in-one, ultra-fast desktop suite to extract, customize, preview, and render Wuthering Waves cinematic cutscenes with automated Wwise audio mixing, companion BGM linking, localized subtitle styling, and multi-resolution framing.**

[Features](#-key-features) • [Why Some Clips Lack BGM](#-why-do-some-cutscenes-have-no-bgm-audio-architecture) • [Getting Started](#-quick-start--development) • [Usage Guide](#-how-to-use) • [FModel Guide](#-fmodel-extraction-guide) • [Architecture](#-project-architecture)

</div>

---

## 🌟 Overview

In **Wuthering Waves**, raw datamined video files (`.mp4`) extracted from the game client do not contain burned-in subtitles, localized dialogue, or background audio. The game engine stores voiceovers and sound effects inside proprietary Audiokinetic Wwise SoundBanks (`.bnk`/`.wem`), while subtitle dialogues and annotations (such as Furigana / Ruby tags) are stored in distributed JSON text databases.

**WuWa Cutscene Studio** bridges this gap by providing an end-to-end desktop workflow that:
1. Automatically scans and discovers exported video clips and soundbanks.
2. Resolves and extracts dialogue lines in multiple languages (**Japanese, English, Korean, Chinese**).
3. Decodes and merges multi-track audio (Dialogue + SFX + Companion BGM) with 5.1-to-stereo downmixing.
4. Generates formatted `.ass` / `.srt` subtitles with two-line Ruby annotations.
5. Renders finalized, high-fidelity video files using hardware-accelerated **FFmpeg**.

---

## ✨ Key Features

### 🎮 1. Smart Asset Discovery & Gallery
- **Recursive Directory Scanner:** Instantly indexes all `.mp4` cutscenes across nested FModel export structures.
- **Dynamic Metadata & Duration Badging:** Extracts video duration, dimensions, and visual thumbnail previews in real-time.
- **Multi-Filter System:** Filter videos by containing folders and Rover protagonist gender (**♀ Female / ♂ Male**).
- **Anti-Deadlock User Guidance:** Intelligent onboarding cards guide the user if the export folder is unconfigured, if zero videos are found, or if dependencies are missing.

### 🎧 2. Audio Engine & Wwise Pipeline
- **Automated SoundBank Extraction:** Integrates **Wwiser** and **vgmstream** to parse `.bnk` soundbanks into `.txtp` configurations and decode 48kHz Opus audio streams.
- **Voiceover Localization:** Supports instant switching between **Japanese (ja)**, **English (en)**, **Korean (ko)**, and **Chinese (zh-Hans)** audio tracks.
- **Rover Voice Matching:** Automatically routes dialogue banks according to the selected Rover gender (Nvzhu / Nanzhu).
- **5.1-to-Stereo Matrix Downmix:** Balances center dialogue, surround ambiances, and sub-bass frequencies without phase cancellation or clipping.
- **Audio Peak Limiter:** Built-in dynamic normalization prevents distortion during multi-layer mixing.

### 📝 3. Subtitle Studio & Typography
- **Real-Time WYSIWYG Live Preview:** Pixel-accurate 1080p canvas with toggleable **Fit Frame** and **1:1 Native Scale** modes.
- **Two-Line Ruby Tag Engine:** Cleanly formats Furigana / Ruby annotations above main dialogue lines without breaking sentence flow.
- **Safe Area Screen Guides:** Visual overlays for 90% Title Safe and Lower Third video framing standards.
- **Preset Styles:** One-click presets for *🎮 In-Game 1080p*, *🇹🇭 Thai Cutscene*, *🟡 Anime Fansub*, *⚪ Clean Minimal*, and *💥 Bold Impact*.
- **Granular Controls:** Full control over Font Size, Stroke Outline Thickness, Shadow Depth, Text Colors, and Vertical Bottom Margins.
- **Dual Subtitle Modes:** Supports **Hard-sub** (burned directly into video frames via `libass`) and **Soft-sub** (standalone `.srt` file generation).

### 📺 4. Resolution & Aspect Ratio Engine
- **16:9 Standard Zoom Fill (1920×1080):** Intelligently center-crops 21:9 ultrawide cinematics to fill full 16:9 displays with zero black letterbox bars.
- **21:9 UltraWide Letterbox (2560×1080):** Preserves full widescreen cinematics with cinematic top and bottom bars.
- **Original Native Match:** Retains exact source game resolution without scaling or cropping.
- **4K UHD (3840×2160):** High-bitrate upscaling for crystal-clear archive quality.

### 🎨 5. Theme Customization & UI Polish
- **Dynamic Accent Themes:** 5 neon palettes (**Glacier Cyan, Matrix Emerald, Rover Crimson, Solar Gold, Cyber Purple**) applied dynamically across all UI components and glowing hover borders.
- **Modern Typography:** Selectable application fonts (**Kanit, Prompt, Inter, Noto Sans Thai**).
- **Internationalization (i18n):** Native support for **English**, **Thai (ภาษาไทย)**, and **Japanese (日本語)** with clean, natural terminology.
- **UI Sound Feedback & Notifications:** Subtle interactive click sounds, volume controls, and completion chimes.

---

## 🔊 Why Do Some Cutscenes Have No BGM? (Audio Architecture)

If you notice that some rendered cutscenes contain crystal-clear character voiceovers and sound effects (SFX) but **no background music (BGM)**, this is **completely normal and is a direct result of how Wuthering Waves' game engine is designed**.

### 🔍 Technical Explanation:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           WUTHERING WAVES AUDIO ARCHITECTURE                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   [Cinematic / Boss Climax Cutscenes]                                            │
│   └── Dedicated Movie SoundBank (.bnk)                                           │
│       ├── Voice Dialogue Track (.wem)  ──────┐                                  │
│       ├── Sound Effects SFX Track (.wem) ────┼──► [Exported & Extracted with BGM]│
│       └── Custom Music Score Track (.wem) ───┘                                  │
│                                                                                  │
│   [Quest / In-Engine Story Cutscenes]                                            │
│   ├── Cutscene Specific SoundBank (.bnk)                                         │
│   │   ├── Voice Dialogue Track (.wem)  ──────┐                                  │
│   │   └── Sound Effects SFX Track (.wem) ────┴──► [Extracted: Dialogue & SFX Only]│
│   │                                                                              │
│   └── World Engine Ambient Audio State (Interactive BGM System)                  │
│       └── Map / Battle BGM Manager (Wwise State Group: `Music_Event`, `State_...`)│
│           └── Plays in real-time in the background during live gameplay          │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

1. **Dedicated vs. Ambient SoundBanks:**
   - **Standalone Pre-Rendered Cutscenes / Major Boss Climaxes:** The musical score is authored specifically for that cinematic and is packaged directly inside the cutscene's dedicated SoundBank (e.g. `Movie_...` / `Sequence_...`). In these cases, WuWa Cutscene Studio extracts and mixes all audio tracks including BGM.
   - **Standard In-Engine Quest Cutscenes:** The game relies on its **dynamic interactive music system (`Music_Event`, `BGM_Manager`)**. During live gameplay, the background music continues playing seamlessly from the surrounding open-world environment or dungeon state while the cutscene triggers voice and SFX over it.

2. **Isolated Asset Extraction:**
   - When extracting files via FModel, only the specific cutscene SoundBank is extracted. Because the world ambient music is managed by global game states rather than stored inside the cutscene's bank, the extracted bank only contains **Voice** and **SFX**.

3. **Companion Music Linking:**
   - WuWa Cutscene Studio includes an automated companion audio detection system that scans sequence state events (`set_state_...` / `play_music_...`) to locate and link background music whenever associated music event mappings exist.

---

## 🛠️ Prerequisites

Before installing and building the project, ensure you have the following software installed:

1. **[Node.js](https://nodejs.org/)** (v18.0.0 or higher) & `npm`
2. **[Rust & Cargo](https://rustup.rs/)** (latest stable release)
3. **[Python 3](https://www.python.org/)** (Python 3.8+ added to system `PATH` for Wwiser audio bank parsing)
4. **[FModel](https://fmodel.app/)** (for extracting game files from Wuthering Waves `.pak` containers)

---

## 🚀 Quick Start & Development

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/wuwa-cutscene-studio.git
cd wuwa-cutscene-studio
```

### 2. Install Frontend Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run tauri dev
```
*This launches the Vite frontend server on `http://localhost:1422` with hot-reloading and starts the Tauri Rust backend window.*

### 4. Build Standalone Production Executable
```bash
npm run tauri build
```
Or run the helper batch script on Windows:
```bash
build_release.bat
```
The compiled standalone release executable will be created at:
`src-tauri/target/release/WuWa Cutscene Studio.exe`

---

## 📖 How to Use

### Step 1: Initial System Sync
1. Open the **Preferences (ตั้งค่าระบบ)** tab.
2. Click **"Sync All Tools & Data"** to automatically download:
   - **FFmpeg 7.x** (Video encoding, audio filtering, and subtitle burning)
   - **vgmstream** (Wwise audio stream decoding)
   - **Wwiser** (SoundBank structure analyzer)
   - **Kuro Games Textmap Database** (Game dialogue captions)
3. Set your **FModel Export Directory** (the directory where you exported `Client/Content/Aki/`).
4. (Optional) Customize your preferred **Theme Accent Color** and **Application Font**.

### Step 2: Customize Subtitle Styling
1. Navigate to the **Subtitles (สไตล์ซับไตเติล)** tab.
2. Select a preset (e.g. *In-Game 1080p*, *Thai Cutscene*, *Anime Fansub*).
3. Fine-tune Font Size, Stroke Outline, Shadow Depth, and Margin Offset.
4. Verify your typography using the **Live Cinematic Preview** or click **Fullscreen** for a 1:1 monitor test.

### Step 3: Render Cutscenes
1. Go to the **Cutscenes (สตูดิโอคัตซีน)** tab.
2. Select your desired cutscene from the gallery or search by name (e.g. `M0372`).
3. Choose your Rover gender (**Female / Male**) and Voiceover Language (**Japanese, English, Korean, Chinese**).
4. Select your **Aspect Ratio Framing** (16:9 Zoom Fill, 21:9 Letterbox, or Native).
5. Click **"Start Processing"**. The studio will extract the audio banks, build subtitle tracks, and render the final MP4 video.
6. Once finished, click **"Play Rendered Video"** or **"Output Folder"** to view the result!

---

## 📦 FModel Extraction Guide

To extract Wuthering Waves cutscene movies and soundbanks using [FModel](https://fmodel.app/):

1. **Add Game Directory in FModel:**
   - Point FModel to your Wuthering Waves game directory: `.../Wuthering Waves Game/Client/Content/Paks/`
   - Set the UE version to `UE 4.26` or `UE 5.x` with the corresponding AES key.
2. **Export Movies:**
   - Navigate to `Client/Content/Aki/Movies/`
   - Right-click and choose **"Export Raw Data (.mp4)"**.
3. **Export Audio Banks:**
   - Navigate to `Client/Content/Aki/WwiseAudio/`
   - Right-click and choose **"Export Raw Data (.bnk / .wem)"**.
4. **Set Directory in Studio:**
   - In WuWa Cutscene Studio, set the **FModel Export Directory** to the root folder containing `Client/Content/Aki/` (e.g. `D:\Exports\Client\Content\Aki`).

---

## 📂 Project Architecture

```
wuwa-cutscene-studio/
├── src/                                  # React 19 Frontend
│   ├── assets/                           # Audio chimes & static assets
│   ├── components/                       # UI & Layout components
│   │   ├── layout/                       # Sidebar & Navigation
│   │   └── ui/                           # SpotlightCard, Buttons, Modals
│   ├── context/                          # Global AppContext & Style DOM injection
│   ├── utils/                            # SoundManager, i18n dictionaries (th, en, ja)
│   ├── views/                            # Application Views
│   │   ├── GalleryView.tsx               # Video gallery, filters & render trigger
│   │   ├── SubtitleView.tsx              # WYSIWYG Subtitle styling & live canvas
│   │   ├── AudioView.tsx                 # Audio mixing, Wwiser bank configuration
│   │   ├── SetupView.tsx                 # Preferences, font/theme selector, cache cleaner
│   │   └── LogView.tsx                   # Live terminal activity stream
│   ├── App.tsx                           # Main app shell & router
│   ├── index.css                         # Tailwind CSS v4 design tokens & keyframes
│   └── main.tsx                          # React DOM bootstrap
├── src-tauri/                            # Rust Backend (Tauri v2)
│   ├── src/
│   │   ├── commands/                     # Modular Tauri IPC commands
│   │   │   ├── downloader.rs             # CLI tools & textmap synchronization
│   │   │   ├── generator.rs              # Subtitle formatting & .ass generator
│   │   │   ├── renderer.rs               # FFmpeg execution & audio downmixing
│   │   │   ├── scanner.rs                # Fast filesystem scanner & metadata parser
│   │   │   ├── wwiser.rs                 # Wwiser python bridge & .wem path resolver
│   │   │   ├── cache.rs                  # Cache size calculator & cleaner
│   │   │   └── log.rs                    # Real-time event log emitter
│   │   ├── config.rs                     # Persistent user settings (app_config.json)
│   │   ├── lib.rs                        # Command registry & plugin loader
│   │   └── main.rs                       # Application entrypoint
│   ├── Cargo.toml                        # Rust dependencies & metadata
│   └── tauri.conf.json                   # Tauri window & bundle configuration
├── .gitignore                            # Comprehensive git ignore rules
├── package.json                          # Node dependencies & build scripts
├── build_release.bat                     # 1-Click production build script
├── clean_project.bat                     # Cache & temporary file cleaner
├── git_push.bat                          # Git staging & commit assistant
└── README.md                             # Project documentation
```

---

## 💻 Tech Stack

- **Desktop Framework:** [Tauri v2](https://v2.tauri.app/) (Rust Backend)
- **Frontend Framework:** [React 19](https://react.dev/) + [TypeScript 5.8](https://www.typescriptlang.org/)
- **Build Tool:** [Vite 7](https://vite.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Animations:** [Framer Motion 12](https://www.framer.com/motion/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Audio/Video Processing:** [FFmpeg 7.x](https://ffmpeg.org/), [vgmstream](https://github.com/vgmstream/vgmstream), [Wwiser](https://github.com/bnnm/wwiser)

---

## 📜 License & Disclaimer

This project is open-source under the **[MIT License](LICENSE)**.

> **Disclaimer:** *Wuthering Waves* and all its visual assets, cutscene movies, dialogue, trademarks, and audio are the sole property and copyright of **Kuro Games**. This project is an unofficial, open-source fan-made archive tool created strictly for non-commercial, personal archiving and educational purposes.

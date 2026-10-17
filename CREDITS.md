# Acknowledgements & Credits

**WuWa Cutscene Studio** is made possible by the incredible work of the open-source community, game research pioneers, and foundational multimedia tooling. We gratefully acknowledge the following individuals, teams, and projects:

---

## 1. Game Intellectual Property & Original Assets

- **[Kuro Games](https://wutheringwaves.kurogames.com/)**
  - Creator and copyright holder of *Wuthering Waves*.
  - All visual assets, character models, cinematic movies, audio recordings, dialogue scripts, and trademarks belong solely to Kuro Games.
  - This project is an independent fan-made archive tool created strictly for non-commercial, personal backup, and educational purposes.

---

## 2. Reverse Engineering & Data Schema Pioneers

- **[Hiro420](https://github.com/Hiro420)**
  - Author of [Hiro420/WuwaTools](https://github.com/Hiro420/WuwaTools).
  - Provided foundational research, SQLite `ConfigDB` schema analysis, and Base64-encoded `BinData` decoding techniques that made offline, local textmap extraction possible.

- **[Arikatsu](https://github.com/Arikatsu)**
  - Maintainer of [Arikatsu/WutheringWaves_Data](https://github.com/Arikatsu/WutheringWaves_Data).
  - Established the standardized hierarchical data organization for `BinData` (`cgVedio`, `MusicSubTitle`) and multilingual `Textmaps` (`multi_text`, `subtitle_text`, `flow_text`, `custom_sequence`).

- **[FModel Community](https://fmodel.app/)**
  - The leading software suite for Unreal Engine exploration and asset extraction workflows.

---

## 3. Audio & Video Multimedia Toolchain

- **[FFmpeg Team](https://ffmpeg.org/)**
  - The leading multimedia framework for hardware-accelerated video encoding (NVENC, QSV, AMF), 5.1 surround-to-stereo audio downmixing, and `libass` subtitle burning.

- **[bnnm & Wwiser Contributors](https://github.com/bnnm/wwiser)**
  - Authors of Wwiser, the premier Audiokinetic Wwise SoundBank parser and `.txtp` stream generation bridge.

- **[vgmstream Development Team](https://github.com/vgmstream/vgmstream)**
  - Lossless game audio decoder capable of parsing proprietary Audiokinetic `.wem` Opus and Vorbis streams into uncompressed 48kHz audio.

- **[libass Project](https://github.com/libass/libass)**
  - Portable subtitle renderer for the Advanced SubStation Alpha (`.ass`) format with sub-pixel typography and Ruby placement accuracy.

---

## 4. Native & Engine Frameworks

- **[Fabian & CUE4Parse Contributors](https://github.com/FabianFG/CUE4Parse)**
  - High-performance C# package parsing library for Unreal Engine VFS and PAK containers, powering our native extraction worker.

- **[Tauri Core Team](https://v2.tauri.app/)**
  - Ultra-fast, memory-efficient native desktop application framework combining Rust with modern web technologies.

- **[The Rust Project](https://www.rust-lang.org/)**
  - Safe, concurrent systems programming language powering our native core engine.

- **[Microsoft .NET Team](https://dotnet.microsoft.com/)**
  - High-performance, cross-platform runtime powering the CUE4Parse background worker.

---

## 5. Frontend & Design System

- **[React Team](https://react.dev/)**
  - Frontend reactive interface library.

- **[Tailwind Labs](https://tailwindcss.com/)**
  - Tailwind CSS v4 styling engine enabling our Monochrome Neutral Dark design tokens.

- **[Lucide Icons](https://lucide.dev/)**
  - Beautiful, consistent open-source iconography.

- **[Framer Motion](https://www.framer.com/motion/)**
  - Hardware-accelerated UI transition and interaction engine.

---

## 6. Project Architecture & Stewardship

- **[Ma3-OS](https://github.com/Ma3-OS)**
  - Architectural design, integration engineering, typographic math calibration, security hardening, and ongoing open-source stewardship.

# Contributing to WuWa Cutscene Studio

Thank you for your interest in contributing to **WuWa Cutscene Studio**, an open-source project managed by **Ma3-OS**.

This document outlines our engineering standards, pull request workflow, and core development requirements to ensure code quality, repository safety, and cross-platform consistency.

---

## Code of Conduct

All contributors and participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all community members with respect and professionalism.

---

## Development Prerequisites

Before setting up the repository, ensure your development environment includes:

1. **Operating System:** Windows 10 or Windows 11 (64-bit).
2. **Node.js:** v20.x LTS or higher with `npm`.
3. **Rust Toolchain:** Latest stable release (`x86_64-pc-windows-msvc`). Install via [rustup.rs](https://rustup.rs/).
4. **Python:** 3.10+ added to system `PATH` (used for SoundBank utilities).
5. **C++ Build Tools:** Visual Studio Build Tools with C++ desktop workload (required for compiling native Rust crates).

---

## Getting Started

### 1. Fork & Clone
Fork the repository on GitHub, then clone your fork locally:

```powershell
git clone https://github.com/YOUR-USERNAME/wuwa-cutscene-studio.git
cd wuwa-cutscene-studio
```

### 2. Install Dependencies
```powershell
npm install
```

### 3. Launch Development Environment
```powershell
npm run tauri dev
```
This boots the Vite local server with hot-reloading on port 1422 and launches the Tauri desktop client.

---

## Branching & Commit Conventions

### Branch Naming
Create focused branches branching off `main`:
- `feat/feature-name` (New features or enhancements)
- `fix/issue-description` (Bug fixes)
- `perf/optimization` (Performance improvements)
- `docs/topic` (Documentation updates)
- `refactor/subsystem` (Code refactoring without behavioral changes)

### Conventional Commits
All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<optional scope>): <description>

[optional body]

[optional footer]
```

**Common types:**
- `feat`: A new user-facing feature
- `fix`: A bug fix
- `docs`: Documentation changes only
- `style`: Formatting, missing semi-colons, white-space changes
- `refactor`: Code changes that neither fix a bug nor add a feature
- `perf`: Code changes that improve performance
- `test`: Adding or updating test cases
- `chore`: Build tasks, package updates, CI configuration

---

## Strict Repository Rules

To preserve code integrity, security, and aesthetics, all contributions must adhere to the following rules:

### 1. Zero-Leak Security Policy
- **Never commit copyrighted game assets:** `.pak`, `.sig`, `.bnk`, `.wem`, `.bik`, or full cutscene video files.
- **Never commit cryptographic keys:** AES keys, private keys, or `keys.json`.
- **Never commit absolute local file paths:** Do not include local filesystem paths containing personal usernames (e.g., `C:\Users\<username>`) in committed source or config files. Use relative paths or environment variables.

### 2. Thai Language Punctuation Constraint
- **Strictly zero parentheses `()` and zero brackets `[]` in ALL Thai text, UI strings, documentation, and comments.**
- Use whitespace separation, colons, or descriptive rephrasing instead of enclosing text within parentheses or brackets.

### 3. Emoji Policy
- **Do NOT include emojis in source code, commit messages, or Thai documentation.** Keep all code, logs, and technical specifications clean and professional.

### 4. Design Aesthetics
- All UI modifications must follow the **Monochrome Neutral Dark** design system (`zinc-900`/`zinc-950` surfaces with precise border styling and high-contrast typography). Avoid arbitrary saturated colors.

### 5. Attribution & Upstream Respect
- If you incorporate or adapt code, data schemas, or research techniques from external projects, you must properly attribute the original authors and update [CREDITS.md](CREDITS.md).

---

## Pre-Submission Verification

Before submitting a Pull Request, verify that all automated checks pass locally:

```powershell
# 1. Verify Rust compilation and clippy lints
cargo check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml

# 2. Run subtitle formatting and math calibration tests
cargo test --manifest-path src-tauri/Cargo.toml subtitles

# 3. Verify TypeScript types and frontend production build
npm run build

# 4. Check Thai language punctuation constraints
python scripts/check_thai_parens.py

# 5. Run full pre-publish repository audit
python scripts/pre_publish_audit.py
```

All 5 checks must pass with exit code `0` before code can be merged into `main`.

---

## Submitting a Pull Request

1. Push your branch to your GitHub fork:
   ```powershell
   git push origin feat/your-feature-name
   ```
2. Open a Pull Request against the `main` branch of `Ma3-OS/wuwa-cutscene-studio`.
3. Complete all sections of the [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md).
4. Ensure all continuous integration (CI) workflow checks succeed.
5. A maintainer will review your submission and provide feedback.

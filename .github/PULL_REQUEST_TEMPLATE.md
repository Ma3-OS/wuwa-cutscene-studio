## Description

Please provide a brief summary of the changes introduced in this pull request and the motivation behind them.

---

## Related Issue

Closes #<!-- issue number here, or leave blank if none -->

---

## Type of Change

- [ ] `feat`: New feature or user enhancement
- [ ] `fix`: Bug fix
- [ ] `perf`: Performance improvement
- [ ] `docs`: Documentation updates
- [ ] `refactor`: Internal code refactoring
- [ ] `chore`: Build or dependency updates

---

## Mandatory Quality Checklist

Before submitting this PR, please check all the following items:

- [ ] My code strictly adheres to the project's **Monochrome Neutral Dark** aesthetic guidelines.
- [ ] **Thai Language Rule:** I have verified that there are **ZERO parentheses `()` and ZERO brackets `[]`** in any new/modified Thai text, UI strings, documentation, or comments.
- [ ] **Emoji Rule:** I have verified that there are **ZERO emojis** in source code, commit messages, and Thai documentation.
- [ ] **Security Rule:** I have NOT committed any copyrighted game assets (`.pak`, `.bnk`, `.wem`, `.bik`), AES keys, or personal filesystem paths.
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` passes with zero errors.
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml subtitles` passes all unit tests.
- [ ] `npm run build` succeeds without errors or missing types.
- [ ] `python scripts/check_thai_parens.py` reports 0 violations.
- [ ] `python scripts/pre_publish_audit.py` succeeds with exit code 0.

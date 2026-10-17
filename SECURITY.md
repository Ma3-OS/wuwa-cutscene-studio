# Security Policy

## Supported Versions

The following table indicates the maintenance lifecycle for versions of **WuWa Cutscene Studio**:

| Version | Supported          | Security Patches |
| :---    | :---               | :---             |
| 1.0.x   | Yes                | Yes              |
| < 1.0.0 | No                 | No               |

---

## Reporting a Vulnerability

The development team at **Ma3-OS** takes the security of our users and software seriously. If you discover a security vulnerability, we appreciate your efforts to disclose it responsibly.

### How to Report
Please **DO NOT** report security vulnerabilities through public GitHub issues or public discussions.

Instead, please report vulnerabilities using one of the following methods:
1. **GitHub Private Vulnerability Reporting:** Submit a confidential report directly via the [Security Advisory tab](https://github.com/Ma3-OS/wuwa-cutscene-studio/security/advisories/new) of this repository.
2. **Email Disclosure:** Contact the maintainers directly at `security@ma3-os.org` with:
   - A clear description of the vulnerability.
   - Detailed steps to reproduce or a minimal proof of concept (PoC).
   - The affected component (Tauri Rust backend, IPC handler, or frontend UI).
   - An assessment of potential impact.

---

## Response Timeline

- **Initial Acknowledgement:** We will acknowledge receipt of your vulnerability report within **48 hours**.
- **Assessment & Triage:** We aim to provide an initial assessment and reproduction confirmation within **7 business days**.
- **Fix & Disclosure:** Once a patch is developed and verified, a security advisory and release will be published. We ask that you maintain confidentiality until an official fix is released.

---

## Security Considerations & Scope

When evaluating security issues in this repository, please note:
- **Local Desktop Boundary:** WuWa Cutscene Studio is a client-side desktop application running locally under user permissions.
- **IPC Validation:** All Tauri IPC commands perform strict path validation and canonicalization to prevent directory traversal or arbitrary code execution via forged parameters.
- **External Binaries:** Downloaded binaries (FFmpeg, vgmstream, Wwiser) are fetched exclusively from verified upstream repositories over secure HTTPS channels and validated with checksums.

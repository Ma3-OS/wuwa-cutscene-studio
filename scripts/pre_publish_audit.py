#!/usr/bin/env python3
"""
Pre-Publish Repository Audit Script
Managed by Ma3-OS for WuWa Cutscene Studio.

Validates:
1. No personal usernames or local path leaks (jmach, personal user profiles)
2. No forbidden game assets (*.pak, *.sig, *.bnk, *.wem, *.bik, keys.json)
3. No tracked files exceeding 20 MB
4. Zero parentheses () and zero brackets [] in Thai strings and documentation
"""

import os
import sys
import re
import subprocess
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB


# Sensitive strings to forbid
FORBIDDEN_IDENTIFIERS = [
    re.compile(r'\bjmach\b', re.IGNORECASE),
]

# Sensitive file extensions or filenames that should NEVER be tracked in git
FORBIDDEN_EXTENSIONS = {'.pak', '.sig', '.bnk', '.wem', '.bik'}
FORBIDDEN_FILENAMES = {'keys.json', 'config.json'}

# Regex to detect Thai strings or comments containing parentheses or brackets
THAI_PARENS_REGEX = re.compile(
    r'("[^"]*[\u0E00-\u0E7F]+[^"]*"|\'[^\']*[\u0E00-\u0E7F]+[^\']*\'|`[^`]*[\u0E00-\u0E7F]+[^`]*`|//.*[\u0E00-\u0E7F]+.*|/\*.*[\u0E00-\u0E7F]+.*\*/)'
)

def get_git_tracked_files():
    """Returns list of files tracked or stageable by git, or fallback to walking files if not in git."""
    try:
        output = subprocess.check_output(
            ["git", "ls-files", "-c", "-o", "--exclude-standard"], stderr=subprocess.DEVNULL
        ).decode('utf-8', errors='ignore')
        files = [line.strip() for line in output.splitlines() if line.strip()]
        if files:
            return files
    except Exception:
        pass


    # Fallback to local walk excluding known ignore directories
    tracked = []
    ignored_dirs = {'.git', 'node_modules', 'target', 'dist', 'output', 'export', 'cache', 'logs'}
    for root, dirs, filenames in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ignored_dirs]
        for f in filenames:
            rel = os.path.relpath(os.path.join(root, f), '.')
            tracked.append(rel.replace('\\', '/'))
    return tracked

def run_audit():
    print("=" * 70)
    print("Starting WuWa Cutscene Studio Pre-Publish Audit [Ma3-OS]")
    print("=" * 70)

    tracked_files = get_git_tracked_files()
    violations = []

    print(f"Auditing {len(tracked_files)} tracked files...")

    # 1. Check for forbidden files & sizes
    for fpath in tracked_files:
        p = Path(fpath)
        
        # Check filename & extension
        if p.name.lower() in FORBIDDEN_FILENAMES:
            violations.append(f"[FORBIDDEN FILE] {fpath} must not be tracked in git!")
        
        if p.suffix.lower() in FORBIDDEN_EXTENSIONS:
            violations.append(f"[FORBIDDEN EXTENSION] {fpath} must not be tracked in git!")

        if os.path.exists(fpath):
            file_size = os.path.getsize(fpath)
            if file_size > MAX_FILE_SIZE_BYTES:
                size_mb = file_size / (1024 * 1024)
                violations.append(f"[OVERSIZE FILE] {fpath} is {size_mb:.2f} MB (Max allowed: 20 MB)")

    # 2. Check for personal identifiers
    text_extensions = {
        '.rs', '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yml', '.yaml',
        '.toml', '.html', '.css', '.bat', '.ps1', '.py', '.txt'
    }

    for fpath in tracked_files:
        p = Path(fpath)
        if p.name == 'pre_publish_audit.py':
            continue
        if p.suffix.lower() not in text_extensions or not os.path.exists(fpath):
            continue


        try:
            with open(fpath, 'r', encoding='utf-8', errors='ignore') as fp:
                content = fp.read()

            for regex in FORBIDDEN_IDENTIFIERS:
                match = regex.search(content)
                if match:
                    violations.append(f"[SENSITIVE IDENTIFIER] Found '{match.group(0)}' in {fpath}")

        except Exception as e:
            violations.append(f"[READ ERROR] Could not read {fpath}: {e}")

    # 3. Check Thai punctuation constraints (No parens or brackets)
    thai_audit_files = [
        f for f in tracked_files
        if f.endswith(('.ts', '.tsx', '.rs', '.js', 'README.th.md'))
        and os.path.exists(f)
    ]

    for fpath in thai_audit_files:
        try:
            with open(fpath, 'r', encoding='utf-8', errors='ignore') as fp:
                for line_num, line in enumerate(fp, 1):
                    # For README.th.md, check entire line for parens/brackets
                    if fpath.endswith('README.th.md'):
                        if re.search(r'[\(\)\[\]]', line):
                            violations.append(f"[THAI PUNCTUATION] README.th.md:{line_num} contains parentheses/brackets: {line.strip()}")
                        continue

                    # For code files, inspect Thai string literals and comments
                    literals = THAI_PARENS_REGEX.findall(line)
                    for lit in literals:
                        cleaned = re.sub(r'\$\{[^\}]+\}', '', lit)
                        if re.search(r'[\(\)\[\]]', cleaned):
                            violations.append(
                                f"[THAI PUNCTUATION] {fpath}:{line_num} contains parentheses/brackets in Thai text: {line.strip()}"
                            )
        except Exception as e:
            violations.append(f"[READ ERROR] Could not inspect Thai text in {fpath}: {e}")

    # Results summary
    print("-" * 70)
    if violations:
        print(f"FAILED: Found {len(violations)} violation(s):\n")
        for v in violations:
            print(f"  - {v}")
        print("\nPlease resolve all violations before publishing to GitHub.")
        print("=" * 70)
        sys.exit(1)
    else:
        print("SUCCESS: 0 violations found. Repository is sanitized and release-ready!")
        print("=" * 70)
        sys.exit(0)

if __name__ == '__main__':
    run_audit()

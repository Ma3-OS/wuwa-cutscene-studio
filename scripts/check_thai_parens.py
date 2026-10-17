import re
import glob

# Matches parentheses or brackets inside Thai strings or comments:
# e.g. "ข้อความ (หมายเหตุ)" or "คำอธิบาย [ตัวเลือก]" or // คำอธิบาย (เพิ่มเติม)
regex_inside_quotes = re.compile(r'("[^"]*[\u0E00-\u0E7F]+[^"]*"|\'[^\']*[\u0E00-\u0E7F]+[^\']*\'|`[^`]*[\u0E00-\u0E7F]+[^`]*`|//.*[\u0E00-\u0E7F]+.*|/\*.*[\u0E00-\u0E7F]+.*\*/)')

target_dirs = [
    "src/features/subtitle-lab/**/*.*",
    "src/features/gallery/**/*.*",
    "src/components/studio/**/*.*",
    "src/components/ui/ExtractionProgressModal.tsx",
    "src/views/SubtitleLabView.tsx",
    "src/views/GalleryView.tsx",
    "src-tauri/src/commands/scanner.rs",
    "src-tauri/src/commands/renderer.rs",
]

actual_violations = []

for td in target_dirs:
    for f in glob.glob(td, recursive=True):
        if not f.endswith((".ts", ".tsx", ".rs", ".js")):
            continue
        try:
            with open(f, "r", encoding="utf-8") as fp:
                for line_num, line in enumerate(fp, 1):
                    literals = regex_inside_quotes.findall(line)
                    for lit in literals:
                        if "(" in lit or ")" in lit or "[" in lit or "]" in lit:
                            # Verify if parens/brackets are part of the Thai message/comment
                            # and not JS template interpolation like ${...} or array indexing like [0]
                            cleaned = re.sub(r'\$\{[^\}]+\}', '', lit)
                            if re.search(r'[\(\)\[\]]', cleaned):
                                actual_violations.append((f, line_num, cleaned, line.strip()))
        except Exception as e:
            pass

with open("scripts/actual_thai_parens_report.txt", "w", encoding="utf-8") as out:
    out.write(f"Actual violations count: {len(actual_violations)}\n")
    for f, line_num, lit, line in actual_violations:
        out.write(f"{f}:{line_num}\n  Literal: {lit}\n  Line: {line}\n")

print(f"Actual violations count: {len(actual_violations)}")

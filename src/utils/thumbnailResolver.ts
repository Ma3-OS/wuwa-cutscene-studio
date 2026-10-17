import { convertFileSrc } from "@tauri-apps/api/core";

export function resolveThumbnailSrc(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return undefined;
  }
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("http:") ||
    trimmed.startsWith("https:") ||
    trimmed.startsWith("asset:")
  ) {
    return trimmed;
  }
  try {
    return convertFileSrc(trimmed);
  } catch {
    return trimmed;
  }
}

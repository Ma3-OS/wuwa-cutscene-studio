/**
 * Safe UUID generation utility compatible across all Web/WebView2 environments.
 */
export function safeUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback if environment restricts crypto.randomUUID
    }
  }
  return (
    Math.random().toString(36).substring(2, 10) +
    "-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).substring(2, 6)
  );
}

import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { getTranslation, type AppLanguage, type TranslationKey } from "../../locales";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      copied: false,
      showDetails: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught runtime error caught by ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopy = async () => {
    const errorText = [
      `WuWa Cutscene Studio - Runtime Diagnostics`,
      `Time: ${new Date().toISOString()}`,
      `Error: ${this.state.error?.name}: ${this.state.error?.message}`,
      `\n--- Stack Trace ---`,
      this.state.error?.stack || "No stack trace available",
      `\n--- Component Stack ---`,
      this.state.errorInfo?.componentStack || "No component stack available",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(errorText);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (err) {
      console.error("Failed to copy error to clipboard:", err);
    }
  };

  public render() {
    if (this.state.hasError) {
      const { error, errorInfo, copied, showDetails } = this.state;
      const lang =
        (typeof window !== "undefined" &&
          (localStorage.getItem("app_lang") as AppLanguage)) ||
        "th";
      const t = (k: TranslationKey) => getTranslation(k, lang);

      return (
        <div className="flex h-screen w-screen items-center justify-center bg-[#020203] text-[#EDEDEF] p-6 select-none font-kanit">
          {/* Subtle ambient background glow */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-500/10 rounded-full blur-[120px]" />
          </div>

          <div className="relative z-10 w-full max-w-xl rounded-2xl border border-rose-500/30 bg-[#090A0F]/90 backdrop-blur-xl p-8 shadow-2xl shadow-rose-950/20">
            {/* Header with Icon */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shadow-inner">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-wide text-white">
                  {t("errorBoundaryTitle")}
                </h1>
                <p className="text-xs text-rose-300/80 font-mono mt-0.5">
                  Application Runtime Exception Caught
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="mb-6 rounded-xl border border-white/5 bg-white/[0.03] p-4 text-sm text-neutral-300">
              <p className="text-xs font-semibold text-rose-400 mb-1">
                {error?.name || "Error"}
              </p>
              <p className="font-mono text-xs text-neutral-300 break-all select-text">
                {error?.message || "Unknown unexpected runtime error."}
              </p>
            </div>

            {/* Expandable Technical Details */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => this.setState({ showDetails: !showDetails })}
                className="flex items-center gap-2 text-xs font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="h-4 w-4" /> {t("errorBoundaryHideDetails")}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" /> {t("errorBoundaryShowDetails")}
                  </>
                )}
              </button>

              {showDetails && (
                <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-[11px] text-neutral-400 select-text scrollbar-thin scrollbar-thumb-white/10">
                  <div className="text-neutral-500 mb-2"># Error Stack:</div>
                  <pre className="whitespace-pre-wrap">{error?.stack || "N/A"}</pre>
                  {errorInfo?.componentStack && (
                    <>
                      <div className="text-neutral-500 mt-3 mb-1"># Component Stack:</div>
                      <pre className="whitespace-pre-wrap">{errorInfo.componentStack}</pre>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={this.handleCopy}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-neutral-300 hover:bg-white/[0.08] hover:text-white transition-all cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{t("errorBoundaryCopied")}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>{t("errorBoundaryCopy")}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-600/80 hover:bg-rose-500 px-5 py-2.5 text-xs font-medium text-white shadow-lg shadow-rose-600/20 transition-all cursor-pointer active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{t("errorBoundaryReload")}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

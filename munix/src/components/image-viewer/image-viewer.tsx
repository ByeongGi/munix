import { convertFileSrc } from "@tauri-apps/api/core";
import { ImageIcon, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ipc } from "@/lib/ipc";
import { cn } from "@/lib/cn";

interface ImageViewerProps {
  path: string;
  className?: string;
}

type ZoomMode = "fit" | "actual" | "custom";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function formatDimensions(width: number | null, height: number | null): string {
  if (!width || !height) return "";
  return `${width.toLocaleString()} x ${height.toLocaleString()}`;
}

export function ImageViewer({ path, className }: ImageViewerProps) {
  const { t } = useTranslation(["editor"]);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{
    width: number | null;
    height: number | null;
  }>({ width: null, height: null });
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<ZoomMode>("fit");

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setError(null);
    setDimensions({ width: null, height: null });
    setZoom(1);
    setMode("fit");

    void ipc
      .absPath(path)
      .then((abs) => {
        if (!cancelled) setSrc(convertFileSrc(abs));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  const fileName = path.split("/").pop() ?? path;
  const dimensionLabel = formatDimensions(dimensions.width, dimensions.height);
  const zoomPercent = useMemo(() => Math.round(zoom * 100), [zoom]);

  const setActualSize = () => {
    setMode("actual");
    setZoom(1);
  };

  const setFitSize = () => {
    setMode("fit");
    setZoom(1);
  };

  const adjustZoom = (delta: number) => {
    setMode("custom");
    setZoom((value) => clampZoom(value + delta));
  };

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        "bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]",
        className,
      )}
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--color-border-primary)] px-4">
        <ImageIcon className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{fileName}</div>
          <div className="truncate font-mono text-[11px] text-[var(--color-text-tertiary)]">
            {path}
          </div>
        </div>
        {dimensionLabel ? (
          <span className="hidden shrink-0 font-mono text-[11px] text-[var(--color-text-tertiary)] sm:inline">
            {dimensionLabel}
          </span>
        ) : null}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => adjustZoom(-ZOOM_STEP)}
            className="flex h-7 w-7 items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
            title={t("editor:imageViewer.zoomOut")}
            aria-label={t("editor:imageViewer.zoomOut")}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-12 text-center font-mono text-[11px] text-[var(--color-text-tertiary)]">
            {mode === "fit" ? t("editor:imageViewer.fitShort") : `${zoomPercent}%`}
          </span>
          <button
            type="button"
            onClick={() => adjustZoom(ZOOM_STEP)}
            className="flex h-7 w-7 items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
            title={t("editor:imageViewer.zoomIn")}
            aria-label={t("editor:imageViewer.zoomIn")}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={setFitSize}
            className="flex h-7 w-7 items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
            title={t("editor:imageViewer.fit")}
            aria-label={t("editor:imageViewer.fit")}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={setActualSize}
            className="flex h-7 w-7 items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
            title={t("editor:imageViewer.actualSize")}
            aria-label={t("editor:imageViewer.actualSize")}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div
          className={cn(
            "flex min-h-full min-w-full items-center justify-center p-6",
            "bg-[radial-gradient(circle_at_center,rgb(255_255_255_/_0.035)_1px,transparent_1px)] [background-size:18px_18px]",
          )}
        >
          {error ? (
            <div className="max-w-md rounded border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4 text-sm text-[var(--color-text-secondary)]">
              {t("editor:imageViewer.loadError")}
            </div>
          ) : src ? (
            <img
              src={src}
              alt={fileName}
              draggable={false}
              onLoad={(event) => {
                const image = event.currentTarget;
                setDimensions({
                  width: image.naturalWidth,
                  height: image.naturalHeight,
                });
              }}
              className={cn(
                "block select-none rounded-sm",
                mode === "fit"
                  ? "max-h-[calc(100vh-9rem)] max-w-full object-contain"
                  : "max-w-none",
              )}
              style={
                mode === "custom"
                  ? { width: `${Math.round((dimensions.width ?? 0) * zoom)}px` }
                  : undefined
              }
            />
          ) : (
            <div className="text-sm text-[var(--color-text-tertiary)]">
              {t("editor:imageViewer.loading")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

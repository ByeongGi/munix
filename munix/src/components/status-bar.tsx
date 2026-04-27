import { useTranslation } from "react-i18next";
import {
  Check,
  CircleDashed,
  CircleAlert,
  CircleDot,
  Loader2,
  Database,
  Folder,
} from "lucide-react";
import { useEditorStore, type SaveStatus } from "@/store/editor-store";
import { useVaultStore } from "@/store/vault-store";
import { useSearchStore } from "@/store/search-store";
import { useBacklinkStore } from "@/store/backlink-store";
import { useTagStore } from "@/store/tag-store";
import { cn } from "@/lib/cn";

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

interface SaveStatusViewProps {
  status: SaveStatus;
}

function SaveStatusView({ status }: SaveStatusViewProps) {
  const { t } = useTranslation(["panels"]);
  const map = {
    idle: { Icon: Check, label: t("panels:statusBar.save.idle"), tone: "muted" },
    dirty: {
      Icon: CircleDot,
      label: t("panels:statusBar.save.dirty"),
      tone: "muted",
    },
    saving: {
      Icon: Loader2,
      label: t("panels:statusBar.save.saving"),
      tone: "muted",
      spin: true,
    },
    saved: { Icon: Check, label: t("panels:statusBar.save.saved"), tone: "muted" },
    error: {
      Icon: CircleAlert,
      label: t("panels:statusBar.save.error"),
      tone: "danger",
    },
    conflict: {
      Icon: CircleAlert,
      label: t("panels:statusBar.save.conflict"),
      tone: "warning",
    },
  } as const;
  const e = map[status.kind];
  const Icon = e.Icon;
  return (
    <span
      className={cn(
        "flex items-center gap-1",
        e.tone === "danger" && "text-[var(--color-danger,_#EF4444)]",
        e.tone === "warning" && "text-[var(--color-warning,_#FB923C)]",
      )}
    >
      <Icon className={cn("h-3 w-3", "spin" in e && e.spin && "animate-spin")} />
      <span>{e.label}</span>
    </span>
  );
}

/** 하단 status bar — vault 정보 / 현재 파일 / 자동저장 / 인덱싱 / 단어 글자. */
export function StatusBar() {
  const { t } = useTranslation(["panels"]);
  const info = useVaultStore((s) => s.info);
  const currentPath = useEditorStore((s) => s.currentPath);
  const body = useEditorStore((s) => s.body);
  const saveStatus = useEditorStore((s) => s.status);

  const searchStatus = useSearchStore((s) => s.status);
  const backlinksStatus = useBacklinkStore((s) => s.status);
  const tagsStatus = useTagStore((s) => s.status);

  if (!info) return null;

  const indexing =
    searchStatus === "building" ||
    backlinksStatus === "building" ||
    tagsStatus === "building";

  const words = currentPath ? countWords(body) : null;
  const chars = currentPath ? body.length : null;

  return (
    <div className="relative z-20 flex h-7 shrink-0 items-center gap-3 border-t border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-3 text-[11px] text-[var(--color-text-tertiary)] shadow-[0_-1px_0_rgb(0_0_0_/_0.12)]">
      <span
        className="flex shrink-0 items-center gap-1 font-medium text-[var(--color-text-secondary)]"
        title={info.root}
      >
        <Folder className="h-3 w-3" />
        {info.name}
      </span>
      <span className="hidden shrink-0 truncate font-mono text-[10px] sm:block">
        {info.root}
      </span>
      {currentPath && (
        <>
          <span aria-hidden className="opacity-40">·</span>
          <span className="flex-1 truncate font-mono" title={currentPath}>
            {currentPath}
          </span>
        </>
      )}
      {!currentPath && <span className="flex-1" />}
      <SaveStatusView status={saveStatus} />
      {indexing && (
        <span className="flex shrink-0 items-center gap-1">
          <Database className="h-3 w-3" />
          <span>{t("panels:statusBar.indexing")}</span>
          <CircleDashed className="h-3 w-3 animate-spin" />
        </span>
      )}
      {words !== null && (
        <span className="shrink-0">
          {words.toLocaleString()} {t("panels:statusBar.words")}
        </span>
      )}
      {chars !== null && (
        <span className="shrink-0">
          {chars.toLocaleString()} {t("panels:statusBar.chars")}
        </span>
      )}
    </div>
  );
}

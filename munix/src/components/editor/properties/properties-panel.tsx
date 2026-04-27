import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import { usePropertyTypesStore } from "@/store/property-types-store";
import type { PropertyType } from "@/types/frontmatter";
import { PropertyRow } from "./property-row";
import { AddProperty } from "./add-property";
import { cn } from "@/lib/cn";
import { defaultValueForPropertyType } from "@/lib/property-defaults";

type FmRecord = Record<string, unknown>;

function triggerSave() {
  const store = useEditorStore.getState();
  store.requestSave?.();
  void store.flushSave?.();
}

/**
 * Properties panel — frontmatter visual editor.
 *
 * **마운트 정책 (NotFoundError 방지)**
 * frontmatter null ↔ {} 토글 시 `return null` 로 panel mount/unmount 를 시키면
 * `---` 트리거 직후 PM 의 tr commit 과 React 의 layout effect commit 이 같은
 * tick 에 일어나면서 WebKit `NotFoundError: The object can not be found here`
 * 발생 (PM plugin views — DragHandle, BubbleMenu — 가 같은 부모 div 안에서
 * imperative DOM 조작 + React 의 동시 reconcile 충돌).
 *
 * 해결: 패널 컨테이너는 **항상 마운트**, frontmatter 가 null 일 땐 `hidden`
 * 클래스로 숨김. AddProperty 도 항상 마운트 → editing 상태 진입 시 input 만
 * 새로 mount (그건 작은 leaf node 라 race 없음).
 */
export function PropertiesPanel() {
  const { t } = useTranslation(["properties"]);
  const currentPath = useEditorStore((s) => s.currentPath);
  const frontmatter = useEditorStore((s) => s.frontmatter);
  const setFrontmatter = useEditorStore((s) => s.setFrontmatter);

  const resolve = usePropertyTypesStore((s) => s.resolve);
  const setType = usePropertyTypesStore((s) => s.setType);

  // ADR-030: panel 은 항상 마운트, frontmatter null 또는 currentPath null 일 때
  // hidden 토글만. workspace store swap 시점에 mount/unmount 가 일어나면
  // PM plugin views (DragHandle, BubbleMenu) 와 React reconcile 충돌 + 시각적 깜빡임.
  const visible = currentPath !== null && frontmatter !== null;

  const entries = useMemo(
    () =>
      Object.entries((frontmatter ?? {}) as FmRecord) as [string, unknown][],
    [frontmatter],
  );

  const fm = (frontmatter ?? {}) as FmRecord;

  const handleValueChange = (key: string, raw: unknown, flush: boolean) => {
    const next: FmRecord = { ...fm };
    next[key] = raw;
    setFrontmatter(next);
    if (flush) triggerSave();
    else useEditorStore.getState().requestSave?.();
  };

  const handleDelete = (key: string) => {
    const next: FmRecord = { ...fm };
    delete next[key];
    setFrontmatter(Object.keys(next).length === 0 ? null : next);
    triggerSave();
  };

  const handleTypeChange = (key: string, type: PropertyType) => {
    void setType(key, type);
  };

  const handleAdd = (key: string, type: PropertyType) => {
    const next: FmRecord = { ...fm };
    next[key] = defaultValueForPropertyType(type);
    setFrontmatter(next);
    void setType(key, type);
    triggerSave();
  };

  const handleDeletePanel = () => {
    setFrontmatter(null);
    triggerSave();
  };

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const isField =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable;
    if (isField) return;
    if (entries.length > 0) return;
    if (event.key !== "Backspace" && event.key !== "Delete") return;

    event.preventDefault();
    handleDeletePanel();
  };

  return (
    <div
      className={cn(
        "mx-12 mt-3 mb-1 rounded-md border",
        "border-[var(--color-border-primary)] bg-[var(--color-bg-primary)]",
        !visible && "hidden",
      )}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onKeyDown={handlePanelKeyDown}
    >
      <div className="flex h-7 items-center gap-2 border-b border-[var(--color-border-primary)] px-2.5">
        <span
          className={cn(
            "text-[11px] font-medium",
            "text-[var(--color-text-secondary)]",
          )}
        >
          {t("properties:heading")}
        </span>
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          {entries.length}
        </span>
        <button
          type="button"
          onClick={handleDeletePanel}
          className={cn(
            "ml-auto rounded p-0.5",
            "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-secondary)]",
          )}
          aria-label={t("properties:deletePanel")}
          title={t("properties:deletePanel")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {entries.length > 0 && (
        <div className="px-1.5 py-1">
          {entries.map(([key, value]) => (
            <PropertyRow
              key={key}
              fieldKey={key}
              value={value}
              type={resolve(key, value)}
              onValueChange={(raw, flush) => handleValueChange(key, raw, flush)}
              onDelete={() => handleDelete(key)}
              onTypeChange={(type) => handleTypeChange(key, type)}
            />
          ))}
        </div>
      )}
      <div
        className={cn(
          entries.length > 0
            ? "border-t border-[var(--color-border-primary)] px-1.5 py-1"
            : "px-1.5 py-1",
        )}
      >
        <AddProperty existingKeys={entries.map(([k]) => k)} onAdd={handleAdd} />
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { useEditorStore } from "@/store/editor-store";
import { KNOWN_PROPERTY_TYPES, type PropertyType } from "@/types/frontmatter";

interface AddPropertyProps {
  existingKeys: string[];
  onAdd: (key: string, type: PropertyType) => void;
  enablePendingFocus?: boolean;
}

export function AddProperty({
  existingKeys,
  onAdd,
  enablePendingFocus = true,
}: AddPropertyProps) {
  const { t } = useTranslation(["properties"]);
  const [editingName, setEditingName] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [type, setType] = useState<PropertyType>("text");

  // pendingPropertyFocus 신호 (─── 트리거 등) 받으면 편집 모드 진입.
  // 포커스 자체는 입력 element 의 autoFocus 가 처리 — 타이머 불필요.
  const pendingPropertyFocus = useEditorStore((s) => s.pendingPropertyFocus);
  const setPendingPropertyFocus = useEditorStore(
    (s) => s.setPendingPropertyFocus,
  );

  useEffect(() => {
    if (!enablePendingFocus) return;
    if (pendingPropertyFocus) {
      setEditingName(true);
      setTypeMenuOpen(true);
      setPendingPropertyFocus(false);
    }
  }, [enablePendingFocus, pendingPropertyFocus, setPendingPropertyFocus]);

  const commit = () => {
    const key = draft.trim();
    if (key && !existingKeys.includes(key)) {
      onAdd(key, type);
    }
    setDraft("");
    setType("text");
    setEditingName(false);
    setTypeMenuOpen(false);
  };

  if (!editingName) {
    return (
      <button
        type="button"
        onClick={() => {
          setEditingName(true);
          setTypeMenuOpen(true);
        }}
        className={cn(
          "flex h-7 w-full items-center gap-1.5 rounded px-1.5 text-xs",
          "border border-dashed border-[var(--color-border-secondary)]",
          "text-[var(--color-text-tertiary)] hover:border-[var(--color-border-primary)] hover:bg-[var(--color-bg-hover)]",
          "hover:text-[var(--color-text-secondary)]",
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        {t("properties:add")}
      </button>
    );
  }

  return (
    <div className="relative flex h-7 items-center gap-1.5 px-1.5">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setTypeMenuOpen((v) => !v)}
        className={cn(
          "rounded border border-[var(--color-border-secondary)] px-1.5 py-0.5 text-[11px]",
          "text-[var(--color-text-tertiary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-secondary)]",
        )}
      >
        {t(`properties:types.${type}`, { defaultValue: type })}
      </button>
      {typeMenuOpen && (
        <TypeMenu
          current={type}
          onSelect={(next) => {
            setType(next);
            setTypeMenuOpen(false);
          }}
        />
      )}
      <input
        autoFocus
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft("");
            setEditingName(false);
            setTypeMenuOpen(false);
          }
        }}
        onBlur={commit}
        placeholder={t("properties:placeholder.newKey")}
        className={cn(
          "h-6 flex-1 rounded border px-1.5 text-xs outline-none",
          "border-[var(--color-accent)] bg-[var(--color-bg-tertiary)]",
          "focus:border-[var(--color-accent)]",
        )}
      />
    </div>
  );
}

function TypeMenu({
  current,
  onSelect,
}: {
  current: PropertyType;
  onSelect: (type: PropertyType) => void;
}) {
  const { t } = useTranslation(["properties"]);

  return (
    <div
      className={cn(
        "absolute left-1.5 top-7 z-50 w-36 rounded-md border p-1 shadow-lg",
        "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary-solid)]",
      )}
    >
      {KNOWN_PROPERTY_TYPES.map((item) => (
        <button
          key={item}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(item)}
          className={cn(
            "flex h-7 w-full items-center rounded px-2 text-left text-xs",
            current === item
              ? "bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
          )}
        >
          {t(`properties:types.${item}`, { defaultValue: item })}
        </button>
      ))}
    </div>
  );
}

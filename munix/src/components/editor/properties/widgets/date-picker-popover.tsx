import type { ReactNode } from "react";
import { useState } from "react";
import { setHours, setMinutes } from "date-fns";
import { useTranslation } from "react-i18next";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import { cn } from "@/lib/cn";

interface DatePickerPopoverProps {
  value: string;
  onCommit: (value: string) => void;
  onCancel?: () => void;
  withTime?: boolean;
}

type PickerTab = "date" | "time";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toDatetimeValue(date: Date): string {
  return `${toDateValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDate(value: string): Date | null {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = (datePart ?? "").split("-").map(Number);
  if (!year || !month || !day) return null;

  const [hour = 0, minute = 0] = (timePart ?? "00:00").split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function defaultSelectedDate(value: string, withTime: boolean): Date {
  const parsed = parseDate(value);
  if (parsed) return parsed;

  const now = new Date();
  if (withTime) return setHours(setMinutes(now, 0), now.getHours());
  return now;
}

const hours = Array.from({ length: 24 }, (_, i) => i);
const minutes = Array.from({ length: 60 }, (_, i) => i);

export function DatePickerPopover({
  value,
  onCommit,
  onCancel,
  withTime = false,
}: DatePickerPopoverProps) {
  const { t } = useTranslation("properties");
  const [tab, setTab] = useState<PickerTab>("date");
  const [draft, setDraft] = useState(() =>
    defaultSelectedDate(value, withTime),
  );

  const commit = () => {
    onCommit(withTime ? toDatetimeValue(draft) : toDateValue(draft));
  };

  return (
    <div
      className={cn(
        "absolute left-0 top-7 z-50 w-72 rounded-md border p-2 shadow-lg",
        "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary-solid)]",
      )}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => event.stopPropagation()}
    >
      {withTime && (
        <div className="mb-2 grid grid-cols-2 rounded border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] p-0.5">
          <PickerTabButton
            active={tab === "date"}
            onClick={() => setTab("date")}
          >
            {t("picker.date")}
          </PickerTabButton>
          <PickerTabButton
            active={tab === "time"}
            onClick={() => setTab("time")}
          >
            {t("picker.time")}
          </PickerTabButton>
        </div>
      )}

      {tab === "date" ? (
        <DatePicker
          inline
          selected={draft}
          onChange={(date: Date | null | [Date | null, Date | null]) => {
            if (!date || Array.isArray(date)) return;
            setDraft(
              setHours(setMinutes(date, draft.getMinutes()), draft.getHours()),
            );
          }}
          calendarClassName="munix-date-picker"
        />
      ) : (
        <TimeColumns
          value={draft}
          labels={{
            hour: t("picker.hour"),
            minute: t("picker.minute"),
          }}
          onChange={setDraft}
        />
      )}

      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[var(--color-border-primary)] pt-2">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={commit}
          className="h-8 rounded bg-[var(--color-accent)] text-xs font-medium text-[var(--color-text-on-accent)] hover:opacity-90"
        >
          {t("picker.set")}
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onCancel}
          className="h-8 rounded border border-[var(--color-border-secondary)] bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
        >
          {t("picker.cancel")}
        </button>
      </div>
    </div>
  );
}

function PickerTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "h-7 rounded text-xs",
        active
          ? "bg-[var(--color-accent)] text-[var(--color-text-on-accent)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
      )}
    >
      {children}
    </button>
  );
}

function TimeColumns({
  value,
  labels,
  onChange,
}: {
  value: Date;
  labels: {
    hour: string;
    minute: string;
  };
  onChange: (date: Date) => void;
}) {
  const setHour = (hour: number) => onChange(setHours(value, hour));
  const setMinute = (minute: number) => onChange(setMinutes(value, minute));

  return (
    <div>
      <div className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
        {pad(value.getHours())}:{pad(value.getMinutes())}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TimeColumn
          label={labels.hour}
          values={hours}
          selected={value.getHours()}
          onSelect={setHour}
        />
        <TimeColumn
          label={labels.minute}
          values={minutes}
          selected={value.getMinutes()}
          onSelect={setMinute}
        />
      </div>
    </div>
  );
}

function TimeColumn({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string;
  values: number[];
  selected: number;
  onSelect: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium text-[var(--color-text-tertiary)]">
        {label}
      </div>
      <div className="max-h-44 overflow-y-auto rounded border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] p-1">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(value)}
            className={cn(
              "flex h-7 w-full items-center justify-center rounded text-xs",
              selected === value
                ? "bg-[var(--color-accent)] text-[var(--color-text-on-accent)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
            )}
          >
            {pad(value)}
          </button>
        ))}
      </div>
    </div>
  );
}

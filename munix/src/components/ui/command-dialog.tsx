import type {
  ChangeEventHandler,
  KeyboardEventHandler,
  ReactNode,
  RefObject,
} from "react";

import { cn } from "@/lib/cn";

interface CommandDialogProps {
  icon: ReactNode;
  inputRef: RefObject<HTMLInputElement | null>;
  listRef: RefObject<HTMLUListElement | null>;
  value: string;
  placeholder: string;
  children: ReactNode;
  footer: ReactNode;
  trailing?: ReactNode;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onClose: () => void;
  onKeyDown: KeyboardEventHandler<HTMLInputElement>;
}

export function CommandDialog({
  icon,
  inputRef,
  listRef,
  value,
  placeholder,
  children,
  footer,
  trailing,
  onChange,
  onClose,
  onKeyDown,
}: CommandDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative w-full max-w-lg rounded-lg border shadow-2xl",
          "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary-solid)]",
        )}
      >
        <div className="flex items-center gap-2 border-b border-[var(--color-border-primary)] px-3 py-2">
          {icon}
          <input
            ref={inputRef}
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-tertiary)]"
          />
          {trailing}
        </div>
        <ul ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {children}
        </ul>
        {footer}
      </div>
    </div>
  );
}

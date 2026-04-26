import { tv } from "tailwind-variants";

export const surface = tv({
  base: "border-border bg-bg-panel text-text",
  variants: {
    elevated: {
      true: "bg-bg-elevated shadow-popover",
      false: "",
    },
  },
  defaultVariants: {
    elevated: false,
  },
});

export const iconButton = tv({
  base: [
    "inline-flex shrink-0 items-center justify-center rounded-md",
    "text-text-subtle transition-colors",
    "hover:bg-bg-hovered hover:text-text",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  variants: {
    size: {
      xs: "h-6 w-6",
      sm: "h-7 w-7",
      md: "h-8 w-8",
    },
    active: {
      true: "bg-bg-hovered text-text",
      false: "",
    },
  },
  defaultVariants: {
    size: "sm",
    active: false,
  },
});

export const listRow = tv({
  base: [
    "flex w-full min-w-0 items-center gap-2 rounded-md",
    "text-text-muted transition-colors",
    "hover:bg-bg-hovered hover:text-text",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40",
  ],
  variants: {
    density: {
      compact: "min-h-6 px-2 py-1 text-xs",
      default: "min-h-7 px-2 py-1.5 text-sm",
    },
    active: {
      true: "bg-bg-selected text-text",
      false: "",
    },
  },
  defaultVariants: {
    density: "default",
    active: false,
  },
});

export const textInput = tv({
  base: [
    "min-w-0 rounded-md border border-border-muted bg-bg-panel",
    "text-text outline-none transition-colors",
    "placeholder:text-text-subtle",
    "hover:border-border",
    "focus:border-focus focus:bg-bg-muted focus:ring-2 focus:ring-focus/20",
  ],
  variants: {
    size: {
      sm: "h-6 px-1.5 text-xs",
      md: "h-8 px-2 text-sm",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

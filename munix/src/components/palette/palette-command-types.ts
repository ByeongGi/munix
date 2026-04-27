import type { LucideIcon } from "lucide-react";

export interface PaletteCommand {
  id: string;
  title: string;
  icon: LucideIcon;
  shortcut?: string;
  keywords?: string[];
  run: () => void;
}

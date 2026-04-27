import { Monitor, Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/store/theme-store";
import type {
  PaletteCommand,
  PaletteCommandBuilderContext,
} from "./palette-command-types";

export function createThemeCommands({
  t,
  onClose,
}: PaletteCommandBuilderContext): PaletteCommand[] {
  return [
    {
      id: "theme-system",
      title: t("palette:commands.themeSystem.title"),
      icon: Monitor,
      keywords: ["theme", "system", "auto"],
      run: () => {
        onClose();
        useThemeStore.getState().set("system");
      },
    },
    {
      id: "theme-light",
      title: t("palette:commands.themeLight.title"),
      icon: Sun,
      keywords: ["theme", "light"],
      run: () => {
        onClose();
        useThemeStore.getState().set("light");
      },
    },
    {
      id: "theme-dark",
      title: t("palette:commands.themeDark.title"),
      icon: Moon,
      keywords: ["theme", "dark"],
      run: () => {
        onClose();
        useThemeStore.getState().set("dark");
      },
    },
  ];
}

import { createAppCommands } from "./palette-app-commands";
import { createFileCommands } from "./palette-file-commands";
import { createSidebarCommands } from "./palette-sidebar-commands";
import { createTabCommands } from "./palette-tab-commands";
import { createThemeCommands } from "./palette-theme-commands";
import { createVaultCommands } from "./palette-vault-commands";
import { createWorkspaceCommands } from "./palette-workspace-commands";
import type {
  PaletteCommand,
  PaletteCommandBuilderContext,
} from "./palette-command-types";

export function createPaletteCommands(
  context: PaletteCommandBuilderContext,
): PaletteCommand[] {
  return [
    ...createFileCommands(context),
    ...createTabCommands(context),
    ...createSidebarCommands(context),
    ...createVaultCommands(context),
    ...createThemeCommands(context),
    ...createAppCommands(context),
    ...createWorkspaceCommands(context),
  ];
}

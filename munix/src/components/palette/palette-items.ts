import type { SearchHit } from "@/lib/search-index";
import type { PaletteCommand } from "@/components/palette/use-palette-commands";

export interface HeadingItem {
  kind: "heading";
  text: string;
  level: number;
  index: number;
}

export interface TagItem {
  kind: "tag";
  tag: string;
  fileCount: number;
}

export interface LineItem {
  kind: "line";
  lineNum: number;
}

export interface CommandItem {
  kind: "command";
  cmd: PaletteCommand;
}

export interface FileItem {
  kind: "file";
  hit: SearchHit;
}

export type PaletteItem =
  | CommandItem
  | FileItem
  | HeadingItem
  | TagItem
  | LineItem;

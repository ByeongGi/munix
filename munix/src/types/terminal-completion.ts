export type TerminalSuggestionKind =
  | "command"
  | "subcommand"
  | "option"
  | "path"
  | "history"
  | "script";

export interface TerminalCompletionSuggestion {
  name: string;
  description?: string;
  insertValue: string;
  kind: TerminalSuggestionKind;
  replacementStart: number;
  replacementEnd: number;
  priority: number;
}

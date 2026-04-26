/**
 * Keymap 정규화/표기 유틸.
 *
 * - 정규화 형태: 토큰을 `+`로 연결한 소문자 문자열.
 *   modifier 순서는 `mod → alt → shift`로 강제 (modifier set 동등성을 문자열 비교로 판단).
 *   예: "mod+shift+k", "alt+arrowup", "f2"
 * - main key 토큰은 가능하면 알파벳·숫자, 그 외 KeyboardEvent.key 의 lowercase.
 *   화살표는 `arrowup/arrowdown/arrowleft/arrowright` 로 통일.
 * - "Mod" 는 macOS=Cmd, 그 외 Ctrl 으로 매칭. 토큰 자체는 plat-agnostic.
 *
 * 표기 형태: OS별로 사람이 읽기 좋은 문자열. UI 전용.
 */

export const MOD_TOKEN = "mod";

const MODIFIER_ORDER: Array<"mod" | "alt" | "shift"> = ["mod", "alt", "shift"];

export type KeymapToken = string; // normalized lowercase token like "mod+shift+k"

/** 정규화된 단축키 문자열을 modifier set + main key 로 분해한다. */
export function parseKeymap(
  token: string,
): { modifiers: Set<"mod" | "alt" | "shift">; key: string } | null {
  if (!token) return null;
  const parts = token
    .toLowerCase()
    .split("+")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) return null;

  const modifiers = new Set<"mod" | "alt" | "shift">();
  let mainKey: string | null = null;

  for (const p of parts) {
    if (p === "mod" || p === "cmd" || p === "ctrl" || p === "control") {
      modifiers.add("mod");
    } else if (p === "alt" || p === "option" || p === "opt") {
      modifiers.add("alt");
    } else if (p === "shift") {
      modifiers.add("shift");
    } else {
      // 마지막으로 등장한 비-modifier 토큰을 main key 로 사용
      mainKey = p;
    }
  }
  if (!mainKey) return null;
  return { modifiers, key: normalizeMainKey(mainKey) };
}

/** main key 토큰을 정규화 — `KeyboardEvent.key` 와도 비교 가능한 형태. */
function normalizeMainKey(raw: string): string {
  const k = raw.toLowerCase();
  // 화살표 별칭
  if (k === "up" || k === "↑") return "arrowup";
  if (k === "down" || k === "↓") return "arrowdown";
  if (k === "left" || k === "←") return "arrowleft";
  if (k === "right" || k === "→") return "arrowright";
  if (k === "esc") return "escape";
  if (k === "del") return "delete";
  if (k === "ret" || k === "return") return "enter";
  if (k === "space" || k === " ") return "space";
  return k;
}

/** modifier set + main key 를 정규화 문자열로 직렬화. */
export function serializeKeymap(
  modifiers: Set<"mod" | "alt" | "shift">,
  key: string,
): string {
  const parts: string[] = [];
  for (const m of MODIFIER_ORDER) {
    if (modifiers.has(m)) parts.push(m);
  }
  parts.push(normalizeMainKey(key));
  return parts.join("+");
}

/** 정규화 — 입력 문자열을 표준 형태로 다시 직렬화. 잘못된 형식이면 null. */
export function normalizeKeymap(token: string): string | null {
  const parsed = parseKeymap(token);
  if (!parsed) return null;
  return serializeKeymap(parsed.modifiers, parsed.key);
}

/** 두 정규화 문자열이 같은 단축키인지 비교 (대소문자/순서 무관). */
export function keymapsEqual(a: string, b: string): boolean {
  return normalizeKeymap(a) === normalizeKeymap(b);
}

/**
 * KeyboardEvent → 정규화된 keymap 토큰으로 변환.
 *
 * - main key 가 modifier 자체(Shift/Alt/Meta/Control)면 null 을 돌려준다 (chord 미완성).
 * - `event.key` 의 lowercase 를 main 으로 사용하되, 알파벳일 때는 단일 글자, 그 외 키이름 그대로.
 *   - "a"~"z", "0"~"9" → 그대로
 *   - "ArrowUp" → "arrowup"
 *   - "F2" → "f2"
 *   - "Enter" → "enter"
 *   - 기호 (예: ",", "/") → 그대로
 */
export function eventToKeymap(event: KeyboardEvent): string | null {
  const k = event.key;
  if (
    k === "Control" ||
    k === "Meta" ||
    k === "Alt" ||
    k === "Shift" ||
    k === "AltGraph"
  ) {
    return null;
  }

  const modifiers = new Set<"mod" | "alt" | "shift">();
  if (event.metaKey || event.ctrlKey) modifiers.add("mod");
  if (event.altKey) modifiers.add("alt");
  if (event.shiftKey) modifiers.add("shift");

  return serializeKeymap(modifiers, k);
}

/** 환경이 macOS 인지 추정 (UI 표기 분기 용). */
export function isMac(): boolean {
  if (typeof navigator === "undefined") return true;
  // navigator.platform 은 deprecated 지만 Tauri 환경에서는 안정적.
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

/** 정규화 토큰을 사람이 읽는 형태로 표기 ("mod+shift+k" → "⌘⇧K" / "Ctrl+Shift+K"). */
export function formatKeymap(token: string, opts?: { mac?: boolean }): string {
  const parsed = parseKeymap(token);
  if (!parsed) return token;
  const mac = opts?.mac ?? isMac();
  const parts: string[] = [];

  if (parsed.modifiers.has("mod")) parts.push(mac ? "⌘" : "Ctrl");
  if (parsed.modifiers.has("alt")) parts.push(mac ? "⌥" : "Alt");
  if (parsed.modifiers.has("shift")) parts.push(mac ? "⇧" : "Shift");

  parts.push(formatMainKey(parsed.key));
  return mac ? parts.join("") : parts.join("+");
}

function formatMainKey(key: string): string {
  switch (key) {
    case "arrowup":
      return "↑";
    case "arrowdown":
      return "↓";
    case "arrowleft":
      return "←";
    case "arrowright":
      return "→";
    case "enter":
      return "Enter";
    case "escape":
      return "Esc";
    case "backspace":
      return "Backspace";
    case "delete":
      return "Delete";
    case "tab":
      return "Tab";
    case "space":
      return "Space";
    case ",":
      return ",";
    case ".":
      return ".";
    case "/":
      return "/";
    case "\\":
      return "\\";
    case "[":
      return "[";
    case "]":
      return "]";
    case "=":
      return "=";
    case "-":
      return "-";
    default:
      // 알파벳·숫자·기호 1글자는 대문자 (display).
      // 함수키 (f1~f12) 는 대문자로.
      if (/^f([1-9]|1[0-2])$/.test(key)) return key.toUpperCase();
      if (key.length === 1) return key.toUpperCase();
      return key;
  }
}

/** 사용자가 입력 가능한 keymap 인지 — main key 가 비어있지 않고 modifier 만으로 구성되지 않음. */
export function isCompleteKeymap(token: string): boolean {
  const parsed = parseKeymap(token);
  return parsed != null && parsed.key.length > 0;
}

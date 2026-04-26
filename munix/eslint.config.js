// @ts-check
/**
 * ESLint flat config for Munix.
 *
 * Goals:
 * - TypeScript + React 19 baseline
 * - react-hooks / react-refresh enforcement
 * - Tolerant baseline so Phase 0 doesn't block existing code
 *   (strictness can be ratcheted up in a follow-up PR)
 *
 * Note: kebab-case file naming is enforced by convention (CLAUDE.md),
 * not by an ESLint rule.
 */

import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

// Minimal browser/node globals we actually use. Avoids depending on the
// `globals` package, which is not installed.
const browserGlobals = {
  window: "readonly",
  document: "readonly",
  navigator: "readonly",
  console: "readonly",
  fetch: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  HTMLElement: "readonly",
  HTMLInputElement: "readonly",
  HTMLDivElement: "readonly",
  HTMLButtonElement: "readonly",
  HTMLTextAreaElement: "readonly",
  HTMLAnchorElement: "readonly",
  HTMLImageElement: "readonly",
  Element: "readonly",
  Node: "readonly",
  Event: "readonly",
  KeyboardEvent: "readonly",
  MouseEvent: "readonly",
  PointerEvent: "readonly",
  DragEvent: "readonly",
  ClipboardEvent: "readonly",
  FocusEvent: "readonly",
  InputEvent: "readonly",
  CustomEvent: "readonly",
  File: "readonly",
  FileReader: "readonly",
  Blob: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  FormData: "readonly",
  AbortController: "readonly",
  AbortSignal: "readonly",
  MutationObserver: "readonly",
  ResizeObserver: "readonly",
  IntersectionObserver: "readonly",
  requestAnimationFrame: "readonly",
  cancelAnimationFrame: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  queueMicrotask: "readonly",
  structuredClone: "readonly",
  crypto: "readonly",
  performance: "readonly",
  getComputedStyle: "readonly",
  matchMedia: "readonly",
};

const nodeGlobals = {
  process: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  Buffer: "readonly",
  global: "readonly",
};

export default [
  // Global ignores
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "src-tauri/target/**",
      "src-tauri/gen/**",
      "coverage/**",
      "*.min.js",
      "public/**",
    ],
  },

  // TS + React (app source)
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        // Don't use type-aware linting yet — too slow / too strict for baseline.
        // project: false,
      },
      globals: {
        ...browserGlobals,
        ...nodeGlobals,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // ── TypeScript ────────────────────────────────────────────
      // Disable core rule in favor of TS-aware version
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": [
        "warn",
        { "ts-expect-error": "allow-with-description", "ts-ignore": true },
      ],
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // ── React Hooks ───────────────────────────────────────────
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // ── React Refresh (HMR friendliness) ──────────────────────
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // ── General hygiene (loose baseline) ──────────────────────
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-console": "off", // dev allowed; prod stripping is a separate concern
      "no-debugger": "warn",
      "prefer-const": "warn",
      "no-undef": "off", // TS handles this; avoids false positives on DOM/Node types
      "no-redeclare": "off", // TS overload signatures
    },
  },

  // Vite / Tauri config files (Node context)
  {
    files: ["*.config.{ts,js,mjs}", "vite.config.ts", "vitest.config.ts"],
    languageOptions: {
      globals: { ...nodeGlobals },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },

  // Test files — relax rules
  {
    files: ["src/**/*.{test,spec}.{ts,tsx}", "src/**/__tests__/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...browserGlobals,
        ...nodeGlobals,
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        vi: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];

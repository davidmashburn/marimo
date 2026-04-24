/* Copyright 2026 Marimo. All rights reserved. */

import type { LanguageName } from "@uiw/codemirror-extensions-langs";
import { langs } from "@uiw/codemirror-extensions-langs";

/**
 * User-facing aliases and legacy names (from earlier marimo versions) that map
 * to a {@link LanguageName} in `@uiw/codemirror-extensions-langs` or a
 * built-in special case.
 *
 * The uiw `langs` key set is the source of truth; this map only provides
 * spelling variants (e.g. `javascript` → `js`, SQL dialects → `sql`).
 */
export const WRAPPED_TEXT_SYNTAX_ALIASES: Readonly<Record<string, LanguageName>> =
  {
    // Shell (legacy used bash/sh/shell for the same mode)
    shell: "sh",
    // Friendly names that differ from the `langs` id
    python: "py",
    javascript: "js",
    typescript: "ts",
    golang: "go",
    // SQL: uiw exposes `sql` (StandardSQL); map common dialect names
    mysql: "sql",
    postgres: "sql",
    postgresql: "sql",
    sqlite: "sql",
    powershell: "ps1",
    ruby: "rb",
    rust: "rs",
  };

const EXTRA_SPECIAL = new Set<string>(["http", "dockerfile"]);

let cachedAllIds: ReadonlyArray<string> | null = null;

/**
 * Resolves a `syntax_language` from config to a {@link loadLanguage} id, a
 * built-in stream parser, or `null` if unknown.
 */
export function resolveWrappedTextSyntaxLanguage(
  raw: string,
): "http" | "dockerfile" | LanguageName | null {
  const s = raw.trim();
  if (s.length === 0) {
    return null;
  }
  if (s === "http") {
    return "http";
  }
  if (s === "dockerfile") {
    return "dockerfile";
  }
  if (s in langs) {
    return s as LanguageName;
  }
  if (s in WRAPPED_TEXT_SYNTAX_ALIASES) {
    const mapped = WRAPPED_TEXT_SYNTAX_ALIASES[s];
    if (mapped !== undefined) {
      return mapped;
    }
  }
  const sl = s.toLowerCase();
  if (sl in langs) {
    return sl as LanguageName;
  }
  if (sl in WRAPPED_TEXT_SYNTAX_ALIASES) {
    const mappedLower = WRAPPED_TEXT_SYNTAX_ALIASES[sl];
    if (mappedLower !== undefined) {
      return mappedLower;
    }
  }
  return null;
}

export function isValidWrappedTextSyntaxLanguage(raw: string): boolean {
  return resolveWrappedTextSyntaxLanguage(raw) !== null;
}

/**
 * All values accepted in `syntax_language` (every `LanguageName` id, special
 * cases, and alias strings) for UIs and validation.
 */
export function getAllWrappedTextSyntaxLanguageIds(): ReadonlyArray<string> {
  if (cachedAllIds) {
    return cachedAllIds;
  }
  const all = new Set<string>([...Object.keys(langs), ...EXTRA_SPECIAL]);
  for (const k of Object.keys(WRAPPED_TEXT_SYNTAX_ALIASES)) {
    all.add(k);
  }
  cachedAllIds = [...all].toSorted((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
  return cachedAllIds;
}

/**
 * @deprecated Use {@link getAllWrappedTextSyntaxLanguageIds} (same data).
 */
export function getRuntimeWrappedTextSyntaxLanguageList(): ReadonlyArray<string> {
  return getAllWrappedTextSyntaxLanguageIds();
}

/** @deprecated Use {@link getAllWrappedTextSyntaxLanguageIds} for new code. */
export const WRAPPED_TEXT_SYNTAX_LANGUAGES: readonly string[] =
  getAllWrappedTextSyntaxLanguageIds();

export type WrappedTextSyntaxLanguage = string;

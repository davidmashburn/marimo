/* Copyright 2026 Marimo. All rights reserved. */

import { once } from "@/utils/once";
import { MarkdownLanguageAdapter } from "./languages/markdown";
import { PythonLanguageAdapter } from "./languages/python";
import { SQLLanguageAdapter } from "./languages/sql/sql";
import type {
  BuiltInLanguageAdapterType,
  LanguageAdapter,
  LanguageAdapterType,
} from "./types";

export {
  createRuntimeWrappedTextLanguageAdapter,
  getRuntimeWrappedTextSyntaxLanguages,
  RuntimeWrappedTextLanguageAdapter,
} from "./languages/wrapped-text";
export type {
  RuntimeWrappedTextLanguageAdapterConfig,
  RuntimeWrappedTextMetadata,
  RuntimeWrappedTextSyntaxLanguage,
} from "./languages/wrapped-text";

const createPythonAdapter = once(() => new PythonLanguageAdapter());
const createMarkdownAdapter = once(() => new MarkdownLanguageAdapter());
const createSqlAdapter = once(() => new SQLLanguageAdapter());

export const RESERVED_WRAPPED_TEXT_FUNCTION_NAMES = [
  "mo.md",
  "mo.sql",
] as const;

const customLanguageAdapters = new Map<LanguageAdapterType, LanguageAdapter>();

export const LanguageAdapters: Record<BuiltInLanguageAdapterType, LanguageAdapter> = {
  get python() { return createPythonAdapter(); },
  get markdown() { return createMarkdownAdapter(); },
  get sql() { return createSqlAdapter(); },
};

export function getLanguageAdapters(): LanguageAdapter[] {
  return [
    ...Object.values(LanguageAdapters),
    ...customLanguageAdapters.values(),
  ];
}

export function getCustomLanguageAdapters(): LanguageAdapter[] {
  return [...customLanguageAdapters.values()];
}

export function getLanguageAdapter(type: LanguageAdapterType): LanguageAdapter {
  if (type in LanguageAdapters) {
    return LanguageAdapters[type as BuiltInLanguageAdapterType];
  }
  return customLanguageAdapters.get(type) ?? LanguageAdapters.python;
}

export function registerLanguageAdapter(
  adapter: LanguageAdapter,
  opts: { replace?: boolean } = {},
) {
  if (adapter.type in LanguageAdapters) {
    throw new Error(`Cannot replace built-in language adapter: ${adapter.type}`);
  }
  if (!opts.replace && customLanguageAdapters.has(adapter.type)) {
    throw new Error(`Language adapter already registered: ${adapter.type}`);
  }
  customLanguageAdapters.set(adapter.type, adapter);
  return adapter;
}

export function unregisterLanguageAdapter(type: LanguageAdapterType) {
  if (type in LanguageAdapters) {
    throw new Error(`Cannot unregister built-in language adapter: ${type}`);
  }
  customLanguageAdapters.delete(type);
}

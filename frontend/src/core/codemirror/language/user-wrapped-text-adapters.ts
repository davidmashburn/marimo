/* Copyright 2026 Marimo. All rights reserved. */

import type { WrappedTextShape } from "@marimo-team/smart-cells";
import { Logger } from "@/utils/Logger";
import type { WrappedTextAdapterConfig } from "@/core/config/config-schema";
import {
  createRuntimeWrappedTextLanguageAdapter,
  getRuntimeWrappedTextSyntaxLanguages,
  registerLanguageAdapter,
  RESERVED_WRAPPED_TEXT_FUNCTION_NAMES,
  unregisterLanguageAdapter,
} from "./LanguageAdapters";
import type { RuntimeWrappedTextSyntaxLanguage } from "./languages/wrapped-text";
import type { LanguageAdapterType } from "./types";

const FUNCTION_NAME_PATTERN =
  /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)+$/;
const USER_ADAPTER_TYPE_PREFIX = "wrapped-text:";
const RESERVED_FUNCTION_NAMES = new Set<string>(
  RESERVED_WRAPPED_TEXT_FUNCTION_NAMES,
);
const VALID_SYNTAX_LANGUAGES = new Set(getRuntimeWrappedTextSyntaxLanguages());

const managedAdapterTypes = new Set<LanguageAdapterType>();

function getAdapterType(functionName: string): LanguageAdapterType {
  return `${USER_ADAPTER_TYPE_PREFIX}${functionName}`;
}

function isValidFunctionName(functionName: string): boolean {
  return FUNCTION_NAME_PATTERN.test(functionName);
}

function isEnabled(spec: WrappedTextAdapterConfig): boolean {
  return spec.enabled !== false;
}

function getSyntaxLanguage(
  syntaxLanguage: string,
): RuntimeWrappedTextSyntaxLanguage | null {
  if (!VALID_SYNTAX_LANGUAGES.has(syntaxLanguage as RuntimeWrappedTextSyntaxLanguage)) {
    return null;
  }
  return syntaxLanguage as RuntimeWrappedTextSyntaxLanguage;
}

function sanitizeShape(shape: string): WrappedTextShape {
  if (shape === "expression" || shape === "assignment" || shape === "both") {
    return shape;
  }
  return "both";
}

export function syncUserWrappedTextAdapters(
  specs: WrappedTextAdapterConfig[] | undefined,
): void {
  const nextManagedTypes = new Set<LanguageAdapterType>();
  const nextFunctionNames = new Set<string>();

  for (const spec of specs ?? []) {
    if (!isEnabled(spec)) {
      continue;
    }

    const functionName = spec.function_name.trim();
    if (!isValidFunctionName(functionName)) {
      Logger.warn(
        `Skipping wrapped-text adapter with invalid function name: ${functionName}`,
      );
      continue;
    }
    if (RESERVED_FUNCTION_NAMES.has(functionName)) {
      Logger.warn(
        `Skipping wrapped-text adapter for reserved function name: ${functionName}`,
      );
      continue;
    }
    if (nextFunctionNames.has(functionName)) {
      Logger.warn(
        `Skipping duplicate wrapped-text adapter function name: ${functionName}`,
      );
      continue;
    }
    nextFunctionNames.add(functionName);

    const syntaxLanguage = getSyntaxLanguage(spec.syntax_language);
    if (!syntaxLanguage) {
      Logger.warn(
        `Skipping wrapped-text adapter with unsupported syntax language: ${spec.syntax_language}`,
      );
      continue;
    }

    const type = getAdapterType(functionName);
    registerLanguageAdapter(
      createRuntimeWrappedTextLanguageAdapter({
        type,
        functionName,
        shape: sanitizeShape(spec.shape),
        syntaxLanguage,
        defaultQuotePrefix: spec.default_quote_prefix ?? "r",
        defaultAssignmentName:
          spec.default_assignment_name?.trim() || undefined,
      }),
      { replace: true },
    );
    nextManagedTypes.add(type);
  }

  for (const oldType of managedAdapterTypes) {
    if (!nextManagedTypes.has(oldType)) {
      unregisterLanguageAdapter(oldType);
    }
  }

  managedAdapterTypes.clear();
  for (const type of nextManagedTypes) {
    managedAdapterTypes.add(type);
  }
}

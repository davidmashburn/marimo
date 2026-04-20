/* Copyright 2026 Marimo. All rights reserved. */

import { insertTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { css, less, sCSS } from "@codemirror/legacy-modes/mode/css";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { go } from "@codemirror/legacy-modes/mode/go";
import {
  javascript,
  json,
  typescript,
} from "@codemirror/legacy-modes/mode/javascript";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { python } from "@codemirror/legacy-modes/mode/python";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { rust } from "@codemirror/legacy-modes/mode/rust";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import {
  mySQL,
  pgSQL,
  sqlite,
  standardSQL,
} from "@codemirror/legacy-modes/mode/sql";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { html, xml } from "@codemirror/legacy-modes/mode/xml";
import { yaml } from "@codemirror/legacy-modes/mode/yaml";
import { StreamLanguage, type StreamParser } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import {
  type QuotePrefixKind,
  type WrappedTextShape,
  WrappedTextParser,
} from "@marimo-team/smart-cells";
import type { CellId } from "@/core/cells/ids";
import type { CompletionConfig } from "@/core/config/config-schema";
import type { HotkeyProvider } from "@/core/hotkeys/hotkeys";
import {
  WRAPPED_TEXT_SYNTAX_LANGUAGES,
  type WrappedTextSyntaxLanguage,
} from "@/core/language/wrapped-text-syntax";
import type { PlaceholderType } from "../../config/types";
import type { LanguageAdapter, LanguageAdapterType } from "../types";

export interface RuntimeWrappedTextMetadata {
  assignmentName: string | null;
  quotePrefix: QuotePrefixKind;
  kwargs: Array<{ key: string; value: string }>;
}

export type RuntimeWrappedTextSyntaxLanguage = WrappedTextSyntaxLanguage;

export interface RuntimeWrappedTextLanguageAdapterConfig {
  type: LanguageAdapterType;
  functionName: string;
  shape?: WrappedTextShape;
  defaultCode?: string;
  defaultQuotePrefix?: QuotePrefixKind;
  defaultAssignmentName?: string | null;
  syntaxLanguage?: RuntimeWrappedTextSyntaxLanguage;
  extensions?: Extension[];
}

const streamParsers: Record<
  Exclude<RuntimeWrappedTextSyntaxLanguage, "markdown" | "md">,
  StreamParser<unknown>
> = {
  bash: shell,
  sh: shell,
  shell,
  css,
  scss: sCSS,
  less,
  dockerfile: dockerFile,
  go,
  golang: go,
  html,
  javascript,
  js: javascript,
  json,
  mysql: mySQL,
  postgres: pgSQL,
  postgresql: pgSQL,
  powershell: powerShell,
  ps1: powerShell,
  py: python,
  python,
  rb: ruby,
  ruby,
  rs: rust,
  rust,
  sqlite,
  sql: standardSQL,
  toml,
  ts: typescript,
  typescript,
  xml,
  yaml,
  yml: yaml,
};

export function getRuntimeWrappedTextSyntaxLanguages() {
  return [...WRAPPED_TEXT_SYNTAX_LANGUAGES];
}

function getSyntaxExtension(
  syntaxLanguage: RuntimeWrappedTextSyntaxLanguage | undefined,
): Extension[] {
  if (!syntaxLanguage) {
    return [];
  }
  if (syntaxLanguage === "markdown" || syntaxLanguage === "md") {
    return [markdown()];
  }
  return [StreamLanguage.define(streamParsers[syntaxLanguage])];
}

function createDefaultCode(
  functionName: string,
  quotePrefix: QuotePrefixKind,
  assignmentName: string | null,
) {
  const assignment = assignmentName ? `${assignmentName} = ` : "";
  return `${assignment}${functionName}(${quotePrefix}"""\n\n""")`;
}

/**
 * Runtime-configurable language adapter for function calls that wrap text.
 */
export class RuntimeWrappedTextLanguageAdapter
  implements LanguageAdapter<RuntimeWrappedTextMetadata>
{
  private readonly parser: WrappedTextParser<RuntimeWrappedTextMetadata>;
  private readonly extensions: Extension[];

  readonly type: LanguageAdapterType;
  readonly defaultCode: string;
  readonly defaultMetadata: RuntimeWrappedTextMetadata;

  constructor(config: RuntimeWrappedTextLanguageAdapterConfig) {
    const quotePrefix = config.defaultQuotePrefix ?? "r";
    const assignmentName = config.defaultAssignmentName ?? null;
    const defaultMetadata = {
      assignmentName,
      quotePrefix,
      kwargs: [],
    };
    const defaultCode =
      config.defaultCode ??
      createDefaultCode(config.functionName, quotePrefix, assignmentName);

    this.type = config.type;
    this.defaultCode = defaultCode;
    this.defaultMetadata = defaultMetadata;
    this.extensions = [
      ...getSyntaxExtension(config.syntaxLanguage),
      ...(config.extensions ?? []),
    ];

    this.parser = new WrappedTextParser<RuntimeWrappedTextMetadata>({
      type: config.type,
      functionName: config.functionName,
      shape: config.shape ?? "both",
      defaultCode,
      defaultMetadata,
      transformMetadataIn: (metadata, info) => ({
        ...metadata,
        assignmentName: info.assignmentName,
        quotePrefix: info.quotePrefix,
        kwargs: info.kwargs,
      }),
      formatMetadataOut: (code, metadata) => {
        const assignment = metadata.assignmentName
          ? `${metadata.assignmentName} = `
          : "";
        const kwargs =
          metadata.kwargs.length > 0
            ? `, ${metadata.kwargs
                .map(({ key, value }) => `${key}=${value}`)
                .join(", ")}`
            : "";
        const beforeString =
          `${assignment}${config.functionName}(${metadata.quotePrefix}"""\n`;
        return {
          beforeString,
          afterString: `\n"""${kwargs})`,
          metadata,
          code,
        };
      },
      escapeCode: (code) => code.replaceAll('"""', String.raw`\"""`),
    });
  }

  transformIn(pythonCode: string): [string, number, RuntimeWrappedTextMetadata] {
    const result = this.parser.transformIn(pythonCode);
    return [result.code, result.offset, result.metadata];
  }

  transformOut(
    code: string,
    metadata: RuntimeWrappedTextMetadata,
  ): [string, number] {
    const result = this.parser.transformOut(code, metadata);
    return [result.code, result.offset];
  }

  isSupported(pythonCode: string): boolean {
    return this.parser.isSupported(pythonCode);
  }

  getExtension(
    _cellId: CellId,
    _completionConfig: CompletionConfig,
    _hotkeys: HotkeyProvider,
    _placeholderType: PlaceholderType,
  ): Extension[] {
    return [
      ...this.extensions,
      keymap.of([
        {
          key: "Tab",
          run: insertTab,
          preventDefault: true,
        },
      ]),
    ];
  }
}

export function createRuntimeWrappedTextLanguageAdapter(
  config: RuntimeWrappedTextLanguageAdapterConfig,
) {
  return new RuntimeWrappedTextLanguageAdapter(config);
}

/* Copyright 2026 Marimo. All rights reserved. */

import { insertTab } from "@codemirror/commands";
import { StreamLanguage, type StreamParser } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import {
  type LanguageName,
  loadLanguage,
} from "@uiw/codemirror-extensions-langs";
import {
  type QuotePrefixKind,
  type WrappedTextShape,
  WrappedTextParser,
} from "@marimo-team/smart-cells";
import type { CellId } from "@/core/cells/ids";
import { resolveWrappedTextSyntaxLanguage } from "@/core/language/wrapped-text-syntax";
import type { CompletionConfig } from "@/core/config/config-schema";
import type { HotkeyProvider } from "@/core/hotkeys/hotkeys";
import type { WrappedTextSyntaxLanguage } from "@/core/language/wrapped-text-syntax";
import type { PlaceholderType } from "../../config/types";
import type { LanguageAdapter, LanguageAdapterType } from "../types";

export type RuntimeWrappedTextSyntaxLanguage = WrappedTextSyntaxLanguage;

export {
  getAllWrappedTextSyntaxLanguageIds,
  /** @deprecated Use {@link getAllWrappedTextSyntaxLanguageIds}. */
  getAllWrappedTextSyntaxLanguageIds as getRuntimeWrappedTextSyntaxLanguages,
  getRuntimeWrappedTextSyntaxLanguageList,
} from "@/core/language/wrapped-text-syntax";

export interface RuntimeWrappedTextMetadata {
  assignmentName: string | null;
  quotePrefix: QuotePrefixKind;
  kwargs: Array<{ key: string; value: string }>;
}

export interface RuntimeWrappedTextLanguageAdapterConfig {
  type: LanguageAdapterType;
  functionName: string;
  shape?: WrappedTextShape;
  defaultCode?: string;
  defaultQuotePrefix?: QuotePrefixKind;
  defaultAssignmentName?: string | null;
  syntaxLanguage?: string;
  extensions?: Extension[];
}

interface HttpParserState {
  phase: "start" | "headers" | "body";
  startedRequestLine: boolean;
  startedHeader: boolean;
}

const httpStreamParser: StreamParser<HttpParserState> = {
  startState: () => ({
    phase: "start",
    startedRequestLine: false,
    startedHeader: false,
  }),
  token: (stream, state) => {
    if (stream.sol()) {
      state.startedRequestLine = false;
      state.startedHeader = false;
    }
    if (stream.eatSpace()) {
      return null;
    }
    if (stream.match(/^(#|\/\/).*/)) {
      return "comment";
    }
    if (stream.sol() && stream.match(/^\s*$/, false)) {
      stream.skipToEnd();
      if (state.phase === "headers") {
        state.phase = "body";
      }
      return null;
    }
    if (state.phase === "start") {
      if (!state.startedRequestLine && stream.match(/^[A-Z]+(?=\s)/)) {
        state.startedRequestLine = true;
        return "keyword";
      }
      stream.skipToEnd();
      state.phase = "headers";
      return "string.special";
    }
    if (state.phase === "headers") {
      if (!state.startedHeader && stream.match(/^[A-Za-z][A-Za-z0-9-]*(?=\s*:)/)) {
        state.startedHeader = true;
        return "propertyName";
      }
      if (state.startedHeader && stream.match(/^:/)) {
        return "punctuation";
      }
      stream.skipToEnd();
      return "string";
    }
    stream.skipToEnd();
    return null;
  },
};

function getSyntaxExtension(syntaxLanguage: string | undefined): Extension[] {
  if (syntaxLanguage === undefined || syntaxLanguage.length === 0) {
    return [];
  }
  const resolved = resolveWrappedTextSyntaxLanguage(syntaxLanguage);
  if (resolved === null) {
    return [];
  }
  if (resolved === "http") {
    return [StreamLanguage.define(httpStreamParser)];
  }
  if (resolved === "dockerfile") {
    return [StreamLanguage.define(dockerFile)];
  }
  const ext = loadLanguage(resolved as LanguageName);
  if (!ext) {
    return [];
  }
  return [ext];
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

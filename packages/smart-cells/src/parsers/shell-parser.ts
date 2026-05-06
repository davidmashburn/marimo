/* Copyright 2026 Marimo. All rights reserved. */

import type {
  FormatResult,
  LanguageParser,
  ParseResult,
  QuotePrefixKind,
} from "../types.js";
import { WrappedTextParser } from "./wrapped-text-parser.js";

export interface ShellMetadata {
  resultName: string | null;
  quotePrefix: QuotePrefixKind;
  kwargs: Array<{ key: string; value: string }>;
}

/**
 * Parser for marimo shell cells (mo.sh()).
 *
 * Converts between Python code like `mo.sh(r"""echo hello""")` and
 * plain shell script like `echo hello`.
 */
export class ShellParser implements LanguageParser<ShellMetadata> {
  private parser = new WrappedTextParser<ShellMetadata>({
    type: "shell",
    functionName: "mo.sh",
    shape: "both",
    defaultCode: 'mo.sh(r"""\n\n""")',
    defaultMetadata: {
      resultName: null,
      quotePrefix: "r",
      kwargs: [],
    },
    transformMetadataIn: (metadata, info) => ({
      ...metadata,
      resultName: info.assignmentName,
      quotePrefix: info.quotePrefix,
      kwargs: info.kwargs,
    }),
    formatMetadataOut: (code, metadata) => {
      const assignment = metadata.resultName ? `${metadata.resultName} = ` : "";
      const start = `${assignment}mo.sh(${metadata.quotePrefix}"""\n`;
      const kwargs =
        metadata.kwargs.length > 0
          ? `, ${metadata.kwargs
              .map(({ key, value }) => `${key}=${value}`)
              .join(", ")}`
          : "";
      const end = `\n"""${kwargs})`;
      return { beforeString: start, afterString: end, metadata, code };
    },
    escapeCode: (code) => code.replaceAll('"""', String.raw`\"""`),
  });

  readonly type = this.parser.type;
  readonly defaultCode = this.parser.defaultCode;
  readonly defaultMetadata = this.parser.defaultMetadata;

  transformIn(pythonCode: string): ParseResult<ShellMetadata> {
    return this.parser.transformIn(pythonCode);
  }

  transformOut(code: string, metadata: ShellMetadata): FormatResult {
    return this.parser.transformOut(code, metadata);
  }

  isSupported(pythonCode: string): boolean {
    return this.parser.isSupported(pythonCode);
  }
}

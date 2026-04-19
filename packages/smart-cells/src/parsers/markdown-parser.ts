/* Copyright 2026 Marimo. All rights reserved. */

import type {
  FormatResult,
  LanguageParser,
  ParseResult,
  QuotePrefixKind,
} from "../types.js";
import { unescapeQuotes } from "../utils/index.js";
import { WrappedTextParser } from "./wrapped-text-parser.js";

export interface MarkdownMetadata {
  quotePrefix: QuotePrefixKind;
}

/**
 * Parser for marimo Markdown cells (mo.md()).
 *
 * Converts between Python code like `mo.md(r"""# Hello""")` and
 * plain Markdown like `# Hello`.
 */
export class MarkdownParser implements LanguageParser<MarkdownMetadata> {
  private parser = new WrappedTextParser<MarkdownMetadata>({
    type: "markdown",
    functionName: "mo.md",
    shape: "expression",
    defaultCode: 'mo.md(r"""\n""")',
    defaultMetadata: {
      quotePrefix: "r",
    },
    emptyCallsSupported: true,
    transformMetadataIn: (metadata, info) => ({
      ...metadata,
      quotePrefix: info.quotePrefix,
    }),
    formatMetadataOut: (code, metadata) => {
      if (code === "") {
        code = " ";
      }

      const start = `mo.md(${metadata.quotePrefix}"""\n`;
      const end = `\n""")`;
      return { beforeString: start, afterString: end, metadata, code };
    },
    escapeCode: (code) => code.replaceAll('""', String.raw`"\"`),
    unescapeCode: (code, info) => unescapeQuotes(code, info.quoteType),
  });

  readonly type = this.parser.type;
  readonly defaultCode = this.parser.defaultCode;
  readonly defaultMetadata = this.parser.defaultMetadata;

  /**
   * Create a markdown cell from markdown content.
   */
  static fromMarkdown(markdown: string): string {
    return `mo.md(r"""\n${markdown}\n""")`;
  }

  transformIn(pythonCode: string): ParseResult<MarkdownMetadata> {
    const result = this.parser.transformIn(pythonCode);
    if (result.code === "") {
      return { ...result, offset: 0 };
    }
    return result;
  }

  transformOut(code: string, metadata: MarkdownMetadata): FormatResult {
    return this.parser.transformOut(code, metadata);
  }

  isSupported(pythonCode: string): boolean {
    return this.parser.isSupported(pythonCode);
  }
}

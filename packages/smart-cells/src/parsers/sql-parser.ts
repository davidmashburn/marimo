/* Copyright 2026 Marimo. All rights reserved. */

import type {
  FormatResult,
  LanguageParser,
  ParseResult,
  QuotePrefixKind,
} from "../types.js";
import { WrappedTextParser } from "./wrapped-text-parser.js";

export interface SQLMetadata {
  dataframeName: string;
  quotePrefix: QuotePrefixKind;
  commentLines: readonly string[];
  showOutput: boolean;
  engine: string;
}

const DEFAULT_ENGINE = "__marimo_duckdb";

/**
 * Parser for marimo SQL cells (mo.sql()).
 *
 * Converts between Python code like `_df = mo.sql(f"""SELECT * FROM users""")` and
 * plain SQL like `SELECT * FROM users`.
 */
export class SQLParser implements LanguageParser<SQLMetadata> {
  private parser = new WrappedTextParser<SQLMetadata>({
    type: "sql",
    functionName: "mo.sql",
    shape: "assignment",
    defaultCode: `_df = mo.sql(f"""SELECT * FROM """)`,
    defaultMetadata: {
      dataframeName: "_df",
      quotePrefix: "f",
      commentLines: [],
      showOutput: true,
      engine: DEFAULT_ENGINE,
    },
    allowComments: true,
    allowsWrappedCallExpression: true,
    transformMetadataIn: (metadata, info) => {
      let engine: string | undefined;
      let output: boolean | undefined;

      for (const { key, value } of info.kwargs) {
        switch (key) {
          case "engine":
            engine = value;
            break;
          case "output":
            output = value === "True";
            break;
        }
      }

      return {
        ...metadata,
        dataframeName: info.assignmentName ?? metadata.dataframeName,
        quotePrefix: info.quotePrefix,
        commentLines: info.commentLines,
        showOutput: output ?? true,
        engine: engine ?? DEFAULT_ENGINE,
      };
    },
    formatMetadataOut: (code, metadata) => {
      const { quotePrefix, commentLines, showOutput, engine, dataframeName } =
        metadata;

      const start = `${dataframeName} = mo.sql(\n    ${quotePrefix}"""\n`;
      const showOutputParam = showOutput ? "" : ",\n    output=False";
      const engineParam =
        engine === DEFAULT_ENGINE ? "" : `,\n    engine=${engine}`;
      const end = `\n    """${showOutputParam}${engineParam}\n)`;

      return {
        beforeString: start,
        afterString: end,
        commentLines,
        metadata,
        code: indentOneTab(code),
      };
    },
    escapeCode: (code) => code.replaceAll('"""', String.raw`\"""`),
  });

  readonly type = this.parser.type;
  readonly defaultCode = this.parser.defaultCode;
  readonly defaultMetadata = this.parser.defaultMetadata;

  /**
   * Create a SQL cell from a SQL query.
   */
  static fromQuery(query: string): string {
    return `_df = mo.sql(f"""${query.trim()}""")`;
  }

  transformIn(pythonCode: string): ParseResult<SQLMetadata> {
    return this.parser.transformIn(pythonCode);
  }

  transformOut(code: string, metadata: SQLMetadata): FormatResult {
    return this.parser.transformOut(code, metadata);
  }

  isSupported(pythonCode: string): boolean {
    return this.parser.isSupported(pythonCode);
  }
}

/**
 * Indent code by one tab (4 spaces).
 */
function indentOneTab(code: string): string {
  return code
    .split("\n")
    .map((line) => (line?.trim() ? `    ${line}` : line))
    .join("\n");
}

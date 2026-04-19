/* Copyright 2026 Marimo. All rights reserved. */

import type { SyntaxNode, TreeCursor } from "@lezer/common";
import type {
  FormatResult,
  LanguageParser,
  ParseResult,
  QuotePrefixKind,
  QuoteType,
} from "../types.js";
import { QUOTE_PREFIX_KINDS } from "../types.js";
import {
  getPrefixLength,
  getStringContent,
  parseArgsKwargs,
  parsePythonAST,
  safeDedent,
} from "../utils/index.js";

export type WrappedTextShape = "expression" | "assignment" | "both";

export interface WrappedTextParseInfo {
  assignmentName: string | null;
  text: string;
  quotePrefix: QuotePrefixKind;
  quoteType: QuoteType;
  kwargs: Array<{ key: string; value: string }>;
  commentLines: readonly string[];
  startPosition: number;
}

interface FormatParts<TMetadata> {
  beforeString: string;
  afterString: string;
  commentLines?: readonly string[];
  code?: string;
  metadata: TMetadata;
}

export interface WrappedTextParserConfig<TMetadata> {
  type: string;
  functionName: string;
  shape: WrappedTextShape;
  defaultCode: string;
  defaultMetadata: TMetadata;
  emptyCallsSupported?: boolean;
  allowComments?: boolean;
  allowsWrappedCallExpression?: boolean;
  transformMetadataIn?: (
    metadata: TMetadata,
    info: WrappedTextParseInfo,
  ) => TMetadata;
  formatMetadataOut: (
    code: string,
    metadata: TMetadata,
  ) => FormatParts<TMetadata>;
  escapeCode?: (code: string, metadata: TMetadata) => string;
  unescapeCode?: (code: string, info: WrappedTextParseInfo) => string;
}

/**
 * Parser for smart cells represented by a Python function wrapping quoted text.
 */
export class WrappedTextParser<TMetadata>
  implements LanguageParser<TMetadata>
{
  readonly type: string;
  readonly defaultCode: string;
  readonly defaultMetadata: TMetadata;
  private readonly config: WrappedTextParserConfig<TMetadata>;

  constructor(config: WrappedTextParserConfig<TMetadata>) {
    this.config = config;
    this.type = config.type;
    this.defaultCode = config.defaultCode;
    this.defaultMetadata = config.defaultMetadata;
  }

  transformIn(pythonCode: string): ParseResult<TMetadata> {
    pythonCode = pythonCode.trim();

    let metadata = { ...this.defaultMetadata };

    if (pythonCode === "") {
      return { code: "", offset: 0, metadata };
    }

    const statement = this.parse(pythonCode);
    if (statement) {
      metadata =
        this.config.transformMetadataIn?.(metadata, statement) ?? metadata;
      const code = this.config.unescapeCode
        ? this.config.unescapeCode(statement.text, statement)
        : statement.text;
      return {
        code: safeDedent(code),
        offset: statement.startPosition,
        metadata,
      };
    }

    return { code: pythonCode, offset: 0, metadata };
  }

  transformOut(code: string, metadata: TMetadata): FormatResult {
    const parts = this.config.formatMetadataOut(code, metadata);
    const finalCode = parts.code ?? code;
    const escapedCode = this.config.escapeCode
      ? this.config.escapeCode(finalCode, metadata)
      : finalCode;

    const commentLines = parts.commentLines ?? [];
    return {
      code:
        [...commentLines, parts.beforeString].join("\n") +
        escapedCode +
        parts.afterString,
      offset: parts.beforeString.length + 1,
    };
  }

  isSupported(pythonCode: string): boolean {
    pythonCode = pythonCode.trim();

    if (pythonCode === "") {
      return true;
    }

    if (
      this.config.emptyCallsSupported === true &&
      pythonCode === `${this.config.functionName}()`
    ) {
      return true;
    }

    if (!pythonCode.includes(this.config.functionName)) {
      return false;
    }

    return this.parse(pythonCode) !== null;
  }

  private parse(code: string): WrappedTextParseInfo | null {
    return parseWrappedTextStatement(code, this.config);
  }
}

function parseWrappedTextStatement<TMetadata>(
  code: string,
  config: WrappedTextParserConfig<TMetadata>,
): WrappedTextParseInfo | null {
  try {
    const tree = parsePythonAST(code);
    const cursor = tree.cursor();

    if (cursor.name === "Script") {
      cursor.next();
    }

    const commentLines = config.allowComments ? extractCommentLines(code) : [];
    const statement = findStatement(cursor, config.allowComments === true);
    if (!statement) {
      return null;
    }

    if (code.slice(statement.to).trim().length > 0) {
      return null;
    }

    if (statement.name === "ExpressionStatement") {
      if (config.shape === "assignment") {
        return null;
      }
      const callExpr = findExpressionCall(statement, config);
      if (!callExpr) {
        return null;
      }
      if (callExpr.from !== statement.from) {
        return null;
      }
      if (code.slice(callExpr.to, statement.to).trim().length > 0) {
        return null;
      }
      return parseCallExpression(code, callExpr, null, commentLines, config);
    }

    if (statement.name === "AssignStatement") {
      if (config.shape === "expression") {
        return null;
      }
      const { assignmentName, rightHandSide } = parseAssignment(code, statement);
      if (!assignmentName || !rightHandSide) {
        return null;
      }

      if (
        rightHandSide.name === "ConditionalExpression" ||
        rightHandSide.name === "BinaryExpression" ||
        rightHandSide.name === "UnaryExpression"
      ) {
        return null;
      }

      const callExpr = findExpressionCall(rightHandSide, config);
      if (!callExpr) {
        return null;
      }
      return parseCallExpression(
        code,
        callExpr,
        assignmentName,
        commentLines,
        config,
      );
    }

    return null;
  } catch (error) {
    // oxlint-disable-next-line no-console -- warning ok
    console.warn(`Failed to parse ${config.type} statement`, error);
    return null;
  }
}

function findStatement(
  cursor: TreeCursor,
  allowComments: boolean,
): SyntaxNode | null {
  do {
    if (
      cursor.name === "AssignStatement" ||
      cursor.name === "ExpressionStatement"
    ) {
      return cursor.node;
    }

    if (!allowComments || cursor.name !== "Comment") {
      return null;
    }
  } while (cursor.next());
  return null;
}

function parseAssignment(
  code: string,
  statement: SyntaxNode,
): { assignmentName: string | null; rightHandSide: SyntaxNode | null } {
  const cursor = statement.cursor();
  cursor.firstChild();

  let assignmentName: string | null = null;
  if (cursor.name === "VariableName") {
    assignmentName = code.slice(cursor.from, cursor.to);
  }

  let foundAssignOp = false;
  let rightHandSide: SyntaxNode | null = null;
  while (cursor.nextSibling()) {
    if (cursor.name === "AssignOp") {
      foundAssignOp = true;
    } else if (foundAssignOp && !rightHandSide) {
      rightHandSide = cursor.node;
      break;
    }
  }

  return { assignmentName, rightHandSide };
}

function findExpressionCall<TMetadata>(
  expression: SyntaxNode,
  config: WrappedTextParserConfig<TMetadata>,
): SyntaxNode | null {
  if (expression.name === "CallExpression") {
    return expression;
  }

  const cursor = expression.cursor();
  if (!cursor.firstChild()) {
    return null;
  }

  if (cursor.name === "CallExpression") {
    return cursor.node;
  }

  if (config.allowsWrappedCallExpression !== true) {
    return null;
  }

  do {
    if (cursor.name === "CallExpression") {
      return cursor.node;
    }
  } while (cursor.nextSibling());

  return null;
}

function parseCallExpression<TMetadata>(
  code: string,
  callExpression: SyntaxNode,
  assignmentName: string | null,
  commentLines: readonly string[],
  config: WrappedTextParserConfig<TMetadata>,
): WrappedTextParseInfo | null {
  const callCursor = callExpression.cursor();

  callCursor.firstChild();
  if (callCursor.name !== "MemberExpression") {
    return null;
  }

  const memberText = code.slice(callCursor.from, callCursor.to);
  if (memberText !== config.functionName) {
    return null;
  }

  while (callCursor.next()) {
    const nodeName: string = callCursor.name;
    if (nodeName !== "ArgList") {
      continue;
    }

    const argListCursor = callCursor.node.cursor();
    const { args, kwargs } = parseArgsKwargs(argListCursor, code);

    if (args.length !== 1) {
      return null;
    }

    const text = getStringContent(args[0], code);
    if (text === null) {
      return null;
    }

    const literal = code.slice(args[0].from, args[0].to);
    const { quotePrefix, quoteType } = getStringQuoteInfo(literal);
    const startPosition = args[0].from + getPrefixLength(literal);

    return {
      assignmentName,
      text,
      quotePrefix,
      quoteType,
      kwargs,
      commentLines,
      startPosition,
    };
  }

  return null;
}

function getStringQuoteInfo(literal: string): {
  quotePrefix: QuotePrefixKind;
  quoteType: QuoteType;
} {
  const prefixesByLength = [...QUOTE_PREFIX_KINDS].sort(
    (a, b) => b.length - a.length,
  );

  for (const prefix of prefixesByLength) {
    if (!literal.startsWith(prefix)) {
      continue;
    }
    const rest = literal.slice(prefix.length);
    if (rest.startsWith('"""')) {
      return { quotePrefix: prefix, quoteType: '"""' };
    }
    if (rest.startsWith("'''")) {
      return { quotePrefix: prefix, quoteType: "'''" };
    }
    if (rest.startsWith('"')) {
      return { quotePrefix: prefix, quoteType: '"' };
    }
    if (rest.startsWith("'")) {
      return { quotePrefix: prefix, quoteType: "'" };
    }
  }

  return { quotePrefix: "", quoteType: '"' };
}

function extractCommentLines(pythonCode: string): string[] {
  const lines = pythonCode.split("\n");
  const commentLines: string[] = [];
  for (const line of lines) {
    if (line?.startsWith("#")) {
      commentLines.push(line);
    } else {
      break;
    }
  }
  return commentLines;
}

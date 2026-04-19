/* Copyright 2026 Marimo. All rights reserved. */

import { describe, expect, it } from "vitest";
import type { QuotePrefixKind } from "../types.js";
import { WrappedTextParser } from "../parsers/wrapped-text-parser.js";

interface TestMetadata {
  name: string | null;
  quotePrefix: QuotePrefixKind;
  commentLines: readonly string[];
}

function createParser(shape: "expression" | "assignment" | "both") {
  return new WrappedTextParser<TestMetadata>({
    type: "test",
    functionName: "mo.test",
    shape,
    defaultCode: 'mo.test(r"""\n\n""")',
    defaultMetadata: {
      name: null,
      quotePrefix: "r",
      commentLines: [],
    },
    allowComments: true,
    transformMetadataIn: (metadata, info) => ({
      ...metadata,
      name: info.assignmentName,
      quotePrefix: info.quotePrefix,
      commentLines: info.commentLines,
    }),
    formatMetadataOut: (code, metadata) => {
      const assignment = metadata.name ? `${metadata.name} = ` : "";
      const start = `${assignment}mo.test(${metadata.quotePrefix}"""\n`;
      return {
        beforeString: start,
        afterString: `\n""")`,
        commentLines: metadata.commentLines,
        metadata,
        code,
      };
    },
  });
}

describe("WrappedTextParser", () => {
  it("supports expression-only wrappers", () => {
    const parser = createParser("expression");
    expect(parser.isSupported('mo.test("hello")')).toBe(true);
    expect(parser.isSupported('result = mo.test("hello")')).toBe(false);

    const { code, metadata } = parser.transformIn('mo.test(f"""hello""")');
    expect(code).toBe("hello");
    expect(metadata.quotePrefix).toBe("f");
    expect(metadata.name).toBe(null);
  });

  it("supports assignment-only wrappers", () => {
    const parser = createParser("assignment");
    expect(parser.isSupported('mo.test("hello")')).toBe(false);
    expect(parser.isSupported('result = mo.test("hello")')).toBe(true);

    const { code, metadata } = parser.transformIn(
      'result = mo.test(rf"""hello""")',
    );
    expect(code).toBe("hello");
    expect(metadata.quotePrefix).toBe("rf");
    expect(metadata.name).toBe("result");
  });

  it("supports both expression and assignment wrappers", () => {
    const parser = createParser("both");
    expect(parser.isSupported("mo.test('hello')")).toBe(true);
    expect(parser.isSupported("result = mo.test('hello')")).toBe(true);
  });

  it("handles string forms, empty strings, and comments", () => {
    const parser = createParser("both");

    expect(parser.transformIn('mo.test("")').code).toBe("");
    expect(parser.transformIn("mo.test('hello')").code).toBe("hello");
    expect(parser.transformIn('mo.test(fr"hello")').metadata.quotePrefix).toBe(
      "fr",
    );

    const result = parser.transformIn('# comment\nresult = mo.test("""hi""")');
    expect(result.code).toBe("hi");
    expect(result.metadata.commentLines).toEqual(["# comment"]);
  });

  it("rejects extra statements and multiple calls", () => {
    const parser = createParser("both");

    expect(parser.isSupported('mo.test("a"); print("b")')).toBe(false);
    expect(parser.isSupported('mo.test("a")\nmo.test("b")')).toBe(false);
  });
});


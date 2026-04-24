/* Copyright 2026 Marimo. All rights reserved. */

import { describe, expect, it } from "vitest";
import {
  isValidWrappedTextSyntaxLanguage,
  resolveWrappedTextSyntaxLanguage,
} from "./wrapped-text-syntax";

describe("resolveWrappedTextSyntaxLanguage", () => {
  it("resolves @uiw ids", () => {
    expect(resolveWrappedTextSyntaxLanguage("py")).toBe("py");
    expect(resolveWrappedTextSyntaxLanguage("sql")).toBe("sql");
  });

  it("resolves legacy aliases", () => {
    expect(resolveWrappedTextSyntaxLanguage("python")).toBe("py");
    expect(resolveWrappedTextSyntaxLanguage("javascript")).toBe("js");
    expect(resolveWrappedTextSyntaxLanguage("mysql")).toBe("sql");
  });

  it("supports http and dockerfile", () => {
    expect(resolveWrappedTextSyntaxLanguage("http")).toBe("http");
    expect(resolveWrappedTextSyntaxLanguage("dockerfile")).toBe("dockerfile");
  });

  it("rejects unknown", () => {
    expect(resolveWrappedTextSyntaxLanguage("not-a-real-language-xyz")).toBe(
      null,
    );
    expect(isValidWrappedTextSyntaxLanguage("not-a-real-language-xyz")).toBe(
      false,
    );
  });
});

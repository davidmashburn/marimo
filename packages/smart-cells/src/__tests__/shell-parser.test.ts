/* Copyright 2026 Marimo. All rights reserved. */

import { describe, expect, it } from "vitest";
import { ShellParser } from "../parsers/shell-parser.js";

const parser = new ShellParser();

describe("ShellParser", () => {
  describe("transformIn", () => {
    it("extracts shell script from expression cells", () => {
      const { code, metadata, offset } = parser.transformIn(
        'mo.sh(r"""echo hello""")',
      );

      expect(code).toBe("echo hello");
      expect(metadata.resultName).toBe(null);
      expect(metadata.quotePrefix).toBe("r");
      expect(metadata.kwargs).toEqual([]);
      expect(offset).toBe(10);
    });

    it("extracts shell script from assignment cells", () => {
      const { code, metadata } = parser.transformIn(
        'result = mo.sh("""echo hello""")',
      );

      expect(code).toBe("echo hello");
      expect(metadata.resultName).toBe("result");
      expect(metadata.quotePrefix).toBe("");
      expect(metadata.kwargs).toEqual([]);
    });

    it("dedents multiline shell script", () => {
      const { code } = parser.transformIn(
        'mo.sh(r"""\n    echo hello\n    echo goodbye\n""")',
      );

      expect(code).toBe("echo hello\necho goodbye");
    });

    it("preserves kwargs", () => {
      const { code, metadata } = parser.transformIn(
        'result = mo.sh(r"""echo hello""", check=False, cwd=workdir)',
      );

      expect(code).toBe("echo hello");
      expect(metadata.resultName).toBe("result");
      expect(metadata.quotePrefix).toBe("r");
      expect(metadata.kwargs).toEqual([
        { key: "check", value: "False" },
        { key: "cwd", value: "workdir" },
      ]);
    });
  });

  describe("transformOut", () => {
    it("wraps shell script as expression by default", () => {
      const { code } = parser.transformOut("echo hello", {
        resultName: null,
        quotePrefix: "r",
        kwargs: [],
      });

      expect(code).toBe('mo.sh(r"""\necho hello\n""")');
    });

    it("preserves assignment metadata", () => {
      const { code } = parser.transformOut("echo hello", {
        resultName: "result",
        quotePrefix: "r",
        kwargs: [],
      });

      expect(code).toBe('result = mo.sh(r"""\necho hello\n""")');
    });

    it("roundtrips kwargs", () => {
      const { code } = parser.transformOut("echo hello", {
        resultName: "result",
        quotePrefix: "r",
        kwargs: [{ key: "check", value: "False" }],
      });

      expect(code).toBe('result = mo.sh(r"""\necho hello\n""", check=False)');
    });
  });

  describe("isSupported", () => {
    it("supports expression and assignment shell cells", () => {
      expect(parser.isSupported('mo.sh("echo hello")')).toBe(true);
      expect(parser.isSupported('result = mo.sh("echo hello")')).toBe(true);
    });

    it("rejects unsupported calls", () => {
      expect(parser.isSupported('print("echo hello")')).toBe(false);
      expect(parser.isSupported('other.sh("echo hello")')).toBe(false);
      expect(parser.isSupported('mo.sh("a")\nmo.sh("b")')).toBe(false);
    });
  });
});

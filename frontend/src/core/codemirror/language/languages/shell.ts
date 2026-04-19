/* Copyright 2026 Marimo. All rights reserved. */

import { insertTab } from "@codemirror/commands";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { StreamLanguage } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { type ShellMetadata, ShellParser } from "@marimo-team/smart-cells";
import type { CellId } from "@/core/cells/ids";
import type { CompletionConfig } from "@/core/config/config-schema";
import type { HotkeyProvider } from "@/core/hotkeys/hotkeys";
import type { PlaceholderType } from "../../config/types";
import type { LanguageAdapter } from "../types";

export type ShellLanguageAdapterMetadata = ShellMetadata;

/**
 * Language adapter for shell scripts.
 */
export class ShellLanguageAdapter
  implements LanguageAdapter<ShellLanguageAdapterMetadata>
{
  private parser = new ShellParser();

  readonly type = "shell";
  readonly defaultCode = this.parser.defaultCode;
  readonly defaultMetadata = this.parser.defaultMetadata;

  transformIn(
    pythonCode: string,
  ): [string, number, ShellLanguageAdapterMetadata] {
    const result = this.parser.transformIn(pythonCode);
    return [result.code, result.offset, result.metadata];
  }

  transformOut(
    code: string,
    metadata: ShellLanguageAdapterMetadata,
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
      StreamLanguage.define(shell),
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

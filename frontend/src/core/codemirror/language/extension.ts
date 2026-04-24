/* Copyright 2026 Marimo. All rights reserved. */

import { history } from "@codemirror/commands";
import {
  Compartment,
  EditorSelection,
  StateEffect,
  StateField,
} from "@codemirror/state";
import { type EditorView, keymap, showPanel } from "@codemirror/view";
import type { CellId } from "@/core/cells/ids";
import type {
  CompletionConfig,
  DiagnosticsConfig,
  LSPConfig,
} from "@/core/config/config-schema";
import type { HotkeyProvider } from "@/core/hotkeys/hotkeys";
import { Logger } from "@/utils/Logger";
import { clamp } from "@/utils/math";
import {
  cellIdState,
  completionConfigState,
  hotkeysProviderState,
  lspConfigState,
  placeholderState,
} from "../config/extension";
import type { PlaceholderType } from "../config/types";
import { historyCompartment } from "../editing/extensions";
import { formattingChangeEffect } from "../format";
import { createPanel } from "../react-dom/createPanel";
import {
  getCustomLanguageAdapters,
  getLanguageAdapter,
  getLanguageAdapters,
  LanguageAdapters,
} from "./LanguageAdapters";
import { initializeSQLDialect } from "./languages/sql/sql";
import type { LanguageMetadata } from "./metadata";
import { languageMetadataField, setLanguageMetadata } from "./metadata";
import { LanguagePanelComponent } from "./panel/panel";
import type { LanguageAdapter } from "./types";
import { getEditorCodeAsPython } from "./utils";

/**
 * Compartment to keep track of the current language and extension.
 * When the language changes, the extensions inside the compartment will be updated.
 */
const languageCompartment = new Compartment();

/**
 * State effect to set the language adapter.
 */
export const setLanguageAdapter = StateEffect.define<LanguageAdapter>();

/**
 * State field to keep track of the current language adapter.
 */
export const languageAdapterState = StateField.define<LanguageAdapter>({
  create() {
    return LanguageAdapters.python;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setLanguageAdapter)) {
        return effect.value;
      }
    }
    return value;
  },
  provide: (field) =>
    showPanel.from(field, () => {
      // Always show the language panel so users can always see which language
      // the cell is in and have a visible path to switch (e.g. back to a
      // smart-cell wrapped-text view when a custom adapter matches the code).
      return (view) => createPanel(view, LanguagePanelComponent);
    }),
});

/**
 * Switch to a different language adapter, performing the code transform.
 * Used by the language panel UI to offer an explicit way back to a
 * wrapped-text (smart) cell from Python mode.
 */
export function requestLanguageSwitch(
  view: EditorView,
  nextLanguage: LanguageAdapter,
  opts: { keepCodeAsIs?: boolean } = {},
): void {
  const currentLanguage = view.state.field(languageAdapterState);
  if (currentLanguage.type === nextLanguage.type) {
    return;
  }
  updateLanguageAdapterAndCode({
    view,
    nextLanguage,
    opts: { keepCodeAsIs: opts.keepCodeAsIs ?? false },
  });
}

/**
 * Keymap to toggle between languages
 */
function languageToggleKeymaps() {
  return [
    keymap.of([
      {
        key: "F4",
        preventDefault: true,
        run: (cm) => {
          // Resolve languages fresh on each press so newly-registered
          // user adapters (wrapped-text) are reachable from Python mode.
          const languages = getLanguageAdapters();
          const findNextLanguage = (
            code: string,
            index: number,
            seen: number,
          ): LanguageAdapter => {
            if (seen >= languages.length) {
              return languages[index % languages.length];
            }
            const language = languages[index % languages.length];
            if (language.isSupported(code)) {
              return language;
            }
            return findNextLanguage(code, index + 1, seen + 1);
          };

          const currentLanguage = cm.state.field(languageAdapterState);
          const currentLanguageIndex = languages.findIndex(
            (l) => l.type === currentLanguage.type,
          );
          const code = cm.state.doc.toString();
          const nextLanguage = findNextLanguage(
            code,
            currentLanguageIndex + 1,
            0,
          );

          if (currentLanguage === nextLanguage) {
            return false;
          }

          updateLanguageAdapterAndCode({
            view: cm,
            nextLanguage,
            opts: {
              keepCodeAsIs: false,
            },
          });
          return true;
        },
      },
    ]),
  ];
}

function updateLanguageAdapterAndCode({
  view,
  nextLanguage,
  opts,
}: {
  view: EditorView;
  nextLanguage: LanguageAdapter;
  opts: { keepCodeAsIs: boolean };
}) {
  const currentLanguage = view.state.field(languageAdapterState);
  const code = view.state.doc.toString();
  const completionConfig = view.state.facet(completionConfigState);
  const hotkeysProvider = view.state.facet(hotkeysProviderState);
  const placeholderType = view.state.facet(placeholderState);
  const cellId = view.state.facet(cellIdState);
  const lspConfig = view.state.facet(lspConfigState);
  let metadata = view.state.field(languageMetadataField);
  let cursor = view.state.selection.main.head;

  // If keepCodeAsIs is true, we just keep the original code
  // but update the language.
  // If keepCodeAsIs is false, we need to transform the code
  // from the current language to the next language and update
  // the cursor position.
  let finalCode: string;
  if (opts.keepCodeAsIs) {
    finalCode = code;
    if (currentLanguage.type !== nextLanguage.type) {
      // Set the metadata to the default metadata
      metadata = { ...nextLanguage.defaultMetadata };
    }
  } else {
    const [codeOut, cursorDiff1] = currentLanguage.transformOut(code, metadata);
    const [newCode, cursorDiff2, metadataOut] =
      nextLanguage.transformIn(codeOut);
    // Update the cursor position
    cursor += cursorDiff1;
    cursor -= cursorDiff2;
    cursor = clamp(cursor, 0, newCode.length);
    finalCode = newCode;
    metadata = metadataOut as LanguageMetadata;
  }

  // Update the state
  view.dispatch({
    effects: [
      setLanguageAdapter.of(nextLanguage),
      setLanguageMetadata.of(metadata),
      languageCompartment.reconfigure(
        nextLanguage.getExtension(
          cellId,
          completionConfig,
          hotkeysProvider,
          placeholderType,
          lspConfig,
        ),
      ),
      // Clear history
      historyCompartment.reconfigure([]),
      // Let downstream extensions know that this is a formatting change
      formattingChangeEffect.of(true),
    ],
    changes: opts.keepCodeAsIs
      ? undefined
      : {
          from: 0,
          to: view.state.doc.length,
          insert: finalCode,
        },
    selection: opts.keepCodeAsIs ? undefined : EditorSelection.cursor(cursor),
  });

  // Add history back
  view.dispatch({
    effects: [historyCompartment.reconfigure([history()])],
  });

  // Initialize SQL dialect if switching to SQL
  if (nextLanguage.type === "sql") {
    initializeSQLDialect(view);
  }
}

/**
 * Set of extensions to enable adaptive language configuration.
 */
export function adaptiveLanguageConfiguration(opts: {
  placeholderType: PlaceholderType;
  completionConfig: CompletionConfig;
  hotkeys: HotkeyProvider;
  lspConfig: LSPConfig & { diagnostics?: DiagnosticsConfig };
  cellId: CellId;
}) {
  const { placeholderType, completionConfig, hotkeys, cellId, lspConfig } =
    opts;

  return [
    // Language adapter
    languageToggleKeymaps(),
    languageCompartment.of(
      LanguageAdapters.python.getExtension(
        cellId,
        completionConfig,
        hotkeys,
        placeholderType,
        lspConfig,
      ),
    ),
    languageAdapterState,
    languageMetadataField,
  ];
}

/**
 * Get the best language given the editors current code.
 */
export function getInitialLanguageAdapter(state: EditorView["state"]) {
  const doc = getEditorCodeAsPython({ state }).trim();
  return languageAdapterFromCode(doc);
}

/**
 * Get the best language adapter given the editor's current code.
 */
export function languageAdapterFromCode(doc: string): LanguageAdapter {
  // Empty doc defaults to Python
  if (!doc) {
    return LanguageAdapters.python;
  }

  // Check user-registered adapters first (more specific than built-ins)
  for (const adapter of getCustomLanguageAdapters()) {
    if (adapter.isSupported(doc)) {
      return adapter;
    }
  }

  if (LanguageAdapters.markdown.isSupported(doc)) {
    return LanguageAdapters.markdown;
  }
  if (LanguageAdapters.sql.isSupported(doc)) {
    return LanguageAdapters.sql;
  }

  return LanguageAdapters.python;
}

/**
 * Switch the language of the editor.
 *
 * @param view - The editor view.
 * @param language - The language to switch to.
 * @param opts.keepCodeAsIs - If true, we keep the original code but update the language.
 * If false, we transform the code from the current language to the next language and update
 * the cursor position.
 */
export function switchLanguage(
  view: EditorView,
  opts: {
    language: LanguageAdapter["type"];
    keepCodeAsIs?: boolean;
  },
) {
  // If the existing language is the same as the new language, do nothing
  const currentLanguage = view.state.field(languageAdapterState);
  if (currentLanguage.type === opts.language) {
    return;
  }

  updateLanguageAdapterAndCode({
    view,
    nextLanguage: getLanguageAdapter(opts.language),
    opts: {
      keepCodeAsIs: opts.keepCodeAsIs ?? false,
    },
  });
}

/**
 * Reconfigure the editor view with
 * the new language extensions.
 *
 * This is used when the language changes
 * (e.g. switching from markdown to python).
 */
export function reconfigureLanguageEffect(
  view: EditorView,
  {
    completionConfig,
    hotkeysProvider,
    lspConfig,
  }: {
    completionConfig: CompletionConfig;
    hotkeysProvider: HotkeyProvider;
    lspConfig: LSPConfig & { diagnostics?: DiagnosticsConfig };
  },
) {
  const language = view.state.field(languageAdapterState);
  const placeholderType = view.state.facet(placeholderState);
  const cellId = view.state.facet(cellIdState);

  if (cellId === undefined) {
    Logger.error("Cell ID is undefined in reconfigureLanguageEffect");
  }
  if (placeholderType === undefined) {
    Logger.error("Placeholder type is undefined in reconfigureLanguageEffect");
  }
  if (completionConfig === undefined) {
    Logger.error("Completion config is undefined in reconfigureLanguageEffect");
  }

  return languageCompartment.reconfigure(
    language.getExtension(
      cellId,
      completionConfig,
      hotkeysProvider,
      placeholderType,
      lspConfig,
    ),
  );
}

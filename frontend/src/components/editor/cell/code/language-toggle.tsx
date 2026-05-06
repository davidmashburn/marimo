/* Copyright 2026 Marimo. All rights reserved. */

import type { EditorView } from "@codemirror/view";
import { DatabaseIcon, TerminalIcon } from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { switchLanguage } from "@/core/codemirror/language/extension";
import {
  getLanguageAdapter,
  getLanguageAdapters,
} from "@/core/codemirror/language/LanguageAdapters";
import type { LanguageAdapter } from "@/core/codemirror/language/types";
import { Functions } from "@/utils/functions";
import { MarkdownIcon, PythonIcon } from "./icons";

interface LanguageTogglesProps {
  editorView: EditorView | null;
  code: string;
  currentLanguageAdapter: LanguageAdapter["type"] | undefined;
  onAfterToggleMarkdown: () => void;
  onAfterToggleSQL: () => void;
}

export const LanguageToggles: React.FC<LanguageTogglesProps> = ({
  editorView,
  code,
  currentLanguageAdapter,
  onAfterToggleMarkdown,
  onAfterToggleSQL,
}) => {
  const runtimeToggles = useMemo(() => {
    const isEmpty = code.trim() === "";
    const currentType = currentLanguageAdapter ?? "python";
    const priority = ["sql", "shell", "node", "markdown"];
    const adapters = getLanguageAdapters()
      .filter((adapter) => adapter.type !== "python")
      .sort((a, b) => {
        const aPriority = priority.indexOf(a.type);
        const bPriority = priority.indexOf(b.type);
        if (aPriority !== -1 || bPriority !== -1) {
          if (aPriority === -1) {
            return 1;
          }
          if (bPriority === -1) {
            return -1;
          }
          return aPriority - bPriority;
        }
        return a.type.localeCompare(b.type);
      });

    return adapters
      .filter(
        (adapter) =>
          currentType === "python" &&
          (isEmpty || getLanguageAdapter(adapter.type).isSupported(code)),
      )
      .map((adapter) => {
        const icon =
          adapter.type === "sql" ? (
            <DatabaseIcon
              color={"var(--sky-11)"}
              strokeWidth={2.5}
              className="w-4 h-4"
            />
          ) : adapter.type === "markdown" ? (
            <MarkdownIcon
              fill={"var(--sky-11)"}
              color="black"
              className="w-4 h-4"
            />
          ) : (
            <TerminalIcon
              color={"var(--sky-11)"}
              strokeWidth={2.5}
              className="w-4 h-4"
            />
          );

        const displayName =
          adapter.type === "sql"
            ? "SQL"
            : adapter.type === "markdown"
              ? "Markdown"
              : adapter.type === "shell"
                ? "Shell"
                : adapter.type === "node"
                  ? "Node"
                  : adapter.type;

        const onAfterToggle =
          adapter.type === "markdown" ? onAfterToggleMarkdown : onAfterToggleSQL;

        return {
          type: adapter.type,
          icon,
          displayName,
          onAfterToggle,
        };
      });
  }, [code, currentLanguageAdapter, onAfterToggleMarkdown, onAfterToggleSQL]);

  return (
    <div className="absolute right-3 top-2 z-20 flex hover-action gap-1">
      {runtimeToggles.map((toggle) => (
        <LanguageToggle
          key={toggle.type}
          editorView={editorView}
          currentLanguageAdapter={currentLanguageAdapter}
          canSwitchToLanguage={true}
          icon={toggle.icon}
          toType={toggle.type}
          displayName={toggle.displayName}
          onAfterToggle={toggle.onAfterToggle}
        />
      ))}
      <LanguageToggle
        editorView={editorView}
        currentLanguageAdapter={currentLanguageAdapter}
        canSwitchToLanguage={true}
        icon={
          <PythonIcon
            fill={"var(--sky-11)"}
            color="black"
            className="w-4 h-4"
          />
        }
        toType="python"
        displayName="Python"
        onAfterToggle={Functions.NOOP}
      />
    </div>
  );
};

interface Props {
  className?: string;
  editorView: EditorView | null;
  canSwitchToLanguage: boolean;
  currentLanguageAdapter: LanguageAdapter["type"] | undefined;
  toType: LanguageAdapter["type"];
  displayName: string;
  icon: React.ReactNode;
  onAfterToggle: () => void;
}

export const LanguageToggle: React.FC<Props> = ({
  editorView,
  currentLanguageAdapter,
  canSwitchToLanguage,
  icon,
  toType,
  displayName,
  onAfterToggle,
}) => {
  const handleClick = () => {
    if (!editorView) {
      return;
    }
    switchLanguage(editorView, { language: toType });
    onAfterToggle();
  };

  if (!canSwitchToLanguage) {
    return null;
  }

  if (currentLanguageAdapter === toType) {
    return null;
  }

  return (
    <Tooltip content={`View as ${displayName}`}>
      <Button
        data-testid="language-toggle-button"
        variant="text"
        size="xs"
        className="opacity-80 px-1"
        onClick={handleClick}
      >
        {icon}
      </Button>
    </Tooltip>
  );
};

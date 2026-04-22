/* Copyright 2026 Marimo. All rights reserved. */

import type React from "react";
import type { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type {
  UserConfig,
  WrappedTextAdapterConfig,
} from "@/core/config/config-schema";
import { WRAPPED_TEXT_SYNTAX_LANGUAGES } from "@/core/language/wrapped-text-syntax";

interface Props {
  form: UseFormReturn<UserConfig>;
  onSubmit: (values: UserConfig) => void;
}

const SHAPES = ["both", "expression", "assignment"] as const;
const QUOTE_PREFIXES = ["r", "f", "fr", "rf"] as const;

function makeDefaultAdapter(): WrappedTextAdapterConfig {
  return {
    enabled: true,
    function_name: "mo.custom",
    shape: "both",
    syntax_language: "javascript",
    default_quote_prefix: "r",
    default_assignment_name: null,
  };
}

export const WrappedTextAdaptersForm: React.FC<Props> = ({ form, onSubmit }) => {
  const adapters =
    ((form.watch("runtime") as { wrapped_text_adapters?: WrappedTextAdapterConfig[] } | undefined)
      ?.wrapped_text_adapters ?? []);

  const setAdapters = (next: WrappedTextAdapterConfig[]) => {
    const runtime = form.getValues("runtime");
    form.setValue(
      "runtime",
      {
        ...runtime,
        wrapped_text_adapters: next,
      } as never,
      {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
      },
    );
    onSubmit(form.getValues());
  };

  const updateAdapter = (
    index: number,
    patch: Partial<WrappedTextAdapterConfig>,
  ) => {
    const next = adapters.map((adapter, i) =>
      i === index ? { ...adapter, ...patch } : adapter,
    );
    setAdapters(next);
  };

  const removeAdapter = (index: number) => {
    const next = adapters.filter((_, i) => i !== index);
    setAdapters(next);
  };

  const addAdapter = () => {
    setAdapters([...adapters, makeDefaultAdapter()]);
  };

  return (
    <div className="flex flex-col gap-3">
      {adapters.length === 0 && (
        <p className="text-sm text-muted-secondary">
          No custom wrapped-text wrappers configured.
        </p>
      )}
      {adapters.map((adapter, index) => (
        <div
          key={`${adapter.function_name}-${index}`}
          className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-center rounded border p-2"
        >
          <Input
            value={adapter.function_name}
            onChange={(e) =>
              updateAdapter(index, { function_name: e.target.value })
            }
            placeholder="mo.custom"
            aria-label="Wrapper function"
            className="sm:col-span-2"
          />
          <NativeSelect
            value={adapter.syntax_language}
            onChange={(e) =>
              updateAdapter(index, {
                syntax_language:
                  e.target.value as WrappedTextAdapterConfig["syntax_language"],
              })
            }
            className="sm:col-span-1"
            aria-label="Syntax language"
          >
            {WRAPPED_TEXT_SYNTAX_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            value={adapter.shape}
            onChange={(e) =>
              updateAdapter(index, {
                shape: e.target.value as WrappedTextAdapterConfig["shape"],
              })
            }
            className="sm:col-span-1"
            aria-label="Wrapper shape"
          >
            {SHAPES.map((shape) => (
              <option key={shape} value={shape}>
                {shape}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            value={adapter.default_quote_prefix ?? "r"}
            onChange={(e) =>
              updateAdapter(index, {
                default_quote_prefix:
                  e.target.value as WrappedTextAdapterConfig["default_quote_prefix"],
              })
            }
            className="sm:col-span-1"
            aria-label="Default quote prefix"
          >
            {QUOTE_PREFIXES.map((prefix) => (
              <option key={prefix} value={prefix}>
                {prefix}
              </option>
            ))}
          </NativeSelect>
          <Button
            type="button"
            variant="text"
            className="sm:col-span-1 justify-self-end"
            onClick={() => removeAdapter(index)}
          >
            Remove
          </Button>
          <Input
            value={adapter.default_assignment_name ?? ""}
            onChange={(e) =>
              updateAdapter(index, {
                default_assignment_name:
                  e.target.value.trim() === "" ? null : e.target.value,
              })
            }
            placeholder="optional assignment var"
            aria-label="Default assignment variable"
            className="sm:col-span-4"
          />
          <label className="text-sm flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={adapter.enabled !== false}
              onChange={(e) => updateAdapter(index, { enabled: e.target.checked })}
            />
            Enabled
          </label>
        </div>
      ))}
      <div>
        <Button type="button" variant="outline" size="sm" onClick={addAdapter}>
          Add wrapped-text wrapper
        </Button>
      </div>
    </div>
  );
};

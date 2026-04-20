# Custom Wrapped-Text Cells Plan

## Summary

Introduce a registry-driven wrapped-text adapter flow so users can define their
own wrapper functions and choose the inner syntax-highlighting language from a
curated list.

This ships as a global user-config feature (stored in `marimo.toml`) and is
applied at runtime in edit mode.

## Scope

1. Keep notebook persistence model code-driven (no per-cell mode flags).
2. Add user-configurable wrapped-text adapter definitions under runtime config.
3. Register/unregister adapters dynamically when user config changes.
4. Update language toggles so custom wrappers can round-trip to/from Python.

## Data Model

Each custom wrapped-text adapter definition includes:

- `enabled` (bool)
- `function_name` (dotted name like `mo.custom`)
- `shape` (`expression` | `assignment` | `both`)
- `syntax_language` (curated supported language list)
- `default_quote_prefix` (`r` | `f` | `fr` | `rf`, optional)
- `default_assignment_name` (optional string)

Reserved built-in wrappers (`mo.md`, `mo.sql`, `mo.sh`, `mo.node`) are not
overridable through user config.

## UI/UX

Add a runtime settings panel section:

- List existing custom wrappers
- Add/remove wrapper rows
- Configure wrapper function, shape, syntax language, default quote prefix,
  optional assignment name, and enabled flag

Settings edits save via existing `save_user_config` flow.

## Runtime Behavior

- On edit-app boot and on user-config updates, sync configured adapters:
  - register active valid entries
  - replace existing managed entries
  - unregister removed/disabled entries
- Invalid, duplicate, unsupported, or reserved entries are skipped with warnings.

## Acceptance

1. Users can add `mo.my_wrapper` + language from dropdown and have it
   auto-detected as wrapped-text mode.
2. Switching wrapper cell -> Python -> wrapper mode round-trips from toggles.
3. Settings persist across refresh and notebook reopen.
4. Notebook files remain pure Python source without explicit mode flags.

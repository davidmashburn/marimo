# Runbook pattern

An example of using marimo as an **operational runbook** — a notebook where
each cell is a discrete step (shell command, health check, mitigation) with
rich pass/fail output and a confirmation gate on destructive writes.

This is a **pattern, not a library**. Copy `ops_incident.py` and
`marimo.toml` into your own project and adapt the helpers to whatever tools
you actually use (`kubectl`, `psql`, `aws`, `terraform`, etc.).

## What the example demonstrates

1. **Tiny subprocess helper.** A local `sh()` function in the notebook wraps
   `subprocess.run(["bash", "-c", script], ...)`. That's the whole pattern —
   no library needed.
2. **Rich output.** The first cell registers a local HTML formatter for
   `subprocess.CompletedProcess` (pass/fail badge, exit code, stdout, stderr).
   That registration is a ~30-line block you can paste into any notebook
   that shells out. No library required.
3. **Guarded writes.** A `mo.ui.switch` gates destructive steps: they return
   a sentinel unless the switch is toggled on.
4. **Wrapped-text smart cells.** `marimo.toml` registers an adapter so
   `sh(r"""...""")` cells render with a bash editor, syntax highlighting, and
   a "Smart cell" panel toggle. See
   [Runtime wrapped-text adapters](../../docs/...)  for the config schema.

## Run it

```bash
marimo edit examples/runbook/ops_incident.py
```

## Extend it

To add your own tool, write a one-liner:

```python
import shlex

def kubectl(args: str, **kw):
    return run(["kubectl", *shlex.split(args)], **kw)
```

Then register a wrapped-text adapter if you want the smart-cell UI:

```toml
[[runtime.wrapped_text_adapters]]
enabled = true
function_name = "kubectl"
syntax_language = "bash"
shape = "expression"
default_quote_prefix = "r"
```

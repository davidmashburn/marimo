# Copyright 2026 Marimo. All rights reserved.
"""Incident response runbook — an example of the "runbook pattern".

Each cell is a step you run in order. Shell commands run via a tiny local
`sh()` helper that wraps `subprocess.run(["bash", "-c", ...])`; marimo's
native `subprocess.CompletedProcess` formatter renders a pass/fail card
with stdout and stderr.

No library required — copy this file (and `marimo.toml`) into your own
project and adapt to whatever tools you use.

    marimo edit examples/runbook/ops_incident.py
"""

import marimo

__generated_with = "0.23.1"
app = marimo.App(width="medium", app_title="Incident Response Runbook")


@app.cell
def _():
    import subprocess
    import textwrap
    from dataclasses import dataclass
    from html import escape

    import marimo as mo
    from marimo._output import formatting

    @dataclass
    class Blocked:
        """Sentinel returned by a guarded step when `confirm` is not True."""

        script: str
        message: str = "Execution blocked — flip the confirm switch to run."

    def sh(
        script: str,
        *,
        timeout: float = 120,
        guarded: bool = False,
        confirm: bool | None = None,
    ):
        """Run a bash script and return a CompletedProcess.

        When guarded=True, the step only runs if confirm is True; otherwise
        it returns a Blocked sentinel (with a printable repr) and the
        subprocess is never spawned.
        """
        script = textwrap.dedent(script).strip()
        if guarded and confirm is not True:
            return Blocked(script=script)
        return subprocess.run(
            ["bash", "-c", script],
            capture_output=True,
            text=True,
            timeout=timeout,
        )

    # Register a one-off HTML formatter for subprocess.CompletedProcess so
    # each step renders as a pass/fail card instead of a bare repr. Copy
    # this block into any notebook where you want the same treatment.
    @formatting.formatter(subprocess.CompletedProcess)
    def _format_process(result):
        ok = result.returncode == 0
        badge = "✅" if ok else "❌"
        color = "#16a34a" if ok else "#dc2626"
        cmd = result.args
        cmd_str = " ".join(map(str, cmd)) if isinstance(cmd, list) else str(cmd)
        cmd_disp = escape(cmd_str[:120] + ("…" if len(cmd_str) > 120 else ""))

        def section(label, content):
            if not content:
                return ""
            return (
                f'<details open><summary style="cursor:pointer;'
                f'font-size:12px;color:#374151">{escape(label)}</summary>'
                f'<pre style="margin:4px 0;padding:8px;background:#f9fafb;'
                f'border-radius:4px;font-size:12px;white-space:pre-wrap;'
                f'max-height:400px;overflow:auto">'
                f"{escape(content[:8000])}</pre></details>"
            )

        html = (
            f'<div style="border:1px solid #e5e7eb;border-radius:8px;'
            f'padding:8px 12px;margin:4px 0;font-family:inherit">'
            f'<div style="display:flex;gap:8px;align-items:center;'
            f'color:{color};font-weight:500;font-size:13px">'
            f"{badge}<span>{cmd_disp}</span>"
            f'<span style="margin-left:auto;opacity:0.7;font-size:12px">'
            f"exit {result.returncode}</span></div>"
            f"{section('stdout', (result.stdout or '').rstrip())}"
            f"{section('stderr', (result.stderr or '').rstrip())}"
            f"</div>"
        )
        return ("text/html", html)

    return Blocked, mo, sh


@app.cell
def _(mo):
    mo.md(
        """
        # Incident Response Runbook

        This runbook walks through diagnosing and mitigating a hypothetical
        service incident. Each cell is an executable step.

        > **Before running destructive steps:** flip the *Confirm writes*
        > toggle below.
        """
    )
    return


@app.cell
def _(mo):
    confirm_writes = mo.ui.switch(label="Confirm writes", value=False)
    confirm_writes
    return (confirm_writes,)


@app.cell
def _(mo):
    mo.md("## Step 1 — Environment & host info")
    return


@app.cell
def _(sh):
    sh(r"""
    echo "=== hostname ==="
    hostname
    echo ""
    echo "=== uptime ==="
    uptime
    echo ""
    echo "=== disk usage ==="
    df -h /
    """)
    return


@app.cell
def _(mo):
    mo.md("## Step 2 — Top memory consumers")
    return


@app.cell
def _(sh):
    sh(r"""
    ps -eo pid,comm,%mem,%cpu --sort=-%mem | head -20
    """)
    return


@app.cell
def _(mo):
    mo.md("## Step 3 — External health check")
    return


@app.cell
def _(sh):
    sh(r"""
    curl -s -o /dev/null -w "HTTP %{http_code}  total %{time_total}s\n" \
        https://httpbin.org/status/200
    """)
    return


@app.cell
def _(mo):
    mo.md(
        """
        ## Step 4 — Guarded write: rotate application logs

        This step is **destructive** — it would truncate the application log
        file in a real system. Flip the *Confirm writes* toggle above to
        allow it to run.
        """
    )
    return


@app.cell
def _(confirm_writes, sh):
    sh(
        r"""
        echo "Rotating logs..."
        # Real version: sudo systemctl kill -s HUP myapp
        echo "Log rotation complete: $(date -u +%FT%TZ)"
        """,
        guarded=True,
        confirm=confirm_writes.value,
    )
    return


@app.cell
def _(mo):
    mo.md(
        """
        ---

        **Runbook complete.**

        *Tip:* To post-mortem the run, screenshot the notebook or export it
        to HTML (`File → Export → HTML`). The `CompletedProcess` cards
        preserve the exit codes and output inline.
        """
    )
    return


if __name__ == "__main__":
    app.run()

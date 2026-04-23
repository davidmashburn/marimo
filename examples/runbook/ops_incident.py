# Copyright 2026 Marimo. All rights reserved.
"""Incident response runbook — demonstration of marimo.runbook.

Shows all five wrappers (sh, node, mongo, http, just) with guarded writes,
a confirmation toggle, and rich output rendering.

    marimo edit examples/runbook/ops_incident.py
"""

import marimo

__generated_with = "0.23.1"
app = marimo.App(width="medium", app_title="Incident Response Runbook")


@app.cell
def _():
    import marimo as mo
    import marimo.runbook as rb

    return mo, rb


@app.cell
def _(mo):
    mo.md("""
    # Incident Response Runbook

    This runbook walks through diagnosing and mitigating a hypothetical service
    incident. Each cell is an executable step.

    > **Before running write steps:** flip the *Confirm writes* toggle below.
    """)
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
def _(rb):
    rb.sh(r"""
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
    mo.md("## Step 2 — Check running processes")
    return


@app.cell
def _(rb):
    rb.sh(r"""
    ps aux --sort=-%mem | head -20
    """)
    return


@app.cell
def _(mo):
    mo.md("## Step 3 — Node.js diagnostic script")
    return


@app.cell
def _(rb):
    rb.node(r"""
    // Quick memory / version diagnostic
    const { execSync } = await import('child_process');
    const used = process.memoryUsage();
    console.log('Node version:', process.version);
    console.log('Heap used (MB):', Math.round(used.heapUsed / 1024 / 1024));
    console.log('RSS (MB):', Math.round(used.rss / 1024 / 1024));
    """)
    return


@app.cell
def _(mo):
    mo.md("## Step 4 — HTTP health check")
    return


@app.cell
def _(rb):
    # Replace the URL with your service endpoint
    rb.http("GET", "https://httpbin.org/status/200")
    return


@app.cell
def _(mo):
    mo.md("""
    ## Step 5 — Guarded write: rotate application log

    This step is **destructive** — it will truncate the application log file.
    Flip the *Confirm writes* toggle above to allow it to run.
    """)
    return


@app.cell
def _(confirm_writes, rb):
    rb.sh(
        r"""
        echo "Rotating logs..."
        # In a real runbook this would be: sudo systemctl logrotate myapp
        echo "Log rotation complete: $(date)"
        """,
        guarded=True,
        confirm=confirm_writes.value,
    )
    return


@app.cell
def _(mo):
    mo.md("""
    ## Step 6 — Guarded write: just recipe

    Runs `just deploy` — only executes when writes are confirmed.
    """)
    return


@app.cell
def _(confirm_writes, rb):
    # Guarded: won't run unless confirm_writes is True
    rb.just(
        "deploy",
        guarded=True,
        confirm=confirm_writes.value,
    )
    return


@app.cell
def _(mo):
    mo.md("""
    ---

    **Runbook complete.**

    Export this session as a worklog with:

    ```
    marimo runbook export examples/runbook/ops_incident.py --out worklog.sh
    ```
    """)
    return


if __name__ == "__main__":
    app.run()

# Copyright 2026 Marimo. All rights reserved.
"""marimo runbook CLI subcommands.

marimo runbook init [dir]     — scaffold a runbook + write preset adapters
marimo runbook export <nb.py> — emit a worklog shell script from a notebook
"""

from __future__ import annotations

import textwrap
from pathlib import Path

import click

from marimo._cli.help_formatter import ColoredCommand, ColoredGroup
from marimo._cli.print import echo, green

# ---------------------------------------------------------------------------
# Group
# ---------------------------------------------------------------------------


@click.group(
    cls=ColoredGroup,
    help="Commands for creating and exporting runbook notebooks.",
)
def runbook() -> None:
    pass


# ---------------------------------------------------------------------------
# marimo runbook init
# ---------------------------------------------------------------------------

_RUNBOOK_TEMPLATE = '''\
# Copyright {year} Marimo. All rights reserved.
import marimo

__generated_with = "{version}"
app = marimo.App(width="medium", app_title="Runbook")


@app.cell
def _():
    import marimo as mo
    import marimo.runbook as rb
    return mo, rb


@app.cell
def _(mo):
    mo.md("""
    # Runbook title

    Describe the purpose of this runbook here.
    Each cell below is a step. Run them in order.
    """)
    return


@app.cell
def _(rb):
    rb.sh(r"""
    echo "Step 1: check environment"
    uname -a
    """)
    return


if __name__ == "__main__":
    app.run()
'''

_PRESET_ADAPTERS: list[dict[str, str | bool]] = [
    {
        "enabled": True,
        "function_name": "rb.sh",
        "syntax_language": "bash",
        "shape": "both",
        "default_quote_prefix": "r",
        "default_assignment_name": "result",
    },
    {
        "enabled": True,
        "function_name": "rb.node",
        "syntax_language": "javascript",
        "shape": "both",
        "default_quote_prefix": "r",
        "default_assignment_name": "result",
    },
    {
        "enabled": True,
        "function_name": "rb.mongo",
        "syntax_language": "javascript",
        "shape": "both",
        "default_quote_prefix": "r",
        "default_assignment_name": "result",
    },
    {
        "enabled": True,
        "function_name": "rb.http",
        "syntax_language": "bash",
        "shape": "expression",
        "default_quote_prefix": "r",
    },
    {
        "enabled": True,
        "function_name": "rb.just",
        "syntax_language": "bash",
        "shape": "expression",
        "default_quote_prefix": "r",
    },
]


def _merge_preset_into_toml(toml_path: Path) -> None:
    """Merge preset adapters into marimo.toml (or create it)."""
    import tomlkit

    if toml_path.exists():
        doc = tomlkit.parse(toml_path.read_text(encoding="utf-8"))
    else:
        doc = tomlkit.document()

    if "runtime" not in doc:
        doc.add("runtime", tomlkit.table())

    # tomlkit's Item/Container types don't play well with mypy; cast via Any
    from typing import Any

    runtime: Any = doc["runtime"]

    # Get existing adapters, keyed by function_name
    existing: list[dict[str, Any]] = list(
        runtime.get("wrapped_text_adapters", [])
    )
    existing_names = {str(a.get("function_name", "")) for a in existing}

    added: list[str] = []
    for preset in _PRESET_ADAPTERS:
        fn = str(preset["function_name"])
        if fn not in existing_names:
            existing.append(preset)
            added.append(fn)

    runtime["wrapped_text_adapters"] = existing

    toml_path.write_text(tomlkit.dumps(doc), encoding="utf-8")

    if added:
        echo(
            f"  Added adapters: {', '.join(green(n) for n in added)}"
        )
    else:
        echo("  All preset adapters already present — no changes made.")


@runbook.command(
    cls=ColoredCommand,
    help="Scaffold a runbook notebook and configure preset adapters.",
)
@click.argument(
    "directory",
    default=".",
    type=click.Path(file_okay=False),
)
@click.option(
    "--name",
    default="runbook.py",
    help="Filename for the generated notebook.",
    show_default=True,
)
def init(directory: str, name: str) -> None:
    """Create a runbook notebook and write preset adapter config.

    \b
    Examples:
        marimo runbook init
        marimo runbook init ./ops --name incident.py
    """
    from datetime import datetime

    from marimo._version import __version__

    target_dir = Path(directory)
    target_dir.mkdir(parents=True, exist_ok=True)

    # Write notebook
    nb_path = target_dir / name
    if nb_path.exists():
        if not click.confirm(
            f"{nb_path} already exists. Overwrite?", default=False
        ):
            echo("Skipping notebook creation.")
        else:
            nb_path.write_text(
                _RUNBOOK_TEMPLATE.format(
                    year=datetime.now().year, version=__version__
                ),
                encoding="utf-8",
            )
            echo(f"Wrote {green(str(nb_path))}")
    else:
        nb_path.write_text(
            _RUNBOOK_TEMPLATE.format(
                year=datetime.now().year, version=__version__
            ),
            encoding="utf-8",
        )
        echo(f"Wrote {green(str(nb_path))}")

    # Merge preset adapters into marimo.toml
    toml_path = target_dir / "marimo.toml"
    echo(f"\nUpdating {green(str(toml_path))} with preset adapters...")
    _merge_preset_into_toml(toml_path)

    echo(
        f"\nDone. Open your runbook with:\n\n"
        f"    marimo edit {nb_path}\n"
    )


# ---------------------------------------------------------------------------
# marimo runbook export
# ---------------------------------------------------------------------------


def _extract_notebook_cells(
    notebook_path: Path,
) -> list[tuple[str, str]]:
    """Parse a marimo notebook and return (name, code) pairs for each cell."""
    import ast

    source = notebook_path.read_text(encoding="utf-8")
    tree = ast.parse(source)

    cells: list[tuple[str, str]] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.FunctionDef):
            continue
        # Collect @app.cell decorated functions
        for deco in node.decorator_list:
            is_app_cell = (
                isinstance(deco, ast.Attribute)
                and deco.attr == "cell"
                and isinstance(deco.value, ast.Name)
                and deco.value.id == "app"
            )
            if is_app_cell:
                # Reconstruct source lines for the function body
                body_lines: list[str] = []
                for child in node.body:
                    # Get source segment if available
                    try:
                        seg = ast.get_source_segment(source, child)
                        if seg:
                            body_lines.append(seg)
                    except Exception:
                        pass
                cell_code = "\n".join(body_lines)
                cells.append((node.name, cell_code))
    return cells


def _extract_runbook_commands(
    cell_code: str,
) -> list[tuple[str, str]]:
    """Return (wrapper_name, string_literal) pairs for rb.* calls in a cell."""
    import ast

    RUNBOOK_WRAPPERS = {"sh", "node", "mongo", "http", "just"}

    results: list[tuple[str, str]] = []
    try:
        tree = ast.parse(cell_code)
    except SyntaxError:
        return results

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        # Match rb.sh(...) or sh(...) shapes
        if isinstance(func, ast.Attribute) and func.attr in RUNBOOK_WRAPPERS:
            wrapper = func.attr
        elif isinstance(func, ast.Name) and func.id in RUNBOOK_WRAPPERS:
            wrapper = func.id
        else:
            continue

        # Collect leading positional string literal arguments.
        # For rb.http("GET", "https://...") we want both parts joined.
        if not node.args:
            continue
        str_parts: list[str] = []
        for arg in node.args:
            if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                str_parts.append(textwrap.dedent(arg.value).strip())
            else:
                break  # stop at first non-string arg
        if str_parts:
            results.append((wrapper, "\n".join(str_parts)))

    return results


def _emit_worklog(
    notebook_path: Path,
    out_path: Path | None,
) -> None:
    """Write an annotated shell script worklog for all runbook commands."""
    from datetime import datetime, timezone

    cells = _extract_notebook_cells(notebook_path)
    if not cells:
        raise click.ClickException(
            f"No marimo cells found in {notebook_path}. "
            "Is this a valid marimo notebook?"
        )

    lines: list[str] = []
    lines.append("#!/usr/bin/env bash")
    lines.append(
        f"# Worklog exported from {notebook_path.name}"
        f" on {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}"
    )
    lines.append(f"# Source: {notebook_path.absolute()}")
    lines.append("")

    found_any = False
    for cell_name, cell_code in cells:
        commands = _extract_runbook_commands(cell_code)
        if not commands:
            continue
        found_any = True
        lines.append(f"# --- cell: {cell_name} ---")
        for wrapper, command in commands:
            lines.append(f"# wrapper: {wrapper}")
            lines.extend(textwrap.dedent(command).splitlines())
            lines.append("")

    if not found_any:
        raise click.ClickException(
            "No runbook commands (rb.sh / rb.node / etc.) found in "
            f"{notebook_path}."
        )

    output = "\n".join(lines)

    if out_path is None:
        click.echo(output)
    else:
        out_path.write_text(output, encoding="utf-8")
        echo(f"Wrote worklog to {green(str(out_path))}")


@runbook.command(
    "export",
    cls=ColoredCommand,
    help="Export a runbook notebook as an annotated shell script worklog.",
)
@click.argument(
    "notebook",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
)
@click.option(
    "--out",
    "out_path",
    default=None,
    type=click.Path(dir_okay=False, path_type=Path),
    help="Output path. Defaults to stdout.",
)
def export_worklog(notebook: Path, out_path: Path | None) -> None:
    """Emit a worklog shell script from the commands in NOTEBOOK.

    \b
    Examples:
        marimo runbook export runbook.py
        marimo runbook export runbook.py --out worklog.sh
    """
    _emit_worklog(notebook, out_path)

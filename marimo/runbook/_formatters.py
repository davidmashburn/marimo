# Copyright 2026 Marimo. All rights reserved.
from __future__ import annotations

import subprocess
from html import escape

from marimo._messaging.mimetypes import KnownMimeType
from marimo._output import formatting
from marimo.runbook._wrappers import BlockedWrite

_STYLE = """
<style>
  .rb-card {
    border: 1px solid var(--gray-4, #e5e7eb);
    border-radius: 8px;
    overflow: hidden;
    font-family: var(--font-family, inherit);
    margin: 4px 0;
  }
  .rb-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 500;
  }
  .rb-header.success { background: var(--grass-2, #f0fdf4); color: var(--grass-11, #166534); }
  .rb-header.failure { background: var(--red-2, #fef2f2); color: var(--red-11, #7f1d1d); }
  .rb-header.blocked { background: var(--amber-2, #fffbeb); color: var(--amber-11, #78350f); }
  .rb-badge { font-size: 16px; }
  .rb-meta { margin-left: auto; opacity: 0.7; font-size: 12px; }
  .rb-body { padding: 0; }
  details.rb-section { border-top: 1px solid var(--gray-4, #e5e7eb); }
  details.rb-section summary {
    cursor: pointer;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 500;
    color: var(--gray-11, #374151);
    user-select: none;
    list-style: none;
  }
  details.rb-section summary::before { content: "▶ "; font-size: 10px; }
  details.rb-section[open] summary::before { content: "▼ "; }
  details.rb-section pre {
    margin: 0;
    padding: 8px 12px;
    background: var(--gray-2, #f9fafb);
    font-size: 12px;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 400px;
    overflow-y: auto;
  }
  .rb-no-output { padding: 6px 12px; font-size: 12px; color: var(--gray-9, #9ca3af); font-style: italic; }
</style>
"""

_STYLE_EMITTED = False


def _style_once() -> str:
    global _STYLE_EMITTED
    if _STYLE_EMITTED:
        return ""
    _STYLE_EMITTED = True
    return _STYLE


def _section(label: str, content: str, expanded: bool = False) -> str:
    open_attr = " open" if expanded else ""
    return (
        f'<details class="rb-section"{open_attr}>'
        f"<summary>{escape(label)}</summary>"
        f"<pre>{escape(content[:8000])}</pre>"
        "</details>"
    )


def _format_process(
    result: subprocess.CompletedProcess[str],
) -> tuple[KnownMimeType, str]:
    ok = result.returncode == 0
    badge = "✅" if ok else "❌"
    cls = "success" if ok else "failure"
    cmd = result.args
    if isinstance(cmd, list):
        cmd_str = " ".join(str(a) for a in cmd)
    else:
        cmd_str = str(cmd)
    cmd_display = escape(cmd_str[:120] + ("…" if len(cmd_str) > 120 else ""))

    header = (
        f'<div class="rb-header {cls}">'
        f'<span class="rb-badge">{badge}</span>'
        f"<span>{cmd_display}</span>"
        f'<span class="rb-meta">exit&nbsp;{result.returncode}</span>'
        "</div>"
    )

    sections: list[str] = []
    stdout = (result.stdout or "").rstrip()
    stderr = (result.stderr or "").rstrip()

    if stdout:
        sections.append(_section("stdout", stdout, expanded=True))
    if stderr:
        sections.append(_section("stderr", stderr, expanded=not ok))
    if not stdout and not stderr:
        sections.append('<div class="rb-no-output">no output</div>')

    body = f'<div class="rb-body">{"".join(sections)}</div>'
    html = f'{_style_once()}<div class="rb-card">{header}{body}</div>'
    return ("text/html", html)


def _format_blocked(blocked: BlockedWrite) -> tuple[KnownMimeType, str]:
    header = (
        f'<div class="rb-header blocked">'
        f'<span class="rb-badge">🔒</span>'
        f"<span>{escape(blocked.kind)}</span>"
        f'<span class="rb-meta">{escape(blocked.message)}</span>'
        "</div>"
    )
    cmd_section = _section("command (not executed)", blocked.command)
    html = (
        f'{_style_once()}<div class="rb-card">'
        f"{header}"
        f'<div class="rb-body">{cmd_section}</div>'
        f"</div>"
    )
    return ("text/html", html)


def _register_formatters() -> None:
    formatting.formatter(subprocess.CompletedProcess)(_format_process)
    formatting.formatter(BlockedWrite)(_format_blocked)

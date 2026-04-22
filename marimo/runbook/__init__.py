# Copyright 2026 Marimo. All rights reserved.
"""marimo.runbook — opt-in toolkit for operational runbooks.

Import this module to get sh/node/mongo/http/just wrappers that execute
commands and render rich output (status badge, duration, stdout/stderr).

    import marimo.runbook as rb

    rb.sh(r\"\"\"
    echo hello
    \"\"\")
"""

from marimo.runbook._formatters import _register_formatters
from marimo.runbook._wrappers import BlockedWrite, http, just, mongo, node, sh

_register_formatters()

__all__ = [
    "BlockedWrite",
    "http",
    "just",
    "mongo",
    "node",
    "sh",
]

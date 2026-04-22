# Copyright 2026 Marimo. All rights reserved.
from __future__ import annotations

import os
import subprocess
import textwrap
from dataclasses import dataclass
from typing import Any


@dataclass
class BlockedWrite:
    """Sentinel returned when a guarded cell is called without confirmation."""

    kind: str
    command: str
    message: str = "Execution blocked — set confirm=True to run."


def _run(
    argv: list[str],
    input_text: str | None,
    *,
    cwd: str | None,
    env: dict[str, str] | None,
    timeout: float,
) -> subprocess.CompletedProcess[str]:
    merged_env: dict[str, str] | None = None
    if env is not None:
        merged_env = {**os.environ, **env}

    return subprocess.run(
        argv,
        input=input_text,
        capture_output=True,
        text=True,
        timeout=timeout,
        cwd=cwd,
        env=merged_env,
    )


def sh(
    script: str,
    *,
    cwd: str | None = None,
    env: dict[str, str] | None = None,
    timeout: float = 120,
    guarded: bool = False,
    confirm: Any = None,
) -> subprocess.CompletedProcess[str] | BlockedWrite:
    """Run a shell script via bash and return a CompletedProcess.

    Args:
        script: Shell script body (dedented automatically).
        cwd: Working directory for the subprocess.
        env: Extra environment variables merged over os.environ.
        timeout: Seconds before the process is killed (default 120).
        guarded: If True, the cell will not run unless confirm=True.
        confirm: Must be set to True when guarded=True to allow execution.
    """
    script = textwrap.dedent(script).strip()
    if guarded and confirm is not True:
        return BlockedWrite(kind="sh", command=script)
    return _run(
        ["bash", "-c", script], None, cwd=cwd, env=env, timeout=timeout
    )


def node(
    script: str,
    *,
    cwd: str | None = None,
    env: dict[str, str] | None = None,
    timeout: float = 120,
    guarded: bool = False,
    confirm: Any = None,
) -> subprocess.CompletedProcess[str] | BlockedWrite:
    """Run a Node.js script and return a CompletedProcess.

    Args:
        script: JavaScript body (dedented automatically).
        cwd: Working directory for the subprocess.
        env: Extra environment variables merged over os.environ.
        timeout: Seconds before the process is killed (default 120).
        guarded: If True, the cell will not run unless confirm=True.
        confirm: Must be set to True when guarded=True to allow execution.
    """
    script = textwrap.dedent(script).strip()
    if guarded and confirm is not True:
        return BlockedWrite(kind="node", command=script)
    return _run(
        ["node", "--input-type=module", "-e", script],
        None,
        cwd=cwd,
        env=env,
        timeout=timeout,
    )


def mongo(
    script: str,
    uri: str = "mongodb://localhost:27017",
    *,
    cwd: str | None = None,
    env: dict[str, str] | None = None,
    timeout: float = 120,
    guarded: bool = False,
    confirm: Any = None,
) -> subprocess.CompletedProcess[str] | BlockedWrite:
    """Run a mongosh script and return a CompletedProcess.

    Args:
        script: mongosh JavaScript body (dedented automatically).
        uri: MongoDB connection URI.
        cwd: Working directory for the subprocess.
        env: Extra environment variables merged over os.environ.
        timeout: Seconds before the process is killed (default 120).
        guarded: If True, the cell will not run unless confirm=True.
        confirm: Must be set to True when guarded=True to allow execution.
    """
    script = textwrap.dedent(script).strip()
    if guarded and confirm is not True:
        return BlockedWrite(kind="mongo", command=script)
    return _run(
        ["mongosh", uri, "--eval", script, "--quiet"],
        None,
        cwd=cwd,
        env=env,
        timeout=timeout,
    )


def http(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    body: str | None = None,
    cwd: str | None = None,
    env: dict[str, str] | None = None,
    timeout: float = 30,
    guarded: bool = False,
    confirm: Any = None,
) -> subprocess.CompletedProcess[str] | BlockedWrite:
    """Send an HTTP request via curl and return a CompletedProcess.

    Args:
        method: HTTP method (GET, POST, PUT, DELETE, etc.).
        url: Request URL.
        headers: Optional dict of request headers.
        body: Optional request body string.
        cwd: Working directory for the subprocess.
        env: Extra environment variables merged over os.environ.
        timeout: Seconds before the process is killed (default 30).
        guarded: If True, the cell will not run unless confirm=True.
        confirm: Must be set to True when guarded=True to allow execution.
    """
    command_display = f"{method.upper()} {url}"
    if guarded and confirm is not True:
        return BlockedWrite(kind="http", command=command_display)

    argv = ["curl", "-s", "-i", "-X", method.upper(), url]
    if headers:
        for k, v in headers.items():
            argv += ["-H", f"{k}: {v}"]
    if body is not None:
        argv += ["--data-raw", body]

    return _run(argv, None, cwd=cwd, env=env, timeout=timeout)


def just(
    recipe: str,
    *args: str,
    cwd: str | None = None,
    env: dict[str, str] | None = None,
    timeout: float = 120,
    guarded: bool = False,
    confirm: Any = None,
) -> subprocess.CompletedProcess[str] | BlockedWrite:
    """Run a just recipe and return a CompletedProcess.

    Args:
        recipe: Recipe name to run.
        *args: Additional arguments passed to the recipe.
        cwd: Working directory for the subprocess.
        env: Extra environment variables merged over os.environ.
        timeout: Seconds before the process is killed (default 120).
        guarded: If True, the cell will not run unless confirm=True.
        confirm: Must be set to True when guarded=True to allow execution.
    """
    command_display = " ".join(["just", recipe, *args])
    if guarded and confirm is not True:
        return BlockedWrite(kind="just", command=command_display)
    return _run(
        ["just", recipe, *args], None, cwd=cwd, env=env, timeout=timeout
    )

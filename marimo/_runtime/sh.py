# Copyright 2026 Marimo. All rights reserved.
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import threading
from pathlib import Path
from typing import IO, Mapping, Sequence

from marimo._output.rich_help import mddoc


@mddoc
def _run_with_streaming_output(
    command: str | Sequence[str],
    *,
    check: bool,
    cwd: str | Path | None = None,
    env: Mapping[str, str] | None = None,
    executable: str | None = None,
    shell: bool = False,
) -> subprocess.CompletedProcess[str]:
    process_env = None if env is None else {**os.environ, **env}
    process = subprocess.Popen(
        command,
        cwd=None if cwd is None else str(cwd),
        env=process_env,
        executable=executable,
        shell=shell,
        stderr=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True,
    )

    stdout_chunks: list[str] = []
    stderr_chunks: list[str] = []

    def stream_pipe(
        pipe: IO[str] | None,
        output: IO[str],
        chunks: list[str],
    ) -> None:
        if pipe is None:
            return
        for chunk in iter(pipe.readline, ""):
            chunks.append(chunk)
            output.write(chunk)
            output.flush()
        pipe.close()

    stdout_thread = threading.Thread(
        target=stream_pipe,
        args=(process.stdout, sys.stdout, stdout_chunks),
    )
    stderr_thread = threading.Thread(
        target=stream_pipe,
        args=(process.stderr, sys.stderr, stderr_chunks),
    )
    stdout_thread.start()
    stderr_thread.start()

    returncode = process.wait()
    stdout_thread.join()
    stderr_thread.join()

    stdout = "".join(stdout_chunks)
    stderr = "".join(stderr_chunks)
    result = subprocess.CompletedProcess(
        args=command,
        returncode=returncode,
        stdout=stdout,
        stderr=stderr,
    )

    if check and returncode != 0:
        raise subprocess.CalledProcessError(
            returncode,
            command,
            output=stdout,
            stderr=stderr,
        )

    return result


@mddoc
def sh(
    script: str,
    *,
    check: bool = True,
    shell: str | None = None,
    cwd: str | Path | None = None,
    env: Mapping[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a shell script.

    The script's stdout and stderr are streamed to the cell output and also
    captured in the returned ``subprocess.CompletedProcess``.

    Args:
        script: Shell script to run.
        check: If True, raise ``subprocess.CalledProcessError`` on non-zero
            exit status.
        shell: Optional shell executable. When omitted, Python's platform
            shell default is used.
        cwd: Optional working directory for the command.
        env: Optional environment variable overrides.

    Returns:
        A ``subprocess.CompletedProcess`` with captured stdout and stderr.
    """
    return _run_with_streaming_output(
        script,
        check=check,
        cwd=cwd,
        env=env,
        executable=shell,
        shell=True,
    )


@mddoc
def node(
    script: str,
    *,
    check: bool = True,
    executable: str = "node",
    cwd: str | Path | None = None,
    env: Mapping[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run JavaScript using Node.js.

    The script's stdout and stderr are streamed to the cell output and also
    captured in the returned ``subprocess.CompletedProcess``.

    Args:
        script: JavaScript source to evaluate.
        check: If True, raise ``subprocess.CalledProcessError`` on non-zero
            exit status.
        executable: Node.js executable to run.
        cwd: Optional working directory for the command.
        env: Optional environment variable overrides.

    Returns:
        A ``subprocess.CompletedProcess`` with captured stdout and stderr.
    """
    command = [executable, "-e", script]
    try:
        return _run_with_streaming_output(
            command,
            check=check,
            cwd=cwd,
            env=env,
        )
    except FileNotFoundError:
        if check:
            raise
        stderr = f"{executable} not found on PATH\n"
        sys.stderr.write(stderr)
        sys.stderr.flush()
        return subprocess.CompletedProcess(
            args=command,
            returncode=127,
            stdout="",
            stderr=stderr,
        )

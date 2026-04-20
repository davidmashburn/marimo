# Copyright 2026 Marimo. All rights reserved.
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest

from marimo._runtime.sh import node, sh


def test_sh_streams_and_returns_result(capsys: pytest.CaptureFixture[str]) -> None:
    result = sh('printf "hello\\n"')

    captured = capsys.readouterr()
    assert captured.out == "hello\n"
    assert result.returncode == 0
    assert result.stdout == "hello\n"
    assert result.stderr == ""


def test_sh_raises_by_default() -> None:
    with pytest.raises(subprocess.CalledProcessError):
        sh("exit 1")


def test_sh_check_false_returns_nonzero_result() -> None:
    result = sh("exit 7", check=False)

    assert result.returncode == 7


def test_sh_honors_cwd_and_env(tmp_path: Path) -> None:
    result = sh(
        'printf "%s:%s" "$PWD" "$MARIMO_TEST_SH_VALUE"',
        cwd=tmp_path,
        env={"MARIMO_TEST_SH_VALUE": "ok"},
    )

    assert result.stdout == f"{tmp_path}:ok"


@pytest.mark.skipif(os.name == "nt", reason="/bin/sh is Unix-specific")
def test_sh_honors_explicit_shell() -> None:
    result = sh('printf "%s" "$0"', shell="/bin/sh")

    assert result.stdout == "/bin/sh"


@pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")
def test_node_streams_and_returns_result(
    capsys: pytest.CaptureFixture[str],
) -> None:
    result = node('console.log("hello from node")')

    captured = capsys.readouterr()
    assert captured.out == "hello from node\n"
    assert result.returncode == 0
    assert result.stdout == "hello from node\n"
    assert result.stderr == ""


@pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")
def test_node_raises_by_default() -> None:
    with pytest.raises(subprocess.CalledProcessError):
        node("process.exit(5)")


@pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")
def test_node_check_false_returns_nonzero_result() -> None:
    result = node("process.exit(7)", check=False)

    assert result.returncode == 7


@pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")
def test_node_honors_cwd_and_env(tmp_path: Path) -> None:
    result = node(
        'console.log(`${process.cwd()}:${process.env.MARIMO_TEST_NODE_VALUE}`)',
        cwd=tmp_path,
        env={"MARIMO_TEST_NODE_VALUE": "ok"},
    )

    assert result.stdout == f"{tmp_path}:ok\n"


def test_node_missing_executable_check_false() -> None:
    result = node(
        "console.log(1)", executable="__missing_node_binary__", check=False
    )

    assert result.returncode == 127
    assert "not found on PATH" in result.stderr


def test_node_missing_executable_raises_by_default() -> None:
    with pytest.raises(FileNotFoundError):
        node("console.log(1)", executable="__missing_node_binary__")

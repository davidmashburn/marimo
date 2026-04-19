# Copyright 2026 Marimo. All rights reserved.

import marimo

__generated_with = "0.23.1"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo

    return (mo,)


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    # Generic wrapped-text cells

    This notebook is a quick tour of the new wrapped-text smart-cell pattern.
    It includes Markdown, Python, shell script through `mo.sh(...)`, and SQL
    reading data produced by a shell cell.

    Try switching the shell cells between Shell and Python. The Python wrapper
    should round-trip as `mo.sh(r"\"\"..."\"\")`.
    """)
    return


@app.cell
def _(mo):
    mo.sh(r"""
    cat > /tmp/marimo-shell-demo.csv <<'CSV'
    region,product,units,price
    east,notebook,4,12.50
    east,pen,22,1.40
    west,notebook,7,12.50
    west,pencil,18,0.809
    north,notebook,3,12.50
    north,pen,12,1.40
    south,pencil,40,0.80
    south,notebook,5,12.50
    CSV
    printf "created %s\n" /tmp/marimo-shell-demo.csv
    wc -l /tmp/marimo-shell-demo.csv
    """)
    return


@app.cell
def _(mo):
    create_csv = mo.sh(r"""
    cat > /tmp/marimo-shell-demo.csv <<'CSV'
    region,product,units,price
    east,notebook,4,12.50
    east,pen,22,1.40
    west,notebook,7,12.50
    west,pencil,18,0.80
    north,notebook,3,12.50
    north,pen,12,1.40
    south,pencil,40,0.80
    south,notebook,5,12.50
    CSV
    printf "created %s\n" /tmp/marimo-shell-demo.csv
    wc -l /tmp/marimo-shell-demo.csv
    """)
    return (create_csv,)


@app.cell
def _(create_csv):
    create_csv
    return


@app.cell(hide_code=True)
def _(create_csv, mo):
    mo.md(f"""
    ## Shell output is streamed and captured

    The previous shell cell created a CSV file and returned a
    `subprocess.CompletedProcess`.

    - return code: `{create_csv.returncode}`
    - captured stdout:

    ```text
    {create_csv.stdout.strip()}
    ```
    """)
    return


@app.cell
def _(mo):
    minimum_revenue = mo.ui.slider(
        0,
        150,
        value=20,
        step=5,
        label="Minimum regional revenue",
    )
    minimum_revenue
    return (minimum_revenue,)


@app.cell
def _(minimum_revenue, mo):
    sales_by_region = mo.sql(
        f"""
        SELECT
            region,
            SUM(units) AS units,
            ROUND(SUM(units * price), 2) AS revenue
        FROM read_csv_auto('/tmp/marimo-shell-demo.csv')
        GROUP BY region
        HAVING revenue >= {minimum_revenue.value}
        ORDER BY revenue DESC
        """,
        output=False
    )
    return (sales_by_region,)


@app.cell
def _(sales_by_region):
    sales_by_region
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Assignments and runtime options

    Shell cells can be expression-style or assignment-style. They also preserve
    keyword arguments like `check=False`, `cwd=...`, `env=...`, and `shell=...`
    when toggled through the smart-cell adapter.
    """)
    return


@app.cell
def _(mo):
    failed = mo.sh(r"""
    echo "about to return a non-zero status"
    exit 7
    """, check=False)
    return (failed,)


@app.cell
def _(failed, mo):
    mo.md(f"""
    The assigned shell cell above used `check=False`, so the notebook keeps
    running even though the command exited with `{failed.returncode}`.
    """)
    return


@app.cell
def _(mo):
    env_result = mo.sh(r"""
    printf "GREETING=%s\n" "$GREETING"
    pwd
    """, env={"GREETING": "hello from mo.sh"}, cwd="/tmp")
    return (env_result,)


@app.cell
def _(env_result, mo):
    mo.md(f"""
    The last shell cell honored `env` and `cwd`:

    ```text
    {env_result.stdout.strip()}
    ```
    """)
    return


if __name__ == "__main__":
    app.run()

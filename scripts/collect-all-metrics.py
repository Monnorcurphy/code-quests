#!/usr/bin/env python3
"""
core/scripts/collect-all-metrics.py — Backfill metrics for all existing tasks.

Scans metrics/ for existing audit files and ralph logs, generates snapshot
JSONs for each task, and optionally commits them all via commit-metrics.sh.

No LLM calls. No tokens consumed. Pure local computation.

Usage:
    python3 core/scripts/collect-all-metrics.py --attempt=1
    python3 core/scripts/collect-all-metrics.py --attempt=1 --commit
    python3 core/scripts/collect-all-metrics.py --attempt=1 --phase=2
"""

import os
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
METRICS_DIR = REPO_ROOT / "metrics"
SCRIPTS_DIR = REPO_ROOT / "core" / "scripts"

sys.path.insert(0, str(SCRIPTS_DIR))
import importlib.util
_spec = importlib.util.spec_from_file_location(
    "collect_metrics", str(SCRIPTS_DIR / "collect-metrics.py")
)
collect_metrics = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(collect_metrics)


def discover_task_ids() -> list:
    """Discover all task IDs from metrics files, specs, and transcripts."""
    task_ids = set()

    # From metrics/ audit files
    if METRICS_DIR.exists():
        for f in METRICS_DIR.iterdir():
            m = re.match(r"audit-task-(\d+\.\d+)", f.name)
            if m:
                task_ids.add(m.group(1))
            m = re.match(r"ralph-task-(\d+\.\d+)", f.name)
            if m:
                task_ids.add(m.group(1))

    # From specs/done/ (completed review passes)
    done_dir = REPO_ROOT / "specs" / "done"
    if done_dir.exists():
        for f in done_dir.iterdir():
            m = re.match(r"review-pass-task-(\d+\.\d+)", f.name)
            if m:
                task_ids.add(m.group(1))

    # From per-task spec directories
    specs_dir = REPO_ROOT / "specs"
    if specs_dir.exists():
        for d in specs_dir.iterdir():
            m = re.match(r"phase-(\d+)", d.name)
            if m and d.is_dir():
                for sub in d.iterdir():
                    m2 = re.match(r"task-(\d+\.\d+)", sub.name)
                    if m2:
                        task_ids.add(m2.group(1))

    return sorted(task_ids, key=lambda t: [int(x) for x in t.split(".")])


def main():
    attempt = None
    do_commit = False
    phase_filter = None

    for arg in sys.argv[1:]:
        if arg.startswith("--attempt="):
            attempt = arg.split("=", 1)[1]
        elif arg == "--commit":
            do_commit = True
        elif arg.startswith("--phase="):
            phase_filter = arg.split("=", 1)[1]
        elif arg in ("--help", "-h"):
            print(__doc__)
            sys.exit(0)

    if not attempt:
        print("Error: --attempt=N required")
        sys.exit(1)

    task_ids = discover_task_ids()
    if phase_filter:
        task_ids = [t for t in task_ids if t.split(".")[0] == phase_filter]

    if not task_ids:
        print("  No tasks found to collect metrics for.")
        sys.exit(0)

    print(f"  Found {len(task_ids)} tasks: {', '.join(task_ids)}")
    print()

    collected = 0
    failed = 0

    for task_id in task_ids:
        try:
            print(f"  [{task_id}] Collecting...")
            collect_metrics.collect("task", task_id, attempt)
            collected += 1
        except Exception as e:
            print(f"  [{task_id}] Failed: {e}")
            failed += 1

    print()
    print(f"  Collected: {collected}/{len(task_ids)} tasks")
    if failed > 0:
        print(f"  Failed: {failed}")

    # Optionally commit all at once
    if do_commit:
        print()
        print("  Committing all metrics...")
        script = str(SCRIPTS_DIR / "commit-metrics.sh")
        result = subprocess.run(
            [script, "--scope=project", f"--attempt={attempt}"],
            cwd=str(REPO_ROOT),
        )
        if result.returncode != 0:
            print("  Warning: commit-metrics.sh returned non-zero")


if __name__ == "__main__":
    main()

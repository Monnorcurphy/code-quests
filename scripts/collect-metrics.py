#!/usr/bin/env python3
"""
core/scripts/collect-metrics.py — Zero-token metrics collection for Ralph Loop.

Gathers audit data from existing JSONL transcripts and ralph logs, producing
a lightweight snapshot JSON that tracks trends over time.

No LLM calls. No tokens consumed. Pure local computation.

Usage:
    python3 core/scripts/collect-metrics.py --scope=task --id=1.1 --attempt=1
    python3 core/scripts/collect-metrics.py --scope=phase --id=2 --attempt=1
    python3 core/scripts/collect-metrics.py --scope=project --attempt=1

Output:
    metrics/snapshot-{scope}-{id}-{timestamp}.json
"""

import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
METRICS_DIR = REPO_ROOT / "metrics"

# Import audit.py's parsing logic
sys.path.insert(0, str(REPO_ROOT / "core" / "scripts"))
import audit as audit_mod


# ── Helpers ──────────────────────────────────────────────────────────────────

def _parse_ralph_log(log_path: Path) -> dict:
    """Extract timing and outcome info from a ralph log file."""
    info = {
        "file": str(log_path),
        "wall_clock_seconds": None,
        "outcome": None,
        "bug_count": None,
        "steps": [],
    }
    try:
        text = log_path.read_text(errors="replace")

        # Detect steps from section markers
        if "── Builder log:" in text:
            info["steps"].append("builder")
        if "── Reviewer log:" in text:
            info["steps"].append("reviewer")
        if "── Fixer log:" in text:
            info["steps"].append("fixer")

        # Infer outcome from content
        if "0 bugs filed" in text or "Review Complete — PASS" in text:
            info["outcome"] = "clean"
            info["bug_count"] = 0
        elif "bugs filed" in text:
            m = re.search(r"(\d+)\s+bugs?\s+filed", text)
            if m:
                info["bug_count"] = int(m.group(1))
                info["outcome"] = "issues" if int(m.group(1)) > 0 else "clean"
        elif "FAIL" in text.upper() or "BLOCKER" in text:
            info["outcome"] = "failed"

        # Try to compute wall-clock time from the filename timestamp
        m = re.search(r"ralph-task-[\w.]+-(\d{4}-\d{2}-\d{2}_\d{2}-\d{2})\.log",
                       log_path.name)
        if m:
            info["start_timestamp"] = m.group(1)

    except Exception:
        pass
    return info


def _task_ids_for_phase(phase: str) -> list:
    """Discover task IDs belonging to a phase by scanning spec dirs and audit files."""
    task_ids = set()

    # Check per-task spec directories
    phase_dir = REPO_ROOT / "specs" / f"phase-{phase}"
    if phase_dir.exists():
        for d in phase_dir.iterdir():
            m = re.match(r"task-(\d+\.\d+)", d.name)
            if m:
                task_ids.add(m.group(1))

    # Also check metrics/ for existing audit files
    if METRICS_DIR.exists():
        for f in METRICS_DIR.iterdir():
            m = re.match(r"audit-task-(\d+\.\d+)", f.name)
            if m:
                tid = m.group(1)
                if tid.split(".")[0] == phase:
                    task_ids.add(tid)

    # Also check specs/done/ for completed review passes
    done_dir = REPO_ROOT / "specs" / "done"
    if done_dir.exists():
        for f in done_dir.iterdir():
            m = re.match(r"review-pass-task-(\d+\.\d+)", f.name)
            if m:
                tid = m.group(1)
                if tid.split(".")[0] == phase:
                    task_ids.add(tid)

    return sorted(task_ids, key=lambda t: [int(x) for x in t.split(".")])


def _load_existing_audit_json(task_id: str) -> list:
    """Load session data from existing audit JSON files in metrics/.

    Fallback for when JSONL transcripts aren't available (e.g. different
    repo clone, or transcripts have been cleaned up).
    """
    sessions = []
    if not METRICS_DIR.exists():
        return sessions

    # Try the combined audit file first (audit-task-1.1.json)
    combined = METRICS_DIR / f"audit-task-{task_id}.json"
    if combined.exists():
        try:
            data = json.loads(combined.read_text())
            for s in data.get("sessions", []):
                sessions.append(s)
        except (json.JSONDecodeError, KeyError):
            pass

    # Also try per-step files (audit-task-1.1-builder.json, etc.)
    if not sessions:
        for step in ("builder", "reviewer", "fixer", "pr"):
            step_file = METRICS_DIR / f"audit-task-{task_id}-{step}.json"
            if step_file.exists():
                try:
                    data = json.loads(step_file.read_text())
                    for s in data.get("sessions", []):
                        sessions.append(s)
                except (json.JSONDecodeError, KeyError):
                    pass

    return sessions


def _collect_task_snapshot(task_id: str) -> dict:
    """Collect snapshot data for a single task."""
    snapshot = {
        "task_id": task_id,
        "sessions": [],
        "totals": {
            "context_chars": 0,
            "context_chars_by_role": {},
            "input_tokens": 0,
            "cache_creation_tokens": 0,
            "cache_read_tokens": 0,
            "output_tokens": 0,
            "api_calls": 0,
            "tool_calls": 0,
            "warnings": 0,
            "duplicate_reads": 0,
        },
        "top_read_files": [],
        "unfiltered_commands": 0,
        "ralph_logs": [],
        "wall_clock_seconds": None,
    }

    # Try live JSONL transcripts first, fall back to existing audit JSONs
    sessions = []
    source = "none"
    try:
        sessions = audit_mod.find_sessions(task_id=task_id)
        if sessions:
            source = "transcripts"
    except SystemExit:
        pass

    if not sessions:
        sessions = _load_existing_audit_json(task_id)
        if sessions:
            source = "audit_json"

    # Aggregate session data (works with both transcript-parsed and audit JSON sessions)
    read_file_chars = Counter()  # path -> total chars read
    read_file_count = Counter()  # path -> number of reads

    for session in sessions:
        step = session.get("step", "unknown")
        tool_calls = session.get("tool_calls", [])
        context_chars = sum(tc.get("result_chars", 0) for tc in tool_calls)
        warns = sum(1 for tc in tool_calls if "warning" in tc)
        unfiltered = sum(
            1 for tc in tool_calls
            if tc.get("tool") == "Bash"
            and audit_mod._is_unfiltered_build_cmd(tc.get("input_summary", ""))
        )

        # Token usage
        usage = session.get("token_usage", {})
        snapshot["totals"]["context_chars"] += context_chars
        snapshot["totals"]["input_tokens"] += usage.get("input_tokens", 0)
        snapshot["totals"]["cache_creation_tokens"] += usage.get("cache_creation_tokens", 0)
        snapshot["totals"]["cache_read_tokens"] += usage.get("cache_read_tokens", 0)
        snapshot["totals"]["output_tokens"] += usage.get("output_tokens", 0)
        snapshot["totals"]["api_calls"] += session.get("api_calls", 0)
        snapshot["totals"]["tool_calls"] += len(tool_calls)
        snapshot["totals"]["warnings"] += warns
        snapshot["unfiltered_commands"] += unfiltered

        # Per-role context
        role_key = step
        snapshot["totals"]["context_chars_by_role"][role_key] = (
            snapshot["totals"]["context_chars_by_role"].get(role_key, 0) + context_chars
        )

        # Track reads for duplicate detection
        for tc in tool_calls:
            if tc.get("tool") == "Read":
                path = tc.get("input_summary", tc.get("input", ""))
                read_file_chars[path] += tc.get("result_chars", tc.get("chars", 0))
                read_file_count[path] += 1

        # Duplicate reads within this session
        session_reads = [
            tc.get("input_summary", tc.get("input", ""))
            for tc in tool_calls if tc.get("tool") == "Read"
        ]
        session_read_counts = Counter(session_reads)
        session_dupes = sum(c - 1 for c in session_read_counts.values() if c > 1)
        snapshot["totals"]["duplicate_reads"] += session_dupes

        # Use context_chars from session directly if available (audit JSON format)
        session_context = session.get("context_chars", context_chars)

        snapshot["sessions"].append({
            "step": step,
            "model": session.get("model"),
            "context_chars": session_context,
            "api_calls": session.get("api_calls", 0),
            "tool_calls": len(tool_calls),
            "warnings": warns,
            "duration": session.get("duration") or audit_mod._calc_duration(
                session.get("start_time"), session.get("end_time")
            ),
        })

    # Top 10 files by chars read
    top_files = read_file_chars.most_common(10)
    snapshot["top_read_files"] = [
        {"path": path, "chars": chars, "reads": read_file_count[path]}
        for path, chars in top_files
    ]

    # Generate fresh audit reports if we have transcript-sourced sessions
    if source == "transcripts":
        try:
            md_content, json_report = audit_mod.generate_report(sessions, task_id)
            audit_mod.write_reports(md_content, json_report, task_id)
        except Exception:
            pass

    # Find ralph logs (always — regardless of session source)
    if METRICS_DIR.exists():
        for f in sorted(METRICS_DIR.glob(f"ralph-task-{task_id}-*.log")):
            log_info = _parse_ralph_log(f)
            snapshot["ralph_logs"].append(log_info)

    # Parse build-log.txt for structured outcome data
    build_log = METRICS_DIR / "build-log.txt"
    if build_log.exists():
        try:
            for line in build_log.read_text().splitlines():
                if f"TASK {task_id} " in line:
                    parts = [p.strip() for p in line.split("|")]
                    entry = {"raw": line}
                    for part in parts:
                        if part.startswith("BUILD:"):
                            entry["build"] = part.split(":")[1]
                        elif part.startswith("VERIFY:"):
                            entry["verify"] = part.split(":")[1]
                        elif part.startswith("REVIEW:"):
                            entry["review"] = part.split(":", 1)[1]
                        elif part.startswith("FIXES:"):
                            entry["fixes"] = part.split(":", 1)[1]
                    snapshot.setdefault("build_log_entries", []).append(entry)
        except Exception:
            pass

    return snapshot


# ── Main Collection ──────────────────────────────────────────────────────────

def collect(scope: str, scope_id: str, attempt: str = None) -> Path:
    """Collect metrics and write snapshot JSON. Returns path to snapshot file."""
    METRICS_DIR.mkdir(exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    if scope == "task":
        task_snapshot = _collect_task_snapshot(scope_id)
        snapshot = {
            "scope": "task",
            "id": scope_id,
            "attempt": attempt,
            "timestamp": timestamp,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "task": task_snapshot,
        }
        filename = f"snapshot-task-{scope_id}-{timestamp}.json"

    elif scope == "phase":
        task_ids = _task_ids_for_phase(scope_id)
        task_snapshots = []
        phase_totals = {
            "context_chars": 0,
            "input_tokens": 0,
            "cache_creation_tokens": 0,
            "cache_read_tokens": 0,
            "output_tokens": 0,
            "api_calls": 0,
            "tool_calls": 0,
            "warnings": 0,
            "duplicate_reads": 0,
            "wall_clock_seconds": 0,
            "tasks_count": len(task_ids),
        }
        for tid in task_ids:
            ts = _collect_task_snapshot(tid)
            task_snapshots.append(ts)
            for key in ["context_chars", "input_tokens", "cache_creation_tokens",
                         "cache_read_tokens", "output_tokens", "api_calls",
                         "tool_calls", "warnings", "duplicate_reads"]:
                phase_totals[key] += ts["totals"].get(key, 0)
            if ts.get("wall_clock_seconds"):
                phase_totals["wall_clock_seconds"] += ts["wall_clock_seconds"]

        snapshot = {
            "scope": "phase",
            "id": scope_id,
            "attempt": attempt,
            "timestamp": timestamp,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "totals": phase_totals,
            "tasks": task_snapshots,
        }
        filename = f"snapshot-phase-{scope_id}-{timestamp}.json"

    elif scope == "project":
        # Discover all phases
        phase_ids = set()
        specs_dir = REPO_ROOT / "specs"
        if specs_dir.exists():
            for d in specs_dir.iterdir():
                m = re.match(r"phase-(\d+)", d.name)
                if m:
                    phase_ids.add(m.group(1))
        # Also check metrics for audit files
        if METRICS_DIR.exists():
            for f in METRICS_DIR.iterdir():
                m = re.match(r"audit-task-(\d+)\.", f.name)
                if m:
                    phase_ids.add(m.group(1).split(".")[0])

        phase_ids = sorted(phase_ids, key=int)
        all_tasks = []
        project_totals = {
            "context_chars": 0,
            "input_tokens": 0,
            "cache_creation_tokens": 0,
            "cache_read_tokens": 0,
            "output_tokens": 0,
            "api_calls": 0,
            "tool_calls": 0,
            "warnings": 0,
            "duplicate_reads": 0,
            "wall_clock_seconds": 0,
            "phases_count": len(phase_ids),
            "tasks_count": 0,
        }
        for pid in phase_ids:
            task_ids = _task_ids_for_phase(pid)
            project_totals["tasks_count"] += len(task_ids)
            for tid in task_ids:
                ts = _collect_task_snapshot(tid)
                all_tasks.append(ts)
                for key in ["context_chars", "input_tokens", "cache_creation_tokens",
                             "cache_read_tokens", "output_tokens", "api_calls",
                             "tool_calls", "warnings", "duplicate_reads"]:
                    project_totals[key] += ts["totals"].get(key, 0)
                if ts.get("wall_clock_seconds"):
                    project_totals["wall_clock_seconds"] += ts["wall_clock_seconds"]

        snapshot = {
            "scope": "project",
            "id": "all",
            "attempt": attempt,
            "timestamp": timestamp,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "totals": project_totals,
            "tasks": all_tasks,
        }
        filename = f"snapshot-project-{timestamp}.json"
    else:
        print(f"Error: unknown scope '{scope}'. Use task, phase, or project.")
        sys.exit(1)

    # Write snapshot
    snapshot_path = METRICS_DIR / filename
    with open(snapshot_path, "w") as f:
        json.dump(snapshot, f, indent=2)

    print(f"  Snapshot written: {snapshot_path.relative_to(REPO_ROOT)}")
    return snapshot_path


# ── CLI ──────────────────────────────────────────────────────────────────────

def main():
    scope = None
    scope_id = None
    attempt = None

    for arg in sys.argv[1:]:
        if arg.startswith("--scope="):
            scope = arg.split("=", 1)[1]
        elif arg.startswith("--id="):
            scope_id = arg.split("=", 1)[1]
        elif arg.startswith("--attempt="):
            attempt = arg.split("=", 1)[1]
        elif arg in ("--help", "-h"):
            print(__doc__)
            sys.exit(0)

    if not scope:
        print("Error: --scope=task|phase|project required")
        sys.exit(1)

    if scope in ("task", "phase") and not scope_id:
        print(f"Error: --id=<id> required for scope={scope}")
        sys.exit(1)

    collect(scope, scope_id or "all", attempt)


if __name__ == "__main__":
    main()

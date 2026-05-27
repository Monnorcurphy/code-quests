#!/usr/bin/env python3
"""
core/scripts/audit.py — Deterministic context window audit for Ralph Loop sessions.

Parses Claude Code JSONL conversation transcripts and produces a structured
report of what the agent did, what ate context, and where time went.

No LLM calls. No tokens consumed. Pure local computation.

Usage:
    ./core/scripts/audit.sh 1.11                  # audit all steps for task 1.11
    ./core/scripts/audit.sh 1.11 --builder        # just the builder session
    ./core/scripts/audit.sh --latest              # most recent task
    ./core/scripts/audit.sh --all                 # summary of all tasks

Output:
    metrics/audit-task-{id}-{step}.md        # human-readable report
    metrics/audit-task-{id}-{step}.json      # machine-readable (paste to Claude for analysis)
"""

import json
import os
import sys
import glob
import re
from datetime import datetime, timezone
from collections import Counter, defaultdict
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────────

# Walk up from script location to find the repo root (directory containing .git)
_script_dir = Path(__file__).resolve().parent
REPO_ROOT = _script_dir
for _ancestor in [_script_dir] + list(_script_dir.parents):
    if (_ancestor / ".git").exists():
        REPO_ROOT = _ancestor
        break
PROJECTS_DIR = Path.home() / ".claude" / "projects"

# Claude Code stores transcripts under a dir named after the repo path
# e.g. ~/.claude/projects/-Users-connormurphy-Dev-my-project/
# Derive exact path from repo root
_encoded = str(REPO_ROOT).replace("/", "-")
TRANSCRIPT_DIR = PROJECTS_DIR / _encoded

if not TRANSCRIPT_DIR.exists():
    # Fallback: search for any matching directory based on repo name
    TRANSCRIPT_DIR = None
    repo_name = REPO_ROOT.name
    for d in PROJECTS_DIR.iterdir():
        if d.is_dir() and repo_name in d.name:
            TRANSCRIPT_DIR = d
            break

METRICS_DIR = REPO_ROOT / "metrics"
BUILD_LOG = METRICS_DIR / "build-log.txt"

# ── Thresholds for warnings ────────────────────────────────────────────────

WARN_RESULT_SIZE = 5000       # chars — flag tool results larger than this
WARN_SPEC_SIZE = 10000        # chars — flag spec reads larger than this
WARN_UNFILTERED_CMDS = {      # commands that should be piped through tail/grep
    "cargo test", "cargo build", "cargo clippy", "cargo check",
    "pnpm test", "pnpm lint", "pnpm typecheck", "pnpm build",
    "pnpm install", "npm install", "npm test", "npm run build",
    "yarn test", "yarn build", "yarn lint",
    "pip install", "pytest", "python -m pytest",
    "go test", "go build", "go vet",
    "mvn test", "mvn compile", "gradle test", "gradle build",
}


# ── JSONL Parsing ───────────────────────────────────────────────────────────

def parse_session(jsonl_path: str) -> dict:
    """Parse a single JSONL conversation transcript into a structured session."""
    lines = []
    with open(jsonl_path) as f:
        for raw in f:
            raw = raw.strip()
            if raw:
                try:
                    lines.append(json.loads(raw))
                except json.JSONDecodeError:
                    continue

    if not lines:
        return None

    session = {
        "file": str(jsonl_path),
        "session_id": None,
        "prompt": None,
        "step": None,  # builder, reviewer, fixer, pr
        "task_id": None,
        "model": None,
        "git_branch": None,
        "start_time": None,
        "end_time": None,
        "tool_calls": [],
        "token_usage": {
            "input_tokens": 0,
            "cache_creation_tokens": 0,
            "cache_read_tokens": 0,
            "output_tokens": 0,
        },
        "api_calls": 0,
        "warnings": [],
    }

    # Track tool_use -> tool_result mapping
    pending_tool_uses = {}  # id -> {name, input, timestamp}

    for obj in lines:
        ts = obj.get("timestamp")
        obj_type = obj.get("type")

        # Session metadata
        if not session["session_id"] and obj.get("sessionId"):
            session["session_id"] = obj["sessionId"]
        if not session["git_branch"] and obj.get("gitBranch"):
            session["git_branch"] = obj["gitBranch"]

        # Track timestamps
        if ts:
            if not session["start_time"]:
                session["start_time"] = ts
            session["end_time"] = ts

        if obj_type == "assistant":
            msg = obj.get("message", {})

            # Model
            if not session["model"] and msg.get("model"):
                session["model"] = msg["model"]

            # Token usage
            usage = msg.get("usage", {})
            if usage:
                session["api_calls"] += 1
                session["token_usage"]["input_tokens"] += usage.get("input_tokens", 0)
                session["token_usage"]["cache_creation_tokens"] += usage.get("cache_creation_input_tokens", 0)
                session["token_usage"]["cache_read_tokens"] += usage.get("cache_read_input_tokens", 0)
                session["token_usage"]["output_tokens"] += usage.get("output_tokens", 0)

            # Tool uses
            for c in msg.get("content", []):
                if c.get("type") == "tool_use":
                    tool_id = c.get("id", "")
                    pending_tool_uses[tool_id] = {
                        "name": c.get("name", "unknown"),
                        "input": c.get("input", {}),
                        "timestamp": ts,
                    }

        elif obj_type == "user":
            msg = obj.get("message", {})
            content = msg.get("content", "")

            # First user message = the prompt
            if isinstance(content, str) and not session["prompt"]:
                session["prompt"] = content

            # Tool results
            if isinstance(content, list):
                for c in content:
                    if c.get("type") == "tool_result":
                        tool_id = c.get("tool_use_id", "")
                        result_content = c.get("content", "")

                        # Handle list-type results
                        if isinstance(result_content, list):
                            result_text = ""
                            for part in result_content:
                                if isinstance(part, dict) and part.get("type") == "text":
                                    result_text += part.get("text", "")
                            result_content = result_text

                        result_size = len(result_content) if isinstance(result_content, str) else 0

                        tool_info = pending_tool_uses.pop(tool_id, {})
                        tool_name = tool_info.get("name", "unknown")
                        tool_input = tool_info.get("input", {})
                        tool_ts = tool_info.get("timestamp", ts)

                        call_record = {
                            "tool": tool_name,
                            "input_summary": _summarize_input(tool_name, tool_input),
                            "result_chars": result_size,
                            "timestamp": tool_ts,
                            "result_timestamp": ts,
                        }

                        # Check for warnings
                        if tool_name == "Read" and result_size > WARN_SPEC_SIZE:
                            file_path = tool_input.get("file_path", "")
                            if "phase-" in file_path or "spec" in file_path.lower():
                                call_record["warning"] = f"Full spec read ({result_size:,} chars)"

                        if tool_name == "Bash":
                            cmd = tool_input.get("command", "")
                            if result_size > WARN_RESULT_SIZE:
                                # Check if it's an unfiltered build command
                                if _is_unfiltered_build_cmd(cmd):
                                    call_record["warning"] = f"Unfiltered build output ({result_size:,} chars)"
                                elif "node_modules" in result_content or "/target/" in result_content:
                                    call_record["warning"] = f"Build artifacts in output ({result_size:,} chars)"
                            if ("Cargo.lock" in result_content or "pnpm-lock" in result_content
                                    or "package-lock" in result_content) and result_size > 2000:
                                call_record["warning"] = f"Lockfile in diff ({result_size:,} chars)"

                        session["tool_calls"].append(call_record)

    # Identify step type from prompt
    if session["prompt"]:
        session["step"] = _identify_step(session["prompt"])
        session["task_id"] = _extract_task_id(session["prompt"])

    return session


def _summarize_input(tool_name: str, tool_input: dict) -> str:
    """Create a short human-readable summary of a tool call's input."""
    if tool_name == "Read":
        path = tool_input.get("file_path", "")
        return _short_path(path)
    elif tool_name == "Write":
        path = tool_input.get("file_path", "")
        return f"write {_short_path(path)}"
    elif tool_name == "Edit":
        path = tool_input.get("file_path", "")
        return f"edit {_short_path(path)}"
    elif tool_name == "Bash":
        cmd = tool_input.get("command", "")
        # Truncate long commands
        if len(cmd) > 120:
            return cmd[:117] + "..."
        return cmd
    elif tool_name == "Glob":
        return tool_input.get("pattern", "")
    elif tool_name == "Grep":
        pattern = tool_input.get("pattern", "")
        path = tool_input.get("path", "")
        return f"/{pattern}/ in {_short_path(path)}" if path else f"/{pattern}/"
    elif tool_name == "TodoWrite":
        return "(todo update)"
    else:
        return str(tool_input)[:100]


def _short_path(path: str) -> str:
    """Shorten file paths for display."""
    repo_str = str(REPO_ROOT) + "/"
    if path.startswith(repo_str):
        return path[len(repo_str):]
    # Generic: strip everything up to and including the repo directory name
    repo_name = REPO_ROOT.name
    if f"/{repo_name}/" in path:
        return path.split(f"/{repo_name}/", 1)[1]
    return path


def _identify_step(prompt: str) -> str:
    """Identify which Ralph Loop step this session represents."""
    prompt_lower = prompt.lower()
    # Order matters: check most specific patterns first
    if "you are a code reviewer" in prompt_lower:
        return "reviewer"
    elif "you are fixing bugs" in prompt_lower or "fixing bugs found" in prompt_lower:
        return "fixer"
    elif "push" in prompt_lower and "pr" in prompt_lower and len(prompt) < 500:
        return "pr"
    elif "implement task" in prompt_lower or "implement only" in prompt_lower:
        return "builder"
    else:
        return "builder"


def _extract_task_id(prompt: str) -> str:
    """Extract task ID from the prompt. Supports both numeric (1.11) and codename formats."""
    # Try numeric first: TASK 1.11
    match = re.search(r"TASK\s+(\d+\.\d+)", prompt)
    if match:
        return match.group(1)
    # Try codename: TASK alpaca or task alpaca
    match = re.search(r"TASK\s+([a-zA-Z][\w-]+)", prompt, re.IGNORECASE)
    if match:
        return match.group(1)
    return None


def _is_unfiltered_build_cmd(cmd: str) -> bool:
    """Check if a build/test command lacks output filtering."""
    cmd_stripped = cmd.strip()
    for pattern in WARN_UNFILTERED_CMDS:
        if pattern in cmd_stripped:
            # Check if it has piping (tail, grep, head)
            if "|" in cmd_stripped:
                return False
            # Check if it's a targeted test (specific test name)
            if "test" in pattern and len(cmd_stripped.split()) > 2:
                return False
            return True
    return False


# ── Session Discovery ───────────────────────────────────────────────────────

def find_sessions(task_id: str = None, step_filter: str = None,
                  latest: bool = False, all_tasks: bool = False) -> list:
    """Find JSONL sessions matching the criteria."""
    if not TRANSCRIPT_DIR or not TRANSCRIPT_DIR.exists():
        print(f"  Error: transcript directory not found: {TRANSCRIPT_DIR}")
        sys.exit(1)

    jsonl_files = sorted(
        TRANSCRIPT_DIR.glob("*.jsonl"),
        key=lambda p: p.stat().st_mtime
    )

    sessions = []

    for jf in jsonl_files:
        # Quick check: read first few lines to find task ID without full parse
        task_match = _quick_task_check(jf, task_id, all_tasks=(all_tasks or latest))
        if not task_match:
            continue

        session = parse_session(str(jf))
        if not session or not session["task_id"]:
            continue

        if task_id and session["task_id"] != task_id:
            continue

        if step_filter and session["step"] != step_filter:
            continue

        sessions.append(session)

    if latest and sessions:
        # Group by task_id, return only the most recent task
        by_task = defaultdict(list)
        for s in sessions:
            by_task[s["task_id"]].append(s)
        latest_task = max(by_task.keys(), key=lambda t: max(
            s["start_time"] for s in by_task[t]
        ))
        sessions = by_task[latest_task]

    # Sort by start time
    sessions.sort(key=lambda s: s["start_time"] or "")
    return sessions


def _quick_task_check(jsonl_path: Path, task_id: str = None,
                      all_tasks: bool = False) -> bool:
    """Quick scan of first few lines to check if this session matches."""
    try:
        with open(jsonl_path) as f:
            for i, line in enumerate(f):
                if i > 5:
                    break
                if all_tasks and "TASK" in line:
                    return True
                if task_id and f"TASK {task_id}" in line:
                    return True
        return False
    except (json.JSONDecodeError, UnicodeDecodeError):
        return False


# ── Report Generation ───────────────────────────────────────────────────────

def generate_report(sessions: list, task_id: str) -> tuple:
    """Generate markdown and JSON reports for the given sessions."""

    # ── JSON report (machine-readable) ──
    json_report = {
        "task_id": task_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sessions": [],
    }

    # ── Markdown report (human-readable) ──
    md_lines = []

    total_context_chars = 0
    total_input_tokens = 0
    total_output_tokens = 0
    total_api_calls = 0
    all_warnings = []

    for session in sessions:
        step = session["step"] or "unknown"
        model = session["model"] or "unknown"
        duration = _calc_duration(session["start_time"], session["end_time"])

        # Calculate context consumed (sum of all tool result chars)
        context_chars = sum(tc["result_chars"] for tc in session["tool_calls"])
        total_context_chars += context_chars
        total_input_tokens += (
            session["token_usage"]["input_tokens"]
            + session["token_usage"]["cache_creation_tokens"]
            + session["token_usage"]["cache_read_tokens"]
        )
        total_output_tokens += session["token_usage"]["output_tokens"]
        total_api_calls += session["api_calls"]

        # Top consumers
        by_tool = defaultdict(lambda: {"count": 0, "chars": 0})
        for tc in session["tool_calls"]:
            by_tool[tc["tool"]]["count"] += 1
            by_tool[tc["tool"]]["chars"] += tc["result_chars"]

        top_consumers = sorted(by_tool.items(), key=lambda x: -x[1]["chars"])

        # Warnings
        session_warnings = [tc for tc in session["tool_calls"] if "warning" in tc]
        all_warnings.extend(session_warnings)

        # Duplicate reads
        read_paths = [tc["input_summary"] for tc in session["tool_calls"]
                      if tc["tool"] == "Read"]
        read_counts = Counter(read_paths)
        duplicates = {p: c for p, c in read_counts.items() if c > 1}

        # ── Build markdown section ──
        md_lines.append(f"### {step.upper()} ({model}) — {duration}")
        md_lines.append(f"")
        md_lines.append(f"Context consumed: **{context_chars:,}** chars | "
                        f"API calls: {session['api_calls']} | "
                        f"Tool calls: {len(session['tool_calls'])} | "
                        f"Output tokens: {session['token_usage']['output_tokens']:,}")
        md_lines.append(f"")

        # Timeline
        md_lines.append(f"**Timeline:**")
        md_lines.append(f"```")
        running_context = 0
        start_dt = _parse_ts(session["start_time"])
        for tc in session["tool_calls"]:
            tc_dt = _parse_ts(tc["timestamp"])
            elapsed = ""
            if start_dt and tc_dt:
                delta = (tc_dt - start_dt).total_seconds()
                mins = int(delta // 60)
                secs = int(delta % 60)
                elapsed = f"{mins:02d}:{secs:02d}"

            running_context += tc["result_chars"]
            warn_marker = " !!!" if "warning" in tc else ""
            summary = tc["input_summary"]
            if len(summary) > 70:
                summary = summary[:67] + "..."
            md_lines.append(
                f"  {elapsed:>5}  {tc['tool']:10} {tc['result_chars']:>7,} chars  "
                f"({running_context:>9,} cum)  {summary}{warn_marker}"
            )
        md_lines.append(f"```")
        md_lines.append(f"")

        # Top consumers
        md_lines.append(f"**Top context consumers:**")
        for tool_name, stats in top_consumers[:5]:
            pct = (stats["chars"] / context_chars * 100) if context_chars > 0 else 0
            md_lines.append(
                f"  {tool_name:10} {stats['chars']:>9,} chars  "
                f"({stats['count']}x, {pct:.0f}%)"
            )
        md_lines.append(f"")

        # Warnings
        if session_warnings:
            md_lines.append(f"**Warnings:**")
            for tc in session_warnings:
                md_lines.append(f"  - {tc['warning']}: `{tc['input_summary'][:80]}`")
            md_lines.append(f"")

        # Duplicates
        if duplicates:
            md_lines.append(f"**Duplicate reads:**")
            for path, count in duplicates.items():
                md_lines.append(f"  - {path} read {count}x")
            md_lines.append(f"")

        md_lines.append(f"---")
        md_lines.append(f"")

        # ── Build JSON section ──
        json_session = {
            "step": step,
            "model": model,
            "session_id": session["session_id"],
            "start_time": session["start_time"],
            "end_time": session["end_time"],
            "duration": duration,
            "prompt": session["prompt"],
            "git_branch": session["git_branch"],
            "context_chars": context_chars,
            "api_calls": session["api_calls"],
            "token_usage": session["token_usage"],
            "tool_calls": session["tool_calls"],
            "top_consumers": {k: v for k, v in top_consumers},
            "warnings": [
                {"warning": tc["warning"], "tool": tc["tool"],
                 "input": tc["input_summary"], "chars": tc["result_chars"]}
                for tc in session_warnings
            ],
            "duplicate_reads": duplicates,
        }
        json_report["sessions"].append(json_session)

    # ── Summary header ──
    header = []
    header.append(f"# Audit: Task {task_id}")
    header.append(f"")
    header.append(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    header.append(f"Sessions: {len(sessions)}")
    header.append(f"")
    header.append(f"## Summary")
    header.append(f"")
    header.append(f"| Metric | Value |")
    header.append(f"|---|---|")
    header.append(f"| Total context consumed | **{total_context_chars:,}** chars |")
    header.append(f"| Total input tokens (incl. cache) | {total_input_tokens:,} |")
    header.append(f"| Total output tokens | {total_output_tokens:,} |")
    header.append(f"| Total API round-trips | {total_api_calls} |")
    header.append(f"| Warnings | {len(all_warnings)} |")
    header.append(f"")

    if all_warnings:
        header.append(f"### All Warnings")
        header.append(f"")
        for tc in all_warnings:
            step_name = "?"
            for s in sessions:
                if any(t is tc for t in s["tool_calls"]):
                    step_name = s["step"]
                    break
            header.append(f"  - [{step_name}] {tc['warning']}: `{tc['input_summary'][:80]}`")
        header.append(f"")

    header.append(f"---")
    header.append(f"")

    json_report["summary"] = {
        "total_context_chars": total_context_chars,
        "total_input_tokens": total_input_tokens,
        "total_output_tokens": total_output_tokens,
        "total_api_calls": total_api_calls,
        "total_warnings": len(all_warnings),
    }

    md_content = "\n".join(header + md_lines)
    return md_content, json_report


def _calc_duration(start: str, end: str) -> str:
    """Calculate human-readable duration from ISO timestamps."""
    start_dt = _parse_ts(start)
    end_dt = _parse_ts(end)
    if not start_dt or not end_dt:
        return "unknown"
    delta = (end_dt - start_dt).total_seconds()
    mins = int(delta // 60)
    secs = int(delta % 60)
    return f"{mins:02d}:{secs:02d}"


def _parse_ts(ts: str) -> datetime:
    """Parse ISO timestamp string."""
    if not ts:
        return None
    try:
        # Handle both Z and +00:00 formats
        ts = ts.replace("Z", "+00:00")
        return datetime.fromisoformat(ts)
    except (ValueError, TypeError):
        return None


# ── Output ──────────────────────────────────────────────────────────────────

def write_reports(md_content: str, json_report: dict, task_id: str,
                  step_filter: str = None):
    """Write reports to metrics/ directory."""
    METRICS_DIR.mkdir(exist_ok=True)

    suffix = f"-{step_filter}" if step_filter else ""
    md_path = METRICS_DIR / f"audit-task-{task_id}{suffix}.md"
    json_path = METRICS_DIR / f"audit-task-{task_id}{suffix}.json"

    with open(md_path, "w") as f:
        f.write(md_content)

    with open(json_path, "w") as f:
        json.dump(json_report, f, indent=2)

    return md_path, json_path


# ── Summary mode (--all) ───────────────────────────────────────────────────

def generate_all_summary():
    """Generate a summary across all tasks."""
    if not TRANSCRIPT_DIR or not TRANSCRIPT_DIR.exists():
        print(f"  Error: transcript directory not found")
        sys.exit(1)

    # Find all sessions
    jsonl_files = sorted(TRANSCRIPT_DIR.glob("*.jsonl"),
                         key=lambda p: p.stat().st_mtime)

    by_task = defaultdict(list)

    for jf in jsonl_files:
        if not _quick_task_check(jf, all_tasks=True):
            continue
        session = parse_session(str(jf))
        if session and session["task_id"]:
            by_task[session["task_id"]].append(session)

    if not by_task:
        print("  No task sessions found.")
        return

    print("")
    print("RALPH LOOP — CONTEXT AUDIT (ALL TASKS)")
    print("=" * 70)
    print("")
    print(f"{'Task':>6}  {'Step':>10}  {'Model':>20}  {'Duration':>8}  "
          f"{'Context':>10}  {'Tools':>5}  {'Warns':>5}")
    print("-" * 70)

    total_context = 0
    total_warnings = 0

    # Sort task IDs — handle both numeric (1.1) and codename (alpaca) formats
    def _sort_key(t):
        try:
            return [int(x) for x in t.split(".")]
        except ValueError:
            return [999, t]  # codenames sort after numeric

    for task_id in sorted(by_task.keys(), key=_sort_key):
        sessions = sorted(by_task[task_id], key=lambda s: s["start_time"] or "")
        for session in sessions:
            context = sum(tc["result_chars"] for tc in session["tool_calls"])
            warns = sum(1 for tc in session["tool_calls"] if "warning" in tc)
            duration = _calc_duration(session["start_time"], session["end_time"])
            model = (session["model"] or "unknown").replace("claude-", "").replace("-4-6", "")

            total_context += context
            total_warnings += warns

            warn_marker = f"  {'!!!' if warns > 0 else ''}"
            print(f"{task_id:>6}  {session['step']:>10}  {model:>20}  "
                  f"{duration:>8}  {context:>9,}  "
                  f"{len(session['tool_calls']):>5}  {warns:>5}{warn_marker}")

    print("-" * 70)
    print(f"{'TOTAL':>6}  {'':>10}  {'':>20}  {'':>8}  "
          f"{total_context:>9,}  {'':>5}  {total_warnings:>5}")
    print("")


# ── CLI ─────────────────────────────────────────────────────────────────────

def main():
    args = sys.argv[1:]

    if not args or "--help" in args or "-h" in args:
        print(__doc__)
        sys.exit(0)

    step_filter = None
    task_id = None
    latest = False
    all_tasks = False
    quiet = False

    for arg in args:
        if arg == "--builder":
            step_filter = "builder"
        elif arg == "--reviewer":
            step_filter = "reviewer"
        elif arg == "--fixer":
            step_filter = "fixer"
        elif arg == "--pr":
            step_filter = "pr"
        elif arg == "--latest":
            latest = True
        elif arg == "--all":
            all_tasks = True
        elif arg == "--quiet" or arg == "-q":
            quiet = True
        elif re.match(r"^\d+\.\d+$", arg):
            task_id = arg
        elif re.match(r"^[a-zA-Z][\w-]+$", arg) and arg not in ("--help",):
            task_id = arg  # codename

    if all_tasks:
        generate_all_summary()
        return

    if not task_id and not latest:
        print("Error: provide a task ID (e.g., 1.11 or alpaca) or --latest")
        sys.exit(1)

    if not quiet:
        target = f"task {task_id}" if task_id else "latest task"
        step_str = f" ({step_filter})" if step_filter else ""
        print(f"  Scanning transcripts for {target}{step_str}...")

    sessions = find_sessions(task_id=task_id, step_filter=step_filter,
                             latest=latest)

    if not sessions:
        print(f"  No sessions found for task {task_id or 'latest'}")
        sys.exit(1)

    # Resolve task_id from sessions if using --latest
    if not task_id:
        task_id = sessions[0]["task_id"]

    if not quiet:
        print(f"  Found {len(sessions)} session(s) for task {task_id}")

    md_content, json_report = generate_report(sessions, task_id)
    md_path, json_path = write_reports(md_content, json_report, task_id,
                                       step_filter)

    # Print to terminal
    print("")
    print(md_content)
    print("")
    print(f"  Reports saved:")
    print(f"    {md_path}")
    print(f"    {json_path}")


if __name__ == "__main__":
    main()

#!/bin/bash
# checks/no-eval.sh — Detect unsafe eval/exec patterns
# Usage: ./checks/no-eval.sh [search-path]
#
# eval() in shell scripts executes arbitrary strings as commands.
# If the string comes from user input (config files, task IDs, env vars),
# this is a code execution vulnerability.
#
# Also catches: new Function(), exec(), system() in app code.
#
# Exit 0 if clean, 1 if violations found

SEARCH_PATH="${1:-.}"
FOUND=0

EXCLUDES="--exclude-dir=.git --exclude-dir=node_modules --exclude-dir=target --exclude-dir=venv --exclude-dir=__pycache__ --exclude-dir=projects --exclude-dir=ui --exclude-dir=adversarial-tests"

# ── Shell: eval with variable interpolation ──
EVAL_HITS=$(grep -rn ${EXCLUDES} 'eval\s\+["\$]' "${SEARCH_PATH}" \
    --include="*.sh" \
    2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.')

if [ -n "$EVAL_HITS" ]; then
    COUNT=$(echo "$EVAL_HITS" | wc -l | tr -d ' ')
    echo "❌ Found ${COUNT} eval() with variable interpolation in shell scripts:"
    echo "$EVAL_HITS" | head -10
    echo ""
    echo "Fix: replace eval with bash -c or direct execution, validate input first"
    FOUND=1
fi

# ── JS/TS: eval(), new Function(), setTimeout/setInterval with strings ──
JS_EVAL=$(grep -rn ${EXCLUDES} 'eval(\|new Function(\|setTimeout(["\x27]\|setInterval(["\x27]' "${SEARCH_PATH}" \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v node_modules)

if [ -n "$JS_EVAL" ]; then
    COUNT=$(echo "$JS_EVAL" | wc -l | tr -d ' ')
    echo "❌ Found ${COUNT} eval/Function/string-setTimeout in JS/TS:"
    echo "$JS_EVAL" | head -10
    FOUND=1
fi

# ── Python: exec(), eval() ──
PY_EVAL=$(grep -rn ${EXCLUDES} 'exec(\|eval(' "${SEARCH_PATH}" \
    --include="*.py" \
    2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v '__pycache__')

if [ -n "$PY_EVAL" ]; then
    COUNT=$(echo "$PY_EVAL" | wc -l | tr -d ' ')
    echo "⚠️  Found ${COUNT} exec/eval in Python:"
    echo "$PY_EVAL" | head -10
    FOUND=1
fi

# ── Rust: std::process::Command with user input (heuristic) ──
RUST_CMD=$(grep -rn ${EXCLUDES} 'Command::new.*&\|\.arg.*format!' "${SEARCH_PATH}" \
    --include="*.rs" \
    2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.')

if [ -n "$RUST_CMD" ]; then
    COUNT=$(echo "$RUST_CMD" | wc -l | tr -d ' ')
    echo "⚠️  Found ${COUNT} Command::new with possible user input in Rust:"
    echo "$RUST_CMD" | head -10
    FOUND=1
fi

exit ${FOUND}

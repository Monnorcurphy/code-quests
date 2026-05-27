# Build Completeness Checklist

When configuring any tool or framework, verify the FULL chain works end-to-end.
A misconfigured tool that silently produces no output is worse than a missing tool.

## General Pattern

For every build tool you configure:
1. Configuration file exists and has correct content paths
2. All required plugins/loaders are installed
3. Entry points import/reference the configuration
4. Verify: a change in source actually produces visible output

## Common Chains to Verify

### CSS Framework (Tailwind, etc.)
- Config file exists with correct content paths
- PostCSS or build plugin is configured
- CSS entry file exists with framework directives
- Entry file imported in app root
- Verify: a framework class actually produces visible styles

### Linter (ESLint, Clippy, etc.)
- Every rule in .claude/rules/ that the linter can enforce IS configured as 'error' (not 'warn')
- Run the linter — zero errors AND zero warnings

### Type System (TypeScript, Rust, etc.)
- Strict mode enabled in config
- All types crossing IPC/external boundaries have runtime validators (Zod, serde, etc.), not just static types

### Pre-Commit Checks
- Every check in the pre-submit sequence must PASS before committing
- The check sequence is defined in CLAUDE.md or factory/profile.yaml
- All must pass. Zero warnings. Zero errors.

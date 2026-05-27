# Security Rules

Universal security constraints — apply to all stacks.

1. **No secrets in code**: API keys, tokens, passwords, private keys must never appear in source files. Use OS keychain or secret managers — never in config files, env vars committed to git, or localStorage. Grep for `sk-`, `AKIA`, `api_key`, `password=` before committing.

2. **No telemetry by default**: No analytics or telemetry unless the user explicitly opts in.

3. **Least privilege**: Request only the permissions you need. Extension/app permissions: request the minimum required and declare explicitly.

4. **Safe file I/O**: Always validate file paths. Never construct paths from user input without sanitization. Avoid path traversal vulnerabilities.

5. **No eval**: Never use `eval()`, `exec()`, `new Function()`, or equivalent dynamic code execution — ever, not just with untrusted input.

6. **PII sanitization**: Before any cloud LLM or external API call, sanitize personally identifiable information:
   - Names → [PERSON] or [CANDIDATE]
   - Companies → [COMPANY_1], [COMPANY_2]
   - Dates → relative ("~3 years ago")
   - Emails/phones → stripped entirely

7. **Instant deletion**: When a user requests data deletion, remove it immediately — no soft-delete grace periods.

8. **Boundary validation**: All data crossing boundaries (IPC, HTTP, file I/O, message passing) must be validated. Use schema validation (Zod, serde, pydantic, etc.) at edges. The `checks/cross-boundary.sh` and `checks/binary-assets.sh` scripts automate detection of common boundary mismatches.

9. **Content Security Policy**: Configure CSP headers where applicable — no inline scripts, no external resource loading from untrusted origins.

10. **Dependency hygiene**: Keep dependencies minimal. Audit new dependencies before adding. Prefer well-maintained packages with clear security policies.

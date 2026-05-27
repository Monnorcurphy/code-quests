# Rust Conventions (Domain Template)

This is a TEMPLATE. Copy it to your project's rules/domain/backend/ and customize.

- Run `cargo clippy -- -D warnings` before every commit — zero warnings policy
- Use `thiserror` for all error types — no raw strings or `Box<dyn Error>`
- Async runtime: tokio — do not add other async runtimes
- API keys and secrets: OS keychain or environment — never in config files
- No `unsafe` blocks without a comment explaining why it's necessary
- Use `serde` derive macros for all structs crossing boundaries (IPC, HTTP, file I/O)
- All DB access through connection pools or mutex-protected state — never open connections directly

# Cross-Boundary Type Safety

Rules for keeping types consistent across backend (Rust/Python/Go) and frontend (TypeScript/JS).

## Serialization Field Names Must Match (CRITICAL)

Any backend struct that deserializes from frontend-generated JSON must have EXACT field name matches with the frontend schema keys.

- Use explicit per-field renames (e.g., `#[serde(rename = "fieldName")]`) when backend naming conventions differ from frontend (snake_case vs camelCase)
- Do NOT rely on blanket rename rules alone — they produce wrong casing for acronyms (e.g., `meetsWcagAa` instead of `meetsWCAG_AA`)
- **Test:** Deserialize a JSON fixture using the frontend-generated keys. All fields must populate correctly.

## Required Fields Must Not Silently Default

When deserializing from external JSON (API responses, config files, user input):
- Required fields must be non-optional types
- Do NOT use default values on fields the frontend schema marks as required
- A malformed input should fail deserialization, not silently populate with empty/zero values

Exception: LLM response structs — these MUST use defaults (see `serde-resilience.md`)

## Shared Constants — Single Source of Truth

Any constant used by multiple packages must be defined ONCE in a shared module and imported by all consumers.
- Protocol message types, host identifiers, enum values
- Never duplicate a constant into a local file
- If backend and frontend both need it, the shared package is the source of truth

## Algorithm Consistency

When the same algorithm is implemented in multiple languages or files:
- All implementations must use identical constants and thresholds
- Consolidate to a single utility function where possible
- Grep for the constants across all packages to verify consistency

## Schema Validation at All Boundaries

Every IPC call, API request, and event payload must have a corresponding validation schema (Zod, JSON Schema, pydantic, etc.) that validates the shape at runtime.
- Unvalidated boundaries are cross-boundary gaps
- Static type checking alone is not sufficient — runtime validation catches drift

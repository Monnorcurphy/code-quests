# Serde Resilience (LLM Response Structs)

LLMs are unreliable serializers. Every struct used to deserialize LLM output MUST be defensive.

## Rules

1. **Default on ALL fields** except the primary answer/content field. LLMs routinely omit optional fields, return wrong types, or produce partial JSON.

2. **Use optional types for non-essential fields.** If the feature works without a field, make it optional (`Option<T>`, `T | undefined`, `Optional[T]`).

3. **Custom deserializers for known bad patterns.** If a field can arrive as a Python-style array (`"['a', 'b']"` instead of `["a", "b"]`), add a custom deserializer.

4. **Never unwrap LLM output directly.** Always handle parse failures with a user-friendly fallback.

5. **Truncated JSON recovery.** If the LLM output looks like valid JSON that was cut off (common with long responses), try to salvage what you can rather than failing entirely.

## The Antibody Rule

When you fix a bug caused by unexpected LLM output, add the bad output as a test fixture and a regression test. Every crash teaches the factory — the same class of failure never passes verify again.

## Common Bad Outputs

| Pattern | Example | Defense |
|---------|---------|---------|
| Empty response | `{}` | Default on all fields |
| Null fields | `{"answer": null}` | Optional type + default |
| Python arrays | `"['a', 'b']"` | Custom deserializer |
| Truncated JSON | `{"answer": "foo", "sources": ["` | Attempt parse, fallback gracefully |
| Extra fields | `{"answer": "foo", "reasoning": "..."}` | Ignore unknown fields (never deny) |
| Wrong types | `{"confidence": "high"}` instead of `0.9` | Custom deserializer or optional with default |

## Affected Code

Any struct/class that deserializes LLM responses:
- Backend LLM response types
- Command handlers that parse LLM output
- Anything that calls `JSON.parse` / `serde_json::from_str` on text from an LLM

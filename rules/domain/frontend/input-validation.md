# Input Validation

Users will enter wrong data. Not because they're careless — because the UI let them.

## The Principle

**Make invalid input impossible, not just detectable.**

A text field that accepts any string and validates on submit is a trap. A date picker that only offers valid dates is a guardrail. The guardrail is always better.

## Origin

A multi-page onboarding flow: a user filled out every step of a multi-page form, reached the end, and got "failed to save profile." The actual problem was a malformed date — entered on page 2 of 5. The user wasted minutes and had no idea what went wrong.

Three failures compounded:
1. A text field accepted free-form text for a date (should have been a date picker)
2. No per-field validation — the error only surfaced on final submit
3. The error message ("failed to save profile") described the symptom, not the cause

## Rules

### 1. Constrain the input, don't validate the output

Choose the input type that makes the wrong answer impossible:

| Data | Wrong | Right |
|---|---|---|
| Date | `<input type="text">` | `<input type="date">` or date picker component |
| Email | Free text validated by regex on submit | `<input type="email">` with inline validation |
| Phone | Free text | Masked input with country code selector |
| Selection from list | Free text that must match | `<select>`, radio group, or combobox |
| Number in range | Free text parsed to int | `<input type="number" min="0" max="100">` or slider |
| Yes/No | Text field | Checkbox or toggle |
| File type | Accept any, reject on upload | `accept=".pdf,.docx"` on the file input |

If the set of valid values is enumerable, use a picker. If it's bounded, use constraints. Free text is the last resort.

### 2. Validate at the boundary, not at the end

Every field validates itself the moment the user leaves it (onBlur) or as they type (onChange for format-constrained fields). Never wait for form submission to report errors.

```
WRONG:  Fill out 5 pages → Submit → "Invalid date on page 2"
RIGHT:  Page 2, date field → blur → "Date must be MM/DD/YYYY" → can't proceed to page 3
```

For multi-step forms: **each step must be independently valid before the user can advance.** The "Next" button is disabled or shows inline errors until the current step passes.

### 3. Errors must name the field and the fix

```
WRONG:  "Failed to save profile"
WRONG:  "Invalid input"
WRONG:  "Validation error"
RIGHT:  "Date of birth must be a valid date (e.g., 03/15/1990)"
RIGHT:  "Email address is missing the @ symbol"
RIGHT:  "Phone number must be 10 digits"
```

The error message must answer two questions:
- **What's wrong?** — which field, what's invalid about it
- **What do I do?** — the expected format or an example

### 4. Use schemas for both client and server

Define validation once (e.g., Zod schema) and derive both client-side validation and server-side validation from the same source. This prevents the case where the client allows data the server rejects.

```typescript
// Define once
const profileSchema = z.object({
  dateOfBirth: z.coerce.date(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

// Client uses it for inline validation
// Server uses it before database write
// Both reject the same inputs for the same reasons
```

### 5. Test with wrong data, not just right data

Every form field needs tests for:
- Empty/blank input
- Type mismatch (text where number expected)
- Boundary values (min, max, one-over-max)
- Malformed format (date as "yesterday", email as "bob")
- Injection attempts (script tags, SQL)

If the test suite only submits valid forms, it's testing nothing.

## Checklist for Code Review

When reviewing any form or user input:

- [ ] Can the user enter structurally invalid data? (date as free text, number as string)
- [ ] Does validation happen per-field on blur/change, or only on submit?
- [ ] Can the user advance past a step with invalid data?
- [ ] Do error messages name the specific field and expected format?
- [ ] Is the same schema used for client and server validation?
- [ ] Are there tests for invalid inputs, not just valid ones?

If any box is unchecked, the implementation is incomplete.

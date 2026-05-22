import { useMemo } from 'react';

// Returns `null` when `input` is empty (whitespace-only counts as empty),
// otherwise delegates to `validate` and returns its boolean verdict.
//
// Replaces the `useMemo<{ valid: boolean | null }>(() => !input.trim() ?
// { valid: null } : { valid: validateXxx(input).valid }, [input])` pattern
// that appeared at 6 formatter tab call sites (json / xml / yaml ×
// query / schema). The `validate` callback owns its own try / catch so
// the hook stays format-agnostic — `yaml.parse` throws, `validateJson`
// returns a result object, and `DOMParser` reports via `parsererror` —
// each caller wraps the appropriate semantics inside the callback.
export function useValidation(input: string, validate: (input: string) => boolean): boolean | null {
	return useMemo(() => {
		if (!input.trim()) return null;
		return validate(input);
	}, [input, validate]);
}

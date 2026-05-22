// Extract a string message from an unknown error value. Replaces the
// `e instanceof Error ? e.message : …` ternary that appeared inline at
// 30+ call sites across the formatter tabs, generator routes, and
// service-layer Result-pattern returns.
//
// When the caller knows the operation's name (e.g. `'Failed to generate
// code'`, `'Invalid YAML'`, `'Conversion failed'`), pass it as `fallback`
// — that string is used when the thrown value is not an Error instance.
// When the caller does not have a specific fallback, omit the argument
// and the function falls back to coercing the value via `String(e)`,
// matching the prior service-layer behavior.
export const getErrorMessage = (e: unknown, fallback?: string): string => {
	if (e instanceof Error) return e.message;
	if (fallback !== undefined) return fallback;
	if (typeof e === 'string') return e;
	return String(e);
};

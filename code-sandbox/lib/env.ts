/**
 * Returns the value of `process.env[name]` or a JSON 500 `Response` describing
 * the missing env var. Use it like:
 *
 *     const got = requireEnv("ANTHROPIC_API_KEY");
 *     if (got instanceof Response) return got;
 *     // got is now a string
 */
export function requireEnv(name: string): string | Response {
  const value = process.env[name];
  if (!value) {
    return new Response(JSON.stringify({ error: `${name} is not set` }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  return value;
}

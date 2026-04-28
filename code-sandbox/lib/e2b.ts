import { Sandbox } from "@e2b/code-interpreter";

/**
 * Create a new E2B sandbox with the given environment variables.
 * Throws if E2B_API_KEY is not set.
 */
export async function createSandbox(
  envs: Record<string, string> = {},
): Promise<Sandbox> {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    throw new Error("E2B_API_KEY is not set");
  }
  return Sandbox.create({
    apiKey,
    timeoutMs: 300_000,
    envs,
  });
}

/**
 * Get an existing sandbox by ID.
 */
export async function getSandbox(sandboxId: string): Promise<Sandbox> {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    throw new Error("E2B_API_KEY is not set");
  }
  return Sandbox.connect(sandboxId, { apiKey });
}

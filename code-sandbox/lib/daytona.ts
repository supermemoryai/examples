import { Daytona } from "@daytonaio/sdk";

/**
 * Single source of truth for constructing a Daytona client. Throws if
 * `DAYTONA_API_KEY` is not set so callers can convert it to a 500 response.
 */
export function getDaytona(): Daytona {
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error("DAYTONA_API_KEY is not set");
  }
  return new Daytona({ apiKey });
}

import serialize from "canonicalize";

/**
 * JSON Canonicalization Scheme (RFC 8785).
 * Produces a deterministic JSON string with sorted keys and no extra whitespace.
 */
export function canonicalizeJSON(data: string | object): string {
  const obj = typeof data === "string" ? JSON.parse(data) : data;
  // canonicalize exports a default function; handle both CJS and ESM interop
  const fn = typeof serialize === "function" ? serialize : (serialize as any).default;
  const result: string | undefined = fn(obj);
  if (result === undefined) {
    throw new Error("Failed to canonicalize JSON");
  }
  return result;
}

import canonicalize from "canonicalize";

// canonicalize ships CJS with `export default` types — under Node16 module
// resolution the default import resolves to the module namespace, so we
// need to handle both shapes.
const serialize = typeof canonicalize === "function"
  ? canonicalize
  : (canonicalize as unknown as { default: (input: unknown) => string | undefined }).default;

/**
 * JSON Canonicalization Scheme (RFC 8785).
 * Produces a deterministic JSON string with sorted keys and no extra whitespace.
 */
export function canonicalizeJSON(data: string | object): string {
  const obj = typeof data === "string" ? JSON.parse(data) : data;
  const result = serialize(obj);
  if (result === undefined) {
    throw new Error("Failed to canonicalize JSON");
  }
  return result;
}

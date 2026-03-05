import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalizeJSON } from "./jcs.js";

/**
 * Create an HMAC-SHA256 signature of the given data using JCS canonicalization.
 * Matches the Go `RequestSigner.Sign` implementation.
 *
 * @param data - JSON string or object to sign
 * @param apiKey - HMAC secret key
 * @returns hex-encoded HMAC-SHA256 signature
 */
export function createSignature(data: string | object, apiKey: string): string {
  const canonical = canonicalizeJSON(data);
  const hmac = createHmac("sha256", apiKey);
  hmac.update(canonical);
  return hmac.digest("hex");
}

/**
 * Create an HMAC-SHA256 signature from query parameters.
 * Flattens query params to a flat key→value object, then JCS-canonicalizes and signs.
 * Matches the Go `RequestSigner.SignQueryParams` implementation.
 *
 * @param queryParams - flat key-value map of query parameters
 * @param apiKey - HMAC secret key
 * @returns hex-encoded HMAC-SHA256 signature
 */
export function createQueryParamsSignature(
  queryParams: Record<string, string>,
  apiKey: string
): string {
  return createSignature(queryParams, apiKey);
}

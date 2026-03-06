import { timingSafeEqual } from "node:crypto";
import { createSignature, createQueryParamsSignature } from "./sign.js";

/**
 * Verify an HMAC-SHA256 signature against the given data using timing-safe comparison.
 *
 * @param data - JSON string or object that was signed
 * @param signature - hex-encoded signature to verify
 * @param apiKey - HMAC secret key
 * @returns true if signature is valid
 */
export function verifySignature(
  data: string | object,
  signature: string,
  apiKey: string
): boolean {
  const expected = createSignature(data, apiKey);
  return safeCompare(expected, signature);
}

/**
 * Verify a query params signature using timing-safe comparison.
 *
 * @param queryParams - flat key-value map of query parameters
 * @param signature - hex-encoded signature to verify
 * @param apiKey - HMAC secret key
 * @returns true if signature is valid
 */
export function verifyQueryParamsSignature(
  queryParams: Record<string, string>,
  signature: string,
  apiKey: string
): boolean {
  const expected = createQueryParamsSignature(queryParams, apiKey);
  return safeCompare(expected, signature);
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

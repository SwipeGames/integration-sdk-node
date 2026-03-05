import { verifySignature, verifyQueryParamsSignature } from "../crypto/verify.js";

/**
 * Verify the signature of an incoming reverse call request body.
 * Use this in your POST handler for /bet, /win, /refund endpoints.
 *
 * @param body - Raw request body string or parsed object
 * @param signatureHeader - Value of X-REQUEST-SIGN header
 * @param apiKey - Your integration API key (integrationApiKey)
 * @returns true if signature is valid
 */
export function verifyRequest(
  body: string | object,
  signatureHeader: string | undefined,
  apiKey: string
): boolean {
  if (!signatureHeader) return false;
  return verifySignature(body, signatureHeader, apiKey);
}

/**
 * Verify the signature of an incoming GET /balance request.
 * The signature is computed over the query parameters (flattened to a JSON object).
 *
 * @param queryParams - Flat key-value map of query parameters (e.g. { sessionID: "..." })
 * @param signatureHeader - Value of X-REQUEST-SIGN header
 * @param apiKey - Your integration API key (integrationApiKey)
 * @returns true if signature is valid
 */
export function verifyGetBalanceRequest(
  queryParams: Record<string, string>,
  signatureHeader: string | undefined,
  apiKey: string
): boolean {
  if (!signatureHeader) return false;
  return verifyQueryParamsSignature(queryParams, signatureHeader, apiKey);
}

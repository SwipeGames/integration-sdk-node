import type { ZodSchema } from "zod";
import { verifySignature, verifyQueryParamsSignature } from "../crypto/verify.js";
import { createErrorResponse } from "./responses.js";
import type {
  ParsedRequestResult,
  ParsedBalanceResult,
  GetBalanceQuery,
} from "./types.js";

/**
 * Verify the signature of an incoming reverse call request body.
 * Use this in your POST handler for /bet, /win, /refund endpoints.
 *
 * @param body - Raw request body string
 * @param signatureHeader - Value of X-REQUEST-SIGN header
 * @param apiKey - Your API key
 * @returns true if signature is valid
 */
export function verifyRequest(
  body: string,
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
 * @param apiKey - Your API key
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

/**
 * Parse and verify an incoming POST reverse call request (bet, win, refund).
 * Combines signature verification with typed body parsing.
 *
 * @param rawBody - Raw request body string
 * @param signatureHeader - Value of X-REQUEST-SIGN header
 * @param apiKey - Your API key
 * @param schema - Optional Zod schema for runtime validation of the parsed body
 * @returns `{ ok: true, body: T }` or `{ ok: false, error }` with a pre-built error response
 */
export function parseAndVerifyRequest<T>(
  rawBody: string,
  signatureHeader: string | undefined,
  apiKey: string,
  schema?: ZodSchema<T>
): ParsedRequestResult<T> {
  try {
    if (!verifyRequest(rawBody, signatureHeader, apiKey)) {
      return { ok: false, error: createErrorResponse({ message: "Invalid signature" }) };
    }
    const body = JSON.parse(rawBody) as T;

    if (schema) {
      const result = schema.safeParse(body);
      if (!result.success) {
        return { ok: false, error: createErrorResponse({ message: "Invalid request body" }) };
      }
      return { ok: true, body: result.data };
    }

    return { ok: true, body };
  } catch {
    return { ok: false, error: createErrorResponse({ message: "Invalid request body" }) };
  }
}

/**
 * Parse and verify an incoming GET /balance request.
 * Combines signature verification with typed query parsing.
 *
 * @param queryParams - Flat key-value map of query parameters
 * @param signatureHeader - Value of X-REQUEST-SIGN header
 * @param apiKey - Your API key
 * @returns `{ ok: true, query: GetBalanceQuery }` or `{ ok: false, error }` with a pre-built error response
 */
export function parseAndVerifyBalanceRequest(
  queryParams: Record<string, string>,
  signatureHeader: string | undefined,
  apiKey: string
): ParsedBalanceResult {
  if (!verifyGetBalanceRequest(queryParams, signatureHeader, apiKey)) {
    return { ok: false, error: createErrorResponse({ message: "Invalid signature" }) };
  }

  if (!queryParams.sessionID) {
    return { ok: false, error: createErrorResponse({ message: "Missing sessionID" }) };
  }
  const query: GetBalanceQuery = { sessionID: queryParams.sessionID };
  return { ok: true, query };
}

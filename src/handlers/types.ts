import type { IntegrationTypes } from "@swipegames/public-api";

// ── Derived from generated TypeScript types ──

export type TransactionType = IntegrationTypes.BetRequestType;

export type BetRequest = IntegrationTypes.BetRequest;
export type WinRequest = IntegrationTypes.WinRequest;
export type RefundRequest = IntegrationTypes.RefundRequest;

export type BalanceResponse = IntegrationTypes.BalanceResponse;
export type BetResponse = IntegrationTypes.BetResponse;
export type WinResponse = IntegrationTypes.WinResponse;
export type RefundResponse = IntegrationTypes.RefundResponse;

export type ErrorResponseWithCodeAndAction = IntegrationTypes.ErrorResponseWithCodeAndAction;

// ── Hand-written (not in any OpenAPI spec) ──

export interface GetBalanceQuery {
  sessionID: string;
}

export interface ParsedRequestOk<T> {
  ok: true;
  body: T;
}

export interface ParsedRequestError {
  ok: false;
  error: ErrorResponseWithCodeAndAction;
}

export type ParsedRequestResult<T> = ParsedRequestOk<T> | ParsedRequestError;

export interface ParsedBalanceOk {
  ok: true;
  query: GetBalanceQuery;
}

export type ParsedBalanceError = ParsedRequestError;

export type ParsedBalanceResult = ParsedBalanceOk | ParsedBalanceError;

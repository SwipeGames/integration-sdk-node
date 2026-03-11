import type { ErrorCode, ErrorAction } from "../types/common.js";
import type {
  BalanceResponse,
  BetResponse,
  WinResponse,
  RefundResponse,
  ErrorResponseWithCodeAndAction,
} from "./types.js";

export function createBalanceResponse(balance: string): BalanceResponse {
  return { balance };
}

export function createBetResponse(
  balance: string,
  txID: string
): BetResponse {
  return { balance, txID };
}

export function createWinResponse(
  balance: string,
  txID: string
): WinResponse {
  return { balance, txID };
}

export function createRefundResponse(
  balance: string,
  txID: string
): RefundResponse {
  return { balance, txID };
}

export function createErrorResponse(opts: {
  message: string;
  code?: ErrorCode;
  action?: ErrorAction;
  actionData?: string;
  details?: string;
}): ErrorResponseWithCodeAndAction {
  const res: ErrorResponseWithCodeAndAction = { message: opts.message };
  if (opts.code !== undefined) res.code = opts.code;
  if (opts.action !== undefined) res.action = opts.action;
  if (opts.actionData !== undefined) res.actionData = opts.actionData;
  if (opts.details !== undefined) res.details = opts.details;
  return res;
}

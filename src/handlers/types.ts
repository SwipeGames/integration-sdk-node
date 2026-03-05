/** Transaction type for bet/win operations. */
export type TransactionType = "regular" | "free";

// ── Requests (SwipeGames → Partner) ──

export interface GetBalanceQuery {
  sessionID: string;
}

export interface BetRequest {
  type: TransactionType;
  sessionID: string;
  amount: string;
  txID: string;
  roundID: string;
  frID?: string;
}

export interface WinRequest {
  type: TransactionType;
  sessionID: string;
  amount: string;
  txID: string;
  roundID: string;
  frID?: string;
}

export interface RefundRequest {
  sessionID: string;
  txID: string;
  origTxID: string;
  amount: string;
}

// ── Responses (Partner → SwipeGames) ──

export interface BalanceResponse {
  balance: string;
}

export interface BetResponse {
  balance: string;
  txID: string;
}

export interface WinResponse {
  balance: string;
  txID: string;
}

export interface RefundResponse {
  balance: string;
  txID: string;
}

export interface ErrorResponseWithCodeAndAction {
  message: string;
  details?: string;
  code?: string;
  action?: "refresh";
  actionData?: string;
}

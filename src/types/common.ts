/** Error codes the partner can return in reverse call responses. */
export type ErrorCode =
  | "game_not_found"
  | "currency_not_supported"
  | "locale_not_supported"
  | "account_blocked"
  | "bet_limit"
  | "loss_limit"
  | "time_limit"
  | "insufficient_funds"
  | "session_expired"
  | "session_not_found"
  | "client_connection_error";

/** Client action that can be returned in error responses. */
export type ErrorAction = "refresh";

/** Platform type. */
export type PlatformType = "desktop" | "mobile";

/** User information sent during game creation. */
export interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  nickName?: string;
  country?: string;
}

/** Error response from SwipeGames public API. */
export interface ErrorResponse {
  message: string;
  details?: string;
  code?: ErrorCode;
}

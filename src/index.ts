// Client
export { SwipeGamesClient } from "./client/client.js";
export { SwipeGamesApiError, SwipeGamesValidationError } from "./client/errors.js";
export type {
  SwipeGamesClientConfig,
  CreateNewGameParams,
  CreateNewGameResponse,
  CreateFreeRoundsParams,
  CreateFreeRoundsResponse,
  CancelFreeRoundsParams,
} from "./client/types.js";

// Crypto
export { createSignature, createQueryParamsSignature } from "./crypto/sign.js";
export { verifySignature, verifyQueryParamsSignature } from "./crypto/verify.js";

// Handler types
export type {
  TransactionType,
  GetBalanceQuery,
  BetRequest,
  WinRequest,
  RefundRequest,
  BalanceResponse,
  BetResponse,
  WinResponse,
  RefundResponse,
  ErrorResponseWithCodeAndAction,
  ParsedRequestResult,
  ParsedRequestOk,
  ParsedRequestError,
  ParsedBalanceResult,
  ParsedBalanceOk,
  ParsedBalanceError,
} from "./handlers/types.js";

// Handler helpers
export {
  createBalanceResponse,
  createBetResponse,
  createWinResponse,
  createRefundResponse,
  createErrorResponse,
} from "./handlers/responses.js";

export {
  verifyRequest,
  verifyGetBalanceRequest,
  parseAndVerifyRequest,
  parseAndVerifyBalanceRequest,
} from "./handlers/middleware.js";

// Shared types
export type { ErrorCode, ErrorAction, PlatformType, User, ErrorResponse } from "./types/common.js";
export type {
  GameInfo,
  GameInfoImages,
  BetLineInfo,
  BetLineValue,
} from "./types/games.js";

// Generated Zod schemas and TypeScript types for consumer-side validation
export { CoreSchemas, IntegrationSchemas, CoreTypes, IntegrationTypes } from "@swipegames/public-api";

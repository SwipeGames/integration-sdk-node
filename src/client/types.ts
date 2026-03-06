import type { CoreTypes } from "@swipegames/public-api";

// ── SDK-only config (not in any spec) ──

export interface SwipeGamesClientConfig {
  /** SwipeGames-assigned client ID */
  cid: string;
  /** Your external client ID */
  extCid: string;
  /** Shared API key for signing outbound requests and verifying inbound reverse calls */
  apiKey: string;
  /** Environment */
  env?: "staging" | "production";
  /** Custom base URL (overrides env) */
  baseUrl?: string;
  /** Enable debug logging of requests and responses */
  debug?: boolean;
}

// ── Derived from generated TypeScript types ──

export type CreateNewGameParams = Omit<
  CoreTypes.CreateNewGameRequest,
  "cID" | "extCID"
>;

export type CreateNewGameResponse = CoreTypes.CreateNewGameResponse;

export type CreateFreeRoundsParams = Omit<
  CoreTypes.CreateFreeRoundsRequest,
  "cID" | "extCID"
>;

export type CreateFreeRoundsResponse = CoreTypes.CreateFreeRoundsResponse;

export type CancelFreeRoundsParams =
  | { id: string; extID?: string }
  | { id?: string; extID: string };

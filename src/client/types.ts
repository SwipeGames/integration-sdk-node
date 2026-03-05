import type { PlatformType, User } from "../types/common.js";

export interface SwipeGamesClientConfig {
  /** SwipeGames-assigned client ID */
  cid: string;
  /** Your external client ID */
  extCid: string;
  /** API key for signing requests TO SwipeGames */
  apiKey: string;
  /** API key for verifying signatures FROM SwipeGames (reverse calls) */
  integrationApiKey: string;
  /** Environment */
  env?: "staging" | "production";
  /** Custom base URL (overrides env) */
  baseUrl?: string;
}

// ── CreateNewGame ──

export interface CreateNewGameParams {
  gameID: string;
  demo: boolean;
  platform: PlatformType;
  currency: string;
  locale: string;
  sessionID?: string;
  returnURL?: string;
  depositURL?: string;
  initDemoBalance?: string;
  user?: User;
}

export interface CreateNewGameResponse {
  gameURL: string;
  gsID: string;
}

// ── FreeRounds ──

export interface CreateFreeRoundsParams {
  extID: string;
  currency: string;
  quantity: number;
  betLine: number;
  validFrom: string;
  validUntil?: string;
  gameIDs?: string[];
  userIDs?: string[];
}

export interface CreateFreeRoundsResponse {
  id: string;
  extID: string;
}

export interface CancelFreeRoundsParams {
  id?: string;
  extID?: string;
}

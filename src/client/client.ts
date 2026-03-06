import { CoreSchemas } from "@swipegames/public-api";
import { createSignature, createQueryParamsSignature } from "../crypto/sign.js";
import { verifySignature, verifyQueryParamsSignature } from "../crypto/verify.js";
import { SwipeGamesApiError, SwipeGamesValidationError } from "./errors.js";
import type { ErrorResponse } from "../types/common.js";
import type {
  SwipeGamesClientConfig,
  CreateNewGameParams,
  CreateNewGameResponse,
  CreateFreeRoundsParams,
  CreateFreeRoundsResponse,
  CancelFreeRoundsParams,
} from "./types.js";
import type { GameInfo } from "../types/games.js";

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

const ENV_URLS: Record<string, string> = {
  staging: "https://staging.platform.0.swipegames.io/api/v1",
  production: "https://prod.platform.1.swipegames.io/api/v1",
};

export class SwipeGamesClient {
  private readonly cid: string;
  private readonly extCid: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly debug: boolean;

  constructor(config: SwipeGamesClientConfig) {
    this.cid = config.cid;
    this.extCid = config.extCid;
    this.apiKey = config.apiKey;
    this.debug = config.debug ?? false;

    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    } else {
      const env = config.env ?? "staging";
      const url = ENV_URLS[env];
      if (!url) throw new Error(`Unknown env: ${env}`);
      this.baseUrl = url;
    }
  }

  private log(...args: unknown[]): void {
    if (this.debug) console.log("[SwipeGamesSDK]", ...args);
  }

  private logError(...args: unknown[]): void {
    if (this.debug) console.error("[SwipeGamesSDK]", ...args);
  }

  /** Create a new game session and get the launcher URL. */
  async createNewGame(
    params: CreateNewGameParams
  ): Promise<CreateNewGameResponse> {
    const body = stripUndefined({
      cID: this.cid,
      extCID: this.extCid,
      ...params,
    });

    const parsed = CoreSchemas.PostCreateNewGameBody.safeParse(body);
    if (!parsed.success) {
      throw new SwipeGamesValidationError(parsed.error);
    }

    return this.post<CreateNewGameResponse>("/create-new-game", body);
  }

  /** Get information about all supported games. */
  async getGames(): Promise<GameInfo[]> {
    const queryParams: Record<string, string> = {
      cID: this.cid,
      extCID: this.extCid,
    };
    return this.get<GameInfo[]>("/games", queryParams);
  }

  /** Create a new free rounds campaign. */
  async createFreeRounds(
    params: CreateFreeRoundsParams
  ): Promise<CreateFreeRoundsResponse> {
    const body = stripUndefined({
      cID: this.cid,
      extCID: this.extCid,
      ...params,
    });

    const parsed = CoreSchemas.PostFreeRoundsBody.safeParse(body);
    if (!parsed.success) {
      throw new SwipeGamesValidationError(parsed.error);
    }

    return this.post<CreateFreeRoundsResponse>("/free-rounds", body);
  }

  /** Cancel/delete an existing free rounds campaign. */
  async cancelFreeRounds(params: CancelFreeRoundsParams): Promise<void> {
    const body = stripUndefined({
      cID: this.cid,
      extCID: this.extCid,
      ...params,
    });

    const parsed = CoreSchemas.DeleteFreeRoundsBody
      .refine((b) => b.id || b.extID, { message: "One of id or extID must be provided" })
      .safeParse(body);
    if (!parsed.success) {
      throw new SwipeGamesValidationError(parsed.error);
    }

    await this.request("DELETE", "/free-rounds", body);
  }

  /**
   * Verify a reverse call signature on a POST request body.
   */
  verifyReverseCallSignature(
    body: string,
    signature: string
  ): boolean {
    return verifySignature(body, signature, this.apiKey);
  }

  /**
   * Verify a reverse call signature on a GET /balance request.
   */
  verifyGetBalanceSignature(
    queryParams: Record<string, string>,
    signature: string
  ): boolean {
    return verifyQueryParamsSignature(
      queryParams,
      signature,
      this.apiKey
    );
  }

  // ── Internal helpers ──

  private async post<T>(path: string, body: object): Promise<T> {
    const res = await this.request("POST", path, body);
    return res.json() as Promise<T>;
  }

  private async get<T>(
    path: string,
    queryParams: Record<string, string>
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }

    const signature = createQueryParamsSignature(queryParams, this.apiKey);
    const fullUrl = url.toString();

    this.log(`GET ${fullUrl}`);

    const res = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "X-REQUEST-SIGN": signature,
      },
    });

    this.log(`GET ${fullUrl} -> ${res.status}`);

    if (!res.ok) {
      await this.throwApiError(res, `GET ${fullUrl}`);
    }

    return res.json() as Promise<T>;
  }

  private async request(
    method: string,
    path: string,
    body: object
  ): Promise<Response> {
    const url = this.baseUrl + path;
    const signature = createSignature(body, this.apiKey);

    this.log(`${method} ${url}`);
    this.log("Body:", JSON.stringify(body));

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-REQUEST-SIGN": signature,
      },
      body: JSON.stringify(body),
    });

    this.log(`${method} ${url} -> ${res.status}`);

    if (!res.ok) {
      await this.throwApiError(res, `${method} ${url}`);
    }

    return res;
  }

  private async throwApiError(res: Response, label: string): Promise<never> {
    let errBody: ErrorResponse;
    try {
      errBody = await res.json() as ErrorResponse;
    } catch {
      errBody = { message: res.statusText };
    }
    this.logError(`${label} error:`, errBody);
    throw new SwipeGamesApiError(res.status, errBody);
  }
}

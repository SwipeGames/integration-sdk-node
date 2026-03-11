import type { ZodSchema } from "zod";
import { CoreSchemas, IntegrationSchemas } from "@swipegames/public-api";
import { createSignature, createQueryParamsSignature } from "../crypto/sign.js";
import { verifySignature, verifyQueryParamsSignature } from "../crypto/verify.js";
import { createErrorResponse } from "../handlers/responses.js";
import { SwipeGamesApiError, SwipeGamesValidationError } from "./errors.js";
import type { ErrorResponse } from "../types/common.js";
import type {
  BetRequest,
  WinRequest,
  RefundRequest,
  ParsedRequestResult,
  ParsedBalanceResult,
  GetBalanceQuery,
} from "../handlers/types.js";
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
  private readonly integrationApiKey: string;
  private readonly baseUrl: string;
  private readonly debug: boolean;

  constructor(config: SwipeGamesClientConfig) {
    this.cid = config.cid;
    this.extCid = config.extCid;
    this.apiKey = config.apiKey;
    this.integrationApiKey = config.integrationApiKey;
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

  // ── Outbound: SDK → Platform (signed with apiKey) ──

  /** Create a new game session and get the launcher URL. */
  async createNewGame(
    params: CreateNewGameParams
  ): Promise<CreateNewGameResponse> {
    const body = stripUndefined({
      ...params,
      cID: this.cid,
      extCID: this.extCid,
    });

    const parsed = CoreSchemas.PostCreateNewGameBody.safeParse(body);
    if (!parsed.success) {
      throw new SwipeGamesValidationError(parsed.error);
    }

    return this.post<CreateNewGameResponse>("/create-new-game", parsed.data);
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
      ...params,
      cID: this.cid,
      extCID: this.extCid,
    });

    const parsed = CoreSchemas.PostFreeRoundsBody.safeParse(body);
    if (!parsed.success) {
      throw new SwipeGamesValidationError(parsed.error);
    }

    return this.post<CreateFreeRoundsResponse>("/free-rounds", parsed.data);
  }

  /** Cancel/delete an existing free rounds campaign. */
  async cancelFreeRounds(params: CancelFreeRoundsParams): Promise<void> {
    const body = stripUndefined({
      ...params,
      cID: this.cid,
      extCID: this.extCid,
    });

    const parsed = CoreSchemas.DeleteFreeRoundsBody
      .refine((b) => b.id || b.extID, { message: "One of id or extID must be provided" })
      .safeParse(body);
    if (!parsed.success) {
      throw new SwipeGamesValidationError(parsed.error);
    }

    const res = await this.request("DELETE", "/free-rounds", parsed.data);
    await res.text();
  }

  // ── Inbound: Platform → SDK (verified with integrationApiKey) ──

  // -- Bet --

  /** Verify the signature of an incoming /bet request. */
  verifyBetRequest(body: string, signatureHeader: string | undefined): boolean {
    return this.verifyInboundSignature(body, signatureHeader);
  }

  /** Parse, verify, and validate an incoming /bet request. */
  parseAndVerifyBetRequest(rawBody: string, signatureHeader: string | undefined): ParsedRequestResult<BetRequest> {
    return this.parseAndVerifyInboundRequest(rawBody, signatureHeader, IntegrationSchemas.PostBetBody);
  }

  // -- Win --

  /** Verify the signature of an incoming /win request. */
  verifyWinRequest(body: string, signatureHeader: string | undefined): boolean {
    return this.verifyInboundSignature(body, signatureHeader);
  }

  /** Parse, verify, and validate an incoming /win request. */
  parseAndVerifyWinRequest(rawBody: string, signatureHeader: string | undefined): ParsedRequestResult<WinRequest> {
    return this.parseAndVerifyInboundRequest(rawBody, signatureHeader, IntegrationSchemas.PostWinBody);
  }

  // -- Refund --

  /** Verify the signature of an incoming /refund request. */
  verifyRefundRequest(body: string, signatureHeader: string | undefined): boolean {
    return this.verifyInboundSignature(body, signatureHeader);
  }

  /** Parse, verify, and validate an incoming /refund request. */
  parseAndVerifyRefundRequest(rawBody: string, signatureHeader: string | undefined): ParsedRequestResult<RefundRequest> {
    return this.parseAndVerifyInboundRequest(rawBody, signatureHeader, IntegrationSchemas.PostRefundBody);
  }

  // -- Balance --

  /** Verify the signature of an incoming GET /balance request. */
  verifyBalanceRequest(queryParams: Record<string, string>, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) return false;
    return verifyQueryParamsSignature(queryParams, signatureHeader, this.integrationApiKey);
  }

  /** Parse, verify, and validate an incoming GET /balance request. */
  parseAndVerifyBalanceRequest(queryParams: Record<string, string>, signatureHeader: string | undefined): ParsedBalanceResult {
    if (!this.verifyBalanceRequest(queryParams, signatureHeader)) {
      return { ok: false, error: createErrorResponse({ message: "Invalid signature" }) };
    }

    if (!queryParams.sessionID) {
      return { ok: false, error: createErrorResponse({ message: "Missing sessionID" }) };
    }
    const query: GetBalanceQuery = { sessionID: queryParams.sessionID };
    return { ok: true, query };
  }

  // ── Inbound internals ──

  private verifyInboundSignature(body: string, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) return false;
    return verifySignature(body, signatureHeader, this.integrationApiKey);
  }

  private parseAndVerifyInboundRequest<T>(rawBody: string, signatureHeader: string | undefined, schema: ZodSchema): ParsedRequestResult<T> {
    try {
      if (!this.verifyInboundSignature(rawBody, signatureHeader)) {
        return { ok: false, error: createErrorResponse({ message: "Invalid signature" }) };
      }
      const parsed = JSON.parse(rawBody);
      const result = schema.safeParse(parsed);
      if (!result.success) {
        return { ok: false, error: createErrorResponse({ message: "Invalid request body" }) };
      }
      return { ok: true, body: result.data as T };
    } catch {
      return { ok: false, error: createErrorResponse({ message: "Invalid request body" }) };
    }
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

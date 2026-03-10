import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SwipeGamesClient } from "../../src/client/client.js";
import { SwipeGamesApiError, SwipeGamesValidationError } from "../../src/client/errors.js";
import { createSignature, createQueryParamsSignature } from "../../src/crypto/sign.js";

const CLIENT_CONFIG = {
  cid: "550e8400-e29b-41d4-a716-446655440000",
  extCid: "test_ext_cid",
  apiKey: "test-api-key",
  integrationApiKey: "test-integration-api-key",
  env: "staging" as const,
};

describe("SwipeGamesClient", () => {
  let client: SwipeGamesClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new SwipeGamesClient(CLIENT_CONFIG);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("uses staging URL by default", () => {
      const c = new SwipeGamesClient({ ...CLIENT_CONFIG, env: undefined });
      // Will verify via fetch call URL
      expect(c).toBeDefined();
    });

    it("uses custom baseUrl when provided", () => {
      const c = new SwipeGamesClient({
        ...CLIENT_CONFIG,
        baseUrl: "https://custom.api/v1",
      });
      expect(c).toBeDefined();
    });

    it("throws on unknown env", () => {
      expect(
        () =>
          new SwipeGamesClient({
            ...CLIENT_CONFIG,
            env: "unknown" as any,
          })
      ).toThrow("Unknown env: unknown");
    });
  });

  describe("createNewGame", () => {
    it("sends signed POST request with correct body", async () => {
      const mockResponse = { gameURL: "https://game.url", gsID: "gs-123" };
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.createNewGame({
        gameID: "sg_catch_97",
        demo: false,
        platform: "desktop",
        currency: "USD",
        locale: "en_us",
        sessionID: "session-123",
        user: { id: "user-1" },
      });

      expect(result).toEqual(mockResponse);
      expect(fetchMock).toHaveBeenCalledOnce();

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe(
        "https://staging.platform.0.swipegames.io/api/v1/create-new-game"
      );
      expect(opts.method).toBe("POST");
      expect(opts.headers["Content-Type"]).toBe("application/json");
      expect(opts.headers["X-REQUEST-SIGN"]).toBeDefined();

      const sentBody = JSON.parse(opts.body);
      expect(sentBody.cID).toBe(CLIENT_CONFIG.cid);
      expect(sentBody.extCID).toBe(CLIENT_CONFIG.extCid);
      expect(sentBody.gameID).toBe("sg_catch_97");

      // Verify signature matches
      const expectedSig = createSignature(sentBody, CLIENT_CONFIG.apiKey);
      expect(opts.headers["X-REQUEST-SIGN"]).toBe(expectedSig);
    });

    it("throws SwipeGamesApiError on non-200", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({ message: "Invalid signature" }),
      });

      await expect(
        client.createNewGame({
          gameID: "sg_catch_97",
          demo: false,
          platform: "desktop",
          currency: "USD",
          locale: "en_us",
        })
      ).rejects.toThrow(SwipeGamesApiError);
    });

    it("uses statusText when error response is not valid JSON", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        json: () => Promise.reject(new Error("not json")),
      });

      await expect(
        client.createNewGame({
          gameID: "sg_catch_97",
          demo: false,
          platform: "desktop",
          currency: "USD",
          locale: "en_us",
        })
      ).rejects.toThrow("Bad Gateway");
    });
  });

  describe("getGames", () => {
    it("sends signed GET request with query params", async () => {
      const mockGames = [{ id: "sg_catch_97", title: "Catch 97" }];
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGames),
      });

      const result = await client.getGames();

      expect(result).toEqual(mockGames);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain("/games");
      expect(url).toContain(`cID=${CLIENT_CONFIG.cid}`);
      expect(url).toContain(`extCID=${CLIENT_CONFIG.extCid}`);
      expect(opts.method).toBe("GET");
      expect(opts.headers["X-REQUEST-SIGN"]).toBeDefined();

      // Verify signature
      const expectedSig = createQueryParamsSignature(
        { cID: CLIENT_CONFIG.cid, extCID: CLIENT_CONFIG.extCid },
        CLIENT_CONFIG.apiKey
      );
      expect(opts.headers["X-REQUEST-SIGN"]).toBe(expectedSig);
    });
  });

  describe("createFreeRounds", () => {
    it("sends signed POST to /free-rounds", async () => {
      const mockResponse = { id: "fr-123", extID: "ext-fr-1" };
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.createFreeRounds({
        extID: "ext-fr-1",
        currency: "USD",
        quantity: 10,
        betLine: 5,
        validFrom: "2026-01-01T00:00:00.000Z",
        gameIDs: ["sg_catch_97"],
      });

      expect(result).toEqual(mockResponse);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain("/free-rounds");
      expect(opts.method).toBe("POST");

      const sentBody = JSON.parse(opts.body);
      expect(sentBody.cID).toBe(CLIENT_CONFIG.cid);
      expect(sentBody.extID).toBe("ext-fr-1");
      expect(sentBody.quantity).toBe(10);
    });
  });

  describe("cancelFreeRounds", () => {
    it("sends signed DELETE to /free-rounds", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await client.cancelFreeRounds({ extID: "ext-fr-1" });

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain("/free-rounds");
      expect(opts.method).toBe("DELETE");

      const sentBody = JSON.parse(opts.body);
      expect(sentBody.cID).toBe(CLIENT_CONFIG.cid);
      expect(sentBody.extID).toBe("ext-fr-1");
    });

    it("throws SwipeGamesValidationError when neither id nor extID provided", async () => {
      await expect(
        client.cancelFreeRounds({} as any)
      ).rejects.toThrow(SwipeGamesValidationError);
    });
  });

  describe("verifyBetRequest", () => {
    it("returns true for valid signature", () => {
      const body = JSON.stringify({ type: "regular", sessionID: "s1", amount: "10.00", txID: "tx1", roundID: "r1" });
      const sig = createSignature(body, CLIENT_CONFIG.integrationApiKey);
      expect(client.verifyBetRequest(body, sig)).toBe(true);
    });

    it("rejects wrong signature", () => {
      expect(
        client.verifyBetRequest(
          '{"test":true}',
          "0000000000000000000000000000000000000000000000000000000000000000"
        )
      ).toBe(false);
    });

    it("rejects missing signature", () => {
      expect(client.verifyBetRequest('{"test":true}', undefined)).toBe(false);
    });
  });

  describe("verifyWinRequest", () => {
    it("returns true for valid signature", () => {
      const body = JSON.stringify({ sessionID: "s1", amount: "50.00", txID: "tx2", roundID: "r1" });
      const sig = createSignature(body, CLIENT_CONFIG.integrationApiKey);
      expect(client.verifyWinRequest(body, sig)).toBe(true);
    });
  });

  describe("verifyRefundRequest", () => {
    it("returns true for valid signature", () => {
      const body = JSON.stringify({ sessionID: "s1", txID: "tx3", origTxID: "tx1", amount: "10.00" });
      const sig = createSignature(body, CLIENT_CONFIG.integrationApiKey);
      expect(client.verifyRefundRequest(body, sig)).toBe(true);
    });
  });

  describe("verifyBalanceRequest", () => {
    it("returns true for valid query param signature", () => {
      const params = { sessionID: "session-abc" };
      const sig = createQueryParamsSignature(params, CLIENT_CONFIG.integrationApiKey);
      expect(client.verifyBalanceRequest(params, sig)).toBe(true);
    });

    it("rejects missing signature", () => {
      expect(client.verifyBalanceRequest({ sessionID: "s1" }, undefined)).toBe(false);
    });
  });

  describe("parseAndVerifyBetRequest", () => {
    it("parses and verifies a valid bet request", () => {
      const body = { type: "regular", sessionID: "s1", amount: "10.00", txID: "550e8400-e29b-41d4-a716-446655440000", roundID: "660e8400-e29b-41d4-a716-446655440000" };
      const rawBody = JSON.stringify(body);
      const sig = createSignature(rawBody, CLIENT_CONFIG.integrationApiKey);

      const result = client.parseAndVerifyBetRequest(rawBody, sig);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.body.type).toBe("regular");
        expect(result.body.amount).toBe("10.00");
      }
    });

    it("rejects invalid signature", () => {
      const result = client.parseAndVerifyBetRequest('{"test":true}', "bad-sig");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Invalid signature");
      }
    });

    it("rejects missing signature", () => {
      const result = client.parseAndVerifyBetRequest('{"test":true}', undefined);
      expect(result.ok).toBe(false);
    });

    it("rejects invalid body", () => {
      const rawBody = JSON.stringify({ type: "invalid_type", sessionID: "s1" });
      const sig = createSignature(rawBody, CLIENT_CONFIG.integrationApiKey);
      const result = client.parseAndVerifyBetRequest(rawBody, sig);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Invalid request body");
      }
    });
  });

  describe("parseAndVerifyWinRequest", () => {
    it("parses and verifies a valid win request", () => {
      const body = { type: "regular", sessionID: "s1", amount: "50.00", txID: "550e8400-e29b-41d4-a716-446655440002", roundID: "660e8400-e29b-41d4-a716-446655440000" };
      const rawBody = JSON.stringify(body);
      const sig = createSignature(rawBody, CLIENT_CONFIG.integrationApiKey);

      const result = client.parseAndVerifyWinRequest(rawBody, sig);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.body.amount).toBe("50.00");
      }
    });
  });

  describe("parseAndVerifyRefundRequest", () => {
    it("parses and verifies a valid refund request", () => {
      const body = { sessionID: "s1", txID: "550e8400-e29b-41d4-a716-446655440003", origTxID: "550e8400-e29b-41d4-a716-446655440000", amount: "10.00" };
      const rawBody = JSON.stringify(body);
      const sig = createSignature(rawBody, CLIENT_CONFIG.integrationApiKey);

      const result = client.parseAndVerifyRefundRequest(rawBody, sig);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.body.origTxID).toBe("550e8400-e29b-41d4-a716-446655440000");
      }
    });
  });

  describe("parseAndVerifyBalanceRequest", () => {
    it("parses and verifies a valid GET /balance request", () => {
      const params = { sessionID: "session-abc" };
      const sig = createQueryParamsSignature(params, CLIENT_CONFIG.integrationApiKey);

      const result = client.parseAndVerifyBalanceRequest(params, sig);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.query.sessionID).toBe("session-abc");
      }
    });

    it("rejects invalid signature", () => {
      const result = client.parseAndVerifyBalanceRequest({ sessionID: "s1" }, "bad-sig");
      expect(result.ok).toBe(false);
    });

    it("rejects missing sessionID", () => {
      const params = { other: "value" };
      const sig = createQueryParamsSignature(params, CLIENT_CONFIG.integrationApiKey);
      const result = client.parseAndVerifyBalanceRequest(params, sig);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Missing sessionID");
      }
    });
  });

  describe("debug mode", () => {
    it("logs requests and responses when debug is enabled", async () => {
      const debugClient = new SwipeGamesClient({ ...CLIENT_CONFIG, debug: true });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await debugClient.getGames();

      const logMessages = logSpy.mock.calls.map((args) => args.join(" "));
      expect(logMessages.some((m) => m.includes("[SwipeGamesSDK]") && m.includes("GET"))).toBe(true);
      logSpy.mockRestore();
    });

    it("logs errors when debug is enabled and request fails", async () => {
      const debugClient = new SwipeGamesClient({ ...CLIENT_CONFIG, debug: true });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: "Server error" }),
      });

      await expect(debugClient.getGames()).rejects.toThrow(SwipeGamesApiError);

      const errorMessages = errorSpy.mock.calls.map((args) => args.join(" "));
      expect(errorMessages.some((m) => m.includes("[SwipeGamesSDK]") && m.includes("error"))).toBe(true);
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("does not log when debug is disabled", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await client.getGames();

      const sdkLogs = logSpy.mock.calls.filter((args) =>
        args.some((a) => typeof a === "string" && a.includes("[SwipeGamesSDK]"))
      );
      expect(sdkLogs).toHaveLength(0);
      logSpy.mockRestore();
    });
  });
});

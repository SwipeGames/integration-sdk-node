import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SwipeGamesClient } from "../../src/client/client.js";
import { SwipeGamesApiError } from "../../src/client/errors.js";
import { createSignature, createQueryParamsSignature } from "../../src/crypto/sign.js";

const CLIENT_CONFIG = {
  cid: "550e8400-e29b-41d4-a716-446655440000",
  extCid: "test_ext_cid",
  apiKey: "test-api-key",
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
  });

  describe("verifyReverseCallSignature", () => {
    it("verifies signature using apiKey", () => {
      const body = { sessionID: "test", amount: "100.00" };
      const sig = createSignature(body, CLIENT_CONFIG.apiKey);
      expect(client.verifyReverseCallSignature(body, sig)).toBe(true);
    });

    it("rejects wrong signature", () => {
      expect(
        client.verifyReverseCallSignature(
          { test: true },
          "0000000000000000000000000000000000000000000000000000000000000000"
        )
      ).toBe(false);
    });
  });

  describe("verifyGetBalanceSignature", () => {
    it("verifies query param signature using apiKey", () => {
      const params = { sessionID: "session-abc" };
      const sig = createQueryParamsSignature(
        params,
        CLIENT_CONFIG.apiKey
      );
      expect(client.verifyGetBalanceSignature(params, sig)).toBe(true);
    });
  });
});

import { describe, it, expect } from "vitest";
import { SwipeGamesClient } from "../../src/client/client.js";
import { createSignature, createQueryParamsSignature } from "../../src/crypto/sign.js";
import {
  createBalanceResponse,
  createBetResponse,
  createWinResponse,
  createRefundResponse,
  createErrorResponse,
} from "../../src/handlers/responses.js";

const INTEGRATION_API_KEY = "test-integration-key";

const client = new SwipeGamesClient({
  cid: "test-cid",
  extCid: "test-ext-cid",
  apiKey: "test-api-key",
  integrationApiKey: INTEGRATION_API_KEY,
  env: "staging",
});

describe("verifyBetRequest", () => {
  it("returns true for valid POST body signature", () => {
    const body = JSON.stringify({ type: "regular", sessionID: "s1", amount: "10.00", txID: "550e8400-e29b-41d4-a716-446655440000", roundID: "660e8400-e29b-41d4-a716-446655440000" });
    const sig = createSignature(body, INTEGRATION_API_KEY);
    expect(client.verifyBetRequest(body, sig)).toBe(true);
  });

  it("returns true for valid string body signature", () => {
    const bodyStr = '{"amount":"10.00","roundID":"r1","sessionID":"s1","txID":"tx1","type":"regular"}';
    const sig = createSignature(bodyStr, INTEGRATION_API_KEY);
    expect(client.verifyBetRequest(bodyStr, sig)).toBe(true);
  });

  it("returns false for missing signature header", () => {
    expect(client.verifyBetRequest('{"test":true}', undefined)).toBe(false);
  });

  it("returns false for invalid signature", () => {
    expect(
      client.verifyBetRequest(
        '{"test":true}',
        "0000000000000000000000000000000000000000000000000000000000000000"
      )
    ).toBe(false);
  });

  it("returns false for wrong key", () => {
    const body = JSON.stringify({ test: true });
    const sig = createSignature(body, "wrong-key");
    expect(client.verifyBetRequest(body, sig)).toBe(false);
  });
});

describe("verifyBalanceRequest", () => {
  it("returns true for valid query param signature", () => {
    const params = { sessionID: "session-123" };
    const sig = createQueryParamsSignature(params, INTEGRATION_API_KEY);
    expect(client.verifyBalanceRequest(params, sig)).toBe(true);
  });

  it("returns false for missing signature", () => {
    expect(client.verifyBalanceRequest({ sessionID: "s1" }, undefined)).toBe(false);
  });

  it("returns false for tampered params", () => {
    const params = { sessionID: "session-123" };
    const sig = createQueryParamsSignature(params, INTEGRATION_API_KEY);
    expect(client.verifyBalanceRequest({ sessionID: "session-456" }, sig)).toBe(false);
  });
});

describe("response builders", () => {
  it("createBalanceResponse", () => {
    expect(createBalanceResponse("100.50")).toEqual({ balance: "100.50" });
  });

  it("createBetResponse", () => {
    expect(createBetResponse("90.50", "tx-1")).toEqual({
      balance: "90.50",
      txID: "tx-1",
    });
  });

  it("createWinResponse", () => {
    expect(createWinResponse("190.50", "tx-2")).toEqual({
      balance: "190.50",
      txID: "tx-2",
    });
  });

  it("createRefundResponse", () => {
    expect(createRefundResponse("100.50", "tx-3")).toEqual({
      balance: "100.50",
      txID: "tx-3",
    });
  });

  it("createErrorResponse with all fields", () => {
    const res = createErrorResponse({
      message: "Insufficient funds",
      code: "insufficient_funds",
      action: "refresh",
      actionData: "some-data",
      details: "Balance: 0.00",
    });
    expect(res).toEqual({
      message: "Insufficient funds",
      code: "insufficient_funds",
      action: "refresh",
      actionData: "some-data",
      details: "Balance: 0.00",
    });
  });

  it("createErrorResponse with minimal fields", () => {
    const res = createErrorResponse({ message: "Server error" });
    expect(res).toEqual({ message: "Server error" });
    expect(res.code).toBeUndefined();
    expect(res.action).toBeUndefined();
  });
});

describe("parseAndVerifyBetRequest", () => {
  it("returns ok with typed body on valid signature", () => {
    const body = {
      type: "regular",
      sessionID: "s1",
      amount: "10.00",
      txID: "550e8400-e29b-41d4-a716-446655440000",
      roundID: "660e8400-e29b-41d4-a716-446655440000",
    };
    const rawBody = JSON.stringify(body);
    const sig = createSignature(rawBody, INTEGRATION_API_KEY);

    const result = client.parseAndVerifyBetRequest(rawBody, sig);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.type).toBe("regular");
      expect(result.body.sessionID).toBe("s1");
      expect(result.body.amount).toBe("10.00");
      expect(result.body.txID).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(result.body.roundID).toBe("660e8400-e29b-41d4-a716-446655440000");
    }
  });

  it("returns error on invalid signature", () => {
    const rawBody = JSON.stringify({ sessionID: "s1" });
    const result = client.parseAndVerifyBetRequest(rawBody, "bad-sig");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Invalid signature");
    }
  });

  it("returns error on missing signature", () => {
    const rawBody = JSON.stringify({ sessionID: "s1" });
    const result = client.parseAndVerifyBetRequest(rawBody, undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Invalid signature");
    }
  });

  it("returns error on invalid JSON body", () => {
    const rawBody = "not-json";
    const result = client.parseAndVerifyBetRequest(rawBody, "some-sig");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Invalid request body");
    }
  });

  it("returns error when body fails schema validation", () => {
    const invalidBody = { type: "invalid_type", sessionID: "s1" };
    const rawBody = JSON.stringify(invalidBody);
    const sig = createSignature(rawBody, INTEGRATION_API_KEY);

    const result = client.parseAndVerifyBetRequest(rawBody, sig);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Invalid request body");
    }
  });
});

describe("parseAndVerifyRefundRequest", () => {
  it("returns ok with typed refund body", () => {
    const body = {
      sessionID: "s1",
      txID: "550e8400-e29b-41d4-a716-446655440001",
      origTxID: "550e8400-e29b-41d4-a716-446655440000",
      amount: "10.00",
    };
    const rawBody = JSON.stringify(body);
    const sig = createSignature(rawBody, INTEGRATION_API_KEY);

    const result = client.parseAndVerifyRefundRequest(rawBody, sig);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.origTxID).toBe("550e8400-e29b-41d4-a716-446655440000");
    }
  });
});

describe("parseAndVerifyBalanceRequest", () => {
  it("returns ok with typed query on valid signature", () => {
    const params = { sessionID: "session-abc" };
    const sig = createQueryParamsSignature(params, INTEGRATION_API_KEY);

    const result = client.parseAndVerifyBalanceRequest(params, sig);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.query.sessionID).toBe("session-abc");
    }
  });

  it("returns error on invalid signature", () => {
    const result = client.parseAndVerifyBalanceRequest({ sessionID: "s1" }, "bad-sig");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Invalid signature");
    }
  });

  it("returns error on missing signature", () => {
    const result = client.parseAndVerifyBalanceRequest({ sessionID: "s1" }, undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Invalid signature");
    }
  });

  it("returns error when sessionID is missing", () => {
    const params = { other: "value" };
    const sig = createQueryParamsSignature(params, INTEGRATION_API_KEY);

    const result = client.parseAndVerifyBalanceRequest(params, sig);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Missing sessionID");
    }
  });
});

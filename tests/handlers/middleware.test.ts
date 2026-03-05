import { describe, it, expect } from "vitest";
import {
  verifyRequest,
  verifyGetBalanceRequest,
  parseAndVerifyRequest,
  parseAndVerifyBalanceRequest,
} from "../../src/handlers/middleware.js";
import { createSignature, createQueryParamsSignature } from "../../src/crypto/sign.js";
import type { BetRequest, RefundRequest } from "../../src/handlers/types.js";
import {
  createBalanceResponse,
  createBetResponse,
  createWinResponse,
  createRefundResponse,
  createErrorResponse,
} from "../../src/handlers/responses.js";

const API_KEY = "test-integration-key";

describe("verifyRequest", () => {
  it("returns true for valid POST body signature", () => {
    const body = { type: "regular", sessionID: "s1", amount: "10.00", txID: "tx1", roundID: "r1" };
    const sig = createSignature(body, API_KEY);
    expect(verifyRequest(body, sig, API_KEY)).toBe(true);
  });

  it("returns true for valid string body signature", () => {
    const bodyStr = '{"amount":"10.00","roundID":"r1","sessionID":"s1","txID":"tx1","type":"regular"}';
    const sig = createSignature(bodyStr, API_KEY);
    expect(verifyRequest(bodyStr, sig, API_KEY)).toBe(true);
  });

  it("returns false for missing signature header", () => {
    expect(verifyRequest({ test: true }, undefined, API_KEY)).toBe(false);
  });

  it("returns false for invalid signature", () => {
    expect(
      verifyRequest(
        { test: true },
        "0000000000000000000000000000000000000000000000000000000000000000",
        API_KEY
      )
    ).toBe(false);
  });

  it("returns false for wrong key", () => {
    const body = { test: true };
    const sig = createSignature(body, API_KEY);
    expect(verifyRequest(body, sig, "wrong-key")).toBe(false);
  });
});

describe("verifyGetBalanceRequest", () => {
  it("returns true for valid query param signature", () => {
    const params = { sessionID: "session-123" };
    const sig = createQueryParamsSignature(params, API_KEY);
    expect(verifyGetBalanceRequest(params, sig, API_KEY)).toBe(true);
  });

  it("returns false for missing signature", () => {
    expect(verifyGetBalanceRequest({ sessionID: "s1" }, undefined, API_KEY)).toBe(false);
  });

  it("returns false for tampered params", () => {
    const params = { sessionID: "session-123" };
    const sig = createQueryParamsSignature(params, API_KEY);
    expect(verifyGetBalanceRequest({ sessionID: "session-456" }, sig, API_KEY)).toBe(false);
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

describe("parseAndVerifyRequest", () => {
  it("returns ok with typed body on valid signature", () => {
    const body: BetRequest = {
      type: "regular",
      sessionID: "s1",
      amount: "10.00",
      txID: "tx1",
      roundID: "r1",
    };
    const rawBody = JSON.stringify(body);
    const sig = createSignature(rawBody, API_KEY);

    const result = parseAndVerifyRequest<BetRequest>(rawBody, sig, API_KEY);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.type).toBe("regular");
      expect(result.body.sessionID).toBe("s1");
      expect(result.body.amount).toBe("10.00");
      expect(result.body.txID).toBe("tx1");
      expect(result.body.roundID).toBe("r1");
    }
  });

  it("returns ok with RefundRequest body", () => {
    const body: RefundRequest = {
      sessionID: "s1",
      txID: "tx-refund-1",
      origTxID: "tx1",
      amount: "10.00",
    };
    const rawBody = JSON.stringify(body);
    const sig = createSignature(rawBody, API_KEY);

    const result = parseAndVerifyRequest<RefundRequest>(rawBody, sig, API_KEY);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.origTxID).toBe("tx1");
    }
  });

  it("returns error on invalid signature", () => {
    const rawBody = JSON.stringify({ sessionID: "s1" });
    const result = parseAndVerifyRequest<BetRequest>(rawBody, "bad-sig", API_KEY);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Invalid signature");
    }
  });

  it("returns error on missing signature", () => {
    const rawBody = JSON.stringify({ sessionID: "s1" });
    const result = parseAndVerifyRequest<BetRequest>(rawBody, undefined, API_KEY);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Invalid signature");
    }
  });

  it("returns error on invalid JSON body", () => {
    const rawBody = "not-json";
    const result = parseAndVerifyRequest<BetRequest>(rawBody, "some-sig", API_KEY);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Invalid request body");
    }
  });
});

describe("parseAndVerifyBalanceRequest", () => {
  it("returns ok with typed query on valid signature", () => {
    const params = { sessionID: "session-abc" };
    const sig = createQueryParamsSignature(params, API_KEY);

    const result = parseAndVerifyBalanceRequest(params, sig, API_KEY);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.query.sessionID).toBe("session-abc");
    }
  });

  it("returns error on invalid signature", () => {
    const result = parseAndVerifyBalanceRequest({ sessionID: "s1" }, "bad-sig", API_KEY);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Invalid signature");
    }
  });

  it("returns error on missing signature", () => {
    const result = parseAndVerifyBalanceRequest({ sessionID: "s1" }, undefined, API_KEY);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Invalid signature");
    }
  });
});

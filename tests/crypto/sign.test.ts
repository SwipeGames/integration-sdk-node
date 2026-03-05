import { describe, it, expect } from "vitest";
import { createSignature, createQueryParamsSignature } from "../../src/crypto/sign.js";
import { verifySignature, verifyQueryParamsSignature } from "../../src/crypto/verify.js";

describe("createSignature", () => {
  // Test vectors from Go RequestSigner tests (platform-lib-common/utils/request-signer_test.go)

  it("signs JSON object with JCS canonicalization", () => {
    const sig = createSignature(
      '{"user_id": 123, "amount": 100.50}',
      "secret-key"
    );
    expect(sig).toBe(
      "9876ed3affd6596f3ddb9102a396718452cf83069904f3d001a2e91e164adc01"
    );
  });

  it("produces same signature regardless of key order", () => {
    const sig = createSignature(
      '{"amount":100.5,"user_id":123}',
      "secret-key"
    );
    expect(sig).toBe(
      "9876ed3affd6596f3ddb9102a396718452cf83069904f3d001a2e91e164adc01"
    );
  });

  it("signs empty object", () => {
    const sig = createSignature("{}", "secret-key");
    expect(sig).toBe(
      "99922a0dbb1fe95624c93c7204445c2eff8a014b0c9b585ddf2da0c21083a34e"
    );
  });

  it("handles whitespace in JSON input", () => {
    const sig = createSignature(
      '{  "user_id"  :  123  ,  "amount"  :  100.50  }',
      "secret-key"
    );
    expect(sig).toBe(
      "9876ed3affd6596f3ddb9102a396718452cf83069904f3d001a2e91e164adc01"
    );
  });

  it("different key produces different signature", () => {
    const sig = createSignature(
      '{"user_id": 123, "amount": 100.50}',
      "different-secret-key"
    );
    expect(sig).toBe(
      "d86208a306f6562c80c0a8894a1294a63e5e3bb4e2fd2b9b031b3c3c65cb1847"
    );
  });

  it("works with empty key", () => {
    const sig = createSignature('{"test": "value"}', "");
    expect(sig).toBe(
      "6c0e6084444acce7905532fd7c3871c33cfbc5f52a36d27704ffa02b1bb4df78"
    );
  });

  it("accepts object input (not just string)", () => {
    const sig = createSignature(
      { user_id: 123, amount: 100.5 },
      "secret-key"
    );
    expect(sig).toBe(
      "9876ed3affd6596f3ddb9102a396718452cf83069904f3d001a2e91e164adc01"
    );
  });
});

describe("createQueryParamsSignature", () => {
  // Test vectors from Go RequestSigner.SignQueryParams tests

  it("signs single query param", () => {
    const sig = createQueryParamsSignature(
      {
        sessionID:
          "7eaac66f751bcdb758877004b0a1c0063bdfb615ee0c20a464ae76edc67db324113f1ca8bd62b13dd1c7a43f85a20ea3",
      },
      "secret-key"
    );
    expect(sig).toBe(
      "23b02858e21abd151a4e48ed33e451cae4ad1b7cb267ef75d01c694ea2960e6d"
    );
  });

  it("signs empty query params", () => {
    const sig = createQueryParamsSignature({}, "secret-key");
    expect(sig).toBe(
      "99922a0dbb1fe95624c93c7204445c2eff8a014b0c9b585ddf2da0c21083a34e"
    );
  });

  it("signs multiple query params with special characters", () => {
    const sig = createQueryParamsSignature(
      { message: "hello world!", data: "test@example.com" },
      "secret-key"
    );
    expect(sig).toBe(
      "0825b42e92c46887f194252fda8b871c3c42aafa3833783d63b2005407000c02"
    );
  });

  it("handles empty param value", () => {
    const sig = createQueryParamsSignature(
      { empty: "", data: "value" },
      "secret-key"
    );
    expect(sig).toBe(
      "8cf8644bfb7004cd21ad8512923169bb652d836183c07497797ef1ca313d88cc"
    );
  });

  it("works with empty key", () => {
    const sig = createQueryParamsSignature({ test: "value" }, "");
    expect(sig).toBe(
      "6c0e6084444acce7905532fd7c3871c33cfbc5f52a36d27704ffa02b1bb4df78"
    );
  });
});

describe("verifySignature", () => {
  it("returns true for valid signature", () => {
    expect(
      verifySignature(
        '{"user_id": 123, "amount": 100.50}',
        "9876ed3affd6596f3ddb9102a396718452cf83069904f3d001a2e91e164adc01",
        "secret-key"
      )
    ).toBe(true);
  });

  it("returns false for invalid signature", () => {
    expect(
      verifySignature(
        '{"user_id": 123, "amount": 100.50}',
        "0000000000000000000000000000000000000000000000000000000000000000",
        "secret-key"
      )
    ).toBe(false);
  });

  it("returns false for wrong key", () => {
    expect(
      verifySignature(
        '{"user_id": 123, "amount": 100.50}',
        "9876ed3affd6596f3ddb9102a396718452cf83069904f3d001a2e91e164adc01",
        "wrong-key"
      )
    ).toBe(false);
  });
});

describe("verifyQueryParamsSignature", () => {
  it("returns true for valid query param signature", () => {
    expect(
      verifyQueryParamsSignature(
        {
          sessionID:
            "7eaac66f751bcdb758877004b0a1c0063bdfb615ee0c20a464ae76edc67db324113f1ca8bd62b13dd1c7a43f85a20ea3",
        },
        "23b02858e21abd151a4e48ed33e451cae4ad1b7cb267ef75d01c694ea2960e6d",
        "secret-key"
      )
    ).toBe(true);
  });

  it("returns false for invalid signature", () => {
    expect(
      verifyQueryParamsSignature(
        { sessionID: "test" },
        "0000000000000000000000000000000000000000000000000000000000000000",
        "secret-key"
      )
    ).toBe(false);
  });
});

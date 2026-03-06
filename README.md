# @swipegames/integration-sdk

Node.js SDK for Swipe Games integrators. Provides a ready-made client for the [Core API](https://swipegames.github.io/public-api/core), HMAC+JCS signature utilities, typed request/response interfaces for the [Integration Adapter API](https://swipegames.github.io/public-api/swipegames-integration) (reverse calls), and response builder helpers.

For full API details, see the [Swipe Games Public API documentation](https://swipegames.github.io/public-api/).

## Requirements

- Node.js >= 18

## Installation

```bash
npm install @swipegames/integration-sdk
```

---

## Table of Contents

1. [Client Setup](#client-setup)
2. [Core API (Integrator → Swipe Games)](#core-api-integrator--swipe-games)
3. [Integration Adapter API (Reverse Calls)](#integration-adapter-api-reverse-calls)
4. [Error Handling](#error-handling)
5. [Crypto Utilities](#crypto-utilities)
6. [Types Reference](#types-reference)
7. [Debug Mode](#debug-mode)
8. [Development](#development)

---

## Client Setup

```typescript
import { SwipeGamesClient } from "@swipegames/integration-sdk";

const client = new SwipeGamesClient({
  cid: "your-cid-uuid", // Swipe Games-assigned Client ID (CID)
  extCid: "your-ext-cid", // Your External Client ID (ExtCID)
  apiKey: "your-api-key", // Shared secret for signing & verification
  env: "staging", // "staging" | "production"
});
```

### Configuration options

| Option    | Type                        | Required | Description                                       |
| --------- | --------------------------- | -------- | ------------------------------------------------- |
| `cid`     | `string`                    | Yes      | Swipe Games-assigned Client ID (CID)              |
| `extCid`  | `string`                    | Yes      | Your External Client ID (ExtCID)                  |
| `apiKey`  | `string`                    | Yes      | Shared API key for signing and verification       |
| `env`     | `"staging" \| "production"` | No       | Environment (defaults to `"staging"`)             |
| `baseUrl` | `string`                    | No       | Custom base URL (overrides `env`)                 |
| `debug`   | `boolean`                   | No       | Enable request/response logging (default `false`) |

### Using a custom base URL

If you need to point to a non-standard environment use `baseUrl` instead of `env`:

```typescript
const client = new SwipeGamesClient({
  cid: "your-cid-uuid",
  extCid: "your-ext-cid",
  apiKey: "your-api-key",
  baseUrl: "https://customenvironment.platform.0.swipegames.io/api/v1",
});
```

---

## Core API (Integrator → Swipe Games)

The client handles request signing automatically via `X-REQUEST-SIGN` header.

### Launch a game

```typescript
const { gameURL, gsID } = await client.createNewGame({
  gameID: "sg_catch_97", // required
  demo: false, // required
  platform: "desktop", // required: "desktop" | "mobile"
  currency: "USD", // required
  locale: "en_us", // required
  sessionID: "session-123", // optional
  returnURL: "https://...", // optional: redirect after game ends
  depositURL: "https://...", // optional: redirect for deposits
  initDemoBalance: "1000", // optional: starting balance for demo mode
  user: {
    // optional
    id: "player-123",
    firstName: "John",
    lastName: "Doe",
    nickName: "johnny",
    country: "US",
  },
});
// gameURL → URL to launch the game
// gsID    → game session ID
```

### List available games

```typescript
const games = await client.getGames();
// Returns GameInfo[] — see Types Reference below
```

### Create a free rounds campaign

See [Free Rounds](https://swipegames.github.io/public-api/free-rounds) for details on campaign configuration and behavior.

```typescript
const { id, extID } = await client.createFreeRounds({
  extID: "campaign-1", // required: your campaign ID
  currency: "USD", // required
  quantity: 10, // required: number of free rounds
  betLine: 5, // required
  validFrom: "2026-01-01T00:00:00.000Z", // required: ISO 8601
  validUntil: "2026-02-01T00:00:00.000Z", // optional: ISO 8601
  gameIDs: ["sg_catch_97"], // optional: restrict to specific games
  userIDs: ["player-123"], // optional: restrict to specific users
});
```

### Cancel a free rounds campaign

```typescript
// Cancel by Swipe Games ID
await client.cancelFreeRounds({ id: "fr-123" });

// Or cancel by your external ID
await client.cancelFreeRounds({ extID: "campaign-1" });
```

---

## Integration Adapter API (Reverse Calls)

When a game session is active, Swipe Games makes [reverse calls](https://swipegames.github.io/public-api/swipegames-integration) to your server for balance checks and wallet operations. You must implement 4 endpoints:

| Endpoint   | Method | Purpose               |
| ---------- | ------ | --------------------- |
| `/balance` | GET    | Get player balance    |
| `/bet`     | POST   | Deduct bet amount     |
| `/win`     | POST   | Credit win amount     |
| `/refund`  | POST   | Refund a previous bet |

During [free rounds](https://swipegames.github.io/public-api/free-rounds), bet/win requests arrive with `type: "free"` and an `frID` — see the docs for how these should be handled.

The SDK provides everything you need:

- **`parseAndVerifyRequest<T>()`** / **`parseAndVerifyBalanceRequest()`** — signature verification + typed body parsing in one call
- **`verifyRequest()`** / **`verifyGetBalanceRequest()`** — lower-level signature verification
- **Typed interfaces** — `BetRequest`, `WinRequest`, `RefundRequest`, `GetBalanceQuery`
- **Response builders** — `createBalanceResponse()`, `createBetResponse()`, etc.
- **Error builder** — `createErrorResponse()` with typed error codes

### Imports

```typescript
import {
  // Parse + verify helpers (recommended)
  parseAndVerifyRequest,
  parseAndVerifyBalanceRequest,
  // Response builders
  createBalanceResponse,
  createBetResponse,
  createWinResponse,
  createRefundResponse,
  createErrorResponse,
  // Zod schemas for optional runtime validation
  IntegrationSchemas,
} from "@swipegames/integration-sdk";
import type {
  BetRequest,
  WinRequest,
  RefundRequest,
} from "@swipegames/integration-sdk";
```

### Sample handler implementations

The examples below show how to wire the SDK helpers into your endpoint handlers. Functions like `getPlayerBalance()`, `deductFromWallet()`, etc. are **your own logic** — the SDK only handles signature verification, body parsing, and response building.

#### GET /balance

Swipe Games sends `sessionID` as a query parameter with the signature in the `X-REQUEST-SIGN` header.

```typescript
function handleGetBalance(
  queryParams: Record<string, string>,
  signatureHeader: string,
  apiKey: string,
) {
  const result = parseAndVerifyBalanceRequest(
    queryParams,
    signatureHeader,
    apiKey,
  );
  if (!result.ok) {
    return { status: 400, body: result.error };
  }

  // Your logic: look up the player's balance using the session ID.
  const balance = getPlayerBalance(result.query.sessionID);

  // use SDK createBalanceResponse to create response
  return { status: 200, body: createBalanceResponse(balance) };
}
```

#### POST /bet

```typescript
function handleBet(rawBody: string, signatureHeader: string, apiKey: string) {
  // Optional 4th arg: pass a zod schema for runtime body validation
  const result = parseAndVerifyRequest<BetRequest>(
    rawBody,
    signatureHeader,
    apiKey,
    IntegrationSchemas.PostBetBody, // optional
  );
  if (!result.ok) {
    return { status: 400, body: result.error };
  }

  // Your logic: deduct the bet amount and record the transaction.
  const newBalance = deductFromWallet(
    result.body.sessionID,
    result.body.amount,
  );
  const partnerTxID = saveTransaction(result.body.txID, result.body.roundID);

  // use SDK createBetResponse to create response
  return { status: 200, body: createBetResponse(newBalance, partnerTxID) };
}
```

#### POST /win

```typescript
function handleWin(rawBody: string, signatureHeader: string, apiKey: string) {
  const result = parseAndVerifyRequest<WinRequest>(
    rawBody,
    signatureHeader,
    apiKey,
  );
  if (!result.ok) {
    return { status: 400, body: result.error };
  }

  // Your logic: credit the win amount and record the transaction.
  const newBalance = creditToWallet(result.body.sessionID, result.body.amount);
  const partnerTxID = saveTransaction(result.body.txID, result.body.roundID);

  // use SDK createWinResponse to create response
  return { status: 200, body: createWinResponse(newBalance, partnerTxID) };
}
```

#### POST /refund

```typescript
function handleRefund(
  rawBody: string,
  signatureHeader: string,
  apiKey: string,
) {
  const result = parseAndVerifyRequest<RefundRequest>(
    rawBody,
    signatureHeader,
    apiKey,
  );
  if (!result.ok) {
    return { status: 400, body: result.error };
  }

  // Your logic: refund the original transaction and record the refund.
  const newBalance = refundToWallet(
    result.body.sessionID,
    result.body.origTxID,
    result.body.amount,
  );
  const partnerTxID = saveRefundTransaction(
    result.body.txID,
    result.body.origTxID,
  );

  // use SDK createRefundResponse to create response
  return { status: 200, body: createRefundResponse(newBalance, partnerTxID) };
}
```

### Lower-level verification

If you need just the boolean check without parsing (e.g. you already parsed the body):

```typescript
import {
  verifyRequest,
  verifyGetBalanceRequest,
} from "@swipegames/integration-sdk";

// POST body verification
const valid = verifyRequest(rawBody, signatureHeader, apiKey);

// GET /balance query param verification
const valid = verifyGetBalanceRequest(queryParams, signatureHeader, apiKey);
```

Or via a `SwipeGamesClient` instance:

```typescript
client.verifyReverseCallSignature(rawBody, signatureHeader);
client.verifyGetBalanceSignature(queryParams, signatureHeader);
```

---

## Error Handling

### Core API errors

The SDK throws two error types:

- **`SwipeGamesApiError`** — API returned a non-2xx response
- **`SwipeGamesValidationError`** — Request params failed client-side zod validation before the request was sent

```typescript
import {
  SwipeGamesApiError,
  SwipeGamesValidationError,
} from "@swipegames/integration-sdk";

try {
  await client.createNewGame({ ... });
} catch (err) {
  if (err instanceof SwipeGamesValidationError) {
    console.error(err.message);    // Validation error summary
    console.error(err.zodError);   // Full ZodError with field-level details
  }
  if (err instanceof SwipeGamesApiError) {
    console.error(err.status);     // HTTP status code (e.g. 401, 404, 500)
    console.error(err.message);    // Error message from the platform
    console.error(err.code);       // Optional error code
    console.error(err.details);    // Optional additional details
  }
}
```

### Reverse call error responses

When you need to return an error from your reverse call handlers, use `createErrorResponse()`:

```typescript
// Simple error
createErrorResponse({ message: "Player not found" });
// → { "message": "Player not found" }

// Error with code
createErrorResponse({
  message: "Insufficient funds",
  code: "insufficient_funds",
});
// → { "message": "Insufficient funds", "code": "insufficient_funds" }

// Error with code and action
createErrorResponse({
  message: "Session has expired",
  code: "session_expired",
  action: "refresh",
});
// → { "message": "Session has expired", "code": "session_expired", "action": "refresh" }
```

#### Available error codes

| Code                      | Description                           |
| ------------------------- | ------------------------------------- |
| `game_not_found`          | Game does not exist                   |
| `currency_not_supported`  | Currency not supported                |
| `locale_not_supported`    | Locale not supported                  |
| `account_blocked`         | Player account is blocked             |
| `bet_limit`               | Bet limit exceeded                    |
| `loss_limit`              | Loss limit exceeded                   |
| `time_limit`              | Time limit exceeded                   |
| `insufficient_funds`      | Not enough balance                    |
| `session_expired`         | Session has expired                   |
| `session_not_found`       | Session does not exist                |
| `client_connection_error` | Connection error to integrator system |

---

## Crypto Utilities

For lower-level signing and verification (e.g. building custom middleware):

```typescript
import {
  createSignature,
  createQueryParamsSignature,
  verifySignature,
  verifyQueryParamsSignature,
} from "@swipegames/integration-sdk";

// Sign a JSON body (uses JCS canonicalization + HMAC-SHA256)
const sig = createSignature({ some: "data" }, "api-key");

// Verify a JSON body signature
const valid = verifySignature({ some: "data" }, sig, "api-key");

// Sign query parameters
const qsSig = createQueryParamsSignature({ sessionID: "abc" }, "api-key");

// Verify query parameter signature
const qsValid = verifyQueryParamsSignature(
  { sessionID: "abc" },
  qsSig,
  "api-key",
);
```

---

## Types Reference

All request/response types are derived from the [`@swipegames/public-api`](https://github.com/swipegames/public-api) package and re-exported from this SDK. The SDK also re-exports the generated Zod schemas (`CoreSchemas`, `IntegrationSchemas`) and TypeScript types (`CoreTypes`, `IntegrationTypes`) for consumer-side validation.

See [`src/index.ts`](src/index.ts) for the full list of exported types.

---

## Debug Mode

Enable debug logging to see all Core API requests and responses:

```typescript
const client = new SwipeGamesClient({
  cid: "your-cid-uuid",
  extCid: "your-ext-cid",
  apiKey: "your-api-key",
  env: "staging",
  debug: true,
});
```

When enabled, the SDK logs to `console.log`/`console.error` with a `[SwipeGamesSDK]` prefix:

```
[SwipeGamesSDK] POST https://staging.platform.0.swipegames.io/api/v1/create-new-game
[SwipeGamesSDK] Body: {"cID":"...","extCID":"...","gameID":"sg_catch_97",...}
[SwipeGamesSDK] POST https://staging.platform.0.swipegames.io/api/v1/create-new-game -> 200
```

On errors:

```
[SwipeGamesSDK] GET https://staging.platform.0.swipegames.io/api/v1/games -> 401
[SwipeGamesSDK] GET ... error: { message: "Invalid signature" }
```

---

## Development

```bash
npm test          # Run tests
npm run build     # Build TypeScript
npm run lint      # Type check
```

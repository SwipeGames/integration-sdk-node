# @swipegames/integration-sdk

Node.js SDK for Swipe Games integrators. Provides a ready-made client for the [Core API](https://swipegames.github.io/public-api/core), typed request/response interfaces for the [Integration Adapter API](https://swipegames.github.io/public-api/swipegames-integration) (reverse calls), and response builder helpers.

For full API details, see the [Swipe Games Public API documentation](https://swipegames.github.io/public-api/).

## Requirements

- Node.js >= 18
- **ESM only** — this package uses `"type": "module"` and cannot be `require()`'d from CommonJS. Use `import` syntax or a dynamic `await import()`.

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
5. [Types Reference](#types-reference)
6. [Debug Mode](#debug-mode)
7. [Development](#development)

---

## Client Setup

The SDK uses two separate API keys:

- **`apiKey`** — used to sign requests **you send** to the Swipe Games Core API
- **`integrationApiKey`** — used to verify reverse calls **you receive** from the Swipe Games platform

```typescript
import { SwipeGamesClient } from "@swipegames/integration-sdk";

const client = new SwipeGamesClient({
  cid: "your-cid-uuid", // Swipe Games-assigned Client ID (CID)
  extCid: "your-ext-cid", // Your External Client ID (ExtCID)
  apiKey: "your-api-key", // Signs outbound requests to Core API
  integrationApiKey: "your-int-key", // Verifies inbound reverse calls from platform
  env: "staging", // "staging" | "production"
});
```

### Configuration options

| Option              | Type                        | Required | Description                                               |
| ------------------- | --------------------------- | -------- | --------------------------------------------------------- |
| `cid`               | `string`                    | Yes      | Swipe Games-assigned Client ID (CID)                      |
| `extCid`            | `string`                    | Yes      | Your External Client ID (ExtCID)                          |
| `apiKey`            | `string`                    | Yes      | API key for signing outbound requests to the Core API     |
| `integrationApiKey` | `string`                    | Yes      | API key for verifying inbound reverse calls from platform |
| `env`               | `"staging" \| "production"` | No       | Environment (defaults to `"staging"`)                     |
| `baseUrl`           | `string`                    | No       | Custom base URL (overrides `env`)                         |
| `debug`             | `boolean`                   | No       | Enable request/response logging (default `false`)         |

### Using a custom base URL

If you need to point to a non-standard environment use `baseUrl` instead of `env`:

```typescript
const client = new SwipeGamesClient({
  cid: "your-cid-uuid",
  extCid: "your-ext-cid",
  apiKey: "your-api-key",
  integrationApiKey: "your-int-key",
  baseUrl: "https://customenvironment.platform.0.swipegames.io/api/v1",
});
```

---

## Core API (Integrator → Swipe Games)

The client signs all outbound requests automatically via the `X-REQUEST-SIGN` header using `apiKey`.

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

All reverse calls are signed by the platform with your `integrationApiKey`. The client provides typed methods to verify and parse them — no need to pass keys manually.

### Parse & verify (recommended)

The `parseAndVerify*` methods verify the signature, parse the body, validate against the Zod schema, and return a typed result.

To build your responses, import the response helpers:

```typescript
import {
  createBalanceResponse,
  createBetResponse,
  createWinResponse,
  createRefundResponse,
  createErrorResponse,
} from "@swipegames/integration-sdk";
```

#### GET /balance

```typescript
function handleGetBalance(
  queryParams: Record<string, string>,
  signatureHeader: string | undefined,
) {
  const result = client.parseAndVerifyBalanceRequest(
    queryParams,
    signatureHeader,
  );
  if (!result.ok) {
    return { status: 401, body: result.error };
  }

  // Your logic: look up the player's balance using the session ID.
  const balance = getPlayerBalance(result.query.sessionID);

  return { status: 200, body: createBalanceResponse(balance) };
}
```

#### POST /bet

```typescript
function handleBet(rawBody: string, signatureHeader: string | undefined) {
  const result = client.parseAndVerifyBetRequest(rawBody, signatureHeader);
  if (!result.ok) {
    return { status: 401, body: result.error };
  }

  // Your logic: deduct the bet amount and record the transaction.
  const newBalance = deductFromWallet(
    result.body.sessionID,
    result.body.amount,
  );
  const partnerTxID = saveTransaction(result.body.txID, result.body.roundID);

  return { status: 200, body: createBetResponse(newBalance, partnerTxID) };
}
```

#### POST /win

```typescript
function handleWin(rawBody: string, signatureHeader: string | undefined) {
  const result = client.parseAndVerifyWinRequest(rawBody, signatureHeader);
  if (!result.ok) {
    return { status: 401, body: result.error };
  }

  // Your logic: credit the win amount and record the transaction.
  const newBalance = creditToWallet(result.body.sessionID, result.body.amount);
  const partnerTxID = saveTransaction(result.body.txID, result.body.roundID);

  return { status: 200, body: createWinResponse(newBalance, partnerTxID) };
}
```

#### POST /refund

```typescript
function handleRefund(rawBody: string, signatureHeader: string | undefined) {
  const result = client.parseAndVerifyRefundRequest(rawBody, signatureHeader);
  if (!result.ok) {
    return { status: 401, body: result.error };
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

  return { status: 200, body: createRefundResponse(newBalance, partnerTxID) };
}
```

### Verify only (lower-level)

If you need just the boolean check without parsing (e.g. you already parsed the body yourself):

```typescript
// POST body verification (/bet, /win, /refund)
const valid = client.verifyBetRequest(rawBody, signatureHeader);
const valid = client.verifyWinRequest(rawBody, signatureHeader);
const valid = client.verifyRefundRequest(rawBody, signatureHeader);

// GET /balance query param verification
const valid = client.verifyBalanceRequest(queryParams, signatureHeader);
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
  integrationApiKey: "your-int-key",
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

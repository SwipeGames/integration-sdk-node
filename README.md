# @swipegames/integration-sdk

Node.js SDK for SwipeGames direct integration partners. Provides a ready-made client for outbound API calls, HMAC+JCS signature utilities, typed request/response interfaces for inbound reverse calls, and response builder helpers.

## Requirements

- Node.js >= 18

## Installation

```bash
npm install @swipegames/integration-sdk
```

---

## Table of Contents

1. [Client Setup](#client-setup)
2. [Outbound API Calls (Partner → SwipeGames)](#outbound-api-calls-partner--swipegames)
3. [Inbound Reverse Calls (SwipeGames → Partner)](#inbound-reverse-calls-swipegames--partner)
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
  cid: "your-cid-uuid", // SwipeGames-assigned client ID
  extCid: "your-ext-cid", // Your external client ID
  apiKey: "your-api-key", // Shared secret for signing & verification
  env: "staging", // "staging" | "production"
});
```

### Configuration options

| Option    | Type                        | Required | Description                                       |
| --------- | --------------------------- | -------- | ------------------------------------------------- |
| `cid`     | `string`                    | Yes      | SwipeGames-assigned client ID (UUID)              |
| `extCid`  | `string`                    | Yes      | Your external client ID                           |
| `apiKey`  | `string`                    | Yes      | Shared API key for signing and verification       |
| `env`     | `"staging" \| "production"` | No       | Environment (defaults to `"staging"`)             |
| `baseUrl` | `string`                    | No       | Custom base URL (overrides `env`)                 |
| `debug`   | `boolean`                   | No       | Enable request/response logging (default `false`) |

### Using a custom base URL

If you need to point to a non-standard environment (e.g. dev), use `baseUrl` instead of `env`:

```typescript
const client = new SwipeGamesClient({
  cid: "your-cid-uuid",
  extCid: "your-ext-cid",
  apiKey: "your-api-key",
  baseUrl: "https://dev.platform.1.swipegames.io/api/v1",
});
```

---

## Outbound API Calls (Partner → SwipeGames)

The client handles request signing automatically via `X-REQUEST-SIGN` header.

### Create a new game session

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
// Cancel by SwipeGames ID
await client.cancelFreeRounds({ id: "fr-123" });

// Or cancel by your external ID
await client.cancelFreeRounds({ extID: "campaign-1" });
```

---

## Inbound Reverse Calls (SwipeGames → Partner)

When a game session is active, SwipeGames sends HTTP requests to your server for balance checks and wallet operations. You must implement 4 endpoints:

| Endpoint   | Method | Purpose               |
| ---------- | ------ | --------------------- |
| `/balance` | GET    | Get player balance    |
| `/bet`     | POST   | Deduct bet amount     |
| `/win`     | POST   | Credit win amount     |
| `/refund`  | POST   | Refund a previous bet |

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
} from "@swipegames/integration-sdk";
import type {
  BetRequest,
  WinRequest,
  RefundRequest,
} from "@swipegames/integration-sdk";
```

### GET /balance

SwipeGames sends `sessionID` as a query parameter with the signature in the `X-REQUEST-SIGN` header.

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
    return { status: 401, body: result.error };
  }

  // result.query is typed as GetBalanceQuery
  const balance = getPlayerBalance(result.query.sessionID);
  return { status: 200, body: createBalanceResponse(balance) };
}
// Response: { "balance": "1500.00" }
```

### POST /bet

```typescript
function handleBet(rawBody: string, signatureHeader: string, apiKey: string) {
  const result = parseAndVerifyRequest<BetRequest>(
    rawBody,
    signatureHeader,
    apiKey,
  );
  if (!result.ok) {
    return { status: 401, body: result.error };
  }

  // result.body is typed as BetRequest:
  //   { type: "regular" | "free", sessionID, amount, txID, roundID, frID? }
  const newBalance = deductFromWallet(
    result.body.sessionID,
    result.body.amount,
  );
  const partnerTxID = saveTransaction(result.body.txID, result.body.roundID);

  return { status: 200, body: createBetResponse(newBalance, partnerTxID) };
}
// Response: { "balance": "990.00", "txID": "your-tx-123" }
```

### POST /win

```typescript
function handleWin(rawBody: string, signatureHeader: string, apiKey: string) {
  const result = parseAndVerifyRequest<WinRequest>(
    rawBody,
    signatureHeader,
    apiKey,
  );
  if (!result.ok) {
    return { status: 401, body: result.error };
  }

  // result.body: { type, sessionID, amount, txID, roundID, frID? }
  const newBalance = creditToWallet(result.body.sessionID, result.body.amount);
  const partnerTxID = saveTransaction(result.body.txID, result.body.roundID);

  return { status: 200, body: createWinResponse(newBalance, partnerTxID) };
}
// Response: { "balance": "1040.00", "txID": "your-tx-456" }
```

### POST /refund

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
    return { status: 401, body: result.error };
  }

  // result.body: { sessionID, txID, origTxID, amount }
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
// Response: { "balance": "1000.00", "txID": "your-tx-789" }
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

### Outbound errors

When a SwipeGames API call fails, the SDK throws a `SwipeGamesApiError`:

```typescript
import { SwipeGamesApiError } from "@swipegames/integration-sdk";

try {
  await client.createNewGame({ ... });
} catch (err) {
  if (err instanceof SwipeGamesApiError) {
    console.error(err.status);   // HTTP status code (e.g. 401, 404, 500)
    console.error(err.message);  // Error message from the platform
    console.error(err.code);     // Optional error code
    console.error(err.details);  // Optional additional details
  }
}
```

### Inbound error responses

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

| Code                      | Description                        |
| ------------------------- | ---------------------------------- |
| `game_not_found`          | Game does not exist                |
| `currency_not_supported`  | Currency not supported             |
| `locale_not_supported`    | Locale not supported               |
| `account_blocked`         | Player account is blocked          |
| `bet_limit`               | Bet limit exceeded                 |
| `loss_limit`              | Loss limit exceeded                |
| `time_limit`              | Time limit exceeded                |
| `insufficient_funds`      | Not enough balance                 |
| `session_expired`         | Session has expired                |
| `session_not_found`       | Session does not exist             |
| `client_connection_error` | Connection error to partner system |

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

### Client types

```typescript
// Client configuration
interface SwipeGamesClientConfig {
  cid: string;
  extCid: string;
  apiKey: string;
  env?: "staging" | "production";
  baseUrl?: string;
  debug?: boolean;
}

// createNewGame() params and response
interface CreateNewGameParams {
  gameID: string;
  demo: boolean;
  platform: PlatformType; // "desktop" | "mobile"
  currency: string;
  locale: string;
  sessionID?: string;
  returnURL?: string;
  depositURL?: string;
  initDemoBalance?: string;
  user?: User;
}
interface CreateNewGameResponse {
  gameURL: string;
  gsID: string;
}

// createFreeRounds() params and response
interface CreateFreeRoundsParams {
  extID: string;
  currency: string;
  quantity: number;
  betLine: number;
  validFrom: string;
  validUntil?: string;
  gameIDs?: string[];
  userIDs?: string[];
}
interface CreateFreeRoundsResponse {
  id: string;
  extID: string;
}

// cancelFreeRounds() params
interface CancelFreeRoundsParams {
  id?: string;
  extID?: string;
}
```

### Reverse call types

```typescript
// Inbound request types
interface GetBalanceQuery {
  sessionID: string;
}
interface BetRequest {
  type: TransactionType;
  sessionID: string;
  amount: string;
  txID: string;
  roundID: string;
  frID?: string;
}
interface WinRequest {
  type: TransactionType;
  sessionID: string;
  amount: string;
  txID: string;
  roundID: string;
  frID?: string;
}
interface RefundRequest {
  sessionID: string;
  txID: string;
  origTxID: string;
  amount: string;
}

// Inbound response types
interface BalanceResponse {
  balance: string;
}
interface BetResponse {
  balance: string;
  txID: string;
}
interface WinResponse {
  balance: string;
  txID: string;
}
interface RefundResponse {
  balance: string;
  txID: string;
}

type TransactionType = "regular" | "free";

// Parse + verify result types
type ParsedRequestResult<T> =
  | { ok: true; body: T }
  | { ok: false; error: ErrorResponseWithCodeAndAction };
type ParsedBalanceResult =
  | { ok: true; query: GetBalanceQuery }
  | { ok: false; error: ErrorResponseWithCodeAndAction };
```

### Shared types

```typescript
type PlatformType = "desktop" | "mobile";
interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  nickName?: string;
  country?: string;
}
type ErrorCode =
  | "game_not_found"
  | "currency_not_supported"
  | "locale_not_supported"
  | "account_blocked"
  | "bet_limit"
  | "loss_limit"
  | "time_limit"
  | "insufficient_funds"
  | "session_expired"
  | "session_not_found"
  | "client_connection_error";
type ErrorAction = "refresh";
```

### Game info types

```typescript
interface GameInfo {
  id: string;
  title: string;
  locales: string[];
  currencies: string[];
  platforms: PlatformType[];
  images: GameInfoImages;
  hasFreeSpins: boolean;
  rtp: number;
  betLines?: BetLineInfo[];
}
interface GameInfoImages {
  baseURL: string;
  square: string;
  horizontal: string;
  widescreen: string;
  vertical: string;
}
interface BetLineInfo {
  currency: string;
  values: BetLineValue[];
}
interface BetLineValue {
  maxBet: string;
  maxCoeff: string;
}
```

---

## Debug Mode

Enable debug logging to see all outbound requests and responses:

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

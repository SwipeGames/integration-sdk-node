# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Node.js SDK for Swipe Games integrators (`@swipegames/integration-sdk`). Published to npm (`registry.npmjs.org`). Provides:

- **Client** for the Core API (create games, list games, free rounds) — signs outbound requests with `apiKey`
- **Client** verification/parsing of reverse calls (balance, bet, win, refund) — verifies inbound requests with `integrationApiKey`
- **Response builders** for integrators implementing reverse call endpoints
- **Crypto** internals (HMAC-SHA256 + JCS canonicalization) — not publicly exported

## Commands

```bash
npm test              # Run all tests (vitest)
npm run test:watch    # Run tests in watch mode
npx vitest run tests/client/client.test.ts  # Run a single test file
npm run build         # Build (tsc -p tsconfig.build.json) → dist/
npm run lint          # Type check only (tsc --noEmit)
```

## Architecture

ESM-only package (`"type": "module"`). TypeScript with strict mode. All internal imports use `.js` extensions (Node16 module resolution).
:

### Two API keys

The SDK uses two separate keys per integration:

- **`apiKey`** — signs outbound requests from SDK to the Swipe Games Core API (matches `API_KEY_{CID}` on the platform)
- **`integrationApiKey`** — verifies inbound reverse calls from the platform to the integrator (matches `INTEGRATION_API_KEY_{CID}` on the platform)

### Source layout (`src/`)

- **`index.ts`** — Public barrel export. All public API surfaces are re-exported here.
- **`client/`** — `SwipeGamesClient` class: the single entry point for all SDK functionality.
  - Outbound: `createNewGame`, `getGames`, `createFreeRounds`, `cancelFreeRounds` — auto-signs with `apiKey`
  - Inbound verify-only: `verifyBetRequest`, `verifyWinRequest`, `verifyRefundRequest`, `verifyBalanceRequest`
  - Inbound parse+verify: `parseAndVerifyBetRequest`, `parseAndVerifyWinRequest`, `parseAndVerifyRefundRequest`, `parseAndVerifyBalanceRequest` — verifies signature, parses body, validates against Zod schema
- **`crypto/`** — Internal signing (`sign.ts`) and verification (`verify.ts`) using `node:crypto` HMAC-SHA256. `jcs.ts` handles JSON Canonicalization Scheme (RFC 8785). Not exported publicly.
- **`handlers/`** — `responses.ts` provides typed response builders (`createBalanceResponse`, `createBetResponse`, etc.). `types.ts` defines request/response interfaces and discriminated union result types.
- **`types/`** — Shared type definitions (`common.ts` for error codes/actions, `games.ts` for game info types).

### Key dependency

`@swipegames/public-api` provides generated Zod schemas (`CoreSchemas`, `IntegrationSchemas`) and TypeScript types (`CoreTypes`, `IntegrationTypes`) derived from the platform's OpenAPI spec.

## CI

PRs to `main` run tests and type checking.

## Publishing

A GitHub release triggers the publish workflow: runs tests, builds, and publishes to npm (`registry.npmjs.org`) with OIDC provenance. Bump version in `package.json` before merging to main.

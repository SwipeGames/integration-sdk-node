# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Node.js SDK for Swipe Games integrators (`@swipegames/integration-sdk`). Published to GitHub Packages. Provides:
- **Client** for the Core API (create games, list games, free rounds)
- **Crypto** utilities for HMAC-SHA256 + JCS canonicalization request signing/verification
- **Handler helpers** for the Integration Adapter API (reverse calls from Swipe Games to integrator servers: balance, bet, win, refund)

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

### Source layout (`src/`)

- **`index.ts`** — Public barrel export. All public API surfaces are re-exported here.
- **`client/`** — `SwipeGamesClient` class: wraps Core API endpoints (create-new-game, games, free-rounds). Auto-signs requests via `X-REQUEST-SIGN` header. Uses native `fetch`. Validates request params with Zod schemas from `@swipegames/public-api` before sending.
- **`crypto/`** — Low-level signing (`sign.ts`) and verification (`verify.ts`) using `node:crypto` HMAC-SHA256. `jcs.ts` handles JSON Canonicalization Scheme (RFC 8785) via the `canonicalize` package.
- **`handlers/`** — Helpers for integrators implementing reverse call endpoints. `middleware.ts` provides `parseAndVerifyRequest`/`parseAndVerifyBalanceRequest` (combined signature verification + body parsing). `responses.ts` provides typed response builders. `types.ts` defines request/response interfaces.
- **`types/`** — Shared type definitions (`common.ts` for error codes/actions, `games.ts` for game info types).

### Key dependency

`@swipegames/public-api` provides generated Zod schemas (`CoreSchemas`, `IntegrationSchemas`) and TypeScript types (`CoreTypes`, `IntegrationTypes`) derived from the platform's OpenAPI spec.

## CI

PRs to `main` run tests, type checking, and verify the package version has been bumped (version must not already be published to GitHub Packages).

## Publishing

`npm publish` triggers `prepublishOnly` → builds, then publishes to GitHub Packages (`npm.pkg.github.com`). Bump version in `package.json` before merging to main.

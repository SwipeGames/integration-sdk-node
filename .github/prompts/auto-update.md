# Auto-Update SDK for @swipegames/public-api

You are updating `@swipegames/integration-sdk` to match a new version of `@swipegames/public-api`.

## Environment

These env vars provide context (all optional — detect from local state if missing):

- `PUBLIC_API_DIFF_FILE` — path to a file containing the git diff between versions
- `PUBLIC_API_REPO_PATH` — path to the public-api repo checkout (default: `../public-api`)
- `CURRENT_VERSION` — currently installed version of `@swipegames/public-api`
- `TARGET_VERSION` — target version to update to

## Step 1: Gather context

1. **Detect versions** (if not provided via env vars):
   - Current: `node -e "const l=JSON.parse(require('fs').readFileSync('package-lock.json','utf8'));console.log(l.packages['node_modules/@swipegames/public-api'].version)"`
   - Target: `npm view @swipegames/public-api version`

2. **Read the public-api diff** to understand what changed:
   - If `PUBLIC_API_DIFF_FILE` is set and exists, read that file
   - Otherwise, in the public-api repo (`PUBLIC_API_REPO_PATH` or `../public-api`), run:
     ```
     git diff v{current}..v{target} -- packages/node/ api/ docs/ ':!**/*.gen.go' ':!**/go.mod' ':!**/go.sum' ':!**/package-lock.json' ':!**/schemas/*.schema.mdx'
     ```
   - If the public-api repo is not available, inspect the installed package at `node_modules/@swipegames/public-api/` to understand the current API surface

3. **Read the public-api source** for full context:
   - In the public-api repo: `packages/node/src/`, `api/`, `docs/` directories
   - Pay special attention to `docs/changes-log.md` for a human-readable changelog
   - Look at exported Zod schemas (`CoreSchemas`, `IntegrationSchemas`) and TypeScript types (`CoreTypes`, `IntegrationTypes`)

4. **Categorize the changes:**
   - New Core API endpoints (→ new methods on `SwipeGamesClient`)
   - New Integration (reverse-call) endpoints (→ new verify/parse methods + response builders)
   - Changed request/response schemas (→ update existing types and method signatures)
   - New shared types or enums (→ update `types/` barrel exports)
   - New error codes or actions (→ update `types/common.ts`)
   - Breaking changes (→ document in PR body)

## Step 2: Read the current SDK

Read these files to understand existing patterns:

1. `CLAUDE.md` — project architecture overview
2. `src/index.ts` — public barrel exports
3. `src/client/client.ts` — main client class (outbound + inbound methods)
4. `src/handlers/responses.ts` — response builder functions
5. `src/handlers/types.ts` — request/response interfaces and result types
6. `src/types/common.ts` — error codes and action enums
7. `src/types/games.ts` — game info types
8. `src/crypto/sign.ts` and `src/crypto/verify.ts` — signing internals
9. All files in `tests/` — test patterns

## Step 3: Update the SDK

Apply changes following existing patterns exactly. For each change type:

### New Core API endpoint

1. **`src/client/client.ts`**: Add a new public method following the pattern of `createNewGame` or `getGames`:
   - Use the appropriate HTTP method
   - Build the path from the endpoint
   - Sign the request with `this.apiKey` using `signRequest`
   - Parse the response with the corresponding `CoreSchemas` Zod schema
   - Return the parsed, typed result

2. **`src/index.ts`**: Re-export any new public types if needed

### New Integration (reverse-call) endpoint

1. **`src/client/client.ts`**: Add two methods following existing patterns:
   - `verify{Name}Request(headers, rawBody)` — signature verification only
   - `parseAndVerify{Name}Request(headers, rawBody)` — verify + parse body + validate with `IntegrationSchemas`

2. **`src/handlers/types.ts`**: Add request/response interfaces and a `{Name}Result` discriminated union type

3. **`src/handlers/responses.ts`**: Add a `create{Name}Response(data)` builder function

4. **`src/index.ts`**: Re-export new types and response builders

### Changed schemas (new fields, removed fields)

1. Update TypeScript interfaces in `src/handlers/types.ts` or `src/types/` to match the new schema
2. Update any client methods that construct or consume these types
3. If fields were removed, check for usages in tests and update accordingly

### New error codes or actions

1. **`src/types/common.ts`**: Add new enum values or type union members
2. Update response builders if they need to handle new codes

### New shared types

1. Add to the appropriate file in `src/types/`
2. Re-export from `src/index.ts`

## Step 4: Update tests

Follow existing test patterns exactly:

1. Read existing test files to understand the style (vitest, inline mocks, etc.)
2. Add tests for every new method or changed behavior
3. Test both success and error paths
4. For new client methods: test request signing, URL construction, response parsing
5. For new verify/parse methods: test valid signatures, invalid signatures, malformed bodies
6. For new response builders: test output shape and type correctness

## Step 5: Verify

1. Run `npm test` — all tests must pass
2. Run `npm run lint` — no type errors
3. If either fails, read the error output carefully, fix the issues, and re-run
4. Repeat until both pass cleanly
5. Run `npm run build` to verify the build succeeds

## Constraints

- **ESM-only**: All imports must use `.js` extensions (e.g., `import { foo } from './bar.js'`)
- **Strict TypeScript**: No `any` types, no `@ts-ignore`
- **Follow existing code style exactly**: same naming conventions, same patterns, same file organization
- **Do NOT modify `src/crypto/`** unless the signing/verification mechanism itself changed
- **Maintain two-key architecture**: `apiKey` for outbound, `integrationApiKey` for inbound
- **Backward compatible**: Don't remove or rename existing public API unless the upstream change is breaking
- **No unnecessary changes**: Only modify what's needed to support the new public-api version
- **Keep imports from `@swipegames/public-api` aligned**: Use `CoreSchemas`, `IntegrationSchemas`, `CoreTypes`, `IntegrationTypes` as appropriate

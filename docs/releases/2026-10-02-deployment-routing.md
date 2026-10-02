# Vocal Studio deployment routing audit - 2026-10-02

Baseline: `e84aa0fbd28eccea164e93214951304f9042ef75` (merged PR #24). No newer main commit or open deployment-routing fix was found before this change.

## Live path and failure evidence
- Cloudflare API maps `hlb.tllhouse.com` to Worker `vocal-studio`. An unauthenticated GET returned 302 to the existing Cloudflare Access host, not Vercel.
- Current production deployment: `d5e910fe-8d86-403f-b0a3-6fc3fdf6904e`, version `b928f205-85b5-414c-a91d-860b1b9b377e`, traffic 100%, created `2026-10-02T09:18:47.352354Z`. Its annotation records `PR24 reviewed e84aa0f`; source is `wrangler`. This is provider metadata, not an authenticated customer-data or served-asset hash test.
- Vercel project `vocal-studio` still receives Git deployments. Production `dpl_Df9DGDNXXQixr86dFArEk1mLWVkp` is ERROR at `buildStep`, with `module_not_found` and `npm run build` exit 1. Preview `dpl_9eQEHm1D7iEykyFwkJdVHoP9HUFq` also failed.
- `npm run build` executes `scripts/build-worker.mjs`, but `.vercelignore` excludes the entire `scripts` directory. An isolated source-exclusion fixture reproduced exit 1 / `MODULE_NOT_FOUND`; a complete checkout built successfully. Full Vercel build stderr was unavailable because the connected build-log action returned tool-not-found, so this diagnosis combines configuration, deployment metadata and local reproduction.

## Minimal correction
- Set `vercel.json` -> `git.deploymentEnabled` to boolean `false` for every branch using this configuration. Preserve all existing rewrites and cache/noindex headers.
- Do not repair or revive the obsolete Vercel build target. The Worker build, assets, authentication, Durable Object, R2 and PR #24 application code are unchanged.
- Add four deployment-contract regressions to `npm test`. The policy test fails before the configuration change and passes afterward.
- Existing Vercel deployments, aliases, project and domains are not deleted. Old branches that do not contain this policy may still trigger Vercel; bring them up to date before further pushes, or separately disconnect this project's Git integration. Project-wide disconnection was not performed.

## Validation
- Node `v24.21.0`, locked Wrangler `4.131.2`, clean `npm ci`.
- Baseline: 275 tests pass. Patched: 279 tests pass, 0 failures/skips; `npm run gate` passes 92 invariants.
- `npm run dry-run` passes the same `npm run build` and production Wrangler configuration, with 13 assets. No Worker upload or traffic change was performed.
- `index.html`, Worker code, `scripts/build-worker.mjs`, `scripts/deploy-locked.mjs`, `wrangler.jsonc` and `.vercelignore` have no diff against the baseline.

## Cloudflare Git integration boundary
Cloudflare Workers Builds can fetch GitHub source and run its own build/deploy process without GitHub Actions. Its repository/root/branch settings must match this Worker; use the canonical build and verification commands, not a Vercel build target.
The live account's Workers Builds trigger-list GET returned HTTP 403 (`Authentication error`). This audit does not claim that Git integration is present or absent, and did not create or modify it. `npm run deploy` remains intentionally approval-locked; do not bypass that lock by adding unattended `npx wrangler deploy`. Review an exact-release promotion policy separately. No Actions workflow, customer-data mutation, Access-policy change or production unlock was performed.

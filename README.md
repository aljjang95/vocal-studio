# Vocal Studio

Cloudflare-native administrator PWA for shared studio scheduling, lessons, consultations and private media. Start with [current stack](docs/CURRENT_STACK.md), [operations](docs/OPERATIONS.md) and [state protocol](docs/SYNC_PROTOCOL.md).

```sh
npm ci
npm test
npm run gate
npm run build
npm run dry-run
```

`wrangler.local.jsonc` provides the local Worker/SQLite Durable Object/R2 QA surface. Production deployment remains locked and requires the separate exact-release and customer-data reconciliation gates in `docs/OPERATIONS.md`. The public HLB site is owned by `aljjang95/hlb-vocal-studio-next`.

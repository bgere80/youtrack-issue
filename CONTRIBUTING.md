# Contributing

## Development Setup

```bash
npm ci
npm test
```

The committed test suite is intentionally offline and deterministic.

## Local Smoke Tests

Local smoke tests against a real YouTrack instance are optional and are not part of CI.

Typical setup:

1. copy `config.smoke.example.json` to `config.smoke.json`
2. create one or more local `test/*.smoke.test.mjs` files
3. run `npm run test:smoke`

Both `config.smoke.json` and `test/*.smoke.test.mjs` are gitignored on purpose.

## Scope

This project is currently focused on read-oriented YouTrack workflows plus local config management.

Before adding a larger feature, check `HANDOFF.md` for current scope and decisions.

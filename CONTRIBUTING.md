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

## Publishing

npm publishing is automated through GitHub Actions Trusted Publishing.

One-time setup:

1. in npm package settings, add this repository as a Trusted Publisher
2. select the workflow file `.github/workflows/publish.yml`
3. in GitHub repository settings, create an environment named `npm-publish`
4. add a required reviewer to that environment
5. add a tag ruleset for `v*` tags so only the maintainer role you want can create release tags

Recommended restriction model:

1. allow only you, or admins if you prefer, to create `v*` tags
2. require environment approval on `npm-publish`
3. keep branch protection on `main` separate from release tag control

Release flow:

1. update `package.json` version
2. commit the release
3. push a matching Git tag such as `v0.2.1`
4. GitHub Actions validates the tag, runs the offline checks, then waits for `npm-publish` environment approval
5. after approval, the workflow publishes to npm

The tag version must match `package.json`. For example, `v0.2.1` must match `"version": "0.2.1"`.

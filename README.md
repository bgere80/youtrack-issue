# youtrack-issue

Standalone CLI for reading YouTrack issues, queries, projects, and local alias config.

Contributing notes: see `CONTRIBUTING.md`.

## Install

Global install from npm:

```bash
npm install -g youtrack-issue
```

The package exposes both:

```bash
youtrack-issue --help
ytissue --help
```

For local development from this repo:

```bash
npm link
```

## Quick Start

With environment variables:

```bash
export YTISSUE_TOKEN="perm-..."
export YTISSUE_BASE_URL="https://youtrack.example.com"
ytissue AB-1234
```

With a global alias config in `~/.config/youtrack-issue/config.json`:

```json
{
  "defaultAlias": "work",
  "aliases": {
    "work": {
      "baseUrl": "https://youtrack.example.com",
      "token": "paste-your-token-here"
    }
  }
}
```

Then:

```bash
ytissue AB-1234
ytissue work AB-1234
ytissue -a work AB-1234
```

## Configuration

Supported environment variables:

- `YTISSUE_TOKEN`
- `YTISSUE_BASE_URL`
- `YTISSUE_CONFIG`
- `YTISSUE_TIMEOUT_MS`

Config path precedence:

1. `--config`
2. `YTISSUE_CONFIG`
3. `YTISSUE_CONFIG` from `~/.config/youtrack-issue/config.env`
4. `~/.config/youtrack-issue/config.json`

Additional config sources:

- `~/.config/youtrack-issue/config.env`
- `config.example.json` in this repo as a safe example

Any string value in the JSON config may reference environment variables:

```json
{
  "defaultAlias": "${YTISSUE_DEFAULT_ALIAS}",
  "aliases": {
    "work": {
      "baseUrl": "${YTISSUE_WORK_BASE_URL}",
      "token": "${YTISSUE_WORK_TOKEN}"
    }
  }
}
```

When invoked as a global command, the CLI does not read the current directory `.env` files. Current-directory `.env` / `.env.local` loading only applies to direct script execution such as `node ./bin/ytissue.mjs ...`.

## Common Commands

Single issue:

```bash
ytissue AB-1234
ytissue AB-1234 --json
ytissue AB-1234 --comments
ytissue AB-1234 --comments-only
ytissue AB-1234 --linked-issues
ytissue AB-1234 --spent-time
ytissue AB-1234 --work-items
ytissue AB-1234 --attachments
ytissue AB-1234 --download-attachment invoice.pdf
ytissue AB-1234 --fields
ytissue AB-1234 --field summary --field "Spent time"
```

Queries and projects:

```bash
ytissue --list
ytissue --list --limit 20
ytissue --search "project: AB"
ytissue --search "project: AB" --brief
ytissue --projects
ytissue --projects --brief
ytissue -lbn 20
ytissue -bs "project: AB" -n 20
```

Config management:

```bash
ytissue config list-aliases
ytissue config add-alias work --base-url https://youtrack.example.com --token '${YTISSUE_WORK_TOKEN}' --set-default
ytissue config set-default work
ytissue config remove-alias work
```

Custom config path:

```bash
ytissue -c ./config.example.json config list-aliases
ytissue -c ./config.example.json -a work AB-1234
```

## Help

```bash
ytissue --help
```

## Testing

The committed test suite is fully offline:

```bash
npm test
```

Local smoke checks against a real YouTrack server are optional:

1. copy `config.smoke.example.json` to `config.smoke.json`
2. optionally copy `test/local.smoke.example.mjs` to a local `test/*.smoke.test.mjs` file
3. or create your own `test/*.smoke.test.mjs` file directly
4. adjust the config and test data for your own YouTrack instance
5. run `npm run test:smoke`

Both `config.smoke.json` and `test/*.smoke.test.mjs` are gitignored by design.

# youtrack-issue

Minimal standalone YouTrack issue CLI.

## Setup

```bash
export YTISSUE_TOKEN="perm-..."
```

Optional:

```bash
export YTISSUE_BASE_URL="https://youtrack.billingo.com"
```

Or use a local config file:

```bash
cat > .env.local <<'EOF'
YTISSUE_TOKEN=perm-...
YTISSUE_BASE_URL=https://youtrack.billingo.com
EOF
```

The CLI also reads `~/.config/youtrack-issue/config.env`.

The alias config path can also be set with `YTISSUE_CONFIG`.

When invoked as a global command (`ytissue` / `youtrack-issue`), the CLI does not read the current directory `.env` files. Current-directory `.env` / `.env.local` loading only applies to direct script execution such as `node ./bin/ytissue.mjs ...`.

For reusable global aliases, create `~/.config/youtrack-issue/config.json`:

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

Any string value in the JSON config can also use an environment variable reference:

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

Example environment:

```bash
YTISSUE_DEFAULT_ALIAS=work
YTISSUE_WORK_BASE_URL=https://youtrack.example.com
YTISSUE_WORK_TOKEN=perm-...
```

There is also a repo example at `config.example.json`.

```bash
YTISSUE_CONFIG=./config.example.json ytissue --list-aliases
```

## Usage

```bash
node ./bin/ytissue.mjs AB-3941
```

If `defaultAlias` is set, this form automatically uses that alias.

```bash
node ./bin/ytissue.mjs --json AB-3941
```

```bash
node ./bin/ytissue.mjs --comments AB-3941
```

```bash
node ./bin/ytissue.mjs --comments-only AB-3941
```

```bash
node ./bin/ytissue.mjs --linked-issues AB-3941
```

```bash
node ./bin/ytissue.mjs --spent-time AB-3941
```

```bash
node ./bin/ytissue.mjs --work-items AB-3941
```

```bash
node ./bin/ytissue.mjs -a work AB-3941
```

```bash
node ./bin/ytissue.mjs work AB-3941
```

```bash
node ./bin/ytissue.mjs -c ./config.example.json -a work AB-3941
```

```bash
node ./bin/ytissue.mjs -c ./config.example.json AB-3941
```

```bash
node ./bin/ytissue.mjs --list
```

```bash
node ./bin/ytissue.mjs --search "for: me #Unresolved"
```

```bash
node ./bin/ytissue.mjs --search "project: AB" --brief
```

```bash
node ./bin/ytissue.mjs -a work --list --limit 20
```

```bash
node ./bin/ytissue.mjs -a work --search "project: AB" --limit 20
```

```bash
node ./bin/ytissue.mjs --list-aliases
```

```bash
node ./bin/ytissue.mjs -c ./config.example.json --list-aliases
```

```bash
node ./bin/ytissue.mjs -c ./config.test.json --add-alias work --base-url https://youtrack.example.com --token '${YOUTRACK_WORK_TOKEN}' --set-default
```

```bash
node ./bin/ytissue.mjs -c ./config.test.json --set-default work
```

```bash
node ./bin/ytissue.mjs -c ./config.test.json --remove-alias work
```

Or install globally from the repo:

```bash
npm link
youtrack-issue AB-3941
```

Short alias:

```bash
ytissue -a work AB-3941
ytissue work AB-3941
```

Help:

```bash
youtrack-issue --help
```

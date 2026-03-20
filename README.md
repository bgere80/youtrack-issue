# youtrack-issue

Minimal standalone YouTrack issue CLI.

## Setup

```bash
export YOUTRACK_TOKEN="perm-..."
```

Optional:

```bash
export YOUTRACK_BASE_URL="https://youtrack.billingo.com"
```

Or use a local config file:

```bash
cat > .env.local <<'EOF'
YOUTRACK_TOKEN=perm-...
YOUTRACK_BASE_URL=https://youtrack.billingo.com
EOF
```

The CLI also reads `~/.config/youtrack-issue/config.env`.

The alias config path can also be set with `YOUTRACK_CONFIG`.

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
  "defaultAlias": "${YOUTRACK_DEFAULT_ALIAS}",
  "aliases": {
    "work": {
      "baseUrl": "${YOUTRACK_WORK_BASE_URL}",
      "token": "${YOUTRACK_WORK_TOKEN}"
    }
  }
}
```

Example environment:

```bash
YOUTRACK_DEFAULT_ALIAS=work
YOUTRACK_WORK_BASE_URL=https://youtrack.example.com
YOUTRACK_WORK_TOKEN=perm-...
```

There is also a repo example at `config.example.json`.

```bash
YOUTRACK_CONFIG=./config.example.json ytissue --list-aliases
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

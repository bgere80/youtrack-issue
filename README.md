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

For reusable global aliases, create `~/.config/youtrack-issue/config.json`:

```json
{
  "aliases": {
    "billingo": {
      "baseUrl": "https://youtrack.billingo.com",
      "token": "perm-..."
    }
  }
}
```

## Usage

```bash
node ./bin/ytissue.mjs AB-3941
```

```bash
node ./bin/ytissue.mjs --json AB-3941
```

```bash
node ./bin/ytissue.mjs --comments AB-3941
```

```bash
node ./bin/ytissue.mjs -a billingo AB-3941
```

```bash
node ./bin/ytissue.mjs billingo AB-3941
```

```bash
node ./bin/ytissue.mjs -c ./config.test.json -a billingo AB-3941
```

Or install globally from the repo:

```bash
npm link
youtrack-issue AB-3941
```

Short alias:

```bash
ytissue -a billingo AB-3941
ytissue billingo AB-3941
```

Help:

```bash
youtrack-issue --help
```

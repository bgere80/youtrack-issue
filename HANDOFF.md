# Project Handoff

## Purpose

This repository contains a standalone, native-dependency-free Node CLI for reading YouTrack data by issue ID or query, plus managing local alias configuration.

Primary goals:
- global CLI usage via `ytissue` and `youtrack-issue`
- focus on read-oriented YouTrack workflows
- no dependency on the old `youtrack-cli` package or `keytar`

Repository:
- `/Users/bgere/work/youtrack-issue`

GitHub:
- `https://github.com/bgere80/youtrack-issue`

## Current Shape

Main files:
- `bin/ytissue.mjs`: CLI implementation
- `package.json`: package metadata and `bin` mapping
- `README.md`: user-facing documentation
- `LICENSE`: MIT license
- `CONTRIBUTING.md`: contributor setup and local smoke-test guidance
- `config.example.json`: safe example config committed to the repo
- `config.test.json`: committed offline test config with safe placeholder values
- `config.smoke.example.json`: example config for local smoke testing
- `test/local.smoke.example.mjs`: example local smoke tests for real-server checks
- `.github/workflows/ci.yml`: offline CI workflow

Local-only file:
- `config.smoke.json`
  - intentionally ignored
  - intended for local smoke tests, local alias setups, and real tokens

Global install:
- `npm link` has been used successfully
- both `ytissue` and `youtrack-issue` are wired to this repo

## Core Decisions

### Current scope: read-oriented issue access with local config management

The current implementation focuses on read-oriented YouTrack workflows, while also supporting local alias/config management commands.

Out of scope for now:
- create issue
- edit issue
- transitions / write operations
- attachment upload

This is a current scope decision, not a permanent product boundary.

### Config model

The CLI supports:
- alias-based config
- a default alias
- env vars
- direct overrides via flags
- config management via the `config` subcommand

Config path precedence:
1. `--config`
2. `YTISSUE_CONFIG` from the process environment
3. `YTISSUE_CONFIG` loaded from `~/.config/youtrack-issue/config.env`
4. `~/.config/youtrack-issue/config.json`

Environment file loading:
- direct `node ./bin/ytissue.mjs ...` execution reads cwd `.env` and `.env.local`
- both direct and global invocation read `~/.config/youtrack-issue/config.env`
- `config.env` may also provide `YTISSUE_CONFIG`, `YTISSUE_TOKEN`, `YTISSUE_BASE_URL`, and `YTISSUE_TIMEOUT_MS`

Alias example:

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

### Environment variable names

The CLI now uses only these names:
- `YTISSUE_TOKEN`
- `YTISSUE_BASE_URL`
- `YTISSUE_CONFIG`
- `YTISSUE_TIMEOUT_MS`

Older `YOUTRACK_*` names were intentionally removed. There is no backward compatibility layer.

### `.env` behavior

The behavior is intentionally asymmetric:

- global `ytissue` / `youtrack-issue` invocation does **not** read cwd `.env` / `.env.local`
- direct script execution via `node ./bin/ytissue.mjs ...` **does** read cwd `.env` / `.env.local`

Reason:
- global CLI should not accidentally inherit unrelated project-local env
- direct script execution remains convenient during development

This is not emphasized in the CLI help text because it is considered a development detail, not a primary usage path.

### Query UX

There was earlier discussion around positional `list` / `search` commands.

Final decision:
- no positional `list` or `search`
- use flags instead:
  - `--search "<query>"`
  - `--list`

Reason:
- avoids conflicts with alias names like `list`
- keeps the CLI consistently flag-oriented

### Config command UX

Config management now lives under a dedicated subcommand:
- `ytissue config list-aliases`
- `ytissue config add-alias ...`
- `ytissue config set-default ...`
- `ytissue config remove-alias ...`

Reason:
- keeps read/query flows separate from config mutation
- makes help output easier to scan
- fits the current Commander-based CLI model better

`-c, --config <path>` remains a global option and applies before the subcommand.

### Short flags

Frequently used read/query options now have short aliases:
- `-a` for `--alias`
- `-b` for `--brief`
- `-c` for `--config`
- `-f` for `--field`
- `-h` for `--help`
- `-j` for `--json`
- `-l` for `--list`
- `-n` for `--limit`
- `-p` for `--projects`
- `-s` for `--search`

Boolean short flags can be grouped, and a grouped sequence may end with one short option that takes a value.

Examples:
- `ytissue -lbn 20`
- `ytissue -bs "project: AB" -n 20`

### Output philosophy

Default output is human-readable.

`--json` is available for machine-readable output.

For query results:
- default mode: richer multi-field list
- `--brief`: compact `ID  Summary`

List/search rows are colorized by state:
- full row coloring
- only on TTY
- disabled by `NO_COLOR`
- not used for `--json`

## Questions We Resolved

This section captures the important questions that came up during development, the options that were considered, and the current conclusion.

### Should the tool stay read-only?

Question:
- should the CLI eventually create or modify issues?

Conclusion:
- not now, but this is not ruled out permanently

Why:
- the current value is in reliable read access
- write workflows would add much more UX and safety complexity
- current development focus is still on the read side of YouTrack data access
- local config file management is already intentionally supported

### Should we rely on env vars only, or add config?

Question:
- is simple token/base-url env config enough?

Options considered:
- env vars only
- local `.env`
- global alias config

Conclusion:
- keep env vars
- add global alias config
- support `defaultAlias`
- support explicit `--config`

Why:
- env vars are convenient for quick or CI use
- aliases are much better for daily usage across one or more YouTrack instances

### Should `.env` be used by the global CLI?

Question:
- should `ytissue ...` automatically read cwd `.env` / `.env.local`?

Conclusion:
- no

Why:
- global CLI behavior should not unexpectedly depend on the current project directory
- this was considered too surprising and error-prone

Follow-up conclusion:
- direct `node ./bin/ytissue.mjs ...` execution keeps `.env` support for development convenience

### Should config examples contain real placeholders or env references?

Question:
- should committed config examples use inline token placeholders or `${ENV_VAR}` references?

Conclusion:
- committed example uses a plain placeholder
- env interpolation remains supported and documented separately
- local `config.smoke.json` stays ignored

Why:
- simpler example file
- safer repo defaults
- env interpolation is still available when needed

### Should query mode be positional or flag-based?

Question:
- should list/search be positional commands like `ytissue list "..."`?

Options considered:
- positional commands
- flags

Conclusion:
- flags only
- `--search <query>`
- `--list`

Why:
- avoids alias-name collisions
- fits the rest of the CLI better
- keeps issue lookup as the default positional mode

### Should `--list` and `--search` mean the same thing?

Question:
- should both be synonyms for the same query endpoint?

Conclusion:
- no

Current meaning:
- `--search <query>`: query-based search
- `--list`: queryless listing

Why:
- clearer mental model
- preserves a useful difference between “search” and “show me recent/available issues”

### Should there be a compact output mode?

Question:
- is there value in a reduced list output instead of full rows?

Conclusion:
- yes, `--brief` was added

Why:
- useful for scanning, piping, copy-paste, and shell workflows

### Should list rows be colorized?

Question:
- is status-based coloring worth the extra complexity?

Conclusion:
- yes, for list/search output only

Why:
- quick visual scanning is useful
- whole-row coloring works especially well for `--brief`

Constraints:
- TTY only
- disabled by `NO_COLOR`
- never used for `--json`

### Was `--comments` enough?

Question:
- is `--comments` sufficient, or is a comments-only view needed?

Conclusion:
- `--comments` stays
- `--comments-only` was added

Why:
- `--comments` is useful when you want full issue context
- `--comments-only` is useful when you only care about the comment thread

### How should time tracking be exposed?

Question:
- should time tracking come from custom fields, work items, or both?

Conclusion:
- both

Current modes:
- `--spent-time`
- `--work-items`

Why:
- they answer different questions
- spent time is a quick summary
- work items are the detailed record

### Should linked issues stay embedded in issue detail only?

Question:
- is the link block inside issue detail enough?

Conclusion:
- no
- add a dedicated `--linked-issues` mode

Why:
- often you want relationship structure without the rest of the issue payload

### Should field lookup be a custom-fields-only view?

Question:
- should field selection mean "print only custom fields"?

Conclusion:
- no
- separate field discovery from field value lookup

Current model:
- `--fields`: list available field names
- `--field <name...>`: print only selected field values

Why:
- users need to know which fields exist before selecting them
- the useful set includes both standard issue fields and custom fields
- this is more flexible than a custom-fields-only view

### Should `--field` accept multiple values?

Question:
- should selected fields be repeated one-by-one or accepted in a single option?

Conclusion:
- support both repeated and variadic usage

Current model:
- `--field summary --field "Spent time"`
- `-f summary "Spent time" tags`

Why:
- repeated form is explicit and script-friendly
- variadic form is faster in interactive shell usage

### Should attachment handling stop at metadata?

Question:
- should attachments stay metadata-only, or should direct download also be supported?

Conclusion:
- support both list and download

Current modes:
- `--attachments`
- `--download-attachment <id-or-name>`

Why:
- listing is useful for discovery
- direct download removes a common manual step
- exact ID or exact file name matching keeps the UX simple

### Should env var names be generic?

Question:
- should the env vars stay as generic `YOUTRACK_*` names?

Conclusion:
- no
- use `YTISSUE_*` only

Why:
- clearer ownership
- fewer collisions with other YouTrack tools
- simpler long-term model

## Known Uncertainties We Closed

These are cases where implementation was adjusted based on real behavior rather than assumption.

### Assignee source

Uncertainty:
- whether top-level `issue.assignee` is reliable enough

Result:
- it is not reliable enough on real data
- assignee must also fall back to `customFields.Assignee`

### Comments endpoint shape

Uncertainty:
- whether the original comments URL construction was correct

Result:
- it was wrong at one point because the comments path was built from an already query-stringed issue URL
- comments now use a clean issue comments endpoint path

### `YTISSUE_CONFIG` from `.env`

Uncertainty:
- whether config path env resolution would work when the env value only came from `.env`

Result:
- this initially failed because config path resolution happened too early
- the lookup was changed so `.env` values are loaded before config path resolution

### Variadic `--field` parsing

Uncertainty:
- whether Commander would always pass a variadic option to the collector as an array

Result:
- no, collector input must defensively handle both a single string and an array
- otherwise a single field value can be accidentally spread into characters

### Test execution model

Uncertainty:
- whether the current test suite provides reliable local validation in restricted environments

Result:
- no
- some existing tests are real-network integration tests against YouTrack
- in a network-restricted environment these fail with `fetch failed`, even when the CLI logic is otherwise correct

## CLI Capabilities

### Issue detail

Examples:
- `ytissue AB-3941`
- `ytissue work AB-3941`
- `ytissue -a work AB-3941`

Displays:
- id
- summary
- project
- state
- type
- prio
- reporter
- assignee
- created / updated / resolved
- tags
- filtered custom fields
- filtered links
- description

Important implementation detail:
- assignee falls back to `customFields.Assignee`
- this was validated against a real issue where top-level `assignee` was empty

### Query modes

Search:
- `ytissue --search "project: AB"`
- `ytissue --search "for: me #Unresolved" --brief`

List:
- `ytissue --list`
- `ytissue -a work --list --limit 20`

Behavior:
- `--search <query>` hits `GET /api/issues` with a `query` parameter
- `--list` hits the same endpoint without a query

Output:
- default: `ID | State | Prio | Assignee | Updated` plus summary line
- `--brief`: `ID  Summary`
- `--json`: raw issue array

### Comment modes

Examples:
- `ytissue AB-3941 --comments`
- `ytissue AB-3941 --comments-only`
- `ytissue AB-3941 --comments-only --json`

Behavior:
- `--comments`: issue detail plus comments appended
- `--comments-only`: comments only
- `--json` with `--comments-only`: returns only the comments array

### Time tracking modes

Examples:
- `ytissue AB-3941 --spent-time`
- `ytissue AB-3941 --spent-time --json`
- `ytissue AB-3941 --work-items`
- `ytissue AB-3941 --work-items --json`

Behavior:
- `--spent-time`: returns the `Spent time` custom field
- `--work-items`: fetches time tracking work items via issue work items endpoint

### Linked issues mode

Examples:
- `ytissue AB-3941 --linked-issues`
- `ytissue AB-3941 --linked-issues --json`

Behavior:
- text mode filters out empty link groups
- json mode returns the same filtered link groups, with empty groups removed

### Fields mode

Examples:
- `ytissue AB-3941 --fields`
- `ytissue AB-3941 --field summary --field "Spent time"`
- `ytissue AB-3941 --field project --field tags --json`

Behavior:
- `--fields` lists the available issue field names
- output includes standard issue fields and custom field names separately
- `--field <name>` prints only the requested field value
- `--field` matching is case-insensitive
- repeated `--field` is supported
- `--json` with `--field` returns an object keyed by field name

### Attachments mode

Examples:
- `ytissue AB-3941 --attachments`
- `ytissue AB-3941 --attachments --json`
- `ytissue AB-3941 --download-attachment invoice.pdf`

Behavior:
- `--attachments` hits `GET /api/issues/{issueID}/attachments`
- default text mode prints attachment id, size, MIME type, author, and created timestamp
- `--brief`: `ID  FileName`
- `--json`: raw attachment array
- `--download-attachment <id-or-name>` downloads the matching attachment into the current working directory
- download matching accepts an exact attachment ID or exact file name
- download refuses ambiguous name matches
- download currently writes to cwd under the original attachment filename
- download currently uses exclusive file creation and does not overwrite existing files

### Projects mode

Examples:
- `ytissue --projects`
- `ytissue --projects --brief`
- `ytissue work --projects`

Behavior:
- `--projects` hits `GET /api/admin/projects`
- respects `--limit`
- default mode: `SHORTNAME | active|archived` plus project name
- `--brief`: `SHORTNAME  Name`
- `--json`: raw project array

## Config Management Commands

Examples:
- `ytissue config list-aliases`
- `ytissue config add-alias work --base-url https://youtrack.example.com --token '${YTISSUE_WORK_TOKEN}' --set-default`
- `ytissue config set-default work`
- `ytissue config remove-alias work`

Notes:
- config writing preserves placeholder values like `${YTISSUE_WORK_TOKEN}`
- `--set-default` works in two forms:
  - with `config add-alias ... --set-default`
  - standalone as `config set-default <alias>`

## Officially Useful Example Commands

```bash
ytissue AB-3941
ytissue AB-3941 --comments-only
ytissue AB-3941 --spent-time
ytissue AB-3941 --work-items
ytissue AB-3941 --linked-issues

ytissue --search "project: AB" --limit 20
ytissue --search "project: AB" --brief
ytissue --list --limit 20
ytissue --projects --limit 20

ytissue -bs "project: AB" -n 20
ytissue -lbn 20

ytissue config list-aliases
ytissue --config ./config.example.json config list-aliases
```

## Real-World Validation Notes

Several features were validated against real Billingo YouTrack data.

Reference issue used repeatedly:
- `AB-3941`

Observed on that issue:
- top-level assignee may be empty while `customFields.Assignee` is populated
- no comments on this issue at the time of validation
- no work items on this issue at the time of validation
- spent time is populated
- linked issues are populated

Validated behaviors:
- issue detail works
- assignee fallback works
- search works
- list works
- `--brief` works
- `--comments-only` works
- `--spent-time` works
- `--work-items` works
- `--linked-issues` works

Known concrete outputs from `AB-3941` at the time of testing:
- `--spent-time` returned `3d 4h 18m`
- `--comments-only` returned no comments
- `--work-items` returned no work items

## Known Gaps / Open Items

### 1. Release automation

Current state:
- the package is technically publish-ready
- manual npm publish currently requires a temporary granular token with `bypass 2FA`

Remaining issue:
- there is no Trusted Publishing setup yet
- release publishing is still a manual step

### 2. Local smoke workflow

Current state:
- `npm test` runs only the committed offline suite
- real-server checks are intentionally local-only
- `npm run test:smoke` runs ignored `test/*.smoke.test.mjs` files when they exist
- README and CONTRIBUTING both describe the smoke-test model

Remaining issue:
- smoke expectations remain environment-specific by design, so they should stay lightweight

### 3. Higher-level read-only features worth considering

These came up as plausible next read-oriented features and remain undecided:
- issue activity / history view, likely `--activity`
- saved searches / saved queries listing
- votes / voters view
- watchers view

These are ideas, not committed roadmap items.

### 4. Attachment UX follow-ups

Current implementation is intentionally minimal.

Still open:
- whether download should support an explicit output path
- whether attachment name matching should stay exact-only or allow friendlier selection
- whether batch download is worth supporting

## Practical Guidance For The Next Thread

If continuing development, recommended next priorities:
1. decide whether to keep manual npm publishing or add Trusted Publishing
2. consider higher-level history/activity views
3. revisit attachment UX follow-ups if they become painful in real usage

If the task is mainly documentation or onboarding:
- treat this file as the current source of truth for decisions and feature scope
- confirm `README.md` still matches the implemented behavior before further edits

## Maintenance Rule For This File

This file is intended to be a living document.

When updating it:
- prefer current truth over chronological history
- keep decisions and rationale, not every intermediate experiment
- keep the open-items list short and prioritized
- update validated behaviors when a real endpoint check changes assumptions

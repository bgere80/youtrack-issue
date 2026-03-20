import path from 'node:path';
import process from 'node:process';

export function printUsage() {
  console.log(`Usage: youtrack-issue [options] <ISSUE-ID>
       youtrack-issue [options] <ALIAS> <ISSUE-ID>

Options:
  --brief             Compact output for list/search results
  --json              Print raw JSON response
  --comments          Include issue comments
  --comments-only     Print only issue comments
  --linked-issues     Print only linked issues
  --spent-time        Print only issue spent time
  --work-items        Print only issue work items
  -a, --alias <name>  Use a configured global alias
  --add-alias <name>  Add or update an alias in the config file
  -c, --config <path> Load aliases from a specific JSON config file
  --remove-alias <name>
                      Remove an alias from the config file
  --token <value>     Token value for --add-alias
  --set-default [name]
                      Set defaultAlias, or use with --add-alias
  --list              List issues (queryless, limited by --limit)
  --list-aliases      List configured aliases and exit
  --search <query>    Search issues matching a query
  --limit <n>         Limit results for list/search (default: 20)
  --base-url <url>    Override YouTrack base URL
  -h, --help          Show this help

Config sources:
  1. CLI flags
  2. Config path: --config, YTISSUE_CONFIG, ~/.config/youtrack-issue/config.json
  3. Environment variables: YTISSUE_TOKEN, YTISSUE_BASE_URL
  4. ~/.config/youtrack-issue/config.env`);
}

export function isDirectNodeScriptInvocation(scriptArg = process.argv[1] || '') {
  if (!scriptArg) {
    return false;
  }

  const normalized = path.normalize(scriptArg);
  return normalized.endsWith(path.normalize('/bin/ytissue.mjs'));
}

export function validateAliasName(alias) {
  if (!alias) {
    return;
  }

  if (alias.startsWith('-')) {
    console.error(`Invalid alias: ${alias}`);
    printUsage();
    process.exit(1);
  }
}

export function parseArgs(argv) {
  const options = {
    addAlias: '',
    alias: '',
    brief: false,
    comments: false,
    commentsOnly: false,
    command: 'issue',
    configPath: '',
    query: '',
    json: false,
    linkedIssues: false,
    listRequested: false,
    listAliases: false,
    limit: 20,
    removeAlias: '',
    baseUrl: '',
    searchQuery: '',
    issueId: '',
    setDefaultAlias: '',
    setDefaultRequested: false,
    spentTime: false,
    token: '',
    workItems: false
  };
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg === '--brief') {
      options.brief = true;
      continue;
    }

    if (arg === '--comments') {
      options.comments = true;
      continue;
    }

    if (arg === '--comments-only') {
      options.commentsOnly = true;
      continue;
    }

    if (arg === '--linked-issues') {
      options.linkedIssues = true;
      continue;
    }

    if (arg === '--spent-time') {
      options.spentTime = true;
      continue;
    }

    if (arg === '--work-items') {
      options.workItems = true;
      continue;
    }

    if (arg === '--add-alias') {
      const value = argv[index + 1];
      if (!value) {
        console.error('Missing value for --add-alias.');
        process.exit(1);
      }

      options.addAlias = value;
      index += 1;
      continue;
    }

    if (arg === '--list-aliases') {
      options.listAliases = true;
      continue;
    }

    if (arg === '--list') {
      options.listRequested = true;
      continue;
    }

    if (arg === '--limit') {
      const value = argv[index + 1];
      if (!value) {
        console.error('Missing value for --limit.');
        process.exit(1);
      }

      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        console.error('Invalid value for --limit.');
        process.exit(1);
      }

      options.limit = parsed;
      index += 1;
      continue;
    }

    if (arg === '--remove-alias') {
      const value = argv[index + 1];
      if (!value) {
        console.error('Missing value for --remove-alias.');
        process.exit(1);
      }

      options.removeAlias = value;
      index += 1;
      continue;
    }

    if (arg === '--alias' || arg === '-a') {
      const value = argv[index + 1];
      if (!value) {
        console.error('Missing value for --alias.');
        process.exit(1);
      }

      options.alias = value;
      index += 1;
      continue;
    }

    if (arg === '--config' || arg === '-c') {
      const value = argv[index + 1];
      if (!value) {
        console.error('Missing value for --config.');
        process.exit(1);
      }

      options.configPath = value;
      index += 1;
      continue;
    }

    if (arg === '--token') {
      const value = argv[index + 1];
      if (!value) {
        console.error('Missing value for --token.');
        process.exit(1);
      }

      options.token = value;
      index += 1;
      continue;
    }

    if (arg === '--set-default') {
      options.setDefaultRequested = true;

      const value = argv[index + 1];
      if (value && !value.startsWith('-')) {
        options.setDefaultAlias = value;
        index += 1;
      }

      continue;
    }

    if (arg === '--search') {
      const value = argv[index + 1];
      if (!value) {
        console.error('Missing value for --search.');
        process.exit(1);
      }

      options.searchQuery = value;
      index += 1;
      continue;
    }

    if (arg === '--base-url') {
      const value = argv[index + 1];
      if (!value) {
        console.error('Missing value for --base-url.');
        process.exit(1);
      }

      options.baseUrl = value;
      index += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`);
      printUsage();
      process.exit(1);
    }

    positionals.push(arg);
  }

  if (options.listRequested && options.searchQuery) {
    console.error('Use only one of --list or --search.');
    process.exit(1);
  }

  if (options.listRequested) {
    options.command = 'list';
  }

  if (options.searchQuery) {
    options.command = 'search';
    options.query = options.searchQuery;
  }

  if (positionals.length === 1) {
    options.issueId = positionals[0];
    return options;
  }

  if (positionals.length === 2 && !options.alias) {
    [options.alias, options.issueId] = positionals;
    return options;
  }

  if (positionals.length === 1 && options.alias) {
    options.issueId = positionals[0];
    return options;
  }

  if (positionals.length === 2 && options.alias) {
    console.error('Issue ID can only be provided once when --alias is used.');
    printUsage();
    process.exit(1);
  }

  if (positionals.length > 2) {
    console.error('Too many positional arguments.');
    printUsage();
    process.exit(1);
  }

  if (positionals.length === 0) {
    return options;
  }

  if (options.issueId) {
    console.error('Only one issue ID can be provided.');
    printUsage();
    process.exit(1);
  }

  if (positionals.length > 0) {
    console.error('Invalid arguments.');
    printUsage();
    process.exit(1);
  }

  return options;
}

export function validateConfigMutationOptions(options) {
  const mutationCount = Number(Boolean(options.addAlias)) + Number(Boolean(options.removeAlias));
  if (mutationCount > 1 || (mutationCount > 0 && options.setDefaultAlias)) {
    console.error('Use only one config mutation at a time.');
    process.exit(1);
  }

  if (options.addAlias) {
    validateAliasName(options.addAlias);
    if (!options.baseUrl || !options.token) {
      console.error('--add-alias requires both --base-url and --token.');
      process.exit(1);
    }
  }

  if (options.setDefaultAlias) {
    validateAliasName(options.setDefaultAlias);
    if (options.baseUrl || options.token) {
      console.error('--set-default <name> cannot be combined with --base-url or --token.');
      process.exit(1);
    }
  }

  if (options.removeAlias) {
    validateAliasName(options.removeAlias);
    if (options.baseUrl || options.token || options.setDefaultRequested) {
      console.error('--remove-alias cannot be combined with --base-url, --token, or --set-default.');
      process.exit(1);
    }
  }

  if (options.setDefaultRequested && !options.addAlias && !options.setDefaultAlias) {
    console.error('--set-default without a name can only be used with --add-alias.');
    process.exit(1);
  }
}

export function validateQueryOptions(options) {
  if (options.command === 'search' && !options.query) {
    console.error('search requires a query.');
    process.exit(1);
  }

  if ((options.command === 'list' || options.command === 'search') && (options.comments || options.commentsOnly || options.linkedIssues || options.spentTime || options.workItems)) {
    console.error('--comments, --comments-only, --linked-issues, --spent-time, and --work-items are only supported for single-issue lookup.');
    process.exit(1);
  }

  if (options.comments && options.commentsOnly) {
    console.error('Use only one of --comments or --comments-only.');
    process.exit(1);
  }

  if ((options.comments || options.commentsOnly) && (options.linkedIssues || options.spentTime || options.workItems)) {
    console.error('Use only one of --comments, --comments-only, --linked-issues, --spent-time, or --work-items.');
    process.exit(1);
  }

  if (options.linkedIssues && (options.spentTime || options.workItems)) {
    console.error('Use only one of --linked-issues, --spent-time, or --work-items.');
    process.exit(1);
  }

  if (options.spentTime && options.workItems) {
    console.error('Use only one of --spent-time or --work-items.');
    process.exit(1);
  }
}

import path from 'node:path';
import process from 'node:process';
import { Command, InvalidArgumentError } from 'commander';

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError('Invalid value for --limit.');
  }

  return parsed;
}

function createProgram() {
  return new Command()
    .name('youtrack-issue')
    .usage('[options] <ISSUE-ID>\n       youtrack-issue [options] <ALIAS> <ISSUE-ID>')
    .argument('[first]')
    .argument('[second]')
    .option('-b, --brief', 'Compact output for list/search results')
    .option('-j, --json', 'Print raw JSON response')
    .option('--comments', 'Include issue comments')
    .option('--comments-only', 'Print only issue comments')
    .option('--linked-issues', 'Print only linked issues')
    .option('--spent-time', 'Print only issue spent time')
    .option('--work-items', 'Print only issue work items')
    .option('-a, --alias <name>', 'Use a configured global alias')
    .option('--add-alias <name>', 'Add or update an alias in the config file')
    .option('-c, --config <path>', 'Load aliases from a specific JSON config file')
    .option('--remove-alias <name>', 'Remove an alias from the config file')
    .option('--token <value>', 'Token value for --add-alias')
    .option('--set-default [name]', 'Set defaultAlias, or use with --add-alias')
    .option('-l, --list', 'List issues (queryless, limited by --limit)')
    .option('--list-aliases', 'List configured aliases and exit')
    .option('-s, --search <query>', 'Search issues matching a query')
    .option('-n, --limit <n>', 'Limit results for list/search', parsePositiveInteger, 20)
    .option('--base-url <url>', 'Override YouTrack base URL')
    .addHelpText(
      'after',
      '\nConfig sources:\n'
      + '  1. CLI flags\n'
      + '  2. Config path: --config, YTISSUE_CONFIG, ~/.config/youtrack-issue/config.json\n'
      + '  3. Environment variables: YTISSUE_TOKEN, YTISSUE_BASE_URL\n'
      + '  4. ~/.config/youtrack-issue/config.env\n'
    );
}

export function getHelpText() {
  const program = createProgram();
  let output = '';
  program.configureOutput({
    writeOut: (str) => {
      output += str;
    },
    writeErr: (str) => {
      output += str;
    }
  });
  program.outputHelp();
  return output;
}

export function printUsage() {
  process.stdout.write(getHelpText());
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
  const program = createProgram();
  program.parse(argv, { from: 'user' });

  const parsedOptions = program.opts();
  const positionals = program.args;
  const options = {
    addAlias: parsedOptions.addAlias || '',
    alias: parsedOptions.alias || '',
    brief: Boolean(parsedOptions.brief),
    comments: Boolean(parsedOptions.comments),
    commentsOnly: Boolean(parsedOptions.commentsOnly),
    command: 'issue',
    configPath: parsedOptions.config || '',
    query: '',
    json: Boolean(parsedOptions.json),
    linkedIssues: Boolean(parsedOptions.linkedIssues),
    listRequested: Boolean(parsedOptions.list),
    listAliases: Boolean(parsedOptions.listAliases),
    limit: parsedOptions.limit,
    removeAlias: parsedOptions.removeAlias || '',
    baseUrl: parsedOptions.baseUrl || '',
    searchQuery: parsedOptions.search || '',
    issueId: '',
    setDefaultAlias: typeof parsedOptions.setDefault === 'string' ? parsedOptions.setDefault : '',
    setDefaultRequested: parsedOptions.setDefault !== undefined,
    spentTime: Boolean(parsedOptions.spentTime),
    token: parsedOptions.token || '',
    workItems: Boolean(parsedOptions.workItems)
  };

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

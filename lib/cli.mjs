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
    .option('-b, --brief', 'Compact output for list/search/projects results')
    .option('-j, --json', 'Print raw JSON response')
    .option('--comments', 'Include issue comments')
    .option('--comments-only', 'Print only issue comments')
    .option('--linked-issues', 'Print only linked issues')
    .option('--spent-time', 'Print only issue spent time')
    .option('--work-items', 'Print only issue work items')
    .option('-p, --projects', 'List accessible projects')
    .option('-a, --alias <name>', 'Use a configured global alias')
    .option('-c, --config <path>', 'Load aliases from a specific JSON config file')
    .option('-l, --list', 'List issues (queryless, limited by --limit)')
    .option('-s, --search <query>', 'Search issues matching a query')
    .option('-n, --limit <n>', 'Limit results for list/search/projects', parsePositiveInteger, 20)
    .option('--base-url <url>', 'Override YouTrack base URL')
    .addHelpText(
      'after',
      '\nCommands:\n'
      + '  config                  Manage aliases and default config\n'
      + '\nConfig sources:\n'
      + '  1. CLI flags\n'
      + '  2. Config path: --config, YTISSUE_CONFIG, ~/.config/youtrack-issue/config.json\n'
      + '  3. Environment variables: YTISSUE_TOKEN, YTISSUE_BASE_URL\n'
      + '  4. ~/.config/youtrack-issue/config.env\n'
    );
}

function createConfigProgram() {
  const program = new Command()
    .name('youtrack-issue config')
    .usage('[options] <command>')
    .option('-c, --config <path>', 'Load aliases from a specific JSON config file')
    .showHelpAfterError();

  program
    .command('list-aliases')
    .description('List configured aliases');

  program
    .command('add-alias <name>')
    .description('Add or update an alias in the config file')
    .requiredOption('--base-url <url>', 'Base URL for the alias')
    .requiredOption('--token <value>', 'Token value for the alias')
    .option('--set-default', 'Set the added alias as default');

  program
    .command('set-default <name>')
    .description('Set defaultAlias');

  program
    .command('remove-alias <name>')
    .description('Remove an alias from the config file');

  return program;
}

function findFirstNonOptionToken(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--') {
      return argv[index + 1] || '';
    }

    if (arg === '-a' || arg === '--alias' || arg === '-c' || arg === '--config' || arg === '-s' || arg === '--search' || arg === '-n' || arg === '--limit' || arg === '--base-url') {
      index += 1;
      continue;
    }

    if (arg === '--add-alias' || arg === '--remove-alias' || arg === '--token') {
      index += 1;
      continue;
    }

    if (arg === '--set-default') {
      const next = argv[index + 1];
      if (next && !next.startsWith('-')) {
        index += 1;
      }
      continue;
    }

    if (!arg.startsWith('-')) {
      return arg;
    }
  }

  return '';
}

function stripConfigNamespace(argv) {
  const configIndex = argv.findIndex((arg) => arg === 'config');
  if (configIndex === -1) {
    return argv;
  }

  return [...argv.slice(0, configIndex), ...argv.slice(configIndex + 1)];
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

export function printConfigUsage() {
  const program = createConfigProgram();
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
  process.stdout.write(output);
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
  if (findFirstNonOptionToken(argv) === 'config') {
    return parseConfigArgs(stripConfigNamespace(argv));
  }

  const program = createProgram();
  program.parse(argv, { from: 'user' });

  const parsedOptions = program.opts();
  const positionals = program.args;
  const options = {
    mode: 'issue',
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
    listAliases: false,
    limit: parsedOptions.limit,
    projects: Boolean(parsedOptions.projects),
    removeAlias: '',
    baseUrl: parsedOptions.baseUrl || '',
    searchQuery: parsedOptions.search || '',
    issueId: '',
    setDefaultAlias: '',
    setDefaultRequested: false,
    spentTime: Boolean(parsedOptions.spentTime),
    token: '',
    workItems: Boolean(parsedOptions.workItems)
  };

  if (options.listRequested && options.searchQuery) {
    console.error('Use only one of --list or --search.');
    process.exit(1);
  }

  if (options.projects && (options.listRequested || options.searchQuery)) {
    console.error('Use only one of --projects, --list, or --search.');
    process.exit(1);
  }

  if (options.listRequested) {
    options.command = 'list';
  }

  if (options.searchQuery) {
    options.command = 'search';
    options.query = options.searchQuery;
  }

  if (options.projects) {
    options.command = 'projects';
  }

  if (options.command !== 'issue') {
    if (positionals.length === 0) {
      return options;
    }

    if (positionals.length === 1 && !options.alias) {
      options.alias = positionals[0];
      return options;
    }

    if (positionals.length === 1 && options.alias) {
      console.error('Alias can only be provided once when --alias is used.');
      printUsage();
      process.exit(1);
    }

    console.error('Too many positional arguments.');
    printUsage();
    process.exit(1);
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

function parseConfigArgs(argv) {
  const program = createConfigProgram();
  const result = {
    mode: 'config',
    command: 'config',
    configPath: '',
    configCommand: '',
    addAlias: '',
    removeAlias: '',
    setDefaultAlias: '',
    setDefaultRequested: false,
    baseUrl: '',
    token: '',
    listAliases: false
  };

  for (const command of program.commands) {
    command.action((nameOrCmd, maybeOptions, maybeCmd) => {
      const cmd = typeof maybeCmd?.opts === 'function'
        ? maybeCmd
        : typeof maybeOptions?.opts === 'function'
          ? maybeOptions
          : null;
      const commandOptions = cmd ? cmd.opts() : {};
      result.configCommand = command.name();
      result.configPath = program.opts().config || '';

      if (command.name() === 'list-aliases') {
        result.listAliases = true;
        return;
      }

      if (command.name() === 'add-alias') {
        result.addAlias = nameOrCmd;
        result.baseUrl = commandOptions.baseUrl || '';
        result.token = commandOptions.token || '';
        result.setDefaultRequested = Boolean(commandOptions.setDefault);
        return;
      }

      if (command.name() === 'set-default') {
        result.setDefaultAlias = nameOrCmd;
        result.setDefaultRequested = true;
        return;
      }

      if (command.name() === 'remove-alias') {
        result.removeAlias = nameOrCmd;
      }
    });
  }

  program.parse(argv, { from: 'user' });

  if (!result.configCommand) {
    printConfigUsage();
    process.exit(1);
  }

  return result;
}

export function validateConfigMutationOptions(options) {
  if (options.mode !== 'config') {
    return;
  }

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
  if (options.mode === 'config') {
    return;
  }

  if (options.command === 'search' && !options.query) {
    console.error('search requires a query.');
    process.exit(1);
  }

  if ((options.command === 'list' || options.command === 'search' || options.command === 'projects') && (options.comments || options.commentsOnly || options.linkedIssues || options.spentTime || options.workItems)) {
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

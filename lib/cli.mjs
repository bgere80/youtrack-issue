import path from 'node:path';
import process from 'node:process';
import { Command, InvalidArgumentError } from 'commander';

function collectOptionValues(value, previous) {
  const values = Array.isArray(value) ? value : [value];
  return [...(previous || []), ...values];
}

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError('Invalid value for --limit.');
  }

  return parsed;
}

function countEnabledOutputTargets(options) {
  return Number(Boolean(options.outputPath)) + Number(Boolean(options.stdout));
}

function createProgram() {
  return new Command()
    .name('youtrack-issue')
    .usage('[options] <ISSUE-ID>\n       youtrack-issue [options] <PROFILE> <ISSUE-ID>')
    .argument('[first]')
    .argument('[second]')
    .option('-b, --brief', 'Compact output for list/search/projects results')
    .option('-j, --json', 'Print raw JSON response')
    .option('--attachments', 'Print issue attachments')
    .option('--comments', 'Include issue comments')
    .option('--comments-only', 'Print only issue comments')
    .option('--attachment-info <idOrName>', 'Print metadata for a specific issue attachment by ID or exact file name')
    .option('--download-attachment <idOrName>', 'Download a specific issue attachment by ID or exact file name')
    .option('-o, --output <path>', 'Write generated file output to the given path')
    .option('--stdout', 'Write generated file output to standard output')
    .option('--fields', 'List available issue fields, including custom fields')
    .option('-f, --field <name...>', 'Print only the specified issue field value; accepts multiple names', collectOptionValues)
    .option('--linked-issues', 'Print only linked issues')
    .option('--spent-time', 'Print only issue spent time')
    .option('--work-items', 'Print only issue work items')
    .option('-p, --projects', 'List accessible projects')
    .option('--alias <name>', 'Deprecated alias for --profile')
    .option('--profile <name>', 'Use a configured global profile')
    .option('-c, --config <path>', 'Load profiles from a specific JSON config file')
    .option('-l, --list', 'List issues (queryless, limited by --limit)')
    .option('-s, --search <query>', 'Search issues matching a query')
    .option('-n, --limit <n>', 'Limit results for list/search/projects', parsePositiveInteger, 20)
    .option('--base-url <url>', 'Override YouTrack base URL')
    .addHelpText(
      'after',
      '\nCommands:\n'
      + '  config                  Manage profiles and default config\n'
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
    .option('-c, --config <path>', 'Load profiles from a specific JSON config file')
    .showHelpAfterError();

  program
    .command('list-profiles')
    .description('List configured profiles');

  program
    .command('list-aliases')
    .description('Deprecated alias for list-profiles');

  program
    .command('add-profile <name>')
    .description('Add or update a profile in the config file')
    .requiredOption('--base-url <url>', 'Base URL for the profile')
    .requiredOption('--token <value>', 'Token value for the profile')
    .option('--set-default', 'Set the added profile as default');

  program
    .command('add-alias <name>')
    .description('Deprecated alias for add-profile')
    .requiredOption('--base-url <url>', 'Base URL for the profile')
    .requiredOption('--token <value>', 'Token value for the profile')
    .option('--set-default', 'Set the added profile as default');

  program
    .command('set-default <name>')
    .description('Set defaultProfile');

  program
    .command('remove-profile <name>')
    .description('Remove a profile from the config file');

  program
    .command('remove-alias <name>')
    .description('Deprecated alias for remove-profile');

  return program;
}

function findFirstNonOptionToken(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--') {
      return argv[index + 1] || '';
    }

    if (arg === '-f' || arg === '--field') {
      while (argv[index + 1] && !argv[index + 1].startsWith('-')) {
        index += 1;
      }
      continue;
    }

    if (arg === '--profile' || arg === '--alias' || arg === '-c' || arg === '--config' || arg === '-s' || arg === '--search' || arg === '-n' || arg === '--limit' || arg === '--base-url' || arg === '--attachment-info' || arg === '--download-attachment' || arg === '--output' || arg === '-o') {
      index += 1;
      continue;
    }

    if (arg === '--add-profile' || arg === '--remove-profile' || arg === '--token') {
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

export function validateProfileName(profile) {
  if (!profile) {
    return;
  }

  if (profile.startsWith('-')) {
    console.error(`Invalid profile: ${profile}`);
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
    addProfile: parsedOptions.addProfile || '',
    attachmentInfo: parsedOptions.attachmentInfo || '',
    profile: parsedOptions.profile || parsedOptions.alias || '',
    attachments: Boolean(parsedOptions.attachments),
    brief: Boolean(parsedOptions.brief),
    comments: Boolean(parsedOptions.comments),
    commentsOnly: Boolean(parsedOptions.commentsOnly),
    command: 'issue',
    configPath: parsedOptions.config || '',
    downloadAttachment: parsedOptions.downloadAttachment || '',
    outputPath: parsedOptions.output || '',
    fieldNames: parsedOptions.field || [],
    fieldsRequested: Boolean(parsedOptions.fields),
    query: '',
    json: Boolean(parsedOptions.json),
    linkedIssues: Boolean(parsedOptions.linkedIssues),
    listRequested: Boolean(parsedOptions.list),
    listProfiles: false,
    limit: parsedOptions.limit,
    projects: Boolean(parsedOptions.projects),
    removeProfile: '',
    baseUrl: parsedOptions.baseUrl || '',
    searchQuery: parsedOptions.search || '',
    issueId: '',
    setDefaultProfile: '',
    setDefaultRequested: false,
    stdout: Boolean(parsedOptions.stdout),
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

  if (options.projects && (options.fieldsRequested || options.fieldNames.length > 0)) {
    console.error('Use only one of --projects and --fields/--field.');
    process.exit(1);
  }

  if ((options.listRequested || options.searchQuery) && (options.fieldsRequested || options.fieldNames.length > 0)) {
    console.error('--fields and --field are only supported for single-issue lookup.');
    process.exit(1);
  }

  if ((options.listRequested || options.searchQuery || options.projects) && (options.attachments || options.attachmentInfo || options.downloadAttachment)) {
    console.error('--attachments, --attachment-info, and --download-attachment are only supported for single-issue lookup.');
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

  if (options.fieldsRequested || options.fieldNames.length > 0) {
    options.command = 'fields';
  }

  if (options.attachments || options.attachmentInfo || options.downloadAttachment) {
    options.command = 'attachments';
  }

  if (options.command === 'list' || options.command === 'search' || options.command === 'projects') {
    if (positionals.length === 0) {
      return options;
    }

    if (positionals.length === 1 && !options.profile) {
      options.profile = positionals[0];
      return options;
    }

    if (positionals.length === 1 && options.profile) {
      console.error('Profile can only be provided once when --profile is used.');
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

  if (positionals.length === 2 && !options.profile) {
    [options.profile, options.issueId] = positionals;
    return options;
  }

  if (positionals.length === 1 && options.profile) {
    options.issueId = positionals[0];
    return options;
  }

  if (positionals.length === 2 && options.profile) {
    console.error('Issue ID can only be provided once when --profile is used.');
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
    addProfile: '',
    removeProfile: '',
    setDefaultProfile: '',
    setDefaultRequested: false,
    baseUrl: '',
    token: '',
    listProfiles: false
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

      if (command.name() === 'list-profiles' || command.name() === 'list-aliases') {
        result.listProfiles = true;
        return;
      }

      if (command.name() === 'add-profile' || command.name() === 'add-alias') {
        result.addProfile = nameOrCmd;
        result.baseUrl = commandOptions.baseUrl || '';
        result.token = commandOptions.token || '';
        result.setDefaultRequested = Boolean(commandOptions.setDefault);
        return;
      }

      if (command.name() === 'set-default') {
        result.setDefaultProfile = nameOrCmd;
        result.setDefaultRequested = true;
        return;
      }

      if (command.name() === 'remove-profile' || command.name() === 'remove-alias') {
        result.removeProfile = nameOrCmd;
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

  const mutationCount = Number(Boolean(options.addProfile)) + Number(Boolean(options.removeProfile));
  if (mutationCount > 1 || (mutationCount > 0 && options.setDefaultProfile)) {
    console.error('Use only one config mutation at a time.');
    process.exit(1);
  }

  if (options.addProfile) {
    validateProfileName(options.addProfile);
    if (!options.baseUrl || !options.token) {
      console.error('--add-profile requires both --base-url and --token.');
      process.exit(1);
    }
  }

  if (options.setDefaultProfile) {
    validateProfileName(options.setDefaultProfile);
    if (options.baseUrl || options.token) {
      console.error('--set-default <name> cannot be combined with --base-url or --token.');
      process.exit(1);
    }
  }

  if (options.removeProfile) {
    validateProfileName(options.removeProfile);
    if (options.baseUrl || options.token || options.setDefaultRequested) {
      console.error('--remove-profile cannot be combined with --base-url, --token, or --set-default.');
      process.exit(1);
    }
  }

  if (options.setDefaultRequested && !options.addProfile && !options.setDefaultProfile) {
    console.error('--set-default without a name can only be used with --add-profile.');
    process.exit(1);
  }
}

export function validateQueryOptions(options) {
  if (options.mode === 'config') {
    return;
  }

  if (options.command === 'fields' && !options.issueId) {
    console.error('fields mode requires an issue ID.');
    process.exit(1);
  }

  if (options.command === 'attachments' && !options.issueId) {
    console.error('attachments mode requires an issue ID.');
    process.exit(1);
  }

  if (options.command === 'search' && !options.query) {
    console.error('search requires a query.');
    process.exit(1);
  }

  if ((options.command === 'list' || options.command === 'search' || options.command === 'projects') && (options.attachments || options.comments || options.commentsOnly || options.downloadAttachment || options.fieldsRequested || options.fieldNames.length > 0 || options.linkedIssues || options.spentTime || options.workItems)) {
    console.error('--attachments, --comments, --comments-only, --download-attachment, --fields, --field, --linked-issues, --spent-time, and --work-items are only supported for single-issue lookup.');
    process.exit(1);
  }

  if (options.comments && options.commentsOnly) {
    console.error('Use only one of --comments or --comments-only.');
    process.exit(1);
  }

  const attachmentModeCount = Number(Boolean(options.attachments))
    + Number(Boolean(options.attachmentInfo))
    + Number(Boolean(options.downloadAttachment));
  if (attachmentModeCount > 1) {
    console.error('Use only one of --attachments, --attachment-info, or --download-attachment.');
    process.exit(1);
  }

  if (countEnabledOutputTargets(options) > 1) {
    console.error('Use only one output target at a time.');
    process.exit(1);
  }

  if (!options.downloadAttachment && countEnabledOutputTargets(options) > 0) {
    console.error('--output and --stdout are only supported with --download-attachment.');
    process.exit(1);
  }

  if (options.downloadAttachment && countEnabledOutputTargets(options) === 0) {
    console.error('--download-attachment requires either --output <path> or --stdout.');
    process.exit(1);
  }

  if ((options.comments || options.commentsOnly) && (options.attachments || options.downloadAttachment || options.fieldsRequested || options.fieldNames.length > 0 || options.linkedIssues || options.spentTime || options.workItems)) {
    console.error('Use only one of --comments, --comments-only, --attachments/--download-attachment, --fields/--field, --linked-issues, --spent-time, or --work-items.');
    process.exit(1);
  }

  if ((options.fieldsRequested || options.fieldNames.length > 0) && (options.attachments || options.downloadAttachment || options.linkedIssues || options.spentTime || options.workItems)) {
    console.error('Use only one of --fields/--field, --attachments/--download-attachment, --linked-issues, --spent-time, or --work-items.');
    process.exit(1);
  }

  if ((options.attachments || options.downloadAttachment) && (options.linkedIssues || options.spentTime || options.workItems)) {
    console.error('Use only one of --attachments/--download-attachment, --linked-issues, --spent-time, or --work-items.');
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

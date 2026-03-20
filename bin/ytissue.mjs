#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_BASE_URL = 'https://youtrack.billingo.com';
const args = process.argv.slice(2);

function printUsage() {
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

function isDirectNodeScriptInvocation() {
  const scriptArg = process.argv[1] || '';
  if (!scriptArg) {
    return false;
  }

  const normalized = path.normalize(scriptArg);
  return normalized.endsWith(path.normalize('/bin/ytissue.mjs'));
}

function parseArgs(argv) {
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

async function readTextFileIfExists(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function loadJsonFile(filePath) {
  const content = await readTextFileIfExists(filePath);
  if (content == null) {
    return {};
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function interpolateEnvValue(value) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(/\$\{([A-Z0-9_]+)\}/gu, (_, variableName) => process.env[variableName] ?? '');
}

function interpolateEnvInObject(value) {
  if (Array.isArray(value)) {
    return value.map(interpolateEnvInObject);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, interpolateEnvInObject(nestedValue)])
    );
  }

  return interpolateEnvValue(value);
}

async function loadRawAliasConfig(filePath) {
  const config = await loadJsonFile(filePath);
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`Invalid config object in ${filePath}`);
  }

  return config;
}

function getConfigDir() {
  return path.join(os.homedir(), '.config', 'youtrack-issue');
}

async function loadGlobalAliasConfig() {
  const config = await loadRawAliasConfig(path.join(getConfigDir(), 'config.json'));
  return interpolateEnvInObject(config);
}

async function loadAliasConfigFromPath(configPath) {
  const config = await loadRawAliasConfig(path.resolve(configPath));
  return interpolateEnvInObject(config);
}

function resolveAliasConfigPath(options, fileConfig = {}) {
  if (options.configPath) {
    return path.resolve(options.configPath);
  }

  if (process.env.YTISSUE_CONFIG) {
    return path.resolve(process.env.YTISSUE_CONFIG);
  }

  if (fileConfig.YTISSUE_CONFIG) {
    return path.resolve(fileConfig.YTISSUE_CONFIG);
  }

  return path.join(getConfigDir(), 'config.json');
}

function resolveAliasConfig(globalConfig, alias) {
  if (!alias) {
    return null;
  }

  const aliases = globalConfig?.aliases;
  if (!aliases || typeof aliases !== 'object' || Array.isArray(aliases)) {
    return null;
  }

  const aliasConfig = aliases[alias];
  if (!aliasConfig || typeof aliasConfig !== 'object' || Array.isArray(aliasConfig)) {
    return null;
  }

  return aliasConfig;
}

function resolveDefaultAlias(globalConfig) {
  const defaultAlias = globalConfig?.defaultAlias;
  return typeof defaultAlias === 'string' && defaultAlias.trim() ? defaultAlias.trim() : '';
}

function getAliasEntries(globalConfig) {
  const aliases = globalConfig?.aliases;
  if (!aliases || typeof aliases !== 'object' || Array.isArray(aliases)) {
    return [];
  }

  return Object.entries(aliases).filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value));
}

function printAliases(globalConfig, configPath) {
  const aliasEntries = getAliasEntries(globalConfig);
  const defaultAlias = resolveDefaultAlias(globalConfig);

  console.log(`Config: ${configPath}`);
  if (aliasEntries.length === 0) {
    console.log('No aliases configured.');
    return;
  }

  console.log('Aliases:');
  for (const [name, config] of aliasEntries) {
    const marker = name === defaultAlias ? ' (default)' : '';
    const baseUrl = typeof config.baseUrl === 'string' && config.baseUrl ? config.baseUrl : '-';
    console.log(`- ${name}${marker}: ${baseUrl}`);
  }
}

function ensureAliasContainer(config) {
  if (!config.aliases || typeof config.aliases !== 'object' || Array.isArray(config.aliases)) {
    config.aliases = {};
  }

  return config.aliases;
}

async function saveAliasConfig(configPath, config) {
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function validateConfigMutationOptions(options) {
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

function validateQueryOptions(options) {
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

async function addAliasToConfig(configPath, options) {
  const config = await loadRawAliasConfig(configPath);
  const aliases = ensureAliasContainer(config);

  aliases[options.addAlias] = {
    baseUrl: options.baseUrl,
    token: options.token
  };

  if (options.setDefaultRequested) {
    config.defaultAlias = options.addAlias;
  }

  await saveAliasConfig(configPath, config);

  console.log(`Saved alias '${options.addAlias}' to ${configPath}`);
  if (options.setDefaultRequested) {
    console.log(`Default alias set to '${options.addAlias}'.`);
  }
}

async function removeAliasFromConfig(configPath, options) {
  const config = await loadRawAliasConfig(configPath);
  const aliases = ensureAliasContainer(config);

  if (!aliases[options.removeAlias]) {
    console.error(`Alias not found: ${options.removeAlias}`);
    process.exit(1);
  }

  delete aliases[options.removeAlias];

  if (config.defaultAlias === options.removeAlias) {
    delete config.defaultAlias;
  }

  await saveAliasConfig(configPath, config);
  console.log(`Removed alias '${options.removeAlias}' from ${configPath}`);
}

async function setDefaultAliasInConfig(configPath, options) {
  const config = await loadRawAliasConfig(configPath);
  const aliases = ensureAliasContainer(config);

  if (!aliases[options.setDefaultAlias]) {
    console.error(`Alias not found: ${options.setDefaultAlias}`);
    process.exit(1);
  }

  config.defaultAlias = options.setDefaultAlias;
  await saveAliasConfig(configPath, config);
  console.log(`Default alias set to '${options.setDefaultAlias}' in ${configPath}`);
}

function exitUnknownAlias(alias, globalConfigPath) {
  console.error(`Unknown alias: ${alias}`);
  console.error(`Define it under ${globalConfigPath}`);
  process.exit(1);
}

function validateAliasName(alias) {
  if (!alias) {
    return;
  }

  if (alias.startsWith('-')) {
    console.error(`Invalid alias: ${alias}`);
    printUsage();
    process.exit(1);
  }
}

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseEnvFile(content) {
  const values = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim());

    if (key) {
      values[key] = value;
    }
  }

  return values;
}

async function loadConfig() {
  const fileConfigs = [];

  if (isDirectNodeScriptInvocation()) {
    fileConfigs.push(
      path.join(process.cwd(), '.env'),
      path.join(process.cwd(), '.env.local')
    );
  }

  fileConfigs.push(path.join(getConfigDir(), 'config.env'));

  const config = {};

  for (const filePath of fileConfigs) {
    const content = await readTextFileIfExists(filePath);
    if (content != null) {
      Object.assign(config, parseEnvFile(content));
    }
  }

  return config;
}

const fields = [
  'idReadable',
  'summary',
  'description',
  'created',
  'updated',
  'resolved',
  'project(name,shortName)',
  'reporter(login,name,fullName)',
  'assignee(login,name,fullName)',
  'tags(name)',
  'links(direction,linkType(name,localizedName),issues(idReadable,summary))',
  'customFields(name,value(name,login,fullName,text,presentation,color(id),minutes))'
].join(',');

const listFields = [
  'idReadable',
  'summary',
  'updated',
  'project(name,shortName)',
  'assignee(login,name,fullName)',
  'customFields(name,value(name,login,fullName,text,presentation,minutes))'
].join(',');

const ANSI = {
  reset: '\u001B[0m',
  green: '\u001B[32m',
  yellow: '\u001B[33m',
  blue: '\u001B[34m',
  red: '\u001B[31m',
  gray: '\u001B[90m'
};

function formatDate(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toISOString();
}

function supportsColor() {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function colorize(text, color) {
  if (!supportsColor() || !color) {
    return text;
  }

  return `${color}${text}${ANSI.reset}`;
}

function formatUser(user) {
  if (!user) {
    return '-';
  }

  return user.fullName || user.name || user.login || '-';
}

function formatFieldValue(value) {
  if (value == null) {
    return '-';
  }

  if (Array.isArray(value)) {
    return value.map(formatFieldValue).join(', ');
  }

  if (typeof value === 'object') {
    return value.presentation || value.fullName || value.name || value.login || value.text || value.minutes || JSON.stringify(value);
  }

  return String(value);
}

function findCustomField(issue, fieldName) {
  if (!Array.isArray(issue.customFields)) {
    return null;
  }

  return issue.customFields.find((field) => field?.name === fieldName) || null;
}

function resolveAssignee(issue) {
  if (issue.assignee) {
    return formatUser(issue.assignee);
  }

  const assigneeField = findCustomField(issue, 'Assignee');
  if (!assigneeField) {
    return '-';
  }

  return formatFieldValue(assigneeField.value);
}

function getCustomFieldValue(issue, fieldName) {
  const field = findCustomField(issue, fieldName);
  return field ? formatFieldValue(field.value) : '-';
}

function getIssueState(issue) {
  return getCustomFieldValue(issue, 'State');
}

function getStateColor(state) {
  const normalized = String(state || '').toLowerCase();

  if (!normalized || normalized === '-') {
    return '';
  }

  if (
    normalized.includes('done') ||
    normalized.includes('resolved') ||
    normalized.includes('closed') ||
    normalized.includes('kész')
  ) {
    return ANSI.green;
  }

  if (normalized.includes('block')) {
    return ANSI.red;
  }

  if (
    normalized.includes('review') ||
    normalized.includes('waiting') ||
    normalized.includes('progress') ||
    normalized.includes('folyamat')
  ) {
    return ANSI.yellow;
  }

  if (
    normalized.includes('todo') ||
    normalized.includes('open') ||
    normalized.includes('backlog') ||
    normalized.includes('előkész')
  ) {
    return ANSI.gray;
  }

  return ANSI.blue;
}

function formatLink(link) {
  const label = link.linkType?.localizedName || link.linkType?.name || 'Link';
  const direction = link.direction ? ` (${link.direction})` : '';
  const issueItems = Array.isArray(link.issues)
    ? link.issues
        .filter((linkedIssue) => linkedIssue?.idReadable)
        .map((linkedIssue) => `${linkedIssue.idReadable}: ${linkedIssue.summary || '-'}`)
    : [];

  if (issueItems.length === 0) {
    return null;
  }

  return `${label}${direction}: ${issueItems.join('; ')}`;
}

function getVisibleLinkGroups(issue) {
  if (!Array.isArray(issue.links)) {
    return [];
  }

  return issue.links
    .map((link) => {
      const issues = Array.isArray(link.issues)
        ? link.issues.filter((linkedIssue) => linkedIssue?.idReadable)
        : [];

      if (issues.length === 0) {
        return null;
      }

      return {
        ...link,
        issues
      };
    })
    .filter(Boolean);
}

function getVisibleLinks(issue) {
  return getVisibleLinkGroups(issue)
    .map(formatLink)
    .filter(Boolean);
}

const HEADER_FIELD_NAMES = new Set(['Assignee', 'Type', 'State', 'Prio']);

function formatListIssue(issue) {
  const state = getIssueState(issue);
  const prio = getCustomFieldValue(issue, 'Prio');
  const assignee = resolveAssignee(issue);
  const updated = formatDate(issue.updated);
  const text = `${issue.idReadable} | ${state} | ${prio} | ${assignee} | ${updated}\n  ${issue.summary || '-'}`;
  return colorize(text, getStateColor(state));
}

function formatBriefListIssue(issue) {
  const text = `${issue.idReadable}  ${issue.summary || '-'}`;
  return colorize(text, getStateColor(getIssueState(issue)));
}

async function loadComments(baseUrl, issueId, token) {
  const commentsUrl = new URL(`${baseUrl.replace(/\/+$/, '')}/api/issues/${encodeURIComponent(issueId)}/comments`);
  commentsUrl.searchParams.set('fields', 'author(login,name,fullName),created,updated,text');

  const response = await fetch(commentsUrl, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Comments request failed: ${response.status} ${response.statusText}${text ? `\n${text}` : ''}`);
  }

  return response.json();
}

async function loadWorkItems(baseUrl, issueId, token) {
  const workItemsUrl = new URL(`${baseUrl.replace(/\/+$/, '')}/api/issues/${encodeURIComponent(issueId)}/timeTracking/workItems`);
  workItemsUrl.searchParams.set(
    'fields',
    'author(login,name,fullName),creator(login,name,fullName),date,duration(minutes,presentation),text,type(name),created,updated'
  );

  const response = await fetch(workItemsUrl, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Work items request failed: ${response.status} ${response.statusText}${text ? `\n${text}` : ''}`);
  }

  return response.json();
}

function formatDuration(duration) {
  if (!duration) {
    return '-';
  }

  return duration.presentation || (duration.minutes != null ? `${duration.minutes}m` : '-');
}

function formatWorkItem(workItem) {
  const date = formatDate(workItem.date);
  const author = formatUser(workItem.author);
  const type = workItem.type?.name || '-';
  const duration = formatDuration(workItem.duration);
  const text = workItem.text || '-';

  return `${date} | ${author} | ${type} | ${duration}\n  ${text}`;
}

function getSpentTime(issue) {
  return getCustomFieldValue(issue, 'Spent time');
}

try {
  const options = parseArgs(args);
  validateAliasName(options.alias);
  validateConfigMutationOptions(options);
  validateQueryOptions(options);

  const fileConfig = await loadConfig();
  const defaultConfigPath = path.join(getConfigDir(), 'config.json');
  const globalConfigPath = resolveAliasConfigPath(options, fileConfig);

  if (options.addAlias) {
    await addAliasToConfig(globalConfigPath, options);
    process.exit(0);
  }

  if (options.setDefaultAlias) {
    await setDefaultAliasInConfig(globalConfigPath, options);
    process.exit(0);
  }

  if (options.removeAlias) {
    await removeAliasFromConfig(globalConfigPath, options);
    process.exit(0);
  }

  const globalAliasConfig = globalConfigPath === defaultConfigPath
    ? await loadGlobalAliasConfig()
    : await loadAliasConfigFromPath(globalConfigPath);

  if (options.listAliases) {
    printAliases(globalAliasConfig, globalConfigPath);
    process.exit(0);
  }

  if (options.command === 'issue' && !options.issueId) {
    printUsage();
    process.exit(1);
  }

  const defaultAlias = options.alias ? '' : resolveDefaultAlias(globalAliasConfig);
  const resolvedAlias = options.alias || defaultAlias;
  const aliasConfig = resolvedAlias ? resolveAliasConfig(globalAliasConfig, resolvedAlias) : null;

  if (resolvedAlias && !aliasConfig) {
    exitUnknownAlias(resolvedAlias, globalConfigPath);
  }

  const token = aliasConfig?.token || process.env.YTISSUE_TOKEN || fileConfig.YTISSUE_TOKEN || '';
  const baseUrl = options.baseUrl || aliasConfig?.baseUrl || process.env.YTISSUE_BASE_URL || fileConfig.YTISSUE_BASE_URL || DEFAULT_BASE_URL;

  if (!token) {
    console.error('Missing YTISSUE_TOKEN. Set it via alias config, env var, or config file.');
    process.exit(1);
  }

  if (options.command === 'list' || options.command === 'search') {
    const url = new URL(`${baseUrl.replace(/\/+$/, '')}/api/issues`);
    if (options.command === 'search') {
      url.searchParams.set('query', options.query);
    }
    url.searchParams.set('$top', String(options.limit));
    url.searchParams.set('fields', listFields);

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`YouTrack request failed: ${response.status} ${response.statusText}`);
      if (text) {
        console.error(text);
      }
      process.exit(1);
    }

    const issues = await response.json();

    if (options.json) {
      console.log(JSON.stringify(issues, null, 2));
      process.exit(0);
    }

    if (!Array.isArray(issues) || issues.length === 0) {
      console.log('No issues found.');
      process.exit(0);
    }

    if (options.brief) {
      for (const issue of issues) {
        console.log(formatBriefListIssue(issue));
      }
      process.exit(0);
    }

    console.log(`Results: ${issues.length}`);
    for (const issue of issues) {
      console.log('');
      console.log(formatListIssue(issue));
    }

    process.exit(0);
  }

  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/api/issues/${encodeURIComponent(options.issueId)}`);
  url.searchParams.set('fields', fields);

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`YouTrack request failed: ${response.status} ${response.statusText}`);
    if (text) {
      console.error(text);
    }
    process.exit(1);
  }

  const issue = await response.json();

  let comments = [];
  if (options.comments || options.commentsOnly) {
    comments = await loadComments(baseUrl, options.issueId, token);
  }

  let workItems = [];
  if (options.workItems) {
    workItems = await loadWorkItems(baseUrl, options.issueId, token);
  }

  if (options.json) {
    const payload = options.commentsOnly
      ? comments
      : options.linkedIssues
        ? getVisibleLinkGroups(issue)
      : options.spentTime
        ? { spentTime: getSpentTime(issue) }
      : options.workItems
        ? workItems
        : (options.comments ? { issue, comments } : issue);
    console.log(JSON.stringify(payload, null, 2));
    process.exit(0);
  }

  if (options.commentsOnly) {
    if (comments.length === 0) {
      console.log('No comments.');
      process.exit(0);
    }

    console.log(`Comments: ${comments.length}`);
    for (const comment of comments) {
      console.log('');
      console.log(`- ${formatUser(comment.author)} @ ${formatDate(comment.created)}`);
      console.log(comment.text || '-');
    }
    process.exit(0);
  }

  if (options.linkedIssues) {
    const visibleLinks = getVisibleLinks(issue);
    if (visibleLinks.length === 0) {
      console.log('No linked issues.');
      process.exit(0);
    }

    console.log(`Linked issue groups: ${visibleLinks.length}`);
    for (const link of visibleLinks) {
      console.log('');
      console.log(link);
    }
    process.exit(0);
  }

  if (options.workItems) {
    if (!Array.isArray(workItems) || workItems.length === 0) {
      console.log('No work items.');
      process.exit(0);
    }

    console.log(`Work items: ${workItems.length}`);
    for (const workItem of workItems) {
      console.log('');
      console.log(formatWorkItem(workItem));
    }
    process.exit(0);
  }

  if (options.spentTime) {
    console.log(getSpentTime(issue));
    process.exit(0);
  }

  console.log(`${issue.idReadable}: ${issue.summary || '-'}`);
  console.log(`Project: ${issue.project?.shortName || issue.project?.name || '-'}`);
  console.log(`State: ${getCustomFieldValue(issue, 'State')}`);
  console.log(`Type: ${getCustomFieldValue(issue, 'Type')}`);
  console.log(`Prio: ${getCustomFieldValue(issue, 'Prio')}`);
  console.log(`Reporter: ${formatUser(issue.reporter)}`);
  console.log(`Assignee: ${resolveAssignee(issue)}`);
  console.log(`Created: ${formatDate(issue.created)}`);
  console.log(`Updated: ${formatDate(issue.updated)}`);
  console.log(`Resolved: ${formatDate(issue.resolved)}`);

  if (Array.isArray(issue.tags) && issue.tags.length > 0) {
    console.log(`Tags: ${issue.tags.map((tag) => tag.name).join(', ')}`);
  }

  if (Array.isArray(issue.customFields) && issue.customFields.length > 0) {
    const visibleFields = issue.customFields.filter((field) => !HEADER_FIELD_NAMES.has(field.name));

    if (visibleFields.length > 0) {
      console.log('');
      console.log('Fields:');
      for (const field of visibleFields) {
        console.log(`- ${field.name}: ${formatFieldValue(field.value)}`);
      }
    }
  }

  if (Array.isArray(issue.links) && issue.links.length > 0) {
    const visibleLinks = getVisibleLinks(issue);

    if (visibleLinks.length > 0) {
      console.log('');
      console.log('Links:');
      for (const link of visibleLinks) {
        console.log(`- ${link}`);
      }
    }
  }

  if (issue.description) {
    console.log('');
    console.log('Description:');
    console.log(issue.description);
  }

  if (Array.isArray(comments) && comments.length > 0) {
    console.log('');
    console.log('Comments:');
    for (const comment of comments) {
      console.log('');
      console.log(`- ${formatUser(comment.author)} @ ${formatDate(comment.created)}`);
      console.log(comment.text || '-');
    }
  }
} catch (error) {
  console.error('YouTrack request failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

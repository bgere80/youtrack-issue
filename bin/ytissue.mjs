#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_BASE_URL = 'https://youtrack.billingo.com';
const args = process.argv.slice(2);

function printUsage() {
  console.log(`Usage: youtrack-issue [options] <ISSUE-ID>
       youtrack-issue [options] <ALIAS> <ISSUE-ID>

Options:
  --json              Print raw JSON response
  --comments          Include issue comments
  -a, --alias <name>  Use a configured global alias
  -c, --config <path> Load aliases from a specific JSON config file
  --base-url <url>    Override YouTrack base URL
  -h, --help          Show this help

Config sources:
  1. CLI flags
  2. Global alias config: ~/.config/youtrack-issue/config.json
  3. Environment variables: YOUTRACK_TOKEN, YOUTRACK_BASE_URL
  4. .env / .env.local in the current directory
  5. ~/.config/youtrack-issue/config.env`);
}

function parseArgs(argv) {
  const options = {
    alias: '',
    comments: false,
    configPath: '',
    json: false,
    baseUrl: '',
    issueId: ''
  };
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg === '--comments') {
      options.comments = true;
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

function getConfigDir() {
  return path.join(os.homedir(), '.config', 'youtrack-issue');
}

async function loadGlobalAliasConfig() {
  return loadJsonFile(path.join(getConfigDir(), 'config.json'));
}

async function loadAliasConfigFromPath(configPath) {
  return loadJsonFile(path.resolve(configPath));
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
  const fileConfigs = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.env.local'),
    path.join(getConfigDir(), 'config.env')
  ];

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

function formatDate(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toISOString();
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

const HEADER_FIELD_NAMES = new Set(['Assignee', 'Type', 'State', 'Prio']);

async function loadComments(url, token) {
  const commentsUrl = new URL(`${url.toString()}/comments`);
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

try {
  const options = parseArgs(args);
  validateAliasName(options.alias);

  if (!options.issueId) {
    printUsage();
    process.exit(1);
  }

  const globalConfigPath = options.configPath
    ? path.resolve(options.configPath)
    : path.join(getConfigDir(), 'config.json');
  const globalAliasConfig = options.configPath
    ? await loadAliasConfigFromPath(options.configPath)
    : await loadGlobalAliasConfig();
  const fileConfig = await loadConfig();
  const defaultAlias = options.alias ? '' : resolveDefaultAlias(globalAliasConfig);
  const resolvedAlias = options.alias || defaultAlias;
  const aliasConfig = resolvedAlias ? resolveAliasConfig(globalAliasConfig, resolvedAlias) : null;

  if (resolvedAlias && !aliasConfig) {
    exitUnknownAlias(resolvedAlias, globalConfigPath);
  }

  const token = aliasConfig?.token || process.env.YOUTRACK_TOKEN || fileConfig.YOUTRACK_TOKEN || '';
  const baseUrl = options.baseUrl || aliasConfig?.baseUrl || process.env.YOUTRACK_BASE_URL || fileConfig.YOUTRACK_BASE_URL || DEFAULT_BASE_URL;

  if (!token) {
    console.error('Missing YOUTRACK_TOKEN. Set it via alias config, env var, or config file.');
    process.exit(1);
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
  if (options.comments) {
    comments = await loadComments(url, token);
  }

  if (options.json) {
    const payload = options.comments ? { issue, comments } : issue;
    console.log(JSON.stringify(payload, null, 2));
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
    const visibleLinks = issue.links
      .map(formatLink)
      .filter(Boolean);

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

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { isDirectNodeScriptInvocation } from './cli.mjs';

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

export function getConfigDir() {
  return path.join(os.homedir(), '.config', 'youtrack-issue');
}

export async function loadGlobalAliasConfig() {
  const config = await loadRawAliasConfig(path.join(getConfigDir(), 'config.json'));
  return interpolateEnvInObject(config);
}

export async function loadAliasConfigFromPath(configPath) {
  const config = await loadRawAliasConfig(path.resolve(configPath));
  return interpolateEnvInObject(config);
}

export function resolveAliasConfigPath(options, fileConfig = {}) {
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

export function resolveAliasConfig(globalConfig, alias) {
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

export function resolveDefaultAlias(globalConfig) {
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

export function printAliases(globalConfig, configPath) {
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

export async function addAliasToConfig(configPath, options) {
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

export async function removeAliasFromConfig(configPath, options) {
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

export async function setDefaultAliasInConfig(configPath, options) {
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

export function exitUnknownAlias(alias, globalConfigPath) {
  console.error(`Unknown alias: ${alias}`);
  console.error(`Define it under ${globalConfigPath}`);
  process.exit(1);
}

export async function loadConfig() {
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

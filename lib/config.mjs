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

function normalizeProfileConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return {};
  }

  const normalized = { ...config };

  if (normalized.defaultProfile == null && typeof normalized.defaultAlias === 'string') {
    normalized.defaultProfile = normalized.defaultAlias;
  }

  if ((!normalized.profiles || typeof normalized.profiles !== 'object' || Array.isArray(normalized.profiles))
    && normalized.aliases && typeof normalized.aliases === 'object' && !Array.isArray(normalized.aliases)) {
    normalized.profiles = normalized.aliases;
  }

  return normalized;
}

function ensureProfileContainer(config) {
  if (!config.profiles || typeof config.profiles !== 'object' || Array.isArray(config.profiles)) {
    config.profiles = {};
  }

  delete config.aliases;
  delete config.defaultAlias;
  return config.profiles;
}

async function saveProfileConfig(configPath, config) {
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

export async function loadGlobalProfileConfig() {
  const config = normalizeProfileConfig(await loadRawAliasConfig(path.join(getConfigDir(), 'config.json')));
  return interpolateEnvInObject(config);
}

export async function loadProfileConfigFromPath(configPath) {
  const config = normalizeProfileConfig(await loadRawAliasConfig(path.resolve(configPath)));
  return interpolateEnvInObject(config);
}

export function resolveProfileConfigPath(options, fileConfig = {}) {
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

export function resolveProfileConfig(globalConfig, profile) {
  if (!profile) {
    return null;
  }

  const profiles = globalConfig?.profiles;
  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles)) {
    return null;
  }

  const profileConfig = profiles[profile];
  if (!profileConfig || typeof profileConfig !== 'object' || Array.isArray(profileConfig)) {
    return null;
  }

  return profileConfig;
}

export function resolveDefaultProfile(globalConfig) {
  const defaultProfile = globalConfig?.defaultProfile;
  return typeof defaultProfile === 'string' && defaultProfile.trim() ? defaultProfile.trim() : '';
}

function getProfileEntries(globalConfig) {
  const profiles = globalConfig?.profiles;
  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles)) {
    return [];
  }

  return Object.entries(profiles).filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value));
}

export function printProfiles(globalConfig, configPath) {
  const profileEntries = getProfileEntries(globalConfig);
  const defaultProfile = resolveDefaultProfile(globalConfig);

  console.log(`Config: ${configPath}`);
  if (profileEntries.length === 0) {
    console.log('No profiles configured.');
    return;
  }

  console.log('Profiles:');
  for (const [name, config] of profileEntries) {
    const marker = name === defaultProfile ? ' (default)' : '';
    const baseUrl = typeof config.baseUrl === 'string' && config.baseUrl ? config.baseUrl : '-';
    console.log(`- ${name}${marker}: ${baseUrl}`);
  }
}

export async function addProfileToConfig(configPath, options) {
  const config = normalizeProfileConfig(await loadRawAliasConfig(configPath));
  const profiles = ensureProfileContainer(config);

  profiles[options.addProfile] = {
    baseUrl: options.baseUrl,
    token: options.token
  };

  if (options.setDefaultRequested) {
    config.defaultProfile = options.addProfile;
  }

  await saveProfileConfig(configPath, config);

  console.log(`Saved profile '${options.addProfile}' to ${configPath}`);
  if (options.setDefaultRequested) {
    console.log(`Default profile set to '${options.addProfile}'.`);
  }
}

export async function removeProfileFromConfig(configPath, options) {
  const config = normalizeProfileConfig(await loadRawAliasConfig(configPath));
  const profiles = ensureProfileContainer(config);

  if (!profiles[options.removeProfile]) {
    console.error(`Profile not found: ${options.removeProfile}`);
    process.exit(1);
  }

  delete profiles[options.removeProfile];

  if (config.defaultProfile === options.removeProfile) {
    delete config.defaultProfile;
  }

  await saveProfileConfig(configPath, config);
  console.log(`Removed profile '${options.removeProfile}' from ${configPath}`);
}

export async function setDefaultProfileInConfig(configPath, options) {
  const config = normalizeProfileConfig(await loadRawAliasConfig(configPath));
  const profiles = ensureProfileContainer(config);

  if (!profiles[options.setDefaultProfile]) {
    console.error(`Profile not found: ${options.setDefaultProfile}`);
    process.exit(1);
  }

  config.defaultProfile = options.setDefaultProfile;
  await saveProfileConfig(configPath, config);
  console.log(`Default profile set to '${options.setDefaultProfile}' in ${configPath}`);
}

export function exitUnknownProfile(profile, globalConfigPath) {
  console.error(`Unknown profile: ${profile}`);
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

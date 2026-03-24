import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { configPath, expectSuccess, runCli } from './helpers.mjs';

describe('ytissue CLI config commands', () => {
  it('config mutation commands work on a temp copy of config.test.json', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ytissue-test-'));
    const tempConfigPath = path.join(tempDir, 'config.json');
    const original = await readFile(configPath, 'utf8');
    await writeFile(tempConfigPath, original, 'utf8');

    try {
      const addProfileResult = await runCli([
        '-c',
        tempConfigPath,
        'config',
        'add-profile',
        'temp',
        '--base-url',
        'https://youtrack.example.com',
        '--token',
        '${YTISSUE_TEMP_TOKEN}',
        '--set-default'
      ]);
      expectSuccess(addProfileResult);

      let saved = JSON.parse(await readFile(tempConfigPath, 'utf8'));
      expect(saved.defaultProfile).toBe('temp');
      expect(saved.profiles.temp.baseUrl).toBe('https://youtrack.example.com');
      expect(saved.profiles.temp.token).toBe('${YTISSUE_TEMP_TOKEN}');

      const setDefaultResult = await runCli(['-c', tempConfigPath, 'config', 'set-default', 'test']);
      expectSuccess(setDefaultResult);

      saved = JSON.parse(await readFile(tempConfigPath, 'utf8'));
      expect(saved.defaultProfile).toBe('test');

      const removeResult = await runCli(['-c', tempConfigPath, 'config', 'remove-profile', 'temp']);
      expectSuccess(removeResult);

      saved = JSON.parse(await readFile(tempConfigPath, 'utf8'));
      expect(saved.profiles.temp).toBeUndefined();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('lists profiles through the config subcommand', async () => {
    const result = await runCli(['-c', configPath, 'config', 'list-profiles']);
    expectSuccess(result);
    expect(result.stdout).toMatch(/test \(default\): https:\/\/youtrack\.example\.com/);
  });

  it('supports legacy alias config subcommands', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ytissue-legacy-commands-'));
    const tempConfigPath = path.join(tempDir, 'config.json');
    const original = await readFile(configPath, 'utf8');
    await writeFile(tempConfigPath, original, 'utf8');

    try {
      const listResult = await runCli(['-c', tempConfigPath, 'config', 'list-aliases']);
      expectSuccess(listResult);
      expect(listResult.stdout).toMatch(/test \(default\): https:\/\/youtrack\.example\.com/);

      const addResult = await runCli([
        '-c',
        tempConfigPath,
        'config',
        'add-alias',
        'legacy',
        '--base-url',
        'https://legacy.example.com',
        '--token',
        '${YTISSUE_LEGACY_TOKEN}'
      ]);
      expectSuccess(addResult);

      let saved = JSON.parse(await readFile(tempConfigPath, 'utf8'));
      expect(saved.profiles.legacy.baseUrl).toBe('https://legacy.example.com');

      const removeResult = await runCli(['-c', tempConfigPath, 'config', 'remove-alias', 'legacy']);
      expectSuccess(removeResult);

      saved = JSON.parse(await readFile(tempConfigPath, 'utf8'));
      expect(saved.profiles.legacy).toBeUndefined();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('reads legacy alias config and rewrites it in profile format on mutation', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ytissue-legacy-config-'));
    const tempConfigPath = path.join(tempDir, 'config.json');
    await writeFile(tempConfigPath, JSON.stringify({
      defaultAlias: 'legacy',
      aliases: {
        legacy: {
          baseUrl: 'https://youtrack.example.com',
          token: '${YTISSUE_LEGACY_TOKEN}'
        }
      }
    }, null, 2), 'utf8');

    try {
      const listResult = await runCli(['-c', tempConfigPath, 'config', 'list-profiles']);
      expectSuccess(listResult);
      expect(listResult.stdout).toMatch(/legacy \(default\): https:\/\/youtrack\.example\.com/);

      const addResult = await runCli([
        '-c',
        tempConfigPath,
        'config',
        'add-profile',
        'new',
        '--base-url',
        'https://example.test',
        '--token',
        '${YTISSUE_NEW_TOKEN}'
      ]);
      expectSuccess(addResult);

      const saved = JSON.parse(await readFile(tempConfigPath, 'utf8'));
      expect(saved.defaultAlias).toBeUndefined();
      expect(saved.aliases).toBeUndefined();
      expect(saved.defaultProfile).toBe('legacy');
      expect(saved.profiles.legacy.baseUrl).toBe('https://youtrack.example.com');
      expect(saved.profiles.new.baseUrl).toBe('https://example.test');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

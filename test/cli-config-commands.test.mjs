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
      const addAliasResult = await runCli([
        '-c',
        tempConfigPath,
        '--add-alias',
        'temp',
        '--base-url',
        'https://youtrack.example.com',
        '--token',
        '${YTISSUE_TEMP_TOKEN}',
        '--set-default'
      ]);
      expectSuccess(addAliasResult);

      let saved = JSON.parse(await readFile(tempConfigPath, 'utf8'));
      expect(saved.defaultAlias).toBe('temp');
      expect(saved.aliases.temp.baseUrl).toBe('https://youtrack.example.com');
      expect(saved.aliases.temp.token).toBe('${YTISSUE_TEMP_TOKEN}');

      const setDefaultResult = await runCli(['-c', tempConfigPath, '--set-default', 'billingo']);
      expectSuccess(setDefaultResult);

      saved = JSON.parse(await readFile(tempConfigPath, 'utf8'));
      expect(saved.defaultAlias).toBe('billingo');

      const removeResult = await runCli(['-c', tempConfigPath, '--remove-alias', 'temp']);
      expectSuccess(removeResult);

      saved = JSON.parse(await readFile(tempConfigPath, 'utf8'));
      expect(saved.aliases.temp).toBeUndefined();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

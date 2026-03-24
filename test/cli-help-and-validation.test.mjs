import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import { configPath, expectFailure, expectSuccess, runCli } from './helpers.mjs';
import { parseArgs } from '../lib/cli.mjs';

const require = createRequire(import.meta.url);
const { version: packageVersion } = require('../package.json');

describe('ytissue CLI help and validation', () => {
  it('prints the same help text for no args as for -h, with different exit codes', async () => {
    const noArgsResult = await runCli([]);
    const helpResult = await runCli(['-h']);

    expectFailure(noArgsResult);
    expectSuccess(helpResult);
    expect(noArgsResult.stdout).toBe(helpResult.stdout);
  });

  it('prints help', async () => {
    const result = await runCli(['--help']);
    expectSuccess(result);
    expect(result.stdout).toMatch(/Usage: youtrack-issue \[options] <ISSUE-ID>/);
  });

  it('prints version', async () => {
    const result = await runCli(['--version']);
    expectSuccess(result);
    expect(result.stdout.trim()).toBe(packageVersion);
  });

  it('lists profiles from config.test.json', async () => {
    const result = await runCli(['-c', configPath, 'config', 'list-profiles']);
    expectSuccess(result);
    expect(result.stdout).toMatch(/Config: .*config\.test\.json/);
    expect(result.stdout).toMatch(/test \(default\): https:\/\/youtrack\.example\.com/);
  });

  it('accepts the legacy --alias flag as a synonym for profile', async () => {
    const options = parseArgs(['--alias', 'test', 'AB-1234']);
    expect(options.profile).toBe('test');
    expect(options.issueId).toBe('AB-1234');
  });

  it('rejects incompatible query options', async () => {
    const result = await runCli(['-c', configPath, '--list', '--comments']);
    expectFailure(result);
    expect(result.stderr).toMatch(/only supported for single-issue lookup/);
  });

  it('rejects list and search together', async () => {
    const result = await runCli(['-c', configPath, '--list', '--search', 'project: AB']);
    expectFailure(result);
    expect(result.stderr).toMatch(/Use only one of --list or --search\./);
  });

  it('requires an explicit base URL when no profile config provides one', async () => {
    const tempHome = await mkdtemp(path.join(os.tmpdir(), 'ytissue-home-'));
    const tempCwd = await mkdtemp(path.join(os.tmpdir(), 'ytissue-cwd-'));
    const result = await runCli(['AB-1234'], {
      cwd: tempCwd,
      env: {
        HOME: tempHome,
        YTISSUE_TOKEN: 'perm-test-token',
        YTISSUE_BASE_URL: ''
      }
    });

    expectFailure(result);
    expect(result.stderr).toMatch(/Missing YTISSUE_BASE_URL\./);
  });
});

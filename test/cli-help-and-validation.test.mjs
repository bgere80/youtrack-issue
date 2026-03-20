import { describe, expect, it } from 'vitest';

import { configPath, expectFailure, expectSuccess, runCli } from './helpers.mjs';

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
    expect(result.stdout).toMatch(/Usage: youtrack-issue \[options\] <ISSUE-ID>/);
  });

  it('lists aliases from config.test.json', async () => {
    const result = await runCli(['-c', configPath, 'config', 'list-aliases']);
    expectSuccess(result);
    expect(result.stdout).toMatch(/Config: .*config\.test\.json/);
    expect(result.stdout).toMatch(/billingo \(default\): https:\/\/youtrack\.billingo\.com/);
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
});

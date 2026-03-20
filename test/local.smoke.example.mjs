import { describe, expect, it } from 'vitest';

import { expectSuccess, runCli } from './helpers.mjs';

const smokeConfigPath = './config.smoke.json';
const smokeIssueId = 'AB-3941';

describe('ytissue local smoke example', () => {
  it('reads one issue from a real YouTrack instance', async () => {
    const result = await runCli(['-c', smokeConfigPath, smokeIssueId]);
    expectSuccess(result);
    expect(result.stdout).toMatch(new RegExp(`^${smokeIssueId}: .+`, 'm'));
  }, 30_000);
});

import { describe, expect, it } from 'vitest';

import { configPath, expectSuccess, runCli } from './helpers.mjs';

describe('ytissue CLI query modes', () => {
  it('lists issues', async () => {
    const result = await runCli(['-c', configPath, '--list', '--limit', '2']);
    expectSuccess(result);
    expect(result.stdout).toMatch(/Results: \d+/);
  }, 30_000);

  it('lists issues in brief mode', async () => {
    const result = await runCli(['-c', configPath, '--list', '--limit', '2', '--brief']);
    expectSuccess(result);
    expect(result.stdout).not.toMatch(/\|/);
    expect(result.stdout).toMatch(/^[A-Z]+-\d+\s{2}.+/m);
  }, 30_000);

  it('searches issues', async () => {
    const result = await runCli(['-c', configPath, '--search', 'project: AB', '--limit', '2']);
    expectSuccess(result);
    expect(result.stdout).toMatch(/Results: \d+/);
  }, 30_000);

  it('returns search JSON', async () => {
    const result = await runCli(['-c', configPath, '--search', 'project: AB', '--limit', '2', '--json']);
    expectSuccess(result);
    const payload = JSON.parse(result.stdout);
    expect(Array.isArray(payload)).toBe(true);
    expect(payload.length).toBeGreaterThan(0);
  }, 30_000);
});

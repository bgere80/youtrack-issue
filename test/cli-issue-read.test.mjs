import { describe, expect, it } from 'vitest';

import { configPath, expectSuccess, issueId, runCli } from './helpers.mjs';

describe('ytissue CLI issue read modes', () => {
  it('fetches issue detail with default alias from config.test.json', async () => {
    const result = await runCli(['-c', configPath, issueId]);
    expectSuccess(result);
    expect(result.stdout).toMatch(new RegExp(`^${issueId}: .+`, 'm'));
    expect(result.stdout).toMatch(/^Project: .+/m);
    expect(result.stdout).toMatch(/^Assignee: .+/m);
  }, 30_000);

  it('fetches issue detail with positional alias', async () => {
    const result = await runCli(['-c', configPath, 'billingo', issueId]);
    expectSuccess(result);
    expect(result.stdout).toMatch(new RegExp(`^${issueId}: .+`, 'm'));
  }, 30_000);

  it('fetches issue detail with explicit alias flag', async () => {
    const result = await runCli(['-c', configPath, '-a', 'billingo', issueId]);
    expectSuccess(result);
    expect(result.stdout).toMatch(new RegExp(`^${issueId}: .+`, 'm'));
  }, 30_000);

  it('returns issue JSON', async () => {
    const result = await runCli(['-c', configPath, '--json', issueId]);
    expectSuccess(result);
    const payload = JSON.parse(result.stdout);
    expect(payload.idReadable).toBe(issueId);
    expect(typeof payload.summary).toBe('string');
  }, 30_000);

  it('returns comments-only text', async () => {
    const result = await runCli(['-c', configPath, issueId, '--comments-only']);
    expectSuccess(result);
    expect(
      result.stdout.includes('No comments.') || result.stdout.includes('Comments:'),
      `Unexpected comments output:\n${result.stdout}`
    ).toBe(true);
  }, 30_000);

  it('returns comments-only JSON', async () => {
    const result = await runCli(['-c', configPath, issueId, '--comments-only', '--json']);
    expectSuccess(result);
    const payload = JSON.parse(result.stdout);
    expect(Array.isArray(payload)).toBe(true);
  }, 30_000);

  it('returns issue with appended comments', async () => {
    const result = await runCli(['-c', configPath, issueId, '--comments', '--json']);
    expectSuccess(result);
    const payload = JSON.parse(result.stdout);
    expect(payload.issue.idReadable).toBe(issueId);
    expect(Array.isArray(payload.comments)).toBe(true);
  }, 30_000);

  it('returns spent time text', async () => {
    const result = await runCli(['-c', configPath, issueId, '--spent-time']);
    expectSuccess(result);
    expect(result.stdout.trim()).not.toBe('');
  }, 30_000);

  it('returns spent time JSON', async () => {
    const result = await runCli(['-c', configPath, issueId, '--spent-time', '--json']);
    expectSuccess(result);
    const payload = JSON.parse(result.stdout);
    expect(Object.hasOwn(payload, 'spentTime')).toBe(true);
  }, 30_000);

  it('returns work items text', async () => {
    const result = await runCli(['-c', configPath, issueId, '--work-items']);
    expectSuccess(result);
    expect(
      result.stdout.includes('No work items.') || result.stdout.includes('Work items:'),
      `Unexpected work items output:\n${result.stdout}`
    ).toBe(true);
  }, 30_000);

  it('returns work items JSON', async () => {
    const result = await runCli(['-c', configPath, issueId, '--work-items', '--json']);
    expectSuccess(result);
    const payload = JSON.parse(result.stdout);
    expect(Array.isArray(payload)).toBe(true);
  }, 30_000);

  it('returns linked issues text', async () => {
    const result = await runCli(['-c', configPath, issueId, '--linked-issues']);
    expectSuccess(result);
    expect(
      result.stdout.includes('No linked issues.') || result.stdout.includes('Linked issue groups:'),
      `Unexpected linked issues output:\n${result.stdout}`
    ).toBe(true);
  }, 30_000);

  it('returns linked issues JSON', async () => {
    const result = await runCli(['-c', configPath, issueId, '--linked-issues', '--json']);
    expectSuccess(result);
    const payload = JSON.parse(result.stdout);
    expect(Array.isArray(payload)).toBe(true);
  }, 30_000);
});

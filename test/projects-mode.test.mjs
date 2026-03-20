import process from 'node:process';

import { describe, expect, it, vi } from 'vitest';

import { parseArgs, validateQueryOptions } from '../lib/cli.mjs';
import { fetchProjects, formatBriefProject, formatProject } from '../lib/youtrack.mjs';

describe('ytissue projects mode', () => {
  it('parses --projects as a standalone command', () => {
    const options = parseArgs(['--projects']);
    expect(options.command).toBe('projects');
    expect(options.alias).toBe('');
    expect(options.issueId).toBe('');
  });

  it('parses -p as a shorthand for --projects', () => {
    const options = parseArgs(['-p']);
    expect(options.command).toBe('projects');
    expect(options.alias).toBe('');
    expect(options.issueId).toBe('');
  });

  it('accepts a positional alias for --projects', () => {
    const options = parseArgs(['work', '--projects']);
    expect(options.command).toBe('projects');
    expect(options.alias).toBe('work');
    expect(options.issueId).toBe('');
  });

  it('rejects issue-only flags in projects mode', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => validateQueryOptions({
        mode: 'issue',
        command: 'projects',
        comments: true,
        commentsOnly: false,
        linkedIssues: false,
        spentTime: false,
        workItems: false
      })).toThrow('process.exit:1');
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('formats projects in default and brief modes', () => {
    const activeProject = { shortName: 'AB', name: 'Alpha Beta', archived: false };
    const archivedProject = { shortName: 'ZZ', name: 'Legacy', archived: true };

    expect(formatProject(activeProject)).toBe('AB | active\n  Alpha Beta');
    expect(formatProject(archivedProject)).toBe('ZZ | archived\n  Legacy');
    expect(formatBriefProject(activeProject)).toBe('AB  Alpha Beta');
  });

  it('fetches projects from the admin projects endpoint', async () => {
    const payload = [{ shortName: 'AB', name: 'Alpha Beta', archived: false }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload
    });

    vi.stubGlobal('fetch', fetchMock);

    try {
      const result = await fetchProjects('https://youtrack.example.com', 5, 'perm-token');
      expect(result).toEqual(payload);

      const [url, options] = fetchMock.mock.calls[0];
      expect(url.pathname).toBe('/api/admin/projects');
      expect(url.searchParams.get('$top')).toBe('5');
      expect(url.searchParams.get('fields')).toBe('shortName,name,archived');
      expect(options.headers.Authorization).toBe('Bearer perm-token');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

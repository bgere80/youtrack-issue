import process from 'node:process';

import { describe, expect, it, vi } from 'vitest';

import { downloadAttachment, fetchIssue, fetchProjects } from '../lib/youtrack.mjs';

describe('ytissue request timeout handling', () => {
  it('passes an AbortSignal to JSON requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => []
    });

    vi.stubGlobal('fetch', fetchMock);

    try {
      await fetchProjects('https://youtrack.example.com', 5, 'perm-token');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.signal).toBeInstanceOf(AbortSignal);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reports a clear timeout error for JSON requests', async () => {
    const originalTimeout = process.env.YTISSUE_TIMEOUT_MS;
    process.env.YTISSUE_TIMEOUT_MS = '10';

    const fetchMock = vi.fn((_, options) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }));
      }, { once: true });
    }));

    vi.stubGlobal('fetch', fetchMock);

    try {
      await expect(fetchIssue('https://youtrack.example.com', 'AB-3941', 'perm-token')).rejects.toThrow(
        'YouTrack request failed: request timed out after 10 ms'
      );
    } finally {
      if (originalTimeout == null) {
        delete process.env.YTISSUE_TIMEOUT_MS;
      } else {
        process.env.YTISSUE_TIMEOUT_MS = originalTimeout;
      }

      vi.unstubAllGlobals();
    }
  });

  it('reports a clear timeout error for binary downloads', async () => {
    const originalTimeout = process.env.YTISSUE_TIMEOUT_MS;
    process.env.YTISSUE_TIMEOUT_MS = '10';

    const fetchMock = vi.fn((_, options) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }));
      }, { once: true });
    }));

    vi.stubGlobal('fetch', fetchMock);

    try {
      await expect(downloadAttachment('https://youtrack.example.com', {
        id: '92-1',
        name: 'invoice.pdf',
        url: '/api/files/92-1'
      }, 'perm-token')).rejects.toThrow('Attachment download failed: request timed out after 10 ms');
    } finally {
      if (originalTimeout == null) {
        delete process.env.YTISSUE_TIMEOUT_MS;
      } else {
        process.env.YTISSUE_TIMEOUT_MS = originalTimeout;
      }

      vi.unstubAllGlobals();
    }
  });
});

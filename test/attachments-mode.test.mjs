import process from 'node:process';

import { describe, expect, it, vi } from 'vitest';

import { parseArgs, validateQueryOptions } from '../lib/cli.mjs';
import {
  downloadAttachment,
  formatAttachment,
  formatBriefAttachment,
  loadAttachments,
  resolveAttachment,
  resolveAttachmentDownloadUrl
} from '../lib/youtrack.mjs';

const sampleAttachments = [
  {
    id: '92-1',
    name: 'invoice.pdf',
    author: { fullName: 'Alice Doe' },
    created: 1_700_000_000_000,
    size: 1_536,
    mimeType: 'application/pdf',
    url: '/api/files/92-1'
  },
  {
    id: '92-2',
    name: 'notes.txt',
    author: { fullName: 'Bob Doe' },
    created: 1_700_100_000_000,
    size: 12,
    mimeType: 'text/plain',
    url: 'https://youtrack.example.com/api/files/92-2'
  }
];

describe('ytissue attachments mode', () => {
  it('parses --attachments as a single-issue mode', () => {
    const options = parseArgs(['AB-3941', '--attachments']);
    expect(options.command).toBe('attachments');
    expect(options.attachments).toBe(true);
    expect(options.issueId).toBe('AB-3941');
  });

  it('parses --download-attachment for a single issue', () => {
    const options = parseArgs(['AB-3941', '--download-attachment', 'invoice.pdf']);
    expect(options.command).toBe('attachments');
    expect(options.downloadAttachment).toBe('invoice.pdf');
  });

  it('requires an issue ID for attachments mode', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => validateQueryOptions({
        mode: 'issue',
        command: 'attachments',
        issueId: '',
        query: '',
        attachments: true,
        comments: false,
        commentsOnly: false,
        downloadAttachment: '',
        fieldsRequested: false,
        fieldNames: [],
        linkedIssues: false,
        spentTime: false,
        workItems: false
      })).toThrow('process.exit:1');
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('rejects mixing attachment list and download modes', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => validateQueryOptions({
        mode: 'issue',
        command: 'attachments',
        issueId: 'AB-3941',
        query: '',
        attachments: true,
        comments: false,
        commentsOnly: false,
        downloadAttachment: 'invoice.pdf',
        fieldsRequested: false,
        fieldNames: [],
        linkedIssues: false,
        spentTime: false,
        workItems: false
      })).toThrow('process.exit:1');
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('formats attachments in default and brief modes', () => {
    expect(formatBriefAttachment(sampleAttachments[0])).toBe('92-1  invoice.pdf');
    expect(formatAttachment(sampleAttachments[0])).toMatch(/^92-1 \| 2 KB \| application\/pdf \| Alice Doe \| /);
  });

  it('resolves attachments by ID or exact name', () => {
    expect(resolveAttachment(sampleAttachments, '92-1').attachment?.name).toBe('invoice.pdf');
    expect(resolveAttachment(sampleAttachments, 'notes.txt').attachment?.id).toBe('92-2');
    expect(resolveAttachment(sampleAttachments, 'missing').error).toMatch(/Attachment not found/);
  });

  it('builds absolute download URLs for relative and absolute attachment urls', () => {
    expect(resolveAttachmentDownloadUrl('https://youtrack.example.com', sampleAttachments[0])).toBe('https://youtrack.example.com/api/files/92-1');
    expect(resolveAttachmentDownloadUrl('https://youtrack.example.com', sampleAttachments[1])).toBe('https://youtrack.example.com/api/files/92-2');
  });

  it('loads attachments through the issue attachments endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleAttachments
    });

    vi.stubGlobal('fetch', fetchMock);

    try {
      const result = await loadAttachments('https://youtrack.example.com', 'AB-3941', 'perm-token');
      expect(result).toEqual(sampleAttachments);

      const [url, options] = fetchMock.mock.calls[0];
      expect(url.pathname).toBe('/api/issues/AB-3941/attachments');
      expect(url.searchParams.get('fields')).toContain('url');
      expect(options.headers.Authorization).toBe('Bearer perm-token');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('downloads attachment content with authorization', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => bytes.buffer
    });

    vi.stubGlobal('fetch', fetchMock);

    try {
      const result = await downloadAttachment('https://youtrack.example.com', sampleAttachments[0], 'perm-token');
      expect(result.content).toEqual(Buffer.from([1, 2, 3, 4]));
      expect(result.url).toBe('https://youtrack.example.com/api/files/92-1');

      const [url, options] = fetchMock.mock.calls[0];
      expect(String(url)).toBe('https://youtrack.example.com/api/files/92-1');
      expect(options.headers.Authorization).toBe('Bearer perm-token');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

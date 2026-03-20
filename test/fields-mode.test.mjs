import process from 'node:process';

import { describe, expect, it, vi } from 'vitest';

import { parseArgs, validateQueryOptions } from '../lib/cli.mjs';
import { listAvailableIssueFields, resolveIssueFields } from '../lib/youtrack.mjs';

const sampleIssue = {
  idReadable: 'AB-3941',
  summary: 'Sample issue',
  description: 'Detailed description',
  created: 1_700_000_000_000,
  updated: 1_700_100_000_000,
  resolved: null,
  project: {
    shortName: 'AB',
    name: 'Alpha Beta'
  },
  reporter: {
    login: 'alice',
    fullName: 'Alice Doe'
  },
  assignee: null,
  tags: [
    { name: 'backend' },
    { name: 'urgent' }
  ],
  links: [
    {
      direction: 'OUTWARD',
      linkType: {
        localizedName: 'relates to'
      },
      issues: [
        {
          idReadable: 'AB-12',
          summary: 'Related issue'
        }
      ]
    }
  ],
  customFields: [
    {
      name: 'State',
      value: {
        name: 'In Progress'
      }
    },
    {
      name: 'Assignee',
      value: {
        fullName: 'Bob Doe'
      }
    },
    {
      name: 'Spent time',
      value: {
        presentation: '2h 30m'
      }
    },
    {
      name: 'Story Points',
      value: {
        text: '5'
      }
    }
  ]
};

describe('ytissue fields mode', () => {
  it('parses --fields as a single-issue mode', () => {
    const options = parseArgs(['AB-3941', '--fields']);
    expect(options.command).toBe('fields');
    expect(options.fieldsRequested).toBe(true);
    expect(options.issueId).toBe('AB-3941');
  });

  it('parses repeated --field values', () => {
    const options = parseArgs(['AB-3941', '--field', 'summary', 'Story Points']);
    expect(options.command).toBe('fields');
    expect(options.fieldNames).toEqual(['summary', 'Story Points']);
  });

  it('parses -f as shorthand and accepts multiple field names', () => {
    const options = parseArgs(['AB-3941', '-f', 'summary', 'Spent time', 'tags']);
    expect(options.command).toBe('fields');
    expect(options.fieldNames).toEqual(['summary', 'Spent time', 'tags']);
  });

  it('rejects --field in non-issue modes', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => parseArgs(['--list', '--field', 'summary'])).toThrow('process.exit:1');
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('requires an issue ID for fields mode', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => validateQueryOptions({
        mode: 'issue',
        command: 'fields',
        issueId: '',
        query: '',
        comments: false,
        commentsOnly: false,
        fieldsRequested: false,
        fieldNames: ['summary'],
        linkedIssues: false,
        spentTime: false,
        workItems: false
      })).toThrow('process.exit:1');
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('rejects combining --fields with other issue-only single-view modes', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => validateQueryOptions({
        mode: 'issue',
        command: 'fields',
        comments: false,
        commentsOnly: false,
        fieldsRequested: true,
        fieldNames: [],
        linkedIssues: true,
        spentTime: false,
        workItems: false
      })).toThrow('process.exit:1');
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('lists available standard and custom fields', () => {
    const result = listAvailableIssueFields(sampleIssue);
    expect(result.standardFields).toEqual([
      'id',
      'summary',
      'project',
      'state',
      'type',
      'prio',
      'reporter',
      'assignee',
      'created',
      'updated',
      'resolved',
      'tags',
      'links',
      'description'
    ]);
    expect(result.customFields).toEqual(['State', 'Assignee', 'Spent time', 'Story Points']);
  });

  it('resolves requested field values case-insensitively', () => {
    const result = resolveIssueFields(sampleIssue, ['summary', 'state', 'Story Points', 'assignee']);

    expect(result.missing).toEqual([]);
    expect(result.fields).toEqual([
      {
        name: 'summary',
        rawValue: 'Sample issue',
        textValue: 'Sample issue'
      },
      {
        name: 'State',
        rawValue: {
          name: 'In Progress'
        },
        textValue: 'In Progress'
      },
      {
        name: 'Story Points',
        rawValue: {
          text: '5'
        },
        textValue: '5'
      },
      {
        name: 'Assignee',
        rawValue: {
          fullName: 'Bob Doe'
        },
        textValue: 'Bob Doe'
      }
    ]);
  });

  it('reports unknown field names', () => {
    const result = resolveIssueFields(sampleIssue, ['summary', 'Unknown Field']);
    expect(result.fields).toHaveLength(1);
    expect(result.missing).toEqual(['Unknown Field']);
  });
});

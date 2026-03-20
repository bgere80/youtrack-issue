const ISSUE_FIELDS = [
  'idReadable',
  'summary',
  'description',
  'created',
  'updated',
  'resolved',
  'project(name,shortName)',
  'reporter(login,name,fullName)',
  'assignee(login,name,fullName)',
  'tags(name)',
  'links(direction,linkType(name,localizedName),issues(idReadable,summary))',
  'customFields(name,value(name,login,fullName,text,presentation,color(id),minutes))'
].join(',');

const LIST_FIELDS = [
  'idReadable',
  'summary',
  'updated',
  'project(name,shortName)',
  'assignee(login,name,fullName)',
  'customFields(name,value(name,login,fullName,text,presentation,minutes))'
].join(',');

const PROJECT_FIELDS = [
  'shortName',
  'name',
  'archived'
].join(',');

const ATTACHMENT_FIELDS = [
  'id',
  'name',
  'author(login,name,fullName)',
  'created',
  'updated',
  'size',
  'mimeType',
  'extension',
  'charset',
  'metaData',
  'url'
].join(',');

const ANSI = {
  reset: '\u001B[0m',
  green: '\u001B[32m',
  yellow: '\u001B[33m',
  blue: '\u001B[34m',
  red: '\u001B[31m',
  gray: '\u001B[90m'
};

export const HEADER_FIELD_NAMES = new Set(['Assignee', 'Type', 'State', 'Prio']);

function supportsColor() {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function colorize(text, color) {
  if (!supportsColor() || !color) {
    return text;
  }

  return `${color}${text}${ANSI.reset}`;
}

async function fetchJson(url, token, errorPrefix = 'YouTrack request failed') {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${errorPrefix}: ${response.status} ${response.statusText}${text ? `\n${text}` : ''}`);
  }

  return response.json();
}

async function fetchBinary(url, token, errorPrefix = 'YouTrack request failed') {
  const response = await fetch(url, {
    headers: {
      Accept: '*/*',
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${errorPrefix}: ${response.status} ${response.statusText}${text ? `\n${text}` : ''}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export function formatDate(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toISOString();
}

export function formatUser(user) {
  if (!user) {
    return '-';
  }

  return user.fullName || user.name || user.login || '-';
}

export function formatFieldValue(value) {
  if (value == null) {
    return '-';
  }

  if (Array.isArray(value)) {
    return value.map(formatFieldValue).join(', ');
  }

  if (typeof value === 'object') {
    return value.presentation || value.fullName || value.name || value.login || value.text || value.minutes || JSON.stringify(value);
  }

  return String(value);
}

function findCustomField(issue, fieldName) {
  if (!Array.isArray(issue.customFields)) {
    return null;
  }

  return issue.customFields.find((field) => field?.name === fieldName) || null;
}

export function resolveAssignee(issue) {
  if (issue.assignee) {
    return formatUser(issue.assignee);
  }

  const assigneeField = findCustomField(issue, 'Assignee');
  if (!assigneeField) {
    return '-';
  }

  return formatFieldValue(assigneeField.value);
}

export function getCustomFieldValue(issue, fieldName) {
  const field = findCustomField(issue, fieldName);
  return field ? formatFieldValue(field.value) : '-';
}

function getIssueState(issue) {
  return getCustomFieldValue(issue, 'State');
}

function getStateColor(state) {
  const normalized = String(state || '').toLowerCase();

  if (!normalized || normalized === '-') {
    return '';
  }

  if (
    normalized.includes('done') ||
    normalized.includes('resolved') ||
    normalized.includes('closed') ||
    normalized.includes('kész')
  ) {
    return ANSI.green;
  }

  if (normalized.includes('block')) {
    return ANSI.red;
  }

  if (
    normalized.includes('review') ||
    normalized.includes('waiting') ||
    normalized.includes('progress') ||
    normalized.includes('folyamat')
  ) {
    return ANSI.yellow;
  }

  if (
    normalized.includes('todo') ||
    normalized.includes('open') ||
    normalized.includes('backlog') ||
    normalized.includes('előkész')
  ) {
    return ANSI.gray;
  }

  return ANSI.blue;
}

function formatLink(link) {
  const label = link.linkType?.localizedName || link.linkType?.name || 'Link';
  const direction = link.direction ? ` (${link.direction})` : '';
  const issueItems = Array.isArray(link.issues)
    ? link.issues.map((linkedIssue) => `${linkedIssue.idReadable}: ${linkedIssue.summary || '-'}`)
    : [];

  if (issueItems.length === 0) {
    return null;
  }

  return `${label}${direction}: ${issueItems.join('; ')}`;
}

export function getVisibleLinkGroups(issue) {
  if (!Array.isArray(issue.links)) {
    return [];
  }

  return issue.links
    .map((link) => {
      const issues = Array.isArray(link.issues)
        ? link.issues.filter((linkedIssue) => linkedIssue?.idReadable)
        : [];

      if (issues.length === 0) {
        return null;
      }

      return {
        ...link,
        issues
      };
    })
    .filter(Boolean);
}

export function getVisibleLinks(issue) {
  return getVisibleLinkGroups(issue)
    .map(formatLink)
    .filter(Boolean);
}

export function formatListIssue(issue) {
  const state = getIssueState(issue);
  const prio = getCustomFieldValue(issue, 'Prio');
  const assignee = resolveAssignee(issue);
  const updated = formatDate(issue.updated);
  const text = `${issue.idReadable} | ${state} | ${prio} | ${assignee} | ${updated}\n  ${issue.summary || '-'}`;
  return colorize(text, getStateColor(state));
}

export function formatBriefListIssue(issue) {
  const text = `${issue.idReadable}  ${issue.summary || '-'}`;
  return colorize(text, getStateColor(getIssueState(issue)));
}

function formatDuration(duration) {
  if (!duration) {
    return '-';
  }

  return duration.presentation || (duration.minutes != null ? `${duration.minutes}m` : '-');
}

export function formatWorkItem(workItem) {
  const date = formatDate(workItem.date);
  const author = formatUser(workItem.author);
  const type = workItem.type?.name || '-';
  const duration = formatDuration(workItem.duration);
  const text = workItem.text || '-';

  return `${date} | ${author} | ${type} | ${duration}\n  ${text}`;
}

export function getSpentTime(issue) {
  return getCustomFieldValue(issue, 'Spent time');
}

function buildIssueFieldEntries(issue) {
  const tagNames = Array.isArray(issue.tags) ? issue.tags.map((tag) => tag.name).filter(Boolean) : [];
  const visibleLinks = getVisibleLinks(issue);
  const visibleLinkGroups = getVisibleLinkGroups(issue);
  const assigneeField = findCustomField(issue, 'Assignee');
  const stateField = findCustomField(issue, 'State');
  const typeField = findCustomField(issue, 'Type');
  const prioField = findCustomField(issue, 'Prio');
  const entries = [
    {
      aliases: ['id', 'idReadable'],
      name: 'id',
      rawValue: issue.idReadable || null,
      textValue: issue.idReadable || '-'
    },
    {
      aliases: ['summary'],
      name: 'summary',
      rawValue: issue.summary || null,
      textValue: issue.summary || '-'
    },
    {
      aliases: ['project'],
      name: 'project',
      rawValue: issue.project || null,
      textValue: issue.project?.shortName || issue.project?.name || '-'
    },
    {
      aliases: ['state'],
      name: 'state',
      rawValue: stateField?.value ?? null,
      textValue: getCustomFieldValue(issue, 'State')
    },
    {
      aliases: ['type'],
      name: 'type',
      rawValue: typeField?.value ?? null,
      textValue: getCustomFieldValue(issue, 'Type')
    },
    {
      aliases: ['prio', 'priority'],
      name: 'prio',
      rawValue: prioField?.value ?? null,
      textValue: getCustomFieldValue(issue, 'Prio')
    },
    {
      aliases: ['reporter'],
      name: 'reporter',
      rawValue: issue.reporter || null,
      textValue: formatUser(issue.reporter)
    },
    {
      aliases: ['assignee'],
      name: 'assignee',
      rawValue: issue.assignee || assigneeField?.value || null,
      textValue: resolveAssignee(issue)
    },
    {
      aliases: ['created'],
      name: 'created',
      rawValue: issue.created || null,
      textValue: formatDate(issue.created)
    },
    {
      aliases: ['updated'],
      name: 'updated',
      rawValue: issue.updated || null,
      textValue: formatDate(issue.updated)
    },
    {
      aliases: ['resolved'],
      name: 'resolved',
      rawValue: issue.resolved || null,
      textValue: formatDate(issue.resolved)
    },
    {
      aliases: ['tags'],
      name: 'tags',
      rawValue: issue.tags || [],
      textValue: tagNames.length > 0 ? tagNames.join(', ') : '-'
    },
    {
      aliases: ['links'],
      name: 'links',
      rawValue: visibleLinkGroups,
      textValue: visibleLinks.length > 0 ? visibleLinks.join('\n') : '-'
    },
    {
      aliases: ['description'],
      name: 'description',
      rawValue: issue.description || null,
      textValue: issue.description || '-'
    }
  ];

  if (Array.isArray(issue.customFields)) {
    for (const field of issue.customFields) {
      if (!field?.name) {
        continue;
      }

      entries.push({
        aliases: [field.name],
        name: field.name,
        rawValue: field.value ?? null,
        textValue: formatFieldValue(field.value)
      });
    }
  }

  return entries;
}

function normalizeFieldName(name) {
  return String(name || '').trim().toLowerCase();
}

export function listAvailableIssueFields(issue) {
  const standardFields = [];
  const customFields = [];

  for (const entry of buildIssueFieldEntries(issue)) {
    const primaryAlias = entry.aliases[0];
    if (entry.aliases.length > 1 || entry.name === primaryAlias.toLowerCase()) {
      if (!standardFields.includes(entry.name)) {
        standardFields.push(entry.name);
      }
      continue;
    }

    if (!customFields.includes(entry.name)) {
      customFields.push(entry.name);
    }
  }

  return {
    standardFields,
    customFields
  };
}

export function resolveIssueFields(issue, requestedFieldNames) {
  const fieldMap = new Map();

  for (const entry of buildIssueFieldEntries(issue)) {
    for (const alias of entry.aliases) {
      fieldMap.set(normalizeFieldName(alias), entry);
    }
  }

  const results = [];
  const missing = [];
  const seen = new Set();

  for (const requestedName of requestedFieldNames) {
    const normalizedName = normalizeFieldName(requestedName);
    if (!normalizedName || seen.has(normalizedName)) {
      continue;
    }

    seen.add(normalizedName);
    const entry = fieldMap.get(normalizedName);
    if (!entry) {
      missing.push(requestedName);
      continue;
    }

    results.push({
      name: entry.name,
      rawValue: entry.rawValue,
      textValue: entry.textValue
    });
  }

  return {
    fields: results,
    missing
  };
}

export function formatProject(project) {
  const status = project.archived ? 'archived' : 'active';
  return `${project.shortName || '-'} | ${status}\n  ${project.name || '-'}`;
}

export function formatBriefProject(project) {
  return `${project.shortName || '-'}  ${project.name || '-'}`;
}

function formatBytes(size) {
  if (typeof size !== 'number' || Number.isNaN(size)) {
    return '-';
  }

  if (size < 1024) {
    return `${size} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size;
  let unitIndex = -1;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatAttachment(attachment) {
  const author = formatUser(attachment.author);
  const created = formatDate(attachment.created);
  const size = formatBytes(attachment.size);
  const mimeType = attachment.mimeType || '-';

  return `${attachment.id || '-'} | ${size} | ${mimeType} | ${author} | ${created}\n  ${attachment.name || '-'}`;
}

export function formatBriefAttachment(attachment) {
  return `${attachment.id || '-'}  ${attachment.name || '-'}`;
}

export function resolveAttachment(attachments, identifier) {
  const matches = attachments.filter((attachment) => attachment.id === identifier || attachment.name === identifier);

  if (matches.length === 0) {
    return {
      attachment: null,
      error: `Attachment not found: ${identifier}`
    };
  }

  if (matches.length > 1) {
    return {
      attachment: null,
      error: `Multiple attachments match '${identifier}'. Use the attachment ID instead.`
    };
  }

  return {
    attachment: matches[0],
    error: ''
  };
}

export async function fetchIssues(baseUrl, query, limit, token) {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/api/issues`);
  if (query) {
    url.searchParams.set('query', query);
  }
  url.searchParams.set('$top', String(limit));
  url.searchParams.set('fields', LIST_FIELDS);

  return fetchJson(url, token);
}

export async function fetchIssue(baseUrl, issueId, token) {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/api/issues/${encodeURIComponent(issueId)}`);
  url.searchParams.set('fields', ISSUE_FIELDS);

  return fetchJson(url, token);
}

export async function fetchProjects(baseUrl, limit, token) {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/api/admin/projects`);
  url.searchParams.set('$top', String(limit));
  url.searchParams.set('fields', PROJECT_FIELDS);

  return fetchJson(url, token, 'Projects request failed');
}

export async function loadAttachments(baseUrl, issueId, token) {
  const attachmentsUrl = new URL(`${baseUrl.replace(/\/+$/, '')}/api/issues/${encodeURIComponent(issueId)}/attachments`);
  attachmentsUrl.searchParams.set('fields', ATTACHMENT_FIELDS);

  return fetchJson(attachmentsUrl, token, 'Attachments request failed');
}

export function resolveAttachmentDownloadUrl(baseUrl, attachment) {
  if (!attachment?.url) {
    throw new Error('Attachment does not provide a download URL.');
  }

  return new URL(attachment.url, `${baseUrl.replace(/\/+$/, '')}/`).toString();
}

export async function downloadAttachment(baseUrl, attachment, token) {
  const url = resolveAttachmentDownloadUrl(baseUrl, attachment);
  const content = await fetchBinary(url, token, 'Attachment download failed');

  return {
    content,
    url
  };
}

export async function loadComments(baseUrl, issueId, token) {
  const commentsUrl = new URL(`${baseUrl.replace(/\/+$/, '')}/api/issues/${encodeURIComponent(issueId)}/comments`);
  commentsUrl.searchParams.set('fields', 'author(login,name,fullName),created,updated,text');

  return fetchJson(commentsUrl, token, 'Comments request failed');
}

export async function loadWorkItems(baseUrl, issueId, token) {
  const workItemsUrl = new URL(`${baseUrl.replace(/\/+$/, '')}/api/issues/${encodeURIComponent(issueId)}/timeTracking/workItems`);
  workItemsUrl.searchParams.set(
    'fields',
    'author(login,name,fullName),creator(login,name,fullName),date,duration(minutes,presentation),text,type(name),created,updated'
  );

  return fetchJson(workItemsUrl, token, 'Work items request failed');
}

#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  parseArgs,
  printUsage,
  validateProfileName,
  validateConfigMutationOptions,
  validateQueryOptions
} from '../lib/cli.mjs';
import {
  addProfileToConfig,
  exitUnknownProfile,
  getConfigDir,
  loadProfileConfigFromPath,
  loadConfig,
  loadGlobalProfileConfig,
  printProfiles,
  removeProfileFromConfig,
  resolveProfileConfig,
  resolveProfileConfigPath,
  resolveDefaultProfile,
  setDefaultProfileInConfig
} from '../lib/config.mjs';
import {
  HEADER_FIELD_NAMES,
  fetchIssue,
  fetchIssues,
  fetchProjects,
  formatBriefListIssue,
  formatBriefAttachment,
  formatBriefProject,
  formatAttachment,
  formatDate,
  formatFieldValue,
  formatListIssue,
  formatProject,
  formatUser,
  formatWorkItem,
  getCustomFieldValue,
  listAvailableIssueFields,
  resolveIssueFields,
  loadAttachments,
  resolveAttachment,
  downloadAttachment,
  getSpentTime,
  getVisibleLinkGroups,
  getVisibleLinks,
  loadComments,
  loadWorkItems,
  resolveAssignee
} from '../lib/youtrack.mjs';

const args = process.argv.slice(2);

try {
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const options = parseArgs(args);
  validateProfileName(options.profile);
  validateConfigMutationOptions(options);
  validateQueryOptions(options);

  const fileConfig = await loadConfig();
  const defaultConfigPath = `${getConfigDir()}/config.json`;
  const globalConfigPath = resolveProfileConfigPath(options, fileConfig);

  const globalProfileConfig = globalConfigPath === defaultConfigPath
    ? await loadGlobalProfileConfig()
    : await loadProfileConfigFromPath(globalConfigPath);

  if (options.mode === 'config') {
    if (options.addProfile) {
      await addProfileToConfig(globalConfigPath, options);
      process.exit(0);
    }

    if (options.setDefaultProfile) {
      await setDefaultProfileInConfig(globalConfigPath, options);
      process.exit(0);
    }

    if (options.removeProfile) {
      await removeProfileFromConfig(globalConfigPath, options);
      process.exit(0);
    }

    if (options.listProfiles) {
      printProfiles(globalProfileConfig, globalConfigPath);
      process.exit(0);
    }
  }

  if (options.listProfiles) {
    printProfiles(globalProfileConfig, globalConfigPath);
    process.exit(0);
  }

  if (options.command === 'issue' && !options.issueId) {
    printUsage();
    process.exit(1);
  }

  const defaultProfile = options.profile ? '' : resolveDefaultProfile(globalProfileConfig);
  const resolvedProfile = options.profile || defaultProfile;
  const profileConfig = resolvedProfile ? resolveProfileConfig(globalProfileConfig, resolvedProfile) : null;

  if (resolvedProfile && !profileConfig) {
    exitUnknownProfile(resolvedProfile, globalConfigPath);
  }

  const token = profileConfig?.token || process.env.YTISSUE_TOKEN || fileConfig.YTISSUE_TOKEN || '';
  const baseUrl = options.baseUrl || profileConfig?.baseUrl || process.env.YTISSUE_BASE_URL || fileConfig.YTISSUE_BASE_URL || '';

  if (!token) {
    console.error('Missing YTISSUE_TOKEN. Set it via profile config, env var, or config file.');
    process.exit(1);
  }

  if (!baseUrl) {
    console.error('Missing YTISSUE_BASE_URL. Set it via profile config, env var, or config file.');
    process.exit(1);
  }

  if (options.command === 'projects') {
    const projects = await fetchProjects(baseUrl, options.limit, token);

    if (options.json) {
      console.log(JSON.stringify(projects, null, 2));
      process.exit(0);
    }

    if (!Array.isArray(projects) || projects.length === 0) {
      console.log('No projects found.');
      process.exit(0);
    }

    if (options.brief) {
      for (const project of projects) {
        console.log(formatBriefProject(project));
      }
      process.exit(0);
    }

    console.log(`Projects: ${projects.length}`);
    for (const project of projects) {
      console.log('');
      console.log(formatProject(project));
    }

    process.exit(0);
  }

  if (options.command === 'list' || options.command === 'search') {
    const issues = await fetchIssues(baseUrl, options.command === 'search' ? options.query : '', options.limit, token);

    if (options.json) {
      console.log(JSON.stringify(issues, null, 2));
      process.exit(0);
    }

    if (!Array.isArray(issues) || issues.length === 0) {
      console.log('No issues found.');
      process.exit(0);
    }

    if (options.brief) {
      for (const issue of issues) {
        console.log(formatBriefListIssue(issue));
      }
      process.exit(0);
    }

    console.log(`Results: ${issues.length}`);
    for (const issue of issues) {
      console.log('');
      console.log(formatListIssue(issue));
    }

    process.exit(0);
  }

  let attachments = [];
  if (options.attachments || options.attachmentInfo || options.downloadAttachment) {
    attachments = await loadAttachments(baseUrl, options.issueId, token);
  }

  if (options.command === 'attachments') {
    if (options.attachmentInfo) {
      const { attachment, error } = resolveAttachment(attachments, options.attachmentInfo);
      if (!attachment) {
        console.error(error);
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(attachment, null, 2));
        process.exit(0);
      }

      if (options.brief) {
        console.log(formatBriefAttachment(attachment));
        process.exit(0);
      }

      console.log(formatAttachment(attachment));
      process.exit(0);
    }

    if (options.downloadAttachment) {
      const { attachment, error } = resolveAttachment(attachments, options.downloadAttachment);
      if (!attachment) {
        console.error(error);
        process.exit(1);
      }

      const { content } = await downloadAttachment(baseUrl, attachment, token);

      if (options.stdout) {
        process.stdout.write(content);
        process.exit(0);
      }

      const targetPath = path.resolve(options.outputPath);
      await writeFile(targetPath, content, { flag: 'wx' });

      console.log(`Downloaded ${path.basename(targetPath)}`);
      console.log(targetPath);
      process.exit(0);
    }

    if (options.json) {
      console.log(JSON.stringify(attachments, null, 2));
      process.exit(0);
    }

    if (!Array.isArray(attachments) || attachments.length === 0) {
      console.log('No attachments.');
      process.exit(0);
    }

    if (options.brief) {
      for (const attachment of attachments) {
        console.log(formatBriefAttachment(attachment));
      }
      process.exit(0);
    }

    console.log(`Attachments: ${attachments.length}`);
    for (const attachment of attachments) {
      console.log('');
      console.log(formatAttachment(attachment));
    }
    process.exit(0);
  }

  const issue = await fetchIssue(baseUrl, options.issueId, token);

  if (options.command === 'fields') {
    if (options.fieldNames.length === 0) {
      const availableFields = listAvailableIssueFields(issue);

      if (options.json) {
        console.log(JSON.stringify(availableFields, null, 2));
        process.exit(0);
      }

      console.log('Available fields:');
      console.log('');
      console.log('Standard:');
      for (const fieldName of availableFields.standardFields) {
        console.log(`- ${fieldName}`);
      }

      console.log('');
      console.log('Custom:');
      if (availableFields.customFields.length === 0) {
        console.log('- none');
      } else {
        for (const fieldName of availableFields.customFields) {
          console.log(`- ${fieldName}`);
        }
      }

      process.exit(0);
    }

    const resolvedFields = resolveIssueFields(issue, options.fieldNames);
    if (resolvedFields.missing.length > 0) {
      console.error(`Unknown field(s): ${resolvedFields.missing.join(', ')}`);
      console.error('Use --fields to list the available field names.');
      process.exit(1);
    }

    if (options.json) {
      const payload = Object.fromEntries(
        resolvedFields.fields.map((field) => [field.name, field.rawValue])
      );
      console.log(JSON.stringify(payload, null, 2));
      process.exit(0);
    }

    for (const field of resolvedFields.fields) {
      if (field.textValue.includes('\n')) {
        console.log(`${field.name}:`);
        console.log(field.textValue);
        continue;
      }

      console.log(`${field.name}: ${field.textValue}`);
    }
    process.exit(0);
  }

  let comments = [];
  if (options.comments || options.commentsOnly) {
    comments = await loadComments(baseUrl, options.issueId, token);
  }

  let workItems = [];
  if (options.workItems) {
    workItems = await loadWorkItems(baseUrl, options.issueId, token);
  }

  if (options.json) {
    const payload = options.commentsOnly
      ? comments
      : options.linkedIssues
        ? getVisibleLinkGroups(issue)
        : options.spentTime
          ? { spentTime: getSpentTime(issue) }
          : options.workItems
            ? workItems
            : (options.comments ? { issue, comments } : issue);
    console.log(JSON.stringify(payload, null, 2));
    process.exit(0);
  }

  if (options.commentsOnly) {
    if (comments.length === 0) {
      console.log('No comments.');
      process.exit(0);
    }

    console.log(`Comments: ${comments.length}`);
    for (const comment of comments) {
      console.log('');
      console.log(`- ${formatUser(comment.author)} @ ${formatDate(comment.created)}`);
      console.log(comment.text || '-');
    }
    process.exit(0);
  }

  if (options.linkedIssues) {
    const visibleLinks = getVisibleLinks(issue);
    if (visibleLinks.length === 0) {
      console.log('No linked issues.');
      process.exit(0);
    }

    console.log(`Linked issue groups: ${visibleLinks.length}`);
    for (const link of visibleLinks) {
      console.log('');
      console.log(link);
    }
    process.exit(0);
  }

  if (options.workItems) {
    if (!Array.isArray(workItems) || workItems.length === 0) {
      console.log('No work items.');
      process.exit(0);
    }

    console.log(`Work items: ${workItems.length}`);
    for (const workItem of workItems) {
      console.log('');
      console.log(formatWorkItem(workItem));
    }
    process.exit(0);
  }

  if (options.spentTime) {
    console.log(getSpentTime(issue));
    process.exit(0);
  }

  console.log(`${issue.idReadable}: ${issue.summary || '-'}`);
  console.log(`Project: ${issue.project?.shortName || issue.project?.name || '-'}`);
  console.log(`State: ${getCustomFieldValue(issue, 'State')}`);
  console.log(`Type: ${getCustomFieldValue(issue, 'Type')}`);
  console.log(`Prio: ${getCustomFieldValue(issue, 'Prio')}`);
  console.log(`Reporter: ${formatUser(issue.reporter)}`);
  console.log(`Assignee: ${resolveAssignee(issue)}`);
  console.log(`Created: ${formatDate(issue.created)}`);
  console.log(`Updated: ${formatDate(issue.updated)}`);
  console.log(`Resolved: ${formatDate(issue.resolved)}`);

  if (Array.isArray(issue.tags) && issue.tags.length > 0) {
    console.log(`Tags: ${issue.tags.map((tag) => tag.name).join(', ')}`);
  }

  if (Array.isArray(issue.customFields) && issue.customFields.length > 0) {
    const visibleFields = issue.customFields.filter((field) => !HEADER_FIELD_NAMES.has(field.name));

    if (visibleFields.length > 0) {
      console.log('');
      console.log('Fields:');
      for (const field of visibleFields) {
        console.log(`- ${field.name}: ${formatFieldValue(field.value)}`);
      }
    }
  }

  if (Array.isArray(issue.links) && issue.links.length > 0) {
    const visibleLinks = getVisibleLinks(issue);

    if (visibleLinks.length > 0) {
      console.log('');
      console.log('Links:');
      for (const link of visibleLinks) {
        console.log(`- ${link}`);
      }
    }
  }

  if (issue.description) {
    console.log('');
    console.log('Description:');
    console.log(issue.description);
  }

  if (Array.isArray(comments) && comments.length > 0) {
    console.log('');
    console.log('Comments:');
    for (const comment of comments) {
      console.log('');
      console.log(`- ${formatUser(comment.author)} @ ${formatDate(comment.created)}`);
      console.log(comment.text || '-');
    }
  }
} catch (error) {
  console.error('YouTrack request failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

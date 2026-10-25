export interface ToolField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'email';
  placeholder?: string;
}

export interface MigrationTool {
  id: string;
  label: string;
  description: string;
  sourceLabel: string;
  fields: ToolField[];
  help: string;
  helpUrl: string;
}

export const MIGRATION_TOOLS: MigrationTool[] = [
  {
    id: 'clickup',
    label: 'ClickUp',
    description: 'Lists, statuses, assignees, subtasks, checklists and comments.',
    sourceLabel: 'List',
    fields: [{ name: 'token', label: 'Personal API token', type: 'password', placeholder: 'pk_…' }],
    help: 'In ClickUp, open your avatar → Settings → Apps, then generate an API token.',
    helpUrl: 'https://app.clickup.com/settings/apps',
  },
  {
    id: 'jira',
    label: 'Jira Cloud',
    description: 'Issues with types, statuses, priorities, sub-tasks and comments.',
    sourceLabel: 'Project',
    fields: [
      { name: 'site', label: 'Jira address', type: 'text', placeholder: 'your-team.atlassian.net' },
      { name: 'email', label: 'Your Atlassian email', type: 'email' },
      { name: 'token', label: 'API token', type: 'password' },
    ],
    help: 'Create an API token in your Atlassian account under Security → API tokens.',
    helpUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
  },
  {
    id: 'trello',
    label: 'Trello',
    description: 'Cards from every list, with members, labels, checklists and comments.',
    sourceLabel: 'Board',
    fields: [
      { name: 'key', label: 'API key', type: 'text' },
      { name: 'token', label: 'Token', type: 'password' },
    ],
    help: 'Create a Power-Up in the Trello admin portal, copy its API key, then generate a token from the same page.',
    helpUrl: 'https://trello.com/power-ups/admin',
  },
  {
    id: 'asana',
    label: 'Asana',
    description: 'Tasks by section, with subtasks, assignees, tags and comments.',
    sourceLabel: 'Project',
    fields: [{ name: 'token', label: 'Personal access token', type: 'password' }],
    help: 'In the Asana developer console, create a personal access token.',
    helpUrl: 'https://app.asana.com/0/my-apps',
  },
  {
    id: 'linear',
    label: 'Linear',
    description: 'Team issues with states, priorities, labels, sub-issues and comments.',
    sourceLabel: 'Team',
    fields: [{ name: 'apiKey', label: 'Personal API key', type: 'password', placeholder: 'lin_api_…' }],
    help: 'In Linear, go to Settings → Account → Security & access and create a personal API key.',
    helpUrl: 'https://linear.app/settings/account/security',
  },
  {
    id: 'github',
    label: 'GitHub Issues',
    description: 'Open and closed issues with labels, assignees, milestones and comments.',
    sourceLabel: 'Repository',
    fields: [
      { name: 'token', label: 'Personal access token', type: 'password', placeholder: 'github_pat_…' },
    ],
    help: 'Create a fine-grained token with read-only access to Issues for the repositories you want to import.',
    helpUrl: 'https://github.com/settings/personal-access-tokens/new',
  },
];

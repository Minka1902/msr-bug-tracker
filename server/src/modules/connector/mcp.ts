import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { userTimezone } from '../projects/routes';
import type { ConnectorAuth } from './oauth';
import { registerCalendarTools } from './tools/calendar';
import { registerHouseholdTools } from './tools/household';
import { registerProjectTools } from './tools/projects';
import { registerTaskTools } from './tools/tasks';
import type { ToolContext } from './tool';

const SERVER_INFO = { name: 'msr-tracker', title: 'MSR Tracker', version: '1.0.0' };
const INSTRUCTIONS =
  'MSR Tracker holds projects (software teams and households), their tasks, bugs, chores and errands, shopping lists and calendars. ' +
  'Projects have short keys like WEB; tasks have IDs like WEB-12. Start with list_projects or search, call fetch on a project to see its statuses, labels and members, ' +
  'and use those names when creating or updating tasks. Link to items with the url each tool returns.';

export const buildMcpServer = ({ user, scopes }: ConnectorAuth) => {
  const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
  const context: ToolContext = { user, timezone: userTimezone(user), canWrite: scopes.includes('write') };
  registerProjectTools(server, context);
  registerTaskTools(server, context);
  registerHouseholdTools(server, context);
  registerCalendarTools(server, context);
  return server;
};

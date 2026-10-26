import {
  FileJson,
  KeyRound,
  Link2,
  LogIn,
  MessageSquarePlus,
  Plug,
  Settings2,
  SquareTerminal,
  ToggleRight,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { CodeBlock } from '../../components/ui/CodeBlock';
import type { Step } from '../settings/components/StepList';

export type AgentId =
  'claude' | 'chatgpt' | 'claude-code' | 'cursor' | 'vscode' | 'codex' | 'gemini' | 'other';

export interface AgentGuide {
  id: AgentId;
  label: string;
  group: 'Chat apps' | 'Coding agents' | 'Other';
  steps: (url: string) => Step[];
}

const SERVER = 'msr-tracker';

const SIGN_IN = 'Sign in to MSR in the browser window that opens, then choose Allow.';

const inline = (text: ReactNode) => (
  <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-xs">{text}</code>
);

const command = (code: string) => <CodeBlock code={code} copyLabel="Command" wrap className="mt-2" />;

const config = (value: unknown, title?: string) => (
  <CodeBlock code={JSON.stringify(value, null, 2)} copyLabel="Config" title={title} className="mt-2" />
);

export const AGENT_GUIDES: AgentGuide[] = [
  {
    id: 'claude',
    label: 'Claude',
    group: 'Chat apps',
    steps: (url) => [
      { icon: <Settings2 />, text: 'In Claude, open Settings → Connectors and choose Add custom connector.' },
      { icon: <Link2 />, text: <>Name it MSR Tracker and paste {url} as the URL.</> },
      { icon: <LogIn />, text: 'Choose Connect, sign in to MSR if asked, then Allow.' },
      { icon: <MessageSquarePlus />, text: 'In a chat, switch MSR Tracker on from the tools menu.' },
    ],
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    group: 'Chat apps',
    steps: (url) => [
      {
        icon: <ToggleRight />,
        text: 'In ChatGPT, open Settings → Apps & Connectors → Advanced settings and turn on Developer mode.',
      },
      {
        icon: <Link2 />,
        text: <>Choose Create, name it MSR Tracker, paste {url} as the MCP server URL and pick OAuth.</>,
      },
      { icon: <LogIn />, text: 'Create it, sign in to MSR if asked, then Allow.' },
      {
        icon: <MessageSquarePlus />,
        text: 'In a chat, pick Developer mode from the + menu and add MSR Tracker.',
      },
    ],
  },
  {
    id: 'claude-code',
    label: 'Claude Code',
    group: 'Coding agents',
    steps: (url) => [
      {
        icon: <SquareTerminal />,
        text: (
          <>In a terminal, run:{command(`claude mcp add --transport http --scope user ${SERVER} ${url}`)}</>
        ),
      },
      {
        icon: <LogIn />,
        text: (
          <>
            Start Claude Code, run {inline('/mcp')}, pick {SERVER} and choose Authenticate.
          </>
        ),
      },
      { icon: <KeyRound />, text: SIGN_IN },
    ],
  },
  {
    id: 'cursor',
    label: 'Cursor',
    group: 'Coding agents',
    steps: (url) => [
      {
        icon: <Settings2 />,
        text: 'In Cursor, open Cursor Settings → Tools & MCP and choose New MCP Server.',
      },
      {
        icon: <FileJson />,
        text: (
          <>
            Add MSR Tracker to the file that opens:
            {config({ mcpServers: { [SERVER]: { url } } }, '~/.cursor/mcp.json')}
          </>
        ),
      },
      { icon: <LogIn />, text: `Back in Tools & MCP, choose Connect next to ${SERVER}.` },
      { icon: <KeyRound />, text: SIGN_IN },
    ],
  },
  {
    id: 'vscode',
    label: 'VS Code',
    group: 'Coding agents',
    steps: (url) => [
      {
        icon: <SquareTerminal />,
        text: <>Open the Command Palette and run {inline('MCP: Open User Configuration')}.</>,
      },
      {
        icon: <FileJson />,
        text: (
          <>
            Add MSR Tracker to the servers:
            {config({ servers: { [SERVER]: { type: 'http', url } } }, 'mcp.json')}
          </>
        ),
      },
      {
        icon: <LogIn />,
        text: (
          <>
            Choose Start above {SERVER}, then let VS Code sign in. {SIGN_IN}
          </>
        ),
      },
      {
        icon: <MessageSquarePlus />,
        text: 'In Copilot Chat, switch to Agent mode and turn on the MSR Tracker tools.',
      },
    ],
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    group: 'Coding agents',
    steps: (url) => [
      {
        icon: <SquareTerminal />,
        text: <>In a terminal, run:{command(`codex mcp add ${SERVER} --url ${url}`)}</>,
      },
      { icon: <LogIn />, text: <>Then sign in with:{command(`codex mcp login ${SERVER}`)}</> },
      { icon: <KeyRound />, text: SIGN_IN },
    ],
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    group: 'Coding agents',
    steps: (url) => [
      {
        icon: <SquareTerminal />,
        text: (
          <>In a terminal, run:{command(`gemini mcp add --transport http --scope user ${SERVER} ${url}`)}</>
        ),
      },
      { icon: <LogIn />, text: <>Start Gemini CLI and run {inline(`/mcp auth ${SERVER}`)}.</> },
      { icon: <KeyRound />, text: SIGN_IN },
    ],
  },
  {
    id: 'other',
    label: 'Another MCP client',
    group: 'Other',
    steps: (url) => [
      {
        icon: <Plug />,
        text: 'Add a remote MCP server (Streamable HTTP) with the connector URL above. Sign-in uses OAuth with discovery, dynamic client registration and PKCE, so there is no key to paste.',
      },
      {
        icon: <FileJson />,
        text: <>Most clients take this config:{config({ mcpServers: { [SERVER]: { url } } })}</>,
      },
      {
        icon: <SquareTerminal />,
        text: (
          <>
            If the client only runs local servers, bridge it with mcp-remote (needs Node.js):
            {config({ mcpServers: { [SERVER]: { command: 'npx', args: ['-y', 'mcp-remote', url] } } })}
          </>
        ),
      },
      { icon: <KeyRound />, text: SIGN_IN },
    ],
  },
];

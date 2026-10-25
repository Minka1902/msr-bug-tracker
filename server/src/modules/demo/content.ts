export interface ProjectTemplate {
  name: string;
  key: string;
  color: string;
  icon: string;
  description: string;
  areas: string[];
  labels: string[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    name: 'Website Redesign',
    key: 'WEB',
    color: '#4f56f0',
    icon: 'globe',
    description: 'New marketing site with a refreshed brand, faster pages and a self-serve pricing flow.',
    areas: [
      'homepage hero',
      'pricing page',
      'blog layout',
      'navigation menu',
      'footer',
      'contact form',
      'case studies page',
      'cookie banner',
    ],
    labels: ['frontend', 'ux', 'seo', 'accessibility', 'content'],
  },
  {
    name: 'Mobile App',
    key: 'APP',
    color: '#ec4899',
    icon: 'smartphone',
    description:
      'iOS and Android app for managing orders on the go, with offline mode and push notifications.',
    areas: [
      'login screen',
      'order list',
      'push notifications',
      'offline sync',
      'settings screen',
      'onboarding carousel',
      'dark mode',
      'deep links',
    ],
    labels: ['ios', 'android', 'ux', 'performance', 'regression'],
  },
  {
    name: 'Payments API',
    key: 'PAY',
    color: '#14b8a6',
    icon: 'credit-card',
    description: 'Payment service handling checkout, refunds, webhooks and reconciliation for every product.',
    areas: [
      'checkout endpoint',
      'refund flow',
      'webhook retries',
      'idempotency keys',
      'currency conversion',
      'invoice export',
      'rate limiter',
      'audit log',
    ],
    labels: ['backend', 'security', 'performance', 'compliance', 'regression'],
  },
  {
    name: 'Design System',
    key: 'DS',
    color: '#8b5cf6',
    icon: 'palette',
    description: 'Shared tokens and components used by every product team, documented in one place.',
    areas: [
      'button component',
      'color tokens',
      'date picker',
      'modal dialog',
      'data table',
      'icon set',
      'typography scale',
      'form fields',
    ],
    labels: ['components', 'tokens', 'accessibility', 'docs', 'frontend'],
  },
  {
    name: 'Analytics Dashboard',
    key: 'ANL',
    color: '#f59e0b',
    icon: 'chart-line',
    description: 'Self-serve reporting for customers: funnels, retention cohorts and scheduled exports.',
    areas: [
      'funnel chart',
      'retention cohorts',
      'CSV export',
      'date range filter',
      'scheduled reports',
      'KPI tiles',
      'saved views',
      'query cache',
    ],
    labels: ['frontend', 'backend', 'performance', 'data', 'ux'],
  },
  {
    name: 'Customer Portal',
    key: 'CP',
    color: '#0ea5e9',
    icon: 'building-2',
    description: 'Account area where customers manage seats, billing details, invoices and support tickets.',
    areas: [
      'billing page',
      'seat management',
      'invoice history',
      'support tickets',
      'SSO settings',
      'profile page',
      'usage meter',
      'plan upgrade',
    ],
    labels: ['frontend', 'backend', 'billing', 'security', 'ux'],
  },
  {
    name: 'Onboarding Revamp',
    key: 'ONB',
    color: '#22c55e',
    icon: 'rocket',
    description: 'Shorter signup, guided setup checklist and in-app tips to get new teams to value faster.',
    areas: [
      'signup form',
      'welcome email',
      'setup checklist',
      'product tour',
      'sample project',
      'invite teammates step',
      'empty states',
      'tooltips',
    ],
    labels: ['growth', 'ux', 'content', 'experiment', 'frontend'],
  },
  {
    name: 'Infrastructure',
    key: 'OPS',
    color: '#64748b',
    icon: 'server',
    description: 'Hosting, CI/CD, monitoring and on-call tooling shared by all services.',
    areas: [
      'CI pipeline',
      'staging cluster',
      'database backups',
      'log retention',
      'alerting rules',
      'CDN config',
      'secrets rotation',
      'autoscaling',
    ],
    labels: ['devops', 'security', 'monitoring', 'cost', 'reliability'],
  },
];

export const LEGACY_TEMPLATE: ProjectTemplate = {
  name: 'Legacy Site',
  key: 'OLD',
  color: '#94a3b8',
  icon: 'box',
  description: 'The previous marketing site, kept read-only for reference after the migration.',
  areas: ['old blog', 'contact page', 'redirect map', 'sitemap'],
  labels: ['legacy', 'content'],
};

export const LABEL_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#22c55e',
  '#ef4444',
  '#14b8a6',
  '#64748b',
];

export const TEAMMATES = [
  { name: 'Dana Levi', role: 'admin' },
  { name: 'Omar Haddad', role: 'member' },
  { name: 'Mia Chen', role: 'member' },
  { name: 'Yossi Cohen', role: 'qa' },
  { name: 'Lena Weiss', role: 'viewer' },
] as const;

export const TASK_TITLES = [
  'Design the {area}',
  'Implement the {area}',
  'Refactor the {area}',
  'Write tests for the {area}',
  'Add analytics events to the {area}',
  'Review copy on the {area}',
  'Improve loading time of the {area}',
  'Document the {area}',
  'Add empty and error states to the {area}',
  'Make the {area} responsive',
  'Spike: evaluate options for the {area}',
  'Polish animations in the {area}',
];

export const FEATURE_TITLES = [
  'Add filters to the {area}',
  'Support dark mode in the {area}',
  'Let users export from the {area}',
  'Add keyboard shortcuts to the {area}',
  'Show usage hints in the {area}',
  'Add bulk actions to the {area}',
];

export const IMPROVEMENT_TITLES = [
  'Reduce bundle size of the {area}',
  'Cache responses for the {area}',
  'Improve accessibility of the {area}',
  'Simplify the {area} flow',
  'Clean up tech debt in the {area}',
];

export const BUG_TITLES = [
  '{area} crashes when the session expires',
  '{area} shows a blank screen on Safari',
  'Double submit on the {area} creates duplicates',
  '{area} ignores the selected time zone',
  'Wrong totals in the {area} after refresh',
  '{area} layout breaks at 375px width',
  'Spinner never stops on the {area} when offline',
  '{area} loses unsaved changes on back navigation',
  'Screen reader skips the {area} buttons',
  '{area} returns 500 for names with emoji',
  'Slow query when opening the {area} with many items',
  'Dark mode colors unreadable in the {area}',
];

export const DESCRIPTIONS = [
  'We need this before the **{milestone}** milestone.\n\n- Align with the latest designs\n- Keep the current analytics events\n- Update the docs when done',
  'Context: customers keep asking about this in support tickets.\n\nAcceptance criteria:\n\n- [ ] Works on desktop and mobile\n- [ ] Covered by tests\n- [ ] Reviewed by design',
  'Follow-up from the last retro. Keep the scope small and ship behind a flag first.',
  'See the attached notes. The goal is to remove friction in the **{area}** without changing the API.',
];

export const OS_OPTIONS = [
  'iOS 18.2',
  'iOS 17.6',
  'Android 15',
  'Android 14',
  'macOS 15.1',
  'Windows 11',
  'Ubuntu 24.04',
];
export const BROWSERS = ['Safari 18', 'Chrome 131', 'Firefox 133', 'Edge 131', 'In-app WebView'];
export const VERSIONS = ['2.3.0', '2.3.1', '2.4.0', '2.4.1', '2.5.0-beta'];

export const COMMENTS = [
  'I can reproduce this on staging as well.',
  'Picking this up today.',
  'Pushed a fix to the branch — can someone verify?',
  'Design looks good to me 👍',
  'Should we split this into two tasks?',
  'Blocked until the API change is deployed.',
  'Added a screenshot of the current behavior.',
  'This also affects the mobile app.',
  'Moved to the next sprint, not critical right now.',
  'Verified on iOS and Android, closing.',
  'Can we get a quick review on this?',
  'Left a few comments on the PR.',
];

export const REPLIES = [
  'Thanks!',
  'Agreed.',
  'On it.',
  'Good catch, fixing now.',
  'Confirmed on my side too.',
  'Let’s sync tomorrow.',
];

export const CHECKLIST_ITEMS = [
  'Update designs',
  'Write unit tests',
  'Update documentation',
  'QA on staging',
  'Get product sign-off',
  'Add analytics',
  'Deploy behind a flag',
  'Announce in changelog',
];

export const SUBTASK_TITLES = [
  'Backend changes',
  'Frontend changes',
  'Write tests',
  'Update docs',
  'QA pass',
  'Design review',
];

export const MILESTONES = ['Q4 launch', 'beta', 'v2.5 release', 'holiday freeze'];

export const ATTACHMENTS = [
  { file: 'checkout-error.png', mime: 'image/png' },
  { file: 'mobile-layout.png', mime: 'image/png' },
  { file: 'chart-glitch.png', mime: 'image/png' },
  { file: 'form-validation.png', mime: 'image/png' },
  { file: 'console.log', mime: 'text/plain' },
];

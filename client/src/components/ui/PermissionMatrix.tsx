import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { can, PERMISSION_GROUPS, type Permission } from '@msr/shared/permissions';
import { cn } from '../../lib/cn';
import { Switch } from './Switch';
import { Tooltip } from './Tooltip';

export interface MatrixRole {
  id: string;
  name: string;
  permissions: number;
  locked?: boolean;
  header?: ReactNode;
}

interface PermissionMatrixProps {
  roles: MatrixRole[];
  permissions?: readonly Permission[];
  canToggle?: (role: MatrixRole, permission: Permission, next: boolean) => boolean;
  onToggle: (role: MatrixRole, permission: Permission, next: boolean) => void;
  className?: string;
}

export function PermissionMatrix({
  roles,
  permissions,
  canToggle = () => true,
  onToggle,
  className,
}: PermissionMatrixProps) {
  const template = {
    gridTemplateColumns: `minmax(220px, 1.6fr) repeat(${roles.length}, minmax(110px, 1fr))`,
  };
  const groups = PERMISSION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !permissions || permissions.includes(item.key)),
  })).filter((group) => group.items.length);

  return (
    <div
      className={cn('overflow-x-auto rounded-card border border-border bg-surface scrollbar-thin', className)}
    >
      <div role="table" aria-label="Role permissions" className="min-w-max">
        <div
          role="row"
          style={template}
          className="sticky top-0 z-10 grid items-center border-b border-border bg-surface-muted/95 backdrop-blur"
        >
          <div
            role="columnheader"
            className="px-4 py-3 text-xs font-semibold tracking-wide text-muted uppercase"
          >
            Permission
          </div>
          {roles.map((role) => (
            <div
              key={role.id}
              role="columnheader"
              className="flex items-center justify-center gap-1 px-2 py-3 text-sm font-semibold"
            >
              {role.locked && <Lock className="size-3.5 text-subtle" />}
              {role.header ?? role.name}
            </div>
          ))}
        </div>
        {groups.map((group) => (
          <div key={group.label} role="rowgroup">
            <div className="border-b border-border bg-surface-muted/40 px-4 py-2 text-xs font-semibold tracking-wide text-subtle uppercase">
              {group.label}
            </div>
            {group.items.map((item) => (
              <div
                key={item.key}
                role="row"
                style={template}
                className="grid items-center border-b border-border/60 last:border-b-0 hover:bg-surface-muted/40"
              >
                <div role="rowheader" className="flex flex-col px-4 py-2.5">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-xs text-muted">{item.description}</span>
                </div>
                {roles.map((role) => {
                  const enabled = can(role.permissions, item.key);
                  return (
                    <div key={role.id} role="cell" className="flex justify-center">
                      <Tooltip content={role.locked ? 'The owner always has every permission' : undefined}>
                        <span>
                          <Switch
                            size="sm"
                            checked={enabled}
                            disabled={role.locked || !canToggle(role, item.key, !enabled)}
                            onCheckedChange={(next) => onToggle(role, item.key, next)}
                          />
                        </span>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

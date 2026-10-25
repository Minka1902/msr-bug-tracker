import { LogOut } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import type { ShellUser } from './shellTypes';

interface UserCardProps {
  user: ShellUser;
  onLogout: () => void;
}

export function UserCard({ user, onLogout }: UserCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border/60 bg-surface p-3 shadow-card clean:shadow-none">
      <div className="flex items-center gap-3">
        <Avatar name={user.name} src={user.avatarUrl} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
      </div>
      <Button
        variant="secondary"
        block
        leftIcon={<LogOut />}
        onClick={onLogout}
        className="aurora:border-transparent aurora:bg-surface-inverted aurora:text-inverted aurora:hover:bg-surface-inverted/90"
      >
        Log out
      </Button>
    </div>
  );
}

import { cn } from '../../lib/cn';
import { Avatar, type AvatarProps } from './Avatar';

interface AvatarGroupProps {
  people: { id: string; name: string; avatarUrl?: string | null }[];
  max?: number;
  size?: AvatarProps['size'];
  className?: string;
}

export function AvatarGroup({ people, max = 3, size = 'sm', className }: AvatarGroupProps) {
  const visible = people.slice(0, max);
  const hidden = people.length - visible.length;

  return (
    <div className={cn('flex items-center -space-x-1.5', className)}>
      {visible.map((person) => (
        <Avatar key={person.id} name={person.name} src={person.avatarUrl} size={size} ring />
      ))}
      {hidden > 0 && (
        <span className="z-10 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-accent-soft px-1 text-[10px] font-semibold text-accent-text ring-2 ring-surface">
          +{hidden}
        </span>
      )}
    </div>
  );
}

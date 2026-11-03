import type { Conclusion, TaskCard } from '@msr/shared/types';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { RichTextEditor } from '../../../components/ui/RichTextEditor';
import { formatDateTime } from '../../../lib/dates';
import { TypeIcon } from '../../tasks/taskMeta';

interface ConclusionCardProps {
  conclusion: Conclusion;
  onOpen: (task: TaskCard) => void;
}

export function ConclusionCard({ conclusion, onOpen }: ConclusionCardProps) {
  return (
    <Card role="article" aria-label={conclusion.title} className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => onOpen(conclusion)}
        className="flex min-w-0 tap-size cursor-pointer items-center gap-2 rounded-control text-left hover:text-accent-text"
      >
        <TypeIcon type={conclusion.type} cardType={conclusion.cardType} className="size-4 shrink-0" />
        <span className="shrink-0 font-mono text-xs text-subtle">{conclusion.identifier}</span>
        <span className="min-w-0 flex-1 truncate font-semibold">{conclusion.title}</span>
      </button>
      <RichTextEditor
        value={conclusion.decision}
        editable={false}
        aria-label={`Decision on ${conclusion.identifier}`}
        className="text-sm"
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>Decided {formatDateTime(conclusion.completedAt!)}</span>
        {conclusion.assignee && (
          <span className="flex items-center gap-1">
            · <Avatar name={conclusion.assignee.name} src={conclusion.assignee.avatarUrl} size="xs" />
            {conclusion.assignee.name}
          </span>
        )}
        {conclusion.labels.map((label) => (
          <Badge key={label.id} color={label.color} label={label.name} size="sm" />
        ))}
      </div>
    </Card>
  );
}

import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';

interface NotFoundPageProps {
  title?: string;
  description?: string;
}

export function NotFoundPage({
  title = 'Page not found',
  description = "It may have been moved, or you don't have access to it.",
}: NotFoundPageProps) {
  return (
    <EmptyState
      icon={<Compass />}
      title={title}
      description={description}
      action={
        <Button asChild variant="secondary">
          <Link to="/">Back to dashboard</Link>
        </Button>
      }
    />
  );
}

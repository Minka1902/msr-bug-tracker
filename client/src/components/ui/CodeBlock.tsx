import { Copy } from 'lucide-react';
import { copyText } from '../../lib/clipboard';
import { cn } from '../../lib/cn';
import { IconButton } from './IconButton';

interface CodeBlockProps {
  code: string;
  copyLabel: string;
  title?: string;
  wrap?: boolean;
  className?: string;
}

export function CodeBlock({ code, copyLabel, title, wrap, className }: CodeBlockProps) {
  return (
    <div
      className={cn('overflow-hidden rounded-control border border-border bg-surface-muted/60', className)}
    >
      {title && (
        <div className="border-b border-border px-3 py-1.5 font-mono text-[11px] text-muted">{title}</div>
      )}
      <div className="flex items-start gap-2 py-1 pr-1 pl-3">
        <pre
          className={cn(
            'min-w-0 flex-1 py-1.5 font-mono text-xs',
            wrap ? 'break-all whitespace-pre-wrap' : 'overflow-x-auto whitespace-pre',
          )}
        >
          <code>{code}</code>
        </pre>
        <IconButton
          icon={<Copy />}
          label={`Copy ${copyLabel.charAt(0).toLowerCase()}${copyLabel.slice(1)}`}
          onClick={() => copyText(code, copyLabel)}
        />
      </div>
    </div>
  );
}

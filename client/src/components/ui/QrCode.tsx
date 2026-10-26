import { Download } from 'lucide-react';
import { useMemo } from 'react';
import { encode } from 'uqr';
import { cn } from '../../lib/cn';
import { downloadText } from '../../lib/download';
import { Button } from './Button';

interface QrCodeProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  margin?: number;
  title?: string;
  caption?: string;
  downloadName?: string;
  className?: string;
}

const toPath = (data: boolean[][]) =>
  data
    .map((row, y) => {
      let path = '';
      for (let x = 0; x < row.length; x += 1) {
        if (!row[x]) continue;
        let run = 1;
        while (row[x + run]) run += 1;
        path += `M${x} ${y}h${run}v1h-${run}z`;
        x += run - 1;
      }
      return path;
    })
    .join('');

export function QrCode({
  value,
  size = 192,
  level = 'M',
  margin = 2,
  title = 'QR code',
  caption,
  downloadName,
  className,
}: QrCodeProps) {
  const download = () =>
    downloadText(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qr.modules} ${qr.modules}" width="1024" height="1024" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${qr.path}" fill="#000"/></svg>`,
      `${downloadName}.svg`,
      'image/svg+xml',
    );

  const qr = useMemo(() => {
    const { data, size: modules } = encode(value, { ecc: level, border: margin });
    return { path: toPath(data), modules };
  }, [value, level, margin]);

  return (
    <figure className={cn('inline-flex flex-col items-center gap-2', className)}>
      <svg
        role="img"
        aria-label={title}
        viewBox={`0 0 ${qr.modules} ${qr.modules}`}
        width={size}
        height={size}
        shapeRendering="crispEdges"
        className="rounded-[calc(var(--r-control)-2px)] bg-white shadow-xs ring-1 ring-border"
      >
        <path d={qr.path} fill="#000" />
      </svg>
      {caption && <figcaption className="max-w-[16rem] text-center text-xs text-muted">{caption}</figcaption>}
      {downloadName && (
        <Button size="xs" variant="ghost" leftIcon={<Download />} onClick={download}>
          Download QR code
        </Button>
      )}
    </figure>
  );
}

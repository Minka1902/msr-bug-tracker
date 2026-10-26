import { Copy, Download } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { copyText } from '../../../lib/clipboard';
import { downloadText } from '../../../lib/download';

interface RecoveryCodesProps {
  codes: string[];
  fileName?: string;
}

export function RecoveryCodes({ codes, fileName = 'msr-recovery-codes' }: RecoveryCodesProps) {
  const text = codes.join('\n');

  return (
    <div className="flex flex-col gap-3">
      <ul
        aria-label="Recovery codes"
        className="grid grid-cols-2 gap-2 rounded-control border border-border bg-surface-muted/60 p-3 font-mono text-sm"
      >
        {codes.map((code) => (
          <li key={code} className="text-center">
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<Copy />}
          onClick={() => copyText(text, 'Recovery codes')}
        >
          Copy
        </Button>
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<Download />}
          onClick={() => downloadText(`MSR Tracker recovery codes\n\n${text}\n`, `${fileName}.txt`)}
        >
          Download
        </Button>
      </div>
    </div>
  );
}

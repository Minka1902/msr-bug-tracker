import { Input } from '../../../components/ui/Input';

interface OneTimeCodeInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  recovery?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
}

export function OneTimeCodeInput({
  id,
  value,
  onChange,
  recovery,
  autoFocus,
  invalid,
}: OneTimeCodeInputProps) {
  return recovery ? (
    <Input
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="xxxxx-xxxxx"
      autoComplete="off"
      autoCapitalize="none"
      spellCheck={false}
      maxLength={20}
      autoFocus={autoFocus}
      invalid={invalid}
      className="font-mono"
    />
  ) : (
    <Input
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
      placeholder="123456"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      autoFocus={autoFocus}
      invalid={invalid}
      className="font-mono text-lg tracking-[0.4em]"
    />
  );
}

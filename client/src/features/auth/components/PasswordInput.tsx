import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { IconButton } from '../../../components/ui/IconButton';
import { Input, type InputProps } from '../../../components/ui/Input';

export function PasswordInput(props: Omit<InputProps, 'type' | 'rightSlot'>) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      type={visible ? 'text' : 'password'}
      rightSlot={
        <IconButton
          icon={visible ? <EyeOff /> : <Eye />}
          label={visible ? 'Hide password' : 'Show password'}
          size="xs"
          tooltip={false}
          onClick={() => setVisible(!visible)}
        />
      }
      {...props}
    />
  );
}

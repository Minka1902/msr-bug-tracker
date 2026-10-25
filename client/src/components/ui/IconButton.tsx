import type { ReactNode } from 'react';
import { Button, type ButtonProps } from './Button';
import { Tooltip } from './Tooltip';

interface IconButtonProps extends Omit<ButtonProps, 'size' | 'leftIcon' | 'rightIcon' | 'children'> {
  icon: ReactNode;
  label: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  tooltip?: boolean;
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
}

export function IconButton({
  icon,
  label,
  size = 'sm',
  variant = 'ghost',
  tooltip = true,
  tooltipSide,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip content={label} side={tooltipSide} disabled={!tooltip}>
      <Button aria-label={label} size={`icon-${size}`} variant={variant} {...props}>
        {icon}
      </Button>
    </Tooltip>
  );
}

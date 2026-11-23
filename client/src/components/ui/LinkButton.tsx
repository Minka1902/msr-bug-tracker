import type { ComponentProps, ReactNode } from 'react';
import { Button, type ButtonProps } from './Button';

interface LinkButtonProps extends ComponentProps<'a'>, Pick<ButtonProps, 'size' | 'variant' | 'block'> {
  href: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function LinkButton({
  href,
  size = 'sm',
  variant = 'soft',
  block,
  leftIcon,
  rightIcon,
  children,
  target = href.startsWith('http') ? '_blank' : undefined,
  ...props
}: LinkButtonProps) {
  return (
    <Button asChild size={size} variant={variant} block={block} leftIcon={leftIcon} rightIcon={rightIcon}>
      <a href={href} target={target} rel="noopener noreferrer" {...props}>
        {children}
      </a>
    </Button>
  );
}

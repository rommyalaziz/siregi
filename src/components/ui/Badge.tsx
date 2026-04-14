import type { ReactNode } from 'react';

export type BadgeVariant = 'on-track' | 'delayed' | 'critical';

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
}

export const Badge = ({ variant, children }: BadgeProps) => {
  return (
    <span className={`badge ${variant}`}>
      {children}
    </span>
  );
};

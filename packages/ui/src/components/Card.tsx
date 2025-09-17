import React from 'react';
import { cn } from '../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'outlined' | 'elevated';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className,
  ...props
}) => {
  const variants = {
    default: 'bg-white border border-secondary-200',
    outlined: 'bg-white border-2 border-secondary-300',
    elevated: 'bg-white shadow-soft',
  };

  return (
    <div
      className={cn('rounded-xl p-6', variants[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
};

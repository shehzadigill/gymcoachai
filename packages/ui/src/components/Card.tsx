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
    default:
      'bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700',
    outlined:
      'bg-white border-2 border-gray-300 dark:bg-gray-800 dark:border-gray-600',
    elevated: 'bg-white shadow-soft dark:bg-gray-800 dark:shadow-gray-900/25',
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

import React from 'react';
import clsx from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  clickable?: boolean;
  selected?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = 'default',
  padding = 'md',
  hover = false,
  clickable = false,
  selected = false,
  ...props
}) => {
  const baseStyles = 'card';
  const variantStyles = {
    default: 'card-default',
    outlined: 'card-outlined',
    elevated: 'card-elevated',
  };
  const paddingStyles = {
    none: 'card-padding-none',
    sm: 'card-padding-sm',
    md: 'card-padding-md',
    lg: 'card-padding-lg',
  };

  const cardClass = clsx(
    baseStyles,
    variantStyles[variant],
    paddingStyles[padding],
    {
      'card-hover': hover,
      'card-clickable': clickable,
      'card-selected': selected,
    },
    className
  );

  return (
    <div className={cardClass} {...props}>
      {children}
    </div>
  );
};

export default Card;
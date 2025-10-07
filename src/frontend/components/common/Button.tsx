import React from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  ...props
}) => {
  const baseStyles = 'btn';
  const variantStyles = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  };
  const sizeStyles = {
    sm: 'btn-sm',
    md: 'btn-md',
    lg: 'btn-lg',
  };

  const buttonClass = clsx(
    baseStyles,
    variantStyles[variant],
    sizeStyles[size],
    {
      'btn-full': fullWidth,
      'btn-loading': loading,
      'btn-disabled': disabled || loading,
    },
    className
  );

  const renderIcon = () => {
    if (loading) {
      return <Loader2 className="animate-spin" size={16} />;
    }
    return icon;
  };

  return (
    <button
      className={buttonClass}
      disabled={disabled || loading}
      {...props}
    >
      {icon && iconPosition === 'left' && (
        <span className="btn-icon-left">{renderIcon()}</span>
      )}
      <span className="btn-content">{children}</span>
      {icon && iconPosition === 'right' && (
        <span className="btn-icon-right">{renderIcon()}</span>
      )}
    </button>
  );
};

export default Button;
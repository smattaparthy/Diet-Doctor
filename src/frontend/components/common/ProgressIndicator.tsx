import React from 'react';
import clsx from 'clsx';

interface ProgressIndicatorProps {
  progress: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  size = 'md',
  showLabel = false,
  label,
  color = 'primary',
}) => {
  const roundedProgress = Math.round(progress);

  const sizeStyles = {
    sm: 'progress-sm',
    md: 'progress-md',
    lg: 'progress-lg',
  };

  const colorStyles = {
    primary: 'progress-primary',
    secondary: 'progress-secondary',
    success: 'progress-success',
    warning: 'progress-warning',
    error: 'progress-error',
  };

  return (
    <div className={clsx('progress-container', sizeStyles[size])}>
      {showLabel && (
        <div className="progress-label">
          <span>{label || `${roundedProgress}%`}</span>
        </div>
      )}
      <div className={clsx('progress-bar', sizeStyles[size], colorStyles[color])}>
        <div
          className="progress-fill"
          style={{ width: `${Math.min(100, Math.max(0, roundedProgress))}%` }}
          role="progressbar"
          aria-valuenow={roundedProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label || `Progress: ${roundedProgress}%`}
        >
          {roundedProgress > 10 && (
            <span className="progress-text">{roundedProgress}%</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressIndicator;
import React from 'react';

interface ProgressBarProps {
  percentage: number;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  label?: string;
  showPercentage?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  variant = 'primary',
  label,
  showPercentage = true
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'success':
        return 'bg-success-500';
      case 'warning':
        return 'bg-warning-500';
      case 'danger':
        return 'bg-danger-500';
      default:
        return 'bg-primary-500';
    }
  };

  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && <span className="text-xs text-gray-600">{label}</span>}
          {showPercentage && <span className="text-xs font-medium text-gray-900">{clampedPercentage.toFixed(2)}%</span>}
        </div>
      )}
      <div className="progress-bar">
        <div 
          className={`progress-fill ${getVariantClasses()}`}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;

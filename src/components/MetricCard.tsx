import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import ProgressBar from './ProgressBar';

interface MetricDetail {
  label: string;
  value: string;
}

interface MetricCardProps {
  title: string;
  value?: string;
  subtitle?: string;
  trend?: number;
  trendLabel?: string;
  progress?: number;
  progressLabel?: string;
  details?: MetricDetail[];
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  icon?: React.ReactNode;
  showProgress?: boolean;
  onValueClick?: (title: string) => void;
  onDetailClick?: (title: string) => void;
  onClick?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  progress,
  progressLabel,
  details = [],
  variant = 'primary',
  icon,
  showProgress = false,
  onValueClick,
  onDetailClick,
  onClick
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'success':
        return 'border-success-500 bg-success-50';
      case 'warning':
        return 'border-warning-500 bg-warning-50';
      case 'danger':
        return 'border-danger-500 bg-danger-50';
      default:
        return 'border-primary-500 bg-primary-50';
    }
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    return trend > 0 ? (
      <TrendingUp className="h-4 w-4 text-green-600" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-600" />
    );
  };

  const getTrendColor = () => {
    if (!trend) return '';
    return trend > 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div 
      className={`metric-card ${variant} animate-slide-up ${getVariantClasses()} ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          {icon && <div className="mr-2 opacity-80">{icon}</div>}
          <h3 className="text-sm font-medium text-gray-600 leading-tight">{title}</h3>
        </div>
        {trend !== undefined && (
          <div className="flex items-center space-x-1">
            {getTrendIcon()}
            <span className={`text-xs font-medium ${getTrendColor()}`}>
              {trendLabel}
            </span>
          </div>
        )}
      </div>

      {/* Main Value */}
      {value && (
        <div className="mb-2">
          <div 
            className={`text-3xl font-bold text-gray-900 mb-1 ${onValueClick ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''}`}
            onClick={() => onValueClick && onValueClick(title)}
          >
            {value}
          </div>
          {subtitle && <div className="text-sm text-gray-600">{subtitle}</div>}
        </div>
      )}

      {/* Progress Bar */}
      {(progress !== undefined || showProgress) && (
        <div className="mb-4">
          <ProgressBar 
            percentage={progress || 0} 
            variant={variant}
            label={progressLabel}
          />
        </div>
      )}

      {/* Details */}
      {details.length > 0 && (
        <div className="space-y-2">
          {details.map((detail, index) => (
            <div key={index} className="flex justify-between items-center">
              <span className="text-xs text-gray-600">{detail.label}</span>
              <span 
                className={`text-xs font-medium text-gray-900 ${onDetailClick ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''}`}
                onClick={() => onDetailClick && onDetailClick(title)}
              >
                {detail.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MetricCard;

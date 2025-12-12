import React from 'react';
import { ExternalLink } from 'lucide-react';

interface SimpleMetricCardProps {
  title: string;
  value: string;
  onClick?: () => void;
  isClickable?: boolean;
}

const SimpleMetricCard: React.FC<SimpleMetricCardProps> = ({ title, value, onClick, isClickable = false }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <div 
        className={`text-3xl font-bold mb-1 ${
          isClickable 
            ? 'text-blue-600 cursor-pointer hover:text-blue-800 hover:underline flex items-center gap-2' 
            : 'text-gray-900'
        }`}
        onClick={isClickable ? onClick : undefined}
        title={isClickable ? `Click to view detailed ${title.toLowerCase()} data` : undefined}
      >
        {value}
        {isClickable && <ExternalLink className="h-5 w-5 text-blue-600" />}
      </div>
    </div>
  );
};

export default SimpleMetricCard;

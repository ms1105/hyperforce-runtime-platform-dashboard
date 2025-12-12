import React from 'react';
import { Activity, TrendingUp, Target, Zap, ExternalLink } from 'lucide-react';

interface AuditSummaryProps {
  auditSummary: {
    replicas: { total: number; count: number; average: number };
    azDistrib: { total: number; count: number; average: number };
    hpa: { total: number; count: number; average: number };
    livenessProbe: { total: number; count: number; average: number };
  };
  totalServices: number;
  onMetricClick?: (metricType: string) => void;
}

const AuditSummaryView: React.FC<AuditSummaryProps> = ({ auditSummary, totalServices, onMetricClick }) => {
  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (percentage >= 60) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (percentage >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getIconColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-blue-600';
    if (percentage >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const auditItems = [
    {
      name: 'Replicas',
      icon: <Activity className="h-6 w-6" />,
      data: auditSummary.replicas,
      description: 'Service replica configuration',
      navTarget: 'binpacking'
    },
    {
      name: 'AZ Distribution',
      icon: <Target className="h-6 w-6" />,
      data: auditSummary.azDistrib,
      description: 'Multi-availability zone coverage',
      navTarget: 'multiaz'
    },
    {
      name: 'HPA',
      icon: <Zap className="h-6 w-6" />,
      data: auditSummary.hpa,
      description: 'Horizontal Pod Autoscaler adoption',
      navTarget: 'autoscaling'
    },
    {
      name: 'Liveness Probe',
      icon: <TrendingUp className="h-6 w-6" />,
      data: auditSummary.livenessProbe,
      description: 'Health check configuration',
      navTarget: 'multiaz'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Overall Audit Summary</h2>
        <p className="text-gray-600">Service performance across all audit categories</p>
        <div className="mt-4 text-sm text-gray-500">
          Total Services Analyzed: <span className="font-semibold text-gray-900">{totalServices.toLocaleString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {auditItems.map((item) => (
          <div 
            key={item.name} 
            className={`bg-white rounded-lg shadow-sm border transition-all duration-200 ${
              onMetricClick ? 'cursor-pointer hover:shadow-lg hover:border-blue-400 hover:scale-102 transform' : ''
            }`}
            onClick={() => onMetricClick && onMetricClick(item.navTarget)}
            title={onMetricClick ? `Click to view detailed ${item.name.toLowerCase()} service list` : undefined}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${getIconColor(item.data.average)}`}>
                  {item.icon}
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getScoreColor(item.data.average)}`}>
                    {item.data.average.toFixed(2)}%
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                {onMetricClick && (
                  <ExternalLink className="h-4 w-4 text-blue-500 opacity-70 hover:opacity-100 transition-opacity" />
                )}
              </div>
              <p className="text-sm text-gray-600 mb-3">{item.description}</p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Services with data:</span>
                  <span className="font-medium">{item.data.count.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Coverage:</span>
                  <span className="font-medium">{((item.data.count / totalServices) * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total score:</span>
                  <span className="font-medium">{item.data.total.toFixed(0)}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Performance</span>
                  <span>{item.data.average.toFixed(2)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      item.data.average >= 80 ? 'bg-green-500' :
                      item.data.average >= 60 ? 'bg-blue-500' :
                      item.data.average >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(item.data.average, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default AuditSummaryView;

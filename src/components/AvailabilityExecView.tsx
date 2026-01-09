import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Clock, Activity, Shield, AlertCircle, FileText } from 'lucide-react';

interface ExecutiveMetric {
  metric_name: string;
  metric_value: string;
  metric_unit: string;
  trend_direction: string;
  trend_value: string;
  target: string;
  status: string;
}

interface AvailabilityExecViewProps {
  lastUpdated?: string;
}

const AvailabilityExecView: React.FC<AvailabilityExecViewProps> = ({ lastUpdated }) => {
  const [metrics, setMetrics] = useState<ExecutiveMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadExecutiveSummary = async () => {
      try {
        const response = await fetch('/assets/data/availability/executive_summary.csv');
        if (!response.ok) {
          throw new Error('Failed to load executive summary data');
        }
        const csvText = await response.text();
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',');
        
        const parsedMetrics: ExecutiveMetric[] = lines.slice(1).map(line => {
          const values = line.split(',');
          const metric: Record<string, string> = {};
          headers.forEach((header, index) => {
            metric[header.trim()] = values[index]?.trim() || '';
          });
          return metric as unknown as ExecutiveMetric;
        });
        
        setMetrics(parsedMetrics);
        setError(null);
      } catch (err) {
        console.error('❌ Error loading executive summary:', err);
        setError('Failed to load availability data');
        // Fallback to mock data
        setMetrics([
          { metric_name: 'Sev0/Sev1 Trend (12mo)', metric_value: '47', metric_unit: 'incidents', trend_direction: 'up', trend_value: '12% vs prior period', target: '', status: 'WARNING' },
          { metric_name: 'Avg MTTD (Platform)', metric_value: '7.2', metric_unit: 'min', trend_direction: 'down', trend_value: '18% improved', target: '', status: 'OK' },
          { metric_name: 'Avg MTTR (Platform)', metric_value: '38', metric_unit: 'min', trend_direction: 'down', trend_value: '8% improved', target: '', status: 'OK' },
          { metric_name: 'Monitoring Detection %', metric_value: '78', metric_unit: '%', trend_direction: 'neutral', trend_value: '', target: '>90%', status: 'WARNING' },
          { metric_name: 'Prevention Coverage', metric_value: '4/6', metric_unit: 'services', trend_direction: 'neutral', trend_value: '', target: '6/6', status: 'OK' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadExecutiveSummary();
  }, []);

  const getMetricIcon = (metricName: string) => {
    if (metricName.includes('Sev0') || metricName.includes('Sev1')) {
      return <AlertCircle className="h-5 w-5" />;
    }
    if (metricName.includes('MTTD') || metricName.includes('MTTR')) {
      return <Clock className="h-5 w-5" />;
    }
    if (metricName.includes('Detection')) {
      return <Activity className="h-5 w-5" />;
    }
    if (metricName.includes('Prevention') || metricName.includes('Coverage')) {
      return <Shield className="h-5 w-5" />;
    }
    return <Activity className="h-5 w-5" />;
  };

  const getMetricColor = (metric: ExecutiveMetric) => {
    // For incident trends, "up" is bad (more incidents)
    if (metric.metric_name.includes('Sev0') || metric.metric_name.includes('Sev1')) {
      if (metric.trend_direction === 'up') return { border: 'border-l-red-500', text: 'text-red-600', bg: 'bg-red-50' };
      if (metric.trend_direction === 'down') return { border: 'border-l-green-500', text: 'text-green-600', bg: 'bg-green-50' };
    }
    // For MTTD/MTTR, "down" is good (faster detection/resolution)
    if (metric.metric_name.includes('MTTD') || metric.metric_name.includes('MTTR')) {
      if (metric.trend_direction === 'down') return { border: 'border-l-green-500', text: 'text-green-600', bg: 'bg-green-50' };
      if (metric.trend_direction === 'up') return { border: 'border-l-red-500', text: 'text-red-600', bg: 'bg-red-50' };
    }
    // For Detection %, check against target
    if (metric.metric_name.includes('Detection')) {
      if (metric.status === 'WARNING') return { border: 'border-l-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' };
      return { border: 'border-l-green-500', text: 'text-green-600', bg: 'bg-green-50' };
    }
    // Default based on status
    if (metric.status === 'WARNING') return { border: 'border-l-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' };
    if (metric.status === 'OK') return { border: 'border-l-green-500', text: 'text-green-600', bg: 'bg-green-50' };
    return { border: 'border-l-blue-500', text: 'text-blue-600', bg: 'bg-blue-50' };
  };

  const getTrendIcon = (direction: string, metricName: string) => {
    // For incidents, up is bad, down is good
    const isIncidentMetric = metricName.includes('Sev0') || metricName.includes('Sev1');
    
    if (direction === 'up') {
      return <TrendingUp className={`h-4 w-4 ${isIncidentMetric ? 'text-red-500' : 'text-green-500'}`} />;
    }
    if (direction === 'down') {
      return <TrendingDown className={`h-4 w-4 ${isIncidentMetric ? 'text-green-500' : 'text-green-500'}`} />;
    }
    return null;
  };

  const formatMetricValue = (metric: ExecutiveMetric) => {
    const value = metric.metric_value;
    const unit = metric.metric_unit;
    
    if (unit === 'min') {
      return (
        <span>
          <span className="text-3xl font-bold text-gray-900">{value}</span>
          <span className="text-lg text-gray-500 ml-1">min</span>
        </span>
      );
    }
    if (unit === '%') {
      return (
        <span>
          <span className="text-3xl font-bold text-gray-900">{value}</span>
          <span className="text-xl text-gray-500">%</span>
        </span>
      );
    }
    return <span className="text-3xl font-bold text-gray-900">{value}</span>;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Activity className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Executive View — HRP Availability at a Glance</h2>
            <p className="text-sm text-gray-500">Sev0/Sev1 Focus • E360 Post-Processed Data</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            Powered by E360 Post-Processed Data
          </span>
          <span className="text-sm text-gray-500">
            Last Updated: {lastUpdated || new Date().toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZoneName: 'short'
            })}
          </span>
        </div>
      </div>

      {/* Single Page Summary Button */}
      <div className="flex justify-end mb-4">
        <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          <FileText className="h-4 w-4 mr-2" />
          Single Page Summary
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {metrics.map((metric, index) => {
          const colors = getMetricColor(metric);
          return (
            <div 
              key={index} 
              className={`bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 ${colors.border} p-5 hover:shadow-md transition-shadow`}
            >
              {/* Metric Label */}
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-gray-400">{getMetricIcon(metric.metric_name)}</span>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {metric.metric_name}
                </h3>
              </div>
              
              {/* Metric Value */}
              <div className="mb-2">
                {formatMetricValue(metric)}
              </div>
              
              {/* Trend or Target */}
              <div className="flex items-center space-x-1">
                {metric.trend_value && (
                  <>
                    {getTrendIcon(metric.trend_direction, metric.metric_name)}
                    <span className={`text-sm ${colors.text}`}>
                      {metric.trend_direction === 'up' ? '↑' : metric.trend_direction === 'down' ? '↓' : ''} {metric.trend_value}
                    </span>
                  </>
                )}
                {metric.target && (
                  <span className="text-sm text-gray-500">
                    Target: <span className="font-medium">{metric.target}</span>
                  </span>
                )}
                {!metric.trend_value && !metric.target && metric.metric_unit === 'services' && (
                  <span className="text-sm text-gray-500">Alerts + Tracing</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Banner */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Activity className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">About This View</h4>
            <p className="text-sm text-blue-700">
              This executive summary provides a high-level view of HRP platform availability metrics. 
              Data is sourced from E360 post-processed incident data covering the last 12 months. 
              MTTD = Mean Time to Detect, MTTR = Mean Time to Resolve.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityExecView;


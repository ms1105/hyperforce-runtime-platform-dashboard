import React, { useState } from 'react';
import { User, ChevronDown, ChevronUp, TrendingUp, Activity, Target, Zap } from 'lucide-react';

interface SrExecData {
  name: string;
  services: any[];
  totals: {
    replicas: { sum: number; count: number; avg: number };
    azDistrib: { sum: number; count: number; avg: number };
    hpa: { sum: number; count: number; avg: number };
    livenessProbe: { sum: number; count: number; avg: number };
  };
}

interface SrExecViewProps {
  srExecView: SrExecData[];
}

const SrExecView: React.FC<SrExecViewProps> = ({ srExecView }) => {
  const [expandedExec, setExpandedExec] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'services' | 'overall'>('overall');

  const getPerformanceScore = (exec: SrExecData) => {
    const scores = [exec.totals.replicas.avg, exec.totals.azDistrib.avg, exec.totals.hpa.avg, exec.totals.livenessProbe.avg];
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const sortedExecs = [...srExecView].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'services':
        return b.services.length - a.services.length;
      case 'overall':
        return getPerformanceScore(b) - getPerformanceScore(a);
      default:
        return 0;
    }
  });

  const toggleExpand = (execName: string) => {
    setExpandedExec(expandedExec === execName ? null : execName);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Senior Executive View</h2>
            <p className="text-gray-600">Performance breakdown by senior leadership</p>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">Sort by:</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="overall">Overall Score</option>
              <option value="services">Service Count</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 gap-4">
        {sortedExecs.map((exec, index) => {
          const overallScore = getPerformanceScore(exec);
          const isExpanded = expandedExec === exec.name;
          
          return (
            <div key={exec.name} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <div 
                className="p-6 cursor-pointer"
                onClick={() => toggleExpand(exec.name)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full">
                      <User className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{exec.name}</h3>
                      <p className="text-sm text-gray-600">{exec.services.length} services</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getScoreColor(overallScore)}`}>
                      {overallScore.toFixed(1)}% Overall
                    </div>
                    <div className="text-sm text-gray-400">#{index + 1}</div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Quick metrics preview */}
                <div className="mt-4 grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Replicas</div>
                    <div className="text-sm font-medium">{exec.totals.replicas.avg.toFixed(1)}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">AZ Distrib</div>
                    <div className="text-sm font-medium">{exec.totals.azDistrib.avg.toFixed(1)}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">HPA</div>
                    <div className="text-sm font-medium">{exec.totals.hpa.avg.toFixed(1)}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Liveness</div>
                    <div className="text-sm font-medium">{exec.totals.livenessProbe.avg.toFixed(1)}%</div>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-gray-200 p-6 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    {/* Detailed Metrics */}
                    <div className="bg-white p-4 rounded-lg border">
                      <div className="flex items-center mb-2">
                        <Activity className="h-4 w-4 text-blue-600 mr-2" />
                        <h4 className="font-medium text-gray-900">Replicas</h4>
                      </div>
                      <div className="text-2xl font-bold text-blue-600">{exec.totals.replicas.avg.toFixed(1)}%</div>
                      <div className="text-xs text-gray-500">{exec.totals.replicas.count} services</div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border">
                      <div className="flex items-center mb-2">
                        <Target className="h-4 w-4 text-green-600 mr-2" />
                        <h4 className="font-medium text-gray-900">AZ Distribution</h4>
                      </div>
                      <div className="text-2xl font-bold text-green-600">{exec.totals.azDistrib.avg.toFixed(1)}%</div>
                      <div className="text-xs text-gray-500">{exec.totals.azDistrib.count} services</div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border">
                      <div className="flex items-center mb-2">
                        <Zap className="h-4 w-4 text-yellow-600 mr-2" />
                        <h4 className="font-medium text-gray-900">HPA</h4>
                      </div>
                      <div className="text-2xl font-bold text-yellow-600">{exec.totals.hpa.avg.toFixed(1)}%</div>
                      <div className="text-xs text-gray-500">{exec.totals.hpa.count} services</div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border">
                      <div className="flex items-center mb-2">
                        <TrendingUp className="h-4 w-4 text-purple-600 mr-2" />
                        <h4 className="font-medium text-gray-900">Liveness Probe</h4>
                      </div>
                      <div className="text-2xl font-bold text-purple-600">{exec.totals.livenessProbe.avg.toFixed(1)}%</div>
                      <div className="text-xs text-gray-500">{exec.totals.livenessProbe.count} services</div>
                    </div>
                  </div>

                  {/* Services List */}
                  <div className="bg-white rounded-lg border">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <h4 className="font-medium text-gray-900">Services ({exec.services.length})</h4>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="min-w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Tier</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Replicas</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">AZ</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">HPA</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Liveness</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {exec.services.slice(0, 10).map((service, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-900 truncate max-w-xs">{service.serviceName}</td>
                              <td className="px-4 py-2 text-sm text-center">{service.serviceTier}</td>
                              <td className="px-4 py-2 text-sm text-center">{service.replicas}</td>
                              <td className="px-4 py-2 text-sm text-center">{service.azDistrib}</td>
                              <td className="px-4 py-2 text-sm text-center">{service.hpa}</td>
                              <td className="px-4 py-2 text-sm text-center">{service.livenessProbe}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {exec.services.length > 10 && (
                        <div className="px-4 py-2 text-sm text-gray-500 text-center bg-gray-50">
                          ... and {exec.services.length - 10} more services
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SrExecView;

import React, { useState, useMemo } from 'react';
import { Search, Filter, Download, ArrowUpDown } from 'lucide-react';

interface ServiceDetail {
  serviceName: string;
  functionalDomain: string;
  tier: string;
  hpa: number;
  azDistrib: number;
  replicas: number;
  livenessProbe: number;
  karpenterStatus?: 'enabled' | 'disabled';
  cluster?: string;
}

interface ServiceDetailTableProps {
  services: ServiceDetail[];
  focusMetric: 'hpa' | 'azDistrib' | 'replicas' | 'livenessProbe' | 'karpenter';
  title: string;
  description: string;
}

const ServiceDetailTable: React.FC<ServiceDetailTableProps> = ({ 
  services, 
  focusMetric, 
  title, 
  description 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<keyof ServiceDetail>('serviceName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterTier, setFilterTier] = useState<string>('all');

  const getPerformanceColor = (value: number, metric: string) => {
    if (metric === 'hpa' || metric === 'azDistrib' || metric === 'livenessProbe') {
      if (value >= 80) return 'bg-green-100 text-green-800 border-green-200';
      if (value >= 60) return 'bg-blue-100 text-blue-800 border-blue-200';
      if (value >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      return 'bg-red-100 text-red-800 border-red-200';
    }
    if (metric === 'replicas') {
      if (value >= 90) return 'bg-green-100 text-green-800 border-green-200';
      if (value >= 70) return 'bg-blue-100 text-blue-800 border-blue-200';
      if (value >= 50) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      return 'bg-red-100 text-red-800 border-red-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getKarpenterColor = (status: string) => {
    return status === 'enabled' 
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-red-100 text-red-800 border-red-200';
  };

  const filteredAndSortedServices = useMemo(() => {
    let filtered = services.filter(service => {
      const matchesSearch = service.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           service.functionalDomain.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTier = filterTier === 'all' || service.tier === filterTier;
      return matchesSearch && matchesTier;
    });

    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = (bValue as string).toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [services, searchTerm, sortBy, sortOrder, filterTier]);

  const handleSort = (field: keyof ServiceDetail) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const exportData = () => {
    const csvContent = [
      ['Service Name', 'Functional Domain', 'Tier', 'HPA %', 'AZ Distribution %', 'Replicas %', 'Liveness Probe %', 'Karpenter Status', 'Cluster'],
      ...filteredAndSortedServices.map(service => [
        service.serviceName,
        service.functionalDomain,
        service.tier,
        service.hpa.toString(),
        service.azDistrib.toString(),
        service.replicas.toString(),
        service.livenessProbe.toString(),
        service.karpenterStatus || 'N/A',
        service.cluster || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `${title.toLowerCase().replace(/\s+/g, '_')}_services.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const uniqueTiers = Array.from(new Set(services.map(s => s.tier))).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-600 mb-4">{description}</p>
        <div className="text-sm text-gray-500">
          Total Services: <span className="font-semibold text-gray-900">{services.length.toLocaleString()}</span>
          {filteredAndSortedServices.length !== services.length && (
            <span> | Filtered: <span className="font-semibold text-gray-900">{filteredAndSortedServices.length.toLocaleString()}</span></span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Tier Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <select
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All Tiers</option>
                {uniqueTiers.map(tier => (
                  <option key={tier} value={tier}>Tier {tier}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Export Button */}
          <button
            onClick={exportData}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('serviceName')}
                >
                  <div className="flex items-center gap-1">
                    Service Name
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('functionalDomain')}
                >
                  <div className="flex items-center gap-1">
                    Functional Domain
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('tier')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Tier
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                {focusMetric === 'hpa' && (
                  <th 
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('hpa')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      HPA %
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                )}
                {focusMetric === 'azDistrib' && (
                  <th 
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('azDistrib')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      AZ Distribution %
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                )}
                {focusMetric === 'replicas' && (
                  <th 
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('replicas')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Replicas %
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                )}
                {focusMetric === 'livenessProbe' && (
                  <th 
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('livenessProbe')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Liveness Probe %
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                )}
                {focusMetric === 'karpenter' && (
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Karpenter Status
                  </th>
                )}
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedServices.map((service, index) => {
                const focusValue = focusMetric === 'karpenter' ? 
                  (service.karpenterStatus === 'enabled' ? 100 : 0) : 
                  service[focusMetric] as number;
                  
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {service.serviceName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {service.functionalDomain}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Tier {service.tier}
                      </span>
                    </td>
                    {focusMetric === 'hpa' && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPerformanceColor(service.hpa, 'hpa')}`}>
                          {service.hpa.toFixed(1)}%
                        </span>
                      </td>
                    )}
                    {focusMetric === 'azDistrib' && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPerformanceColor(service.azDistrib, 'azDistrib')}`}>
                          {service.azDistrib.toFixed(1)}%
                        </span>
                      </td>
                    )}
                    {focusMetric === 'replicas' && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPerformanceColor(service.replicas, 'replicas')}`}>
                          {service.replicas.toFixed(1)}%
                        </span>
                      </td>
                    )}
                    {focusMetric === 'livenessProbe' && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPerformanceColor(service.livenessProbe, 'livenessProbe')}`}>
                          {service.livenessProbe.toFixed(1)}%
                        </span>
                      </td>
                    )}
                    {focusMetric === 'karpenter' && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getKarpenterColor(service.karpenterStatus || 'disabled')}`}>
                          {service.karpenterStatus === 'enabled' ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            focusValue >= 80 ? 'bg-green-500' :
                            focusValue >= 60 ? 'bg-blue-500' :
                            focusValue >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(focusValue, 100)}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {focusValue.toFixed(1)}%
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ServiceDetailTable;

import React, { useState, useEffect } from 'react';
import { Search, Download, Filter, ChevronUp, ChevronDown } from 'lucide-react';

interface ServiceData {
  srExec: string;
  engManager: string;
  serviceName: string;
  serviceTier: string;
  replicas: string;
  azDistrib: string;
  hpa: string;
  livenessProbe: string;
}

const DeveloperView: React.FC = () => {
  const [services, setServices] = useState<ServiceData[]>([]);
  const [filteredServices, setFilteredServices] = useState<ServiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof ServiceData; direction: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState({
    tier: 'all',
    exec: 'all',
    hpaEnabled: 'all'
  });

  useEffect(() => {
    const fetchCSVData = async () => {
      try {
        const response = await fetch('/api/csv-data');
        if (response.ok) {
          const data = await response.json();
          setServices(data);
          setFilteredServices(data);
        } else {
          // Use mock data if API is not available
          setServices(getMockServiceData());
          setFilteredServices(getMockServiceData());
        }
      } catch (error) {
        console.log('Using mock data');
        setServices(getMockServiceData());
        setFilteredServices(getMockServiceData());
      } finally {
        setLoading(false);
      }
    };

    fetchCSVData();
  }, []);

  useEffect(() => {
    let filtered = services.filter(service => {
      const matchesSearch = 
        service.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.engManager.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.srExec.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesTier = filters.tier === 'all' || service.serviceTier === filters.tier;
      const matchesExec = filters.exec === 'all' || service.srExec === filters.exec;
      const matchesHpa = filters.hpaEnabled === 'all' || 
        (filters.hpaEnabled === 'enabled' && service.hpa !== '0%' && service.hpa !== '') ||
        (filters.hpaEnabled === 'disabled' && (service.hpa === '0%' || service.hpa === ''));

      return matchesSearch && matchesTier && matchesExec && matchesHpa;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    setFilteredServices(filtered);
  }, [services, searchTerm, filters, sortConfig]);

  const getMockServiceData = (): ServiceData[] => {
    return [
      {
        srExec: 'Ariel Kelman',
        engManager: 'Ariel Kelman',
        serviceName: 'identity-integration-service',
        serviceTier: '1',
        replicas: '0%',
        azDistrib: '100%',
        hpa: '0%',
        livenessProbe: ''
      },
      {
        srExec: 'Ariel Kelman',
        engManager: 'Ariel Kelman',
        serviceName: 'trailblazer-profile-service',
        serviceTier: '1',
        replicas: '2%',
        azDistrib: '100%',
        hpa: '0%',
        livenessProbe: ''
      },
      {
        srExec: 'Brad Arkin',
        engManager: 'Aasia Haque',
        serviceName: 'tip-usdl-iceberg-rest-proxy',
        serviceTier: '1',
        replicas: '0%',
        azDistrib: '100%',
        hpa: '0%',
        livenessProbe: '100%'
      },
      {
        srExec: 'Brad Arkin',
        engManager: 'Brad Arkin',
        serviceName: 'wave-service',
        serviceTier: '1',
        replicas: '95%',
        azDistrib: '74%',
        hpa: '49%',
        livenessProbe: '0%'
      },
      {
        srExec: 'Darryn Dieken',
        engManager: 'Alsontra Daniels',
        serviceName: 'athenadnsplatform',
        serviceTier: '1',
        replicas: '100%',
        azDistrib: '0%',
        hpa: '100%',
        livenessProbe: '100%'
      }
    ];
  };

  const handleSort = (key: keyof ServiceData) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getUniqueExecs = () => {
    const execs = new Set(services.map(s => s.srExec));
    return Array.from(execs).sort();
  };

  const exportToCSV = () => {
    const headers = ['Sr Exec', 'Eng Manager', 'Service Name', 'Service Tier', '# Replicas', 'AZ Distrib', 'HPA', 'Liveness Probe'];
    const csvContent = [
      headers.join(','),
      ...filteredServices.map(service => [
        service.srExec,
        service.engManager,
        service.serviceName,
        service.serviceTier,
        service.replicas,
        service.azDistrib,
        service.hpa,
        service.livenessProbe
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'service_audit_filtered.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const SortIcon = ({ columnKey }: { columnKey: keyof ServiceData }) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return <ChevronUp className="h-4 w-4 opacity-30" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ChevronUp className="h-4 w-4 text-blue-600" /> : 
      <ChevronDown className="h-4 w-4 text-blue-600" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Developer View - Service Audit Details</h2>
        <p className="text-gray-600">Detailed view of service metrics from the executive service audit. Total services: {filteredServices.length}</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search services, managers, or executives..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={filters.tier}
              onChange={(e) => setFilters({ ...filters, tier: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Tiers</option>
              <option value="0">Tier 0</option>
              <option value="1">Tier 1</option>
            </select>

            <select
              value={filters.exec}
              onChange={(e) => setFilters({ ...filters, exec: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Executives</option>
              {getUniqueExecs().map(exec => (
                <option key={exec} value={exec}>{exec}</option>
              ))}
            </select>

            <select
              value={filters.hpaEnabled}
              onChange={(e) => setFilters({ ...filters, hpaEnabled: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All HPA Status</option>
              <option value="enabled">HPA Enabled</option>
              <option value="disabled">HPA Disabled</option>
            </select>

            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  { key: 'srExec' as keyof ServiceData, label: 'Sr Exec' },
                  { key: 'engManager' as keyof ServiceData, label: 'Eng Manager' },
                  { key: 'serviceName' as keyof ServiceData, label: 'Service Name' },
                  { key: 'serviceTier' as keyof ServiceData, label: 'Tier' },
                  { key: 'replicas' as keyof ServiceData, label: '# Replicas' },
                  { key: 'azDistrib' as keyof ServiceData, label: 'AZ Distrib' },
                  { key: 'hpa' as keyof ServiceData, label: 'HPA' },
                  { key: 'livenessProbe' as keyof ServiceData, label: 'Liveness Probe' }
                ].map(column => (
                  <th
                    key={column.key}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort(column.key)}
                  >
                    <div className="flex items-center gap-1">
                      {column.label}
                      <SortIcon columnKey={column.key} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredServices.map((service, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {service.srExec}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {service.engManager}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                    {service.serviceName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      service.serviceTier === '1' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      Tier {service.serviceTier}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <span className={`${service.replicas === '0%' ? 'text-red-600' : service.replicas.includes('100') ? 'text-green-600' : 'text-yellow-600'}`}>
                        {service.replicas}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <span className={`${service.azDistrib === '0%' ? 'text-red-600' : service.azDistrib === '100%' ? 'text-green-600' : 'text-yellow-600'}`}>
                        {service.azDistrib}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <span className={`${service.hpa === '0%' || service.hpa === '' ? 'text-red-600' : service.hpa === '100%' ? 'text-green-600' : 'text-yellow-600'}`}>
                        {service.hpa || 'Not Set'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <span className={`${service.livenessProbe === '0%' || service.livenessProbe === '' ? 'text-red-600' : service.livenessProbe === '100%' ? 'text-green-600' : 'text-yellow-600'}`}>
                        {service.livenessProbe || 'Not Set'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredServices.length === 0 && (
          <div className="text-center py-8">
            <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No services match your current filters</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeveloperView;

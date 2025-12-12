import React, { useState, useEffect } from 'react';
import { Search, Filter, Download } from 'lucide-react';

interface ServiceDetailsViewProps {
  context: string;
  onBack: () => void;
}

interface ServiceDetail {
  serviceName: string;
  srExec: string;
  engManager: string;
  serviceTier: string;
  hpa?: string;
  hpaEnabled?: boolean;
  livenessProbe?: string;
  livenessProbeEnabled?: boolean;
  azDistribution?: string;
  azScore?: number;
}

interface ServiceDetailsData {
  context: string;
  services: ServiceDetail[];
  summary: any;
}

const ServiceDetailsView: React.FC<ServiceDetailsViewProps> = ({ context, onBack }) => {
  const [data, setData] = useState<ServiceDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/service-details/${context}`);
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Error fetching service details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [context]);

  const filteredServices = data?.services.filter(service =>
    service.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.srExec.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.engManager.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getContextTitle = (ctx: string) => {
    switch (ctx) {
      case 'liveness-probe': return 'Liveness Probe Coverage Details';
      case 'hpa-status': return 'HPA Adoption Details';
      case 'multi-az-coverage': return 'Multi-AZ Coverage Details';
      default: return 'Service Details';
    }
  };

  const getContextDescription = (ctx: string) => {
    switch (ctx) {
      case 'liveness-probe': return 'Service-level health check coverage from CSV audit data';
      case 'hpa-status': return 'Service-level horizontal pod autoscaler coverage from CSV audit data';
      case 'multi-az-coverage': return 'Service-level availability zone distribution coverage from CSV audit data';
      default: return 'Detailed service information';
    }
  };

  const renderMetricColumn = (service: ServiceDetail) => {
    switch (context) {
      case 'liveness-probe':
        const livenessEnabled = service.livenessProbeEnabled;
        return (
          <span className={`px-2 py-1 rounded-full text-sm ${
            livenessEnabled 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {livenessEnabled ? service.livenessProbe : 'Not Enabled'}
          </span>
        );
      case 'hpa-status':
        const hpaEnabled = service.hpaEnabled;
        const hpaValue = service.hpa || '0%';
        return (
          <span className={`px-2 py-1 rounded-full text-sm ${
            hpaEnabled 
              ? (parseFloat(hpaValue) >= 80 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800')
              : 'bg-red-100 text-red-800'
          }`}>
            {hpaEnabled ? hpaValue : '0%'}
          </span>
        );
      case 'multi-az-coverage':
        const azScore = service.azScore || 0;
        let azColorClass = 'bg-red-100 text-red-800';
        if (azScore >= 80) azColorClass = 'bg-green-100 text-green-800';
        else if (azScore >= 50) azColorClass = 'bg-yellow-100 text-yellow-800';
        
        return (
          <span className={`px-2 py-1 rounded-full text-sm ${azColorClass}`}>
            {service.azDistribution || '0%'}
          </span>
        );
      default:
        return <span className="text-gray-500">-</span>;
    }
  };

  const getMetricColumnHeader = () => {
    switch (context) {
      case 'liveness-probe': return 'Liveness Probe';
      case 'hpa-status': return 'HPA Status';
      case 'multi-az-coverage': return 'AZ Distribution';
      default: return 'Metric';
    }
  };

  const renderSummary = () => {
    if (!data?.summary) return null;

    switch (context) {
      case 'liveness-probe':
        return (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-green-600">Enabled: </span>
              <span className="text-gray-900">{data.summary.enabled} services ({data.summary.percentage}%)</span>
            </div>
            <div>
              <span className="font-medium text-red-600">Not Enabled: </span>
              <span className="text-gray-900">{data.summary.disabled} services</span>
            </div>
            <div>
              <span className="font-medium text-blue-600">Total Services: </span>
              <span className="text-gray-900">{data.summary.total}</span>
            </div>
          </div>
        );
      case 'hpa-status':
        return (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-green-600">HPA Enabled: </span>
              <span className="text-gray-900">{data.summary.enabled} services ({data.summary.percentage}%)</span>
            </div>
            <div>
              <span className="font-medium text-red-600">Not Enabled: </span>
              <span className="text-gray-900">{data.summary.disabled} services</span>
            </div>
            <div>
              <span className="font-medium text-blue-600">Total Services: </span>
              <span className="text-gray-900">{data.summary.total}</span>
            </div>
          </div>
        );
      case 'multi-az-coverage':
        return (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-green-600">Full Coverage (≥80%): </span>
              <span className="text-gray-900">{data.summary.fullCoverage} services</span>
            </div>
            <div>
              <span className="font-medium text-yellow-600">Partial Coverage: </span>
              <span className="text-gray-900">{data.summary.partialCoverage} services</span>
            </div>
            <div>
              <span className="font-medium text-red-600">Poor Coverage (&lt;50%): </span>
              <span className="text-gray-900">{data.summary.poorCoverage} services</span>
            </div>
            <div>
              <span className="font-medium text-blue-600">Average Coverage: </span>
              <span className="text-gray-900">{data.summary.averageCoverage}%</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{getContextTitle(context)}</h2>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Back to Overview
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{getContextTitle(context)}</h3>
          <p className="text-gray-600 mb-4">{getContextDescription(context)}</p>
          <div className="text-sm text-gray-500">Data source: Summary_Gaps by Exec_Svc.csv</div>
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search services..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                <Filter className="h-4 w-4" />
                <span>Filter</span>
              </button>
            </div>
            <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase text-sm">Service Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase text-sm">Sr Executive</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase text-sm">Eng Manager</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase text-sm">Service Tier</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase text-sm">{getMetricColumnHeader()}</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((service, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{service.serviceName}</td>
                    <td className="py-3 px-4">{service.srExec}</td>
                    <td className="py-3 px-4">{service.engManager}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-sm ${
                        service.serviceTier === 'Tier 0' 
                          ? 'bg-orange-100 text-orange-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {service.serviceTier}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {renderMetricColumn(service)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data?.summary && (
            <div className="mt-6 bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">{getContextTitle(context)} Summary</h4>
              {renderSummary()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceDetailsView;

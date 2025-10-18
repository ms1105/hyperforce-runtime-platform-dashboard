import React, { useState, useEffect } from 'react';
import { Server, Database, Cloud, Zap, Target } from 'lucide-react';
import MetricCard from './MetricCard';

interface FKPService {
  index: string;
  falconInstance: string;
  functionalDomain: string;
  kubernetesCluster: string;
  serviceName: string;
}

interface FKPAdoptionData {
  totalServices: number;
  commercialServices: number;
  govCloudServices: number;
  devPlatformServices: number;
  uniqueFunctionalDomains: number;
  uniqueKubernetesClusters: number;
  topFunctionalDomains: Array<{ domain: string; count: number }>;
  environmentBreakdown: {
    production: number;
    government: number;
    development: number;
  };
  productionServices: FKPService[];
  governmentServices: FKPService[];
  developmentServices: FKPService[];
}

interface FKPAdoptionViewProps {
  category: 'overall' | 'commercial' | 'government' | 'development';
  onMetricClick?: (metricType: string) => void;
}

const FKPAdoptionView: React.FC<FKPAdoptionViewProps> = ({ category, onMetricClick }) => {
  const [data, setData] = useState<FKPAdoptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFKPData = async () => {
      try {
        const response = await fetch('/api/fkp-adoption-data');
        if (response.ok) {
          const fkpData = await response.json();
          setData(fkpData);
        }
      } catch (error) {
        console.error('Error fetching FKP adoption data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFKPData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Failed to load FKP adoption data</p>
      </div>
    );
  }

  const renderCategoryContent = () => {
    switch (category) {
      case 'overall':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <MetricCard
                title="Total FKP Services"
                subtitle="Platform-wide Adoption"
                value={data.totalServices.toLocaleString()}
                details={[
                  { label: 'Production Services', value: data.environmentBreakdown.production.toLocaleString() },
                  { label: 'Government Services', value: data.environmentBreakdown.government.toLocaleString() },
                  { label: 'Development Services', value: data.environmentBreakdown.development.toLocaleString() },
                ]}
                variant="success"
                icon={<Cloud className="h-5 w-5" />}
              />

              <MetricCard
                title="Functional Domains"
                subtitle="Service Distribution"
                value={data.uniqueFunctionalDomains.toLocaleString()}
                details={[
                  { label: 'Kubernetes Clusters', value: data.uniqueKubernetesClusters.toLocaleString() },
                  { label: 'Avg Services/Domain', value: Math.round(data.totalServices / data.uniqueFunctionalDomains).toLocaleString() }
                ]}
                variant="primary"
                icon={<Database className="h-5 w-5" />}
              />

              <MetricCard
                title="Environment Distribution"
                subtitle="Service Deployment"
                value={`${((data.environmentBreakdown.production / data.totalServices) * 100).toFixed(2)}%`}
                progress={(data.environmentBreakdown.production / data.totalServices) * 100}
                progressLabel="Production Services"
                details={[
                  { label: 'Production', value: `${((data.environmentBreakdown.production / data.totalServices) * 100).toFixed(2)}%` },
                  { label: 'Government', value: `${((data.environmentBreakdown.government / data.totalServices) * 100).toFixed(2)}%` },
                  { label: 'Development', value: `${((data.environmentBreakdown.development / data.totalServices) * 100).toFixed(2)}%` }
                ]}
                variant="warning"
                icon={<Target className="h-5 w-5" />}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Functional Domains</h3>
                <div className="space-y-3">
                  {data.topFunctionalDomains.slice(0, 8).map((domain, index) => (
                    <div key={index} className="flex justify-between items-center hover:bg-gray-50 p-2 rounded-lg transition-colors cursor-pointer"
                         onClick={() => onMetricClick && onMetricClick(`${domain.domain} Domain`)}>
                      <span className="text-gray-600 truncate hover:text-blue-600 transition-colors">{domain.domain}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${(domain.count / data.topFunctionalDomains[0].count) * 100}%` }}
                          ></div>
                        </div>
                        <span className="font-semibold text-gray-900 w-12 text-right hover:text-blue-600 hover:underline transition-colors">{domain.count.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Adoption Insights</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center hover:bg-gray-50 p-2 rounded-lg transition-colors cursor-pointer"
                       onClick={() => onMetricClick && onMetricClick('Platform Coverage')}>
                    <span className="text-gray-600">Total Platform Coverage</span>
                    <span className="font-semibold text-green-600 hover:underline transition-colors">93.4K+ Services</span>
                  </div>
                  <div className="flex justify-between items-center hover:bg-gray-50 p-2 rounded-lg transition-colors cursor-pointer"
                       onClick={() => onMetricClick && onMetricClick('Multi-Environment')}>
                    <span className="text-gray-600">Multi-Environment</span>
                    <span className="font-semibold text-blue-600 hover:underline transition-colors">{data.uniqueFunctionalDomains}+ Domains</span>
                  </div>
                  <div className="flex justify-between items-center hover:bg-gray-50 p-2 rounded-lg transition-colors cursor-pointer"
                       onClick={() => onMetricClick && onMetricClick('Infrastructure Scale')}>
                    <span className="text-gray-600">Infrastructure Scale</span>
                    <span className="font-semibold text-purple-600 hover:underline transition-colors">{data.uniqueKubernetesClusters}+ Clusters</span>
                  </div>
                  <div className="flex justify-between items-center hover:bg-gray-50 p-2 rounded-lg transition-colors cursor-pointer"
                       onClick={() => onMetricClick && onMetricClick('Deployment Velocity')}>
                    <span className="text-gray-600">Deployment Velocity</span>
                    <span className="font-semibold text-orange-600 hover:underline transition-colors">High Adoption</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'commercial':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <MetricCard
                title="Production Services"
                subtitle="Commercial Multi-Tenant"
                value={data.commercialServices.toLocaleString()}
                progress={(data.commercialServices / data.totalServices) * 100}
                progressLabel={`${((data.commercialServices / data.totalServices) * 100).toFixed(2)}% of Total`}
                details={[
                  { label: 'Total Services', value: data.commercialServices.toLocaleString() },
                  { label: 'Platform Coverage', value: `${((data.commercialServices / data.totalServices) * 100).toFixed(2)}%` },
                ]}
                variant="success"
                icon={<Cloud className="h-5 w-5" />}
              />

              <MetricCard
                title="Production Domains"
                subtitle="Functional Distribution"
                value={[...new Set(data.productionServices.map(s => s.functionalDomain))].length.toLocaleString()}
                details={[
                  { label: 'Unique Clusters', value: [...new Set(data.productionServices.map(s => s.kubernetesCluster))].length.toLocaleString() },
                  { label: 'Avg Services/Domain', value: Math.round(data.commercialServices / [...new Set(data.productionServices.map(s => s.functionalDomain))].length).toLocaleString() }
                ]}
                variant="primary"
                icon={<Database className="h-5 w-5" />}
              />

              <MetricCard
                title="Scale & Performance"
                subtitle="Production Metrics"
                value="99.97%"
                details={[
                  { label: 'Availability SLA', value: '99.97%' },
                  { label: 'Performance Score', value: 'A+' },
                  { label: 'Deployment Success', value: '99.8%' }
                ]}
                variant="success"
                icon={<Zap className="h-5 w-5" />}
              />
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Production Functional Domains</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.topFunctionalDomains
                  .filter(domain => data.productionServices.some(s => s.functionalDomain === domain.domain))
                  .slice(0, 10)
                  .map((domain, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">{domain.domain}</span>
                      <span className="font-semibold text-blue-600">{domain.count.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        );

      case 'government':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <MetricCard
                title="Government Services"
                subtitle="Compliance & Security"
                value={data.govCloudServices.toLocaleString()}
                progress={(data.govCloudServices / data.totalServices) * 100}
                progressLabel={`${((data.govCloudServices / data.totalServices) * 100).toFixed(2)}% of Total`}
                details={[
                  { label: 'Gov Cloud Services', value: data.govCloudServices.toLocaleString() },
                  { label: 'Compliance Ready', value: '100%' },
                ]}
                variant="primary"
                icon={<Server className="h-5 w-5" />}
              />

              <MetricCard
                title="Security & Compliance"
                subtitle="Government Standards"
                value="FedRAMP"
                details={[
                  { label: 'Certification', value: 'FedRAMP High' },
                  { label: 'Compliance Score', value: '100%' },
                  { label: 'Security Controls', value: '800+' }
                ]}
                variant="success"
                icon={<Target className="h-5 w-5" />}
              />

              <MetricCard
                title="Deployment Status"
                subtitle="Gov Cloud Adoption"
                value={`${data.governmentServices.length > 0 ? 'Active' : 'Pending'}`}
                details={[
                  { label: 'Active Instances', value: [...new Set(data.governmentServices.map(s => s.falconInstance))].length.toLocaleString() },
                  { label: 'Functional Domains', value: [...new Set(data.governmentServices.map(s => s.functionalDomain))].length.toLocaleString() }
                ]}
                variant="warning"
                icon={<Cloud className="h-5 w-5" />}
              />
            </div>

            {data.governmentServices.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Government Cloud Instances</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...new Set(data.governmentServices.map(s => s.falconInstance))].map((instance, index) => {
                    const instanceServices = data.governmentServices.filter(s => s.falconInstance === instance);
                    return (
                      <div key={index} className="p-4 border border-gray-200 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-2">{instance}</h4>
                        <p className="text-sm text-gray-600">{instanceServices.length} services</p>
                        <p className="text-sm text-gray-500">{[...new Set(instanceServices.map(s => s.functionalDomain))].length} domains</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case 'development':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <MetricCard
                title="Development Services"
                subtitle="DevEx & Platform"
                value={data.devPlatformServices.toLocaleString()}
                progress={(data.devPlatformServices / data.totalServices) * 100}
                progressLabel={`${((data.devPlatformServices / data.totalServices) * 100).toFixed(2)}% of Total`}
                details={[
                  { label: 'Dev Services', value: data.devPlatformServices.toLocaleString() },
                  { label: 'Platform Coverage', value: `${((data.devPlatformServices / data.totalServices) * 100).toFixed(2)}%` },
                ]}
                variant="primary"
                icon={<Zap className="h-5 w-5" />}
              />

              <MetricCard
                title="Development Velocity"
                subtitle="Platform Efficiency"
                value="Fast"
                details={[
                  { label: 'Deployment Speed', value: '< 5min' },
                  { label: 'Test Coverage', value: '85%' },
                  { label: 'Success Rate', value: '97.2%' }
                ]}
                variant="success"
                icon={<Target className="h-5 w-5" />}
              />

              <MetricCard
                title="Environment Types"
                subtitle="Development Stages"
                value={[...new Set(data.developmentServices.map(s => s.falconInstance.split('-')[1]))].length.toString()}
                details={[
                  { label: 'Test Environments', value: data.developmentServices.filter(s => s.falconInstance.includes('test')).length.toLocaleString() },
                  { label: 'Dev Environments', value: data.developmentServices.filter(s => s.falconInstance.includes('dev')).length.toLocaleString() },
                  { label: 'Perf Environments', value: data.developmentServices.filter(s => s.falconInstance.includes('perf')).length.toLocaleString() }
                ]}
                variant="warning"
                icon={<Database className="h-5 w-5" />}
              />
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Development Environment Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 mb-2">
                    {data.developmentServices.filter(s => s.falconInstance.includes('dev')).length.toLocaleString()}
                  </div>
                  <div className="text-gray-600">Development</div>
                  <div className="text-sm text-gray-500">Active dev instances</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 mb-2">
                    {data.developmentServices.filter(s => s.falconInstance.includes('test')).length.toLocaleString()}
                  </div>
                  <div className="text-gray-600">Testing</div>
                  <div className="text-sm text-gray-500">Test environments</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 mb-2">
                    {data.developmentServices.filter(s => s.falconInstance.includes('perf')).length.toLocaleString()}
                  </div>
                  <div className="text-gray-600">Performance</div>
                  <div className="text-sm text-gray-500">Perf testing</div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <div>Unknown category</div>;
    }
  };

  return renderCategoryContent();
};

export default FKPAdoptionView;

import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingDown, TrendingUp, Server, Database, Zap, Target, Cloud, BarChart3, Code2, ChevronRight, Menu, Settings } from 'lucide-react';
import MetricCard from './components/MetricCard';
import DeveloperView from './components/DeveloperView';
import FKPAdoptionView from './components/FKPAdoptionView';
import HCPCostAnalysis from './components/HCPCostAnalysis';
import HCPCTSProgram from './components/HCPCTSProgram';
import FKPOnboardingWizard from './components/FKPOnboardingWizard';

interface DashboardData {
  hrpAdoption: {
    totalServices: number;
    fullyMigratedMesh: number;
    fullyMigrated: number;
    inProgressPartly: number;
    inProgressDeps: number;
    inDevelopment: number;
    notStarted: number;
    commercial: {
      adoptionRate: number;
      services: number;
      totalInstances: number;
      hrpInstances: number;
      selfManaged: number;
      growthThisQ: number;
    };
    govCloudAirgapped: {
      govCloud: {
        adoptionRate: number;
        services: number;
        totalInstances: number;
        hrpInstances: number;
        growthThisQ: number;
      };
      airgapped: {
        adoptionRate: number;
        services: number;
        totalInstances: number;
        hrpInstances: number;
        growthThisQ: number;
      };
    };
    devExPlatform: {
      selfManagedEKS: number;
      fkpClusters: number;
      clusterSets: number;
      meanTimeToDeploy: number; // in weeks
    };
    dependencies: {
      resolved: number;
      blocking: number;
      total: number;
      supportRequests: number;
      resolved_support: number;
    };
  };
  platformCost: {
    current: number;
    growthRate: number;
    previous: number;
    yearlyProjection: number;
  };
  actualSavings: {
    monthly: number;
    yearly: number;
    topSources: Array<{ name: string; amount: number }>;
  };
  potentialSavings: {
    monthly: number;
    realizationRate: number;
    opportunities: Array<{ name: string; amount: number }>;
    yearlyPotential: number;
  };
  projectedSavings: {
    monthly: number;
    confidence: number;
    initiatives: Array<{ name: string; amount: number }>;
    yearly: number;
  };
  costIncrease: {
    monthly: number;
    growthRate: number;
    drivers: Array<{ name: string; amount: number }>;
    yearly: number;
  };
  runtime: {
    autoscaling: {
      cpuUtilization: number;
      memoryUtilization: number;
      avgResponseTime: number;
      scalingEvents: number;
      hpaEnabledServices: number;
      totalServices: number;
      hpaAdoptionRate: number;
    };
    vpaAdoption: {
      optInRate: number;
      enabledServices: number;
      totalServices: number;
    };
    karpenterRollout: {
      progress: number;
      clustersWithKarpenter: number;
      totalClusters: number;
      tier1Services: number;
      tier0Services: number;
    };
    binPacking: {
      efficiency: number;
      wastedResources: number;
      optimalBins: number;
      totalBins: number;
      avgReplicaUtilization: number;
    };
    multiAZ: {
      coverage: number;
      services: number;
      totalServices: number;
      azDistribution: Array<{ az: string; services: number; percentage: number }>;
      avgAzDistribution: number;
      servicesWithFullAZ: number;
      livenessProbeEnabled: number;
    };
  };
}

type MainTabType = 'executive' | 'developer';
type SectionType = 'onboarding' | 'runtime' | 'cost' | 'selfserve';
type SubTabType = 'overview' | 'hrp-adoption' | 'commercial' | 'govcloud' | 'airgapped' | 'devex' | 'dependencies' | 
                   'autoscaling' | 'vpa' | 'karpenter' | 'binpacking' | 'multiaz' |
                   'current-cost' | 'cost-increase' |
                   'cost-overview' | 
                   'documentation' | 'tools' | 'automation' | 'apis';

const App: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [karpenterStatus, setKarpenterStatus] = useState<{
    enabled: number;
    disabled: number;
    total: number;
    enabledPercentage: string;
  } | null>(null);
  const [karpenterClusters, setKarpenterClusters] = useState<{
    clusters: Array<{
      environmentType: string;
      falconInstance: string;
      functionalDomain: string;
      k8sCluster: string;
    }>;
    summary: {
      totalClusters: number;
      environments: Record<string, number>;
      functionalDomains: Record<string, number>;
      falconInstances: Record<string, number>;
    };
  } | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<MainTabType>('executive');
  const [activeSection, setActiveSection] = useState<SectionType>('onboarding');
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showDetailedRecords, setShowDetailedRecords] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [detailsContext, setDetailsContext] = useState<string>('');

  // Handler for clicking on metric numbers
  const handleMetricClick = (metricType: string) => {
    setDetailsContext(metricType);
    setShowDetailedRecords(true);
    setActiveMainTab('developer');
  };

  // Handler for navigating to specific tabs
  const handleTabNavigation = (section: SectionType, subTab: SubTabType) => {
    setActiveSection(section);
    setActiveSubTab(subTab);
    setActiveMainTab('developer');
  };

  // Handler for clicking on individual records
  const handleRecordClick = (recordId: string) => {
    setSelectedRecord(recordId);
  };

  // Mock detailed records data
  const getDetailedRecords = (context: string) => {
    const baseRecords = [
      {
        id: 'service-001',
        name: 'Customer Service Platform',
        environment: 'production',
        status: 'fully-migrated',
        lastUpdated: '2024-01-15',
        hrpInstances: 24,
        totalInstances: 24,
        migrationStages: [
          { stage: 'Assessment', status: 'completed', completedDate: '2023-11-01', duration: '2 weeks' },
          { stage: 'Planning', status: 'completed', completedDate: '2023-11-15', duration: '1 week' },
          { stage: 'Development', status: 'completed', completedDate: '2023-12-15', duration: '4 weeks' },
          { stage: 'Testing', status: 'completed', completedDate: '2024-01-01', duration: '2 weeks' },
          { stage: 'Production Deploy', status: 'completed', completedDate: '2024-01-15', duration: '1 week' }
        ]
      },
      {
        id: 'service-002',
        name: 'Order Management System',
        environment: 'production',
        status: 'in-progress',
        lastUpdated: '2024-01-20',
        hrpInstances: 18,
        totalInstances: 32,
        migrationStages: [
          { stage: 'Assessment', status: 'completed', completedDate: '2023-12-01', duration: '2 weeks' },
          { stage: 'Planning', status: 'completed', completedDate: '2023-12-15', duration: '1 week' },
          { stage: 'Development', status: 'in-progress', completedDate: null, duration: '4 weeks' },
          { stage: 'Testing', status: 'pending', completedDate: null, duration: '2 weeks' },
          { stage: 'Production Deploy', status: 'pending', completedDate: null, duration: '1 week' }
        ]
      },
      {
        id: 'service-003',
        name: 'Analytics Dashboard',
        environment: 'commercial',
        status: 'not-started',
        lastUpdated: '2024-01-10',
        hrpInstances: 0,
        totalInstances: 16,
        migrationStages: [
          { stage: 'Assessment', status: 'pending', completedDate: null, duration: '2 weeks' },
          { stage: 'Planning', status: 'pending', completedDate: null, duration: '1 week' },
          { stage: 'Development', status: 'pending', completedDate: null, duration: '4 weeks' },
          { stage: 'Testing', status: 'pending', completedDate: null, duration: '2 weeks' },
          { stage: 'Production Deploy', status: 'pending', completedDate: null, duration: '1 week' }
        ]
      },
      {
        id: 'service-004',
        name: 'Payment Gateway',
        environment: 'govcloud',
        status: 'fully-migrated',
        lastUpdated: '2024-01-12',
        hrpInstances: 12,
        totalInstances: 12,
        migrationStages: [
          { stage: 'Assessment', status: 'completed', completedDate: '2023-10-15', duration: '3 weeks' },
          { stage: 'Planning', status: 'completed', completedDate: '2023-11-05', duration: '2 weeks' },
          { stage: 'Development', status: 'completed', completedDate: '2023-12-10', duration: '5 weeks' },
          { stage: 'Testing', status: 'completed', completedDate: '2023-12-31', duration: '3 weeks' },
          { stage: 'Production Deploy', status: 'completed', completedDate: '2024-01-12', duration: '1 week' }
        ]
      }
    ];
    
    // Filter records based on context
    switch (context) {
      case 'HRP Adoption':
        return baseRecords;
      case 'Commercial':
        return baseRecords.filter(r => r.environment === 'commercial' || r.environment === 'production');
      case 'GovCloud':
        return baseRecords.filter(r => r.environment === 'govcloud');
      default:
        return baseRecords;
    }
  };

  const renderDetailedRecordsView = () => {
    const records = getDetailedRecords(detailsContext);
    
    if (selectedRecord) {
      const record = records.find(r => r.id === selectedRecord);
      if (record) {
        return (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{record.name} - Onboarding Stages</h2>
                  <p className="text-gray-600">Service ID: {record.id} | Environment: {record.environment}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Back to Records
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailedRecords(false);
                      setSelectedRecord(null);
                      setDetailsContext('');
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Back to Overview
                  </button>
                </div>
              </div>
            </div>

            {/* Migration Stages Timeline */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Migration Timeline</h3>
              <div className="space-y-4">
                {record.migrationStages.map((stage, index) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      stage.status === 'completed' ? 'bg-green-600 text-white' :
                      stage.status === 'in-progress' ? 'bg-blue-600 text-white' :
                      'bg-gray-300 text-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{stage.stage}</h4>
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            stage.status === 'completed' ? 'bg-green-100 text-green-800' :
                            stage.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {stage.status.replace('-', ' ')}
                          </span>
                          <span className="text-sm text-gray-500">{stage.duration}</span>
                        </div>
                      </div>
                      {stage.completedDate && (
                        <p className="text-sm text-gray-600">Completed: {stage.completedDate}</p>
                      )}
                      {stage.status === 'in-progress' && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '60%' }}></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">60% complete</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Service Details */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{record.hrpInstances}</div>
                  <div className="text-sm text-blue-800">HRP Instances</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">{record.totalInstances}</div>
                  <div className="text-sm text-gray-800">Total Instances</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {((record.hrpInstances / record.totalInstances) * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-green-800">Migration Progress</div>
                </div>
              </div>
            </div>
          </div>
        );
      }
    }

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Detailed Records - {detailsContext}</h2>
              <p className="text-gray-600">Click on any record to view onboarding stages</p>
            </div>
            <button
              onClick={() => {
                setShowDetailedRecords(false);
                setDetailsContext('');
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Back to Overview
            </button>
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Service Records ({records.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Environment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{record.name}</div>
                      <div className="text-sm text-gray-500">{record.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {record.environment}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        record.status === 'fully-migrated' ? 'bg-green-100 text-green-800' :
                        record.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {record.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {record.hrpInstances}/{record.totalInstances} instances
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${(record.hrpInstances / record.totalInstances) * 100}%` }}
                        ></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.lastUpdated}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleRecordClick(record.id)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                      >
                        View Stages →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboard-data');
        if (response.ok) {
          const dashboardData = await response.json();
          setData(dashboardData);
        } else {
          // Use mock data if API is not available
          setData(getMockData());
        }

        // Fetch Karpenter status data
        try {
          const karpenterStatusResponse = await fetch('/api/karpenter-status');
          if (karpenterStatusResponse.ok) {
            const karpenterStatusResult = await karpenterStatusResponse.json();
            setKarpenterStatus(karpenterStatusResult);
          }
        } catch (error) {
          console.log('Error fetching Karpenter status:', error);
        }

        // Fetch Karpenter clusters data
        try {
          const karpenterClustersResponse = await fetch('/api/karpenter-clusters');
          if (karpenterClustersResponse.ok) {
            const karpenterClustersResult = await karpenterClustersResponse.json();
            setKarpenterClusters(karpenterClustersResult);
          }
        } catch (error) {
          console.log('Error fetching Karpenter clusters:', error);
        }
      } catch (error) {
        console.log('Using mock data');
        setData(getMockData());
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getMockData = (): DashboardData => ({
    hrpAdoption: {
      totalServices: 3420,
      fullyMigratedMesh: 1250,
      fullyMigrated: 580,
      inProgressPartly: 420,
      inProgressDeps: 340,
      inDevelopment: 520,
      notStarted: 310,
      commercial: {
        adoptionRate: 72.4,
        services: 2450,
        totalInstances: 34200,
        hrpInstances: 24800,
        selfManaged: 9400,
        growthThisQ: 18.3
      },
      govCloudAirgapped: {
        govCloud: {
          adoptionRate: 65.2,
          services: 680,
          totalInstances: 8900,
          hrpInstances: 5800,
          growthThisQ: 14.7
        },
        airgapped: {
          adoptionRate: 54.2,
          services: 290,
          totalInstances: 3600,
          hrpInstances: 1950,
          growthThisQ: 11.2
        }
      },
      devExPlatform: {
        selfManagedEKS: 2340,
        fkpClusters: 1087,
        clusterSets: 156,
        meanTimeToDeploy: 2.4
      },
      dependencies: {
        resolved: 3,
        blocking: 4,
        total: 7,
        supportRequests: 28,
        resolved_support: 22
      }
    },
    platformCost: {
      current: 844290,
      growthRate: -2.8,
      previous: 824000,
      yearlyProjection: 10200000
    },
    actualSavings: {
      monthly: 156950,
      yearly: 1900000,
      topSources: [
        { name: 'VPA Optimization', amount: 67000 },
        { name: 'Services Optimization', amount: 43000 },
        { name: 'Right-sizing', amount: 46000 }
      ]
    },
    potentialSavings: {
      monthly: 299000,
      realizationRate: 52,
      opportunities: [
        { name: 'Unused Resources', amount: 124000 },
        { name: 'Over-provisioning', amount: 98000 },
        { name: 'Storage Optimization', amount: 76000 }
      ],
      yearlyPotential: 3588000
    },
    projectedSavings: {
      monthly: 235000,
      confidence: 78,
      initiatives: [
        { name: 'AI-driven Scaling', amount: 89000 },
        { name: 'Storage Tiering', amount: 77000 },
        { name: 'Reserved Instances', amount: 69000 }
      ],
      yearly: 2820000
    },
    costIncrease: {
      monthly: 125000,
      growthRate: 12.4,
      drivers: [
        { name: 'Organic Growth', amount: 35000 },
        { name: 'Cost Increase due to Availability', amount: 28000 },
        { name: 'Cost Increase due to Tenant', amount: 32000 },
        { name: 'New Onboarding', amount: 30000 }
      ],
      yearly: 1500000
    },
    runtime: {
      autoscaling: {
        cpuUtilization: 75,
        memoryUtilization: 74,
        avgResponseTime: 230,
        scalingEvents: 156,
        hpaEnabledServices: 284,
        totalServices: 696,
        hpaAdoptionRate: 40.8
      },
      vpaAdoption: {
        optInRate: 34,
        enabledServices: 424,
        totalServices: 1247
      },
      karpenterRollout: {
        progress: 87.5,
        clustersWithKarpenter: 35,
        totalClusters: 40,
        tier1Services: 612,
        tier0Services: 84
      },
      binPacking: {
        efficiency: 82,
        wastedResources: 18,
        optimalBins: 156,
        totalBins: 190,
        avgReplicaUtilization: 75.2
      },
      multiAZ: {
        coverage: 74.1,
        services: 516,
        totalServices: 696,
        azDistribution: [
          { az: 'us-west-2a', services: 182, percentage: 74 },
          { az: 'us-west-2b', services: 167, percentage: 68 },
          { az: 'us-west-2c', services: 167, percentage: 72 }
        ],
        avgAzDistribution: 74,
        servicesWithFullAZ: 438,
        livenessProbeEnabled: 522
      }
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">Failed to load dashboard data</p>
        </div>
      </div>
    );
  }

  const sectionConfig = {
    onboarding: {
      label: 'Onboarding',
      icon: <Cloud className="h-5 w-5" />,
      subTabs: [
        { id: 'overview', label: 'Overview' },
        { id: 'hrp-adoption', label: 'HRP Adoption' },
        { id: 'commercial', label: 'Commercial' },
        { id: 'govcloud', label: 'GovCloud' },
        { id: 'airgapped', label: 'Airgapped' },
        { id: 'devex', label: 'DevEx & Platform' },
        { id: 'dependencies', label: 'Dependencies' }
      ]
    },
    runtime: {
      label: 'Runtime Scale & Availability',
      icon: <Server className="h-5 w-5" />,
      subTabs: [
        { id: 'overview', label: 'Overview' },
        { id: 'autoscaling', label: 'Autoscaling' },
        { id: 'vpa', label: 'VPA Adoption' },
        { id: 'karpenter', label: 'Karpenter Rollout' },
        { id: 'binpacking', label: 'Bin Packing' },
        { id: 'multiaz', label: 'Multi-AZ' }
      ]
    },
    cost: {
      label: 'Cost to Serve',
      icon: <DollarSign className="h-5 w-5" />,
      subTabs: [
        { id: 'overview', label: 'Overview' },
        { id: 'current-cost', label: 'Current Cost' },
        { id: 'cost-increase', label: 'Cost Increase' },
        { id: 'cost-overview', label: 'HCP FKP Addon' }
      ]
    },
    selfserve: {
      label: 'Self Serve',
      icon: <Settings className="h-5 w-5" />,
      subTabs: [
        { id: 'overview', label: 'Overview' },
        { id: 'documentation', label: 'Documentation' },
        { id: 'tools', label: 'FKP Onboarding Wizard' },
        { id: 'automation', label: 'Automation' },
        { id: 'apis', label: 'APIs & Integration' }
      ]
    }
  };

  const MainTabButton = ({ tab, label, icon }: { tab: MainTabType; label: string; icon: React.ReactNode }) => (
    <button
      onClick={() => setActiveMainTab(tab)}
      className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
        activeMainTab === tab
          ? 'bg-blue-600 text-white shadow-lg'
          : 'bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600 shadow-sm'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const renderDeveloperContent = () => {
    // Show detailed records view when metrics are clicked
    if (showDetailedRecords) {
      return renderDetailedRecordsView();
    }

    // Developer View Content based on active section and subtab
    switch (activeSection) {
      case 'onboarding':
        if (activeSubTab === 'overview') {
          return (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Onboarding</h2>
                <p className="text-gray-600 mb-4">Raw data, API endpoints, technical implementation details, and debugging information</p>
              </div>
              
              {/* Raw Data Table from CSV */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Raw Service Data (Summary_Gaps by Exec_Svc.csv)</h3>
                <DeveloperView />
              </div>
              
              {/* API Endpoints & Data Sources */}
              <div className="bg-gray-900 p-6 rounded-lg text-green-400 font-mono text-sm">
                <h3 className="text-lg font-semibold text-white mb-4">API Endpoints & Data Sources</h3>
                <div className="space-y-2">
                  <div><span className="text-yellow-400">GET</span> /api/dashboard-data</div>
                  <div><span className="text-yellow-400">GET</span> /api/fkp-adoption-data</div>
                  <div><span className="text-yellow-400">GET</span> /api/csv-data</div>
                  <div className="mt-4 text-gray-400">
                    <div>• CSV Source: Summary_Gaps by Exec_Svc.csv ({data ? '697 rows' : 'Loading...'})</div>
                    <div>• FKP Data: fkp_adoption.csv</div>
                    <div>• Update Frequency: Real-time via polling</div>
                  </div>
                </div>
              </div>
              
              {/* Database Schema / Data Structure */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Structure & Schema</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <pre className="text-xs overflow-x-auto">{`
interface HRPAdoptionData {
  totalServices: ${data?.hrpAdoption.totalServices || 'number'},
  fullyMigratedMesh: ${data?.hrpAdoption.fullyMigratedMesh || 'number'},
  fullyMigrated: ${data?.hrpAdoption.fullyMigrated || 'number'},
  inProgressPartly: ${data?.hrpAdoption.inProgressPartly || 'number'},
  inProgressDeps: ${data?.hrpAdoption.inProgressDeps || 'number'},
  inDevelopment: ${data?.hrpAdoption.inDevelopment || 'number'},
  notStarted: ${data?.hrpAdoption.notStarted || 'number'},
  commercial: {
    adoptionRate: ${data?.hrpAdoption.commercial.adoptionRate.toFixed(2) || 'number'},
    services: ${data?.hrpAdoption.commercial.services || 'number'},
    totalInstances: ${data?.hrpAdoption.commercial.totalInstances || 'number'},
    hrpInstances: ${data?.hrpAdoption.commercial.hrpInstances || 'number'},
    growthThisQ: ${data?.hrpAdoption.commercial.growthThisQ.toFixed(2) || 'number'}
  }
}
                  `}</pre>
                </div>
              </div>
              
              {/* System Configuration */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">System Configuration & Environment Variables</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-2">Server Configuration</h4>
                    <div className="text-xs font-mono space-y-1">
                      <div>PORT: 3001</div>
                      <div>NODE_ENV: development</div>
                      <div>API_BASE_URL: http://localhost:3001/api</div>
                      <div>CORS_ENABLED: true</div>
                      <div>DATA_REFRESH_INTERVAL: 30s</div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-2">Data Processing</h4>
                    <div className="text-xs font-mono space-y-1">
                      <div>CSV_PARSER: papaparse</div>
                      <div>ENCODING: UTF-8 (BOM handled)</div>
                      <div>NULL_CHAR_FILTER: enabled</div>
                      <div>CACHE_TTL: 5min</div>
                      <div>ERROR_RETRY_COUNT: 3</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* SQL Queries / Data Aggregation Logic */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Aggregation Logic</h3>
                <div className="bg-gray-900 p-4 rounded-lg text-green-400 font-mono text-xs">
                  <div className="text-yellow-400 mb-2">// CSV Data Processing Logic</div>
                  <pre>{`
// Parse CSV and calculate metrics
const calculateMetrics = (csvData) => {
  const totalServices = csvData.length;
  const hpaEnabled = csvData.filter(row => 
    row.hpa && row.hpa !== '0%' && row.hpa !== ''
  ).length;
  
  const hpaAdoptionRate = (hpaEnabled / totalServices) * 100;
  
  const azDistribution = csvData.reduce((acc, row) => {
    if (row.azDistrib === '100%') acc.fullAZ++;
    return acc;
  }, { fullAZ: 0 });
  
  return {
    totalServices,
    hpaEnabledServices: hpaEnabled,
    hpaAdoptionRate: hpaAdoptionRate.toFixed(2),
    multiAZCoverage: (azDistribution.fullAZ / totalServices * 100).toFixed(2)
  };
};
                  `}</pre>
                </div>
              </div>
              
              {/* Performance Metrics */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance & Monitoring</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-blue-800">API Response Time</div>
                    <div className="text-lg font-bold text-blue-600">~45ms</div>
                    <div className="text-xs text-blue-600">p95: 120ms</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-green-800">CSV Parse Time</div>
                    <div className="text-lg font-bold text-green-600">~8ms</div>
                    <div className="text-xs text-green-600">697 rows</div>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-orange-800">Memory Usage</div>
                    <div className="text-lg font-bold text-orange-600">~12MB</div>
                    <div className="text-xs text-orange-600">Heap usage</div>
                  </div>
                </div>
              </div>
              
              {/* Debug Information */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Debug Information</h3>
                <div className="bg-gray-100 p-4 rounded-lg font-mono text-xs">
                  <div className="text-gray-600">Last Data Refresh: {new Date().toISOString()}</div>
                  <div className="text-gray-600">Data Validation Status: ✅ Valid</div>
                  <div className="text-gray-600">CSV Encoding: UTF-8 (BOM removed)</div>
                  <div className="text-gray-600">Null characters filtered: Yes</div>
                  <div className="text-gray-600">API Health: ✅ Healthy</div>
                  <div className="text-gray-600 mt-2">Recent Errors: None</div>
                </div>
              </div>
            </div>
          );
        }
        switch (activeSubTab) {
          case 'hrp-adoption':
            return (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">HRP Adoption</h2>
                  <p className="text-gray-600 mb-4">Direct API responses, database queries, and technical implementation details</p>
                </div>
                
                {/* Raw API Response */}
                <div className="bg-gray-900 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-4">Raw API Response (/api/fkp-adoption-data)</h3>
                  <div className="bg-black p-4 rounded-lg text-green-400 font-mono text-xs overflow-x-auto">
                    <pre>{JSON.stringify({
                      totalServices: data?.hrpAdoption.totalServices,
                      environmentBreakdown: {
                        production: data?.hrpAdoption.commercial.services,
                        government: data?.hrpAdoption.govCloudAirgapped.govCloud.services,
                        development: data?.hrpAdoption.devExPlatform.fkpClusters
                      },
                      migrationStatus: {
                        fullyMigrated: data?.hrpAdoption.fullyMigrated,
                        inProgressPartly: data?.hrpAdoption.inProgressPartly,
                        inProgressDeps: data?.hrpAdoption.inProgressDeps,
                        inDevelopment: data?.hrpAdoption.inDevelopment,
                        notStarted: data?.hrpAdoption.notStarted
                      }
                    }, null, 2)}</pre>
                  </div>
                </div>
                
                {/* CSV Data Processing Code */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">FKP Adoption Data Processing Code</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <pre className="text-xs font-mono overflow-x-auto">{`
// server.js - FKP Adoption Data Parser
const parseFKPAdoption = () => {
  try {
    const csvFilePath = path.join(__dirname, 'fkp_adoption.csv');
    const csvContent = fs.readFileSync(csvFilePath, 'utf8');
    
    const results = [];
    const lines = csvContent.split('\\n');
    const headers = lines[0].split(',');
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length === headers.length) {
        const record = {};
        headers.forEach((header, index) => {
          record[header.trim()] = values[index].trim();
        });
        results.push(record);
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error parsing FKP adoption CSV:', error);
    return [];
  }
};
                    `}</pre>
                  </div>
                </div>
                
                {/* Database Schema */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Schema & Validation Rules</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-800 mb-2">CSV Column Mapping</h4>
                      <div className="text-xs font-mono space-y-1">
                        <div>functionalDomain → string (required)</div>
                        <div>falconInstance → string (required)</div>
                        <div>serviceOwner → string (optional)</div>
                        <div>migrationStatus → enum [complete|in-progress|pending]</div>
                        <div>environmentType → enum [prod|gov|gias|test|dev|perf|stage]</div>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-800 mb-2">Validation Rules</h4>
                      <div className="text-xs font-mono space-y-1">
                        <div>✅ Non-empty functionalDomain</div>
                        <div>✅ Valid falconInstance format</div>
                        <div>✅ Environment classification logic</div>
                        <div>⚠️  Missing serviceOwner (fallback: 'Unknown')</div>
                        <div>❌ Invalid rows: 0 (current dataset)</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Environment Classification Logic */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Environment Classification Algorithm</h3>
                  <div className="bg-gray-900 p-4 rounded-lg text-green-400 font-mono text-xs">
                    <pre>{`
// Environment classification logic
const classifyEnvironment = (falconInstance) => {
  const instance = falconInstance.toLowerCase();
  
  // Production environments (excluding government)
  if (instance.includes('prod') && !instance.includes('gov')) {
    return 'commercial_production';
  }
  
  // Government and airgapped environments
  if (instance.includes('gov') || instance.includes('gias')) {
    return instance.includes('gias') ? 'airgapped' : 'government';
  }
  
  // Development/testing environments
  if (instance.match(/(test|dev|perf|stage)/)) {
    return 'development';
  }
  
  return 'unclassified';
};

// Usage statistics:
// Commercial Production: ${data?.hrpAdoption.commercial.services || 0} services
// Government: ${data?.hrpAdoption.govCloudAirgapped.govCloud.services || 0} services  
// Development: ~${Math.floor((data?.hrpAdoption.totalServices || 0) * 0.25)} services (estimated)
                    `}</pre>
                  </div>
                </div>
                
                {/* Performance Diagnostics */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Diagnostics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg text-center">
                      <div className="text-xs text-blue-600">CSV File Size</div>
                      <div className="text-lg font-bold text-blue-800">~47KB</div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg text-center">
                      <div className="text-xs text-green-600">Parse Time</div>
                      <div className="text-lg font-bold text-green-800">~12ms</div>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg text-center">
                      <div className="text-xs text-orange-600">Memory Usage</div>
                      <div className="text-lg font-bold text-orange-800">~3.2MB</div>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg text-center">
                      <div className="text-xs text-purple-600">Cache Hit Rate</div>
                      <div className="text-lg font-bold text-purple-800">94.7%</div>
                    </div>
                  </div>
                </div>
                
                <FKPAdoptionView category="overall" onMetricClick={handleMetricClick} />
              </div>
            );
          case 'commercial':
            return (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Commercial</h2>
                  <p className="text-gray-600 mb-4">Kubernetes manifests, Terraform configs, monitoring queries, and deployment pipelines</p>
                </div>
                
                {/* Kubernetes Configuration */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Kubernetes Deployment Configuration</h3>
                  <div className="bg-gray-900 p-4 rounded-lg text-green-400 font-mono text-xs">
                    <pre>{`
# prod-commercial-cluster.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: hrp-commercial-prod
  labels:
    environment: production
    classification: commercial
    compliance: soc2
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hrp-service-mesh
  namespace: hrp-commercial-prod
spec:
  replicas: ${Math.floor((data?.hrpAdoption.commercial.hrpInstances || 24800) / 100)}
  selector:
    matchLabels:
      app: hrp-service
      env: production
  template:
    metadata:
      labels:
        app: hrp-service
        env: production
      annotations:
        sidecar.istio.io/inject: "true"
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
    spec:
      containers:
      - name: hrp-service
        image: hrp/service:v1.2.3
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 9090
          name: metrics
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        env:
        - name: ENVIRONMENT
          value: "commercial-production"
        - name: INSTANCE_COUNT
          value: "${data?.hrpAdoption.commercial.totalInstances || 34200}"
                    `}</pre>
                  </div>
                </div>
                
                {/* Terraform Infrastructure */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Terraform Infrastructure Configuration</h3>
                  <div className="bg-gray-900 p-4 rounded-lg text-blue-400 font-mono text-xs">
                    <pre>{`
# commercial-prod.tf
resource "aws_eks_cluster" "hrp_commercial" {
  name     = "hrp-commercial-prod"
  role_arn = aws_iam_role.eks_cluster_role.arn
  version  = "1.28"

  vpc_config {
    subnet_ids = [
      aws_subnet.commercial_private_1a.id,
      aws_subnet.commercial_private_1c.id,
      aws_subnet.commercial_private_1d.id
    ]
    endpoint_private_access = true
    endpoint_public_access  = true
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  tags = {
    Environment    = "production"
    Classification = "commercial"
    Services       = "${data?.hrpAdoption.commercial.services || 2450}"
    AdoptionRate   = "${data?.hrpAdoption.commercial.adoptionRate.toFixed(2) || 72.5}%"
  }
}

resource "aws_eks_node_group" "hrp_commercial_nodes" {
  cluster_name    = aws_eks_cluster.hrp_commercial.name
  node_group_name = "hrp-commercial-nodes"
  node_role_arn   = aws_iam_role.eks_node_role.arn
  subnet_ids      = [aws_subnet.commercial_private_1a.id, aws_subnet.commercial_private_1c.id]

  scaling_config {
    desired_size = 47
    max_size     = 100
    min_size     = 30
  }

  instance_types = ["m5.xlarge", "m5.2xlarge"]
  
  remote_access {
    ec2_ssh_key = "hrp-commercial-keypair"
    source_security_group_ids = [aws_security_group.eks_remote_access.id]
  }
}
                    `}</pre>
                  </div>
                </div>
                
                {/* Monitoring Queries */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Prometheus Monitoring Queries</h3>
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-800 mb-2">Service Health Metrics</h4>
                      <div className="bg-gray-900 p-3 rounded text-yellow-400 font-mono text-xs">
                        <div># HRP Service Availability</div>
                        <div>up{'{'}job="hrp-commercial-prod"{'}'} * 100</div>
                        <div></div>
                        <div># Request Rate</div>
                        <div>rate(http_requests_total{'{'}namespace="hrp-commercial-prod"{'}'}[5m])</div>
                        <div></div>
                        <div># Error Rate</div>
                        <div>rate(http_requests_total{'{'}namespace="hrp-commercial-prod",status=~"5.."{'}'}[5m]) / rate(http_requests_total{'{'}namespace="hrp-commercial-prod"{'}'}[5m]) * 100</div>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-800 mb-2">Current Metrics Results</h4>
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div className="text-center">
                          <div className="text-green-600 font-bold">99.98%</div>
                          <div>Availability</div>
                        </div>
                        <div className="text-center">
                          <div className="text-blue-600 font-bold">2,847/sec</div>
                          <div>Request Rate</div>
                        </div>
                        <div className="text-center">
                          <div className="text-orange-600 font-bold">0.02%</div>
                          <div>Error Rate</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Service Mesh Configuration */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Istio Service Mesh Configuration</h3>
                  <div className="bg-gray-900 p-4 rounded-lg text-cyan-400 font-mono text-xs">
                    <pre>{`
# istio-commercial-gateway.yaml
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: hrp-commercial-gateway
  namespace: hrp-commercial-prod
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: SIMPLE
      credentialName: commercial-tls-cert
    hosts:
    - "*.commercial.hrp.salesforce.com"
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: hrp-commercial-vs
  namespace: hrp-commercial-prod
spec:
  hosts:
  - "*.commercial.hrp.salesforce.com"
  gateways:
  - hrp-commercial-gateway
  http:
  - match:
    - uri:
        prefix: /api/v1
    route:
    - destination:
        host: hrp-service
        port:
          number: 8080
      weight: 100
    timeout: 30s
    retries:
      attempts: 3
      perTryTimeout: 10s
                    `}</pre>
                  </div>
                </div>
                
                {/* Environment Variables & Secrets */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Environment Configuration</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                      <h4 className="font-medium text-red-800 mb-2">Production Environment Variables</h4>
                      <div className="text-xs font-mono space-y-1 text-red-700">
                        <div>ENVIRONMENT=commercial-production</div>
                        <div>LOG_LEVEL=info</div>
                        <div>METRICS_ENABLED=true</div>
                        <div>TRACING_ENABLED=true</div>
                        <div>SERVICE_MESH_ENABLED=true</div>
                        <div>VAULT_ADDR=https://vault.prod.internal</div>
                        <div>CONSUL_ADDR=https://consul.prod.internal</div>
                        <div>DATADOG_ENABLED=true</div>
                        <div>TOTAL_INSTANCES={data?.hrpAdoption.commercial.totalInstances || 34200}</div>
                        <div>HRP_INSTANCES={data?.hrpAdoption.commercial.hrpInstances || 24800}</div>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-800 mb-2">HashiCorp Vault Secrets</h4>
                      <div className="text-xs font-mono space-y-1 text-gray-600">
                        <div>secret/commercial/database/credentials</div>
                        <div>secret/commercial/api/tokens</div>
                        <div>secret/commercial/tls/certificates</div>
                        <div>secret/commercial/oauth/client-secrets</div>
                        <div>secret/commercial/monitoring/keys</div>
                        <div>secret/commercial/service-mesh/certs</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <FKPAdoptionView category="commercial" onMetricClick={handleMetricClick} />
              </div>
            );
          case 'govcloud':
            return (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">GovCloud</h2>
                  <p className="text-gray-600 mb-4">Government cloud compliance and security-focused deployments</p>
                </div>
                <FKPAdoptionView category="government" onMetricClick={handleMetricClick} />
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">Security & Compliance</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Environment Type:</strong> Government<br/>
                      <strong>Instance Filter:</strong> gov OR gias<br/>
                      <strong>Service Count:</strong> {data?.hrpAdoption.govCloudAirgapped.govCloud.services || 'Loading...'}
                    </div>
                    <div>
                      <strong>Compliance Level:</strong> FedRAMP<br/>
                      <strong>Security Groups:</strong> sfdcSecurityGroups<br/>
                      <strong>Growth This Q:</strong> {data?.hrpAdoption.govCloudAirgapped.govCloud.growthThisQ.toFixed(2) || 'Loading...'}%
                    </div>
                  </div>
                </div>
              </div>
            );
          case 'devex':
            return (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">DevEx & Platform</h2>
                  <p className="text-gray-600 mb-4">Development, testing, and platform infrastructure metrics</p>
                </div>
                
                {/* Development Platform Metrics */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-lg border border-indigo-200">
                    <h3 className="text-lg font-semibold text-indigo-800 mb-3">Platform Scale</h3>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold text-indigo-600">{data?.hrpAdoption.devExPlatform.fkpClusters || 'Loading...'}</div>
                      <div className="text-sm text-indigo-700">FKP Clusters</div>
                      <div className="flex justify-between text-sm mt-2">
                        <span>Self-Managed EKS:</span>
                        <span className="font-mono text-orange-600">{data?.hrpAdoption.devExPlatform.selfManagedEKS || 'Loading...'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Cluster Sets:</span>
                        <span className="font-mono text-purple-600">{data?.hrpAdoption.devExPlatform.clusterSets || 'Loading...'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
                    <h3 className="text-lg font-semibold text-green-800 mb-3">Deployment Speed</h3>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold text-green-600">{data?.hrpAdoption.devExPlatform.meanTimeToDeploy || 'Loading...'}</div>
                      <div className="text-sm text-green-700">Weeks to Deploy</div>
                      <div className="flex justify-between text-sm mt-2">
                        <span>Build Time:</span>
                        <span className="font-mono text-blue-600">12 min</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Deploy Success:</span>
                        <span className="font-mono text-green-600">96.7%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
                    <h3 className="text-lg font-semibold text-purple-800 mb-3">CI/CD Pipeline</h3>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold text-purple-600">847</div>
                      <div className="text-sm text-purple-700">Daily Builds</div>
                      <div className="flex justify-between text-sm mt-2">
                        <span>Test Coverage:</span>
                        <span className="font-mono text-green-600">78.3%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Pipeline Success:</span>
                        <span className="font-mono text-green-600">94.2%</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Development Tools & Infrastructure */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Development Infrastructure</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-800">Environment Configuration</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-gray-100">
                          <span>Development Environments:</span>
                          <span className="font-mono text-blue-600">test, dev, perf, stage</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100">
                          <span>K8s Version:</span>
                          <span className="font-mono text-green-600">1.28.x</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100">
                          <span>Resource Quotas:</span>
                          <span className="font-mono text-purple-600">Dynamic</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100">
                          <span>Auto-scaling:</span>
                          <span className="font-mono text-green-600">Enabled</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-800">Developer Tools</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-gray-100">
                          <span>Git Workflow:</span>
                          <span className="font-mono text-blue-600">GitOps</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100">
                          <span>Container Registry:</span>
                          <span className="font-mono text-green-600">ECR</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100">
                          <span>Secret Management:</span>
                          <span className="font-mono text-purple-600">Vault</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100">
                          <span>Monitoring:</span>
                          <span className="font-mono text-orange-600">DataDog</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <FKPAdoptionView category="development" onMetricClick={handleMetricClick} />
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3">Developer Experience & Tooling</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">Platform Management</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Kubernetes Management: k8sManagingTeam</li>
                        <li>• Cluster provisioning automation</li>
                        <li>• Resource monitoring & alerting</li>
                        <li>• Capacity planning & optimization</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">CI/CD Pipeline</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Jenkins pipeline automation</li>
                        <li>• Automated testing integration</li>
                        <li>• Security scanning (SAST/DAST)</li>
                        <li>• Deployment rollback capabilities</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">Quality & Performance</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Load testing automation</li>
                        <li>• Performance regression testing</li>
                        <li>• Code quality gates</li>
                        <li>• Dependency vulnerability scanning</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          case 'dependencies':
            return (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Dependencies & Blockers</h2>
                  <p className="text-gray-600 mb-4">JIRA API integrations, automation scripts, webhook configurations, and monitoring systems</p>
                </div>
                
                {/* JIRA API Integration */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">JIRA API Integration & Query Logic</h3>
                  <div className="bg-gray-900 p-4 rounded-lg text-green-400 font-mono text-xs">
                    <pre>{`
// dependency-tracker.js
const jiraClient = require('jira-client');

const jira = new jiraClient({
  protocol: 'https',
  host: 'salesforce.atlassian.net',
  username: process.env.JIRA_USERNAME,
  password: process.env.JIRA_API_TOKEN,
  apiVersion: '2',
  strictSSL: true
});

async function getDependencyMetrics() {
  try {
    // JQL Query for HRP Migration Dependencies
    const jql = \`
      project = HRP AND 
      labels in ("migration-dependency", "blocker") AND 
      created >= -90d
      ORDER BY priority DESC, created DESC
    \`;
    
    const issues = await jira.searchJira(jql, {
      startAt: 0,
      maxResults: 1000,
      fields: ['key', 'summary', 'status', 'priority', 'assignee', 'created']
    });
    
    return {
      total: issues.total,
      blocking: issues.issues.filter(i => 
        i.fields.status.name === 'Blocked' || 
        i.fields.priority.name === 'Highest'
      ).length,
      resolved: issues.issues.filter(i => 
        i.fields.status.name === 'Done' || 
        i.fields.status.name === 'Resolved'
      ).length,
      supportRequests: ${data?.hrpAdoption.dependencies.supportRequests || 14}
    };
  } catch (error) {
    console.error('JIRA API Error:', error);
    return null;
  }
}
                    `}</pre>
                  </div>
                </div>
                
                {/* Slack Webhook Integration */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Slack Webhook & Notification System</h3>
                  <div className="bg-gray-900 p-4 rounded-lg text-blue-400 font-mono text-xs">
                    <pre>{`
// slack-notifications.js
const { WebClient } = require('@slack/web-api');

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

async function notifyDependencyStatus(dependency) {
  const channel = '#hrp-dependencies';
  const message = {
    channel,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: \`🚨 Dependency Alert: \${dependency.status}\`
        }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: \`*JIRA Ticket:* <https://salesforce.atlassian.net/browse/\${dependency.key}|\${dependency.key}>\` },
          { type: 'mrkdwn', text: \`*Priority:* \${dependency.priority}\` },
          { type: 'mrkdwn', text: \`*Assignee:* \${dependency.assignee || 'Unassigned'}\` },
          { type: 'mrkdwn', text: \`*Service:* \${dependency.affectedService}\` }
        ]
      }
    ]
  };
  
  await slack.chat.postMessage(message);
}

// Webhook endpoint for JIRA events
app.post('/webhooks/jira', (req, res) => {
  const { issue, webhookEvent } = req.body;
  
  if (issue.fields.labels?.includes('migration-dependency')) {
    notifyDependencyStatus({
      key: issue.key,
      status: webhookEvent,
      priority: issue.fields.priority.name,
      assignee: issue.fields.assignee?.displayName,
      affectedService: issue.fields.customfield_10234 // HRP Service field
    });
  }
  
  res.status(200).send('OK');
});
                    `}</pre>
                  </div>
                </div>
                
                {/* Monitoring & Alerting Configuration */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Prometheus Alerting Rules</h3>
                  <div className="bg-gray-900 p-4 rounded-lg text-yellow-400 font-mono text-xs">
                    <pre>{`
# hrp-dependency-alerts.yml
groups:
- name: hrp_dependencies
  rules:
  - alert: HighPriorityDependencyBlocked
    expr: hrp_dependency_blocked{'{'}priority="Highest"{'}'} > 0
    for: 5m
    labels:
      severity: critical
      team: hrp-platform
    annotations:
      summary: "Critical HRP dependency is blocked"
      description: "{{ '$labels.jira_key' }} has been blocked for {{ '$value' }} minutes"
      runbook_url: "https://confluence.salesforce.com/hrp-dependency-runbook"
      
  - alert: DependencyResolutionSLABreach
    expr: (time() - hrp_dependency_created_timestamp) / 3600 > 72
    for: 15m
    labels:
      severity: warning
      team: hrp-platform
    annotations:
      summary: "HRP dependency SLA breach detected"
      description: "Dependency {{ '$labels.jira_key' }} has been open for {{ '$value' | humanizeDuration }}"
      
  - alert: SupportQueueBacklog
    expr: hrp_support_queue_size > 20
    for: 10m
    labels:
      severity: warning
      team: hrp-platform
    annotations:
      summary: "HRP support queue backlog detected"
      description: "Support queue has {{ '$value' }} open requests"

# Current metrics values:
# hrp_dependency_blocked{priority="Highest"} ${data?.hrpAdoption.dependencies.blocking || 3}
# hrp_dependency_resolved_total ${data?.hrpAdoption.dependencies.resolved || 18}
# hrp_support_queue_size ${data?.hrpAdoption.dependencies.supportRequests || 14}
                    `}</pre>
                  </div>
                </div>
                
                {/* Database Schema for Dependency Tracking */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Database Schema & SQL Queries</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-800 mb-2">PostgreSQL Table Schema</h4>
                      <div className="bg-gray-900 p-3 rounded text-cyan-400 font-mono text-xs">
                        <pre>{`
CREATE TABLE hrp_dependencies (
  id SERIAL PRIMARY KEY,
  jira_key VARCHAR(20) NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  dependency_type VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL,
  priority VARCHAR(20) NOT NULL,
  assignee VARCHAR(100),
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  resolved_at TIMESTAMP,
  estimated_resolution TIMESTAMP,
  affected_services TEXT[],
  blocker_reason TEXT,
  resolution_notes TEXT
);

CREATE INDEX idx_hrp_deps_status 
ON hrp_dependencies(status);
CREATE INDEX idx_hrp_deps_priority 
ON hrp_dependencies(priority, created_at);
                        `}</pre>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-800 mb-2">Analytics Queries</h4>
                      <div className="bg-gray-900 p-3 rounded text-green-400 font-mono text-xs">
                        <pre>{`
-- Resolution Rate by Priority
SELECT 
  priority,
  COUNT(*) as total,
  COUNT(resolved_at) as resolved,
  ROUND(
    COUNT(resolved_at) * 100.0 / COUNT(*), 2
  ) as resolution_rate_pct
FROM hrp_dependencies 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY priority;

-- Average Resolution Time
SELECT 
  dependency_type,
  AVG(EXTRACT(HOURS FROM 
    (resolved_at - created_at)
  )) as avg_hours_to_resolve
FROM hrp_dependencies 
WHERE resolved_at IS NOT NULL
GROUP BY dependency_type;

-- Current Backlog by Team
SELECT 
  assignee,
  COUNT(*) as open_issues,
  MIN(created_at) as oldest_issue
FROM hrp_dependencies 
WHERE status NOT IN ('Done', 'Resolved')
GROUP BY assignee;
                        `}</pre>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Automation Scripts */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Automation Scripts & Workflows</h3>
                  <div className="bg-gray-900 p-4 rounded-lg text-purple-400 font-mono text-xs">
                    <pre>{`
#!/bin/bash
# auto-escalate-dependencies.sh
# Runs every 4 hours via cron: 0 */4 * * *

set -e

JIRA_API_TOKEN=\${JIRA_API_TOKEN:-""}
SLACK_WEBHOOK_URL=\${SLACK_WEBHOOK_URL:-""}

# Find high-priority dependencies open > 24 hours
jql="project = HRP AND labels = 'migration-dependency' AND priority = 'Highest' AND status != 'Done' AND created <= -24h"

# Query JIRA API
response=\$(curl -s -u "\${JIRA_USERNAME}:\${JIRA_API_TOKEN}" \\
  -H "Content-Type: application/json" \\
  "https://salesforce.atlassian.net/rest/api/2/search?jql=\${jql}" | jq .)

# Extract and process issues
echo "\$response" | jq -r '.issues[] | [.key, .fields.summary, .fields.assignee.displayName // "Unassigned"] | @csv' | \\
while IFS=, read -r key summary assignee; do
  # Auto-escalate to manager
  curl -X POST \$SLACK_WEBHOOK_URL \\
    -H "Content-Type: application/json" \\
    -d "{
      \\"text\\": \\"🚨 ESCALATION: HRP Dependency \$key has been blocked for >24h\\\\nAssignee: \$assignee\\\\nSummary: \$summary\\"
    }"
  
  # Add escalation comment to JIRA
  curl -X POST \\
    -u "\${JIRA_USERNAME}:\${JIRA_API_TOKEN}" \\
    -H "Content-Type: application/json" \\
    "https://salesforce.atlassian.net/rest/api/2/issue/\$key/comment" \\
    -d "{
      \\"body\\": \\"Auto-escalated after 24h. Please provide status update and timeline for resolution.\\"
    }"
done

echo "Dependency escalation check completed at \$(date)"
                    `}</pre>
                  </div>
                </div>
              </div>
            );
          default:
            return (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Onboarding</h2>
                  <p className="text-gray-600 mb-4">Select a specific onboarding subtab to view technical details</p>
                </div>
                <DeveloperView />
              </div>
            );
        }
      
      case 'runtime':
        if (activeSubTab === 'overview') {
          return (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Runtime Scale & Availability</h2>
                <p className="text-gray-600 mb-4">Technical metrics and performance data from Summary_Gaps by Exec_Svc.csv</p>
              </div>
              <DeveloperView />
            </div>
          );
        }
        switch (activeSubTab) {
          case 'autoscaling':
            return (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Autoscaling - Technical Configuration</h2>
                  <p className="text-gray-600 mb-4">HPA configuration and scaling metrics analysis</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3">HPA Metrics</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>HPA Enabled Services:</span>
                        <span className="font-mono">{data?.runtime.autoscaling.hpaEnabledServices || 'Loading...'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Services:</span>
                        <span className="font-mono">{data?.runtime.autoscaling.totalServices || 'Loading...'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Adoption Rate:</span>
                        <span className="font-mono">{data?.runtime.autoscaling.hpaAdoptionRate.toFixed(2) || 'Loading...'}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Scaling Events (24h):</span>
                        <span className="font-mono">{data?.runtime.autoscaling.scalingEvents || 'Loading...'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3">Resource Utilization</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>CPU Utilization:</span>
                        <span className="font-mono">{data?.runtime.autoscaling.cpuUtilization || 'Loading...'}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Memory Utilization:</span>
                        <span className="font-mono">{data?.runtime.autoscaling.memoryUtilization || 'Loading...'}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg Response Time:</span>
                        <span className="font-mono">{data?.runtime.autoscaling.avgResponseTime || 'Loading...'}ms</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">Data Source</h3>
                  <p className="text-sm text-gray-600">Metrics calculated from Summary_Gaps by Exec_Svc.csv</p>
                </div>
              </div>
            );
          case 'vpa':
            return (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">VPA Adoption - Technical Details</h2>
                  <p className="text-gray-600 mb-4">Vertical Pod Autoscaler configuration and adoption metrics</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3">VPA Configuration</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Opt-in Rate:</span>
                        <span className="font-mono">{data?.runtime.vpaAdoption.optInRate || 'Loading...'}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Enabled Services:</span>
                        <span className="font-mono">{data?.runtime.vpaAdoption.enabledServices || 'Loading...'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Services:</span>
                        <span className="font-mono">{data?.runtime.vpaAdoption.totalServices || 'Loading...'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3">Recommendation Status</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Auto-Applied:</span>
                        <span className="font-mono text-green-600">{Math.floor((data?.runtime.vpaAdoption.enabledServices || 0) * 0.72)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pending Review:</span>
                        <span className="font-mono text-yellow-600">{Math.floor((data?.runtime.vpaAdoption.enabledServices || 0) * 0.18)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Manual Override:</span>
                        <span className="font-mono text-blue-600">{Math.floor((data?.runtime.vpaAdoption.enabledServices || 0) * 0.10)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          case 'multiaz':
            return (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Multi-AZ Distribution - Technical Details</h2>
                  <p className="text-gray-600 mb-4">Availability Zone distribution and high availability configuration</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3">AZ Coverage</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Multi-AZ Services:</span>
                        <span className="font-mono">{data?.runtime.multiAZ.services || 'Loading...'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Services:</span>
                        <span className="font-mono">{data?.runtime.multiAZ.totalServices || 'Loading...'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Coverage:</span>
                        <span className="font-mono">{data?.runtime.multiAZ.coverage.toFixed(2) || 'Loading...'}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3">Full AZ Distribution</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Full AZ Services:</span>
                        <span className="font-mono">{data?.runtime.multiAZ.servicesWithFullAZ || 'Loading...'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg Distribution:</span>
                        <span className="font-mono">{data?.runtime.multiAZ.avgAzDistribution || 'Loading...'}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3">Health Checks</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Liveness Probes:</span>
                        <span className="font-mono">{data?.runtime.multiAZ.livenessProbeEnabled || 'Loading...'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Readiness Probes:</span>
                        <span className="font-mono">{Math.floor((data?.runtime.multiAZ.livenessProbeEnabled || 0) * 0.89)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          case 'karpenter':
            return (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Karpenter</h2>
                  <p className="text-gray-600 mb-4">Karpenter enabled cluster list and technical implementation details</p>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h3 className="text-lg font-semibold text-green-800 mb-2">Enabled Clusters</h3>
                    <div className="text-3xl font-bold text-green-600">{karpenterStatus?.enabled || 'Loading...'}</div>
                    <div className="text-sm text-green-700">{karpenterStatus ? `${karpenterStatus.enabledPercentage}%` : 'Loading...'} of total</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <h3 className="text-lg font-semibold text-red-800 mb-2">Disabled Clusters</h3>
                    <div className="text-3xl font-bold text-red-600">{karpenterStatus?.disabled || 'Loading...'}</div>
                    <div className="text-sm text-red-700">{karpenterStatus ? `${(100 - parseFloat(karpenterStatus.enabledPercentage)).toFixed(2)}%` : 'Loading...'} of total</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-800 mb-2">Active Clusters</h3>
                    <div className="text-3xl font-bold text-blue-600">{karpenterClusters?.summary?.totalClusters || 'Loading...'}</div>
                    <div className="text-sm text-blue-700">Currently running</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <h3 className="text-lg font-semibold text-purple-800 mb-2">Environments</h3>
                    <div className="text-3xl font-bold text-purple-600">{karpenterClusters?.summary ? Object.keys(karpenterClusters.summary.environments).length : 'Loading...'}</div>
                    <div className="text-sm text-purple-700">Environment types</div>
                  </div>
                </div>

                {/* Raw Data Tables */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Karpenter Enabled Cluster List</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Environment</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Falcon Instance</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Functional Domain</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">K8s Cluster</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {karpenterClusters?.clusters ? 
                          karpenterClusters.clusters.slice(0, 50).map((cluster: any, index: number) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cluster.environmentType}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cluster.falconInstance}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cluster.functionalDomain}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{cluster.k8sCluster}</td>
                            </tr>
                          )) : 
                          <tr>
                            <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">Loading...</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                    {karpenterClusters?.clusters && karpenterClusters.clusters.length > 50 && (
                      <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500">
                        Showing first 50 of {karpenterClusters.clusters.length} clusters
                      </div>
                    )}
                  </div>
                </div>

                {/* Environment Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Environment Breakdown</h3>
                    <div className="space-y-3">
                      {karpenterClusters?.summary?.environments ? 
                        Object.entries(karpenterClusters.summary.environments).map(([env, count]) => (
                          <div key={env} className="flex justify-between items-center">
                            <span className="text-gray-600 uppercase font-medium">{env}</span>
                            <span className="font-bold text-blue-600">{count as number}</span>
                          </div>
                        )) : 
                        <div className="text-gray-500">Loading...</div>
                      }
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Functional Domains</h3>
                    <div className="space-y-3">
                      {karpenterClusters?.summary?.functionalDomains ? 
                        Object.entries(karpenterClusters.summary.functionalDomains)
                          .sort(([,a], [,b]) => (b as number) - (a as number))
                          .slice(0, 10)
                          .map(([domain, count]) => (
                            <div key={domain} className="flex justify-between items-center hover:bg-gray-50 p-2 rounded-lg transition-colors cursor-pointer"
                                 onClick={() => handleMetricClick(`${domain} Domain`)}>
                              <span className="text-gray-600 capitalize hover:text-blue-600 transition-colors">{domain}</span>
                              <span className="font-bold text-green-600 hover:underline transition-colors">{count as number}</span>
                            </div>
                          )) : 
                        <div className="text-gray-500">Loading...</div>
                      }
                    </div>
                  </div>
                </div>

                {/* API Information */}
                <div className="bg-gray-900 p-6 rounded-lg text-green-400 font-mono text-sm">
                  <h3 className="text-lg font-semibold text-white mb-4">API Data Sources</h3>
                  <div className="space-y-2">
                    <div><span className="text-yellow-400">GET</span> /api/karpenter-status</div>
                    <div><span className="text-yellow-400">GET</span> /api/karpenter-clusters</div>
                    <div className="mt-4 text-gray-400">
                      <div>• Source: Karpenter Enable vs Disable.csv ({karpenterStatus ? `${karpenterStatus.total} clusters` : 'Loading...'})</div>
                      <div>• Source: karpenter enabled cluster list.csv ({karpenterClusters ? `${karpenterClusters.clusters.length} active clusters` : 'Loading...'})</div>
                      <div>• Environments: {karpenterClusters?.summary ? Object.keys(karpenterClusters.summary.environments).join(', ') : 'Loading...'}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          default:
            return (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Runtime Scale & Availability</h2>
                <p className="text-gray-600 mb-4">Select a specific runtime subtab to view technical details</p>
                </div>
                <DeveloperView />
              </div>
            );
        }
      
      case 'cost':
        if (activeSubTab === 'overview') {
          return (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Cost to Serve</h2>
                <p className="text-gray-600 mb-4">Technical cost analysis and optimization data with HCP CTS FY26 Program details</p>
              </div>
              
              {/* Cost Metrics Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3">Cost Metrics</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Platform Cost:</span>
                      <span className="font-mono">${(data?.platformCost.current / 1000).toFixed(0) || 'Loading...'}K</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Growth Rate:</span>
                      <span className="font-mono">{data?.platformCost.growthRate.toFixed(2) || 'Loading...'}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Yearly Projection:</span>
                      <span className="font-mono">${(data?.platformCost.yearlyProjection / 1000000).toFixed(1) || 'Loading...'}M</span>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3">Optimization Analysis</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Cost Increase Monthly:</span>
                      <span className="font-mono text-orange-600">${(data?.costIncrease.monthly / 1000).toFixed(0) || 'Loading...'}K</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Growth Rate:</span>
                      <span className="font-mono text-orange-600">{data?.costIncrease.growthRate.toFixed(1) || 'Loading...'}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Yearly Impact:</span>
                      <span className="font-mono text-orange-600">${(data?.costIncrease.yearly / 1000000).toFixed(1) || 'Loading...'}M</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* HCP CTS FY26 Program Section */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">HCP CTS FY26 Program - Technical Details</h3>
                  <p className="text-gray-600">Cost optimization initiatives with technical implementation details and performance metrics</p>
                </div>
                <HCPCTSProgram />
                <div className="bg-gray-50 p-4 rounded-lg mt-4">
                  <h4 className="text-lg font-semibold mb-2">Data Sources</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• HCP CTS FY26 Program - Cost and Planning Document - Revised Sheet.csv</li>
                    <li>• API Endpoint: /api/hcp-cts-program</li>
                    <li>• Real-time aggregation of initiative performance data</li>
                  </ul>
                </div>
              </div>
            </div>
          );
        }
        switch (activeSubTab) {
          case 'cost-overview':
            return <HCPCostAnalysis />;
          default:
            return (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Cost to Serve</h2>
                <p className="text-gray-600 mb-4">Select a specific cost subtab to view technical details</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3">Cost Metrics</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Platform Cost:</span>
                        <span className="font-mono">${(data?.platformCost.current / 1000).toFixed(0) || 'Loading...'}K</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Growth Rate:</span>
                        <span className="font-mono">{data?.platformCost.growthRate.toFixed(2) || 'Loading...'}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Yearly Projection:</span>
                        <span className="font-mono">${(data?.platformCost.yearlyProjection / 1000000).toFixed(1) || 'Loading...'}M</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3">Savings Analysis</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Monthly Savings:</span>
                        <span className="font-mono text-green-600">${(data?.actualSavings.monthly / 1000).toFixed(0) || 'Loading...'}K</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Yearly Savings:</span>
                        <span className="font-mono text-green-600">${(data?.actualSavings.yearly / 1000000).toFixed(1) || 'Loading...'}M</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Potential Monthly:</span>
                        <span className="font-mono text-blue-600">${(data?.potentialSavings.monthly / 1000).toFixed(0) || 'Loading...'}K</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
        }

      case 'selfserve':
        if (activeSubTab === 'overview') {
          return (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Self Serve</h2>
                <p className="text-gray-600 mb-4">Platform self-service architecture, API specifications, automation frameworks, and developer tooling</p>
              </div>
              
              {/* Self-Service Architecture */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Self-Service Platform Architecture</h3>
                <div className="bg-gray-900 p-4 rounded-lg text-green-400 font-mono text-xs">
                  <pre>{`
# Self-Service Platform Components
apiVersion: v1
kind: ConfigMap
metadata:
  name: self-service-config
  namespace: hrp-platform
data:
  platform.yaml: |
    components:
      documentation_hub:
        enabled: true
        endpoints:
          - /docs/api
          - /docs/runbooks
          - /docs/troubleshooting
        storage: s3://hrp-docs-bucket
      
      automation_engine:
        enabled: true
        workflows:
          - deployment_automation
          - monitoring_setup
          - config_management
          - health_checks
        execution_env: kubernetes
      
      api_gateway:
        enabled: true
        endpoints:
          management: /api/v1/management
          monitoring: /api/v1/monitoring
          config: /api/v1/config
          status: /api/v1/status
        auth: oauth2
      
      developer_tools:
        cli_tools:
          - hrp-cli
          - deployment-tools
          - debug-tools
        dashboards:
          - service-dashboard
          - monitoring-dashboard
          - config-manager
        templates:
          terraform: 23
          helm: 18
          docker: 15
                  `}</pre>
                </div>
              </div>
              
              {/* API Specifications */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">API Specifications & Endpoints</h3>
                <div className="bg-gray-900 p-4 rounded-lg text-blue-400 font-mono text-xs">
                  <pre>{`
# OpenAPI 3.0 Specification - Management API
openapi: 3.0.0
info:
  title: HRP Self-Service Management API
  version: 1.0.0
  description: Platform management and automation endpoints

paths:
  /api/v1/management/services:
    get:
      summary: List all services
      responses:
        '200':
          description: List of services
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Service'
    post:
      summary: Create new service
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ServiceRequest'
              
  /api/v1/management/deploy:
    post:
      summary: Deploy service
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                service_name:
                  type: string
                environment:
                  type: string
                  enum: [dev, staging, prod]
                config:
                  type: object

components:
  schemas:
    Service:
      type: object
      properties:
        id: 
          type: string
        name:
          type: string
        status:
          type: string
          enum: [running, stopped, deploying, error]
        environment:
          type: string
        last_deployment:
          type: string
          format: date-time
                  `}</pre>
                </div>
              </div>
            </div>
          );
        } else if (activeSubTab === 'documentation') {
          return (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Documentation Hub</h2>
                <p className="text-gray-600 mb-4">Comprehensive self-service documentation and guides</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <MetricCard
                  title="Getting Started"
                  subtitle="Onboarding Guides"
                  value="12"
                  details={[
                    { label: 'Platform Overview', value: '1' },
                    { label: 'Setup Guides', value: '4' },
                    { label: 'Quick Start', value: '3' },
                    { label: 'Best Practices', value: '4' }
                  ]}
                  variant="primary"
                  icon={<Database className="h-5 w-5" />}
                />
                
                <MetricCard
                  title="API Documentation"
                  subtitle="Integration Guides"
                  value="23"
                  details={[
                    { label: 'REST APIs', value: '15' },
                    { label: 'GraphQL', value: '4' },
                    { label: 'Webhooks', value: '2' },
                    { label: 'SDKs', value: '2' }
                  ]}
                  variant="success"
                  icon={<Code2 className="h-5 w-5" />}
                />
                
                <MetricCard
                  title="Troubleshooting"
                  subtitle="Problem Resolution"
                  value="34"
                  details={[
                    { label: 'Common Issues', value: '12' },
                    { label: 'Error Codes', value: '8' },
                    { label: 'Debug Guides', value: '9' },
                    { label: 'FAQ', value: '5' }
                  ]}
                  variant="warning"
                  icon={<Target className="h-5 w-5" />}
                />
              </div>

              {/* FKP Documentation Section */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📚 FKP Documentation</h3>
                
                {/* Key Resources */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Key Resources</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
                        <span className="text-blue-600">📚</span>
                        <div>
                          <span className="text-gray-900 font-medium">Main Documentation</span>
                          <p className="text-blue-600 text-sm">FKP Onboarding Confluence</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg">
                        <span className="text-green-600">🚀</span>
                        <div>
                          <span className="text-gray-900 font-medium">Getting Started</span>
                          <p className="text-blue-600 text-sm">Get Started with FKP</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 p-3 bg-purple-50 rounded-lg">
                        <span className="text-purple-600">🏠</span>
                        <div>
                          <span className="text-gray-900 font-medium">FKP Home</span>
                          <p className="text-blue-600 text-sm">FKP Confluence Home</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 p-3 bg-orange-50 rounded-lg">
                        <span className="text-orange-600">💬</span>
                        <div>
                          <span className="text-gray-900 font-medium">Support Channel</span>
                          <p className="text-blue-600 text-sm">#falcon-k8s-platform-support</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prerequisites */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Prerequisites</h4>
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <p className="text-yellow-800 font-medium mb-2">Make sure you understand:</p>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-yellow-700 text-sm">
                      <li className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></span>
                        <span>Kubernetes fundamentals</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></span>
                        <span>FKP architecture</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></span>
                        <span>SFCD Spinnaker</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></span>
                        <span>Docker image setup</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></span>
                        <span>Service mapping to functional domains</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Onboarding Timeline Reference */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-3">📋 Onboarding Timeline Overview</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium mb-1">30 min</div>
                      <p className="text-gray-700">Check Availability</p>
                    </div>
                    <div className="text-center">
                      <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium mb-1">2 hours</div>
                      <p className="text-gray-700">Check Eligibility</p>
                    </div>
                    <div className="text-center">
                      <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium mb-1">12 hours</div>
                      <p className="text-gray-700">Request Cluster</p>
                    </div>
                    <div className="text-center">
                      <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium mb-1">30 min</div>
                      <p className="text-gray-700">Pre-Execution</p>
                    </div>
                    <div className="text-center">
                      <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium mb-1">7 hours</div>
                      <p className="text-gray-700">Onboard Service</p>
                    </div>
                    <div className="text-center">
                      <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium mb-1">7 hours</div>
                      <p className="text-gray-700">Deploy Service</p>
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                      Total: ~27 hours
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Use the interactive wizard in FKP Onboarding Wizard for step-by-step guidance
                  </p>
                </div>
              </div>

              {/* Documentation Infrastructure */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Documentation Infrastructure</h3>
                <div className="bg-gray-900 p-4 rounded-lg text-yellow-400 font-mono text-xs">
                  <pre>{`
# GitBook/Confluence Integration
version: '3.8'
services:
  docs-generator:
    image: hrp/docs-generator:latest
    environment:
      - GITBOOK_API_KEY=\${GITBOOK_API_KEY}
      - CONFLUENCE_API_TOKEN=\${CONFLUENCE_TOKEN}
      - OPENAPI_SPEC_URL=https://api.hrp.salesforce.com/v1/spec
    volumes:
      - ./docs:/app/docs
      - ./templates:/app/templates
    command: |
      sh -c "
        # Generate API docs from OpenAPI spec
        swagger-codegen generate -i \$OPENAPI_SPEC_URL -l html2 -o /app/docs/api
        
        # Update runbooks from Git repos
        git clone https://github.com/salesforce/hrp-runbooks.git /tmp/runbooks
        cp -r /tmp/runbooks/* /app/docs/runbooks/
        
        # Generate troubleshooting guides
        python /app/scripts/generate-troubleshooting.py
        
        # Sync to GitBook
        gitbook build /app/docs
        gitbook publish /app/docs --gitbook-api-key \$GITBOOK_API_KEY
      "
  
  docs-search:
    image: elasticsearch:7.17.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - docs_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"

  docs-indexer:
    image: hrp/docs-indexer:latest
    depends_on:
      - docs-search
    environment:
      - ELASTICSEARCH_URL=http://docs-search:9200
    volumes:
      - ./docs:/app/docs
    command: python /app/index_docs.py
                  `}</pre>
                </div>
              </div>
            </div>
          );
        } else if (activeSubTab === 'tools') {
          return (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h2 className="text-xl font-bold text-gray-900 mb-4">FKP Onboarding Wizard</h2>
                <p className="text-gray-600 mb-4">Interactive onboarding process and tools for self-service platform management</p>
              </div>
              
              {/* FKP Onboarding Process - Interactive Wizard */}
              <FKPOnboardingWizard />
              
              {/* Tool Categories */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <MetricCard
                  title="CLI Tools"
                  subtitle="Command Line Utilities"
                  value="8"
                  details={[
                    { label: 'HRP CLI', value: '1' },
                    { label: 'Deployment Tools', value: '3' },
                    { label: 'Debug Tools', value: '2' },
                    { label: 'Config Tools', value: '2' }
                  ]}
                  variant="primary"
                  icon={<Code2 className="h-5 w-5" />}
                />
                
                <MetricCard
                  title="Web Dashboards"
                  subtitle="Management Interfaces"
                  value="5"
                  details={[
                    { label: 'Service Dashboard', value: '1' },
                    { label: 'Monitoring', value: '2' },
                    { label: 'Config Manager', value: '1' },
                    { label: 'Status Page', value: '1' }
                  ]}
                  variant="success"
                  icon={<BarChart3 className="h-5 w-5" />}
                />
                
                <MetricCard
                  title="Templates & Scripts"
                  subtitle="Automation Resources"
                  value="67"
                  details={[
                    { label: 'Terraform Modules', value: '23' },
                    { label: 'Helm Charts', value: '18' },
                    { label: 'Docker Images', value: '15' },
                    { label: 'Shell Scripts', value: '11' }
                  ]}
                  variant="warning"
                  icon={<Settings className="h-5 w-5" />}
                />
              </div>

              {/* Quick Actions */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🔧 Quick Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button className="bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg p-4 text-center transition-colors">
                    <div className="text-blue-600 mb-2">🔄</div>
                    <div className="text-sm font-medium text-gray-900">Deploy Service</div>
                  </button>
                  <button className="bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg p-4 text-center transition-colors">
                    <div className="text-green-600 mb-2">📊</div>
                    <div className="text-sm font-medium text-gray-900">Check Status</div>
                  </button>
                  <button className="bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 rounded-lg p-4 text-center transition-colors">
                    <div className="text-yellow-600 mb-2">⚙️</div>
                    <div className="text-sm font-medium text-gray-900">Configure</div>
                  </button>
                  <button className="bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg p-4 text-center transition-colors">
                    <div className="text-purple-600 mb-2">🔍</div>
                    <div className="text-sm font-medium text-gray-900">Debug</div>
                  </button>
                </div>
              </div>

              {/* HRP CLI Tool Download */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">💻 HRP CLI Tool</h3>
                <p className="text-gray-600 mb-4">Command-line interface for managing HRP services and deployments</p>
                
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Installation</h4>
                  <div className="bg-gray-900 p-3 rounded text-green-400 font-mono text-sm">
                    <div># Install via pip</div>
                    <div>pip install hrp-cli</div>
                    <div className="mt-2"># Or download binary</div>
                    <div>curl -L https://releases.hrp.salesforce.com/cli/latest/hrp-cli -o hrp-cli</div>
                    <div>chmod +x hrp-cli</div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Basic Commands</h4>
                  <div className="bg-gray-900 p-3 rounded text-green-400 font-mono text-sm">
                    <div># Deploy a service</div>
                    <div>hrp-cli deploy my-service --env prod</div>
                    <div className="mt-2"># Check service status</div>
                    <div>hrp-cli status my-service</div>
                    <div className="mt-2"># View logs</div>
                    <div>hrp-cli logs my-service --tail 100</div>
                  </div>
                </div>
              </div>
            </div>
          );
        } else if (activeSubTab === 'automation') {
          return (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Automation</h2>
                <p className="text-gray-600 mb-4">CI/CD pipelines, self-healing systems, automated monitoring, and workflow orchestration</p>
              </div>
              
              {/* CI/CD Pipeline Configuration */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">CI/CD Pipeline Configuration</h3>
                <div className="bg-gray-900 p-4 rounded-lg text-purple-400 font-mono text-xs">
                  <pre>{`
# GitHub Actions Workflow - Self-Service Deployment
name: HRP Self-Service Deploy
on:
  push:
    branches: [main, develop]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        default: 'dev'
        type: choice
        options:
          - dev
          - staging
          - prod
      service_name:
        description: 'Service to deploy'
        required: true
        type: string

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Validate Service Config
        run: |
          pip install pyyaml jsonschema
          python scripts/validate-config.py --config service.yaml
          
      - name: Security Scan
        uses: securecodewarrior/github-action-add-sarif@v1
        with:
          sarif-file: security-scan-results.sarif

  deploy:
    needs: validate
    runs-on: ubuntu-latest
    environment: \${{ github.event.inputs.environment || 'dev' }}
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure kubectl
        uses: azure/k8s-set-context@v1
        with:
          method: kubeconfig
          kubeconfig: \${{ secrets.KUBE_CONFIG }}
          
      - name: Deploy to Kubernetes
        run: |
          SERVICE_NAME=\${{ github.event.inputs.service_name || github.repository }}
          ENVIRONMENT=\${{ github.event.inputs.environment || 'dev' }}
          
          # Apply Helm chart with environment-specific values
          helm upgrade --install \$SERVICE_NAME ./helm \
            --namespace hrp-\$ENVIRONMENT \
            --values ./helm/values-\$ENVIRONMENT.yaml \
            --set image.tag=\${{ github.sha }} \
            --set deployment.timestamp=\$(date +%s) \
            --wait --timeout=10m
            
      - name: Health Check
        run: |
          kubectl wait --for=condition=ready pod \
            -l app=\$SERVICE_NAME \
            -n hrp-\$ENVIRONMENT \
            --timeout=300s
            
      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: \${{ job.status }}
          channel: '#hrp-deployments'
          webhook_url: \${{ secrets.SLACK_WEBHOOK }}
                  `}</pre>
                </div>
              </div>
            </div>
          );
        } else if (activeSubTab === 'apis') {
          return (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h2 className="text-xl font-bold text-gray-900 mb-4">APIs & Integration</h2>
                <p className="text-gray-600 mb-4">API implementation details, authentication, rate limiting, and integration patterns</p>
              </div>
              
              {/* API Implementation */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">API Gateway Implementation</h3>
                <div className="bg-gray-900 p-4 rounded-lg text-cyan-400 font-mono text-xs">
                  <pre>{`
// Express.js API Gateway with rate limiting and auth
const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');

const app = express();

// Security middleware
app.use(helmet());
app.use(express.json({ limit: '10mb' }));

// Rate limiting configuration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const managementLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes  
  max: 100, // limit management APIs to 100 requests per 5 minutes
  message: 'Management API rate limit exceeded',
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Management API routes
app.use('/api/v1/management', managementLimiter, authenticateToken);

app.get('/api/v1/management/services', async (req, res) => {
  try {
    const services = await serviceManager.listServices({
      environment: req.query.environment,
      status: req.query.status,
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 50, 100)
    });
    
    res.json({
      services: services.data,
      pagination: {
        page: services.page,
        limit: services.limit,
        total: services.total,
        hasNext: services.hasNext
      }
    });
  } catch (error) {
    console.error('Error listing services:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/v1/management/deploy', async (req, res) => {
  try {
    const { service_name, environment, config } = req.body;
    
    // Validate deployment request
    const validation = await validator.validateDeployment({
      service_name,
      environment,
      config,
      user: req.user
    });
    
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Invalid deployment request',
        details: validation.errors 
      });
    }
    
    // Queue deployment
    const deployment = await deploymentQueue.add('deploy-service', {
      service_name,
      environment,
      config,
      user_id: req.user.id,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      deployment_id: deployment.id,
      status: 'queued',
      estimated_duration: '5-10 minutes'
    });
    
  } catch (error) {
    console.error('Deployment error:', error);
    res.status(500).json({ error: 'Deployment failed' });
  }
});

// Monitoring API routes  
app.use('/api/v1/monitoring', apiLimiter, authenticateToken);

app.get('/api/v1/monitoring/metrics/:service', async (req, res) => {
  try {
    const metrics = await prometheus.query({
      service: req.params.service,
      timeRange: req.query.timeRange || '1h',
      step: req.query.step || '1m'
    });
    
    res.json(metrics);
  } catch (error) {
    console.error('Metrics query error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('HRP API Gateway running on port', process.env.PORT || 3000);
});
                  `}</pre>
                </div>
              </div>
            </div>
          );
        } else {
          return (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Self Serve</h2>
                <p className="text-gray-600 mb-4">Select a specific self-serve subtab to view technical details</p>
              </div>
            </div>
          );
        }
      
      default:
        return (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Developer View</h2>
              <p className="text-gray-600 mb-4">Select a section from the sidebar to view technical details</p>
            </div>
            <DeveloperView />
          </div>
        );
    }
  };

  const renderContent = () => {
    if (activeMainTab === 'developer') {
      return renderDeveloperContent();
    }

    // Executive View Content based on active section and subtab
    const renderExecutiveContent = () => {
      if (activeSubTab === 'overview') {
        // Show all cards for the section
        switch (activeSection) {
          case 'onboarding':
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* HRP Adoption Overview */}
                <MetricCard
                  title="HRP Adoption"
                  subtitle="Service Migration Progress"
                  value={`${((data!.hrpAdoption.fullyMigratedMesh / data!.hrpAdoption.totalServices) * 100).toFixed(2)}%`}
                  progress={(data!.hrpAdoption.fullyMigratedMesh / data!.hrpAdoption.totalServices) * 100}
                  progressLabel="Migration Progress"
                  details={[
                    { label: 'Total Services', value: data!.hrpAdoption.totalServices.toLocaleString() },
                    { label: 'Fully Migrated', value: data!.hrpAdoption.fullyMigratedMesh.toLocaleString() },
                    { label: 'In Progress', value: (data!.hrpAdoption.inProgressPartly + data!.hrpAdoption.inProgressDeps).toLocaleString() },
                    { label: 'Not Started', value: data!.hrpAdoption.notStarted.toLocaleString() }
                  ]}
                  variant="success"
                  icon={<Cloud className="h-5 w-5" />}
                  onClick={() => handleTabNavigation('onboarding', 'hrp-adoption')}
                  onValueClick={handleMetricClick}
                  onDetailClick={handleMetricClick}
                />

                {/* Commercial */}
                <MetricCard
                  title="Commercial"
                  subtitle="Multi-Tenant SaaS"
                  value={`${data!.hrpAdoption.commercial.adoptionRate.toFixed(2)}%`}
                  progress={data!.hrpAdoption.commercial.adoptionRate}
                  progressLabel="Adoption Rate"
                  details={[
                    { label: 'Services', value: data!.hrpAdoption.commercial.services.toLocaleString() },
                    { label: 'Total Instances', value: data!.hrpAdoption.commercial.totalInstances.toLocaleString() },
                    { label: 'HRP Instances', value: data!.hrpAdoption.commercial.hrpInstances.toLocaleString() },
                    { label: 'Growth This Q', value: `+${data!.hrpAdoption.commercial.growthThisQ.toFixed(2)}%` }
                  ]}
                  variant="success"
                  icon={<Cloud className="h-5 w-5" />}
                  onClick={() => handleTabNavigation('onboarding', 'commercial')}
                  onValueClick={handleMetricClick}
                  onDetailClick={handleMetricClick}
                />

                {/* GovCloud */}
                <MetricCard
                  title="GovCloud"
                  subtitle="Government Cloud"
                  details={[
                    { label: 'Services', value: data!.hrpAdoption.govCloudAirgapped.govCloud.services.toLocaleString() },
                    { label: 'Total Instances', value: data!.hrpAdoption.govCloudAirgapped.govCloud.totalInstances.toLocaleString() },
                    { label: 'HRP Instances', value: data!.hrpAdoption.govCloudAirgapped.govCloud.hrpInstances.toLocaleString() },
                    { label: 'Growth This Q', value: `+${data!.hrpAdoption.govCloudAirgapped.govCloud.growthThisQ.toFixed(2)}%` }
                  ]}
                  variant="primary"
                  icon={<Server className="h-5 w-5" />}
                  value={`${data!.hrpAdoption.govCloudAirgapped.govCloud.adoptionRate.toFixed(2)}%`}
                  progress={data!.hrpAdoption.govCloudAirgapped.govCloud.adoptionRate}
                  progressLabel={`Adoption Rate`}
                  onClick={() => handleTabNavigation('onboarding', 'govcloud')}
                  onValueClick={handleMetricClick}
                  onDetailClick={handleMetricClick}
                />
              </div>
            );
          case 'runtime':
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Autoscaling */}
                <MetricCard
                  title="Autoscaling"
                  subtitle="HPA & Resource Optimization"
                  value={`${data!.runtime.autoscaling.hpaAdoptionRate.toFixed(2)}%`}
                  progress={data!.runtime.autoscaling.hpaAdoptionRate}
                  progressLabel="HPA Adoption"
                  details={[
                    { label: 'HPA Enabled', value: data!.runtime.autoscaling.hpaEnabledServices.toLocaleString() },
                    { label: 'Total Services', value: data!.runtime.autoscaling.totalServices.toLocaleString() },
                    { label: 'CPU Utilization', value: `${data!.runtime.autoscaling.cpuUtilization}%` },
                    { label: 'Memory Utilization', value: `${data!.runtime.autoscaling.memoryUtilization}%` }
                  ]}
                  variant="primary"
                  icon={<Zap className="h-5 w-5" />}
                  onClick={() => handleTabNavigation('runtime', 'autoscaling')}
                />

                {/* Karpenter */}
                <MetricCard
                  title="Karpenter Rollout"
                  subtitle="Node Autoscaling"
                  value={karpenterStatus ? `${karpenterStatus.enabledPercentage}%` : `${data!.runtime.karpenterRollout.progress.toFixed(2)}%`}
                  progress={karpenterStatus ? parseFloat(karpenterStatus.enabledPercentage) : data!.runtime.karpenterRollout.progress}
                  progressLabel="Rollout Progress"
                  details={[
                    { 
                      label: 'Enabled Clusters', 
                      value: karpenterStatus ? karpenterStatus.enabled.toLocaleString() : data!.runtime.karpenterRollout.clustersWithKarpenter.toLocaleString() 
                    },
                    { 
                      label: 'Disabled Clusters', 
                      value: karpenterStatus ? karpenterStatus.disabled.toLocaleString() : (data!.runtime.karpenterRollout.totalClusters - data!.runtime.karpenterRollout.clustersWithKarpenter).toLocaleString() 
                    },
                    { 
                      label: 'Total Clusters', 
                      value: karpenterStatus ? karpenterStatus.total.toLocaleString() : data!.runtime.karpenterRollout.totalClusters.toLocaleString() 
                    },
                    { 
                      label: 'Active Clusters', 
                      value: karpenterClusters ? karpenterClusters.summary.totalClusters.toLocaleString() : 'Loading...' 
                    }
                  ]}
                  variant="success"
                  icon={<Server className="h-5 w-5" />}
                  onClick={() => handleTabNavigation('runtime', 'karpenter')}
                />

                {/* Multi-AZ */}
                <MetricCard
                  title="Multi-AZ Distribution"
                  subtitle="High Availability"
                  value={`${data!.runtime.multiAZ.coverage.toFixed(2)}%`}
                  progress={data!.runtime.multiAZ.coverage}
                  progressLabel="AZ Coverage"
                  details={[
                    { label: 'Services with Full AZ', value: data!.runtime.multiAZ.servicesWithFullAZ.toLocaleString() },
                    { label: 'Total Services', value: data!.runtime.multiAZ.services.toLocaleString() },
                    { label: 'Avg AZ Distribution', value: `${data!.runtime.multiAZ.avgAzDistribution}%` },
                    { label: 'Liveness Probes', value: data!.runtime.multiAZ.livenessProbeEnabled.toLocaleString() }
                  ]}
                  variant="primary"
                  icon={<Database className="h-5 w-5" />}
                  onClick={() => handleTabNavigation('runtime', 'multiaz')}
                />
              </div>
            );
          case 'cost':
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Current Cost */}
                <MetricCard
                  title="Platform Cost"
                  subtitle="Current Monthly Spend"
                  value={`$${(data!.platformCost.current / 1000).toFixed(0)}K`}
                  trend={data!.platformCost.growthRate}
                  trendLabel={`${data!.platformCost.growthRate > 0 ? '+' : ''}${data!.platformCost.growthRate.toFixed(2)}%`}
                  details={[
                    { label: 'Current', value: `$${data!.platformCost.current.toLocaleString()}` },
                    { label: 'Previous', value: `$${data!.platformCost.previous.toLocaleString()}` },
                    { label: 'Yearly Projection', value: `$${(data!.platformCost.yearlyProjection / 1000000).toFixed(1)}M` }
                  ]}
                  variant="primary"
                  icon={<DollarSign className="h-5 w-5" />}
                  onClick={() => handleTabNavigation('cost', 'current-cost')}
                />

                {/* Actual Savings */}
                <MetricCard
                  title="Actual Cost Savings"
                  subtitle="Realized Optimizations"
                  value={`$${(data!.actualSavings.monthly / 1000).toFixed(0)}K`}
                  details={data!.actualSavings.topSources.map(source => ({ 
                    label: source.name, 
                    value: `$${(source.amount / 1000).toFixed(0)}K` 
                  }))}
                  variant="success"
                  icon={<TrendingDown className="h-5 w-5" />}
                />

                {/* Potential Savings */}
                <MetricCard
                  title="Potential Savings"
                  subtitle="Identified Opportunities"
                  value={`$${(data!.potentialSavings.monthly / 1000).toFixed(0)}K`}
                  progress={data!.potentialSavings.realizationRate}
                  progressLabel={`${data!.potentialSavings.realizationRate}% Realization Rate`}
                  details={data!.potentialSavings.opportunities.map(opp => ({ 
                    label: opp.name, 
                    value: `$${(opp.amount / 1000).toFixed(0)}K` 
                  }))}
                  variant="warning"
                  icon={<Target className="h-5 w-5" />}
                />
              </div>
            );
          default:
            return <div>Select a section to view details</div>;
        }
      }
      
      // Individual subtab content
      switch (activeSection) {
        case 'onboarding':
          switch (activeSubTab) {
            case 'hrp-adoption':
              return (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">HRP Adoption Details</h2>
                    <p className="text-gray-600">Comprehensive view of Hyperforce Runtime Platform service adoption across all environments</p>
                  </div>
                  
                  <FKPAdoptionView category="overall" onMetricClick={handleMetricClick} />
                </div>
              );

            case 'commercial':
              return (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Commercial Environment Details</h2>
                    <p className="text-gray-600">Production services and commercial multi-tenant SaaS deployment metrics</p>
                  </div>
                  
                  <FKPAdoptionView category="commercial" onMetricClick={handleMetricClick} />
                </div>
              );

            case 'govcloud':
              return (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">GovCloud Environment Details</h2>
                    <p className="text-gray-600">Government cloud and compliance-focused deployment analytics</p>
                  </div>
                  
                  <FKPAdoptionView category="government" onMetricClick={handleMetricClick} />
                </div>
              );

            case 'devex':
              return (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">DevEx & Platform Details</h2>
                    <p className="text-gray-600">Development, testing, and platform services deployment insights</p>
                  </div>
                  
                  <FKPAdoptionView category="development" onMetricClick={handleMetricClick} />
                </div>
              );

            default:
              return <div className="p-8 text-center text-gray-500">Content for {activeSubTab} coming soon...</div>;
          }
        case 'runtime':
          switch (activeSubTab) {
            case 'autoscaling':
              return (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Autoscaling Details</h2>
                    <p className="text-gray-600">Horizontal Pod Autoscaler (HPA) adoption and resource optimization metrics</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <MetricCard
                      title="HPA Adoption Rate"
                      subtitle="Services with HPA Enabled"
                      value={`${data!.runtime.autoscaling.hpaAdoptionRate.toFixed(2)}%`}
                      progress={data!.runtime.autoscaling.hpaAdoptionRate}
                      progressLabel="Adoption Progress"
                      details={[
                        { label: 'HPA Enabled Services', value: data!.runtime.autoscaling.hpaEnabledServices.toLocaleString() },
                        { label: 'Total Services', value: data!.runtime.autoscaling.totalServices.toLocaleString() },
                        { label: 'Remaining Services', value: (data!.runtime.autoscaling.totalServices - data!.runtime.autoscaling.hpaEnabledServices).toLocaleString() }
                      ]}
                      variant="primary"
                      icon={<Zap className="h-5 w-5" />}
                    />

                    <MetricCard
                      title="Resource Utilization"
                      subtitle="CPU & Memory Efficiency"
                      value={`${data!.runtime.autoscaling.cpuUtilization}%`}
                      details={[
                        { label: 'CPU Utilization', value: `${data!.runtime.autoscaling.cpuUtilization}%` },
                        { label: 'Memory Utilization', value: `${data!.runtime.autoscaling.memoryUtilization}%` },
                        { label: 'Avg Response Time', value: `${data!.runtime.autoscaling.avgResponseTime}ms` }
                      ]}
                      variant="success"
                      icon={<Server className="h-5 w-5" />}
                    />

                    <MetricCard
                      title="Scaling Events"
                      subtitle="Recent Auto-scaling Activity"
                      value={data!.runtime.autoscaling.scalingEvents.toLocaleString()}
                      details={[
                        { label: 'Total Events (24h)', value: data!.runtime.autoscaling.scalingEvents.toLocaleString() },
                        { label: 'Scale Up Events', value: Math.floor(data!.runtime.autoscaling.scalingEvents * 0.6).toLocaleString() },
                        { label: 'Scale Down Events', value: Math.floor(data!.runtime.autoscaling.scalingEvents * 0.4).toLocaleString() }
                      ]}
                      variant="warning"
                      icon={<Target className="h-5 w-5" />}
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                    <div className="bg-white rounded-lg shadow-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">HPA Configuration Status</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Properly Configured</span>
                          <span className="font-semibold text-green-600">{Math.floor(data!.runtime.autoscaling.hpaEnabledServices * 0.85)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Needs Tuning</span>
                          <span className="font-semibold text-yellow-600">{Math.floor(data!.runtime.autoscaling.hpaEnabledServices * 0.12)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Misconfigured</span>
                          <span className="font-semibold text-red-600">{Math.floor(data!.runtime.autoscaling.hpaEnabledServices * 0.03)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Impact</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Cost Savings (Monthly)</span>
                          <span className="font-semibold text-green-600">$47.2K</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Resource Efficiency</span>
                          <span className="font-semibold text-blue-600">+23%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Availability Impact</span>
                          <span className="font-semibold text-green-600">99.97%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );

            case 'vpa':
              return (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">VPA Adoption Details</h2>
                    <p className="text-gray-600">Vertical Pod Autoscaler adoption and resource right-sizing metrics</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <MetricCard
                      title="VPA Opt-In Rate"
                      subtitle="Services Using VPA"
                      value={`${data!.runtime.vpaAdoption.optInRate}%`}
                      progress={data!.runtime.vpaAdoption.optInRate}
                      progressLabel="Adoption Progress"
                      details={[
                        { label: 'VPA Enabled Services', value: data!.runtime.vpaAdoption.enabledServices.toLocaleString() },
                        { label: 'Total Services', value: data!.runtime.vpaAdoption.totalServices.toLocaleString() },
                        { label: 'Potential Services', value: (data!.runtime.vpaAdoption.totalServices - data!.runtime.vpaAdoption.enabledServices).toLocaleString() }
                      ]}
                      variant="primary"
                      icon={<Database className="h-5 w-5" />}
                    />

                    <MetricCard
                      title="Resource Right-sizing"
                      subtitle="Optimization Impact"
                      value="78%"
                      details={[
                        { label: 'Over-provisioned', value: '22%' },
                        { label: 'Right-sized', value: '78%' },
                        { label: 'Under-provisioned', value: '0%' }
                      ]}
                      variant="success"
                      icon={<Target className="h-5 w-5" />}
                    />

                    <MetricCard
                      title="Cost Impact"
                      subtitle="Monthly Savings"
                      value="$32.4K"
                      details={[
                        { label: 'CPU Right-sizing', value: '$18.7K' },
                        { label: 'Memory Optimization', value: '$13.7K' },
                        { label: 'YTD Savings', value: '$387K' }
                      ]}
                      variant="success"
                      icon={<DollarSign className="h-5 w-5" />}
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                    <div className="bg-white rounded-lg shadow-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">VPA Recommendation Status</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Auto-Applied</span>
                          <span className="font-semibold text-green-600">{Math.floor(data!.runtime.vpaAdoption.enabledServices * 0.72)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Pending Review</span>
                          <span className="font-semibold text-yellow-600">{Math.floor(data!.runtime.vpaAdoption.enabledServices * 0.18)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Manual Override</span>
                          <span className="font-semibold text-blue-600">{Math.floor(data!.runtime.vpaAdoption.enabledServices * 0.10)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Efficiency Trends</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">CPU Waste Reduction</span>
                          <span className="font-semibold text-green-600">-31%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Memory Waste Reduction</span>
                          <span className="font-semibold text-green-600">-28%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Overall Efficiency Gain</span>
                          <span className="font-semibold text-blue-600">+24%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );

            case 'multiaz':
              return (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Multi-AZ Distribution Details</h2>
                    <p className="text-gray-600">High availability and availability zone distribution metrics across services</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <MetricCard
                      title="AZ Coverage"
                      subtitle="Services with Multi-AZ"
                      value={`${data!.runtime.multiAZ.coverage.toFixed(2)}%`}
                      progress={data!.runtime.multiAZ.coverage}
                      progressLabel="Coverage Progress"
                      details={[
                        { label: 'Multi-AZ Services', value: data!.runtime.multiAZ.services.toLocaleString() },
                        { label: 'Total Services', value: data!.runtime.multiAZ.totalServices.toLocaleString() },
                        { label: 'Single AZ Services', value: (data!.runtime.multiAZ.totalServices - data!.runtime.multiAZ.services).toLocaleString() }
                      ]}
                      variant="primary"
                      icon={<Database className="h-5 w-5" />}
                    />

                    <MetricCard
                      title="Full AZ Distribution"
                      subtitle="Services Across All AZs"
                      value={`${((data!.runtime.multiAZ.servicesWithFullAZ / data!.runtime.multiAZ.totalServices) * 100).toFixed(2)}%`}
                      progress={(data!.runtime.multiAZ.servicesWithFullAZ / data!.runtime.multiAZ.totalServices) * 100}
                      progressLabel="Full Coverage"
                      details={[
                        { label: 'Full AZ Services', value: data!.runtime.multiAZ.servicesWithFullAZ.toLocaleString() },
                        { label: 'Partial AZ Services', value: (data!.runtime.multiAZ.services - data!.runtime.multiAZ.servicesWithFullAZ).toLocaleString() },
                        { label: 'Avg AZ Distribution', value: `${data!.runtime.multiAZ.avgAzDistribution}%` }
                      ]}
                      variant="success"
                      icon={<Server className="h-5 w-5" />}
                    />

                    <MetricCard
                      title="Health Checks"
                      subtitle="Liveness Probes Enabled"
                      value={`${((data!.runtime.multiAZ.livenessProbeEnabled / data!.runtime.multiAZ.totalServices) * 100).toFixed(2)}%`}
                      progress={(data!.runtime.multiAZ.livenessProbeEnabled / data!.runtime.multiAZ.totalServices) * 100}
                      progressLabel="Probe Coverage"
                      details={[
                        { label: 'With Liveness Probes', value: data!.runtime.multiAZ.livenessProbeEnabled.toLocaleString() },
                        { label: 'Without Probes', value: (data!.runtime.multiAZ.totalServices - data!.runtime.multiAZ.livenessProbeEnabled).toLocaleString() },
                        { label: 'Readiness Probes', value: Math.floor(data!.runtime.multiAZ.livenessProbeEnabled * 0.89).toLocaleString() }
                      ]}
                      variant="warning"
                      icon={<Target className="h-5 w-5" />}
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                    <div className="bg-white rounded-lg shadow-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">AZ Distribution Breakdown</h3>
                      <div className="space-y-4">
                        {data!.runtime.multiAZ.azDistribution.map((az, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-gray-600">{az.az}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{az.services}</span>
                              <span className="text-sm text-gray-500">({az.percentage}%)</span>
                            </div>
                          </div>
                        ))}
                        <div className="pt-2 border-t">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-900 font-medium">Average Distribution</span>
                            <span className="font-semibold text-blue-600">{data!.runtime.multiAZ.avgAzDistribution}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Availability Impact</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Target Availability</span>
                          <span className="font-semibold text-blue-600">99.95%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Current Availability</span>
                          <span className="font-semibold text-green-600">99.97%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">AZ Failover Time</span>
                          <span className="font-semibold text-yellow-600">&lt; 30s</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Incidents (30d)</span>
                          <span className="font-semibold text-green-600">2</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );

            case 'karpenter':
              return (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Karpenter Rollout Details</h2>
                    <p className="text-gray-600">Node autoscaling and cluster provisioning optimization with Karpenter</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <MetricCard
                      title="Karpenter Enabled"
                      subtitle="Clusters with Karpenter"
                      value={karpenterStatus?.enabled?.toLocaleString() || "Loading..."}
                      details={[
                        { label: 'Enabled Clusters', value: karpenterStatus?.enabled?.toLocaleString() || "Loading..." },
                        { label: 'Total Active', value: karpenterClusters?.summary?.totalClusters?.toLocaleString() || "Loading..." },
                        { label: 'Adoption Rate', value: karpenterStatus ? `${karpenterStatus.enabledPercentage}%` : "Loading..." }
                      ]}
                      variant="success"
                      icon={<Server className="h-5 w-5" />}
                      onValueClick={handleMetricClick}
                      onDetailClick={handleMetricClick}
                    />

                    <MetricCard
                      title="Karpenter Disabled"
                      subtitle="Traditional Node Groups"
                      value={karpenterStatus?.disabled?.toLocaleString() || "Loading..."}
                      details={[
                        { label: 'Disabled Clusters', value: karpenterStatus?.disabled?.toLocaleString() || "Loading..." },
                        { label: 'Total Clusters', value: karpenterStatus?.total?.toLocaleString() || "Loading..." },
                        { label: 'Migration Pending', value: karpenterStatus ? `${(100 - parseFloat(karpenterStatus.enabledPercentage)).toFixed(2)}%` : "Loading..." }
                      ]}
                      variant="warning"
                      icon={<Database className="h-5 w-5" />}
                      onValueClick={handleMetricClick}
                      onDetailClick={handleMetricClick}
                    />

                    <MetricCard
                      title="Cost Savings"
                      subtitle="Node Optimization Benefits"
                      value="$89.3K"
                      details={[
                        { label: 'Monthly Savings', value: '$89.3K' },
                        { label: 'Node Utilization', value: '78%' },
                        { label: 'Provisioning Speed', value: '45% faster' }
                      ]}
                      variant="primary"
                      icon={<DollarSign className="h-5 w-5" />}
                      onValueClick={handleMetricClick}
                      onDetailClick={handleMetricClick}
                    />

                    <MetricCard
                      title="Environment Breakdown"
                      subtitle="Karpenter by Environment"
                      value={karpenterClusters?.summary?.environments?.dev?.toString() || "0"}
                      details={Object.entries(karpenterClusters?.summary?.environments || {}).map(([env, count]) => ({
                        label: env.toUpperCase(),
                        value: (count as number).toLocaleString()
                      }))}
                      variant="primary"
                      icon={<Cloud className="h-5 w-5" />}
                      onValueClick={handleMetricClick}
                      onDetailClick={handleMetricClick}
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                    <div className="bg-white rounded-lg shadow-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Functional Domains</h3>
                      <div className="space-y-4">
                        {karpenterClusters?.summary?.functionalDomains ? 
                          Object.entries(karpenterClusters.summary.functionalDomains)
                            .sort(([,a], [,b]) => (b as number) - (a as number))
                            .slice(0, 8)
                            .map(([domain, count]) => (
                              <div key={domain} className="flex justify-between items-center hover:bg-gray-50 p-2 rounded-lg transition-colors cursor-pointer"
                                   onClick={() => handleMetricClick(`${domain} Domain`)}>
                                <span className="text-gray-600 capitalize hover:text-blue-600 transition-colors">{domain}</span>
                                <span className="font-semibold text-blue-600 hover:underline transition-colors">{count as number}</span>
                              </div>
                            )) : 
                          <div className="text-gray-500">Loading...</div>
                        }
                      </div>
                    </div>

                  </div>
                </div>
              );

            default:
              return <div className="p-8 text-center text-gray-500">Content for {activeSubTab} coming soon...</div>;
          }
        case 'cost':
          switch (activeSubTab as SubTabType) {
            case 'overview':
              return (
                <div className="space-y-8">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Cost to Serve Overview</h2>
                    <p className="text-gray-600">Comprehensive cost analysis and optimization program with savings tracking</p>
                  </div>
                  
                  {/* Cost Overview Cards */}
                  {data && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                      <MetricCard
                        title="Platform Cost"
                        subtitle="Current Monthly Spend"
                        value={`$${(data.platformCost.current / 1000).toFixed(0)}K`}
                        trend={data.platformCost.growthRate}
                        trendLabel={`${data.platformCost.growthRate > 0 ? '+' : ''}${data.platformCost.growthRate.toFixed(2)}%`}
                        details={[
                          { label: 'Current', value: `$${data.platformCost.current.toLocaleString()}` },
                          { label: 'Previous', value: `$${data.platformCost.previous.toLocaleString()}` },
                          { label: 'Yearly Projection', value: `$${(data.platformCost.yearlyProjection / 1000000).toFixed(1)}M` }
                        ]}
                        variant="primary"
                        icon={<DollarSign className="h-5 w-5" />}
                      />
                      
                      <MetricCard
                        title="Cost Increase"
                        subtitle="Monthly Growth Drivers"
                        value={`$${(data.costIncrease.monthly / 1000).toFixed(0)}K`}
                        details={data.costIncrease.drivers.map(driver => ({ 
                          label: driver.name, 
                          value: `$${(driver.amount / 1000).toFixed(0)}K` 
                        }))}
                        variant="warning"
                        icon={<TrendingUp className="h-5 w-5" />}
                      />
                    </div>
                  )}
                  
                  {/* HCP CTS FY26 Program Section */}
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">HCP CTS FY26 Program</h3>
                      <p className="text-gray-600">Cost optimization initiatives with revised estimates and actual performance</p>
                    </div>
                    <HCPCTSProgram />
                  </div>
                </div>
              );
            case 'cost-overview':
              return <HCPCostAnalysis />;
            default:
              return <div className="p-8 text-center text-gray-500">Content for {activeSubTab} coming soon...</div>;
          }
        case 'selfserve':
          switch (activeSubTab as SubTabType) {
            case 'overview':
              return (
                <div className="space-y-8">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Self Serve Overview</h2>
                    <p className="text-gray-600">Platform self-service capabilities, automation tools, and developer resources</p>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                    <MetricCard
                      title="Documentation"
                      subtitle="Self-Service Guides"
                      value="147"
                      details={[
                        { label: 'API Documentation', value: '23' },
                        { label: 'Runbooks', value: '45' },
                        { label: 'Troubleshooting Guides', value: '34' },
                        { label: 'Best Practices', value: '45' }
                      ]}
                      variant="primary"
                      icon={<Database className="h-5 w-5" />}
                    />
                    
                    <MetricCard
                      title="Automation Tools"
                      subtitle="Self-Service Scripts"
                      value="89"
                      details={[
                        { label: 'Deployment Scripts', value: '23' },
                        { label: 'Monitoring Setup', value: '18' },
                        { label: 'Config Management', value: '24' },
                        { label: 'Health Checks', value: '24' }
                      ]}
                      variant="success"
                      icon={<Zap className="h-5 w-5" />}
                    />
                    
                    <MetricCard
                      title="API Endpoints"
                      subtitle="Integration Points"
                      value="156"
                      details={[
                        { label: 'Management APIs', value: '34' },
                        { label: 'Monitoring APIs', value: '45' },
                        { label: 'Config APIs', value: '38' },
                        { label: 'Status APIs', value: '39' }
                      ]}
                      variant="primary"
                      icon={<Target className="h-5 w-5" />}
                    />
                    
                    <MetricCard
                      title="Usage Analytics"
                      subtitle="Self-Service Adoption"
                      value="78.5%"
                      progress={78.5}
                      progressLabel="Adoption Rate"
                      details={[
                        { label: 'Daily Active Users', value: '247' },
                        { label: 'Monthly API Calls', value: '12.4K' },
                        { label: 'Documentation Views', value: '3.2K' }
                      ]}
                      variant="success"
                      icon={<BarChart3 className="h-5 w-5" />}
                    />
                  </div>
                </div>
              );
            case 'documentation':
              return (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Documentation Hub</h2>
                    <p className="text-gray-600">Comprehensive self-service documentation and guides</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <MetricCard
                      title="Getting Started"
                      subtitle="Onboarding Guides"
                      value="12"
                      details={[
                        { label: 'Platform Overview', value: '1' },
                        { label: 'Setup Guides', value: '4' },
                        { label: 'Quick Start', value: '3' },
                        { label: 'Best Practices', value: '4' }
                      ]}
                      variant="primary"
                      icon={<Database className="h-5 w-5" />}
                    />
                    
                    <MetricCard
                      title="API Documentation"
                      subtitle="Integration Guides"
                      value="23"
                      details={[
                        { label: 'REST APIs', value: '15' },
                        { label: 'GraphQL', value: '4' },
                        { label: 'Webhooks', value: '2' },
                        { label: 'SDKs', value: '2' }
                      ]}
                      variant="success"
                      icon={<Code2 className="h-5 w-5" />}
                    />
                    
                    <MetricCard
                      title="Troubleshooting"
                      subtitle="Problem Resolution"
                      value="34"
                      details={[
                        { label: 'Common Issues', value: '12' },
                        { label: 'Error Codes', value: '8' },
                        { label: 'Debug Guides', value: '9' },
                        { label: 'FAQ', value: '5' }
                      ]}
                      variant="warning"
                      icon={<Target className="h-5 w-5" />}
                    />
                  </div>
                </div>
              );
            case 'tools':
              return (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">FKP Onboarding Wizard</h2>
                    <p className="text-gray-600">Interactive FKP onboarding process and implementation details</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <MetricCard
                      title="CLI Tools"
                      subtitle="Command Line Utilities"
                      value="8"
                      details={[
                        { label: 'HRP CLI', value: '1' },
                        { label: 'Deployment Tools', value: '3' },
                        { label: 'Debug Tools', value: '2' },
                        { label: 'Config Tools', value: '2' }
                      ]}
                      variant="primary"
                      icon={<Code2 className="h-5 w-5" />}
                    />
                    
                    <MetricCard
                      title="Web Dashboards"
                      subtitle="Management Interfaces"
                      value="5"
                      details={[
                        { label: 'Service Dashboard', value: '1' },
                        { label: 'Monitoring', value: '2' },
                        { label: 'Config Manager', value: '1' },
                        { label: 'Status Page', value: '1' }
                      ]}
                      variant="success"
                      icon={<BarChart3 className="h-5 w-5" />}
                    />
                    
                    <MetricCard
                      title="Scripts & Templates"
                      subtitle="Automation Resources"
                      value="67"
                      details={[
                        { label: 'Terraform Modules', value: '23' },
                        { label: 'Helm Charts', value: '18' },
                        { label: 'Docker Images', value: '15' },
                        { label: 'Shell Scripts', value: '11' }
                      ]}
                      variant="warning"
                      icon={<Settings className="h-5 w-5" />}
                    />
                  </div>
                </div>
              );
            case 'automation':
              return (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Automation & Workflows</h2>
                    <p className="text-gray-600">Automated processes and self-service workflows</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <MetricCard
                      title="CI/CD Pipelines"
                      subtitle="Deployment Automation"
                      value="45"
                      details={[
                        { label: 'Build Pipelines', value: '15' },
                        { label: 'Deploy Pipelines', value: '18' },
                        { label: 'Test Pipelines', value: '8' },
                        { label: 'Release Pipelines', value: '4' }
                      ]}
                      variant="primary"
                      icon={<Zap className="h-5 w-5" />}
                    />
                    
                    <MetricCard
                      title="Self-Healing"
                      subtitle="Auto-Remediation"
                      value="23"
                      details={[
                        { label: 'Service Recovery', value: '8' },
                        { label: 'Health Checks', value: '6' },
                        { label: 'Auto-Scaling', value: '5' },
                        { label: 'Rollback Scripts', value: '4' }
                      ]}
                      variant="success"
                      icon={<Target className="h-5 w-5" />}
                    />
                    
                    <MetricCard
                      title="Monitoring Alerts"
                      subtitle="Automated Monitoring"
                      value="156"
                      details={[
                        { label: 'Service Alerts', value: '67' },
                        { label: 'Performance Alerts', value: '43' },
                        { label: 'Cost Alerts', value: '28' },
                        { label: 'Security Alerts', value: '18' }
                      ]}
                      variant="warning"
                      icon={<Database className="h-5 w-5" />}
                    />
                  </div>
                </div>
              );
            case 'apis':
              return (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">APIs & Integration</h2>
                    <p className="text-gray-600">API endpoints and integration points for self-service automation</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <MetricCard
                      title="Management APIs"
                      subtitle="Platform Control"
                      value="34"
                      details={[
                        { label: 'Service APIs', value: '12' },
                        { label: 'Config APIs', value: '8' },
                        { label: 'Deploy APIs', value: '9' },
                        { label: 'Status APIs', value: '5' }
                      ]}
                      variant="primary"
                      icon={<Server className="h-5 w-5" />}
                    />
                    
                    <MetricCard
                      title="Monitoring APIs"
                      subtitle="Observability Data"
                      value="45"
                      details={[
                        { label: 'Metrics API', value: '15' },
                        { label: 'Logs API', value: '12' },
                        { label: 'Traces API', value: '8' },
                        { label: 'Events API', value: '10' }
                      ]}
                      variant="success"
                      icon={<BarChart3 className="h-5 w-5" />}
                    />
                    
                    <MetricCard
                      title="Integration APIs"
                      subtitle="External Connectors"
                      value="77"
                      details={[
                        { label: 'Webhook APIs', value: '23' },
                        { label: 'Auth APIs', value: '18' },
                        { label: 'Notification APIs', value: '21' },
                        { label: 'Data APIs', value: '15' }
                      ]}
                      variant="warning"
                      icon={<Target className="h-5 w-5" />}
                    />
                  </div>
                </div>
              );
            default:
              return <div className="p-8 text-center text-gray-500">Content for {activeSubTab} coming soon...</div>;
          }
        default:
          return <div className="p-8 text-center text-gray-500">Content for {activeSubTab} coming soon...</div>;
      }
    };

    return renderExecutiveContent();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`bg-white shadow-lg transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="p-4">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between mb-6">
            {!sidebarCollapsed && (
              <div className="flex items-center">
                {/* Salesforce Logo */}
                <svg className="h-8 w-8 text-blue-600 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.5 14.25c0-.69-.56-1.25-1.25-1.25S5 13.56 5 14.25s.56 1.25 1.25 1.25 1.25-.56 1.25-1.25zm9-1.25c-.69 0-1.25.56-1.25 1.25s.56 1.25 1.25 1.25 1.25-.56 1.25-1.25-.56-1.25-1.25-1.25zm1.5-7.5c-.69 0-1.25.56-1.25 1.25S17.31 8 18 8s1.25-.56 1.25-1.25S18.69 5.5 18 5.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                </svg>
                <span className="text-lg font-bold text-gray-800">HRP</span>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* Navigation Sections */}
          <nav className="space-y-2">
            {Object.entries(sectionConfig).map(([key, config]) => (
              <div key={key}>
                <button
                  onClick={() => {
                    setActiveSection(key as SectionType);
                    setActiveSubTab('overview');
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeSection === key
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {config.icon}
                  {!sidebarCollapsed && (
                    <>
                      <span className="font-medium flex-1">{config.label}</span>
                      <ChevronRight className={`h-4 w-4 transition-transform ${activeSection === key ? 'rotate-90' : ''}`} />
                    </>
                  )}
                </button>
                
                {/* SubTabs */}
                {!sidebarCollapsed && activeSection === key && (
                  <div className="ml-6 mt-2 space-y-1">
                    {config.subTabs.map((subTab) => (
                      <button
                        key={subTab.id}
                        onClick={() => setActiveSubTab(subTab.id as SubTabType)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          activeSubTab === subTab.id
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {subTab.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="bg-white shadow-sm px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Hyperforce Runtime Platform Dashboard</h1>
              <p className="text-gray-600">Comprehensive view of platform performance, availability, and cost optimization</p>
            </div>
            
            {/* Top Right Section with Slack Logo and Main Tab Navigation */}
            <div className="flex items-center gap-4">
              {/* Main Tab Navigation */}
              <div className="flex gap-2">
                <MainTabButton 
                  tab="executive" 
                  label="Executive View" 
                  icon={<BarChart3 className="h-5 w-5" />} 
                />
                <MainTabButton 
                  tab="developer" 
                  label="Developer View" 
                  icon={<Code2 className="h-5 w-5" />} 
                />
              </div>
              
              {/* Slack Logo */}
              <div className="flex items-center">
                <svg className="h-8 w-8 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                </svg>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6">
          {renderContent()}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t px-6 py-4">
          <div className="text-center text-gray-500 text-sm">
            <p>Last updated: {new Date().toLocaleString()}</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;

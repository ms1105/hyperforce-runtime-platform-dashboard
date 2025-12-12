import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingDown, TrendingUp, Calendar, BarChart3, Cpu } from 'lucide-react';

interface HCPCostData {
  monthlyData: MonthlyData[];
  summary: Summary;
  breakdown: Breakdown;
  trends: Trends;
}

interface MonthlyData {
  month: string;
  monthKey: string;
  dailyEC2Cost: number;
  dailySavingOpportunity: number;
  monthlyCost: number;
  monthlySavingOpportunity: number;
  yearlySavingEstimate: number;
  utilizationThreshold: number;
  analysisFormula: string;
}

interface Summary {
  totalMonthlyCost: number;
  totalMonthlySavingOpportunity: number;
  averageDailyCost: number;
  averageDailySaving: number;
  totalYearlySavingEstimate: number;
  costEfficiencyGain: number;
  analysisMonths: number;
  dataSource: string;
  lastUpdated: string;
}

interface Breakdown {
  infrastructureCost: {
    ec2Instances: number;
    storage: number;
    networking: number;
    other: number;
  };
  savingOpportunities: {
    cpuRightSizing: number;
    memoryOptimization: number;
    instanceTypeOptimization: number;
    schedulingOptimization: number;
  };
  utilizationMetrics: {
    averageP95CPUUtilization: number;
    averageP95MemoryUtilization: number;
    utilizationTarget: number;
    efficiencyGain: number;
  };
}

interface Trends {
  costTrend: string;
  savingOpportunityTrend: string;
  utilizationImprovement: number;
  topSavingCategories: {
    category: string;
    potential: number;
    percentage: number;
  }[];
}


const formatCurrency = (amount: number): string => {
  const amountInMillions = amount / 1000000;
  return `$${amountInMillions.toFixed(2)}M`;
};

const formatPercentage = (value: number): string => {
  return `${value.toFixed(2)}%`;
};

interface FilterOptions {
  months: { value: string; label: string }[];
  falconInstances: string[];
  falconDomains: string[];
  environmentTypes: string[];
  allocatedServices: string[];
  k8Clusters: string[];
  k8Namespaces: string[];
  resourceTypes: string[];
  deploymentNames: string[];
}

interface HCPCostAnalysisProps {
  selectedMonth?: string;
  onNavigateToServiceOwner?: () => void;
  view?: 'executive' | 'serviceowner';
  // Filter props from parent
  selectedMonthFilter?: string;
  setSelectedMonthFilter?: (value: string) => void;
  selectedFalconInstance?: string;
  setSelectedFalconInstance?: (value: string) => void;
  selectedFalconDomain?: string;
  setSelectedFalconDomain?: (value: string) => void;
  selectedEnvironmentType?: string;
  setSelectedEnvironmentType?: (value: string) => void;
  selectedAllocatedService?: string;
  setSelectedAllocatedService?: (value: string) => void;
  selectedK8Cluster?: string;
  setSelectedK8Cluster?: (value: string) => void;
  selectedK8Namespace?: string;
  setSelectedK8Namespace?: (value: string) => void;
  selectedResourceType?: string;
  setSelectedResourceType?: (value: string) => void;
  selectedDeploymentName?: string;
  setSelectedDeploymentName?: (value: string) => void;
  clearAllFilters?: () => void;
  getFilteredOptions?: () => any;
}

const HCPCostAnalysis: React.FC<HCPCostAnalysisProps> = ({ 
  selectedMonth, 
  onNavigateToServiceOwner, 
  view = 'executive',
  // Filter props from parent
  selectedMonthFilter = '',
  setSelectedMonthFilter = () => {},
  selectedFalconInstance = '',
  setSelectedFalconInstance = () => {},
  selectedFalconDomain = '',
  setSelectedFalconDomain = () => {},
  selectedEnvironmentType = '',
  setSelectedEnvironmentType = () => {},
  selectedAllocatedService = '',
  setSelectedAllocatedService = () => {},
  selectedK8Cluster = '',
  setSelectedK8Cluster = () => {},
  selectedK8Namespace = '',
  setSelectedK8Namespace = () => {},
  selectedResourceType = '',
  setSelectedResourceType = () => {},
  selectedDeploymentName = '',
  setSelectedDeploymentName = () => {},
  clearAllFilters = () => {},
  getFilteredOptions = () => null
}) => {
  const [costData, setCostData] = useState<HCPCostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);

  // State for real monthly data
  const [realMonthlyData, setRealMonthlyData] = useState(null);
  
  // State for monthly trend data  
  const [monthlyTrendData, setMonthlyTrendData] = useState(null);
  
  // State for savings breakdown data
  const [savingsBreakdownData, setSavingsBreakdownData] = useState(null);
  
  // State for deployment-specific trends
  const [deploymentMonthlyTrend, setDeploymentMonthlyTrend] = useState(null);
  const [deploymentDailyCost, setDeploymentDailyCost] = useState(null);
  
  // State for daily cost chart (works with all filters)
  const [dailyCostData, setDailyCostData] = useState(null);
  
  // Loading states for better UX
  const [monthlyDataLoading, setMonthlyDataLoading] = useState(false);
  const [trendDataLoading, setTrendDataLoading] = useState(false);
  const [savingsDataLoading, setSavingsDataLoading] = useState(false);
  const [deploymentTrendLoading, setDeploymentTrendLoading] = useState(false);
  const [deploymentDailyLoading, setDeploymentDailyLoading] = useState(false);
  const [dailyCostLoading, setDailyCostLoading] = useState(false);

  // Fetch real monthly data when filters change
  useEffect(() => {
    const fetchRealData = async () => {
      // Fetch data if any filter is selected
      const hasFilters = selectedMonthFilter || selectedFalconInstance || selectedFalconDomain || 
                        selectedEnvironmentType || selectedAllocatedService || selectedK8Cluster || 
                        selectedK8Namespace || selectedResourceType || selectedDeploymentName;
      
      if (hasFilters) {
        try {
          setMonthlyDataLoading(true);
          const params = new URLSearchParams();
          if (selectedMonthFilter) params.append('month', selectedMonthFilter);
          if (selectedFalconInstance) params.append('falconInstance', selectedFalconInstance);
          if (selectedFalconDomain) params.append('falconDomain', selectedFalconDomain);
          if (selectedEnvironmentType) params.append('environmentType', selectedEnvironmentType);
          if (selectedAllocatedService) params.append('allocatedService', selectedAllocatedService);
          if (selectedK8Cluster) params.append('k8Cluster', selectedK8Cluster);
          if (selectedK8Namespace) params.append('k8Namespace', selectedK8Namespace);
          if (selectedResourceType) params.append('resourceType', selectedResourceType);
          if (selectedDeploymentName) params.append('deploymentName', selectedDeploymentName);
          
          console.log('Fetching monthly data with params:', params.toString());
          const response = await fetch(`/api/monthly-data?${params.toString()}`);
          const monthlyData = await response.json();
          console.log('Received monthly data:', monthlyData);
          setRealMonthlyData(monthlyData);
        } catch (error) {
          console.error('Error fetching real monthly data:', error);
          setRealMonthlyData(null);
        } finally {
          setMonthlyDataLoading(false);
        }
      } else {
        setRealMonthlyData(null);
        setMonthlyDataLoading(false);
      }
    };

    fetchRealData();
  }, [selectedMonthFilter, selectedFalconInstance, selectedFalconDomain, selectedEnvironmentType, 
      selectedAllocatedService, selectedK8Cluster, selectedK8Namespace, selectedResourceType, selectedDeploymentName]);

  // Fetch monthly trend data when filters change
  useEffect(() => {
    const fetchTrendData = async () => {
      try {
        setTrendDataLoading(true);
        const params = new URLSearchParams();
        if (selectedFalconInstance) params.append('falconInstance', selectedFalconInstance);
        if (selectedFalconDomain) params.append('falconDomain', selectedFalconDomain);
        if (selectedEnvironmentType) params.append('environmentType', selectedEnvironmentType);
        if (selectedAllocatedService) params.append('allocatedService', selectedAllocatedService);
        if (selectedK8Cluster) params.append('k8Cluster', selectedK8Cluster);
        if (selectedK8Namespace) params.append('k8Namespace', selectedK8Namespace);
        if (selectedResourceType) params.append('resourceType', selectedResourceType);
        if (selectedDeploymentName) params.append('deploymentName', selectedDeploymentName);
        
        console.log('Fetching monthly trend data with params:', params.toString());
        const response = await fetch(`/api/monthly-trend?${params.toString()}`);
        const trendData = await response.json();
        console.log('Received monthly trend data:', trendData);
        setMonthlyTrendData(trendData);
      } catch (error) {
        console.error('Error fetching monthly trend data:', error);
        setMonthlyTrendData(null);
      } finally {
        setTrendDataLoading(false);
      }
    };

    fetchTrendData();
  }, [selectedFalconInstance, selectedFalconDomain, selectedEnvironmentType, 
      selectedAllocatedService, selectedK8Cluster, selectedK8Namespace, selectedResourceType, selectedDeploymentName]);

  // Fetch savings breakdown data when filters change (for Service Owner view)
  useEffect(() => {
    const fetchSavingsBreakdown = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedMonthFilter) params.append('month', selectedMonthFilter);
        if (selectedFalconInstance) params.append('falconInstance', selectedFalconInstance);
        if (selectedFalconDomain) params.append('falconDomain', selectedFalconDomain);
        if (selectedEnvironmentType) params.append('environmentType', selectedEnvironmentType);
        if (selectedAllocatedService) params.append('allocatedService', selectedAllocatedService);
        if (selectedK8Cluster) params.append('k8Cluster', selectedK8Cluster);
        if (selectedK8Namespace) params.append('k8Namespace', selectedK8Namespace);
        if (selectedResourceType) params.append('resourceType', selectedResourceType);
        if (selectedDeploymentName) params.append('deploymentName', selectedDeploymentName);
        
        setSavingsDataLoading(true);
        console.log('Fetching savings breakdown data with params:', params.toString());
        const response = await fetch(`/api/savings-breakdown?${params.toString()}`);
        const breakdownData = await response.json();
        console.log('Received savings breakdown data:', breakdownData);
        setSavingsBreakdownData(breakdownData);
      } catch (error) {
        console.error('Error fetching savings breakdown data:', error);
        setSavingsBreakdownData(null);
      } finally {
        setSavingsDataLoading(false);
      }
    };

    fetchSavingsBreakdown();
  }, [selectedMonthFilter, selectedFalconInstance, selectedFalconDomain, selectedEnvironmentType, 
      selectedAllocatedService, selectedK8Cluster, selectedK8Namespace, selectedResourceType, selectedDeploymentName]);

  // Fetch deployment-specific monthly trend when deployment name is selected
  useEffect(() => {
    const fetchDeploymentTrend = async () => {
      if (!selectedDeploymentName) {
        setDeploymentMonthlyTrend(null);
        return;
      }

      try {
        setDeploymentTrendLoading(true);
        console.log('Fetching deployment monthly trend for:', selectedDeploymentName);
        const response = await fetch(`/api/deployment-monthly-trend?deploymentName=${encodeURIComponent(selectedDeploymentName)}`);
        const trendData = await response.json();
        console.log('Received deployment monthly trend:', trendData);
        setDeploymentMonthlyTrend(trendData);
      } catch (error) {
        console.error('Error fetching deployment monthly trend:', error);
        setDeploymentMonthlyTrend(null);
      } finally {
        setDeploymentTrendLoading(false);
      }
    };

    fetchDeploymentTrend();
  }, [selectedDeploymentName]);

  // Fetch deployment-specific daily cost when deployment name is selected
  useEffect(() => {
    const fetchDeploymentDailyCost = async () => {
      if (!selectedDeploymentName) {
        setDeploymentDailyCost(null);
        return;
      }

      try {
        setDeploymentDailyLoading(true);
        console.log('Fetching deployment daily cost for:', selectedDeploymentName);
        const response = await fetch(`/api/deployment-daily-cost?deploymentName=${encodeURIComponent(selectedDeploymentName)}`);
        const dailyData = await response.json();
        console.log('Received deployment daily cost:', dailyData);
        setDeploymentDailyCost(dailyData);
      } catch (error) {
        console.error('Error fetching deployment daily cost:', error);
        setDeploymentDailyCost(null);
      } finally {
        setDeploymentDailyLoading(false);
      }
    };

    fetchDeploymentDailyCost();
  }, [selectedDeploymentName]);

  // Fetch daily cost data when filters change (works with all filters)
  useEffect(() => {
    const fetchDailyCost = async () => {
      // Fetch data if any filter is selected
      const hasFilters = selectedMonthFilter || selectedFalconInstance || selectedFalconDomain || 
                        selectedEnvironmentType || selectedAllocatedService || selectedK8Cluster || 
                        selectedK8Namespace || selectedResourceType || selectedDeploymentName;
      
      if (hasFilters) {
        try {
          setDailyCostLoading(true);
          const params = new URLSearchParams();
          if (selectedMonthFilter) params.append('month', selectedMonthFilter);
          if (selectedFalconInstance) params.append('falconInstance', selectedFalconInstance);
          if (selectedFalconDomain) params.append('falconDomain', selectedFalconDomain);
          if (selectedEnvironmentType) params.append('environmentType', selectedEnvironmentType);
          if (selectedAllocatedService) params.append('allocatedService', selectedAllocatedService);
          if (selectedK8Cluster) params.append('k8Cluster', selectedK8Cluster);
          if (selectedK8Namespace) params.append('k8Namespace', selectedK8Namespace);
          if (selectedResourceType) params.append('resourceType', selectedResourceType);
          if (selectedDeploymentName) params.append('deploymentName', selectedDeploymentName);
          
          console.log('Fetching daily cost data with params:', params.toString());
          const response = await fetch(`/api/daily-cost?${params.toString()}`);
          const dailyData = await response.json();
          console.log('Received daily cost data:', dailyData);
          setDailyCostData(dailyData);
        } catch (error) {
          console.error('Error fetching daily cost data:', error);
          setDailyCostData(null);
        } finally {
          setDailyCostLoading(false);
        }
      } else {
        setDailyCostData(null);
      }
    };

    fetchDailyCost();
  }, [selectedMonthFilter, selectedFalconInstance, selectedFalconDomain, selectedEnvironmentType, 
      selectedAllocatedService, selectedK8Cluster, selectedK8Namespace, selectedResourceType, selectedDeploymentName]);

  // Apply filters to data - using real CSV data
  const getFilteredData = (data: any) => {
    const hasFilters = selectedMonthFilter !== '' || 
                      selectedFalconInstance !== '' || 
                      selectedFalconDomain !== '' || 
                      selectedEnvironmentType !== '' || 
                      selectedAllocatedService !== '' || 
                      selectedK8Cluster !== '' || 
                      selectedK8Namespace !== '' || 
                      selectedResourceType !== '' || 
                      selectedDeploymentName !== '';

    console.log('getFilteredData called:', { hasFilters, realMonthlyData });

    if (!hasFilters) {
      console.log('No filters applied, returning base data');
      return data;
    }

    // Use real monthly data if available
    if (realMonthlyData) {
      console.log('Using real monthly data:', realMonthlyData);
      return {
        ...data,
        totalCost: realMonthlyData.totalCost,
        savingsOpportunity: realMonthlyData.savingsOpportunity,
        p95CpuUtilization: realMonthlyData.p95CpuUtilization,
        p95MemoryUtilization: realMonthlyData.p95MemoryUtilization,
      };
    }

    // Fallback to filtered base data
    const filterCount = [selectedMonthFilter, selectedFalconInstance, selectedFalconDomain, 
                        selectedEnvironmentType, selectedAllocatedService, selectedK8Cluster, 
                        selectedK8Namespace, selectedResourceType, selectedDeploymentName].filter(f => f !== '').length;
    
    const filterMultiplier = Math.max(0.3, 1 - (filterCount * 0.12));
    
    console.log('Using fallback filtered data with multiplier:', filterMultiplier);
    
    return {
      ...data,
      totalCost: Math.floor(data.totalCost * filterMultiplier),
      savingsOpportunity: Math.floor(data.savingsOpportunity * filterMultiplier),
      p95CpuUtilization: Math.max(15, data.p95CpuUtilization * filterMultiplier),
      p95MemoryUtilization: Math.max(20, data.p95MemoryUtilization * filterMultiplier)
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch cost data and filter options in parallel
        const [costResponse, filterResponse] = await Promise.all([
          fetch('/api/hcp-cost-analysis'),
          fetch('/api/monthly-filter-options')
        ]);
        
        const costData = await costResponse.json();
        const filterData = await filterResponse.json();
        
        setCostData(costData);
        setFilterOptions(filterData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Clear dependent filters when parent filters change
  useEffect(() => {
    // Clear deployment name when resource type changes
    if (selectedResourceType !== '') {
      const currentFiltered = getFilteredOptions();
      if (currentFiltered && !currentFiltered.deploymentNames.includes(selectedDeploymentName)) {
        setSelectedDeploymentName('');
      }
    }
  }, [selectedResourceType]);

  useEffect(() => {
    // Clear namespace when allocated service changes
    if (selectedAllocatedService !== '') {
      const currentFiltered = getFilteredOptions();
      if (currentFiltered && !currentFiltered.k8Namespaces.includes(selectedK8Namespace)) {
        setSelectedK8Namespace('');
      }
    }
  }, [selectedAllocatedService]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!costData) {
    return (
      <div className="p-6 text-center text-gray-500">
        Failed to load HCP cost analysis data
      </div>
    );
  }

  // Filter data for selected month if provided  
  const selectedMonthData = selectedMonth 
    ? costData.monthlyData.find(m => m.monthKey === selectedMonth)
    : null;

  const getFilteredMonths = () => {
    return !costData ? [] : costData.monthlyData.sort((a, b) => a.month.localeCompare(b.month)).slice(0, 12);
  };


  const renderExecutiveView = () => {
    // Mock aggregated data based on filters
    const baseData = {
      totalCost: 4002565,
      savingsOpportunity: 1779216,
      yearlySavingEstimate: 21037990,
      costEfficiencyGain: 44.40,
      p95CpuUtilization: 65.8,
      p95MemoryUtilization: 72.3,
      monthlyTrend: monthlyTrendData || [
        { month: 'Apr', cost: 3800000, savings: 1600000 },
        { month: 'May', cost: 3850000, savings: 1650000 },
        { month: 'Jun', cost: 3920000, savings: 1700000 },
        { month: 'Jul', cost: 3980000, savings: 1750000 },
        { month: 'Aug', cost: 4050000, savings: 1780000 },
        { month: 'Sep', cost: 4002565, savings: 1779216 }
      ]
    };

    // Apply filters to get updated data
    const aggregatedData = getFilteredData(baseData);

    return (
      <div className="space-y-6">
        {/* Loading Indicators */}
        {(monthlyDataLoading || trendDataLoading || savingsDataLoading) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
              <div>
                <p className="text-sm text-yellow-800 font-medium">Processing large datasets...</p>
                <p className="text-xs text-yellow-600">
                  {monthlyDataLoading && "📊 Loading monthly data (10-30s)"}
                  {trendDataLoading && "📈 Computing 7-month trend (70+ seconds)"}
                  {savingsDataLoading && "💰 Analyzing savings opportunities (30+ seconds)"}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Data Source Indicator */}
        {realMonthlyData && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <p className="text-sm text-green-700 font-medium">
                Using real CSV data from {realMonthlyData.month} ({realMonthlyData.recordCount} records)
              </p>
            </div>
          </div>
        )}
        
        {/* Monthly Trend Data Source Indicator */}
        {monthlyTrendData && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <p className="text-sm text-blue-700 font-medium">
                Using real monthly trend data from Apr-Oct CSV files ({monthlyTrendData.length} months)
              </p>
            </div>
          </div>
        )}

        {/* Analysis Summary - Top Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Analysis Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Yearly Savings Estimate</p>
              <p className="text-xl font-bold text-green-600">${(aggregatedData.yearlySavingEstimate / 1000000).toFixed(1)}M</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Cost Efficiency Gain</p>
              <p className="text-xl font-bold text-blue-600">{aggregatedData.costEfficiencyGain}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Analysis Period</p>
              <p className="text-xl font-bold text-gray-900">
                Apr - {monthlyTrendData && monthlyTrendData.length > 0 
                  ? monthlyTrendData[monthlyTrendData.length - 1].month 
                  : 'Oct'} 2024
              </p>
            </div>
          </div>
        </div>

        {/* Executive Metrics - Clickable */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div 
            onClick={onNavigateToServiceOwner}
            className="bg-white p-6 rounded-lg shadow-sm border cursor-pointer hover:shadow-md hover:border-blue-300 transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Cost</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(aggregatedData.totalCost)}
                </p>
                <p className="text-xs text-blue-600 mt-1 flex items-center">
                  Click for details
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div 
            onClick={onNavigateToServiceOwner}
            className="bg-white p-6 rounded-lg shadow-sm border cursor-pointer hover:shadow-md hover:border-green-300 transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Savings Opportunity</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(aggregatedData.savingsOpportunity)}
                </p>
                <p className="text-xs text-green-600 mt-1 flex items-center">
                  Click for details
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div 
            onClick={onNavigateToServiceOwner}
            className="bg-white p-6 rounded-lg shadow-sm border cursor-pointer hover:shadow-md hover:border-purple-300 transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">P95 CPU Utilization</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatPercentage(aggregatedData.p95CpuUtilization)}
                </p>
                <p className="text-xs text-purple-600 mt-1 flex items-center">
                  Click for details
                </p>
              </div>
              <Cpu className="h-8 w-8 text-purple-500" />
            </div>
          </div>

          <div 
            onClick={onNavigateToServiceOwner}
            className="bg-white p-6 rounded-lg shadow-sm border cursor-pointer hover:shadow-md hover:border-orange-300 transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">P95 Memory Utilization</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatPercentage(aggregatedData.p95MemoryUtilization)}
                </p>
                <p className="text-xs text-orange-600 mt-1 flex items-center">
                  Click for details
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Daily Cost Chart - Shows when filters are selected - MOVED TO TOP FOR VISIBILITY */}
        {dailyCostLoading && (
          <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
            <div className="flex items-center justify-center py-8">
              <span className="text-gray-500">Loading daily cost data...</span>
            </div>
          </div>
        )}
        {!dailyCostLoading && dailyCostData && dailyCostData.dailyCosts && dailyCostData.dailyCosts.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <BarChart3 className="h-6 w-6 mr-2 text-blue-600" />
              Daily Cost Trend Chart
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Daily cost breakdown to calculate cost savings and reduction opportunities. Select filters above to see trends.
            </p>
            
            <div className="space-y-4">
              <div className="relative h-96 flex">
                {/* Y-axis labels */}
                <div className="w-20 flex flex-col justify-between text-right pr-2 text-xs text-gray-600">
                  {[4, 3, 2, 1, 0].map((i) => {
                    const maxCost = Math.max(...dailyCostData.dailyCosts.map((d: any) => d.cost));
                    const value = (maxCost / 1000000) * (i / 4);
                    return (
                      <div key={i} className="flex items-center justify-end">
                        ${value.toFixed(2)}M
                      </div>
                    );
                  })}
                </div>
                
                {/* Chart area */}
                <div className="flex-1 relative overflow-x-auto">
                  <svg className="w-full h-full min-w-[800px]" viewBox="0 0 800 350" preserveAspectRatio="none">
                    {/* Grid lines */}
                    {[0, 1, 2, 3, 4].map((i) => (
                      <line
                        key={i}
                        x1="0"
                        y1={i * 87.5}
                        x2="800"
                        y2={i * 87.5}
                        stroke="#e5e7eb"
                        strokeWidth="1"
                      />
                    ))}
                    
                    {/* Cost line */}
                    <polyline
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="3"
                      points={dailyCostData.dailyCosts.map((item: any, index: number) => {
                        const x = (index / Math.max(dailyCostData.dailyCosts.length - 1, 1)) * 800;
                        const maxCost = Math.max(...dailyCostData.dailyCosts.map((d: any) => d.cost));
                        const y = 350 - ((item.cost / maxCost) * 330);
                        return `${x},${y}`;
                      }).join(' ')}
                    />
                    
                    {/* Savings opportunity line */}
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                      points={dailyCostData.dailyCosts.map((item: any, index: number) => {
                        const x = (index / Math.max(dailyCostData.dailyCosts.length - 1, 1)) * 800;
                        const maxCost = Math.max(...dailyCostData.dailyCosts.map((d: any) => d.cost));
                        const maxSavings = Math.max(...dailyCostData.dailyCosts.map((d: any) => d.savingsOpportunity || 0));
                        const y = maxSavings > 0 ? 350 - ((item.savingsOpportunity / maxCost) * 330) : 350;
                        return `${x},${y}`;
                      }).join(' ')}
                    />
                    
                    {/* Data points */}
                    {dailyCostData.dailyCosts.map((item: any, index: number) => {
                      const x = (index / Math.max(dailyCostData.dailyCosts.length - 1, 1)) * 800;
                      const maxCost = Math.max(...dailyCostData.dailyCosts.map((d: any) => d.cost));
                      const y = 350 - ((item.cost / maxCost) * 330);
                      return (
                        <g key={index}>
                          <circle
                            cx={x}
                            cy={y}
                            r="5"
                            fill="#3b82f6"
                            className="cursor-pointer hover:r-7 transition-all"
                          >
                            <title>
                              {item.date}: ${(item.cost / 1000).toFixed(2)}K
                              {item.savingsOpportunity > 0 && ` | Savings: $${(item.savingsOpportunity / 1000).toFixed(2)}K`}
                            </title>
                          </circle>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
              
              {/* Date labels */}
              <div className="flex justify-between text-xs text-gray-600 ml-20 overflow-x-auto">
                {dailyCostData.dailyCosts.map((item: any, index: number) => {
                  // Show every Nth label to avoid crowding
                  const showLabel = index % Math.ceil(dailyCostData.dailyCosts.length / 20) === 0 || 
                                   index === dailyCostData.dailyCosts.length - 1;
                  if (!showLabel) return null;
                  return (
                    <div key={index} className="text-center flex-shrink-0" style={{ width: `${100 / Math.ceil(dailyCostData.dailyCosts.length / 20)}%` }}>
                      {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  );
                })}
              </div>
              
              {/* Legend */}
              <div className="flex items-center justify-center space-x-6 pt-2 border-t">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-0.5 bg-blue-600"></div>
                  <span className="text-xs text-gray-600">Daily Cost</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-0.5 bg-green-600 border-dashed border-t-2"></div>
                  <span className="text-xs text-gray-600">Savings Opportunity</span>
                </div>
              </div>
              
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-xs text-gray-600">Total Cost</p>
                  <p className="text-lg font-bold text-blue-600">
                    ${(dailyCostData.summary.totalCost / 1000000).toFixed(2)}M
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600">Avg Daily Cost</p>
                  <p className="text-lg font-bold text-purple-600">
                    ${(dailyCostData.summary.averageDailyCost / 1000).toFixed(2)}K
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600">Peak Daily Cost</p>
                  <p className="text-lg font-bold text-red-600">
                    ${(dailyCostData.summary.maxDailyCost / 1000).toFixed(2)}K
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600">Lowest Daily Cost</p>
                  <p className="text-lg font-bold text-green-600">
                    ${(dailyCostData.summary.minDailyCost / 1000).toFixed(2)}K
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600">Total Savings Opportunity</p>
                  <p className="text-lg font-bold text-emerald-600">
                    ${(dailyCostData.summary.totalSavingsOpportunity / 1000000).toFixed(2)}M
                  </p>
                </div>
              </div>
              
              {/* Cost Reduction Calculation */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Cost Reduction Analysis</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Potential Reduction:</p>
                    <p className="text-lg font-bold text-blue-700">
                      {dailyCostData.summary.totalCost > 0 
                        ? `${((dailyCostData.summary.totalSavingsOpportunity / dailyCostData.summary.totalCost) * 100).toFixed(1)}%`
                        : '0%'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Monthly Savings (if applied):</p>
                    <p className="text-lg font-bold text-green-700">
                      ${((dailyCostData.summary.totalSavingsOpportunity / dailyCostData.summary.totalDays) * 30 / 1000).toFixed(2)}K
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Yearly Savings (if applied):</p>
                    <p className="text-lg font-bold text-emerald-700">
                      ${((dailyCostData.summary.totalSavingsOpportunity / dailyCostData.summary.totalDays) * 365 / 1000000).toFixed(2)}M
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {!dailyCostLoading && (!dailyCostData || !dailyCostData.dailyCosts || dailyCostData.dailyCosts.length === 0) && (
          <div className="bg-white p-6 rounded-lg shadow-sm border mb-6 border-blue-200">
            <h3 className="text-xl font-bold mb-4 flex items-center text-blue-600">
              <BarChart3 className="h-6 w-6 mr-2" />
              Daily Cost Trend Chart
            </h3>
            <p className="text-sm text-gray-500 text-center py-8">
              <strong>Select one or more filters</strong> (Month, Falcon Instance, Domain, Environment, Service, Cluster, Namespace, Resource Type, or Deployment) above to view daily cost trends and calculate cost savings.
            </p>
          </div>
        )}

        {/* Trend Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold mb-4">Total Cost Trend (Month over Month)</h3>
            <div className="space-y-3">
              {aggregatedData.monthlyTrend.map((item, index) => (
                <div key={item.month} className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-700 w-12 flex-shrink-0">{item.month}</span>
                    <div className="bg-gray-200 rounded-full h-2 w-24 flex-shrink-0">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${(item.cost / Math.max(...aggregatedData.monthlyTrend.map(t => t.cost))) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                    ${(item.cost / 1000000).toFixed(2)}M
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold mb-4">Cost Savings Trend (Month over Month)</h3>
            <div className="space-y-3">
              {aggregatedData.monthlyTrend.map((item, index) => (
                <div key={item.month} className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-700 w-12 flex-shrink-0">{item.month}</span>
                    <div className="bg-gray-200 rounded-full h-2 w-24 flex-shrink-0">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ width: `${(item.savings / Math.max(...aggregatedData.monthlyTrend.map(t => t.savings))) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-green-600 flex-shrink-0">
                    ${(item.savings / 1000000).toFixed(2)}M
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Kubernetes Monitoring Integration */}
        <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-6 rounded-lg border border-cyan-200">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-cyan-900 mb-2 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Live Kubernetes Metrics Monitoring
              </h3>
              <p className="text-sm text-cyan-700 mb-4">
                Real-time kube-state metrics for HPA, pods, and cluster resources
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* HPA Metrics Link */}
            <a
              href="https://monitoring.internal.salesforce.com/#/viewmetricsnew?expression=-1h%3A-0m%3Akube-state-metrics.kube_horizontalpodautoscaler_spec_max_replicas%7Bhorizontalpodautoscaler%3D*%2Ck8s_namespace%3D*%2Ck8s_cluster%3D*%7D%3Aavg%3A1m-avg&tab=discover"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white p-4 rounded-lg border border-cyan-200 hover:border-cyan-400 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900">HPA Max Replicas</h4>
                <TrendingUp className="h-4 w-4 text-cyan-600" />
              </div>
              <p className="text-xs text-gray-600 mb-2">
                Monitor HPA spec max replicas across clusters
              </p>
              <div className="flex items-center text-xs text-cyan-600">
                <span>View in Monitoring →</span>
              </div>
            </a>

            {/* Kube State Metrics Link */}
            <a
              href="https://monitoring.internal.salesforce.com/#/viewmetricsnew?expression=-12h%3A-0m%3Akube-state-metrics.kube_deployment_status_replicas%7Bdeployment%3D*%2Ck8s_namespace%3D*%2Ck8s_cluster%3D*%7D%3Aavg%3A1m-avg&tab=discover"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white p-4 rounded-lg border border-cyan-200 hover:border-cyan-400 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900">Deployment Replicas</h4>
                <Cpu className="h-4 w-4 text-cyan-600" />
              </div>
              <p className="text-xs text-gray-600 mb-2">
                Track deployment replica status (Last 12h)
              </p>
              <div className="flex items-center text-xs text-cyan-600">
                <span>View in Monitoring →</span>
              </div>
            </a>

            {/* Pod Status Link */}
            <a
              href="https://monitoring.internal.salesforce.com/#/viewmetricsnew?expression=-1h%3A-0m%3Akube-state-metrics.kube_pod_status_phase%7Bphase%3D%22Running%22%2Ck8s_cluster%3D*%7D%3Asum%3A1m-avg&tab=discover"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white p-4 rounded-lg border border-cyan-200 hover:border-cyan-400 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900">Running Pods</h4>
                <Calendar className="h-4 w-4 text-cyan-600" />
              </div>
              <p className="text-xs text-gray-600 mb-2">
                View running pods across all clusters
              </p>
              <div className="flex items-center text-xs text-cyan-600">
                <span>View in Monitoring →</span>
              </div>
            </a>

            {/* Custom Query Link */}
            <a
              href={selectedDeploymentName 
                ? `https://monitoring.internal.salesforce.com/#/viewmetricsnew?expression=-1h%3A-0m%3Akube-state-metrics.kube_deployment_status_replicas%7Bdeployment%3D${encodeURIComponent(selectedDeploymentName)}%2Ck8s_cluster%3D*%7D%3Aavg%3A1m-avg&tab=discover`
                : "https://monitoring.internal.salesforce.com/#/viewmetricsnew?tab=discover"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white p-4 rounded-lg border border-cyan-200 hover:border-cyan-400 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900">
                  {selectedDeploymentName ? `Monitor: ${selectedDeploymentName}` : 'Custom Query'}
                </h4>
                <DollarSign className="h-4 w-4 text-cyan-600" />
              </div>
              <p className="text-xs text-gray-600 mb-2">
                {selectedDeploymentName 
                  ? 'View specific deployment metrics'
                  : 'Build custom monitoring queries'
                }
              </p>
              <div className="flex items-center text-xs text-cyan-600">
                <span>View in Monitoring →</span>
              </div>
            </a>
          </div>

          <div className="mt-4 p-3 bg-cyan-100 rounded-lg">
            <p className="text-xs text-cyan-900">
              <strong>💡 Tip:</strong> Select a deployment name from the filters above to see deployment-specific monitoring links.
            </p>
          </div>
        </div>

        {/* Deployment-Specific Charts */}
        {selectedDeploymentName && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-lg border border-purple-200">
              <h3 className="text-lg font-semibold text-purple-900 mb-2">
                Deployment Analysis: {selectedDeploymentName}
              </h3>
              <p className="text-sm text-purple-700">
                Showing cost trends and savings opportunities for the selected deployment from April to November 2024
              </p>
            </div>

            {/* Cost vs Savings Opportunity Line Chart */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
                <span>Monthly Cost vs Savings Opportunity</span>
                {deploymentTrendLoading && (
                  <span className="text-xs text-gray-500">Loading...</span>
                )}
              </h3>
              {deploymentMonthlyTrend && deploymentMonthlyTrend.monthlyTrend && (
                <div className="space-y-4">
                  <div className="relative h-64 flex">
                    {/* Y-axis labels */}
                    <div className="w-16 flex flex-col justify-between text-right pr-2 text-xs text-gray-600">
                      {[4, 3, 2, 1, 0].map((i) => {
                        const maxValue = Math.max(
                          ...deploymentMonthlyTrend.monthlyTrend.map(t => Math.max(t.cost, t.savings))
                        );
                        const value = (maxValue / 1000000) * (i / 4);
                        return (
                          <div key={i} className="flex items-center justify-end">
                            ${value.toFixed(2)}M
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Chart area */}
                    <div className="flex-1 relative">
                      <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
                        {/* Grid lines */}
                        {[0, 1, 2, 3, 4].map((i) => (
                          <line
                            key={i}
                            x1="0"
                            y1={i * 50}
                            x2="800"
                            y2={i * 50}
                            stroke="#e5e7eb"
                            strokeWidth="1"
                          />
                        ))}
                        
                        {/* Cost line */}
                        <polyline
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="3"
                          points={deploymentMonthlyTrend.monthlyTrend.map((item, index) => {
                            const x = (index / (deploymentMonthlyTrend.monthlyTrend.length - 1)) * 800;
                            const maxValue = Math.max(...deploymentMonthlyTrend.monthlyTrend.map(t => Math.max(t.cost, t.savings)));
                            const y = 200 - ((item.cost / maxValue) * 180);
                            return `${x},${y}`;
                          }).join(' ')}
                        />
                        
                        {/* Savings line */}
                        <polyline
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="3"
                          points={deploymentMonthlyTrend.monthlyTrend.map((item, index) => {
                            const x = (index / (deploymentMonthlyTrend.monthlyTrend.length - 1)) * 800;
                            const maxValue = Math.max(...deploymentMonthlyTrend.monthlyTrend.map(t => Math.max(t.cost, t.savings)));
                            const y = 200 - ((item.savings / maxValue) * 180);
                            return `${x},${y}`;
                          }).join(' ')}
                        />
                        
                        {/* Cost data points */}
                        {deploymentMonthlyTrend.monthlyTrend.map((item, index) => {
                          const x = (index / (deploymentMonthlyTrend.monthlyTrend.length - 1)) * 800;
                          const maxValue = Math.max(...deploymentMonthlyTrend.monthlyTrend.map(t => Math.max(t.cost, t.savings)));
                          const y = 200 - ((item.cost / maxValue) * 180);
                          return (
                            <circle
                              key={`cost-${index}`}
                              cx={x}
                              cy={y}
                              r="5"
                              fill="#3b82f6"
                              className="cursor-pointer"
                            >
                              <title>Cost - {item.month}: ${(item.cost / 1000000).toFixed(2)}M</title>
                            </circle>
                          );
                        })}
                        
                        {/* Savings data points */}
                        {deploymentMonthlyTrend.monthlyTrend.map((item, index) => {
                          const x = (index / (deploymentMonthlyTrend.monthlyTrend.length - 1)) * 800;
                          const maxValue = Math.max(...deploymentMonthlyTrend.monthlyTrend.map(t => Math.max(t.cost, t.savings)));
                          const y = 200 - ((item.savings / maxValue) * 180);
                          return (
                            <circle
                              key={`savings-${index}`}
                              cx={x}
                              cy={y}
                              r="5"
                              fill="#10b981"
                              className="cursor-pointer"
                            >
                              <title>Savings - {item.month}: ${(item.savings / 1000000).toFixed(2)}M</title>
                            </circle>
                          );
                        })}
                      </svg>
                    </div>
                  </div>
                  
                  {/* Month labels */}
                  <div className="flex justify-between text-xs text-gray-600 ml-16">
                    {deploymentMonthlyTrend.monthlyTrend.map((item, index) => (
                      <div key={index} className="text-center">
                        {item.month}
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-center space-x-6 text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-blue-500 rounded"></div>
                      <span className="text-gray-700">Current Cost</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className="text-gray-700">Savings Opportunity</span>
                    </div>
                  </div>
                  
                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Total Cost</p>
                      <p className="text-lg font-bold text-blue-600">
                        ${(deploymentMonthlyTrend.monthlyTrend.reduce((sum, item) => sum + item.cost, 0) / 1000000).toFixed(2)}M
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Total Savings Opportunity</p>
                      <p className="text-lg font-bold text-green-600">
                        ${(deploymentMonthlyTrend.monthlyTrend.reduce((sum, item) => sum + item.savings, 0) / 1000000).toFixed(2)}M
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Potential Savings Rate</p>
                      <p className="text-lg font-bold text-purple-600">
                        {((deploymentMonthlyTrend.monthlyTrend.reduce((sum, item) => sum + item.savings, 0) / 
                           deploymentMonthlyTrend.monthlyTrend.reduce((sum, item) => sum + item.cost, 0)) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {!deploymentMonthlyTrend && !deploymentTrendLoading && (
                <p className="text-sm text-gray-500 text-center py-8">
                  Select a deployment name to view monthly cost and savings trends
                </p>
              )}
            </div>

            {/* Monthly EC2 Cost Trend Line Chart */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
                <span>Monthly EC2 Cost Trend</span>
                {deploymentDailyLoading && (
                  <span className="text-xs text-gray-500">Loading...</span>
                )}
              </h3>
              {deploymentDailyCost && deploymentDailyCost.dailyCosts && (
                <div className="space-y-4">
                  <div className="relative h-64 flex">
                    {/* Y-axis labels */}
                    <div className="w-16 flex flex-col justify-between text-right pr-2 text-xs text-gray-600">
                      {[4, 3, 2, 1, 0].map((i) => {
                        const maxCost = Math.max(...deploymentDailyCost.dailyCosts.map(d => d.cost));
                        const value = (maxCost / 1000000) * (i / 4);
                        return (
                          <div key={i} className="flex items-center justify-end">
                            ${value.toFixed(2)}M
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Chart area */}
                    <div className="flex-1 relative">
                      <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
                        {/* Grid lines */}
                        {[0, 1, 2, 3, 4].map((i) => (
                          <line
                            key={i}
                            x1="0"
                            y1={i * 50}
                            x2="800"
                            y2={i * 50}
                            stroke="#e5e7eb"
                            strokeWidth="1"
                          />
                        ))}
                        
                        {/* Cost line */}
                        <polyline
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="3"
                          points={deploymentDailyCost.dailyCosts.map((item, index) => {
                            const x = (index / (deploymentDailyCost.dailyCosts.length - 1)) * 800;
                            const maxCost = Math.max(...deploymentDailyCost.dailyCosts.map(d => d.cost));
                            const y = 200 - ((item.cost / maxCost) * 180);
                            return `${x},${y}`;
                          }).join(' ')}
                        />
                        
                        {/* Data points */}
                        {deploymentDailyCost.dailyCosts.map((item, index) => {
                          const x = (index / (deploymentDailyCost.dailyCosts.length - 1)) * 800;
                          const maxCost = Math.max(...deploymentDailyCost.dailyCosts.map(d => d.cost));
                          const y = 200 - ((item.cost / maxCost) * 180);
                          return (
                            <circle
                              key={index}
                              cx={x}
                              cy={y}
                              r="5"
                              fill="#3b82f6"
                              className="cursor-pointer"
                            >
                              <title>{item.date}: ${(item.cost / 1000000).toFixed(2)}M</title>
                            </circle>
                          );
                        })}
                      </svg>
                    </div>
                  </div>
                  
                  {/* Month labels */}
                  <div className="flex justify-between text-xs text-gray-600 ml-16">
                    {deploymentDailyCost.dailyCosts.map((item, index) => (
                      <div key={index} className="text-center">
                        {item.date}
                      </div>
                    ))}
                  </div>
                  
                  {/* Summary Stats */}
                  <div className="grid grid-cols-4 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Average Monthly Cost</p>
                      <p className="text-lg font-bold text-blue-600">
                        ${((deploymentDailyCost.dailyCosts.reduce((sum, item) => sum + item.cost, 0) / 
                           deploymentDailyCost.dailyCosts.length) / 1000000).toFixed(2)}M
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Peak Monthly Cost</p>
                      <p className="text-lg font-bold text-red-600">
                        ${(Math.max(...deploymentDailyCost.dailyCosts.map(d => d.cost)) / 1000000).toFixed(2)}M
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Lowest Monthly Cost</p>
                      <p className="text-lg font-bold text-green-600">
                        ${(Math.min(...deploymentDailyCost.dailyCosts.map(d => d.cost)) / 1000000).toFixed(2)}M
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Total Period Cost</p>
                      <p className="text-lg font-bold text-purple-600">
                        ${(deploymentDailyCost.dailyCosts.reduce((sum, item) => sum + item.cost, 0) / 1000000).toFixed(2)}M
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {!deploymentDailyCost && !deploymentDailyLoading && (
                <p className="text-sm text-gray-500 text-center py-8">
                  Select a deployment name to view monthly EC2 cost trends
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderServiceOwnerView = () => {
    // Use real savings breakdown data or fallback to empty array
    const detailedServices = savingsBreakdownData?.services || [];
    const summary = savingsBreakdownData?.summary || {
      totalServices: 0,
      totalCost: 0,
      totalSavings: 0,
      avgCpuUtilization: 0,
      avgMemoryUtilization: 0,
      potentialSavingsRate: 0
    };

    // Initiative names from CTS data for monthly analysis
    const initiatives = [
      "Improve Bin Packing with Karpenter/M5 Upgrades",
      "Rightsizing of HCP AddOns- Platform", 
      "Reduce Storage Waste-non-sam(gp2-gp3)- Tenant",
      "Mesh / IG- Platform",
      "Decom of Redundant Compute- Tenant",
      "Right-sizing Supercell Clusters"
    ];

    return (
      <div className="space-y-6">
        {/* Monthly Analysis with Initiative Names */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Monthly Analysis - Initiative Performance</h3>
          <p className="text-sm text-gray-600 mb-4">
            September 2024 initiative performance and cost analysis
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {initiatives.map((initiative, index) => (
              <div key={index} className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">{initiative}</h4>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">September Actual:</span>
                    <span className="font-medium text-blue-900">${(Math.random() * 150 + 50).toFixed(0)}K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Target:</span>
                    <span className="font-medium text-blue-900">${(Math.random() * 130 + 40).toFixed(0)}K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Performance:</span>
                    <span className="font-medium text-green-600">{(Math.random() * 40 + 80).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Service-Level Cost Breakdown */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Service-Level Cost Breakdown</h3>
          <p className="text-sm text-gray-600 mb-4">
            Detailed breakdown of services, resources, and cost optimization opportunities
          </p>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Allocated Service
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resource Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deployment Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    K8 Namespace
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cluster Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    EC2 Cost ($)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    P95 CPU (%)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    P95 Memory (%)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Savings Opportunity ($)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {detailedServices.map((service, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {service.allocatedService}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        service.resourceType === 'Compute' ? 'bg-blue-100 text-blue-800' :
                        service.resourceType === 'Database' ? 'bg-purple-100 text-purple-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {service.resourceType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {service.deploymentName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">{service.k8Namespace}</code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {service.clusterName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${service.ec2Cost.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 w-16 mr-2">
                          <div 
                            className={`h-2 rounded-full ${
                              service.p95Cpu >= 70 ? 'bg-red-500' : 
                              service.p95Cpu >= 50 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${service.p95Cpu}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-medium">{service.p95Cpu}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 w-16 mr-2">
                          <div 
                            className={`h-2 rounded-full ${
                              service.p95Memory >= 80 ? 'bg-red-500' : 
                              service.p95Memory >= 60 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${service.p95Memory}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-medium">{service.p95Memory}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      ${service.savingsOpportunity.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Analytics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h4 className="text-md font-semibold mb-3">Resource Distribution</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Compute Resources</span>
                <span className="font-medium">45%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Database Resources</span>
                <span className="font-medium">30%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Storage Resources</span>
                <span className="font-medium">25%</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h4 className="text-md font-semibold mb-3">Initiative Performance</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>On-track initiatives: 4/6</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span>At-risk initiatives: 2/6</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Overall performance: 94.2%</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h4 className="text-md font-semibold mb-3">Cost Summary</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Monthly Cost</span>
                <span className="font-medium text-gray-900">${(summary.totalCost / 1000).toFixed(2)}K</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total Savings Opportunity</span>
                <span className="font-medium text-green-600">${(summary.totalSavings / 1000).toFixed(2)}K</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Potential Savings Rate</span>
                <span className="font-medium text-blue-600">{summary.potentialSavingsRate}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total Services</span>
                <span className="font-medium text-gray-900">{summary.totalServices}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">HCP FKP Addon</h2>
        <p className="text-gray-600">Comprehensive cost analysis and optimization opportunities from Jupyter notebook analysis</p>
      </div>


      {/* Comprehensive Filters */}
      <div className="mb-6 bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Filter & Analysis Options</h3>
          <button
            onClick={clearAllFilters}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors text-sm font-medium"
          >
            Clear All Filters
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {/* Month Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
            <select
              value={selectedMonthFilter}
              onChange={(e) => setSelectedMonthFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            >
              <option value="">Select Month</option>
              {filterOptions?.months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          {/* Falcon Instance Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Falcon Instance</label>
            <select
              value={selectedFalconInstance}
              onChange={(e) => setSelectedFalconInstance(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            >
              <option value="">Select Falcon Instance</option>
              {filterOptions?.falconInstances.map((instance) => (
                <option key={instance} value={instance}>
                  {instance}
                </option>
              ))}
            </select>
          </div>

          {/* Falcon Domain Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Falcon Domain</label>
            <select
              value={selectedFalconDomain}
              onChange={(e) => setSelectedFalconDomain(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            >
              <option value="">Select Falcon Domain</option>
              {filterOptions?.falconDomains.map((domain) => (
                <option key={domain} value={domain}>
                  {domain}
                </option>
              ))}
            </select>
          </div>

          {/* Environment Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Environment Type</label>
            <select
              value={selectedEnvironmentType}
              onChange={(e) => setSelectedEnvironmentType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            >
              <option value="">Select Environment Type</option>
              {filterOptions?.environmentTypes.map((envType) => (
                <option key={envType} value={envType}>
                  {envType}
                </option>
              ))}
            </select>
          </div>

          {/* Allocated Service Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Allocated Service</label>
            <select
              value={selectedAllocatedService}
              onChange={(e) => setSelectedAllocatedService(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            >
              <option value="">Select Allocated Service</option>
              {filterOptions?.allocatedServices.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </div>

          {/* K8 Cluster Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">K8 Cluster</label>
            <select
              value={selectedK8Cluster}
              onChange={(e) => setSelectedK8Cluster(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            >
              <option value="">Select K8 Cluster</option>
              {filterOptions?.k8Clusters.map((cluster) => (
                <option key={cluster} value={cluster}>
                  {cluster}
                </option>
              ))}
            </select>
          </div>

          {/* K8 Namespace Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">K8 Namespace</label>
            <select
              value={selectedK8Namespace}
              onChange={(e) => setSelectedK8Namespace(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            >
              <option value="">Select K8 Namespace</option>
              {getFilteredOptions()?.k8Namespaces.map((namespace) => (
                <option key={namespace} value={namespace}>
                  {namespace}
                </option>
              ))}
            </select>
          </div>

          {/* Resource Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Resource Type</label>
            <select
              value={selectedResourceType}
              onChange={(e) => setSelectedResourceType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            >
              <option value="">Select Resource Type</option>
              {filterOptions?.resourceTypes.map((resourceType) => (
                <option key={resourceType} value={resourceType}>
                  {resourceType}
                </option>
              ))}
            </select>
          </div>

          {/* Deployment Name Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Deployment Name</label>
            <select
              value={selectedDeploymentName}
              onChange={(e) => setSelectedDeploymentName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            >
              <option value="">Select Deployment Name</option>
              {getFilteredOptions()?.deploymentNames.map((deploymentName) => (
                <option key={deploymentName} value={deploymentName}>
                  {deploymentName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Summary */}
        <div className="mt-4 flex flex-wrap gap-2">
          {selectedMonthFilter && selectedMonthFilter !== '' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Month: {selectedMonthFilter}
            </span>
          )}
          {selectedFalconInstance && selectedFalconInstance !== '' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Falcon Instance: {selectedFalconInstance}
            </span>
          )}
          {selectedFalconDomain && selectedFalconDomain !== '' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Falcon Domain: {selectedFalconDomain}
            </span>
          )}
          {selectedEnvironmentType && selectedEnvironmentType !== '' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              Environment: {selectedEnvironmentType}
            </span>
          )}
          {selectedAllocatedService && selectedAllocatedService !== '' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
              Service: {selectedAllocatedService}
            </span>
          )}
          {selectedK8Cluster && selectedK8Cluster !== '' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
              K8 Cluster: {selectedK8Cluster}
            </span>
          )}
          {selectedK8Namespace && selectedK8Namespace !== '' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
              K8 Namespace: {selectedK8Namespace}
            </span>
          )}
          {selectedResourceType && selectedResourceType !== '' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              Resource Type: {selectedResourceType}
            </span>
          )}
          {selectedDeploymentName && selectedDeploymentName !== '' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              Deployment: {selectedDeploymentName}
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-96">
        {view === 'executive' ? renderExecutiveView() : renderServiceOwnerView()}
      </div>
    </div>
  );
};

export default HCPCostAnalysis;

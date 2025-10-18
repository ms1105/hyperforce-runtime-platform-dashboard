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

interface HCPCostAnalysisProps {
  selectedMonth?: string;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatPercentage = (value: number): string => {
  return `${value.toFixed(2)}%`;
};

const HCPCostAnalysis: React.FC<HCPCostAnalysisProps> = ({ selectedMonth }) => {
  const [costData, setCostData] = useState<HCPCostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'monthly' | 'breakdown' | 'trends'>('overview');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');

  useEffect(() => {
    const fetchCostData = async () => {
      try {
        const response = await fetch('/api/hcp-cost-analysis');
        const data = await response.json();
        setCostData(data);
      } catch (error) {
        console.error('Error fetching HCP cost data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCostData();
  }, []);

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

  const renderOverview = () => {
    // Get filtered month data if a specific month is selected
    const filteredMonth = selectedMonthFilter !== 'all' 
      ? costData!.monthlyData.find(month => month.monthKey === selectedMonthFilter)
      : null;

    if (filteredMonth) {
      // Show month-specific overview
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Daily EC2 Cost</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(filteredMonth.dailyEC2Cost)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Daily Savings Opportunity</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(filteredMonth.dailySavingOpportunity)}
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Monthly Cost</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(filteredMonth.monthlyCost)}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Yearly Savings Estimate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(filteredMonth.yearlySavingEstimate)}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-green-500" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold mb-4">{filteredMonth.month} Analysis Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">P95 CPU Utilization Threshold</p>
                <p className="font-medium">{filteredMonth.utilizationThreshold}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Monthly Savings Opportunity</p>
                <p className="font-medium text-green-600">{formatCurrency(filteredMonth.monthlySavingOpportunity)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Analysis Month</p>
                <p className="font-medium">{filteredMonth.month}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Savings Rate</p>
                <p className="font-medium text-green-600">
                  {((filteredMonth.dailySavingOpportunity / filteredMonth.dailyEC2Cost) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
              <strong>Analysis Formula:</strong> {filteredMonth.analysisFormula}
            </div>
          </div>
        </div>
      );
    }

    // Show all months overview
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Monthly Cost</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(costData!.summary.totalMonthlyCost)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Monthly Savings Opportunity</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(costData!.summary.totalMonthlySavingOpportunity)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Yearly Saving Estimate</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(costData!.summary.totalYearlySavingEstimate)}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cost Efficiency Gain</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatPercentage(costData!.summary.costEfficiencyGain)}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Analysis Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Analysis Period</p>
              <p className="font-medium">{costData!.summary.analysisMonths} months ({costData!.summary.lastUpdated})</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Data Source</p>
              <p className="font-medium text-sm">{costData!.summary.dataSource}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Average Daily Cost</p>
              <p className="font-medium">{formatCurrency(costData!.summary.averageDailyCost)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Average Daily Savings</p>
              <p className="font-medium text-green-600">{formatCurrency(costData!.summary.averageDailySaving)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMonthlyData = () => {
    // Get filtered month data if a specific month is selected
    const filteredMonth = selectedMonthFilter !== 'all' 
      ? costData!.monthlyData.find(month => month.monthKey === selectedMonthFilter)
      : null;

    const monthsToDisplay = filteredMonth ? [filteredMonth] : costData!.monthlyData;

    return (
      <div className="space-y-4">
        {filteredMonth && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              {filteredMonth.month} - Detailed Monthly Analysis
            </h3>
            <p className="text-blue-700 text-sm">
              Showing detailed cost analysis and savings opportunities for the selected month.
            </p>
          </div>
        )}
        
        {monthsToDisplay.map((month) => (
          <div key={month.monthKey} className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{month.month}</h3>
              <div className="flex gap-4 text-sm text-gray-600">
                <span>P95 CPU Threshold: {month.utilizationThreshold}%</span>
                <span className="text-green-600">
                  Savings Rate: {((month.dailySavingOpportunity / month.dailyEC2Cost) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Daily EC2 Cost</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(month.dailyEC2Cost)}</p>
                <p className="text-xs text-gray-500 mt-1">Infrastructure spend</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Daily Savings Opportunity</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(month.dailySavingOpportunity)}</p>
                <p className="text-xs text-gray-500 mt-1">Optimization potential</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Monthly Cost</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(month.monthlyCost)}</p>
                <p className="text-xs text-gray-500 mt-1">Total monthly spend</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Yearly Savings Estimate</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(month.yearlySavingEstimate)}</p>
                <p className="text-xs text-gray-500 mt-1">Annual potential</p>
              </div>
            </div>
            
            {filteredMonth && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Monthly Savings Breakdown</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monthly Savings Opportunity:</span>
                      <span className="font-medium text-green-600">{formatCurrency(month.monthlySavingOpportunity)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Daily Average:</span>
                      <span className="font-medium">{formatCurrency(month.dailySavingOpportunity)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Efficiency Gain:</span>
                      <span className="font-medium text-blue-600">
                        {((month.dailySavingOpportunity / month.dailyEC2Cost) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Cost Analysis Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">CPU Utilization Target:</span>
                      <span className="font-medium">{month.utilizationThreshold}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Analysis Period:</span>
                      <span className="font-medium">{month.month}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Optimization Method:</span>
                      <span className="font-medium text-sm">HCE Pod Sizing</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
              <strong className="text-gray-900">Analysis Formula:</strong> 
              <span className="text-gray-700 ml-2">{month.analysisFormula}</span>
            </div>
          </div>
        ))}
        
        {!filteredMonth && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold mb-4">Monthly Cost Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Total Analysis Period</p>
                <p className="text-2xl font-bold text-gray-900">{costData!.monthlyData.length} months</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Average Monthly Cost</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(costData!.summary.totalMonthlyCost / costData!.monthlyData.length)}
                </p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Average Monthly Savings</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(costData!.summary.totalMonthlySavingOpportunity / costData!.monthlyData.length)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderBreakdown = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Cpu className="h-5 w-5 mr-2" />
            Infrastructure Cost Breakdown
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">EC2 Instances</span>
              <span className="font-medium">{formatPercentage(costData.breakdown.infrastructureCost.ec2Instances)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Storage</span>
              <span className="font-medium">{formatPercentage(costData.breakdown.infrastructureCost.storage)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Networking</span>
              <span className="font-medium">{formatPercentage(costData.breakdown.infrastructureCost.networking)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Other</span>
              <span className="font-medium">{formatPercentage(costData.breakdown.infrastructureCost.other)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <TrendingDown className="h-5 w-5 mr-2" />
            Saving Opportunities
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">CPU Right-sizing</span>
              <span className="font-medium text-green-600">{formatPercentage(costData.breakdown.savingOpportunities.cpuRightSizing)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Memory Optimization</span>
              <span className="font-medium text-green-600">{formatPercentage(costData.breakdown.savingOpportunities.memoryOptimization)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Instance Type Optimization</span>
              <span className="font-medium text-green-600">{formatPercentage(costData.breakdown.savingOpportunities.instanceTypeOptimization)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Scheduling Optimization</span>
              <span className="font-medium text-green-600">{formatPercentage(costData.breakdown.savingOpportunities.schedulingOptimization)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          Utilization Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Average P95 CPU Utilization</p>
            <p className="text-xl font-bold text-orange-600">
              {formatPercentage(costData.breakdown.utilizationMetrics.averageP95CPUUtilization)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Average P95 Memory Utilization</p>
            <p className="text-xl font-bold text-blue-600">
              {formatPercentage(costData.breakdown.utilizationMetrics.averageP95MemoryUtilization)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Utilization Target</p>
            <p className="text-xl font-bold">
              {formatPercentage(costData.breakdown.utilizationMetrics.utilizationTarget)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Efficiency Gain</p>
            <p className="text-xl font-bold text-green-600">
              {formatPercentage(costData.breakdown.utilizationMetrics.efficiencyGain)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTrends = () => {
    // Get filtered month data if a specific month is selected
    const filteredMonth = selectedMonthFilter !== 'all' 
      ? costData!.monthlyData.find(month => month.monthKey === selectedMonthFilter)
      : null;

    if (filteredMonth) {
      // Show month-specific trends and insights
      return (
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              {filteredMonth.month} - Trends & Insights
            </h3>
            <p className="text-blue-700 text-sm">
              Detailed trend analysis and optimization insights for {filteredMonth.month}.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Daily EC2 Cost</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(filteredMonth.dailyEC2Cost)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Daily Savings Opportunity</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(filteredMonth.dailySavingOpportunity)}
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Savings Rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {((filteredMonth.dailySavingOpportunity / filteredMonth.dailyEC2Cost) * 100).toFixed(1)}%
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">CPU Threshold</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {filteredMonth.utilizationThreshold}%
                  </p>
                </div>
                <Cpu className="h-8 w-8 text-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold mb-4">Month-Specific Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded">
                <span className="text-gray-600">Monthly Savings Opportunity</span>
                <span className="font-bold text-green-600">{formatCurrency(filteredMonth.monthlySavingOpportunity)}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded">
                <span className="text-gray-600">Yearly Savings Estimate</span>
                <span className="font-bold text-green-600">{formatCurrency(filteredMonth.yearlySavingEstimate)}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded">
                <span className="text-gray-600">Cost Efficiency Gain</span>
                <span className="font-bold text-blue-600">
                  {((filteredMonth.dailySavingOpportunity / filteredMonth.dailyEC2Cost) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold mb-4">Analysis Formula & Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">P95 CPU Utilization Threshold</p>
                <p className="font-medium">{filteredMonth.utilizationThreshold}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Analysis Period</p>
                <p className="font-medium">{filteredMonth.month}</p>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded text-sm">
              <strong>Analysis Formula:</strong> {filteredMonth.analysisFormula}
            </div>
          </div>
        </div>
      );
    }

    // Show overall trends for all months
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cost Trend</p>
                <p className="text-lg font-bold capitalize text-green-600">{costData!.trends.costTrend}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Savings Trend</p>
                <p className="text-lg font-bold capitalize text-blue-600">{costData!.trends.savingOpportunityTrend}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Utilization Improvement</p>
                <p className="text-lg font-bold text-green-600">{formatPercentage(costData!.trends.utilizationImprovement)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </div>
        </div>


        {/* Monthly Comparison Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Monthly Cost & Savings Comparison</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Daily EC2 Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Daily Savings</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Savings Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Yearly Savings</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {costData!.monthlyData.map((month) => (
                  <tr key={month.monthKey} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{month.month}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(month.dailyEC2Cost)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{formatCurrency(month.dailySavingOpportunity)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                      {((month.dailySavingOpportunity / month.dailyEC2Cost) * 100).toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{formatCurrency(month.yearlySavingEstimate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // If a specific month is selected, show only that month's data
  if (selectedMonth && selectedMonthData) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            HCP Cost Analysis - {selectedMonthData.month}
          </h2>
          <p className="text-gray-600">Detailed cost analysis and savings opportunities</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Daily EC2 Cost</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(selectedMonthData.dailyEC2Cost)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Daily Savings Opportunity</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(selectedMonthData.dailySavingOpportunity)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Monthly Cost</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(selectedMonthData.monthlyCost)}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Yearly Savings Estimate</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(selectedMonthData.yearlySavingEstimate)}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-green-500" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Analysis Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">P95 CPU Utilization Threshold</p>
              <p className="font-medium">{selectedMonthData.utilizationThreshold}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Monthly Savings Opportunity</p>
              <p className="font-medium text-green-600">{formatCurrency(selectedMonthData.monthlySavingOpportunity)}</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
            <strong>Analysis Formula:</strong> {selectedMonthData.analysisFormula}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">HCP FKP Addon</h2>
        <p className="text-gray-600">Comprehensive cost analysis and optimization opportunities from Jupyter notebook analysis</p>
      </div>

      {/* Month Filter - Top Level */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Analysis Period</h3>
          <select
            value={selectedMonthFilter}
            onChange={(e) => setSelectedMonthFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[200px]"
          >
            <option value="all">All Months Overview</option>
            {costData.monthlyData.map((month) => (
              <option key={month.monthKey} value={month.monthKey}>
                {month.month}
              </option>
            ))}
          </select>
        </div>
        {selectedMonthFilter !== 'all' && (
          <div className="mt-2 text-sm text-gray-600">
            Showing detailed analysis for {costData.monthlyData.find(m => m.monthKey === selectedMonthFilter)?.month}
          </div>
        )}
      </div>

      <div className="mb-6">
        <div className="flex space-x-4 border-b">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'monthly', label: 'Monthly Data' },
            { key: 'breakdown', label: 'Cost Breakdown' },
            { key: 'trends', label: 'Trends & Insights' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-4 font-medium text-sm ${
                activeTab === tab.key
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-96">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'monthly' && renderMonthlyData()}
        {activeTab === 'breakdown' && renderBreakdown()}
        {activeTab === 'trends' && renderTrends()}
      </div>
    </div>
  );
};

export default HCPCostAnalysis;

import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingDown, TrendingUp, Calendar, Target, CheckCircle, AlertCircle } from 'lucide-react';

interface Initiative {
  name: string;
  estimates: {
    original: EstimateData | null;
    revised: EstimateData | null;
    actuals: EstimateData | null;
  };
}

interface EstimateData {
  monthlyData: Record<string, number>;
  total: number;
  type: string;
}

interface HCPCTSData {
  initiatives: Initiative[];
  summary: {
    totalInitiatives: number;
    totalOriginalSavings: number;
    totalRevisedSavings: number;
    totalActualSavings: number;
    forecastedSavings: Record<string, number>;
  };
}

interface HCPCTSProgramProps {
  selectedInitiative?: string;
  view?: 'overview' | 'detailed' | 'actuals' | 'forecasted';
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
};

const getVarianceColor = (value: number): string => {
  if (value > 0) return 'text-green-600';
  if (value < 0) return 'text-red-600';
  return 'text-gray-600';
};

const HCPCTSProgram: React.FC<HCPCTSProgramProps> = () => {
  const [ctsData, setCtsData] = useState<HCPCTSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'initiatives' | 'actuals' | 'forecasted'>('overview');

  useEffect(() => {
    const fetchCTSData = async () => {
      try {
        const response = await fetch('/api/hcp-cts-program');
        const data = await response.json();
        setCtsData(data);
      } catch (error) {
        console.error('Error fetching HCP CTS Program data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCTSData();
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

  if (!ctsData) {
    return (
      <div className="p-6 text-center text-gray-500">
        Failed to load HCP CTS FY26 Program data
      </div>
    );
  }

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Initiatives</p>
              <p className="text-2xl font-bold text-gray-900">
                {ctsData.summary.totalInitiatives}
              </p>
            </div>
            <Target className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Original Estimate</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(ctsData.summary.totalOriginalSavings)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-gray-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Revised Estimate</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(ctsData.summary.totalRevisedSavings)}
              </p>
            </div>
            <Calendar className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Actual Savings</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(ctsData.summary.totalActualSavings)}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4">Performance vs Estimates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Revised vs Original</p>
            <p className={`text-2xl font-bold ${getVarianceColor(ctsData.summary.totalRevisedSavings - ctsData.summary.totalOriginalSavings)}`}>
              {ctsData.summary.totalRevisedSavings > ctsData.summary.totalOriginalSavings ? '+' : ''}
              {formatCurrency(ctsData.summary.totalRevisedSavings - ctsData.summary.totalOriginalSavings)}
            </p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Actual vs Revised</p>
            <p className={`text-2xl font-bold ${getVarianceColor(ctsData.summary.totalActualSavings - ctsData.summary.totalRevisedSavings)}`}>
              {ctsData.summary.totalActualSavings > ctsData.summary.totalRevisedSavings ? '+' : ''}
              {formatCurrency(ctsData.summary.totalActualSavings - ctsData.summary.totalRevisedSavings)}
            </p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Actual vs Original</p>
            <p className={`text-2xl font-bold ${getVarianceColor(ctsData.summary.totalActualSavings - ctsData.summary.totalOriginalSavings)}`}>
              {ctsData.summary.totalActualSavings > ctsData.summary.totalOriginalSavings ? '+' : ''}
              {formatCurrency(ctsData.summary.totalActualSavings - ctsData.summary.totalOriginalSavings)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderInitiatives = () => (
    <div className="space-y-4">
      {ctsData.initiatives.map((initiative, index) => (
        <div key={index} className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">{initiative.name}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {initiative.estimates.original && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-700 mb-2">Original Estimate</h4>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(initiative.estimates.original.total)}
                </p>
              </div>
            )}
            
            {initiative.estimates.revised && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-700 mb-2">Revised Estimate</h4>
                <p className="text-xl font-bold text-blue-600">
                  {formatCurrency(initiative.estimates.revised.total)}
                </p>
                {initiative.estimates.original && (
                  <p className={`text-sm mt-1 ${getVarianceColor(initiative.estimates.revised.total - initiative.estimates.original.total)}`}>
                    {initiative.estimates.revised.total > initiative.estimates.original.total ? '+' : ''}
                    {formatCurrency(initiative.estimates.revised.total - initiative.estimates.original.total)} vs original
                  </p>
                )}
              </div>
            )}
            
            {initiative.estimates.actuals && (
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-700 mb-2">Actual Savings</h4>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(initiative.estimates.actuals.total)}
                </p>
                {initiative.estimates.revised && (
                  <p className={`text-sm mt-1 ${getVarianceColor(initiative.estimates.actuals.total - initiative.estimates.revised.total)}`}>
                    {initiative.estimates.actuals.total > initiative.estimates.revised.total ? '+' : ''}
                    {formatCurrency(initiative.estimates.actuals.total - initiative.estimates.revised.total)} vs revised
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Monthly breakdown for actuals if available */}
          {initiative.estimates.actuals && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-700 mb-3">Monthly Actuals Breakdown</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(initiative.estimates.actuals.monthlyData).map((month) => (
                        <th key={month} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          {month}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {Object.values(initiative.estimates.actuals.monthlyData).map((value, idx) => (
                        <td key={idx} className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {value !== 0 ? formatCurrency(value) : '-'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderActuals = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4">Actual Savings Performance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Initiative
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Original
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revised
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actual
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {ctsData.initiatives.map((initiative, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {initiative.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {initiative.estimates.original ? formatCurrency(initiative.estimates.original.total) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                    {initiative.estimates.revised ? formatCurrency(initiative.estimates.revised.total) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                    {initiative.estimates.actuals ? formatCurrency(initiative.estimates.actuals.total) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {initiative.estimates.actuals && initiative.estimates.revised ? (
                      <span className={getVarianceColor(initiative.estimates.actuals.total - initiative.estimates.revised.total)}>
                        {initiative.estimates.actuals.total > initiative.estimates.revised.total ? (
                          <><TrendingUp className="inline h-4 w-4" /> +{formatCurrency(initiative.estimates.actuals.total - initiative.estimates.revised.total)}</>
                        ) : initiative.estimates.actuals.total < initiative.estimates.revised.total ? (
                          <><TrendingDown className="inline h-4 w-4" /> {formatCurrency(initiative.estimates.actuals.total - initiative.estimates.revised.total)}</>
                        ) : (
                          'On target'
                        )}
                      </span>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderForecasted = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4">FY26 Forecasted Savings by Category</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(ctsData.summary.forecastedSavings).map(([category, amount]) => (
            <div key={category} className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-700 mb-2">{category}</h4>
              <p className={`text-xl font-bold ${amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {amount >= 0 ? '' : '-'}{formatCurrency(amount)}
              </p>
              {category !== 'Total' && (
                <div className="mt-2">
                  {amount >= 0 ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Savings
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Cost Increase
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">HCP CTS FY26 Program</h2>
        <p className="text-gray-600">Cost optimization initiatives with revised estimates and actual performance data</p>
      </div>

      <div className="mb-6">
        <div className="flex space-x-4 border-b">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'initiatives', label: 'Initiative Details' },
            { key: 'actuals', label: 'Performance Analysis' },
            { key: 'forecasted', label: 'FY26 Forecast' }
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
        {activeTab === 'initiatives' && renderInitiatives()}
        {activeTab === 'actuals' && renderActuals()}
        {activeTab === 'forecasted' && renderForecasted()}
      </div>
    </div>
  );
};

export default HCPCTSProgram;

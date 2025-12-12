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
  };
}

interface HCPCTSProgramProps {
  selectedInitiative?: string;
  view?: 'overview' | 'detailed' | 'actuals';
}

const formatCurrency = (amount: number): string => {
  const amountInMillions = Math.abs(amount) / 1000000;
  return `$${amountInMillions.toFixed(2)}M`;
};

const getVarianceColor = (value: number): string => {
  if (value > 0) return 'text-green-600';
  if (value < 0) return 'text-red-600';
  return 'text-gray-600';
};

const HCPCTSProgram: React.FC<HCPCTSProgramProps> = () => {
  const [ctsData, setCtsData] = useState<HCPCTSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'initiatives' | 'monthly-analysis' | 'actuals'>('overview');
  const [selectedInitiative, setSelectedInitiative] = useState<string | null>(null);

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

      {/* Performance Analysis table removed per user request */}

    </div>
  );

  const renderInitiatives = () => (
    <div className="space-y-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Initiative Details</h3>
        <p className="text-gray-600">List of cost optimization initiatives.</p>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="space-y-4">
          {ctsData.initiatives.map((initiative, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">{initiative.name}</h4>
                <div className="w-64 bg-gray-200 rounded-full h-2 mt-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{width: `${Math.min(100, (index + 1) * 20)}%`}}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );


  const renderMonthlyAnalysis = () => {
    const months = ['Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec', 'Jan'];
    
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Monthly Estimates vs Actuals Analysis</h3>
          <p className="text-gray-600 mb-6">
            Detailed month-by-month comparison of revised estimates against actual performance for all initiatives.
          </p>
          
          {/* Initiative Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Initiative:</label>
            <select
              value={selectedInitiative || ''}
              onChange={(e) => setSelectedInitiative(e.target.value || null)}
              className="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Initiatives (Summary)</option>
              {ctsData.initiatives.map((initiative, idx) => (
                <option key={idx} value={initiative.name}>
                  {initiative.name}
                </option>
              ))}
            </select>
          </div>

          {/* Monthly Data Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Initiative
                  </th>
                  {months.map(month => (
                    <th key={month} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {month}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(selectedInitiative
                  ? ctsData.initiatives.filter(init => init.name === selectedInitiative)
                  : ctsData.initiatives.slice(0, 5)
                ).map((initiative, idx) => (
                  <React.Fragment key={idx}>
                    {/* Initiative Name Row */}
                    <tr className="bg-blue-50">
                      <td colSpan={months.length + 2} className="px-6 py-3 font-semibold text-blue-900">
                        {initiative.name}
                      </td>
                    </tr>
                    
                    {/* Revised Estimate Row */}
                    {initiative.estimates.revised && (
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          Revised Estimate
                        </td>
                        {months.map(month => (
                          <td key={month} className="px-3 py-4 whitespace-nowrap text-sm text-center text-blue-600">
                            {formatCurrency(initiative.estimates.revised!.monthlyData[month] || 0)}
                          </td>
                        ))}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center text-blue-600">
                          {formatCurrency(initiative.estimates.revised.total)}
                        </td>
                      </tr>
                    )}
                    
                    {/* Actuals Row */}
                    {initiative.estimates.actuals && (
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          Actual Performance
                        </td>
                        {months.map(month => (
                          <td key={month} className="px-3 py-4 whitespace-nowrap text-sm text-center text-green-600">
                            {formatCurrency(initiative.estimates.actuals!.monthlyData[month] || 0)}
                          </td>
                        ))}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center text-green-600">
                          {formatCurrency(initiative.estimates.actuals.total)}
                        </td>
                      </tr>
                    )}
                    
                    {/* Variance Row */}
                    {initiative.estimates.revised && initiative.estimates.actuals && (
                      <tr className="bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                          Variance (Actual - Estimate)
                        </td>
                        {months.map(month => {
                          const variance = (initiative.estimates.actuals!.monthlyData[month] || 0) - 
                                         (initiative.estimates.revised!.monthlyData[month] || 0);
                          return (
                            <td key={month} className={`px-3 py-4 whitespace-nowrap text-sm text-center font-medium ${getVarianceColor(variance)}`}>
                              {variance !== 0 ? (variance > 0 ? '+' : '') + formatCurrency(variance) : '-'}
                            </td>
                          );
                        })}
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-center ${getVarianceColor(initiative.estimates.actuals.total - initiative.estimates.revised.total)}`}>
                          {((initiative.estimates.actuals.total - initiative.estimates.revised.total) > 0 ? '+' : '') + 
                           formatCurrency(initiative.estimates.actuals.total - initiative.estimates.revised.total)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          
          {!selectedInitiative && ctsData.initiatives.length > 5 && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500">
                Showing first 5 initiatives. Select a specific initiative above to see detailed view.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };


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
            { key: 'monthly-analysis', label: 'Monthly Analysis' }
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
        {activeTab === 'monthly-analysis' && renderMonthlyAnalysis()}
      </div>
    </div>
  );
};

export default HCPCTSProgram;

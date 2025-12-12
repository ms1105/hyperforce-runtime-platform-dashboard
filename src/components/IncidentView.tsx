import React, { useState, useEffect } from 'react';
import { AlertTriangle, Calendar, TrendingUp, RefreshCw, ExternalLink } from 'lucide-react';

interface Incident {
  [key: string]: any; // Flexible structure since Tableau data structure may vary
}

interface IncidentData {
  success: boolean;
  timestamp: string;
  count: number;
  data: Incident[];
  view_info?: {
    name?: string;
    id?: string;
  };
  error?: string;
}

const IncidentView: React.FC = () => {
  const [incidentData, setIncidentData] = useState<IncidentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d' | '90d' | '6m'>('6m');

  const fetchIncidentData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try static JSON first (for GitHub Pages)
      try {
        const response = await fetch('/assets/data/incidents-data.json');
        if (response.ok) {
          const data: IncidentData = await response.json();
          setIncidentData(data);
          setLastUpdated(new Date().toLocaleString());
          setError(null);
          setLoading(false);
          return;
        }
      } catch (staticError) {
        console.log('Static incidents data not available, trying API...');
      }

      // Fallback to API (for local development)
      const response = await fetch('/api/tableau-incidents');
      const data: IncidentData = await response.json();

      if (data.success) {
        setIncidentData(data);
        setLastUpdated(new Date().toLocaleString());
        setError(null);
      } else {
        setError(data.error || 'Failed to load incident data');
        setIncidentData(null);
      }
    } catch (err: any) {
      // Use mock data as fallback
      console.warn('Using mock incident data');
      setIncidentData({
        success: true,
        timestamp: new Date().toISOString(),
        count: 0,
        data: []
      });
      setLastUpdated(new Date().toLocaleString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidentData();
    // Auto-refresh every 15 minutes
    const interval = setInterval(fetchIncidentData, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getSeverityColor = (severity: string) => {
    const sev = severity?.toLowerCase() || '';
    if (sev.includes('critical') || sev.includes('p0') || sev.includes('sev1')) {
      return 'bg-red-100 text-red-800 border-red-300';
    }
    if (sev.includes('high') || sev.includes('p1') || sev.includes('sev2')) {
      return 'bg-orange-100 text-orange-800 border-orange-300';
    }
    if (sev.includes('medium') || sev.includes('p2') || sev.includes('sev3')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  const getStatusColor = (status: string) => {
    const stat = status?.toLowerCase() || '';
    if (stat.includes('resolved') || stat.includes('closed')) {
      return 'bg-green-100 text-green-800';
    }
    if (stat.includes('investigating') || stat.includes('open')) {
      return 'bg-yellow-100 text-yellow-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  if (loading && !incidentData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading incident data from Tableau...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 text-red-800 mb-2">
          <AlertTriangle className="h-5 w-5" />
          <h3 className="font-semibold">Error Loading Incident Data</h3>
        </div>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={fetchIncidentData}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
        <div className="mt-4 text-sm text-red-600">
          <p>Make sure you have configured Tableau credentials:</p>
          <ul className="list-disc list-inside mt-2">
            <li>Set TABLEAU_PAT_NAME and TABLEAU_PAT_SECRET environment variables, or</li>
            <li>Set TABLEAU_USERNAME and TABLEAU_PASSWORD environment variables</li>
          </ul>
        </div>
      </div>
    );
  }

  if (!incidentData || !incidentData.data || incidentData.data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4">HRP 6-Month Incidents</h3>
        <p className="text-gray-500 text-center py-8">No incident data available</p>
      </div>
    );
  }

  // Extract column names from first row
  const columns = incidentData.data.length > 0 ? Object.keys(incidentData.data[0]) : [];
  
  // Try to identify common incident fields
  const dateColumn = columns.find(col => 
    col.toLowerCase().includes('date') || 
    col.toLowerCase().includes('time') ||
    col.toLowerCase().includes('created')
  );
  const severityColumn = columns.find(col => 
    col.toLowerCase().includes('severity') || 
    col.toLowerCase().includes('priority') ||
    col.toLowerCase().includes('sev')
  );
  const statusColumn = columns.find(col => 
    col.toLowerCase().includes('status') || 
    col.toLowerCase().includes('state')
  );
  const titleColumn = columns.find(col => 
    col.toLowerCase().includes('title') || 
    col.toLowerCase().includes('name') ||
    col.toLowerCase().includes('incident') ||
    col.toLowerCase().includes('summary')
  );

  // Calculate summary statistics
  const totalIncidents = incidentData.data.length;
  const criticalIncidents = severityColumn 
    ? incidentData.data.filter(inc => 
        String(inc[severityColumn] || '').toLowerCase().includes('critical') ||
        String(inc[severityColumn] || '').toLowerCase().includes('p0') ||
        String(inc[severityColumn] || '').toLowerCase().includes('sev1')
      ).length
    : 0;
  const resolvedIncidents = statusColumn
    ? incidentData.data.filter(inc => 
        String(inc[statusColumn] || '').toLowerCase().includes('resolved') ||
        String(inc[statusColumn] || '').toLowerCase().includes('closed')
      ).length
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <AlertTriangle className="h-6 w-6 mr-2 text-orange-500" />
            HRP 6-Month Incidents
          </h2>
          {incidentData.view_info?.name && (
            <p className="text-sm text-gray-600 mt-1">
              View: {incidentData.view_info.name}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={fetchIncidentData}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              Updated: {lastUpdated}
            </span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Incidents</p>
              <p className="text-2xl font-bold text-gray-900">{totalIncidents}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Critical</p>
              <p className="text-2xl font-bold text-red-600">{criticalIncidents}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Resolved</p>
              <p className="text-2xl font-bold text-green-600">{resolvedIncidents}</p>
            </div>
            <Calendar className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Resolution Rate</p>
              <p className="text-2xl font-bold text-purple-600">
                {totalIncidents > 0 ? ((resolvedIncidents / totalIncidents) * 100).toFixed(1) : 0}%
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Incident Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Incident Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {titleColumn && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>}
                {dateColumn && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>}
                {severityColumn && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>}
                {statusColumn && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>}
                {!titleColumn && !dateColumn && !severityColumn && !statusColumn && (
                  columns.slice(0, 5).map(col => (
                    <th key={col} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {col}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {incidentData.data.slice(0, 100).map((incident, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  {titleColumn && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {String(incident[titleColumn] || 'N/A')}
                    </td>
                  )}
                  {dateColumn && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(String(incident[dateColumn] || ''))}
                    </td>
                  )}
                  {severityColumn && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded border ${getSeverityColor(String(incident[severityColumn] || ''))}`}>
                        {String(incident[severityColumn] || 'N/A')}
                      </span>
                    </td>
                  )}
                  {statusColumn && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(String(incident[statusColumn] || ''))}`}>
                        {String(incident[statusColumn] || 'N/A')}
                      </span>
                    </td>
                  )}
                  {!titleColumn && !dateColumn && !severityColumn && !statusColumn && (
                    columns.slice(0, 5).map(col => (
                      <td key={col} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {String(incident[col] || 'N/A')}
                      </td>
                    ))
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {incidentData.data.length > 100 && (
          <div className="p-4 bg-gray-50 text-center text-sm text-gray-600">
            Showing first 100 of {incidentData.data.length} incidents
          </div>
        )}
      </div>

      {/* Link to Tableau Dashboard */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">View Full Dashboard</h4>
            <p className="text-sm text-blue-700">
              Access the complete incident dashboard in Tableau for detailed analysis
            </p>
          </div>
          <a
            href="https://prod-uswest-c.online.tableau.com/#/site/salesforce/views/Eng360Availability/Availability-Incidents/d8a61d1c-39d5-4d6a-aeff-108cf9fa6eda/HRP6-MonthIncidents"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Open in Tableau</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default IncidentView;




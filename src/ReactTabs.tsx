// React Tabs Entry Point - Embedded in existing HTML dashboard
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Server, DollarSign, Settings, Activity, AlertCircle } from 'lucide-react';
import RuntimeScaleHPA from './components/RuntimeScaleHPA';
import IncidentView from './components/IncidentView';
import HCPCostAnalysis from './components/HCPCostAnalysis';
import HCPCTSProgram from './components/HCPCTSProgram';
import AvailabilityExecView from './components/AvailabilityExecView';
import './index.css';

// Mock/Static data loader for GitHub Pages
const loadDashboardData = async () => {
  try {
    const response = await fetch('/assets/data/dashboard-data.json');
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn('Could not load dashboard-data.json, using mock data');
  }
  
  // Fallback mock data
  return {
    hrpAdoption: {
      totalServices: 3420,
      fullyMigratedMesh: 1250,
      fullyMigrated: 580,
      inProgressPartly: 420
    },
    runtime: {
      autoscaling: {
        hpaAdoptionRate: 68.43,
        totalServices: 605,
        servicesWithHPA: 414,
        avgResponseTime: 145,
        scalingEvents: 1234
      },
      vpa: {
        adoptionRate: 45.2,
        totalServices: 605,
        servicesWithVPA: 273
      },
      karpenter: {
        clustersEnabled: 12,
        totalClusters: 25,
        rolloutPercentage: 48.0
      },
      multiaz: {
        servicesMultiAZ: 520,
        totalServices: 605,
        coveragePercentage: 85.95
      }
    },
    platformCost: {
      current: 10792328,
      previousMonth: 10234567,
      growth: 5.4,
      savings: {
        vpa: 450000,
        spotInstances: 890000,
        rightSizing: 320000,
        total: 1660000
      },
      projectedSavings: {
        aiScaling: 1200000,
        storageTiering: 800000,
        total: 2000000
      }
    }
  };
};

const loadCTSData = async () => {
  try {
    const response = await fetch('/assets/data/cts-data.json');
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn('Could not load cts-data.json, using mock data');
  }
  
  return {
    summary: {
      totalCost: 10792328,
      savings: 2345678,
      projectedSavings: 3456789,
      costIncrease: 567890
    }
  };
};

// Main React Tabs Component
const ReactTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('runtime-overview');
  const [data, setData] = useState<any>(null);
  const [ctsData, setCtsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const [dashboardData, ctsDataResponse] = await Promise.all([
        loadDashboardData(),
        loadCTSData()
      ]);
      setData(dashboardData);
      setCtsData(ctsDataResponse);
      setLoading(false);
    };
    loadData();
  }, []);

  // Listen for tab changes from the HTML dashboard
  useEffect(() => {
    const container = document.getElementById('react-tabs-container');
    if (container) {
      const observer = new MutationObserver(() => {
        const tabId = container.getAttribute('data-active-tab');
        if (tabId && tabId !== activeTab) {
          setActiveTab(tabId);
        }
      });
      
      observer.observe(container, {
        attributes: true,
        attributeFilter: ['data-active-tab']
      });
      
      // Also listen for direct updates
      const checkTab = () => {
        const tabId = container.getAttribute('data-active-tab');
        if (tabId && tabId !== activeTab) {
          setActiveTab(tabId);
        }
      };
      
      const interval = setInterval(checkTab, 100);
      
      return () => {
        observer.disconnect();
        clearInterval(interval);
      };
    }
  }, [activeTab]);

  // Expose update function to window for HTML dashboard
  useEffect(() => {
    (window as any).updateReactTab = (tabId: string) => {
      setActiveTab(tabId);
      const container = document.getElementById('react-tabs-container');
      if (container) {
        container.setAttribute('data-active-tab', tabId);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'runtime-overview':
        return (
          <div className="react-tab-content" style={{ width: '100%', padding: '0' }}>
            <div className="tab-header" style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>📊 Autoscaling Overview</h2>
              <p style={{ color: '#666', fontSize: '14px' }}>Monitor autoscaling effectiveness, VPA adoption, and availability metrics</p>
            </div>
            <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              <div className="metric-card" style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>HPA Adoption Rate</h3>
                <p className="metric-value" style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb' }}>
                  {data?.runtime?.autoscaling?.hpaAdoptionRate || 68.43}%
                </p>
              </div>
              <div className="metric-card" style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>Total Services</h3>
                <p className="metric-value" style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb' }}>
                  {data?.runtime?.autoscaling?.totalServices || 605}
                </p>
              </div>
              <div className="metric-card" style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>VPA Adoption</h3>
                <p className="metric-value" style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb' }}>
                  {data?.runtime?.vpa?.adoptionRate || 45.2}%
                </p>
              </div>
              <div className="metric-card" style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>Multi-AZ Coverage</h3>
                <p className="metric-value" style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb' }}>
                  {data?.runtime?.multiaz?.coveragePercentage || 85.95}%
                </p>
              </div>
            </div>
          </div>
        );

      case 'runtime-hpa':
        return (
          <div className="react-tab-content" style={{ width: '100%', padding: '0' }}>
            <RuntimeScaleHPA />
          </div>
        );

      case 'runtime-incidents':
        return (
          <div className="react-tab-content" style={{ width: '100%', padding: '0' }}>
            <IncidentView />
          </div>
        );

      case 'runtime-multiaz':
        return (
          <div className="react-tab-content" style={{ width: '100%', padding: '0' }}>
            <div className="tab-header" style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>🌐 Multi-AZ Coverage</h2>
              <p style={{ color: '#666', fontSize: '14px' }}>Multi-availability zone deployment status across services</p>
            </div>
            <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              <div className="metric-card" style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>Multi-AZ Services</h3>
                <p className="metric-value" style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb' }}>
                  {data?.runtime?.multiaz?.servicesMultiAZ || 520}
                </p>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  of {data?.runtime?.multiaz?.totalServices || 605} total
                </p>
              </div>
              <div className="metric-card" style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>Coverage Percentage</h3>
                <p className="metric-value" style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb' }}>
                  {data?.runtime?.multiaz?.coveragePercentage || 85.95}%
                </p>
              </div>
            </div>
          </div>
        );

      case 'runtime-karpenter':
        return (
          <div className="react-tab-content" style={{ width: '100%', padding: '0' }}>
            <div className="tab-header" style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>🚀 Karpenter Rollout</h2>
              <p style={{ color: '#666', fontSize: '14px' }}>Karpenter cluster autoscaling rollout progress</p>
            </div>
            <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              <div className="metric-card" style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>Clusters Enabled</h3>
                <p className="metric-value" style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb' }}>
                  {data?.runtime?.karpenter?.clustersEnabled || 12}
                </p>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  of {data?.runtime?.karpenter?.totalClusters || 25} total
                </p>
              </div>
              <div className="metric-card" style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>Rollout Percentage</h3>
                <p className="metric-value" style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb' }}>
                  {data?.runtime?.karpenter?.rolloutPercentage || 48.0}%
                </p>
              </div>
            </div>
          </div>
        );

      case 'cost-overview':
        return (
          <div className="react-tab-content" style={{ width: '100%', padding: '0' }}>
            <div className="tab-header" style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>💰 Cost to Serve - Overview</h2>
              <p style={{ color: '#666', fontSize: '14px' }}>Platform cost analysis and optimization opportunities</p>
            </div>
            <HCPCostAnalysis selectedMonth="" view="executive" />
          </div>
        );

      case 'cost-hcp':
        return (
          <div className="react-tab-content" style={{ width: '100%', padding: '0' }}>
            <HCPCTSProgram />
          </div>
        );

      case 'selfserve-overview':
        return (
          <div className="react-tab-content" style={{ width: '100%', padding: '0' }}>
            <div className="tab-header" style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>🛠️ Self Serve</h2>
              <p style={{ color: '#666', fontSize: '14px' }}>Self-service tools and resources for platform management</p>
            </div>
            <div style={{ padding: '40px', textAlign: 'center', background: 'white', borderRadius: '8px' }}>
              <Settings style={{ width: '64px', height: '64px', color: '#9ca3af', margin: '0 auto 20px' }} />
              <h3 style={{ fontSize: '20px', marginBottom: '10px' }}>Self-Serve Tools</h3>
              <p style={{ color: '#666', marginBottom: '20px' }}>
                Self-service tools and documentation coming soon...
              </p>
            </div>
          </div>
        );

      case 'availability-exec':
        return (
          <div className="react-tab-content" style={{ width: '100%', padding: '0' }}>
            <AvailabilityExecView />
          </div>
        );

      default:
        return (
          <div className="react-tab-content" style={{ width: '100%', padding: '0' }}>
            <p>Select a tab from the sidebar</p>
          </div>
        );
    }
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {renderTabContent()}
    </div>
  );
};

// Initialize React tabs
export const initReactTabs = () => {
  const container = document.getElementById('react-tabs-container');
  if (container) {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <ReactTabs />
      </React.StrictMode>
    );
    console.log('✅ React tabs initialized');
  } else {
    console.warn('⚠️ React tabs container not found');
  }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReactTabs);
} else {
  initReactTabs();
}


import React from 'react';
import { Trophy, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface ServiceData {
  serviceName: string;
  srExec: string;
  engManager: string;
  serviceTier: string;
  hpaScore?: number;
  azScore?: number;
}

interface HeatMapViewProps {
  hpaAchievers: ServiceData[];
  hpaOffenders: ServiceData[];
  azAchievers: ServiceData[];
  azOffenders: ServiceData[];
}

const HeatMapView: React.FC<HeatMapViewProps> = ({ 
  hpaAchievers, 
  hpaOffenders, 
  azAchievers, 
  azOffenders 
}) => {
  const getHeatMapColor = (score: number, type: 'achiever' | 'offender') => {
    if (type === 'achiever') {
      if (score >= 90) return 'bg-green-600 text-white';
      if (score >= 80) return 'bg-green-500 text-white';
      if (score >= 70) return 'bg-green-400 text-white';
      return 'bg-green-300 text-gray-900';
    } else {
      if (score <= 10) return 'bg-red-600 text-white';
      if (score <= 20) return 'bg-red-500 text-white';
      if (score <= 30) return 'bg-red-400 text-white';
      return 'bg-red-300 text-gray-900';
    }
  };

  const HeatMapCard = ({ 
    title, 
    data, 
    type, 
    scoreKey, 
    icon 
  }: { 
    title: string; 
    data: ServiceData[]; 
    type: 'achiever' | 'offender';
    scoreKey: 'hpaScore' | 'azScore';
    icon: React.ReactNode;
  }) => (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          {icon}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600">
              {type === 'achiever' ? 'Highest performing services' : 'Services needing attention'}
            </p>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 gap-2">
          {data.map((service, index) => {
            const score = service[scoreKey] || 0;
            return (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg border hover:shadow-sm transition-shadow">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {service.serviceName}
                      </h4>
                      <div className="text-xs text-gray-500 mt-1">
                        <span className="inline-block mr-3">
                          Sr Exec: <span className="font-medium">{service.srExec}</span>
                        </span>
                        <span className="inline-block mr-3">
                          Tier: <span className="font-medium">{service.serviceTier}</span>
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Eng Manager: <span className="font-medium">{service.engManager}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 ml-4">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${getHeatMapColor(score, type)}`}>
                    {score.toFixed(1)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Performance Heat Maps</h2>
        <p className="text-gray-600">Top 10 achievers and services needing attention</p>
      </div>

      {/* HPA Heat Maps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HeatMapCard
          title="HPA Top Achievers"
          data={hpaAchievers}
          type="achiever"
          scoreKey="hpaScore"
          icon={<Trophy className="h-5 w-5 text-green-600" />}
        />
        
        <HeatMapCard
          title="HPA Needs Attention"
          data={hpaOffenders}
          type="offender"
          scoreKey="hpaScore"
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
        />
      </div>

      {/* AZ Distribution Heat Maps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HeatMapCard
          title="AZ Distribution Top Achievers"
          data={azAchievers}
          type="achiever"
          scoreKey="azScore"
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
        />
        
        <HeatMapCard
          title="AZ Distribution Needs Attention"
          data={azOffenders}
          type="offender"
          scoreKey="azScore"
          icon={<TrendingDown className="h-5 w-5 text-red-600" />}
        />
      </div>

      {/* Summary Statistics */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-green-800 font-semibold">HPA Champion</div>
            <div className="text-sm text-green-600 mt-1">
              {hpaAchievers[0]?.serviceName || 'N/A'}
            </div>
            <div className="text-xs text-green-500 mt-1">
              {hpaAchievers[0]?.hpaScore?.toFixed(1) || 0}% HPA Score
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-blue-800 font-semibold">AZ Champion</div>
            <div className="text-sm text-blue-600 mt-1">
              {azAchievers[0]?.serviceName || 'N/A'}
            </div>
            <div className="text-xs text-blue-500 mt-1">
              {azAchievers[0]?.azScore?.toFixed(1) || 0}% AZ Score
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-yellow-800 font-semibold">HPA Priority</div>
            <div className="text-sm text-yellow-600 mt-1">
              {hpaOffenders[0]?.serviceName || 'N/A'}
            </div>
            <div className="text-xs text-yellow-500 mt-1">
              {hpaOffenders[0]?.hpaScore?.toFixed(1) || 0}% HPA Score
            </div>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-800 font-semibold">AZ Priority</div>
            <div className="text-sm text-red-600 mt-1">
              {azOffenders[0]?.serviceName || 'N/A'}
            </div>
            <div className="text-xs text-red-500 mt-1">
              {azOffenders[0]?.azScore?.toFixed(1) || 0}% AZ Score
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeatMapView;

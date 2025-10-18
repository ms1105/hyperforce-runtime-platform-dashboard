import React, { useState } from 'react';
import { CheckCircle, Clock, Play, ArrowRight, Calendar } from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  timeEstimate: string;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
}

interface OnboardingRecord {
  id: string;
  serviceName: string;
  startDate: string;
  currentStep: string;
  status: 'active' | 'completed' | 'cancelled';
  completedSteps: string[];
}

const FKPOnboardingWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const [clusterExists, setClusterExists] = useState<boolean | null>(null);
  const [serviceName, setServiceName] = useState('');
  const [functionalDomain, setFunctionalDomain] = useState('');
  const [onboardingRecords, setOnboardingRecords] = useState<OnboardingRecord[]>([]);
  const [showRecords, setShowRecords] = useState(false);

  const steps: OnboardingStep[] = [
    {
      id: 'check-availability',
      title: 'Check FKP Cluster Availability',
      description: 'Verify if an FKP cluster exists in your Functional Domain',
      timeEstimate: '30 minutes',
      status: 'pending'
    },
    {
      id: 'choose-path',
      title: 'Choose Your Path',
      description: 'Select onboarding approach based on cluster availability',
      timeEstimate: '5 minutes',
      status: 'pending'
    },
    {
      id: 'check-eligibility',
      title: 'Check Eligibility',
      description: 'Ensure your service is Kubernetes-based and meets requirements',
      timeEstimate: '2 hours',
      status: 'pending'
    },
    {
      id: 'request-cluster',
      title: 'Request FKP Cluster',
      description: 'Submit request via Falcon Onboarding Page (if needed)',
      timeEstimate: '12 hours',
      status: 'pending'
    },
    {
      id: 'pre-execution',
      title: 'Pre-Execution Tasks',
      description: 'Enter FIREBom details, configure VMF, assign security groups',
      timeEstimate: '30 minutes',
      status: 'pending'
    },
    {
      id: 'onboard-service',
      title: 'Onboard Service to FKP',
      description: 'Create FIRE BOM Service Team/Definition, map to FD/cluster',
      timeEstimate: '7 hours',
      status: 'pending'
    },
    {
      id: 'build-configure',
      title: 'Build and Configure Service',
      description: 'Specify goal state shards, complete mappings',
      timeEstimate: '30 minutes',
      status: 'pending'
    },
    {
      id: 'pipeline-verification',
      title: 'Spinnaker Pipeline Verification',
      description: 'Ensure pipeline setup is correct',
      timeEstimate: '30 minutes',
      status: 'pending'
    },
    {
      id: 'deployment',
      title: 'Service Deployment',
      description: 'Deploy via configured Spinnaker pipeline',
      timeEstimate: '7 hours',
      status: 'pending'
    }
  ];

  const handleStartOnboarding = () => {
    if (!serviceName.trim() || !functionalDomain.trim()) {
      alert('Please enter service name and functional domain');
      return;
    }
    setIsStarted(true);
    setCurrentStep(0);
  };

  const handleStepAction = (stepId: string) => {
    // For check-availability step, require cluster selection
    if (stepId === 'check-availability' && clusterExists === null) {
      alert('Please select whether an FKP cluster exists in your Functional Domain');
      return;
    }
    
    // Skip request-cluster step if cluster exists
    const currentStepIndex = steps.findIndex(s => s.id === stepId);
    let nextStepIndex = currentStepIndex + 1;
    
    // If cluster exists, skip the "request-cluster" step
    if (stepId === 'choose-path' && clusterExists === true) {
      // Find and skip request-cluster step
      const requestStepIndex = steps.findIndex(s => s.id === 'request-cluster');
      if (nextStepIndex === requestStepIndex) {
        nextStepIndex = requestStepIndex + 1;
      }
    }

    // Move to next step or complete
    if (nextStepIndex < steps.length) {
      setCurrentStep(nextStepIndex);
    } else {
      // Complete onboarding
      const newRecord: OnboardingRecord = {
        id: Date.now().toString(),
        serviceName,
        startDate: new Date().toISOString(),
        currentStep: 'completed',
        status: 'completed',
        completedSteps: steps.slice(0, currentStepIndex + 1).map(s => s.id)
      };
      setOnboardingRecords([...onboardingRecords, newRecord]);
      alert('🎉 FKP Onboarding Complete! Your service has been successfully onboarded.');
      setIsStarted(false);
      setCurrentStep(0);
      setServiceName('');
      setFunctionalDomain('');
      setClusterExists(null);
    }
  };

  const getStepStatus = (stepIndex: number): 'pending' | 'current' | 'completed' => {
    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep) return 'current';
    return 'pending';
  };

  if (!isStarted) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">🚀 FKP Onboarding Wizard</h3>
          <p className="text-gray-600">Interactive guide to onboard your service to Falcon Kubernetes Platform</p>
        </div>

        {/* Service Information Form */}
        <div className="max-w-md mx-auto space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Name</label>
            <input
              type="text"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your service name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Functional Domain</label>
            <input
              type="text"
              value={functionalDomain}
              onChange={(e) => setFunctionalDomain(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your functional domain"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="text-center space-y-4">
          <button
            onClick={handleStartOnboarding}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold flex items-center gap-2 mx-auto transition-colors"
          >
            <Play className="h-5 w-5" />
            Start FKP Onboarding
          </button>

          <button
            onClick={() => setShowRecords(!showRecords)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium flex items-center gap-2 mx-auto transition-colors"
          >
            <Calendar className="h-4 w-4" />
            View Onboarding Records ({onboardingRecords.length})
          </button>
        </div>

        {/* Onboarding Records */}
        {showRecords && onboardingRecords.length > 0 && (
          <div className="mt-6 border-t pt-6">
            <h4 className="font-semibold text-gray-900 mb-4">Previous Onboarding Records</h4>
            <div className="space-y-3">
              {onboardingRecords.map((record) => (
                <div key={record.id} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-gray-900">{record.serviceName}</h5>
                      <p className="text-sm text-gray-600">Started: {new Date(record.startDate).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        record.status === 'completed' ? 'bg-green-100 text-green-800' :
                        record.status === 'active' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {record.status}
                      </span>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">FKP Onboarding Progress</h3>
        <p className="text-gray-600">Service: <span className="font-medium">{serviceName}</span> | FD: <span className="font-medium">{functionalDomain}</span></p>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>{currentStep + 1} of {steps.length} steps</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Current Step */}
      <div className="mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold">
              {currentStep + 1}
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">{steps[currentStep].title}</h4>
              <p className="text-gray-700 mb-3">{steps[currentStep].description}</p>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                <Clock className="h-4 w-4" />
                <span>Estimated time: {steps[currentStep].timeEstimate}</span>
              </div>

              {/* Special handling for cluster availability step */}
              {steps[currentStep].id === 'check-availability' && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded border border-gray-200">
                    <p className="text-sm text-gray-700 mb-3">Do you have an existing FKP cluster in your Functional Domain?</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setClusterExists(true)}
                        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                          clusterExists === true ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        ✅ Yes, cluster exists
                      </button>
                      <button
                        onClick={() => setClusterExists(false)}
                        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                          clusterExists === false ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        📝 No, need new cluster
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Special handling for choose path step */}
              {steps[currentStep].id === 'choose-path' && clusterExists !== null && (
                <div className="bg-white p-4 rounded border border-gray-200">
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    {clusterExists ? '✅ Existing Cluster Path' : '📝 New Cluster Path'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {clusterExists 
                      ? 'You will follow the standard onboarding process for existing clusters.'
                      : 'You will need to submit a new FKP cluster request first. This may take additional time for approval.'
                    }
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => handleStepAction(steps[currentStep].id)}
                  disabled={steps[currentStep].id === 'check-availability' && clusterExists === null}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                  <CheckCircle className="h-4 w-4" />
                  Complete Step
                  <ArrowRight className="h-4 w-4" />
                </button>
                
                <button
                  onClick={() => {
                    setIsStarted(false);
                    setCurrentStep(0);
                    setClusterExists(null);
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Steps Overview */}
      <div className="border-t pt-6">
        <h4 className="font-semibold text-gray-900 mb-4">All Steps Overview</h4>
        <div className="space-y-2">
          {steps.map((step, index) => {
            const status = getStepStatus(index);
            return (
              <div key={step.id} className={`flex items-center gap-3 p-3 rounded-lg ${
                status === 'current' ? 'bg-blue-50 border border-blue-200' :
                status === 'completed' ? 'bg-green-50 border border-green-200' :
                'bg-gray-50 border border-gray-200'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  status === 'completed' ? 'bg-green-600 text-white' :
                  status === 'current' ? 'bg-blue-600 text-white' :
                  'bg-gray-300 text-gray-600'
                }`}>
                  {status === 'completed' ? <CheckCircle className="h-4 w-4" /> : index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${
                      status === 'current' ? 'text-blue-900' :
                      status === 'completed' ? 'text-green-900' :
                      'text-gray-700'
                    }`}>
                      {step.title}
                    </span>
                    <span className="text-xs text-gray-500">{step.timeEstimate}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FKPOnboardingWizard;

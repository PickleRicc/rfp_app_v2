'use client';

import React from 'react';

interface ComplianceTrackerProps {
  coveragePercent: number;
  responseId: string;
}

/**
 * Compliance Tracker Component
 * Shows requirements coverage percentage and provides access to compliance matrix
 */
export function ComplianceTracker({ coveragePercent, responseId }: ComplianceTrackerProps) {
  const [showDetails, setShowDetails] = React.useState(false);
  const [complianceData, setComplianceData] = React.useState<any>(null);

  const loadComplianceDetails = async () => {
    try {
      const res = await fetch(`/api/proposals/${responseId}/compliance`);
      const data = await res.json();
      setComplianceData(data);
      setShowDetails(true);
    } catch (error) {
      console.error('Error loading compliance details:', error);
    }
  };

  const downloadMatrix = async () => {
    try {
      const res = await fetch(`/api/proposals/${responseId}/compliance/download`, {
        method: 'POST',
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-matrix-${responseId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading compliance matrix:', error);
    }
  };

  const getColorClass = (percent: number) => {
    if (percent >= 100) return 'bg-green-500';
    if (percent >= 75) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Requirements Coverage
      </h3>

      {/* Progress bar */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <div className="bg-gray-200 rounded-full h-6 overflow-hidden">
            <div
              className={`${getColorClass(coveragePercent)} h-full transition-all duration-500 flex items-center justify-center text-white text-sm font-medium`}
              style={{ width: `${coveragePercent}%` }}
            >
              {coveragePercent >= 20 && `${coveragePercent}%`}
            </div>
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {coveragePercent}%
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={loadComplianceDetails}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          View Details
        </button>
        <button
          onClick={downloadMatrix}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          Download Matrix
        </button>
      </div>

      {/* Details panel */}
      {showDetails && complianceData && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3">Breakdown by Category</h4>
          <div className="space-y-2">
            {Object.entries(complianceData.breakdown.by_category || {}).map(
              ([category, stats]: [string, any]) => (
                <div key={category} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 capitalize">
                    {category.replace('_', ' ')}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {stats.addressed} / {stats.total}
                  </span>
                </div>
              )
            )}
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Total Requirements:</span>
              <span className="font-semibold">{complianceData.breakdown.total}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-700">Addressed:</span>
              <span className="font-semibold text-green-600">{complianceData.breakdown.addressed}</span>
            </div>
            {complianceData.breakdown.not_addressed > 0 && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-700">Not Addressed:</span>
                <span className="font-semibold text-red-600">{complianceData.breakdown.not_addressed}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

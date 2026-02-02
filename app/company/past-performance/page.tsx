'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface PastPerformance {
  id: string;
  contract_nickname: string;
  client_agency: string;
  contract_value: number;
  role: string;
  start_date: string;
  end_date: string;
}

export default function PastPerformanceList() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<PastPerformance[]>([]);

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      const response = await fetch('/api/company/past-performance');
      const data = await response.json();
      setContracts(data.contracts || []);
    } catch (error) {
      console.error('Error fetching contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contract?')) return;

    try {
      await fetch(`/api/company/past-performance/${id}`, {
        method: 'DELETE',
      });
      fetchContracts();
    } catch (error) {
      console.error('Error deleting contract:', error);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <a href="/company" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Dashboard
        </a>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">Past Performance</h1>
            <p className="text-gray-600">Contract history and achievements</p>
          </div>
          <button
            onClick={() => router.push('/company/past-performance/new')}
            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 font-semibold"
          >
            + Add Contract
          </button>
        </div>
      </div>

      {contracts.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-bold mb-4">No Past Performance Yet</h2>
          <p className="text-gray-600 mb-6">
            Add at least 3 past performance contracts to generate competitive proposals.
            Most RFPs require 3+ references.
          </p>
          <button
            onClick={() => router.push('/company/past-performance/new')}
            className="bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 font-semibold"
          >
            Add Your First Contract
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {contracts.map((contract) => (
            <div key={contract.id} className="bg-white shadow-md rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">{contract.contract_nickname}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Agency:</span>
                      <p className="font-medium">{contract.client_agency}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Value:</span>
                      <p className="font-medium">${contract.contract_value.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Role:</span>
                      <p className="font-medium">{contract.role}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Period:</span>
                      <p className="font-medium">
                        {new Date(contract.start_date).getFullYear()} - {contract.end_date === 'Ongoing' ? 'Ongoing' : new Date(contract.end_date).getFullYear()}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => router.push(`/company/past-performance/${contract.id}`)}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(contract.id)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}

          {contracts.length < 3 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">
                <strong>Tip:</strong> Add {3 - contracts.length} more contract{3 - contracts.length > 1 ? 's' : ''} to meet the typical RFP requirement of 3+ past performance references.
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

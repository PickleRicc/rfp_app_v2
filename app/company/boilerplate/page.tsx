'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/lib/context/CompanyContext';
import { useFetchWithCompany } from '@/lib/hooks/useFetchWithCompany';

interface Boilerplate {
  id: string;
  type: string;
  variant?: string;
  content: string;
}

export default function BoilerplatePage() {
  const router = useRouter();
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { fetchWithCompany } = useFetchWithCompany();
  const [loading, setLoading] = useState(true);
  const [boilerplate, setBoilerplate] = useState<Boilerplate[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: '',
    variant: '',
    content: '',
  });

  useEffect(() => {
    if (selectedCompanyId) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetchWithCompany('/api/company/boilerplate');
      const data = await response.json();
      setBoilerplate(data.boilerplate || []);
    } catch (error) {
      console.error('Error fetching boilerplate:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        // Update existing
        await fetchWithCompany(`/api/company/boilerplate/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        // Create new
        await fetchWithCompany('/api/company/boilerplate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }
      
      setShowAddForm(false);
      setEditingId(null);
      setFormData({ type: '', variant: '', content: '' });
      fetchData();
    } catch (error) {
      console.error('Error saving boilerplate:', error);
    }
  };

  const handleEdit = (item: Boilerplate) => {
    setFormData({
      type: item.type,
      variant: item.variant || '',
      content: item.content,
    });
    setEditingId(item.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this boilerplate text?')) return;

    try {
      await fetchWithCompany(`/api/company/boilerplate/${id}`, {
        method: 'DELETE',
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting boilerplate:', error);
    }
  };

  const boilerplateTypes = [
    'company_intro',
    'small_business_statement',
    'teaming_statement',
    'quality_approach',
    'risk_management_approach',
    'communication_approach',
    'transition_approach',
    'staffing_approach',
    'compliance_statement',
    'proposal_closing',
    'cover_letter_closing',
  ];

  const variants = ['short', 'medium', 'long'];

  // Group boilerplate by type
  const groupedBoilerplate = boilerplate.reduce((acc, item) => {
    if (!acc[item.type]) {
      acc[item.type] = [];
    }
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, Boilerplate[]>);

  if (!selectedCompany) {
    return (
      <main className="min-h-screen p-8 max-w-6xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold text-yellow-900 mb-1">No Company Selected</h3>
          <p className="text-sm text-yellow-800">
            Please select a company from the header to manage boilerplate.
          </p>
        </div>
      </main>
    );
  }

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
            <h1 className="text-4xl font-bold mb-2">Boilerplate Library</h1>
            <p className="text-gray-600">Reusable text blocks for proposals</p>
          </div>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              if (showAddForm) {
                setEditingId(null);
                setFormData({ type: '', variant: '', content: '' });
              }
            }}
            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 font-semibold"
          >
            {showAddForm ? 'Cancel' : '+ Add Boilerplate'}
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">
            {editingId ? 'Edit Boilerplate' : 'Add Boilerplate'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type *
                </label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select type</option>
                  {boilerplateTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Variant
                </label>
                <select
                  value={formData.variant}
                  onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None</option>
                  {variants.map((variant) => (
                    <option key={variant} value={variant}>
                      {variant.charAt(0).toUpperCase() + variant.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content *
              </label>
              <textarea
                required
                rows={10}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="Enter your boilerplate text here..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.content.length} characters
              </p>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
              >
                {editingId ? 'Update Boilerplate' : 'Add Boilerplate'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingId(null);
                  setFormData({ type: '', variant: '', content: '' });
                }}
                className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Boilerplate List */}
      {boilerplate.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">📝</div>
          <h2 className="text-2xl font-bold mb-4">No Boilerplate Yet</h2>
          <p className="text-gray-600 mb-6">
            Add reusable text blocks for common proposal sections like company introductions,
            quality approaches, transition plans, and more.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.keys(groupedBoilerplate).sort().map((type) => (
            <div key={type} className="bg-white shadow-md rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">
                {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </h3>
              
              <div className="space-y-4">
                {groupedBoilerplate[type].map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <h4 className="font-medium">
                          {item.variant ? (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                              {item.variant.toUpperCase()}
                            </span>
                          ) : (
                            <span className="text-gray-500 text-sm">Default</span>
                          )}
                        </h4>
                        <span className="text-sm text-gray-500">
                          {item.content.length} characters
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded p-4 max-h-40 overflow-y-auto">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                        {item.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tips */}
      {boilerplate.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-900">
            <strong>Tip:</strong> Organize your boilerplate by type and variant (short, medium, long)
            for easy reuse in proposals. Standard text blocks save time and ensure consistency.
          </p>
        </div>
      )}
    </main>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/lib/context/CompanyContext';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const { selectedCompany, selectedCompanyId } = useCompany();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    if (!selectedCompanyId) {
      setResult({ error: 'Please select a company first' });
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const headers = new Headers();
      headers.set('X-Company-Id', selectedCompanyId);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.document?.id) {
        // Redirect to results page
        router.push(`/results/${data.document.id}`);
      } else {
        setResult(data);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setResult({ error: 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto pt-4">
      <h1 className="text-4xl font-bold mb-4">RFP Analyzer</h1>
      {selectedCompany && (
        <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm font-medium text-blue-900">
            Processing for: {selectedCompany.company_name}
          </span>
        </div>
      )}

      {/* No Company Selected Warning */}
      {!selectedCompany && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">No Company Selected</h3>
              <p className="text-sm text-yellow-800">
                Please select a company from the header above before uploading an RFP document.
                The response will be generated using that company's data.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Upload Document</h2>
          <Link
            href="/documents"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            View All Documents →
          </Link>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select RFP Document
            </label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              accept=".txt,.pdf,.doc,.docx"
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
          </div>

          <button
            type="submit"
            disabled={!file || uploading || !selectedCompanyId}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {uploading ? 'Processing...' : !selectedCompanyId ? 'Select a Company First' : 'Upload and Analyze'}
          </button>
        </form>
      </div>

      {result && (
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Result</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>

          {result.success && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800">
                Document uploaded successfully! Processing has started.
              </p>
              <p className="text-sm text-green-600 mt-2">
                Document ID: {result.document.id}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
        <ol className="list-decimal list-inside space-y-2 text-blue-800">
          <li>Upload your RFP document</li>
          <li>Stage 0: Document is classified (RFP, proposal, contract, or other)</li>
          <li>Stage 1: If it's an RFP, 8 key sections are analyzed:
            <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
              <li>Executive Summary</li>
              <li>Project Scope</li>
              <li>Technical Requirements</li>
              <li>Timeline and Milestones</li>
              <li>Budget and Pricing</li>
              <li>Evaluation Criteria</li>
              <li>Submission Requirements</li>
              <li>Key Stakeholders</li>
            </ul>
          </li>
          <li>Results are saved to the database for review</li>
          <li>Generate a complete proposal from analyzed RFPs</li>
        </ol>
      </div>

      <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="font-semibold text-green-900 mb-2">💡 Pro Tip:</h3>
        <p className="text-green-800">
          All uploaded documents are saved. Visit the{' '}
          <Link href="/documents" className="font-semibold underline hover:text-green-900">
            Documents page
          </Link>
          {' '}to view previous analyses and generate proposals without re-uploading.
        </p>
      </div>
    </main>
  );
}

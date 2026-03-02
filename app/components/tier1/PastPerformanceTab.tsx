'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFetchWithCompany } from '@/lib/hooks/useFetchWithCompany';
import type { PastPerformance } from '@/lib/supabase/company-types';
import {
  Upload,
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react';

type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;

interface PastPerformanceTabProps {
  companyId: string;
  onSaved: () => void;
  fetchFn?: FetchFn;
}

const EMPTY_FORM = {
  contract_nickname: '',
  contract_name: '',
  contract_number: '',
  task_order_number: '',
  client_agency: '',
  client_office: '',
  contract_type: 'FFP' as 'FFP' | 'T&M' | 'Cost-Plus' | 'Labor Hour' | 'Hybrid',
  contract_value: 0,
  annual_value: 0,
  start_date: '',
  end_date: '',
  base_period: '',
  option_periods: 0,
  role: 'Prime' as 'Prime' | 'Subcontractor' | 'Joint Venture' | 'Teaming Partner',
  percentage_of_work: 100,
  prime_contractor: '',
  team_size: 1,
  place_of_performance: '',
  client_poc: { name: '', title: '', phone: '', email: '' },
  overview: '',
  description_of_effort: '',
  task_areas: [] as string[],
  tools_used: [] as string[],
  achievements: [{ statement: '', metric_value: '', metric_type: 'Quality Improvement' }] as { statement: string; metric_value: string; metric_type: string }[],
  relevance_tags: [] as string[],
};

type FormData = typeof EMPTY_FORM;

export function PastPerformanceTab({ companyId, onSaved, fetchFn }: PastPerformanceTabProps) {
  const { fetchWithCompany } = useFetchWithCompany();
  const doFetch: FetchFn = fetchFn || fetchWithCompany;

  const [contracts, setContracts] = useState<PastPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormData>(EMPTY_FORM);

  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState<FormData>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tagInput, setTagInput] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [toolInput, setToolInput] = useState('');
  const [editTagInput, setEditTagInput] = useState('');
  const [editTaskInput, setEditTaskInput] = useState('');
  const [editToolInput, setEditToolInput] = useState('');

  const fetchContracts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await doFetch('/api/company/past-performance');
      const data = await res.json();
      setContracts(data.contracts || []);
    } catch (err) {
      console.error('Error fetching contracts:', err);
    } finally {
      setLoading(false);
    }
  }, [doFetch]);

  useEffect(() => {
    if (companyId) fetchContracts();
  }, [companyId, fetchContracts]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this past performance record?')) return;
    try {
      await doFetch(`/api/company/past-performance/${id}`, { method: 'DELETE' });
      setContracts((prev) => prev.filter((c) => c.id !== id));
      onSaved();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const startEdit = (contract: PastPerformance) => {
    setEditingId(contract.id);
    setExpandedId(contract.id);
    setEditForm({
      contract_nickname: contract.contract_nickname || '',
      contract_name: contract.contract_name || '',
      contract_number: contract.contract_number || '',
      task_order_number: contract.task_order_number || '',
      client_agency: contract.client_agency || '',
      client_office: contract.client_office || '',
      contract_type: contract.contract_type || 'FFP',
      contract_value: contract.contract_value || 0,
      annual_value: contract.annual_value || 0,
      start_date: contract.start_date || '',
      end_date: contract.end_date || '',
      base_period: contract.base_period || '',
      option_periods: contract.option_periods || 0,
      role: contract.role || 'Prime',
      percentage_of_work: contract.percentage_of_work || 100,
      prime_contractor: contract.prime_contractor || '',
      team_size: contract.team_size || 1,
      place_of_performance: contract.place_of_performance || '',
      client_poc: {
        name: contract.client_poc?.name || '',
        title: contract.client_poc?.title || '',
        phone: contract.client_poc?.phone || '',
        email: contract.client_poc?.email || '',
      },
      overview: contract.overview || '',
      description_of_effort: contract.description_of_effort || '',
      task_areas: contract.task_areas || [],
      tools_used: contract.tools_used || [],
      achievements: contract.achievements?.length ? contract.achievements : [{ statement: '', metric_value: '', metric_type: 'Quality Improvement' }],
      relevance_tags: contract.relevance_tags || [],
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await doFetch(`/api/company/past-performance/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error('Failed to update');
      const data = await res.json();
      setContracts((prev) => prev.map((c) => (c.id === editingId ? data.contract : c)));
      setEditingId(null);
      onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const res = await doFetch('/api/company/past-performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualForm),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      const data = await res.json();
      setContracts((prev) => [data.contract, ...prev]);
      setManualForm({ ...EMPTY_FORM });
      setShowManualForm(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    setUploading(true);
    setUploadError(null);
    setUploadStatus('Uploading file...');

    try {
      const fd = new FormData();
      fd.append('file', file);

      setUploadStatus('Uploading and extracting text...');

      const uploadUrl = fetchFn
        ? '/api/company/past-performance/upload'
        : '/api/company/past-performance/upload';

      const res = await doFetch(uploadUrl, {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      if (data.warning) {
        setUploadError(data.warning);
      } else {
        setUploadStatus('AI extracted records successfully!');
      }

      if (data.contracts?.length) {
        setContracts((prev) => [...data.contracts, ...prev]);
        onSaved();
      }

      setTimeout(() => setUploadStatus(null), 4000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
      setUploadStatus(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-6 py-6">
      {saveSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          Past performance record saved successfully.
        </div>
      )}

      {/* Upload Section */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">Upload Past Performance Documents</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Upload PDF or DOCX files containing past performance details. AI will automatically extract contract
          information and create records that you can review and edit.
        </p>

        <div
          className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            uploading ? 'border-blue-300 bg-blue-50/50' : 'border-border hover:border-primary/50 hover:bg-muted/30'
          }`}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleFileUpload(e.dataTransfer.files);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc"
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">{uploadStatus}</p>
              <p className="text-xs text-muted-foreground">This may take 15-30 seconds for AI processing...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Click to upload
                </button>
                <span className="text-sm text-muted-foreground"> or drag and drop</span>
              </div>
              <p className="text-xs text-muted-foreground">PDF, DOCX, or DOC (max 10MB)</p>
            </div>
          )}
        </div>

        {uploadStatus && !uploading && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            {uploadStatus}
          </div>
        )}
        {uploadError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            {uploadError}
          </div>
        )}
      </div>

      {/* Records List */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            Past Performance Records ({contracts.length})
          </h3>
          <button
            type="button"
            onClick={() => { setShowManualForm(!showManualForm); setEditingId(null); }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Manually
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No past performance records yet.</p>
            <p className="text-xs mt-1">Upload a document or add one manually to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contracts.map((contract) => (
              <div key={contract.id} className="rounded-lg border border-border overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
                  onClick={() => setExpandedId(expandedId === contract.id ? null : contract.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground truncate">
                        {contract.contract_nickname || contract.contract_name}
                      </h4>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {contract.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>{contract.client_agency}</span>
                      <span>{formatCurrency(contract.contract_value)}</span>
                      <span>{contract.start_date} – {contract.end_date}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); startEdit(contract); }}
                      className="p-1.5 rounded hover:bg-muted"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(contract.id); }}
                      className="p-1.5 rounded hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                    {expandedId === contract.id ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {expandedId === contract.id && (
                  <div className="border-t border-border p-4 bg-muted/10">
                    {editingId === contract.id ? (
                      <ContractForm
                        form={editForm}
                        setForm={setEditForm}
                        tagInput={editTagInput}
                        setTagInput={setEditTagInput}
                        taskInput={editTaskInput}
                        setTaskInput={setEditTaskInput}
                        toolInput={editToolInput}
                        setToolInput={setEditToolInput}
                        onSubmit={(e) => { e.preventDefault(); saveEdit(); }}
                        saving={saving}
                        error={saveError}
                        submitLabel="Save Changes"
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <ContractDetails contract={contract} />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Entry Form */}
      {showManualForm && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Add Past Performance Manually</h3>
            <button type="button" onClick={() => setShowManualForm(false)} className="p-1 rounded hover:bg-muted">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
          <ContractForm
            form={manualForm}
            setForm={setManualForm}
            tagInput={tagInput}
            setTagInput={setTagInput}
            taskInput={taskInput}
            setTaskInput={setTaskInput}
            toolInput={toolInput}
            setToolInput={setToolInput}
            onSubmit={handleManualSubmit}
            saving={saving}
            error={saveError}
            submitLabel="Save Past Performance"
          />
        </div>
      )}
    </div>
  );
}

function ContractDetails({ contract }: { contract: PastPerformance }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <Field label="Contract Name" value={contract.contract_name} />
      <Field label="Contract Number" value={contract.contract_number} />
      <Field label="Client Agency" value={contract.client_agency} />
      <Field label="Client Office" value={contract.client_office} />
      <Field label="Contract Type" value={contract.contract_type} />
      <Field label="Contract Value" value={`$${(contract.contract_value || 0).toLocaleString()}`} />
      <Field label="Period" value={`${contract.start_date} – ${contract.end_date}`} />
      <Field label="Team Size" value={String(contract.team_size)} />
      <Field label="Place of Performance" value={contract.place_of_performance} />
      <Field label="Role" value={`${contract.role}${contract.percentage_of_work ? ` (${contract.percentage_of_work}%)` : ''}`} />
      {contract.client_poc && (
        <Field label="Client POC" value={`${contract.client_poc.name}${contract.client_poc.email ? ` (${contract.client_poc.email})` : ''}`} />
      )}
      <div className="md:col-span-2">
        <Field label="Overview" value={contract.overview} />
      </div>
      <div className="md:col-span-2">
        <Field label="Description of Effort" value={contract.description_of_effort} />
      </div>
      {contract.task_areas?.length > 0 && (
        <div className="md:col-span-2">
          <p className="text-xs font-medium text-muted-foreground mb-1">Task Areas</p>
          <div className="flex flex-wrap gap-1">
            {contract.task_areas.map((t, i) => (
              <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs">{t}</span>
            ))}
          </div>
        </div>
      )}
      {contract.relevance_tags?.length > 0 && (
        <div className="md:col-span-2">
          <p className="text-xs font-medium text-muted-foreground mb-1">Relevance Tags</p>
          <div className="flex flex-wrap gap-1">
            {contract.relevance_tags.map((t, i) => (
              <span key={i} className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
      <p className="text-foreground">{value || '—'}</p>
    </div>
  );
}

function ContractForm({
  form,
  setForm,
  tagInput,
  setTagInput,
  taskInput,
  setTaskInput,
  toolInput,
  setToolInput,
  onSubmit,
  saving,
  error,
  submitLabel,
  onCancel,
}: {
  form: FormData;
  setForm: (f: FormData) => void;
  tagInput: string;
  setTagInput: (v: string) => void;
  taskInput: string;
  setTaskInput: (v: string) => void;
  toolInput: string;
  setToolInput: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  error: string | null;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const input = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';
  const label = 'block text-sm font-medium text-foreground mb-1';
  const req = <span className="text-red-500">*</span>;

  const addTag = (list: 'task_areas' | 'tools_used' | 'relevance_tags', val: string, clearFn: (v: string) => void) => {
    if (val.trim()) {
      setForm({ ...form, [list]: [...form[list], val.trim()] });
      clearFn('');
    }
  };

  const removeFromList = (list: 'task_areas' | 'tools_used' | 'relevance_tags', idx: number) => {
    setForm({ ...form, [list]: form[list].filter((_, i) => i !== idx) });
  };

  const updateAchievement = (idx: number, field: string, value: string) => {
    const updated = [...form.achievements];
    updated[idx] = { ...updated[idx], [field]: value };
    setForm({ ...form, achievements: updated });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {/* Contract Identification */}
      <div>
        <h4 className="font-semibold text-foreground mb-3">Contract Identification</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={label}>Contract Nickname {req}</label>
            <input required className={input} placeholder="e.g., FERC ePMO Support"
              value={form.contract_nickname} onChange={(e) => setForm({ ...form, contract_nickname: e.target.value })} />
          </div>
          <div>
            <label className={label}>Official Contract Name {req}</label>
            <input required className={input} placeholder="Enterprise Program Management Support Services"
              value={form.contract_name} onChange={(e) => setForm({ ...form, contract_name: e.target.value })} />
          </div>
          <div>
            <label className={label}>Contract Number {req}</label>
            <input required className={input} placeholder="47QFCA22D0001"
              value={form.contract_number} onChange={(e) => setForm({ ...form, contract_number: e.target.value })} />
          </div>
          <div>
            <label className={label}>Task Order Number</label>
            <input className={input} placeholder="If under IDIQ/GWAC/BPA"
              value={form.task_order_number} onChange={(e) => setForm({ ...form, task_order_number: e.target.value })} />
          </div>
          <div>
            <label className={label}>Client Agency {req}</label>
            <input required className={input} placeholder="Federal Energy Regulatory Commission"
              value={form.client_agency} onChange={(e) => setForm({ ...form, client_agency: e.target.value })} />
          </div>
          <div>
            <label className={label}>Client Office</label>
            <input className={input} placeholder="Chief Information Officer Organization"
              value={form.client_office} onChange={(e) => setForm({ ...form, client_office: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Financials & Period */}
      <div>
        <h4 className="font-semibold text-foreground mb-3">Financials & Period</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={label}>Contract Type {req}</label>
            <select required className={input} value={form.contract_type}
              onChange={(e) => setForm({ ...form, contract_type: e.target.value as FormData['contract_type'] })}>
              <option value="FFP">Firm Fixed Price (FFP)</option>
              <option value="T&M">Time & Materials (T&M)</option>
              <option value="Cost-Plus">Cost-Plus</option>
              <option value="Labor Hour">Labor Hour</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>
          <div>
            <label className={label}>Contract Value ($) {req}</label>
            <input required type="number" min="0" className={input}
              value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className={label}>Start Date {req}</label>
            <input required type="date" className={input}
              value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div>
            <label className={label}>End Date {req}</label>
            <input required className={input} placeholder="YYYY-MM-DD or Ongoing"
              value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Role & Scope */}
      <div>
        <h4 className="font-semibold text-foreground mb-3">Role & Scope</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={label}>Role {req}</label>
            <select required className={input} value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as FormData['role'] })}>
              <option value="Prime">Prime</option>
              <option value="Subcontractor">Subcontractor</option>
              <option value="Joint Venture">Joint Venture</option>
              <option value="Teaming Partner">Teaming Partner</option>
            </select>
          </div>
          <div>
            <label className={label}>Team Size {req}</label>
            <input required type="number" min="1" className={input}
              value={form.team_size} onChange={(e) => setForm({ ...form, team_size: parseInt(e.target.value) || 1 })} />
          </div>
          <div>
            <label className={label}>Place of Performance {req}</label>
            <input required className={input} placeholder="Washington, DC"
              value={form.place_of_performance} onChange={(e) => setForm({ ...form, place_of_performance: e.target.value })} />
          </div>
          <div>
            <label className={label}>% of Work</label>
            <input type="number" min="0" max="100" className={input}
              value={form.percentage_of_work} onChange={(e) => setForm({ ...form, percentage_of_work: parseInt(e.target.value) || 0 })} />
          </div>
        </div>
      </div>

      {/* Client POC */}
      <div>
        <h4 className="font-semibold text-foreground mb-3">Client Point of Contact</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={label}>Name {req}</label>
            <input required className={input}
              value={form.client_poc.name} onChange={(e) => setForm({ ...form, client_poc: { ...form.client_poc, name: e.target.value } })} />
          </div>
          <div>
            <label className={label}>Title</label>
            <input className={input}
              value={form.client_poc.title} onChange={(e) => setForm({ ...form, client_poc: { ...form.client_poc, title: e.target.value } })} />
          </div>
          <div>
            <label className={label}>Email</label>
            <input type="email" className={input}
              value={form.client_poc.email} onChange={(e) => setForm({ ...form, client_poc: { ...form.client_poc, email: e.target.value } })} />
          </div>
          <div>
            <label className={label}>Phone</label>
            <input className={input}
              value={form.client_poc.phone} onChange={(e) => setForm({ ...form, client_poc: { ...form.client_poc, phone: e.target.value } })} />
          </div>
        </div>
      </div>

      {/* Narrative */}
      <div>
        <h4 className="font-semibold text-foreground mb-3">Narrative</h4>
        <div className="space-y-4">
          <div>
            <label className={label}>Overview {req} <span className="text-xs font-normal text-muted-foreground">(max 500 chars)</span></label>
            <textarea required maxLength={500} rows={3} className={input}
              placeholder="Concise summary of the contract..."
              value={form.overview} onChange={(e) => setForm({ ...form, overview: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">{form.overview.length}/500</p>
          </div>
          <div>
            <label className={label}>Description of Effort {req} <span className="text-xs font-normal text-muted-foreground">(max 2000 chars)</span></label>
            <textarea required maxLength={2000} rows={5} className={input}
              placeholder="Detailed description of work performed..."
              value={form.description_of_effort} onChange={(e) => setForm({ ...form, description_of_effort: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">{form.description_of_effort.length}/2000</p>
          </div>
        </div>
      </div>

      {/* Task Areas */}
      <div>
        <h4 className="font-semibold text-foreground mb-3">Task Areas {req}</h4>
        <div className="flex gap-2 mb-2">
          <input className={input} placeholder="Add task area..."
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag('task_areas', taskInput, setTaskInput); } }} />
          <button type="button" onClick={() => addTag('task_areas', taskInput, setTaskInput)}
            className="shrink-0 rounded-md bg-muted px-3 py-2 text-sm hover:bg-muted/80">Add</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {form.task_areas.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
              {t}
              <button type="button" onClick={() => removeFromList('task_areas', i)} className="hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Tools Used */}
      <div>
        <h4 className="font-semibold text-foreground mb-3">Tools & Technologies</h4>
        <div className="flex gap-2 mb-2">
          <input className={input} placeholder="Add tool..."
            value={toolInput}
            onChange={(e) => setToolInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag('tools_used', toolInput, setToolInput); } }} />
          <button type="button" onClick={() => addTag('tools_used', toolInput, setToolInput)}
            className="shrink-0 rounded-md bg-muted px-3 py-2 text-sm hover:bg-muted/80">Add</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {form.tools_used.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
              {t}
              <button type="button" onClick={() => removeFromList('tools_used', i)} className="hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Achievements */}
      <div>
        <h4 className="font-semibold text-foreground mb-3">Achievements {req}</h4>
        {form.achievements.map((a, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 p-3 rounded-lg border border-border">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Statement</label>
              <input className={input} placeholder="Reduced processing time by 40%..."
                value={a.statement} onChange={(e) => updateAchievement(i, 'statement', e.target.value)} />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Metric</label>
                <input className={input} placeholder="40%"
                  value={a.metric_value} onChange={(e) => updateAchievement(i, 'metric_value', e.target.value)} />
              </div>
              {form.achievements.length > 1 && (
                <button type="button" onClick={() => setForm({ ...form, achievements: form.achievements.filter((_, j) => j !== i) })}
                  className="self-end p-2 rounded hover:bg-red-50 text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        <button type="button"
          onClick={() => setForm({ ...form, achievements: [...form.achievements, { statement: '', metric_value: '', metric_type: 'Quality Improvement' }] })}
          className="text-sm text-primary hover:underline">
          + Add Achievement
        </button>
      </div>

      {/* Relevance Tags */}
      <div>
        <h4 className="font-semibold text-foreground mb-3">Relevance Tags {req}</h4>
        <div className="flex gap-2 mb-2">
          <input className={input} placeholder="Add tag..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag('relevance_tags', tagInput, setTagInput); } }} />
          <button type="button" onClick={() => addTag('relevance_tags', tagInput, setTagInput)}
            className="shrink-0 rounded-md bg-muted px-3 py-2 text-sm hover:bg-muted/80">Add</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {form.relevance_tags.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 px-2.5 py-1 text-xs">
              {t}
              <button type="button" onClick={() => removeFromList('relevance_tags', i)} className="hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <button type="submit" disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium hover:bg-muted">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

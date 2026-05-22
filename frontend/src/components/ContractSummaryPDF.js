import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function ContractSummaryPDF() {
  const [contractId, setContractId] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchSummary = async () => {
    setLoading(true); setErr(''); setData(null);
    try {
      const url = contractId ? `/custom-views/contract-summary/${contractId}` : '/custom-views/contract-summary/';
      const r = await api.get(url);
      setData(r.data);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchSummary(); /* eslint-disable-next-line */ }, []);

  const download = () => {
    if (!data?.pdf_data_uri) return;
    const a = document.createElement('a');
    a.href = data.pdf_data_uri;
    a.download = `contract_${data.contract_id}_summary.txt`;
    a.click();
  };

  return (
    <div style={{ background: '#1f2937', padding: 20, borderRadius: 8 }}>
      <h3 style={{ marginTop: 0, color: '#e5e7eb' }}>Contract Summary PDF</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="number"
          placeholder="Contract ID (blank = latest)"
          value={contractId}
          onChange={e => setContractId(e.target.value)}
          style={{ padding: 8, borderRadius: 4, border: '1px solid #374151', background: '#111827', color: '#e5e7eb' }}
        />
        <button onClick={fetchSummary} disabled={loading} style={{ padding: '8px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          {loading ? 'Loading...' : 'Generate'}
        </button>
        {data && <button onClick={download} style={{ padding: '8px 14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Download</button>}
      </div>
      {err && <div style={{ color: '#f87171', marginBottom: 8 }}>Error: {err}</div>}
      {data && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 12 }}>
            <div style={{ background: '#111827', padding: 8, borderRadius: 4, color: '#9ca3af' }}>Title: <strong style={{ color: '#e5e7eb' }}>{data.sections.header.title}</strong></div>
            <div style={{ background: '#111827', padding: 8, borderRadius: 4, color: '#9ca3af' }}>Status: <strong style={{ color: '#e5e7eb' }}>{data.sections.header.status}</strong></div>
            <div style={{ background: '#111827', padding: 8, borderRadius: 4, color: '#9ca3af' }}>Clauses: <strong style={{ color: '#e5e7eb' }}>{data.sections.clauses_count}</strong></div>
            <div style={{ background: '#111827', padding: 8, borderRadius: 4, color: '#9ca3af' }}>Obligations: <strong style={{ color: '#e5e7eb' }}>{data.sections.obligations_count}</strong></div>
          </div>
          <pre style={{
            background: '#0f172a', color: '#cbd5e1', padding: 14,
            borderRadius: 4, maxHeight: 320, overflow: 'auto',
            fontSize: 12, whiteSpace: 'pre-wrap',
          }}>{data.summary_text}</pre>
        </div>
      )}
    </div>
  );
}

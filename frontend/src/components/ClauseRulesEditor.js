import React, { useEffect, useState } from 'react';
import api from '../services/api';

const blank = { name: '', clause_type: 'general', rule: '', severity: 'standard', active: true };

export default function ClauseRulesEditor() {
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try { const r = await api.get('/custom-views/clause-rules'); setRules(r.data.rules || []); }
    catch (e) { setErr(e.response?.data?.error || e.message); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setLoading(true); setErr('');
    try {
      if (editId) await api.put(`/custom-views/clause-rules/${editId}`, form);
      else await api.post('/custom-views/clause-rules', form);
      setForm(blank); setEditId(null);
      await load();
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  const edit = (r) => { setEditId(r.id); setForm({ name: r.name, clause_type: r.clause_type, rule: r.rule, severity: r.severity, active: r.active }); };
  const del = async (id) => {
    if (!window.confirm('Delete rule?')) return;
    try { await api.delete(`/custom-views/clause-rules/${id}`); await load(); }
    catch (e) { setErr(e.response?.data?.error || e.message); }
  };
  const cancel = () => { setEditId(null); setForm(blank); };

  return (
    <div style={{ background: '#1f2937', padding: 20, borderRadius: 8 }}>
      <h3 style={{ marginTop: 0, color: '#e5e7eb' }}>Clause / Template Rules Editor</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <input placeholder="Rule name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
          style={inputStyle} />
        <select value={form.clause_type} onChange={e => setForm({ ...form, clause_type: e.target.value })} style={inputStyle}>
          {['general','confidentiality','liability','ip_ownership','termination','force_majeure','payment','indemnification','data_protection','warranty','governing_law','dispute_resolution'].map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
      <textarea placeholder="Rule expression / description" value={form.rule} onChange={e => setForm({ ...form, rule: e.target.value })}
        style={{ ...inputStyle, width: '100%', minHeight: 60, boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} style={inputStyle}>
          {['standard','high','critical'].map(o => <option key={o}>{o}</option>)}
        </select>
        <label style={{ color: '#9ca3af' }}>
          <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Active
        </label>
        <button onClick={save} disabled={loading} style={btnPrimary}>{editId ? 'Update' : 'Create'}</button>
        {editId && <button onClick={cancel} style={btnSecondary}>Cancel</button>}
      </div>
      {err && <div style={{ color: '#f87171', marginTop: 8 }}>Error: {err}</div>}

      <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: '#9ca3af', textAlign: 'left' }}>
            <th style={th}>Name</th><th style={th}>Clause Type</th><th style={th}>Severity</th><th style={th}>Active</th><th style={th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rules.map(r => (
            <tr key={r.id} style={{ borderTop: '1px solid #374151' }}>
              <td style={td}>{r.name}</td>
              <td style={td}>{r.clause_type}</td>
              <td style={td}>{r.severity}</td>
              <td style={td}>{r.active ? 'Yes' : 'No'}</td>
              <td style={td}>
                <button onClick={() => edit(r)} style={btnSmall}>Edit</button>
                <button onClick={() => del(r.id)} style={{ ...btnSmall, background: '#dc2626', marginLeft: 6 }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const inputStyle = { padding: 8, borderRadius: 4, border: '1px solid #374151', background: '#111827', color: '#e5e7eb' };
const btnPrimary = { padding: '8px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' };
const btnSecondary = { padding: '8px 14px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' };
const btnSmall = { padding: '4px 10px', background: '#374151', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 };
const th = { padding: 8, fontSize: 12, fontWeight: 600 };
const td = { padding: 8, color: '#e5e7eb', fontSize: 13 };

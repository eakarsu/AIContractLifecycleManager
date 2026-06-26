import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import { FiPlus, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';

function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

export default function CrudPage({ title, apiPath, columns, fields }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/${apiPath}`);
      setItems(normalizeItems(data));
    }
    catch { toast.error('Failed to load data'); } finally { setLoading(false); }
  }, [apiPath]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditItem(null); setForm({}); setShowModal(true); };
  const openEdit = () => {
    if (!selected) return; setEditItem(selected);
    const f = {}; fields.forEach(fd => { f[fd.name] = selected[fd.name] ?? ''; }); setForm(f); setShowModal(true);
  };
  const handleDelete = async () => {
    if (!selected || !window.confirm('Delete this item?')) return;
    try { await api.delete(`/${apiPath}/${selected.id}`); toast.success('Deleted'); setSelected(null); load(); }
    catch { toast.error('Delete failed'); }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editItem) { await api.put(`/${apiPath}/${editItem.id}`, form); toast.success('Updated'); }
      else { await api.post(`/${apiPath}`, form); toast.success('Created'); }
      setShowModal(false); setSelected(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
  };
  const formatCell = (val) => {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'object') return JSON.stringify(val).substring(0, 50) + '...';
    const s = String(val);
    const lower = s.toLowerCase().replace(/\s/g,'_');
    if (['active','completed','passed','approved','executed'].includes(lower)) return <span className={`badge badge-${lower}`}>{s}</span>;
    if (['draft','pending','conditional','in_progress','in_review','negotiation'].includes(lower)) return <span className={`badge badge-${lower}`}>{s}</span>;
    if (['inactive','failed','overdue','rejected','expired','terminated'].includes(lower)) return <span className={`badge badge-${lower}`}>{s}</span>;
    if (lower === 'under_review') return <span className="badge badge-under_review">{s}</span>;
    if (lower === 'low') return <span className="badge badge-active">{s}</span>;
    if (lower === 'medium') return <span className="badge badge-pending">{s}</span>;
    if (['high','critical'].includes(lower)) return <span className="badge badge-inactive">{s}</span>;
    return s.length > 70 ? s.substring(0, 70) + '...' : s;
  };

  const safeItems = normalizeItems(items);

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">{title}</h1><p className="page-subtitle">{safeItems.length} items</p></div>
        <button className="btn btn-primary" onClick={openNew}><FiPlus/> New</button>
      </div>
      {loading ? (<div className="loading"><div className="spinner"></div>Loading...</div>
      ) : safeItems.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">&#128221;</div><div className="empty-text">No {title.toLowerCase()} yet</div>
        <button className="btn btn-primary btn-sm" onClick={openNew} style={{marginTop:12}}><FiPlus/> Create First</button></div>
      ) : (
        <div className="table-container"><table><thead><tr><th>#</th>{columns.map(c => <th key={c}>{c.replace(/_/g,' ')}</th>)}</tr></thead>
        <tbody>{safeItems.map(item => (
          <tr key={item.id} className={selected?.id === item.id ? 'selected' : ''} onClick={() => setSelected(selected?.id === item.id ? null : item)}>
            <td>{item.id}</td>{columns.map(c => <td key={c}>{formatCell(item[c])}</td>)}
          </tr>))}</tbody></table></div>
      )}
      {selected && (
        <div className="detail-panel">
          <div className="detail-header"><h2 className="detail-title">{selected.name || selected.title || selected.key || `#${selected.id}`}</h2>
          <button className="detail-close" onClick={() => setSelected(null)}><FiX/></button></div>
          <div className="detail-actions">
            <button className="btn btn-primary btn-sm" onClick={openEdit}><FiEdit2/> Edit</button>
            <button className="btn btn-danger btn-sm" onClick={handleDelete}><FiTrash2/> Delete</button>
          </div>
          {Object.entries(selected).map(([k, v]) => (
            <div className="detail-field" key={k}><div className="detail-label">{k.replace(/_/g,' ')}</div>
            <div className={typeof v === 'object' && v !== null ? 'detail-json' : 'detail-value'}>
              {v === null || v === undefined ? '-' : typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}</div></div>
          ))}
        </div>
      )}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editItem ? 'Edit' : 'New'}</h2>
            <form onSubmit={handleSubmit}>
              {fields.map(f => (
                <div className="form-group" key={f.name}><label className="form-label">{f.label}{f.required && ' *'}</label>
                {f.type === 'textarea' ? <textarea className="form-textarea" value={form[f.name] || ''} onChange={e => setForm({...form, [f.name]: e.target.value})} required={f.required} />
                : f.type === 'select' ? <select className="form-select" value={form[f.name] || ''} onChange={e => setForm({...form, [f.name]: e.target.value})}><option value="">Select...</option>{f.options.map(o => <option key={o} value={o}>{o}</option>)}</select>
                : <input className="form-input" type={f.type || 'text'} value={form[f.name] || ''} onChange={e => setForm({...form, [f.name]: e.target.value})} required={f.required} />}</div>
              ))}
              <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">{editItem ? 'Update' : 'Create'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

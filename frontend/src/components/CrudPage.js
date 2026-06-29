import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiSave } from 'react-icons/fi';

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
  const [detailItem, setDetailItem] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [lookups, setLookups] = useState({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/${apiPath}`);
      setItems(normalizeItems(data));
    }
    catch { toast.error('Failed to load data'); } finally { setLoading(false); }
  }, [apiPath]);

  useEffect(() => { load(); }, [load]);

  const lookupConfig = {
    contract_id: { endpoint: 'contracts', label: (row) => `${row.id} · ${row.title || row.contract_type || 'Contract'}` },
    party_id: { endpoint: 'parties', label: (row) => `${row.id} · ${row.name || row.email || 'Party'}` },
    amendment_id: { endpoint: 'amendments', label: (row) => `${row.id} · ${row.title || 'Amendment'}` },
    clause_id: { endpoint: 'clauses', label: (row) => `${row.id} · ${row.title || row.clause_type || 'Clause'}` },
    template_id: { endpoint: 'templates', label: (row) => `${row.id} · ${row.name || row.template_type || 'Template'}` },
    obligation_id: { endpoint: 'obligations', label: (row) => `${row.id} · ${row.title || 'Obligation'}` },
    renewal_id: { endpoint: 'renewals', label: (row) => `${row.id} · Contract ${row.contract_id || '-'}` },
    milestone_id: { endpoint: 'milestones', label: (row) => `${row.id} · ${row.title || 'Milestone'}` },
    document_id: { endpoint: 'documents', label: (row) => `${row.id} · ${row.title || row.file_name || 'Document'}` },
  };

  useEffect(() => {
    const needed = fields
      .map(f => f.name)
      .filter(name => lookupConfig[name]);
    if (!needed.length) return;
    let cancelled = false;
    Promise.all(needed.map(async (name) => {
      try {
        const { data } = await api.get(`/${lookupConfig[name].endpoint}`, { params: { limit: 100 } });
        return [name, normalizeItems(data)];
      } catch {
        return [name, []];
      }
    })).then(entries => {
      if (cancelled) return;
      setLookups(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [fields]);

  const resetModal = () => {
    setDetailItem(null);
    setEditItem(null);
    setForm({});
    setModalMode(null);
  };

  const normalizeFormValue = (field, value) => {
    if (value === null || value === undefined) return '';
    if (field.type === 'select') return String(value);
    if (field.type === 'date' && typeof value === 'string') return value.slice(0, 10);
    return value;
  };

  const formFromItem = (item = {}) => {
    const f = {};
    fields.forEach(fd => { f[fd.name] = normalizeFormValue(fd, item[fd.name]); });
    return f;
  };

  const openNew = () => {
    setDetailItem(null);
    setEditItem(null);
    setForm({});
    setModalMode('create');
  };

  const openDetail = (item) => {
    setDetailItem(item);
    setEditItem(null);
    setForm({});
    setModalMode('view');
  };

  const openEdit = (item = detailItem) => {
    if (!item) return;
    setDetailItem(item);
    setEditItem(item);
    setForm(formFromItem(item));
    setModalMode('edit');
  };

  const handleDelete = async () => {
    if (!detailItem || !window.confirm(`Delete ${detailItem.name || detailItem.title || `record #${detailItem.id}`}?`)) return;
    try { await api.delete(`/${apiPath}/${detailItem.id}`); toast.success('Deleted'); resetModal(); load(); }
    catch { toast.error('Delete failed'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editItem) {
        const { data } = await api.put(`/${apiPath}/${editItem.id}`, form);
        toast.success('Updated');
        const updated = data?.id ? data : { ...editItem, ...form };
        setDetailItem(updated);
        setEditItem(null);
        setForm({});
        setModalMode('view');
      }
      else {
        const { data } = await api.post(`/${apiPath}`, form);
        toast.success('Created');
        setDetailItem(data?.id ? data : null);
        setEditItem(null);
        setForm({});
        setModalMode(data?.id ? 'view' : null);
      }
      load();
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

  const fieldLabel = (key) => fields.find(f => f.name === key)?.label || key.replace(/_/g, ' ');

  const formatDetailValue = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return new Date(text).toLocaleString();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(`${text}T00:00:00`).toLocaleDateString();
    return text;
  };

  const primaryTitle = (item) => item?.name || item?.title || item?.key || item?.action || item?.reference || `Record #${item?.id}`;
  const modalOpen = Boolean(modalMode);
  const safeItems = normalizeItems(items);

  const renderFormControl = (f) => {
    const lookupRows = lookups[f.name] || [];
    if (lookupRows.length > 0) {
      const config = lookupConfig[f.name];
      return (
        <select className="form-select" value={form[f.name] || ''} onChange={e => setForm({...form, [f.name]: e.target.value})} required={f.required}>
          <option value="">Select...</option>
          {lookupRows.map(row => <option key={row.id} value={row.id}>{config.label(row)}</option>)}
        </select>
      );
    }
    if (f.type === 'textarea') {
      return <textarea className="form-textarea" value={form[f.name] || ''} onChange={e => setForm({...form, [f.name]: e.target.value})} required={f.required} />;
    }
    if (f.type === 'select') {
      return (
        <select className="form-select" value={form[f.name] || ''} onChange={e => setForm({...form, [f.name]: e.target.value})} required={f.required}>
          <option value="">Select...</option>
          {f.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return <input className="form-input" type={f.type || 'text'} value={form[f.name] || ''} onChange={e => setForm({...form, [f.name]: e.target.value})} required={f.required} />;
  };

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
          <tr key={item.id} className={detailItem?.id === item.id ? 'selected' : ''} onClick={() => openDetail(item)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') openDetail(item); }}>
            <td>{item.id}</td>{columns.map(c => <td key={c}>{formatCell(item[c])}</td>)}
          </tr>))}</tbody></table></div>
      )}
      {modalOpen && (
        <div className="modal-overlay detail-modal-overlay" onClick={resetModal}>
          <div className={`modal record-modal ${modalMode === 'view' ? 'record-modal-view' : 'record-modal-edit'}`} onClick={e => e.stopPropagation()}>
            <div className="record-modal-header">
              <div>
                <div className="record-modal-eyebrow">{modalMode === 'create' ? `New ${title}` : title}</div>
                <h2 className="modal-title">{modalMode === 'create' ? `Create ${title}` : primaryTitle(detailItem)}</h2>
                {detailItem && (
                  <div className="record-modal-meta">
                    <span>Record ID {detailItem.id}</span>
                    {detailItem.status && <span>{String(detailItem.status).replace(/_/g, ' ')}</span>}
                    {detailItem.risk_level && <span>{String(detailItem.risk_level).replace(/_/g, ' ')} risk</span>}
                  </div>
                )}
              </div>
              <button className="detail-close" onClick={resetModal} aria-label="Close"><FiX/></button>
            </div>

            {modalMode === 'view' && detailItem && (
              <>
                <div className="detail-actions record-modal-actions">
                  <button className="btn btn-primary" onClick={() => openEdit(detailItem)}><FiEdit2/> Edit</button>
                  <button className="btn btn-danger" onClick={handleDelete}><FiTrash2/> Delete</button>
                  <button className="btn btn-secondary" onClick={resetModal}>Cancel</button>
                </div>
                <div className="record-summary-card">
                  <div className="record-summary-title">{primaryTitle(detailItem)}</div>
                  <div className="record-summary-text">
                    {detailItem.description || detailItem.summary || detailItem.content || 'Review the complete record details from PostgreSQL.'}
                  </div>
                </div>
                <div className="detail-grid">
                  {Object.entries(detailItem).map(([k, v]) => (
                    <div className={`detail-field ${typeof v === 'object' && v !== null ? 'detail-field-wide' : ''}`} key={k}>
                      <div className="detail-label">{fieldLabel(k)}</div>
                      <div className={typeof v === 'object' && v !== null ? 'detail-json' : 'detail-value'}>
                        {formatDetailValue(v)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {(modalMode === 'edit' || modalMode === 'create') && (
              <form onSubmit={handleSubmit} className="professional-form">
                <div className="edit-intro">
                  <strong>{modalMode === 'edit' ? 'Edit record details' : 'Create a new lifecycle record'}</strong>
                  <span>{modalMode === 'edit' ? 'Update the fields below, then save changes to PostgreSQL.' : 'Fill the core fields below to create a new record.'}</span>
                </div>
                <div className="form-grid">
                  {fields.map(f => (
                    <div className={`form-group ${f.type === 'textarea' ? 'form-group-wide' : ''}`} key={f.name}>
                      <label className="form-label">{f.label}{f.required && ' *'}</label>
                      {renderFormControl(f)}
                    </div>
                  ))}
                </div>
                <div className="form-actions record-form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => editItem ? setModalMode('view') : resetModal()}>Cancel</button>
                  <button type="submit" className="btn btn-primary"><FiSave/> {editItem ? 'Save Changes' : 'Create Record'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

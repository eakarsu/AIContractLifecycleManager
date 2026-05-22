import React, { useEffect, useState } from 'react';

const empty = { contract: '', obligation: '', owner: '', evidence: '', dueDate: '', status: 'pending' };

export default function ObligationEvidenceRoom() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total: 0, blocked: 0, pending: 0 });
  const [form, setForm] = useState(empty);
  const load = async () => { const r = await fetch('/api/obligation-evidence-room'); const d = await r.json(); setRows(d.rows || []); setSummary(d.summary || { total: 0, blocked: 0, pending: 0 }); };
  useEffect(() => { load(); }, []);
  const submit = async e => { e.preventDefault(); await fetch('/api/obligation-evidence-room', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) }); setForm(empty); load(); };
  return <div className="page"><h1>Obligation Evidence Room</h1><p>Contract obligations mapped to owners, evidence, due dates, and blockers.</p><div className="stats-grid">{['total','blocked','pending'].map(k => <div className="stat-card" key={k}>{k}: {summary[k]}</div>)}</div><form onSubmit={submit}>{['contract','obligation','owner','evidence','dueDate'].map(f => <input key={f} placeholder={f} value={form[f]} onChange={e=>setForm({...form,[f]:e.target.value})}/>)}<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>pending</option><option>blocked</option><option>complete</option></select><button>Add Evidence</button></form><table><tbody>{rows.map(r => <tr key={r.id}><td>{r.contract}</td><td>{r.obligation}</td><td>{r.owner}</td><td>{r.evidence}</td><td>{r.dueDate}</td><td>{r.status}</td></tr>)}</tbody></table></div>;
}

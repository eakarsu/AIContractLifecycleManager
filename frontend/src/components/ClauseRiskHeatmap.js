import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function ClauseRiskHeatmap() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/custom-views/clause-risk-heatmap')
      .then(r => setData(r.data))
      .catch(e => setErr(e.response?.data?.error || e.message));
  }, []);

  if (err) return <div style={{ color: '#f87171' }}>Error: {err}</div>;
  if (!data) return <div>Loading heatmap...</div>;

  const colorFor = (v, max) => {
    if (max === 0) return '#1f2937';
    const intensity = Math.min(v / max, 1);
    // Greenish low -> yellow -> red
    const r = Math.round(34 + intensity * (239 - 34));
    const g = Math.round(197 - intensity * (197 - 68));
    const b = Math.round(94 - intensity * (94 - 68));
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div style={{ background: '#1f2937', padding: 20, borderRadius: 8 }}>
      <h3 style={{ marginTop: 0, color: '#e5e7eb' }}>Clause Risk Heatmap (type x severity)</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, color: '#9ca3af' }}>Clause Type</th>
              {data.severities.map(s => (
                <th key={s} style={{ padding: 8, color: '#9ca3af', textTransform: 'capitalize' }}>{s}</th>
              ))}
              <th style={{ padding: 8, color: '#9ca3af' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.matrix.length === 0 && (
              <tr><td colSpan={data.severities.length + 2} style={{ padding: 12, color: '#6b7280' }}>No clauses found</td></tr>
            )}
            {data.matrix.map(row => (
              <tr key={row.clause_type}>
                <td style={{ padding: 8, color: '#e5e7eb', fontWeight: 500 }}>{row.clause_type}</td>
                {data.severities.map(sev => (
                  <td key={sev} style={{
                    padding: 0,
                    textAlign: 'center',
                  }}>
                    <div style={{
                      background: colorFor(row[sev], data.max),
                      color: '#0f172a',
                      padding: '14px 8px',
                      margin: 2,
                      borderRadius: 4,
                      fontWeight: 700,
                      minWidth: 60,
                    }}>{row[sev]}</div>
                  </td>
                ))}
                <td style={{ padding: 8, color: '#e5e7eb', textAlign: 'center' }}>{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>Cell intensity = count relative to max ({data.max})</div>
    </div>
  );
}

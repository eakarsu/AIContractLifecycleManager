import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function PipelineFunnelChart() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/custom-views/pipeline-funnel')
      .then(r => setData(r.data))
      .catch(e => setErr(e.response?.data?.error || e.message));
  }, []);

  if (err) return <div style={{ color: '#f87171' }}>Error: {err}</div>;
  if (!data) return <div>Loading pipeline funnel...</div>;

  const colors = ['#60a5fa', '#fbbf24', '#34d399', '#a78bfa'];
  const maxCount = Math.max(...data.funnel.map(f => f.count), 1);

  return (
    <div style={{ background: '#1f2937', padding: 20, borderRadius: 8 }}>
      <h3 style={{ marginTop: 0, color: '#e5e7eb' }}>Contract Pipeline Funnel</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
        {data.funnel.map((stage, i) => {
          const widthPct = Math.max((stage.count / maxCount) * 100, 8);
          return (
            <div key={stage.stage} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 100, color: '#9ca3af', fontSize: 13 }}>{stage.label}</div>
              <div style={{ flex: 1, background: '#111827', borderRadius: 4, height: 36, position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  width: `${widthPct}%`,
                  background: colors[i % colors.length],
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 12,
                  color: '#0f172a',
                  fontWeight: 600,
                  transition: 'width 0.4s',
                }}>
                  {stage.count} · {stage.percentage}%
                </div>
              </div>
              <div style={{ width: 110, color: '#9ca3af', fontSize: 12, textAlign: 'right' }}>
                ${stage.total_value.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12, color: '#6b7280', fontSize: 12 }}>
        Total contracts in pipeline: {data.total_contracts}
      </div>
    </div>
  );
}

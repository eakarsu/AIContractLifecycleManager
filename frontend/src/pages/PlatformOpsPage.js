import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';

const providers = ['docusign', 'slack', 'hubspot', 'salesforce', 'netsuite', 'sap', 'oracle'];

function StatusPill({ value }) {
  const normalized = String(value || 'unknown').toLowerCase();
  const tone = normalized.includes('ready') || normalized.includes('configured') || normalized.includes('completed') || normalized === 'ok'
    ? 'success'
    : normalized.includes('warning') || normalized.includes('degraded') || normalized.includes('needs')
      ? 'warning'
      : 'danger';
  return <span className={`ops-pill ops-pill-${tone}`}>{value || 'unknown'}</span>;
}

function JsonDownload({ data, filename, children }) {
  const download = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };
  return <button type="button" className="btn btn-secondary" onClick={download} disabled={!data}>{children}</button>;
}

function formatKey(key) {
  return String(key || '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function renderReadable(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) {
    return (
      <ul className="ops-readable-list">
        {value.slice(0, 8).map((item, index) => (
          <li key={index}>
            {typeof item === 'object' ? Object.entries(item).slice(0, 4).map(([k, v]) => `${formatKey(k)}: ${typeof v === 'object' ? JSON.stringify(v).slice(0, 90) : v}`).join(' | ') : String(item)}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === 'object') {
    return (
      <div className="ops-readable-object">
        {Object.entries(value).slice(0, 8).map(([key, item]) => (
          <div key={key}><span>{formatKey(key)}</span><strong>{typeof item === 'object' ? JSON.stringify(item).slice(0, 140) : String(item)}</strong></div>
        ))}
      </div>
    );
  }
  return String(value);
}

export default function PlatformOpsPage() {
  const [health, setHealth] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [rbac, setRbac] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [healthRes, integrationRes, rbacRes] = await Promise.all([
        api.get('/ops/health'),
        api.get('/ops/integrations'),
        api.get('/ops/rbac'),
      ]);
      setHealth(healthRes.data);
      setIntegrations(integrationRes.data.integrations || []);
      setRbac(rbacRes.data);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runAction = async (label, fn) => {
    setLoading(true);
    try {
      const data = await fn();
      setResult({ label, data });
      toast.success(`${label} completed`);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const backup = async () => {
    const { data } = await api.get('/ops/backup');
    return data;
  };

  const auditExport = async () => {
    const { data } = await api.get('/ops/audit-export');
    return data;
  };

  const auditBinder = async () => {
    const { data } = await api.get('/ops/audit-binder');
    return data;
  };

  const readinessJob = async () => {
    const { data } = await api.post('/ops/jobs/run', { job: 'readiness-check' });
    return data;
  };

  const jobHistory = async () => {
    const { data } = await api.get('/ops/jobs/history');
    return data;
  };

  const testNotification = async () => {
    const { data } = await api.post('/ops/notifications/test', {});
    return data;
  };

  const testIntegration = async (provider) => {
    const { data } = await api.post(`/ops/integrations/${provider}/test`, {});
    return data;
  };

  const syncIntegration = async (provider) => {
    const { data } = await api.post(`/ops/integrations/${provider}/sync`, { direction: 'pull_and_push' });
    return data;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="page-title">Platform Ops</div>
          <div className="page-subtitle">Operational readiness, integrations, backup, audit export, and RBAC controls.</div>
        </div>
        <button type="button" className="btn btn-primary" onClick={load} disabled={loading}>Refresh</button>
      </div>

      <div className="ops-grid">
        <section className="ops-card ops-card-wide">
          <div className="ops-card-header">
            <div>
              <div className="ops-label">System Health</div>
              <h3>Readiness Overview</h3>
            </div>
            <StatusPill value={health?.status || (loading ? 'loading' : 'unknown')} />
          </div>
          <div className="ops-metrics">
            <div><span>Database</span><strong>{health?.database?.status || '-'}</strong></div>
            <div><span>Latency</span><strong>{health?.database?.latency_ms ?? '-'} ms</strong></div>
            <div><span>OpenRouter</span><strong>{health?.ai?.configured ? 'Configured' : 'Missing key'}</strong></div>
            <div><span>Integrations</span><strong>{health?.integrations ? `${health.integrations.configured}/${health.integrations.total}` : '-'}</strong></div>
          </div>
          {health?.missing_core_configuration?.length > 0 && (
            <div className="ops-warning">Missing core configuration: {health.missing_core_configuration.join(', ')}</div>
          )}
        </section>

        <section className="ops-card">
          <div className="ops-card-header">
            <div>
              <div className="ops-label">Data Protection</div>
              <h3>Backup And Audit</h3>
            </div>
          </div>
          <div className="ops-actions">
            <button type="button" className="btn btn-secondary" onClick={() => runAction('Backup export', backup)}>Export Backup</button>
            <button type="button" className="btn btn-secondary" onClick={() => runAction('Audit export', auditExport)}>Export Audit</button>
            <button type="button" className="btn btn-secondary" onClick={() => runAction('Audit binder', auditBinder)}>Prepare Binder</button>
            <button type="button" className="btn btn-primary" onClick={() => runAction('Readiness job', readinessJob)}>Run Readiness Job</button>
            <button type="button" className="btn btn-secondary" onClick={() => runAction('Job history', jobHistory)}>Job History</button>
            <button type="button" className="btn btn-secondary" onClick={() => runAction('Test notification', testNotification)}>Test Notification</button>
          </div>
        </section>

        <section className="ops-card">
          <div className="ops-card-header">
            <div>
              <div className="ops-label">Access Control</div>
              <h3>RBAC Matrix</h3>
            </div>
          </div>
          <div className="ops-role-list">
            {(rbac?.roles || []).map(role => (
              <div key={role.role} className="ops-role-row">
                <strong>{role.role}</strong>
                <span>{role.permissions.join(', ')}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="ops-card ops-card-full">
        <div className="ops-card-header">
          <div>
            <div className="ops-label">External Systems</div>
            <h3>Integration Readiness</h3>
          </div>
        </div>
        <div className="ops-integration-grid">
          {providers.map(provider => {
            const item = integrations.find(integration => integration.key === provider);
            return (
              <div key={provider} className="ops-integration-card">
                <div className="ops-integration-title">
                  <strong>{item?.label || provider}</strong>
                  <StatusPill value={item?.status || 'unknown'} />
                </div>
                <div className="ops-integration-meta">{item?.category || 'Integration'}</div>
                {item?.missing?.length > 0 && <div className="ops-missing">Missing: {item.missing.join(', ')}</div>}
                <div className="ops-actions compact">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => runAction(`Test ${item?.label || provider}`, () => testIntegration(provider))}>
                    Test Config
                  </button>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => runAction(`Sync ${item?.label || provider}`, () => syncIntegration(provider))}>
                    Sync Check
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {result && (
        <section className="ops-card ops-card-full">
          <div className="ops-card-header">
            <div>
              <div className="ops-label">Latest Result</div>
              <h3>{result.label}</h3>
            </div>
            <JsonDownload data={result.data} filename={`${result.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`}>
              Download JSON
            </JsonDownload>
          </div>
          <div className="ops-result-grid">
            {Object.entries(result.data || {}).slice(0, 12).map(([key, value]) => (
              <div key={key} className="ops-result-field">
                <span>{formatKey(key)}</span>
                <div className="ops-result-value">{renderReadable(value)}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

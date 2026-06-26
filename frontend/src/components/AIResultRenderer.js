import React from 'react';
import ReactMarkdown from 'react-markdown';

const META_KEYS = new Set(['model', 'tokens', 'usage', 'raw', 'ai_result', 'created_at', 'id']);

function humanize(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isEmpty(value) {
  return value === null || value === undefined || value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    (isPlainObject(value) && Object.keys(value).length === 0);
}

function tryParseJson(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return value;
  try { return JSON.parse(trimmed); } catch (_) { return value; }
}

function displayValue(value, key = '') {
  if (value === null || value === undefined || value === '') return 'Not specified';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    const lowerKey = key.toLowerCase();
    if (value >= 0 && value <= 1 && /(probability|confidence|likelihood|score|rate|percent)/.test(lowerKey)) {
      return `${Math.round(value * 100)}%`;
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function toneFor(key, value) {
  const text = String(value).toLowerCase();
  const lowerKey = String(key).toLowerCase();
  if (/high|critical|reject|terminate|failed|overdue|red/.test(text)) return 'danger';
  if (/medium|moderate|renegotiate|warning|pending|amber/.test(text)) return 'warning';
  if (/low|approve|renew|success|passed|green|complete/.test(text)) return 'success';
  if (/(risk|priority|confidence|recommendation|status|likelihood)/.test(lowerKey)) return 'info';
  return 'neutral';
}

function MetricTile({ label, value }) {
  return (
    <div className={`ai-result-metric ai-result-metric-${toneFor(label, value)}`}>
      <div className="ai-result-metric-label">{humanize(label)}</div>
      <div className="ai-result-metric-value">{displayValue(value, label)}</div>
    </div>
  );
}

function PrimitiveField({ label, value }) {
  const rendered = displayValue(value, label);
  const isLong = typeof rendered === 'string' && rendered.length > 120;

  return (
    <div className={isLong ? 'ai-result-field ai-result-field-wide' : 'ai-result-field'}>
      <div className="ai-result-field-label">{humanize(label)}</div>
      <div className="ai-result-field-value">
        {isLong ? <ReactMarkdown>{rendered}</ReactMarkdown> : rendered}
      </div>
    </div>
  );
}

function ObjectSummary({ value }) {
  const primitiveEntries = Object.entries(value).filter(([, entryValue]) => !isPlainObject(entryValue) && !Array.isArray(entryValue) && !isEmpty(entryValue));
  if (primitiveEntries.length === 0) return null;

  return (
    <div className="ai-result-field-grid">
      {primitiveEntries.map(([key, entryValue]) => (
        <PrimitiveField key={key} label={key} value={entryValue} />
      ))}
    </div>
  );
}

function ArrayValue({ label, value, depth }) {
  if (value.length === 0) return null;
  const primitive = value.every(item => !isPlainObject(item) && !Array.isArray(item));

  if (primitive) {
    return (
      <section className="ai-result-section">
        <h4>{humanize(label)}</h4>
        <ul className="ai-result-list">
          {value.map((item, index) => <li key={index}>{displayValue(item, label)}</li>)}
        </ul>
      </section>
    );
  }

  return (
    <section className="ai-result-section">
      <h4>{humanize(label)}</h4>
      <div className="ai-result-item-grid">
        {value.map((item, index) => (
          <div key={index} className="ai-result-item">
            <div className="ai-result-item-title">
              {item?.title || item?.name || item?.description || item?.clause_reference || `${humanize(label)} ${item?.id || index + 1}`}
            </div>
            <StructuredValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    </section>
  );
}

function StructuredValue({ value, depth = 0 }) {
  const parsed = tryParseJson(value);

  if (typeof parsed === 'string') {
    return <div className="ai-result-markdown"><ReactMarkdown>{parsed}</ReactMarkdown></div>;
  }

  if (Array.isArray(parsed)) {
    return <ArrayValue label="Items" value={parsed} depth={depth} />;
  }

  if (!isPlainObject(parsed)) {
    return <p className="ai-result-text">{displayValue(parsed)}</p>;
  }

  const entries = Object.entries(parsed).filter(([, entryValue]) => !isEmpty(entryValue));
  const primitiveEntries = entries.filter(([, entryValue]) => !isPlainObject(entryValue) && !Array.isArray(entryValue));
  const complexEntries = entries.filter(([, entryValue]) => isPlainObject(entryValue) || Array.isArray(entryValue));

  return (
    <>
      {primitiveEntries.length > 0 && <ObjectSummary value={Object.fromEntries(primitiveEntries)} />}
      {complexEntries.map(([key, entryValue]) => (
        Array.isArray(entryValue)
          ? <ArrayValue key={key} label={key} value={entryValue} depth={depth} />
          : (
            <section key={key} className="ai-result-section">
              <h4>{humanize(key)}</h4>
              <StructuredValue value={entryValue} depth={depth + 1} />
            </section>
          )
      ))}
    </>
  );
}

export default function AIResultRenderer({ result, title = 'AI Result', compact = false }) {
  if (!result) return null;

  const parsedResult = tryParseJson(result);
  const raw = isPlainObject(parsedResult) ? parsedResult.raw : null;
  const model = isPlainObject(parsedResult) ? parsedResult.model : null;
  const tokens = isPlainObject(parsedResult) ? (parsedResult.tokens || parsedResult.usage?.total_tokens) : null;
  const content = isPlainObject(parsedResult) && parsedResult.ai_result !== undefined
    ? tryParseJson(parsedResult.ai_result)
    : parsedResult;

  const cleanContent = isPlainObject(content)
    ? Object.fromEntries(Object.entries(content).filter(([key]) => !META_KEYS.has(key)))
    : content;

  const metricEntries = isPlainObject(cleanContent)
    ? Object.entries(cleanContent).filter(([key, value]) => {
        if (isEmpty(value) || isPlainObject(value) || Array.isArray(value)) return false;
        const keyText = key.toLowerCase();
        const valueText = String(value);
        return valueText.length <= 90 && /(score|count|total|risk|priority|confidence|probability|likelihood|recommendation|status|decision|outcome|health)/.test(keyText);
      })
    : [];

  const contentWithoutMetrics = isPlainObject(cleanContent)
    ? Object.fromEntries(Object.entries(cleanContent).filter(([key]) => !metricEntries.some(([metricKey]) => metricKey === key)))
    : cleanContent;

  return (
    <div className={`ai-result-card professional ${compact ? 'compact' : ''}`}>
      <div className="ai-result-header">
        <span className="badge">{title}</span>
        {model && <span className="ai-result-meta">Model: {model}</span>}
        {tokens && <span className="ai-result-meta">Tokens: {tokens}</span>}
      </div>

      {metricEntries.length > 0 && (
        <div className="ai-result-metrics">
          {metricEntries.map(([key, value]) => <MetricTile key={key} label={key} value={value} />)}
        </div>
      )}

      {raw ? (
        <div className="ai-result-markdown"><ReactMarkdown>{raw}</ReactMarkdown></div>
      ) : (
        <StructuredValue value={contentWithoutMetrics} />
      )}
    </div>
  );
}

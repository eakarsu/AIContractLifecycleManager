import React from 'react';
import PipelineFunnelChart from '../components/PipelineFunnelChart';
import ClauseRiskHeatmap from '../components/ClauseRiskHeatmap';
import ContractSummaryPDF from '../components/ContractSummaryPDF';
import ClauseRulesEditor from '../components/ClauseRulesEditor';

export default function CustomViewsPage() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ color: '#e5e7eb', marginTop: 0 }}>Contract Views</h1>
      <p style={{ color: '#9ca3af', marginTop: 0 }}>
        Custom analytics &amp; tools: pipeline funnel, clause risk heatmap, summary PDF, and clause/template rules editor.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(480px,1fr))', gap: 20, marginTop: 20 }}>
        <PipelineFunnelChart />
        <ClauseRiskHeatmap />
        <ContractSummaryPDF />
        <ClauseRulesEditor />
      </div>
    </div>
  );
}

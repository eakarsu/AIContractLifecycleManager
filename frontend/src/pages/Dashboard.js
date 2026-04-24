import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { FiFileText, FiList, FiCopy, FiUsers, FiCheckSquare, FiCheckCircle, FiEdit3, FiRefreshCw, FiAlertTriangle, FiShield, FiFlag, FiFolder, FiActivity } from 'react-icons/fi';

const statMeta = [
  { key:'contracts', label:'Contracts', icon:<FiFileText/>, path:'/contracts', color:'#6366f1' },
  { key:'clauses', label:'Clauses', icon:<FiList/>, path:'/clauses', color:'#3b82f6' },
  { key:'templates', label:'Templates', icon:<FiCopy/>, path:'/templates', color:'#8b5cf6' },
  { key:'parties', label:'Parties', icon:<FiUsers/>, path:'/parties', color:'#06b6d4' },
  { key:'obligations', label:'Obligations', icon:<FiCheckSquare/>, path:'/obligations', color:'#f59e0b' },
  { key:'approvals', label:'Approvals', icon:<FiCheckCircle/>, path:'/approvals', color:'#10b981' },
  { key:'amendments', label:'Amendments', icon:<FiEdit3/>, path:'/amendments', color:'#ec4899' },
  { key:'renewals', label:'Renewals', icon:<FiRefreshCw/>, path:'/renewals', color:'#14b8a6' },
  { key:'risks', label:'Risk Assessments', icon:<FiAlertTriangle/>, path:'/risks', color:'#ef4444' },
  { key:'compliance', label:'Compliance', icon:<FiShield/>, path:'/compliance', color:'#22c55e' },
  { key:'milestones', label:'Milestones', icon:<FiFlag/>, path:'/milestones', color:'#a855f7' },
  { key:'documents', label:'Documents', icon:<FiFolder/>, path:'/documents', color:'#f97316' },
  { key:'audit', label:'Audit Log', icon:<FiActivity/>, path:'/audit', color:'#0ea5e9' },
];

export default function Dashboard() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/dashboard').then(r => setStats(r.data)).catch(() => {}).finally(() => setLoading(false)); }, []);
  return (
    <div className="page-container">
      <div className="page-header"><div><h1 className="page-title">Dashboard</h1><p className="page-subtitle">AI Contract Lifecycle Manager Overview</p></div></div>
      {loading ? (<div className="loading"><div className="spinner"></div>Loading dashboard...</div>) : (
        <div className="stats-grid">{statMeta.map(s => (
          <Link key={s.key} to={s.path} className="stat-card">
            <div className="stat-icon" style={{color: s.color}}>{s.icon}</div>
            <div className="stat-value">{stats[s.key] ?? 0}</div>
            <div className="stat-label">{s.label}</div>
          </Link>
        ))}</div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './AuditTrail.css';

const AuditTrail = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [filters, setFilters] = useState({
    action: '',
    userRole: '',
    resourceType: '',
    startDate: '',
    endDate: ''
  });

  const fetchAuditLogs = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...filters
      });

      const response = await axios.get(`/api/audit/logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setLogs(response.data.data.logs);
        setHasNext(response.data.data.pagination.hasNext);
        setHasPrev(response.data.data.pagination.hasPrev);
        setCurrentPage(response.data.data.pagination.current);
      }
    } catch (error) {
      setError('Failed to load audit logs');
      console.error('Fetch audit logs error:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const exportAuditLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams({
        ...filters
      });

      const response = await axios.get(`/api/audit/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'audit_logs.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export audit logs error:', error);
      alert('Failed to export audit logs');
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const applyFilters = () => {
    setCurrentPage(1);
    fetchAuditLogs(1);
  };

  const clearFilters = () => {
    setFilters({
      action: '',
      userRole: '',
      resourceType: '',
      startDate: '',
      endDate: ''
    });
    setCurrentPage(1);
    fetchAuditLogs(1);
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'claim_created':
        return '📋';
      case 'claim_submitted':
        return '📤';
      case 'claim_status_updated':
        return '🔄';
      case 'claim_rejected':
        return '❌';
      case 'claim_withdrawn':
        return '↩️';
      case 'claim_approved':
        return '✅';
      case 'claim_paid':
        return '💰';
      case 'files_uploaded':
        return '📁';
      case 'file_flagged':
        return '⚠️';
      case 'files_resubmitted':
        return '📝';
      default:
        return '📊';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatDetails = (details) => {
    if (typeof details === 'object') {
      return Object.entries(details)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    }
    return details;
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  if (loading) {
    return (
      <div className="audit-trail-container">
        <div className="loading">Loading audit logs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="audit-trail-container">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="audit-trail-container">
      <div className="audit-header">
        <h2>Audit Trail</h2>
        <button 
          className="export-btn"
          onClick={exportAuditLogs}
        >
          Export CSV
        </button>
      </div>

      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Action:</label>
            <select 
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
            >
              <option value="">All Actions</option>
              <option value="claim_created">Claim Created</option>
              <option value="claim_submitted">Claim Submitted</option>
              <option value="claim_status_updated">Status Updated</option>
              <option value="claim_rejected">Claim Rejected</option>
              <option value="claim_withdrawn">Claim Withdrawn</option>
              <option value="claim_approved">Claim Approved</option>
              <option value="claim_paid">Claim Paid</option>
              <option value="files_uploaded">Files Uploaded</option>
              <option value="file_flagged">File Flagged</option>
              <option value="files_resubmitted">Files Resubmitted</option>
            </select>
          </div>

          <div className="filter-group">
            <label>User Role:</label>
            <select 
              value={filters.userRole}
              onChange={(e) => handleFilterChange('userRole', e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="client">Client</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Resource Type:</label>
            <select 
              value={filters.resourceType}
              onChange={(e) => handleFilterChange('resourceType', e.target.value)}
            >
              <option value="">All Resources</option>
              <option value="claim">Claim</option>
              <option value="file">File</option>
              <option value="user">User</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Start Date:</label>
            <input 
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>End Date:</label>
            <input 
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>
        </div>

        <div className="filter-actions">
          <button 
            className="apply-filters-btn"
            onClick={applyFilters}
          >
            Apply Filters
          </button>
          <button 
            className="clear-filters-btn"
            onClick={clearFilters}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="no-logs">
          <p>No audit logs found</p>
        </div>
      ) : (
        <div className="logs-list">
          {logs.map(log => (
            <div key={log._id} className="log-item">
              <div className="log-icon">
                {getActionIcon(log.action)}
              </div>
              <div className="log-content">
                <div className="log-header">
                  <h4>{log.action.replace(/_/g, ' ').toUpperCase()}</h4>
                  <span className="log-time">
                    {formatDate(log.timestamp)}
                  </span>
                </div>
                <div className="log-details">
                  <p><strong>User:</strong> {log.userId} ({log.userRole})</p>
                  {log.resourceType && (
                    <p><strong>Resource:</strong> {log.resourceType} {log.resourceId}</p>
                  )}
                  {log.details && Object.keys(log.details).length > 0 && (
                    <p><strong>Details:</strong> {formatDetails(log.details)}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(hasNext || hasPrev) && (
        <div className="logs-pagination">
          {hasPrev && (
            <button 
              className="pagination-btn"
              onClick={() => fetchAuditLogs(currentPage - 1)}
            >
              Previous
            </button>
          )}
          <span className="page-info">Page {currentPage}</span>
          {hasNext && (
            <button 
              className="pagination-btn"
              onClick={() => fetchAuditLogs(currentPage + 1)}
            >
              Next
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditTrail; 
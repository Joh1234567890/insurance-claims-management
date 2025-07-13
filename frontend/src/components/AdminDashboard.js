import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const AdminDashboard = () => {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/claims');
      setClaims(response.data.data.claims);
      setError(null);
    } catch (error) {
      console.error('Error fetching claims:', error);
      setError('Failed to load claims');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'status-pending',
      submitted: 'status-submitted',
      processing: 'status-processing',
      paid: 'status-paid',
      rejected: 'status-rejected'
    };
    return colors[status] || 'status-pending';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getFilteredClaims = () => {
    if (filter === 'all') return claims;
    return claims.filter(claim => claim.status === filter);
  };

  const getStatusCounts = () => {
    const counts = {
      all: claims.length,
      pending: claims.filter(c => c.status === 'pending').length,
      submitted: claims.filter(c => c.status === 'submitted').length,
      processing: claims.filter(c => c.status === 'processing').length,
      paid: claims.filter(c => c.status === 'paid').length,
      rejected: claims.filter(c => c.status === 'rejected').length
    };
    return counts;
  };

  if (loading) {
    return <div className="loading">Loading claims...</div>;
  }

  const statusCounts = getStatusCounts();
  const filteredClaims = getFilteredClaims();

  return (
    <div>
      <h1 className="page-title">Admin Dashboard</h1>

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      {/* Status Summary */}
      <div className="card mb-20">
        <h3>Claim Summary</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <div className="text-center">
            <h4>{statusCounts.all}</h4>
            <p>Total Claims</p>
          </div>
          <div className="text-center">
            <h4>{statusCounts.pending}</h4>
            <p>Pending</p>
          </div>
          <div className="text-center">
            <h4>{statusCounts.submitted}</h4>
            <p>Submitted</p>
          </div>
          <div className="text-center">
            <h4>{statusCounts.processing}</h4>
            <p>Processing</p>
          </div>
          <div className="text-center">
            <h4>{statusCounts.paid}</h4>
            <p>Paid</p>
          </div>
          <div className="text-center">
            <h4>{statusCounts.rejected}</h4>
            <p>Rejected</p>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="card mb-20">
        <h3>Filter Claims</h3>
        <div className="d-flex gap-10">
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`btn ${filter === status ? 'btn-primary' : 'btn-secondary'}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Claims List */}
      {filteredClaims.length === 0 ? (
        <div className="card text-center">
          <h3>No claims found</h3>
          <p>No claims match the current filter.</p>
        </div>
      ) : (
        <div className="grid">
          {filteredClaims.map((claim) => (
            <div key={claim._id} className="card">
              <div className="d-flex justify-between align-center mb-20">
                <h3>Claim #{claim._id.slice(-6)}</h3>
                <span className={`status-badge ${getStatusColor(claim.status)}`}>
                  {claim.status}
                </span>
              </div>
              
              <div className="mb-20">
                <p><strong>Vehicle:</strong> {claim.vehicleYear} {claim.vehicleMake} {claim.vehicleModel}</p>
                <p><strong>Incident Date:</strong> {formatDate(claim.incidentDate)}</p>
                <p><strong>Estimated Damage:</strong> {formatCurrency(claim.estimatedDamage)}</p>
                <p><strong>Files:</strong> {claim.files?.length || 0} uploaded</p>
                <p><strong>Created:</strong> {formatDate(claim.createdAt)}</p>
                {claim.files?.some(f => f.flagged) && (
                  <p style={{ color: '#dc3545', fontWeight: 'bold' }}>
                    ⚠️ Has flagged files
                  </p>
                )}
                {claim.status === 'pending' && (
                  <p style={{ color: '#ffc107', fontWeight: 'bold' }}>
                    📋 Ready to mark as submitted
                  </p>
                )}
                {claim.status === 'submitted' && (
                  <p style={{ color: '#007bff', fontWeight: 'bold' }}>
                    ✅ Ready for processing/rejection
                  </p>
                )}
              </div>
              
              <div className="d-flex gap-10">
                <Link to={`/claim/${claim._id}`} className="btn btn-primary">
                  Review Claim
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard; 
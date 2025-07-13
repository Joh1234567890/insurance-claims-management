import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const Dashboard = () => {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) {
    return (
      <div className="loading">
        <div>Loading your claims...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="dashboard-header">
        <h1 className="page-title">My Claims</h1>
        <Link to="/create-claim" className="btn btn-primary">
          Create New Claim
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      {claims.length === 0 ? (
        <div className="card text-center">
          <div style={{ padding: '40px 20px' }}>
            <h3 className="section-title" style={{ marginBottom: '16px' }}>No claims yet</h3>
            <p style={{ color: '#6b7280', marginBottom: '32px', fontSize: '16px' }}>
              Start by creating your first insurance claim to get started.
            </p>
            <Link to="/create-claim" className="btn btn-primary">
              Create Your First Claim
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid">
          {claims.map((claim) => (
            <div key={claim._id} className="claim-card">
              <div className="claim-header">
                <h3 className="claim-title">Claim #{claim._id.slice(-6)}</h3>
                <span className={`status-badge ${getStatusColor(claim.status)}`}>
                  {claim.status}
                </span>
              </div>
              
              <div className="claim-details">
                <p><strong>Vehicle:</strong> {claim.vehicleYear} {claim.vehicleMake} {claim.vehicleModel}</p>
                <p><strong>Incident Date:</strong> {formatDate(claim.incidentDate)}</p>
                <p><strong>Estimated Damage:</strong> {formatCurrency(claim.estimatedDamage)}</p>
                <p><strong>Files:</strong> {claim.files?.length || 0} uploaded</p>
                {claim.status === 'rejected' && claim.rejectionReason && (
                  <p style={{ color: '#dc2626', fontWeight: 'bold', marginTop: '8px' }}>
                    ⚠️ Rejected: {claim.rejectionReason.substring(0, 50)}...
                  </p>
                )}
              </div>
              
              <Link to={`/claim/${claim._id}`} className="btn btn-primary">
                View Details
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard; 
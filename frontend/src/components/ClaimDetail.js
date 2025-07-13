import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const ClaimDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replacingFile, setReplacingFile] = useState(null);
  const [fileComments, setFileComments] = useState({});
  const [flaggingFile, setFlaggingFile] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedRejectedFiles, setSelectedRejectedFiles] = useState([]);
  const [rejectingClaim, setRejectingClaim] = useState(false);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [resubmittingFiles, setResubmittingFiles] = useState(false);
  const [resubmittingClaim, setResubmittingClaim] = useState(false);
  const [showRejectionForm, setShowRejectionForm] = useState(false);

  const fetchClaim = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/claims/${id}`);
      setClaim(response.data.data.claim);
      setError(null);
    } catch (error) {
      console.error('Error fetching claim:', error);
      setError('Failed to load claim');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchClaim();
  }, [fetchClaim]);



  const handleFileReplace = async (fileId, file) => {
    setReplacingFile(fileId);
    try {
      const formData = new FormData();
      formData.append('file', file);

      await axios.put(`/api/files/${id}/${fileId}/replace`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      fetchClaim();
    } catch (error) {
      console.error('Error replacing file:', error);
      setError(error.response?.data?.message || 'Failed to replace file');
    } finally {
      setReplacingFile(null);
    }
  };

  const handleFlagFile = async (fileId, commentText) => {
    if (!commentText || !commentText.trim()) {
      setError('Please provide a comment when flagging a file');
      return;
    }

    if (commentText.trim().length < 5) {
      setError('Comment must be at least 5 characters long');
      return;
    }

    setFlaggingFile(fileId);
    try {
      await axios.put(`/api/files/${id}/${fileId}/flag`, { comment: commentText.trim() });
      fetchClaim();
      setFileComments(prev => {
        const newComments = { ...prev };
        delete newComments[fileId];
        return newComments;
      });
    } catch (error) {
      console.error('Error flagging file:', error);
      setError(error.response?.data?.message || 'Failed to flag file');
    } finally {
      setFlaggingFile(null);
    }
  };

  const handleUnflagFile = async (fileId) => {
    try {
      await axios.put(`/api/files/${id}/${fileId}/unflag`);
      fetchClaim();
    } catch (error) {
      console.error('Error unflagging file:', error);
      setError(error.response?.data?.message || 'Failed to unflag file');
    }
  };

  const handleStatusUpdate = async (newStatus, pushToSystem = false) => {
    try {
      await axios.put(`/api/claims/${id}/status`, { 
        status: newStatus, 
        pushToSystem 
      });
      fetchClaim();
    } catch (error) {
      console.error('Error updating status:', error);
      setError(error.response?.data?.message || 'Failed to update status');
    }
  };

  const handleSubmitClaim = async () => {
    setSubmittingClaim(true);
    try {
      await axios.post(`/api/workflow/submit/${id}`);
      fetchClaim();
    } catch (error) {
      console.error('Error submitting claim:', error);
      setError(error.response?.data?.message || 'Failed to submit claim');
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleMarkAsSubmitted = async () => {
    try {
      await axios.post(`/api/workflow/mark-submitted/${id}`);
      fetchClaim();
    } catch (error) {
      console.error('Error marking claim as submitted:', error);
      setError(error.response?.data?.message || 'Failed to mark claim as submitted');
    }
  };

  const handleApproveClaim = async () => {
    try {
      await axios.post(`/api/workflow/approve/${id}`);
      fetchClaim();
    } catch (error) {
      console.error('Error approving claim:', error);
      setError(error.response?.data?.message || 'Failed to approve claim');
    }
  };

  const handleRejectClaim = async () => {
    if (!rejectionReason.trim() || rejectionReason.trim().length < 10) {
      setError('Please provide a detailed rejection reason (at least 10 characters)');
      return;
    }

    setRejectingClaim(true);
    try {
      await axios.put(`/api/claims/${id}/reject`, {
        reason: rejectionReason.trim(),
        rejectedFiles: selectedRejectedFiles
      });
      fetchClaim();
      setRejectionReason('');
      setSelectedRejectedFiles([]);
      setShowRejectionForm(false);
    } catch (error) {
      console.error('Error rejecting claim:', error);
      setError(error.response?.data?.message || 'Failed to reject claim');
    } finally {
      setRejectingClaim(false);
    }
  };

  const handleResubmitClaim = async () => {
    setResubmittingClaim(true);
    try {
      await axios.put(`/api/claims/${id}/resubmit`);
      fetchClaim();
    } catch (error) {
      console.error('Error resubmitting claim:', error);
      setError(error.response?.data?.message || 'Failed to resubmit claim');
    } finally {
      setResubmittingClaim(false);
    }
  };

  const handleResubmitFiles = async () => {
    if (!claim?.filesToResubmit || claim.filesToResubmit.length === 0) {
      setError('No files to resubmit');
      return;
    }

    setResubmittingFiles(true);
    try {
      await axios.post(`/api/workflow/resubmit/${id}`, {
        resubmittedFiles: claim.filesToResubmit.map(fileId => ({ fileId }))
      });
      fetchClaim();
    } catch (error) {
      console.error('Error resubmitting files:', error);
      setError(error.response?.data?.message || 'Failed to resubmit files');
    } finally {
      setResubmittingFiles(false);
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

  const getDocumentTypeLabel = (documentType) => {
    const labels = {
      driversLicense: "Driver's License",
      vehicleRegistration: "Vehicle Registration",
      insurancePolicy: "Insurance Policy",
      policeReport: "Police Report",
      repairEstimate: "Repair Estimate"
    };
    return labels[documentType] || documentType;
  };

  const groupFilesByType = (files) => {
    const grouped = {};
    files.forEach(file => {
      const type = file.documentType || 'other';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(file);
    });
    return grouped;
  };

  if (loading) {
    return <div className="loading">Loading claim...</div>;
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        {error}
        <button 
          onClick={() => navigate('/dashboard')} 
          className="btn btn-secondary"
          style={{ marginLeft: '10px' }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!claim) {
    return <div className="alert alert-danger">Claim not found</div>;
  }

  const groupedFiles = groupFilesByType(claim.files || []);

  return (
    <div>
      <div className="d-flex justify-between align-center mb-20">
        <h1 className="page-title">Claim #{claim._id.slice(-6)}</h1>
        <button 
          onClick={() => navigate('/dashboard')} 
          className="btn btn-secondary"
        >
          Back to Dashboard
        </button>
      </div>

      <div className="card">
        <div className="d-flex justify-between align-center mb-20">
          <h2>Claim Details</h2>
          <span className={`status-badge ${getStatusColor(claim.status)}`}>
            {claim.status}
          </span>
        </div>

        <div className="grid">
          <div>
            <p><strong>Vehicle:</strong> {claim.vehicleYear} {claim.vehicleMake} {claim.vehicleModel}</p>
            <p><strong>Incident Date:</strong> {formatDate(claim.incidentDate)}</p>
            <p><strong>Estimated Damage:</strong> {formatCurrency(claim.estimatedDamage)}</p>
            <p><strong>Created:</strong> {formatDate(claim.createdAt)}</p>
          </div>
          <div>
            <p><strong>Description:</strong></p>
            <p style={{ whiteSpace: 'pre-wrap' }}>{claim.description}</p>
          </div>
        </div>

        {/* Rejection Information for Clients */}
        {claim.status === 'rejected' && claim.rejectionReason && (
          <div className="mt-20" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px' }}>
            <h4 style={{ color: '#dc2626', marginBottom: '12px' }}>⚠️ Claim Rejected</h4>
            <p><strong>Rejection Reason:</strong></p>
            <p style={{ whiteSpace: 'pre-wrap', color: '#991b1b' }}>{claim.rejectionReason}</p>
            <p><strong>Rejected on:</strong> {formatDate(claim.rejectedAt)}</p>
            
            {claim.rejectedFiles && claim.rejectedFiles.length > 0 && (
              <div className="mt-12">
                <p><strong>Files Returned for Correction:</strong></p>
                <ul style={{ marginLeft: '20px', color: '#991b1b' }}>
                  {claim.rejectedFiles.map((fileId) => {
                    const file = claim.files.find(f => f._id === fileId);
                    return file ? (
                      <li key={fileId}>
                        {file.originalName} ({getDocumentTypeLabel(file.documentType)})
                      </li>
                    ) : null;
                  })}
                </ul>
                <p style={{ fontSize: '14px', color: '#7f1d1d', marginTop: '8px' }}>
                  Please review the rejection reason and correct the returned files before resubmitting your claim.
                </p>
              </div>
            )}

            {/* Resubmission Section for Rejected Claims */}
            {user?.role === 'client' && (
              <div className="mt-16" style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '16px' }}>
                <h5 style={{ color: '#0369a1', marginBottom: '12px' }}>📝 Resubmit Claim</h5>
                <p style={{ color: '#0369a1', marginBottom: '16px' }}>
                  You can upload new documents and resubmit your claim for review.
                </p>
                
                <div className="d-flex gap-10">
                  <button 
                    onClick={handleResubmitClaim}
                    className="btn btn-primary"
                    disabled={resubmittingClaim}
                  >
                    {resubmittingClaim ? 'Resubmitting...' : 'Resubmit Claim'}
                  </button>
                  
                  <p style={{ fontSize: '14px', color: '#0369a1', margin: '0' }}>
                    Upload new documents above, then click "Resubmit Claim"
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resubmission Request for Clients */}
        {user?.role === 'client' && claim.status === 'pending' && claim.resubmissionReason && (
          <div className="mt-20" style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '16px' }}>
            <h4 style={{ color: '#92400e', marginBottom: '12px' }}>📝 Resubmission Required</h4>
            <p><strong>Reason:</strong></p>
            <p style={{ whiteSpace: 'pre-wrap', color: '#92400e' }}>{claim.resubmissionReason}</p>
            <p><strong>Requested on:</strong> {formatDate(claim.resubmissionRequestedAt)}</p>
            
            {claim.filesToResubmit && claim.filesToResubmit.length > 0 && (
              <div className="mt-12">
                <p><strong>Files to Resubmit:</strong></p>
                <ul style={{ marginLeft: '20px', color: '#92400e' }}>
                  {claim.filesToResubmit.map((fileId) => {
                    const file = claim.files.find(f => f._id === fileId);
                    return file ? (
                      <li key={fileId}>
                        {file.originalName} ({getDocumentTypeLabel(file.documentType)})
                      </li>
                    ) : null;
                  })}
                </ul>
                <button 
                  onClick={handleResubmitFiles}
                  className="btn btn-warning"
                  disabled={resubmittingFiles}
                >
                  {resubmittingFiles ? 'Resubmitting...' : 'Mark Files as Resubmitted'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Admin Status Controls */}
        {user?.role === 'admin' && (
          <div className="mt-20">
            <h3>Admin Controls</h3>
            
            {/* Check if any files are flagged */}
            {claim.files && claim.files.some(file => file.flagged) ? (
              /* Show Rejection Controls when files are flagged */
              <div>
                <h4>Reject Claim (Files Flagged)</h4>
                <div className="form-group">
                  <label className="form-label">Rejection Reason *</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="form-control"
                    rows="3"
                    placeholder="Provide detailed reason for rejection (minimum 10 characters)..."
                    minLength="10"
                  />
                </div>
                
                <button 
                  onClick={handleRejectClaim}
                  className="btn btn-danger"
                  disabled={rejectingClaim || !rejectionReason.trim() || rejectionReason.trim().length < 10}
                >
                  {rejectingClaim ? 'Rejecting...' : 'Reject Claim'}
                </button>
              </div>
            ) : (
              /* Show Processing Controls when no files are flagged */
            <div className="d-flex gap-10">
              {claim.status === 'pending' && (
                <button 
                  onClick={handleMarkAsSubmitted}
                  className="btn btn-warning"
                >
                  Mark as Submitted
                </button>
              )}
              {claim.status === 'submitted' && (
                <>
                  <button 
                    onClick={handleApproveClaim}
                    className="btn btn-primary"
                  >
                    Approve for Processing
                  </button>
                  <button 
                    onClick={() => setShowRejectionForm(true)}
                    className="btn btn-danger"
                  >
                    Reject Claim
                  </button>
                </>
              )}
              {claim.status === 'processing' && (
                  <button 
                    onClick={() => handleStatusUpdate('paid')}
                    className="btn btn-success"
                  >
                    Mark as Paid
                  </button>
              )}
            </div>
            )}

            {/* Rejection Form Modal */}
            {showRejectionForm && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <h4>Reject Claim</h4>
                  <div className="form-group">
                    <label className="form-label">Rejection Reason *</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="form-control"
                      rows="3"
                      placeholder="Provide detailed reason for rejection (minimum 10 characters)..."
                      minLength="10"
                    />
                  </div>
                  
                  <div className="d-flex gap-10">
                    <button 
                      onClick={handleRejectClaim}
                      className="btn btn-danger"
                      disabled={rejectingClaim || !rejectionReason.trim() || rejectionReason.trim().length < 10}
                    >
                      {rejectingClaim ? 'Rejecting...' : 'Reject Claim'}
                    </button>
                    <button 
                      onClick={() => {
                        setShowRejectionForm(false);
                        setRejectionReason('');
                      }}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Documents Section */}
      <div className="card mt-20">
        <div className="d-flex justify-between align-center mb-20">
          <h3>Documents ({claim.files?.length || 0})</h3>
        </div>

        {claim.files?.length === 0 ? (
          <p>No documents uploaded yet.</p>
        ) : (
          <div>
            {Object.entries(groupedFiles).map(([documentType, files]) => (
              <div key={documentType} className="mb-20">
                <h4 style={{ color: '#333', marginBottom: '10px' }}>
                  {getDocumentTypeLabel(documentType)} ({files.length})
                </h4>
                {files.map((file) => (
              <div key={file._id} className={`file-item ${file.flagged ? 'flagged' : ''}`}>
                <div className="d-flex justify-between align-center">
                  <div>
                    <strong>{file.originalName}</strong>
                    <br />
                    <small>
                      Size: {(file.size / 1024 / 1024).toFixed(2)} MB | 
                      Uploaded: {formatDate(file.uploadDate)}
                    </small>
                    {file.flagged && (
                      <div style={{ marginTop: '5px' }}>
                        <strong style={{ color: '#dc3545' }}>FLAGGED</strong>
                        <br />
                        <small><strong>Comment:</strong> {file.adminComments}</small>
                      </div>
                    )}
                  </div>
                  <div className="file-actions">
                    <a 
                          href={`http://localhost:5000/uploads/${id}/${file.filename}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                    >
                      View
                    </a>
                    
                    {file.flagged && user?.role === 'client' && (
                      <div className="file-replace-section">
                        <div className="drag-drop-zone-small">
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.txt"
                            onChange={(e) => {
                              if (e.target.files[0]) {
                                handleFileReplace(file._id, e.target.files[0]);
                              }
                            }}
                            disabled={replacingFile === file._id}
                            style={{ display: 'none' }}
                            id={`replace-${file._id}`}
                          />
                          <label 
                            htmlFor={`replace-${file._id}`} 
                            className="drag-drop-content-small"
                          >
                            <span className="drag-drop-icon-small">📁</span>
                            <span className="drag-drop-text-small">
                              {replacingFile === file._id ? 'Replacing...' : 'Drag & Drop or Click to Replace'}
                            </span>
                          </label>
                        </div>
                      </div>
                    )}

                    {user?.role === 'admin' && !file.flagged && (
                      <div>
                        <input
                          type="text"
                          placeholder="Flag comment..."
                              value={fileComments[file._id] || ''}
                              onChange={(e) => setFileComments({ ...fileComments, [file._id]: e.target.value })}
                          className="form-control"
                          style={{ width: '200px', marginRight: '10px' }}
                        />
                        <button 
                              onClick={() => handleFlagFile(file._id, fileComments[file._id])}
                          className="btn btn-danger"
                              disabled={flaggingFile === file._id}
                        >
                              {flaggingFile === file._id ? 'Flagging...' : 'Flag'}
                        </button>
                      </div>
                    )}

                    {user?.role === 'admin' && file.flagged && (
                      <button 
                        onClick={() => handleUnflagFile(file._id)}
                        className="btn btn-success"
                      >
                        Unflag
                      </button>
                    )}
                  </div>
                </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClaimDetail; 
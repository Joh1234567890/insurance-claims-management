import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Drag and Drop File Upload Component
const DragDropFileUpload = ({ 
  documentType, 
  label, 
  description, 
  required, 
  onFileChange, 
  selectedFile, 
  uploadStatus 
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'text/plain'];
      if (allowedTypes.includes(file.type)) {
        onFileChange(documentType, file);
      }
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) {
      onFileChange(documentType, file);
    }
  };

  return (
    <div className="file-upload-section">
      <div className="file-upload-header">
        <div>
          <h4 className="file-upload-title">
            {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
          </h4>
          <p className="file-upload-description">
            {description}
          </p>
        </div>
        <div>
          {uploadStatus.uploaded && (
            <span className="file-upload-status success">✓ Uploaded</span>
          )}
          {uploadStatus.error && (
            <span className="file-upload-status error">{uploadStatus.error}</span>
          )}
        </div>
      </div>

      <div
        className={`drag-drop-zone ${isDragOver ? 'drag-over' : ''} ${selectedFile ? 'has-file' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id={documentType}
          accept=".pdf,.jpg,.jpeg,.png,.txt"
          onChange={handleFileInput}
          className="file-input"
        />
        
        {selectedFile ? (
          <div className="file-selected">
            <div className="file-info">
              <strong>Selected:</strong> {selectedFile.name}
              <span className="file-size">
                ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => onFileChange(documentType, null)}
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="drag-drop-content">
            <div className="drag-drop-icon">📁</div>
            <p className="drag-drop-text">
              <strong>Drag and drop your file here</strong>
            </p>
            <p className="drag-drop-subtext">
              or <label htmlFor={documentType} className="browse-link">browse files</label>
            </p>
            <p className="drag-drop-formats">
              Supported: PDF, JPG, JPEG, PNG, TXT (max 10MB)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const CreateClaim = () => {
  const [formData, setFormData] = useState({
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    incidentDate: '',
    description: '',
    estimatedDamage: ''
  });

  // Separate state for each required document
  const [documents, setDocuments] = useState({
    driversLicense: null,
    vehicleRegistration: null,
    insurancePolicy: null,
    policeReport: null,
    repairEstimate: null
  });

  const [uploadStatus, setUploadStatus] = useState({
    driversLicense: { uploaded: false, error: null },
    vehicleRegistration: { uploaded: false, error: null },
    insurancePolicy: { uploaded: false, error: null },
    policeReport: { uploaded: false, error: null },
    repairEstimate: { uploaded: false, error: null }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (documentType, file) => {
    setDocuments(prev => ({
      ...prev,
      [documentType]: file
    }));
    
    // Clear any previous errors for this document
    setUploadStatus(prev => ({
      ...prev,
      [documentType]: { uploaded: false, error: null }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Create claim first
      const claimResponse = await axios.post('/api/claims', formData);
      const claimId = claimResponse.data.data.claim._id;

      // Upload each document individually
      const uploadPromises = Object.entries(documents)
        .filter(([_, file]) => file !== null)
        .map(async ([documentType, file]) => {
          if (!file) return;

          const formData = new FormData();
          formData.append('files', file);

          try {
            await axios.post(`/api/files/${claimId}/${documentType}/upload`, formData, {
              headers: {
                'Content-Type': 'multipart/form-data'
              }
            });

            setUploadStatus(prev => ({
              ...prev,
              [documentType]: { uploaded: true, error: null }
            }));
          } catch (error) {
            setUploadStatus(prev => ({
              ...prev,
              [documentType]: { uploaded: false, error: error.response?.data?.message || 'Upload failed' }
            }));
            throw error;
          }
        });

      await Promise.all(uploadPromises);

      setSuccess('Claim created successfully with all documents!');
      setTimeout(() => {
        navigate(`/claim/${claimId}`);
      }, 2000);

    } catch (error) {
      console.error('Error creating claim:', error);
      setError(error.response?.data?.message || 'Failed to create claim');
    } finally {
      setLoading(false);
    }
  };

  const requiredDocuments = [
    {
      key: 'driversLicense',
      label: "Driver's License",
      description: "Upload a clear copy of your driver's license",
      required: true
    },
    {
      key: 'vehicleRegistration',
      label: "Vehicle Registration",
      description: "Upload your vehicle registration document",
      required: true
    },
    {
      key: 'insurancePolicy',
      label: "Insurance Policy",
      description: "Upload your current insurance policy document",
      required: true
    },
    {
      key: 'policeReport',
      label: "Police Report",
      description: "Upload the police report if applicable",
      required: false
    },
    {
      key: 'repairEstimate',
      label: "Repair Estimate",
      description: "Upload the repair estimate from a certified mechanic",
      required: true
    }
  ];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 className="page-title">Create New Claim</h1>

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit}>
          {/* Vehicle Information */}
          <div className="form-section">
            <h3 className="section-title">Vehicle Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="vehicleMake" className="form-label">Vehicle Make *</label>
                <input
                  type="text"
                  id="vehicleMake"
                  name="vehicleMake"
                  className="form-control"
                  value={formData.vehicleMake}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Toyota, Honda, Ford"
                />
              </div>

              <div className="form-group">
                <label htmlFor="vehicleModel" className="form-label">Vehicle Model *</label>
                <input
                  type="text"
                  id="vehicleModel"
                  name="vehicleModel"
                  className="form-control"
                  value={formData.vehicleModel}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Camry, Civic, F-150"
                />
              </div>

              <div className="form-group">
                <label htmlFor="vehicleYear" className="form-label">Vehicle Year *</label>
                <input
                  type="number"
                  id="vehicleYear"
                  name="vehicleYear"
                  className="form-control"
                  value={formData.vehicleYear}
                  onChange={handleChange}
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  required
                  placeholder="e.g., 2020"
                />
              </div>

              <div className="form-group">
                <label htmlFor="incidentDate" className="form-label">Incident Date *</label>
                <input
                  type="date"
                  id="incidentDate"
                  name="incidentDate"
                  className="form-control"
                  value={formData.incidentDate}
                  onChange={handleChange}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="estimatedDamage" className="form-label">Estimated Damage ($) *</label>
              <input
                type="number"
                id="estimatedDamage"
                name="estimatedDamage"
                className="form-control"
                value={formData.estimatedDamage}
                onChange={handleChange}
                min="0"
                step="0.01"
                required
                placeholder="e.g., 2500.00"
              />
            </div>

            <div className="form-group">
              <label htmlFor="description" className="form-label">Incident Description *</label>
              <textarea
                id="description"
                name="description"
                className="form-control"
                value={formData.description}
                onChange={handleChange}
                rows="4"
                minLength="10"
                maxLength="1000"
                required
                placeholder="Describe the incident in detail, including what happened, when, and any relevant details..."
              />
            </div>
          </div>

          {/* Required Documents */}
          <div className="form-section">
            <h3 className="section-title">Required Documents</h3>
            <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '14px' }}>
              Please upload the following documents. Required documents are marked with *. 
              Supported formats: PDF, JPG, JPEG, PNG, TXT (max 10MB each)
            </p>

            {requiredDocuments.map((doc) => (
              <DragDropFileUpload
                key={doc.key}
                documentType={doc.key}
                label={doc.label}
                description={doc.description}
                required={doc.required}
                onFileChange={handleFileChange}
                selectedFile={documents[doc.key]}
                uploadStatus={uploadStatus[doc.key]}
              />
            ))}
          </div>

          <div className="d-flex gap-16">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating Claim...' : 'Create Claim'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/dashboard')}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateClaim; 
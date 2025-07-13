const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const path = require('path');
require('dotenv').config();

const { connectDB } = require('./config/database');
const authRoutes = require('./routes/auth');
const claimRoutes = require('./routes/claims');
const fileRoutes = require('./routes/files');
const workflowRoutes = require('./routes/workflow');
const notificationRoutes = require('./routes/notifications');
const auditRoutes = require('./routes/audit');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Insurance Claim Management API is running',
    timestamp: new Date().toISOString()
  });
});

// File serving route - MUST be before the catch-all 404 handler
app.get('/uploads/:claimId/:filename', (req, res) => {
  const { claimId, filename } = req.params;
  
  // Security: Validate parameters
  if (!claimId || !filename) {
    console.log('Missing parameters:', { claimId, filename });
    return res.status(400).json({
      success: false,
      message: 'Missing claim ID or filename'
    });
  }

  // Security: Validate claimId format (should be ObjectId)
  const ObjectId = require('mongodb').ObjectId;
  if (!ObjectId.isValid(claimId)) {
    console.log('Invalid claim ID format:', claimId);
    return res.status(400).json({
      success: false,
      message: 'Invalid claim ID format'
    });
  }

  // Security: Sanitize filename to prevent directory traversal
  const sanitizedFilename = path.basename(filename);
  if (sanitizedFilename !== filename) {
    console.log('Potential directory traversal attempt:', filename);
    return res.status(400).json({
      success: false,
      message: 'Invalid filename'
    });
  }

  const filePath = path.join(__dirname, 'uploads', claimId, sanitizedFilename);
  
  console.log('File access request:', { claimId, filename: sanitizedFilename, filePath });
  
  // Check if file exists
  const fs = require('fs');
  if (!fs.existsSync(filePath)) {
    console.log('File not found:', filePath);
    return res.status(404).json({
      success: false,
      message: 'File not found'
    });
  }

  // Check if path is actually a file (not a directory)
  const stats = fs.statSync(filePath);
  if (!stats.isFile()) {
    console.log('Path is not a file:', filePath);
    return res.status(400).json({
      success: false,
      message: 'Invalid file path'
    });
  }
  
  // Serve the file
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving file:', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error serving file'
        });
      }
    }
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Handle 404 - MUST be after all other routes
app.use('*', (req, res) => {
  console.log('404 Route not found:', req.method, req.originalUrl);
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 
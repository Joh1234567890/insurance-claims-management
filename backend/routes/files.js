const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../config/database');
const { protect, authorize } = require('../middleware/auth');
const { upload, handleUploadError, deleteFile, getFileInfo } = require('../middleware/upload');
const { validateFileReplacement, validateAdminComment } = require('../utils/validation');
const AuditTrail = require('../models/audit');
const NotificationService = require('../services/notification');

const router = express.Router();

// Test route to check if files router is working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Files router is working'
  });
});

// @route   POST /api/files/:claimId/upload
// @desc    Upload files to a claim
// @access  Private
router.post('/:claimId/upload', protect, upload.array('files', 10), handleUploadError, async (req, res) => {
  try {
    const { claimId } = req.params;
    const db = getDB();

    if (!ObjectId.isValid(claimId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid claim ID'
      });
    }

    // Check if claim exists and user has access
    const claim = await db.collection('claims').findOne({ _id: new ObjectId(claimId) });
    
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    if (req.user.role === 'client' && claim.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to upload files to this claim'
      });
    }

    // Check if claim is in a state that allows file uploads
    if (claim.status === 'paid' || claim.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Cannot upload files to a completed claim'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Process uploaded files
    const uploadedFiles = req.files.map(file => ({
              _id: new ObjectId(),
      ...getFileInfo(file)
    }));

    
    await db.collection('claims').updateOne(
      { _id: new ObjectId(claimId) },
      { 
        $push: { files: { $each: uploadedFiles } },
        $set: { updatedAt: new Date() }
      }
    );

    // Log the action
    await AuditTrail.log(
      'files_uploaded',
      { 
        claimId: claimId,
        fileCount: uploadedFiles.length,
        fileNames: uploadedFiles.map(f => f.originalName)
      },
      req.user.id,
      req.user.role,
      'claim',
      claimId
    );

    // Notify admins if client uploaded files
    if (req.user.role === 'client') {
      const adminIds = await NotificationService.getAdminUsers();
      await NotificationService.notifyAdminClaimUpdated(claimId, adminIds, 'file_uploaded');
    }

    res.status(201).json({
      success: true,
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      data: { files: uploadedFiles }
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error uploading files'
    });
  }
});

// @route   POST /api/files/:claimId/:documentType/upload
// @desc    Upload specific document type to a claim
// @access  Private
router.post('/:claimId/:documentType/upload', protect, upload.single('files'), handleUploadError, async (req, res) => {
  try {
    const { claimId, documentType } = req.params;
    const db = getDB();

    if (!ObjectId.isValid(claimId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid claim ID'
      });
    }

    // Validate document type
    const validDocumentTypes = ['driversLicense', 'vehicleRegistration', 'insurancePolicy', 'policeReport', 'repairEstimate'];
    if (!validDocumentTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document type'
      });
    }

    // Check if claim exists and user has access
    const claim = await db.collection('claims').findOne({ _id: new ObjectId(claimId) });
    
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    if (req.user.role === 'client' && claim.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to upload files to this claim'
      });
    }

    // Check if claim is in a state that allows file uploads
    if (claim.status === 'paid' || claim.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Cannot upload files to a completed claim'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Create file info with document type
    const fileInfo = {
              _id: new ObjectId(),
      ...getFileInfo(req.file),
      documentType: documentType,
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadDate: new Date(),
      flagged: false,
      adminComments: null
    };

    // Check if this document type already exists and remove it
    await db.collection('claims').updateOne(
      { _id: new ObjectId(claimId) },
      { 
        $pull: { files: { documentType: documentType } }
      }
    );

    
    await db.collection('claims').updateOne(
      { _id: new ObjectId(claimId) },
      { 
        $push: { files: fileInfo },
        $set: { updatedAt: new Date() }
      }
    );

    res.status(201).json({
      success: true,
      message: `${documentType} uploaded successfully`,
      data: { file: fileInfo }
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error uploading document'
    });
  }
});

// @route   PUT /api/files/:claimId/:fileId/replace
// @desc    Replace a flagged file
// @access  Private
router.put('/:claimId/:fileId/replace', protect, upload.single('file'), handleUploadError, validateFileReplacement, async (req, res) => {
  try {
    const { claimId, fileId } = req.params;
    const db = getDB();

    console.log('=== FILE REPLACEMENT REQUEST ===');
    console.log('File replacement request:', { claimId, fileId, user: req.user.id, role: req.user.role });
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);

    // Validate ObjectIds
    if (!ObjectId.isValid(claimId) || !ObjectId.isValid(fileId)) {
      console.log('Invalid ObjectId:', { claimId, fileId });
      return res.status(400).json({
        success: false,
        message: 'Invalid claim ID or file ID'
      });
    }

    // Check if claim exists and user has access
    const claim = await db.collection('claims').findOne({ _id: new ObjectId(claimId) });
    
    if (!claim) {
      console.log('Claim not found:', claimId);
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    console.log('Claim found:', { claimId: claim._id, userId: claim.userId, status: claim.status });

    if (req.user.role === 'client' && claim.userId.toString() !== req.user.id.toString()) {
      console.log('Authorization failed:', { userRole: req.user.role, claimUserId: claim.userId, requestUserId: req.user.id });
      return res.status(403).json({
        success: false,
        message: 'Not authorized to replace files in this claim'
      });
    }

    // Find the file to replace
    const fileIndex = claim.files.findIndex(file => file._id.toString() === fileId);
    
    if (fileIndex === -1) {
      console.log('File not found in claim:', fileId);
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const fileToReplace = claim.files[fileIndex];
    console.log('File to replace:', { fileId, flagged: fileToReplace.flagged, path: fileToReplace.path, originalName: fileToReplace.originalName });

    // Check if file is flagged (only flagged files can be replaced)
    if (!fileToReplace.flagged) {
      console.log('File is not flagged:', fileId);
      return res.status(400).json({
        success: false,
        message: 'Only flagged files can be replaced'
      });
    }

    if (!req.file) {
      console.log('No replacement file uploaded');
      return res.status(400).json({
        success: false,
        message: 'No replacement file uploaded'
      });
    }

    console.log('Replacement file:', { 
      originalName: req.file.originalname, 
      filename: req.file.filename, 
      path: req.file.path,
      size: req.file.size 
    });

    // Validate the old file path exists before attempting deletion
    const oldFilePath = fileToReplace.path;
    console.log('Attempting to delete old file:', oldFilePath);
    
    if (!oldFilePath) {
      console.log('No old file path found');
      return res.status(500).json({
        success: false,
        message: 'Invalid file path for replacement'
      });
    }

    // Check if old file exists before deleting
    const fs = require('fs');
    if (fs.existsSync(oldFilePath)) {
      const deleteResult = await deleteFile(oldFilePath);
      console.log('Old file deletion result:', deleteResult);
    } else {
      console.log('Old file does not exist on disk:', oldFilePath);
      // Continue with replacement even if old file doesn't exist
    }

    // Create new file info
    const newFileInfo = {
      ...getFileInfo(req.file),
      _id: new ObjectId(), // Generate new ID for the replacement
      replacedFileId: fileToReplace._id, // Keep reference to original
      documentType: fileToReplace.documentType // Preserve document type
    };

    console.log('New file info:', newFileInfo);

    
    // Use separate operations to avoid MongoDB conflict
    const pullResult = await db.collection('claims').updateOne(
      { _id: new ObjectId(claimId) },
      { 
        $pull: { files: { _id: fileToReplace._id } }
      }
    );

    console.log('Pull operation result:', pullResult);

    const pushResult = await db.collection('claims').updateOne(
      { _id: new ObjectId(claimId) },
      { 
        $push: { files: newFileInfo },
        $set: { updatedAt: new Date() }
      }
    );

    console.log('Push operation result:', pushResult);

    if (pullResult.modifiedCount === 0 || pushResult.modifiedCount === 0) {
      console.log('Database update failed:', { pullModified: pullResult.modifiedCount, pushModified: pushResult.modifiedCount });
      return res.status(500).json({
        success: false,
        message: 'Failed to update claim with new file'
      });
    }

    // Log the action
    await AuditTrail.log(
      'file_replaced',
      { 
        claimId: claimId,
        oldFileId: fileToReplace._id,
        newFileId: newFileInfo._id,
        oldFileName: fileToReplace.originalName,
        newFileName: newFileInfo.originalName
      },
      req.user.id,
      req.user.role,
      'file',
      fileId
    );

    res.json({
      success: true,
      message: 'File replaced successfully',
      data: { 
        replacedFile: fileToReplace,
        newFile: newFileInfo
      }
    });
  } catch (error) {
    console.error('=== FILE REPLACEMENT ERROR ===');
    console.error('File replacement error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error replacing file'
    });
  }
});

// @route   PUT /api/files/:claimId/:fileId/flag
// @desc    Flag a file with admin comment (Admin only)
// @access  Private (Admin only)
router.put('/:claimId/:fileId/flag', protect, authorize('admin'), validateAdminComment, async (req, res) => {
  try {
    const { claimId, fileId } = req.params;
    const { comment } = req.body;
    const db = getDB();

    // Check if claim exists
    const claim = await db.collection('claims').findOne({ _id: new ObjectId(claimId) });
    
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    // Find the file to flag
    const fileIndex = claim.files.findIndex(file => file._id.toString() === fileId);
    
    if (fileIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const fileToFlag = claim.files[fileIndex];

    // Check if file is already flagged
    if (fileToFlag.flagged) {
      return res.status(400).json({
        success: false,
        message: 'File is already flagged'
      });
    }

    
    await db.collection('claims').updateOne(
      { 
        _id: new ObjectId(claimId),
        'files._id': fileToFlag._id
      },
      { 
        $set: { 
          'files.$.flagged': true,
          'files.$.adminComments': comment,
          'files.$.flaggedAt': new Date(),
          'files.$.flaggedBy': req.user.id,
          updatedAt: new Date()
        }
      }
    );

    res.json({
      success: true,
      message: 'File flagged successfully',
      data: { 
        fileId,
        flagged: true,
        adminComments: comment
      }
    });
  } catch (error) {
    console.error('File flag error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error flagging file'
    });
  }
});

// @route   PUT /api/files/:claimId/:fileId/unflag
// @desc    Remove flag from a file (Admin only)
// @access  Private (Admin only)
router.put('/:claimId/:fileId/unflag', protect, authorize('admin'), async (req, res) => {
  try {
    const { claimId, fileId } = req.params;
    const db = getDB();

    // Check if claim exists
    const claim = await db.collection('claims').findOne({ _id: new ObjectId(claimId) });
    
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    // Find the file to unflag
    const fileIndex = claim.files.findIndex(file => file._id.toString() === fileId);
    
    if (fileIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const fileToUnflag = claim.files[fileIndex];

    // Check if file is flagged
    if (!fileToUnflag.flagged) {
      return res.status(400).json({
        success: false,
        message: 'File is not flagged'
      });
    }

    
    await db.collection('claims').updateOne(
      { 
        _id: new ObjectId(claimId),
        'files._id': fileToUnflag._id
      },
      { 
        $unset: { 
          'files.$.flagged': "",
          'files.$.adminComments': "",
          'files.$.flaggedAt': "",
          'files.$.flaggedBy': ""
        },
        $set: { updatedAt: new Date() }
      }
    );

    res.json({
      success: true,
      message: 'File flag removed successfully',
      data: { 
        fileId,
        flagged: false
      }
    });
  } catch (error) {
    console.error('File unflag error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error removing file flag'
    });
  }
});

// @route   DELETE /api/files/:claimId/:fileId
// @desc    Delete a file (Admin only)
// @access  Private (Admin only)
router.delete('/:claimId/:fileId', protect, authorize('admin'), async (req, res) => {
  try {
    const { claimId, fileId } = req.params;
    const db = getDB();

    // Check if claim exists
    const claim = await db.collection('claims').findOne({ _id: new ObjectId(claimId) });
    
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    // Find the file to delete
    const fileToDelete = claim.files.find(file => file._id.toString() === fileId);
    
    if (!fileToDelete) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Delete file from disk
    await deleteFile(fileToDelete.path);

    
    await db.collection('claims').updateOne(
      { _id: new ObjectId(claimId) },
      { 
        $pull: { files: { _id: fileToDelete._id } },
        $set: { updatedAt: new Date() }
      }
    );

    res.json({
      success: true,
      message: 'File deleted successfully',
      data: { fileId }
    });
  } catch (error) {
    console.error('File delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting file'
    });
  }
});

module.exports = router; 
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../config/database');
const { protect, authorize } = require('../middleware/auth');
const { validateClaim, validateStatusTransition, isValidStatus } = require('../utils/validation');
const AuditTrail = require('../models/audit');
const NotificationService = require('../services/notification');

const router = express.Router();

// @route   POST /api/claims
// @desc    Create a new claim
// @access  Private (Client only)
router.post('/', protect, authorize('client'), validateClaim, async (req, res) => {
  try {
    const {
      vehicleMake,
      vehicleModel,
      vehicleYear,
      incidentDate,
      description,
      estimatedDamage
    } = req.body;

    const db = getDB();

    const claim = {
      userId: req.user.id, // This is already an ObjectId from auth middleware
      vehicleMake,
      vehicleModel,
      vehicleYear: parseInt(vehicleYear),
      incidentDate: new Date(incidentDate),
      description,
      estimatedDamage: parseFloat(estimatedDamage),
      status: 'pending', // reverted back to 'pending'
      files: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('claims').insertOne(claim);

    // Log the action
    await AuditTrail.log(
      'claim_created',
      { 
        claimId: result.insertedId.toString(),
        vehicleMake,
        vehicleModel,
        vehicleYear,
        estimatedDamage
      },
      req.user.id,
      req.user.role,
      'claim',
      result.insertedId.toString()
    );

    res.status(201).json({
      success: true,
      message: 'Claim created successfully',
      data: {
        claim: {
          ...claim,
          _id: result.insertedId
        }
      }
    });
  } catch (error) {
    console.error('Create claim error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating claim'
    });
  }
});

// @route   GET /api/claims
// @desc    Get all claims (filtered by user role)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const db = getDB();
    const { page = 1, limit = 10, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter based on user role
    let filter = {};
    if (req.user.role === 'client') {
      filter.userId = req.user.id; // This is already an ObjectId
    }
    if (status && isValidStatus(status)) {
      filter.status = status;
    }

    const claims = await db.collection('claims')
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await db.collection('claims').countDocuments(filter);

    res.json({
      success: true,
      data: {
        claims,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          hasNext: skip + claims.length < total,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get claims error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting claims'
    });
  }
});

// @route   GET /api/claims/:id
// @desc    Get single claim
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid claim ID'
      });
    }

    const claim = await db.collection('claims').findOne({ _id: new ObjectId(id) });

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    // Check if user has access to this claim
    if (req.user.role === 'client' && claim.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this claim'
      });
    }

    res.json({
      success: true,
      data: { claim }
    });
  } catch (error) {
    console.error('Get claim error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting claim'
    });
  }
});

// @route   PUT /api/claims/:id/status
// @desc    Update claim status (Admin only)
// @access  Private (Admin only)
router.put('/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, pushToSystem = false } = req.body;
    const db = getDB();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid claim ID'
      });
    }

    if (!isValidStatus(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const claim = await db.collection('claims').findOne({ _id: new ObjectId(id) });

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    // Validate status transition
    if (!validateStatusTransition(claim.status, status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${claim.status} to ${status}`
      });
    }

    // Check if all files are unflagged before allowing submission
    if (status === 'submitted' && claim.files.some(file => file.flagged)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot submit claim with flagged files'
      });
    }

    const updateData = {
      status,
      updatedAt: new Date()
    };

    
    if (status === 'processing' && pushToSystem) {
      updateData.pushedToSystem = true;
      updateData.pushedAt = new Date();
    }

    await db.collection('claims').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // Log the action
    await AuditTrail.log(
      'claim_status_updated',
      { 
        claimId: id,
        previousStatus: claim.status,
        newStatus: status,
        pushToSystem
      },
      req.user.id,
      req.user.role,
      'claim',
      id
    );

    // Notify client of status change
    if (claim.userId.toString() !== req.user.id.toString()) {
      await NotificationService.notifyClaimStatusChange(id, claim.userId.toString(), status);
    }

    res.json({
      success: true,
      message: `Claim status updated to ${status}`,
      data: { status }
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating claim status'
    });
  }
});

// @route   DELETE /api/claims/:id
// @desc    Delete claim (Admin only)
// @access  Private (Admin only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid claim ID'
      });
    }

    const claim = await db.collection('claims').findOne({ _id: new ObjectId(id) });

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    // Delete all files from disk
    const fs = require('fs-extra');
    const path = require('path');
    const uploadsDir = process.env.UPLOAD_PATH || './uploads';
    const claimDir = path.join(uploadsDir, id);

    try {
      await fs.remove(claimDir);
    } catch (error) {
      console.error('Error deleting claim directory:', error);
    }

    // Delete claim from database
    await db.collection('claims').deleteOne({ _id: new ObjectId(id) });

    res.json({
      success: true,
      message: 'Claim deleted successfully'
    });
  } catch (error) {
    console.error('Delete claim error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting claim'
    });
  }
});

// @route   PUT /api/claims/:id/withdraw
// @desc    Withdraw a claim (Client only)
// @access  Private (Client only)
router.put('/:id/withdraw', protect, authorize('client'), async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid claim ID'
      });
    }

    const claim = await db.collection('claims').findOne({ _id: new ObjectId(id) });

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    // Check if user owns this claim
    if (claim.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to withdraw this claim'
      });
    }

    // Only allow withdrawal of pending claims
    if (claim.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending claims can be withdrawn'
      });
    }

    
    await db.collection('claims').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          status: 'withdrawn',
          withdrawnAt: new Date(),
          withdrawnBy: req.user.id,
          updatedAt: new Date()
        }
      }
    );

    // Log the action
    await AuditTrail.log(
      'claim_withdrawn',
      { 
        claimId: id,
        previousStatus: claim.status
      },
      req.user.id,
      req.user.role,
      'claim',
      id
    );

    res.json({
      success: true,
      message: 'Claim withdrawn successfully',
      data: { status: 'withdrawn' }
    });
  } catch (error) {
    console.error('Withdraw claim error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error withdrawing claim'
    });
  }
});

// @route   PUT /api/claims/:id/resubmit
// @desc    Resubmit a rejected claim (Client only)
// @access  Private (Client only)
router.put('/:id/resubmit', protect, authorize('client'), async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid claim ID'
      });
    }

    const claim = await db.collection('claims').findOne({ _id: new ObjectId(id) });

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    // Check if user owns this claim
    if (claim.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to resubmit this claim'
      });
    }

    // Only allow resubmission of rejected claims
    if (claim.status !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Only rejected claims can be resubmitted'
      });
    }

    
    await db.collection('claims').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          status: 'pending',
          resubmittedAt: new Date(),
          resubmittedBy: req.user.id,
          updatedAt: new Date()
        },
        $unset: {
          rejectedAt: "",
          rejectedBy: "",
          rejectionReason: "",
          rejectedFiles: ""
        }
      }
    );

    // Log the action
    await AuditTrail.log(
      'claim_resubmitted',
      { 
        claimId: id,
        previousStatus: claim.status
      },
      req.user.id,
      req.user.role,
      'claim',
      id
    );

    // Notify admins of resubmission
    const adminIds = await NotificationService.getAdminUsers();
    await NotificationService.notifyAdminClaimUpdated(id, adminIds, 'claim_resubmitted');

    res.json({
      success: true,
      message: 'Claim resubmitted successfully',
      data: { status: 'pending' }
    });
  } catch (error) {
    console.error('Resubmit claim error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error resubmitting claim'
    });
  }
});

// @route   PUT /api/claims/:id/reject
// @desc    Reject a claim with reason (Admin only)
// @access  Private (Admin only)
router.put('/:id/reject', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, rejectedFiles } = req.body;
    const db = getDB();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid claim ID'
      });
    }

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required and must be at least 10 characters'
      });
    }

    const claim = await db.collection('claims').findOne({ _id: new ObjectId(id) });

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    // Only allow rejection of submitted or processing claims
    if (!['submitted', 'processing'].includes(claim.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only submitted or processing claims can be rejected'
      });
    }

    // Validate rejected files if provided
    if (rejectedFiles && Array.isArray(rejectedFiles)) {
      for (const fileId of rejectedFiles) {
        const fileExists = claim.files.find(file => file._id.toString() === fileId);
        if (!fileExists) {
          return res.status(400).json({
            success: false,
            message: `File with ID ${fileId} not found in claim`
          });
        }
      }
    }

    const updateData = {
      status: 'rejected',
      rejectionReason: reason.trim(),
      rejectedAt: new Date(),
      rejectedBy: req.user.id,
      rejectedFiles: rejectedFiles || [],
      updatedAt: new Date()
    };

    await db.collection('claims').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // Log the action
    await AuditTrail.log(
      'claim_rejected',
      { 
        claimId: id,
        previousStatus: claim.status,
        reason: reason.trim(),
        rejectedFiles: rejectedFiles || []
      },
      req.user.id,
      req.user.role,
      'claim',
      id
    );

    // Get flagged files for notification
    const flaggedFiles = claim.files
      .filter(file => file.flagged)
      .map(file => ({
        name: file.originalName,
        type: file.documentType,
        comment: file.adminComments
      }));

    // Notify client with flagged documents
    await NotificationService.notifyClaimRejected(id, claim.userId.toString(), reason.trim(), flaggedFiles);

    res.json({
      success: true,
      message: 'Claim rejected successfully',
      data: { 
        status: 'rejected',
        rejectionReason: reason.trim(),
        rejectedFiles: rejectedFiles || []
      }
    });
  } catch (error) {
    console.error('Reject claim error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error rejecting claim'
    });
  }
});

// @route   GET /api/claims/:id/files
// @desc    Get claim files
// @access  Private
router.get('/:id/files', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid claim ID'
      });
    }

    const claim = await db.collection('claims').findOne(
      { _id: new ObjectId(id) },
      { projection: { files: 1, userId: 1 } }
    );

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    // Check if user has access to this claim
    if (req.user.role === 'client' && claim.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this claim'
      });
    }

    res.json({
      success: true,
      data: { files: claim.files || [] }
    });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting files'
    });
  }
});

module.exports = router; 
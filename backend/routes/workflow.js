const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../config/database');
const { protect, authorize } = require('../middleware/auth');
const WorkflowEngine = require('../services/workflow');
const NotificationService = require('../services/notification');
const AuditTrail = require('../models/audit');

const router = express.Router();

// @route   POST /api/workflow/submit/:id
// @desc    Submit a claim for review
// @access  Private (Client only)
router.post('/submit/:id', protect, authorize('client'), async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid claim ID'
      });
    }

    // Check if user owns this claim
    const claim = await db.collection('claims').findOne({ _id: new ObjectId(id) });
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    if (claim.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to submit this claim'
      });
    }

    // Process claim submission
    const result = await WorkflowEngine.processClaimSubmission(id, req.user.id, req.user.role);

    // Notify admins of new claim
    const adminIds = await NotificationService.getAdminUsers();
    await NotificationService.notifyAdminNewClaim(id, adminIds);

    // Notify client
    await NotificationService.notifyClaimSubmitted(id, req.user.id);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Submit claim error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/workflow/resubmit/:id
// @desc    Resubmit files for a claim
// @access  Private (Client only)
router.post('/resubmit/:id', protect, authorize('client'), async (req, res) => {
  try {
    const { id } = req.params;
    const { resubmittedFiles } = req.body;
    const db = getDB();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid claim ID'
      });
    }

    if (!resubmittedFiles || !Array.isArray(resubmittedFiles)) {
      return res.status(400).json({
        success: false,
        message: 'Resubmitted files are required'
      });
    }

    // Check if user owns this claim
    const claim = await db.collection('claims').findOne({ _id: new ObjectId(id) });
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    if (claim.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to resubmit files for this claim'
      });
    }

    // Process file resubmission
    await WorkflowEngine.processFileResubmission(id, req.user.id, req.user.role, resubmittedFiles);

    // Notify admins
    const adminIds = await NotificationService.getAdminUsers();
    await NotificationService.notifyAdminClaimUpdated(id, adminIds, 'file_uploaded');

    res.json({
      success: true,
      message: 'Files resubmitted successfully'
    });
  } catch (error) {
    console.error('Resubmit files error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/workflow/mark-submitted/:id
// @desc    Mark a claim as submitted (Admin only)
// @access  Private (Admin only)
router.post('/mark-submitted/:id', protect, authorize('admin'), async (req, res) => {
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

    // Mark claim as submitted
    await WorkflowEngine.markClaimAsSubmitted(id, req.user.id);

    // Notify client
    await NotificationService.notifyClaimStatusChange(id, claim.userId.toString(), 'submitted');

    res.json({
      success: true,
      message: 'Claim marked as submitted successfully'
    });
  } catch (error) {
    console.error('Mark as submitted error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/workflow/approve/:id
// @desc    Approve a claim (Admin only)
// @access  Private (Admin only)
router.post('/approve/:id', protect, authorize('admin'), async (req, res) => {
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

    // Process claim approval
    await WorkflowEngine.processClaimReview(id, req.user.id, 'approve');

    // Notify client
    await NotificationService.notifyClaimStatusChange(id, claim.userId.toString(), 'processing');

    res.json({
      success: true,
      message: 'Claim approved successfully'
    });
  } catch (error) {
    console.error('Approve claim error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/workflow/request-resubmission/:id
// @desc    Request file resubmission (Admin only)
// @access  Private (Admin only)
router.post('/request-resubmission/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, filesToResubmit } = req.body;
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
        message: 'Resubmission reason is required and must be at least 10 characters'
      });
    }

    const claim = await db.collection('claims').findOne({ _id: new ObjectId(id) });
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    // Process resubmission request
    await WorkflowEngine.processClaimReview(id, req.user.id, 'request_resubmission', {
      reason: reason.trim(),
      filesToResubmit: filesToResubmit || []
    });

    // Notify client
    await NotificationService.notifyResubmissionRequested(
      id, 
      claim.userId.toString(), 
      reason.trim(), 
      filesToResubmit || []
    );

    res.json({
      success: true,
      message: 'Resubmission requested successfully'
    });
  } catch (error) {
    console.error('Request resubmission error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/workflow/return/:id
// @desc    Return a claim to client (Admin only)
// @access  Private (Admin only)
router.post('/return/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, returnedFiles } = req.body;
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
        message: 'Return reason is required and must be at least 10 characters'
      });
    }

    const claim = await db.collection('claims').findOne({ _id: new ObjectId(id) });
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    // Process claim return
    await WorkflowEngine.processClaimReview(id, req.user.id, 'return', {
      reason: reason.trim(),
      returnedFiles: returnedFiles || []
    });

    // Notify client
    await NotificationService.notifyClaimStatusChange(id, claim.userId.toString(), 'returned');

    res.json({
      success: true,
      message: 'Claim returned to client successfully'
    });
  } catch (error) {
    console.error('Return claim error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/workflow/process-payment/:id
// @desc    Process claim payment (Admin only)
// @access  Private (Admin only)
router.post('/process-payment/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, method, reference } = req.body;
    const db = getDB();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid claim ID'
      });
    }

    if (!amount || !method) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount and method are required'
      });
    }

    const claim = await db.collection('claims').findOne({ _id: new ObjectId(id) });
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    // Process payment
    await WorkflowEngine.processClaimPayment(id, req.user.id, {
      amount: parseFloat(amount),
      method,
      reference: reference || null
    });

    // Notify client
    await NotificationService.notifyClaimStatusChange(id, claim.userId.toString(), 'paid');

    res.json({
      success: true,
      message: 'Payment processed successfully'
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/workflow/completeness/:id
// @desc    Check claim completeness
// @access  Private
router.get('/completeness/:id', protect, async (req, res) => {
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

    const completeness = await WorkflowEngine.checkClaimCompleteness(id);

    res.json({
      success: true,
      data: completeness
    });
  } catch (error) {
    console.error('Check completeness error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error checking claim completeness'
    });
  }
});

module.exports = router; 
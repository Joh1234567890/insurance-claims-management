const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const AuditTrail = require('../models/audit');

const router = express.Router();

// @route   GET /api/audit/logs
// @desc    Get audit logs (Admin only)
// @access  Private (Admin only)
router.get('/logs', protect, authorize('admin'), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      action, 
      userId, 
      userRole, 
      resourceType, 
      resourceId,
      startDate,
      endDate
    } = req.query;

    const filters = {};
    if (action) filters.action = action;
    if (userId) filters.userId = userId;
    if (userRole) filters.userRole = userRole;
    if (resourceType) filters.resourceType = resourceType;
    if (resourceId) filters.resourceId = resourceId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const result = await AuditTrail.getAuditLogs(filters, parseInt(page), parseInt(limit));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting audit logs'
    });
  }
});

// @route   GET /api/audit/claim/:id
// @desc    Get claim audit trail
// @access  Private
router.get('/claim/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const logs = await AuditTrail.getClaimAuditTrail(id);

    res.json({
      success: true,
      data: { logs }
    });
  } catch (error) {
    console.error('Get claim audit trail error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting claim audit trail'
    });
  }
});

// @route   GET /api/audit/export
// @desc    Export audit logs (Admin only)
// @access  Private (Admin only)
router.get('/export', protect, authorize('admin'), async (req, res) => {
  try {
    const { 
      action, 
      userId, 
      userRole, 
      resourceType, 
      resourceId,
      startDate,
      endDate
    } = req.query;

    const filters = {};
    if (action) filters.action = action;
    if (userId) filters.userId = userId;
    if (userRole) filters.userRole = userRole;
    if (resourceType) filters.resourceType = resourceType;
    if (resourceId) filters.resourceId = resourceId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    // Get all logs for export (no pagination)
    const result = await AuditTrail.getAuditLogs(filters, 1, 10000);

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit_logs.csv');

    // Create CSV header
    const csvHeader = 'Timestamp,Action,User ID,User Role,Resource Type,Resource ID,Details\n';
    res.write(csvHeader);

    // Write CSV data
    for (const log of result.logs) {
      const row = [
        log.timestamp,
        log.action,
        log.userId,
        log.userRole,
        log.resourceType || '',
        log.resourceId || '',
        JSON.stringify(log.details).replace(/"/g, '""')
      ].map(field => `"${field}"`).join(',') + '\n';
      
      res.write(row);
    }

    res.end();
  } catch (error) {
    console.error('Export audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error exporting audit logs'
    });
  }
});

module.exports = router; 
const { body, param, validationResult } = require('express-validator');

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Claim validation rules
const validateClaim = [
  body('vehicleMake').notEmpty().withMessage('Vehicle make is required'),
  body('vehicleModel').notEmpty().withMessage('Vehicle model is required'),
  body('vehicleYear').isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('Vehicle year must be a valid year'),
  body('incidentDate').isISO8601().withMessage('Incident date must be a valid date'),
  body('description').isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  body('estimatedDamage').isFloat({ min: 0 }).withMessage('Estimated damage must be a positive number'),
  handleValidationErrors
];

// File replacement validation
const validateFileReplacement = [
  param('claimId').isMongoId().withMessage('Invalid claim ID'),
  param('fileId').isMongoId().withMessage('Invalid file ID'),
  handleValidationErrors
];

// Admin comment validation
const validateAdminComment = [
  body('comment')
    .notEmpty()
    .withMessage('Comment is required')
    .isLength({ min: 5, max: 500 })
    .withMessage('Comment must be between 5 and 500 characters')
    .trim(),
  handleValidationErrors
];

// Status transition validation
const validateStatusTransition = (currentStatus, newStatus) => {
  const validTransitions = {
    pending: ['submitted'],
    submitted: ['processing', 'rejected'],
    processing: ['paid', 'rejected'],
    paid: [], // Final state
    rejected: [] // Final state
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
};

// File type validation
const isValidFileType = (mimetype) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'text/plain'];
  return allowedTypes.includes(mimetype);
};

// File size validation (in bytes)
const isValidFileSize = (size) => {
  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
  return size <= maxSize;
};

// Claim status validation
const isValidStatus = (status) => {
  const validStatuses = ['pending', 'submitted', 'processing', 'paid', 'rejected', 'withdrawn'];
  return validStatuses.includes(status);
};

// User role validation
const isValidRole = (role) => {
  const validRoles = ['client', 'admin'];
  return validRoles.includes(role);
};

module.exports = {
  validateClaim,
  validateFileReplacement,
  validateAdminComment,
  validateStatusTransition,
  isValidFileType,
  isValidFileSize,
  isValidStatus,
  isValidRole,
  handleValidationErrors
}; 
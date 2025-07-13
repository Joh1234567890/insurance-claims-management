const { ObjectId } = require('mongodb');
const { getDB } = require('../config/database');
const AuditTrail = require('../models/audit');

class WorkflowEngine {
  static async processClaimSubmission(claimId, userId, userRole) {
    try {
      const db = getDB();
      
      // Get the claim with all files
      const claim = await db.collection('claims').findOne({ _id: new ObjectId(claimId) });
      
      if (!claim) {
        throw new Error('Claim not found');
      }

      // Check if all required files are uploaded
      const requiredFileTypes = ['drivers_license', 'vehicle_registration', 'insurance_policy', 'police_report', 'repair_estimate'];
      const uploadedFileTypes = claim.files.map(file => file.documentType);
      const missingFiles = requiredFileTypes.filter(type => !uploadedFileTypes.includes(type));

      if (missingFiles.length > 0) {
        throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
      }

      // Check if any files are flagged
      const flaggedFiles = claim.files.filter(file => file.flagged);
      if (flaggedFiles.length > 0) {
        throw new Error('Cannot submit claim with flagged files');
      }

      await db.collection('claims').updateOne(
        { _id: new ObjectId(claimId) },
        { 
          $set: { 
            status: 'submitted',
            submittedAt: new Date(),
            updatedAt: new Date()
          }
        }
      );

      // Log the action
      await AuditTrail.log(
        'claim_submitted',
        { 
          claimId: claimId,
          previousStatus: 'pending',
          newStatus: 'submitted',
          fileCount: claim.files.length
        },
        userId,
        userRole,
        'claim',
        claimId
      );

      return { success: true, message: 'Claim submitted successfully' };
    } catch (error) {
      console.error('Process claim submission error:', error);
      throw error;
    }
  }

  static async processClaimReview(claimId, adminId, action, details = {}) {
    try {
      const db = getDB();
      
      const claim = await db.collection('claims').findOne({ _id: new ObjectId(claimId) });
      
      if (!claim) {
        throw new Error('Claim not found');
      }

      let newStatus;
      let updateData = { updatedAt: new Date() };

      switch (action) {
        case 'approve':
          // Only allow approval of submitted claims
          if (claim.status !== 'submitted') {
            console.log(`Admin ${adminId} attempted to approve claim ${claimId} with status ${claim.status}. Only submitted claims can be approved.`);
            throw new Error('Only submitted claims can be approved. Please mark the claim as submitted first.');
          }
          console.log(`Admin ${adminId} approving claim ${claimId} for processing`);
          newStatus = 'processing';
          updateData.status = newStatus;
          updateData.approvedAt = new Date();
          updateData.approvedBy = adminId;
          break;

        case 'reject':
          // Only allow rejection of submitted claims
          if (claim.status !== 'submitted') {
            console.log(`Admin ${adminId} attempted to reject claim ${claimId} with status ${claim.status}. Only submitted claims can be rejected.`);
            throw new Error('Only submitted claims can be rejected. Please mark the claim as submitted first.');
          }
          console.log(`Admin ${adminId} rejecting claim ${claimId}`);
          newStatus = 'rejected';
          updateData.status = newStatus;
          updateData.rejectionReason = details.reason;
          updateData.rejectedAt = new Date();
          updateData.rejectedBy = adminId;
          updateData.rejectedFiles = details.rejectedFiles || [];
          break;

        case 'request_resubmission':
          // Only allow resubmission request for submitted claims
          if (claim.status !== 'submitted') {
            console.log(`Admin ${adminId} attempted to request resubmission for claim ${claimId} with status ${claim.status}. Only submitted claims can have resubmission requested.`);
            throw new Error('Only submitted claims can have resubmission requested. Please mark the claim as submitted first.');
          }
          console.log(`Admin ${adminId} requesting resubmission for claim ${claimId}`);
          newStatus = 'pending';
          updateData.status = newStatus;
          updateData.resubmissionRequestedAt = new Date();
          updateData.resubmissionRequestedBy = adminId;
          updateData.resubmissionReason = details.reason;
          updateData.filesToResubmit = details.filesToResubmit || [];
          break;

        default:
          throw new Error('Invalid action');
      }

      await db.collection('claims').updateOne(
        { _id: new ObjectId(claimId) },
        { $set: updateData }
      );

      // Log the action
      await AuditTrail.log(
        `claim_${action}`,
        { 
          claimId: claimId,
          previousStatus: claim.status,
          newStatus: newStatus,
          details: details
        },
        adminId,
        'admin',
        'claim',
        claimId
      );

      return { success: true, message: `Claim ${action} successfully` };
    } catch (error) {
      console.error('Process claim review error:', error);
      throw error;
    }
  }

  static async markClaimAsSubmitted(claimId, adminId) {
    try {
      const db = getDB();
      
      const claim = await db.collection('claims').findOne({ _id: new ObjectId(claimId) });
      
      if (!claim) {
        throw new Error('Claim not found');
      }

      // Only allow marking pending claims as submitted
      if (claim.status !== 'pending') {
        throw new Error('Only pending claims can be marked as submitted');
      }

      // Check if any files are flagged (admins can still mark as submitted even with missing files)
      const flaggedFiles = claim.files.filter(file => file.flagged);
      if (flaggedFiles.length > 0) {
        throw new Error('Cannot mark as submitted. Claim has flagged files that need to be addressed first.');
      }

      // Check if all required files are uploaded (for informational purposes)
      const requiredFileTypes = ['drivers_license', 'vehicle_registration', 'insurance_policy', 'police_report', 'repair_estimate'];
      const uploadedFileTypes = claim.files.map(file => file.documentType);
      const missingFiles = requiredFileTypes.filter(type => !uploadedFileTypes.includes(type));

      console.log(`Admin ${adminId} marking claim ${claimId} as submitted`);
      if (missingFiles.length > 0) {
        console.log(`Warning: Claim ${claimId} is missing required files: ${missingFiles.join(', ')}`);
      }

      await db.collection('claims').updateOne(
        { _id: new ObjectId(claimId) },
        { 
          $set: { 
            status: 'submitted',
            submittedAt: new Date(),
            submittedBy: adminId,
            updatedAt: new Date(),
            missingFiles: missingFiles
          }
        }
      );

      // Log the action
      await AuditTrail.log(
        'claim_marked_submitted',
        { 
          claimId: claimId,
          previousStatus: 'pending',
          newStatus: 'submitted',
          fileCount: claim.files.length,
          missingFiles: missingFiles
        },
        adminId,
        'admin',
        'claim',
        claimId
      );

      console.log(`Claim ${claimId} successfully marked as submitted by admin ${adminId}`);
      return { 
        success: true, 
        message: 'Claim marked as submitted successfully',
        missingFiles: missingFiles
      };
    } catch (error) {
      console.error('Mark claim as submitted error:', error);
      throw error;
    }
  }

  static async processClaimPayment(claimId, adminId, paymentDetails) {
    try {
      const db = getDB();
      
      const claim = await db.collection('claims').findOne({ _id: new ObjectId(claimId) });
      
      if (!claim) {
        throw new Error('Claim not found');
      }

      if (claim.status !== 'processing') {
        throw new Error('Only processing claims can be paid');
      }

      const updateData = {
        status: 'paid',
        paidAt: new Date(),
        paidBy: adminId,
        paymentAmount: paymentDetails.amount,
        paymentMethod: paymentDetails.method,
        paymentReference: paymentDetails.reference,
        updatedAt: new Date()
      };

      await db.collection('claims').updateOne(
        { _id: new ObjectId(claimId) },
        { $set: updateData }
      );

      // Log the action
      await AuditTrail.log(
        'claim_paid',
        { 
          claimId: claimId,
          previousStatus: 'processing',
          newStatus: 'paid',
          paymentDetails: paymentDetails
        },
        adminId,
        'admin',
        'claim',
        claimId
      );

      return { success: true, message: 'Claim paid successfully' };
    } catch (error) {
      console.error('Process claim payment error:', error);
      throw error;
    }
  }

  static async processFileResubmission(claimId, userId, userRole, resubmittedFiles) {
    try {
      const db = getDB();
      
      const claim = await db.collection('claims').findOne({ _id: new ObjectId(claimId) });
      
      if (!claim) {
        throw new Error('Claim not found');
      }

      if (claim.status !== 'pending') {
        throw new Error('Only pending claims can have files resubmitted');
      }


      for (const file of resubmittedFiles) {
        await db.collection('claims').updateOne(
          { 
            _id: new ObjectId(claimId),
            'files._id': new ObjectId(file.fileId)
          },
          { 
            $set: { 
              'files.$.resubmitted': true,
              'files.$.resubmittedAt': new Date(),
              'files.$.resubmittedBy': userId,
              updatedAt: new Date()
            }
          }
        );
      }

      // Log the action
      await AuditTrail.log(
        'files_resubmitted',
        { 
          claimId: claimId,
          resubmittedFiles: resubmittedFiles.map(f => f.fileId)
        },
        userId,
        userRole,
        'claim',
        claimId
      );

      return { success: true, message: 'Files resubmitted successfully' };
    } catch (error) {
      console.error('Process file resubmission error:', error);
      throw error;
    }
  }

  static async checkClaimCompleteness(claimId) {
    try {
      const db = getDB();
      
      const claim = await db.collection('claims').findOne({ _id: new ObjectId(claimId) });
      
      if (!claim) {
        throw new Error('Claim not found');
      }

      const requiredFileTypes = ['drivers_license', 'vehicle_registration', 'insurance_policy', 'police_report', 'repair_estimate'];
      const uploadedFileTypes = claim.files.map(file => file.documentType);
      const missingFiles = requiredFileTypes.filter(type => !uploadedFileTypes.includes(type));
      const flaggedFiles = claim.files.filter(file => file.flagged);

      return {
        isComplete: missingFiles.length === 0 && flaggedFiles.length === 0,
        missingFiles,
        flaggedFiles: flaggedFiles.map(f => ({ id: f._id, name: f.originalName, type: f.documentType })),
        canSubmit: missingFiles.length === 0 && flaggedFiles.length === 0
      };
    } catch (error) {
      console.error('Check claim completeness error:', error);
      throw error;
    }
  }
}

module.exports = WorkflowEngine; 
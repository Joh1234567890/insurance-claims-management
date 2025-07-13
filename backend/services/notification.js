const { ObjectId } = require('mongodb');
const { getDB } = require('../config/database');
const AuditTrail = require('../models/audit');

class NotificationService {
  static async createNotification(userId, type, title, message, data = {}) {
    try {
      const db = getDB();
      
      const notification = {
        userId: new ObjectId(userId),
        type,
        title,
        message,
        data,
        read: false,
        createdAt: new Date()
      };

      const result = await db.collection('notifications').insertOne(notification);
      
      return {
        success: true,
        notificationId: result.insertedId
      };
    } catch (error) {
      console.error('Create notification error:', error);
      throw error;
    }
  }

  static async getNotifications(userId, page = 1, limit = 20) {
    try {
      const db = getDB();
      const skip = (page - 1) * limit;

      const notifications = await db.collection('notifications')
        .find({ userId: new ObjectId(userId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await db.collection('notifications').countDocuments({ userId: new ObjectId(userId) });
      const unreadCount = await db.collection('notifications').countDocuments({ 
        userId: new ObjectId(userId), 
        read: false 
      });

      return {
        notifications,
        pagination: {
          current: page,
          total: Math.ceil(total / limit),
          hasNext: skip + notifications.length < total,
          hasPrev: page > 1
        },
        unreadCount
      };
    } catch (error) {
      console.error('Get notifications error:', error);
      throw error;
    }
  }

  static async markAsRead(notificationId, userId) {
    try {
      const db = getDB();
      
      await db.collection('notifications').updateOne(
        { 
          _id: new ObjectId(notificationId),
          userId: new ObjectId(userId)
        },
        { $set: { read: true, readAt: new Date() } }
      );

      return { success: true };
    } catch (error) {
      console.error('Mark notification as read error:', error);
      throw error;
    }
  }

  static async markAllAsRead(userId) {
    try {
      const db = getDB();
      
      await db.collection('notifications').updateMany(
        { userId: new ObjectId(userId), read: false },
        { $set: { read: true, readAt: new Date() } }
      );

      return { success: true };
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
      throw error;
    }
  }

  static async deleteNotification(notificationId, userId) {
    try {
      const db = getDB();
      
      await db.collection('notifications').deleteOne({
        _id: new ObjectId(notificationId),
        userId: new ObjectId(userId)
      });

      return { success: true };
    } catch (error) {
      console.error('Delete notification error:', error);
      throw error;
    }
  }

  // Notification templates for different events
  static async notifyClaimSubmitted(claimId, userId) {
    const title = 'Claim Submitted Successfully';
    const message = 'Your insurance claim has been submitted and is now under review.';
    
    await this.createNotification(userId, 'claim_submitted', title, message, { claimId });
  }

  static async notifyClaimStatusChange(claimId, userId, newStatus, reason = null) {
    const statusMessages = {
      'processing': 'Your claim is now being processed.',
      'paid': 'Your claim has been approved and payment has been processed.',
      'rejected': `Your claim has been rejected. ${reason ? `Reason: ${reason}` : ''}`,
      'pending': 'Your claim requires additional information. Please check the details.'
    };

    const title = `Claim Status Updated - ${newStatus.toUpperCase()}`;
    const message = statusMessages[newStatus] || 'Your claim status has been updated.';
    
    await this.createNotification(userId, 'claim_status_change', title, message, { 
      claimId, 
      newStatus, 
      reason 
    });
  }

  static async notifyClaimRejected(claimId, userId, reason, flaggedFiles = []) {
    const title = 'Claim Rejected';
    const message = `Your claim has been rejected. Reason: ${reason}`;
    
    await this.createNotification(userId, 'claim_rejected', title, message, { 
      claimId, 
      reason,
      flaggedFiles
    });
  }

  static async notifyFileFlagged(claimId, userId, fileName, adminComment) {
    const title = 'File Requires Attention';
    const message = `The file "${fileName}" has been flagged for review. ${adminComment ? `Admin comment: ${adminComment}` : ''}`;
    
    await this.createNotification(userId, 'file_flagged', title, message, { 
      claimId, 
      fileName, 
      adminComment 
    });
  }

  static async notifyResubmissionRequested(claimId, userId, reason, filesToResubmit) {
    const title = 'Files Need to be Resubmitted';
    const message = `Your claim requires file resubmission. ${reason}`;
    
    await this.createNotification(userId, 'resubmission_requested', title, message, { 
      claimId, 
      reason, 
      filesToResubmit 
    });
  }

  static async notifyAdminNewClaim(claimId, adminIds) {
    const title = 'New Claim Submitted';
    const message = 'A new insurance claim has been submitted and requires review.';
    
    for (const adminId of adminIds) {
      await this.createNotification(adminId, 'new_claim', title, message, { claimId });
    }
  }

  static async notifyAdminClaimUpdated(claimId, adminIds, action) {
    const actionMessages = {
      'file_uploaded': 'New files have been uploaded to a claim.',
      'file_flagged': 'Files have been flagged in a claim.',
      'status_change': 'Claim status has been updated.'
    };

    const title = 'Claim Updated';
    const message = actionMessages[action] || 'A claim has been updated.';
    
    for (const adminId of adminIds) {
      await this.createNotification(adminId, 'claim_updated', title, message, { claimId, action });
    }
  }

  // Get admin users for notifications
  static async getAdminUsers() {
    try {
      const db = getDB();
      
      const admins = await db.collection('users')
        .find({ role: 'admin' })
        .project({ _id: 1 })
        .toArray();

      return admins.map(admin => admin._id.toString());
    } catch (error) {
      console.error('Get admin users error:', error);
      return [];
    }
  }
}

module.exports = NotificationService; 
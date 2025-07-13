const { ObjectId } = require('mongodb');
const { getDB } = require('../config/database');

class AuditTrail {
  static async log(action, details, userId, userRole, resourceType, resourceId) {
    try {
      const db = getDB();
      const auditEntry = {
        action,
        details,
        userId: new ObjectId(userId),
        userRole,
        resourceType,
        resourceId: resourceId ? new ObjectId(resourceId) : null,
        timestamp: new Date(),
        ipAddress: details.ipAddress || null,
        userAgent: details.userAgent || null
      };

      await db.collection('audit_logs').insertOne(auditEntry);
    } catch (error) {
      console.error('Audit logging error:', error);
      // Don't throw error to avoid breaking main functionality
    }
  }

  static async getAuditLogs(filters = {}, page = 1, limit = 50) {
    try {
      const db = getDB();
      const skip = (page - 1) * limit;

      let query = {};
      
      if (filters.action) query.action = filters.action;
      if (filters.userId) query.userId = new ObjectId(filters.userId);
      if (filters.userRole) query.userRole = filters.userRole;
      if (filters.resourceType) query.resourceType = filters.resourceType;
      if (filters.resourceId) query.resourceId = new ObjectId(filters.resourceId);
      if (filters.startDate) {
        query.timestamp = { $gte: new Date(filters.startDate) };
      }
      if (filters.endDate) {
        if (query.timestamp) {
          query.timestamp.$lte = new Date(filters.endDate);
        } else {
          query.timestamp = { $lte: new Date(filters.endDate) };
        }
      }

      const logs = await db.collection('audit_logs')
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await db.collection('audit_logs').countDocuments(query);

      return {
        logs,
        pagination: {
          current: page,
          total: Math.ceil(total / limit),
          hasNext: skip + logs.length < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Get audit logs error:', error);
      throw error;
    }
  }

  static async getClaimAuditTrail(claimId) {
    try {
      const db = getDB();
      const logs = await db.collection('audit_logs')
        .find({ 
          resourceType: 'claim', 
          resourceId: new ObjectId(claimId) 
        })
        .sort({ timestamp: 1 })
        .toArray();

      return logs;
    } catch (error) {
      console.error('Get claim audit trail error:', error);
      throw error;
    }
  }
}

module.exports = AuditTrail; 
const { getDB } = require('../config/database');
const fs = require('fs');
const path = require('path');

const cleanupOrphanedFiles = async () => {
  try {
    const db = getDB();
    const claims = await db.collection('claims').find({}).toArray();
    
    let totalOrphanedFiles = 0;
    let totalClaimsProcessed = 0;
    
    for (const claim of claims) {
      if (!claim.files || claim.files.length === 0) continue;
      
      const validFiles = [];
      let orphanedInThisClaim = 0;
      
      for (const file of claim.files) {
        const filePath = path.join(__dirname, '..', 'uploads', claim._id.toString(), file.filename);
        
        if (fs.existsSync(filePath)) {
          validFiles.push(file);
        } else {
          console.log(`Orphaned file found: ${file.filename} in claim ${claim._id}`);
          orphanedInThisClaim++;
        }
      }
      
      if (orphanedInThisClaim > 0) {
        await db.collection('claims').updateOne(
          { _id: claim._id },
          { 
            $set: { 
              files: validFiles,
              updatedAt: new Date()
            }
          }
        );
        
        totalOrphanedFiles += orphanedInThisClaim;
        console.log(`Cleaned up ${orphanedInThisClaim} orphaned files from claim ${claim._id}`);
      }
      
      totalClaimsProcessed++;
    }
    
    console.log(`Cleanup complete: ${totalOrphanedFiles} orphaned files removed from ${totalClaimsProcessed} claims`);
    return { totalOrphanedFiles, totalClaimsProcessed };
  } catch (error) {
    console.error('Cleanup error:', error);
    throw error;
  }
};

// Run cleanup if this file is executed directly
if (require.main === module) {
  const { connectDB } = require('../config/database');
  
  const runCleanup = async () => {
    try {
      await connectDB();
      await cleanupOrphanedFiles();
      process.exit(0);
    } catch (error) {
      console.error('Cleanup failed:', error);
      process.exit(1);
    }
  };
  
  runCleanup();
}

module.exports = { cleanupOrphanedFiles }; 
/**
 * Utility to check secure storage status
 * 
 * Use this in your app to verify that tokens are stored securely.
 * Can be called from anywhere in your app for debugging.
 */

import secureStorage from './secureStorage';

/**
 * Check and log secure storage status
 * Call this function to verify tokens are stored securely
 */
export const checkSecureStorageStatus = async () => {
  console.log('\n🔐 ===== SECURE STORAGE STATUS CHECK =====');
  
  try {
    const status = await secureStorage.getStorageStatus();
    
    for (const [key, info] of Object.entries(status)) {
      console.log(`\n📦 ${key.toUpperCase()}:`);
      console.log(`   Status: ${info.message}`);
      console.log(`   Location: ${info.location}`);
      console.log(`   Secure: ${info.isSecure ? '✅ YES' : '❌ NO'}`);
      
      if (info.service) {
        console.log(`   Service: ${info.service}`);
      }
      
      if (info.warning) {
        console.warn(`   ⚠️ ${info.warning}`);
      }
    }
    
    // Check if all secure keys are stored securely
    const allSecure = Object.values(status).every(s => s.isSecure);
    
    if (allSecure) {
      console.log('\n✅ All sensitive data is securely stored in Keychain/Keystore');
    } else {
      console.warn('\n⚠️ Some sensitive data is NOT securely stored');
      console.warn('   This may indicate a migration issue or keychain unavailability');
    }
    
    console.log('\n==========================================\n');
    
    return status;
  } catch (error) {
    console.error('❌ Error checking secure storage status:', error);
    return null;
  }
};

/**
 * Quick check - just verify token storage
 */
export const verifyTokenStorage = async () => {
  const tokenStatus = await secureStorage.verifyStorage('token');
  
  if (__DEV__) {
    console.log('🔐 Token Storage Verification:');
    console.log(`   ${tokenStatus.message}`);
    console.log(`   Location: ${tokenStatus.location}`);
    console.log(`   Secure: ${tokenStatus.isSecure ? '✅ YES' : '❌ NO'}`);
  }
  
  return tokenStatus;
};

export default {
  checkSecureStorageStatus,
  verifyTokenStorage,
};


































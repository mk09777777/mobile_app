import { store } from '../store';
import { useSelector } from 'react-redux';

/**
 * Get user name from user ID
 * Uses cached users from Redux store
 * @param {string} userId - User ID to resolve
 * @returns {string} User name or fallback display
 */
export const getUserName = (userId) => {
  if (!userId) return '-';
  
  const state = store.getState();
  const usersMap = state.users?.usersMap || {};
  
  const idStr = String(userId).trim();
  
  // Try exact match
  if (usersMap[idStr]) {
    return usersMap[idStr].name || usersMap[idStr].email || `User ${idStr.substring(0, 8)}...`;
  }
  
  // Try with spaces removed
  const noSpacesId = idStr.replace(/\s/g, '');
  if (usersMap[noSpacesId]) {
    return usersMap[noSpacesId].name || usersMap[noSpacesId].email || `User ${noSpacesId.substring(0, 8)}...`;
  }
  
  // Try ObjectId format cleanup
  const cleanId = idStr.replace(/^ObjectId\(/, '').replace(/\)$/, '').replace(/\s/g, '');
  if (usersMap[cleanId]) {
    return usersMap[cleanId].name || usersMap[cleanId].email || `User ${cleanId.substring(0, 8)}...`;
  }
  
  // If it looks like an ObjectId but we don't have a name, return a truncated version
  if (noSpacesId.length > 12) {
    return `User ${noSpacesId.substring(0, 8)}...`;
  }
  
  return userId; // Fallback to original ID if short
};

/**
 * Get full user object from user ID
 * @param {string} userId - User ID to resolve
 * @returns {object|null} User object or null
 */
export const getUserById = (userId) => {
  if (!userId) return null;
  
  const state = store.getState();
  const usersMap = state.users?.usersMap || {};
  
  const idStr = String(userId).trim();
  
  // Try exact match
  if (usersMap[idStr]) {
    return usersMap[idStr];
  }
  
  // Try with spaces removed
  const noSpacesId = idStr.replace(/\s/g, '');
  if (usersMap[noSpacesId]) {
    return usersMap[noSpacesId];
  }
  
  // Try ObjectId format cleanup
  const cleanId = idStr.replace(/^ObjectId\(/, '').replace(/\)$/, '').replace(/\s/g, '');
  if (usersMap[cleanId]) {
    return usersMap[cleanId];
  }
  
  return null;
};

/**
 * React hook to get user name from ID
 * Automatically subscribes to store updates
 * Must be used inside a React component
 */
export const useUserName = (userId) => {
  return useSelector(state => {
    if (!userId) {
      if (__DEV__) {
        console.log('[useUserName] ❌ No userId provided, returning "-"');
      }
      return '-';
    }
    
    const usersMap = state.users?.usersMap || {};
    const idStr = String(userId).trim();
    const noSpacesId = idStr.replace(/\s/g, '');
    const cleanId = idStr.replace(/^ObjectId\(/, '').replace(/\)$/, '').replace(/\s/g, '');
    
    if (__DEV__) {
      console.log('[useUserName] 🔍 Looking up user:', {
        'userId': userId,
        'idStr': idStr,
        'noSpacesId': noSpacesId,
        'cleanId': cleanId,
        'usersMap size': Object.keys(usersMap).length,
        'usersMap keys sample': Object.keys(usersMap).slice(0, 5),
      });
    }
    
    // Try exact match
    if (usersMap[idStr]) {
      const name = usersMap[idStr].name || usersMap[idStr].Name || usersMap[idStr].email || usersMap[idStr].Email || `User ${idStr.substring(0, 8)}...`;
      if (__DEV__) {
        console.log('[useUserName] ✅ Found user (exact match):', name);
      }
      return name;
    }
    
    // Try with spaces removed
    if (usersMap[noSpacesId]) {
      const name = usersMap[noSpacesId].name || usersMap[noSpacesId].Name || usersMap[noSpacesId].email || usersMap[noSpacesId].Email || `User ${noSpacesId.substring(0, 8)}...`;
      if (__DEV__) {
        console.log('[useUserName] ✅ Found user (no spaces):', name);
      }
      return name;
    }
    
    // Try ObjectId format cleanup
    if (usersMap[cleanId]) {
      const name = usersMap[cleanId].name || usersMap[cleanId].Name || usersMap[cleanId].email || usersMap[cleanId].Email || `User ${cleanId.substring(0, 8)}...`;
      if (__DEV__) {
        console.log('[useUserName] ✅ Found user (cleanId):', name);
      }
      return name;
    }
    
    // Try iterating through usersMap to find by id or _id
    const foundUser = Object.values(usersMap).find(user => {
      const userIdFromMap = String(user.id || user._id || '').trim();
      return userIdFromMap === idStr || userIdFromMap === noSpacesId || userIdFromMap === cleanId;
    });
    
    if (foundUser) {
      const name = foundUser.name || foundUser.Name || foundUser.email || foundUser.Email || `User ${idStr.substring(0, 8)}...`;
      if (__DEV__) {
        console.log('[useUserName] ✅ Found user (iteration):', name);
      }
      return name;
    }
    
    // If it looks like an ObjectId but we don't have a name, return a truncated version
    if (noSpacesId.length > 12) {
      const fallback = `User ${noSpacesId.substring(0, 8)}...`;
      if (__DEV__) {
        console.log('[useUserName] ⚠️ User not found, using fallback:', fallback);
      }
      return fallback;
    }
    
    if (__DEV__) {
      console.log('[useUserName] ⚠️ User not found, returning userId:', userId);
    }
    return userId; // Fallback to original ID if short
  });
};


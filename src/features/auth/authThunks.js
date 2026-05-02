import { createAsyncThunk } from '@reduxjs/toolkit';
import secureStorage from '../../utils/secureStorage';
import { decodeJWT, mapRoleNumberToString } from '../../utils/helpers';

// Async thunk to check auth state on app start
export const checkAuthState = createAsyncThunk(
  'auth/checkAuthState',
  async () => {
    try {
      const storedUser = await secureStorage.getItem('user');
      const storedToken = await secureStorage.getItem('token');
      
      if (storedUser && storedToken) {
        // Validate token expiration
        const decodedToken = decodeJWT(storedToken);
        if (decodedToken) {
          const exp = decodedToken.exp || decodedToken.Exp;
          if (exp) {
            const currentTime = Math.floor(Date.now() / 1000);
            if (exp < currentTime) {
              // Token is expired, clear it
              await secureStorage.removeItem('user');
              await secureStorage.removeItem('token');
              return null;
            }
          }
        } else {
          // Invalid token format, clear it
          await secureStorage.removeItem('user');
          await secureStorage.removeItem('token');
          return null;
        }
        
        const userData = JSON.parse(storedUser);
        let userDataUpdated = false;
        
        // Extract roleId from token if not already in userData (for backward compatibility)
        if (!userData.roleId && !userData.roleNumber && decodedToken) {
          const roleNumber = decodedToken.Role || decodedToken.role || decodedToken.RoleNumber || decodedToken.roleNumber;
          if (roleNumber !== undefined && roleNumber !== null) {
            userData.roleId = roleNumber;
            userData.roleNumber = roleNumber; // Alias
            userDataUpdated = true;
          }
        }
        
        // Extract ClientId from token for role 4 (Client users)
        if (decodedToken && (userData.roleId === 4 || userData.roleNumber === 4)) {
          const clientId = decodedToken.ClientId || decodedToken.clientId || decodedToken.ClientID || decodedToken.clientID;
          if (clientId && userData.clientId !== clientId) {
            userData.clientId = clientId;
            userDataUpdated = true;
         
          }
        }
        
        // Check if name is missing or appears to be email-derived (contains numbers or matches email pattern)
        const isEmailDerivedName = userData.name && (
          userData.name.toLowerCase() === (userData.email?.split('@')[0] || '').toLowerCase() ||
          /^\d/.test(userData.name) || // Starts with number
          /^[a-z]+\d+$/i.test(userData.name) // Pattern like "pitbull9792"
        );
        
        // Fetch user details from API if name is missing or email-derived
        if ((!userData.name || isEmailDerivedName) && userData.id) {
          try {
            const { API_BASE_URL } = require('../../config/apiConfig');
            const userResponse = await fetch(`${API_BASE_URL}/api/users/${userData.id}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${storedToken}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (userResponse.ok) {
              const userDataResponse = await userResponse.json();
              const fetchedUser = userDataResponse.user || userDataResponse;
              const fetchedName = fetchedUser.name || fetchedUser.Name;
              
              if (fetchedName && fetchedName !== userData.name) {
                userData.name = fetchedName;
                userDataUpdated = true;
              }
            }
          } catch (error) {
            // Continue even if fetch fails
          }
        }
        
        // Add name if still missing (for backward compatibility)
        // First try to extract from token, then fallback to email-based generation
        if (!userData.name && decodedToken) {
          // Try different case variations for name in token
          const userName = decodedToken.Name || decodedToken.name || decodedToken.username || decodedToken.Username || 
                          decodedToken.fullName || decodedToken.FullName || decodedToken.firstName || decodedToken.FirstName;
          
          if (userName) {
            userData.name = userName;
            userDataUpdated = true;
          } else {
            // Fallback: generate from email if name not in token
          const getDisplayName = (email, role) => {
            if (email) {
              const emailPart = email.split('@')[0];
              return emailPart.charAt(0).toUpperCase() + emailPart.slice(1);
            }
            const roleNames = {
              admin: 'Administrator',
              client: 'Client',
              coral: 'Coral Designer',
              cad: 'CAD Designer',
            };
            return roleNames[role] || 'User';
          };
          userData.name = getDisplayName(userData.email, userData.role);
          userDataUpdated = true;
          }
        }
        
        // Save updated userData if any changes were made
        if (userDataUpdated) {
          await secureStorage.setItem('user', JSON.stringify(userData));
        }
        
        return { user: userData, token: storedToken };
      }
      return null;
    } catch (error) {
      // Clear potentially corrupted data
      try {
        await secureStorage.removeItem('user');
        await secureStorage.removeItem('token');
      } catch (clearError) {
      }
      return null;
    }
  }
);

// Async thunk for logout
export const logoutUser = createAsyncThunk(
  'auth/logout',
  async () => {
    try {
      await secureStorage.removeItem('user');
      await secureStorage.removeItem('token');
    } catch (error) {
    }
  }
);


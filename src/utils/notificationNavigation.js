import { navigationRef } from '../navigation/navigationRef';
import secureStorage from './secureStorage';
import { API_BASE_URL } from '../config/apiConfig';

// Store pending notification for when navigation becomes ready
let pendingNotification = null;
let retryCount = 0;
const MAX_RETRIES = 20; // Retry for up to 10 seconds (20 * 500ms)
const RETRY_DELAY = 500;

/**
 * Navigate to the appropriate screen based on notification data
 * Supports both link-based and type-based navigation
 * 
 * @param {Object} notificationData - The notification data object
 * @param {string} notificationData.link - Link path (e.g., 'enquiries/123', 'chats/456')
 * @param {string} notificationData.type - Notification type (e.g., 'enquiry', 'chat', 'design')
 * @param {string} notificationData.enquiryId - Enquiry ID
 * @param {string} notificationData.chatId - Chat ID
 * @param {string} notificationData.clientId - Client ID
 * @param {string} notificationData.designType - Design type ('cad' or 'coral')
 * @param {string} notificationData.chatType - Chat type
 * @param {string} notificationData.clientName - Client name
 * @param {number} notificationData.versionIndex - Design version index
 * @param {boolean} isRetry - Internal flag to track retry attempts
 */
export const navigateFromNotification = (notificationData, isRetry = false) => {
  try {
    // Log notification received (works in production too for debugging)
    console.log('[Notification Navigation] ========================================');
    console.log('[Notification Navigation] Notification received at:', new Date().toISOString());
    console.log('[Notification Navigation] Full notification data:', JSON.stringify(notificationData, null, 2));
    console.log('[Notification Navigation] Navigation ready:', navigationRef.isReady());
    console.log('[Notification Navigation] Retry count:', retryCount);
    
    // Store notification if navigation is not ready
    if (!navigationRef.isReady()) {
      pendingNotification = notificationData;
      
      if (__DEV__) {
        console.warn('[Notification Navigation] Navigation not ready, storing notification and will retry...');
      }
      
      // Retry with exponential backoff, up to MAX_RETRIES times
      if (retryCount < MAX_RETRIES) {
        retryCount++;
      setTimeout(() => {
        if (navigationRef.isReady()) {
            console.log('[Notification Navigation] Navigation is now ready, processing notification');
            retryCount = 0; // Reset retry count
            pendingNotification = null; // Clear pending
            navigateFromNotification(notificationData, true);
          } else {
            // Continue retrying
            navigateFromNotification(notificationData, true);
        }
        }, RETRY_DELAY);
      } else {
        console.warn('[Notification Navigation] Max retries reached, notification may be lost');
        retryCount = 0;
        pendingNotification = null;
      }
      return;
    }
    
    // Reset retry count when navigation is ready
    if (!isRetry) {
      retryCount = 0;
      pendingNotification = null;
    }

    const data = notificationData?.data || notificationData || {};
    const link = data.link || data.Link || data.url || data.Url;
    const notificationType = data.type || data.Type || data.notificationType || data.NotificationType;
    
    // Extract enquiryId from various possible field names
    // IMPORTANT: Don't use data.id or data.Id as it's usually the notification ID, not enquiryId
    const enquiryId = data.enquiryId || data.EnquiryId || 
                              data.enquiry_id || data.enquiryID || data.EnquiryID ||
                              data.enquiry?._id || data.enquiry?.id || data.enquiry?.Id || 
                              data.Enquiry?._id || data.Enquiry?.id || data.Enquiry?.Id;
    
    console.log('[Notification Navigation] Extracted link:', link);
    console.log('[Notification Navigation] Extracted type:', notificationType);
    console.log('[Notification Navigation] Extracted enquiryId:', enquiryId);
    console.log('[Notification Navigation] Full data object:', JSON.stringify(data, null, 2));

    // If we have enquiryId but no link/type, try to navigate to enquiry
    if (enquiryId && !link && !notificationType) {
      console.log('[Notification Navigation] Found enquiryId without link/type, navigating to enquiry');
      navigationRef.navigate('SingleEnquiry', { enquiryId });
      return;
    }

    // If no link or type or enquiryId, navigate to notifications screen
    if (!link && !notificationType && !enquiryId) {
      console.log('[Notification Navigation] No link, type, or enquiryId found, navigating to Notifications screen');
      navigationRef.navigate('Notifications');
      return;
    }

    // Helper function to extract ID from path
    // For "enquiries/123", returns "123" (the ID part after the prefix)
    const extractId = (path, prefix = '') => {
      if (!path) return null;
      const parts = path.split('/').filter(Boolean);
      
      // If prefix is provided, find the part after the prefix
      if (prefix) {
        const prefixIndex = parts.findIndex(part => part === prefix);
        if (prefixIndex >= 0 && parts[prefixIndex + 1]) {
          return parts[prefixIndex + 1];
        }
      }
      
      // Otherwise, return the last part (usually the ID)
      return parts[parts.length - 1] || null;
    };

    // Helper function to parse query parameters
    const parseQueryParams = (url) => {
      const params = {};
      const queryString = url.split('?')[1];
      if (queryString) {
        queryString.split('&').forEach(param => {
          const [key, value] = param.split('=');
          if (key && value) {
            params[decodeURIComponent(key)] = decodeURIComponent(value);
          }
        });
      }
      return params;
    };

    // Process link if available
    if (link) {
      const normalizedLink = link.replace(/^\//, '').split('?')[0]; // Remove leading slash and query string
      const queryParams = parseQueryParams(link);
      
      // Merge query params with data
      const allParams = { ...data, ...queryParams };

      if (normalizedLink.startsWith('notifications') || normalizedLink === 'notifications') {
        console.log('[Notification Navigation] ✅ Navigating to: Notifications screen');
        navigationRef.navigate('Notifications');
        return;
      } 
      else if (normalizedLink.startsWith('enquiries/')) {
        // Extract ID from "enquiries/123" -> "123"
        const enquiryId = extractId(normalizedLink, 'enquiries') || allParams.enquiryId || allParams.EnquiryId || allParams.id || allParams.Id;
        if (enquiryId && enquiryId !== 'enquiries') { // Safety check: ensure we got an actual ID, not the prefix
          console.log('[Notification Navigation] ✅ Navigating to: SingleEnquiry screen with enquiryId:', enquiryId);
          console.log('[Notification Navigation] 📋 Full notification data:', JSON.stringify(allParams, null, 2));
          navigationRef.navigate('SingleEnquiry', { enquiryId });
          return;
        } else {
          console.error('[Notification Navigation] ❌ Invalid enquiryId extracted:', enquiryId, 'from link:', normalizedLink);
        }
      } 
      else if (normalizedLink.startsWith('chats/') || normalizedLink.startsWith('chat/')) {
        const prefix = normalizedLink.startsWith('chats/') ? 'chats' : 'chat';
        const chatId = extractId(normalizedLink, prefix) || allParams.chatId || allParams.ChatId;
        const enquiryId = allParams.enquiryId || allParams.EnquiryId;
        const chatType = allParams.chatType || allParams.ChatType;
        
        if (chatId && chatId !== 'chats' && chatId !== 'chat') {
          navigationRef.navigate('ChatDetail', {
            chatId: chatId,
            enquiryId: enquiryId,
            chatType: chatType,
          });
          return;
        }
      }
      else if (normalizedLink.startsWith('chat-groups') || normalizedLink === 'chat-groups') {
        navigationRef.navigate('ChatGroups');
        return;
      }
      else if (normalizedLink.startsWith('designs/') || normalizedLink.startsWith('design/')) {
        const prefix = normalizedLink.startsWith('designs/') ? 'designs' : 'design';
        const enquiryId = extractId(normalizedLink, prefix) || allParams.enquiryId || allParams.EnquiryId;
        const designType = allParams.designType || allParams.DesignType || 'cad';
        const versionIndex = allParams.versionIndex ? parseInt(allParams.versionIndex) : undefined;
        
        if (enquiryId && enquiryId !== 'designs' && enquiryId !== 'design') {
          navigationRef.navigate('DesignViewer', {
            enquiryId,
            designType,
            versionIndex,
          });
          return;
        }
      }
      else if (normalizedLink.startsWith('pricing/')) {
        const enquiryId = extractId(normalizedLink, 'pricing') || allParams.enquiryId || allParams.EnquiryId;
        const designType = allParams.designType || allParams.DesignType || 'cad';
        
        if (enquiryId && enquiryId !== 'pricing') {
          navigationRef.navigate('Pricing', {
            enquiryId,
            designType,
          });
          return;
        }
      }
      else if (normalizedLink.startsWith('upload-design') || normalizedLink === 'upload-design') {
        const enquiryId = allParams.enquiryId || allParams.EnquiryId;
        const designType = allParams.designType || allParams.DesignType || 'cad';
        
        navigationRef.navigate('UploadDesign', {
          enquiryId,
          designType,
        });
        return;
      }
      else if (normalizedLink.startsWith('metal-prices') || normalizedLink === 'metal-prices') {
        navigationRef.navigate('MetalPrices');
        return;
      }
      else if (normalizedLink.startsWith('clients/')) {
        const clientId = extractId(normalizedLink, 'clients') || allParams.clientId || allParams.ClientId;
        const clientName = allParams.clientName || allParams.ClientName;
        
        if (clientId && clientId !== 'clients') {
          // Navigate to client pricing if clientId provided
          navigationRef.navigate('ClientPricing', {
            clientId,
            clientName,
          });
          return;
        } else {
          // Navigate to clients list
          navigationRef.navigate('ClientsList');
          return;
        }
      }
      else if (normalizedLink.startsWith('clients') || normalizedLink === 'clients') {
        navigationRef.navigate('ClientsList');
        return;
      }
      else if (normalizedLink.startsWith('create-client') || normalizedLink === 'create-client') {
        navigationRef.navigate('CreateClient');
        return;
      }
      else if (normalizedLink.startsWith('dashboard') || normalizedLink === 'dashboard') {
        navigationRef.navigate('MainTabs', { screen: 'Dashboard' });
        return;
      }
      else if (normalizedLink.startsWith('enquiries') || normalizedLink === 'enquiries') {
        navigationRef.navigate('MainTabs', { screen: 'Enquiries' });
        return;
      }
    }

    // Handle notification type as fallback or primary method
    if (notificationType) {
      const type = notificationType.toLowerCase();
      const notificationId = data.id || data._id || data.Id || data._Id;
      
      // Extract enquiryId - DON'T use data.id or data.Id as that's the notification ID
      const typeEnquiryId = enquiryId || 
                            data.enquiryId || data.EnquiryId ||
                            data.enquiry_id || data.enquiryID || data.EnquiryID ||
                            data.enquiry?._id || data.enquiry?.id || data.enquiry?.Id || 
                            data.Enquiry?._id || data.Enquiry?.id || data.Enquiry?.Id;
      
      const chatId = data.chatId || data.ChatId;
      const clientId = data.clientId || data.ClientId;
      const clientName = data.clientName || data.ClientName;
      const designType = data.designType || data.DesignType || 'cad';
      const chatType = data.chatType || data.ChatType;

      switch (type) {
        case 'enquiry':
        case 'enquiry_update':
        case 'enquiry_updated':
        case 'enquiry_created':
        case 'enquiry_assigned':
        case 'assigned':
        case 'assigned_to':
        case 'assignedto':
        case 'assignment':
          // Only use enquiryId if it exists and is not the notification ID
          const validEnquiryId = typeEnquiryId && typeEnquiryId !== notificationId ? typeEnquiryId : null;
          
          if (validEnquiryId) {
            console.log('[Notification Navigation] ✅ Navigating to: SingleEnquiry screen with enquiryId:', validEnquiryId);
            navigationRef.navigate('SingleEnquiry', { enquiryId: validEnquiryId });
            return;
          } else {
            // Try to extract enquiry name from message and search for it
            const message = data.message || data.Message || data.body || data.Body || '';
            console.log('[Notification Navigation] ⚠️ No enquiryId found, trying to extract from message:', message);
            
            // Extract enquiry name from message patterns like:
            // "You've been assigned to enquiry \"Test\"."
            // "Enquiry \"Test\" has been updated."
            // "1 file uploaded for enquiry \"SHOTTA MAFIA\""
            const enquiryNameMatch = message.match(/enquiry\s+"([^"]+)"/i) || 
                                   message.match(/enquiry\s+([^".]+)/i);
            
            if (enquiryNameMatch && enquiryNameMatch[1]) {
              const enquiryName = enquiryNameMatch[1].trim();
              console.log('[Notification Navigation] 🔍 Extracted enquiry name:', enquiryName);
              
              // Search for enquiry by name asynchronously
              searchAndNavigateToEnquiry(enquiryName);
              return;
            } else {
              console.warn('[Notification Navigation] ⚠️ Could not extract enquiry name from message');
              console.warn('[Notification Navigation] ⚠️ Backend notification should include enquiryId field');
              // Fallback: Navigate to enquiries list
              navigationRef.navigate('MainTabs', { screen: 'Enquiries' });
              return;
            }
          }
          break;
        case 'chat':
        case 'message':
        case 'chat_message':
          if (chatId) {
            navigationRef.navigate('ChatDetail', {
              chatId,
              enquiryId: enquiryId,
              chatType: chatType,
            });
            return;
          } else {
            navigationRef.navigate('MainTabs', { screen: 'Chats' });
            return;
          }
        case 'design':
        case 'design_uploaded':
        case 'design_updated':
          // Check if we have enquiryId
          const designEnquiryId = enquiryId && enquiryId !== notificationId ? enquiryId : null;
          
          if (designEnquiryId) {
            navigationRef.navigate('DesignViewer', {
              enquiryId: designEnquiryId,
              designType,
            });
            return;
          } else {
            // Try to extract enquiry name and design type from message
            const message = data.message || data.Message || data.body || data.Body || '';
            console.log('[Notification Navigation] 🔍 Design notification, extracting from message:', message);
            
            // Detect design type from message (Coral or CAD)
            const isCoral = /coral/i.test(message) || /coral/i.test(notificationType);
            const isCAD = /cad/i.test(message) || /cad/i.test(notificationType);
            const detectedDesignType = isCoral ? 'coral' : (isCAD ? 'cad' : designType || 'cad');
            
            // Extract enquiry name from message patterns like:
            // "New Coral uploaded" - "1 file uploaded for enquiry \"SHOTTA MAFIA\""
            // "New CAD uploaded" - "1 file uploaded for enquiry \"Test\""
            const enquiryNameMatch = message.match(/enquiry\s+"([^"]+)"/i) || 
                                   message.match(/enquiry\s+([^".]+)/i);
            
            if (enquiryNameMatch && enquiryNameMatch[1]) {
              const enquiryName = enquiryNameMatch[1].trim();
              console.log('[Notification Navigation] 🔍 Extracted enquiry name for design:', enquiryName, 'designType:', detectedDesignType);
              
              // Search for enquiry and navigate to DesignViewer
              searchAndNavigateToDesign(enquiryName, detectedDesignType);
              return;
            } else {
              console.warn('[Notification Navigation] ⚠️ Could not extract enquiry name from design notification');
              navigationRef.navigate('MainTabs', { screen: 'Enquiries' });
              return;
            }
          }
          break;
        case 'asset_upload':
        case 'uploaded':
        case 'file_uploaded':
        case 'reference_uploaded':
        case 'image_uploaded':
          // Reference images/uploads should navigate to SingleEnquiry, not DesignViewer
          // Check if this is actually a design upload (has designType or mentions "design" in message)
          const uploadMessage = data.message || data.Message || data.body || data.Body || '';
          const isDesignUpload = /design/i.test(uploadMessage) || /coral/i.test(uploadMessage) || /cad/i.test(uploadMessage) || data.designType || data.DesignType;
          
          if (isDesignUpload) {
            // This is a design upload, handle like design_uploaded
            const uploadDesignEnquiryId = enquiryId && enquiryId !== notificationId ? enquiryId : null;
            
            if (uploadDesignEnquiryId) {
              navigationRef.navigate('DesignViewer', {
                enquiryId: uploadDesignEnquiryId,
                designType: data.designType || data.DesignType || designType || 'cad',
              });
              return;
            } else {
              // Extract enquiry name for design upload
              const enquiryNameMatch = uploadMessage.match(/enquiry\s+"([^"]+)"/i) || 
                                     uploadMessage.match(/enquiry\s+([^".]+)/i);
              
              if (enquiryNameMatch && enquiryNameMatch[1]) {
                const enquiryName = enquiryNameMatch[1].trim();
                const isCoral = /coral/i.test(uploadMessage);
                const detectedDesignType = isCoral ? 'coral' : (designType || 'cad');
                searchAndNavigateToDesign(enquiryName, detectedDesignType);
                return;
              }
            }
          }
          
          // Default: Reference image upload - navigate to SingleEnquiry
          const uploadEnquiryId = enquiryId && enquiryId !== notificationId ? enquiryId : null;
          
          if (uploadEnquiryId) {
            console.log('[Notification Navigation] ✅ Navigating to: SingleEnquiry screen (reference upload) with enquiryId:', uploadEnquiryId);
            navigationRef.navigate('SingleEnquiry', { enquiryId: uploadEnquiryId });
            return;
          } else {
            // Try to extract enquiry name from message
            const message = data.message || data.Message || data.body || data.Body || '';
            console.log('[Notification Navigation] 🔍 Upload notification, extracting enquiry name from message:', message);
            
            const enquiryNameMatch = message.match(/enquiry\s+"([^"]+)"/i) || 
                                   message.match(/enquiry\s+([^".]+)/i);
            
            if (enquiryNameMatch && enquiryNameMatch[1]) {
              const enquiryName = enquiryNameMatch[1].trim();
              console.log('[Notification Navigation] 🔍 Extracted enquiry name for upload:', enquiryName);
              
              // Search for enquiry and navigate to SingleEnquiry (not DesignViewer)
              searchAndNavigateToEnquiry(enquiryName);
              return;
            } else {
              console.warn('[Notification Navigation] ⚠️ Could not extract enquiry name from upload notification');
              navigationRef.navigate('MainTabs', { screen: 'Enquiries' });
              return;
            }
          }
          break;
        case 'pricing':
        case 'pricing_update':
          const pricingEnquiryId = enquiryId && enquiryId !== notificationId ? enquiryId : null;
          
          if (pricingEnquiryId) {
            navigationRef.navigate('Pricing', {
              enquiryId: pricingEnquiryId,
              designType,
            });
            return;
          } else {
            // Try to extract enquiry name from message
            const message = data.message || data.Message || data.body || data.Body || '';
            const enquiryNameMatch = message.match(/enquiry\s+"([^"]+)"/i) || 
                                   message.match(/enquiry\s+([^".]+)/i);
            
            if (enquiryNameMatch && enquiryNameMatch[1]) {
              const enquiryName = enquiryNameMatch[1].trim();
              // Detect design type
              const isCoral = /coral/i.test(message);
              const detectedDesignType = isCoral ? 'coral' : (designType || 'cad');
              searchAndNavigateToPricing(enquiryName, detectedDesignType);
              return;
            } else {
              navigationRef.navigate('MainTabs', { screen: 'Enquiries' });
              return;
            }
          }
          break;
        case 'client':
        case 'client_created':
        case 'client_updated':
          if (clientId) {
            navigationRef.navigate('ClientPricing', {
              clientId,
              clientName,
            });
            return;
          } else {
            navigationRef.navigate('ClientsList');
            return;
          }
        case 'metal_price':
        case 'metal_price_update':
          navigationRef.navigate('MetalPrices');
          return;
        default:
          break;
      }
    }

    // Default fallback - navigate to appropriate screen based on notification type
    if (notificationType) {
      const type = notificationType.toLowerCase();
      console.log('[Notification Navigation] ⚠️ No specific ID found, navigating to list screen for type:', type);
      
      // Navigate to appropriate list screen based on notification type
      if (type.includes('chat') || type.includes('message')) {
        navigationRef.navigate('MainTabs', { screen: 'Chats' });
        return;
      } else if (type.includes('enquiry') || type.includes('assigned') || type.includes('design') || type.includes('pricing')) {
        navigationRef.navigate('MainTabs', { screen: 'Enquiries' });
        return;
      } else if (type.includes('client')) {
        navigationRef.navigate('ClientsList');
        return;
      }
    }
    
    // Final fallback to notifications screen
    console.log('[Notification Navigation] ✅ Navigating to: Notifications screen (final fallback)');
    navigationRef.navigate('Notifications');
    console.log('[Notification Navigation] ========================================');
  } catch (error) {
    console.error('[Notification Navigation] ❌ Error navigating from notification:', error);
    if (__DEV__) {
      console.error('[Notification] Error navigating from notification:', error);
    }
    // Fallback to notifications screen on error
    try {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Notifications');
      }
    } catch (fallbackError) {
      if (__DEV__) {
        console.error('[Notification] Error in fallback navigation:', fallbackError);
      }
    }
  }
};

/**
 * Search for enquiry by name and navigate to SingleEnquiry screen
 */
const searchAndNavigateToEnquiry = async (enquiryName) => {
  try {
    console.log('[Notification Navigation] 🔍 Searching for enquiry:', enquiryName);
    
    const token = await secureStorage.getItem('token');
    if (!token) {
      console.warn('[Notification Navigation] ⚠️ No token available for search');
      navigationRef.navigate('MainTabs', { screen: 'Enquiries' });
      return;
    }

    // Search for enquiry by name
    const searchParams = new URLSearchParams();
    searchParams.append('search', enquiryName);
    searchParams.append('limit', '10');
    searchParams.append('page', '1');
    
    const searchUrl = `${API_BASE_URL}/api/enquiries/search?${searchParams.toString()}`;
    console.log('[Notification Navigation] 🔍 Search URL:', searchUrl);

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('[Notification Navigation] ❌ Search failed:', response.status);
      navigationRef.navigate('MainTabs', { screen: 'Enquiries' });
      return;
    }

    const result = await response.json();
    const enquiries = Array.isArray(result?.data) ? result.data : 
                     Array.isArray(result) ? result : 
                     Array.isArray(result?.enquiries) ? result.enquiries : [];

    console.log('[Notification Navigation] 🔍 Search results:', enquiries.length, 'enquiries found');

    // Find exact match by name (case-insensitive)
    const foundEnquiry = enquiries.find(e => {
      const name = e.Name || e.name || '';
      return name.toLowerCase().trim() === enquiryName.toLowerCase().trim();
    });

    if (foundEnquiry) {
      const enquiryId = foundEnquiry._id || foundEnquiry.id || foundEnquiry._Id || foundEnquiry.Id;
      if (enquiryId) {
        console.log('[Notification Navigation] ✅ Found enquiry, navigating to SingleEnquiry:', enquiryId);
        navigationRef.navigate('SingleEnquiry', { enquiryId });
        return;
      }
    }

    // If no exact match, try first result
    if (enquiries.length > 0) {
      const firstEnquiry = enquiries[0];
      const enquiryId = firstEnquiry._id || firstEnquiry.id || firstEnquiry._Id || firstEnquiry.Id;
      if (enquiryId) {
        console.log('[Notification Navigation] ⚠️ No exact match, using first result:', enquiryId);
        navigationRef.navigate('SingleEnquiry', { enquiryId });
        return;
      }
    }

    console.warn('[Notification Navigation] ⚠️ No enquiry found with name:', enquiryName);
    navigationRef.navigate('MainTabs', { screen: 'Enquiries' });
  } catch (error) {
    console.error('[Notification Navigation] ❌ Error searching for enquiry:', error);
    navigationRef.navigate('MainTabs', { screen: 'Enquiries' });
  }
};

/**
 * Search for enquiry by name and navigate to DesignViewer screen
 */
const searchAndNavigateToDesign = async (enquiryName, designType = 'cad') => {
  try {
    console.log('[Notification Navigation] 🔍 Searching for enquiry for design:', enquiryName, 'designType:', designType);
    
    const token = await secureStorage.getItem('token');
    if (!token) {
      console.warn('[Notification Navigation] ⚠️ No token available for search');
      navigationRef.navigate('MainTabs', { screen: 'Enquiries' });
      return;
    }

    const searchParams = new URLSearchParams();
    searchParams.append('search', enquiryName);
    searchParams.append('limit', '10');
    searchParams.append('page', '1');
    
    const searchUrl = `${API_BASE_URL}/api/enquiries/search?${searchParams.toString()}`;

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      navigationRef.navigate('MainTabs', { screen: 'Enquiries' });
      return;
    }

    const result = await response.json();
    const enquiries = Array.isArray(result?.data) ? result.data : 
                     Array.isArray(result) ? result : 
                     Array.isArray(result?.enquiries) ? result.enquiries : [];

    const foundEnquiry = enquiries.find(e => {
      const name = e.Name || e.name || '';
      return name.toLowerCase().trim() === enquiryName.toLowerCase().trim();
    });

    if (foundEnquiry) {
      const enquiryId = foundEnquiry._id || foundEnquiry.id || foundEnquiry._Id || foundEnquiry.Id;
      if (enquiryId) {
        console.log('[Notification Navigation] ✅ Found enquiry for design, navigating to DesignViewer:', enquiryId, 'designType:', designType);
        navigationRef.navigate('DesignViewer', { 
          enquiryId,
          designType,
        });
        return;
      }
    }

    if (enquiries.length > 0) {
      const firstEnquiry = enquiries[0];
      const enquiryId = firstEnquiry._id || firstEnquiry.id || firstEnquiry._Id || firstEnquiry.Id;
      if (enquiryId) {
        navigationRef.navigate('DesignViewer', { 
          enquiryId,
          designType,
        });
        return;
      }
    }

    navigationRef.navigate('MainTabs', { screen: 'Enquiries' });
  } catch (error) {
    console.error('[Notification Navigation] ❌ Error searching for design enquiry:', error);
    navigationRef.navigate('MainTabs', { screen: 'Enquiries' });
  }
};

/**
 * Search for enquiry by name and navigate to Pricing screen
 */
const searchAndNavigateToPricing = async (enquiryName, designType = 'cad') => {
  try {
    console.log('[Notification Navigation] 🔍 Searching for enquiry for pricing:', enquiryName, 'designType:', designType);
    
    const token = await secureStorage.getItem('token');
    if (!token) {
      navigationRef.navigate('MainTabs', { screen: 'Enquiries' });
      return;
    }

    const searchParams = new URLSearchParams();
    searchParams.append('search', enquiryName);
    searchParams.append('limit', '10');
    searchParams.append('page', '1');
    
    const searchUrl = `${API_BASE_URL}/api/enquiries/search?${searchParams.toString()}`;

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      navigationRef.navigate('MainTabs', { screen: 'Enquiries' });
      return;
    }

    const result = await response.json();
    const enquiries = Array.isArray(result?.data) ? result.data : 
                     Array.isArray(result) ? result : 
                     Array.isArray(result?.enquiries) ? result.enquiries : [];

    const foundEnquiry = enquiries.find(e => {
      const name = e.Name || e.name || '';
      return name.toLowerCase().trim() === enquiryName.toLowerCase().trim();
    });

    if (foundEnquiry) {
      const enquiryId = foundEnquiry._id || foundEnquiry.id || foundEnquiry._Id || foundEnquiry.Id;
      if (enquiryId) {
        navigationRef.navigate('Pricing', { 
          enquiryId,
          designType,
        });
        return;
      }
    }

    if (enquiries.length > 0) {
      const firstEnquiry = enquiries[0];
      const enquiryId = firstEnquiry._id || firstEnquiry.id || firstEnquiry._Id || firstEnquiry.Id;
      if (enquiryId) {
        navigationRef.navigate('Pricing', { 
          enquiryId,
          designType,
        });
        return;
      }
    }

    navigationRef.navigate('MainTabs', { screen: 'Enquiries' });
  } catch (error) {
    console.error('[Notification Navigation] ❌ Error searching for pricing enquiry:', error);
    navigationRef.navigate('MainTabs', { screen: 'Enquiries' });
  }
};

/**
 * Process any pending notification that was stored before navigation was ready
 * This is called when navigation becomes ready to handle notifications from killed state
 */
export const processPendingNotification = () => {
  console.log('[Notification Navigation] ========================================');
  console.log('[Notification Navigation] 🔍 Checking for pending notification...');
  console.log('[Notification Navigation] Has pending notification:', !!pendingNotification);
  console.log('[Notification Navigation] Navigation ready:', navigationRef.isReady());
  
  if (pendingNotification && navigationRef.isReady()) {
    console.log('[Notification Navigation] ✅ Processing pending notification');
    console.log('[Notification Navigation] Pending notification data:', JSON.stringify(pendingNotification, null, 2));
    const notification = pendingNotification;
    pendingNotification = null; // Clear before processing
    retryCount = 0; // Reset retry count
    console.log('[Notification Navigation] Calling navigateFromNotification...');
    navigateFromNotification(notification);
  } else {
    if (pendingNotification) {
      console.log('[Notification Navigation] ⚠️ Pending notification exists but navigation not ready yet');
      console.log('[Notification Navigation] Navigation ready:', navigationRef.isReady());
      console.log('[Notification Navigation] Will retry when navigation becomes ready');
    } else {
      console.log('[Notification Navigation] ℹ️ No pending notification to process');
    }
  }
  console.log('[Notification Navigation] ========================================');
};


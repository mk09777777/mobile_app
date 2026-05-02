/**
 * Utility functions for message formatting and status handling
 */

/**
 * Format message timestamp to relative time
 */
export const formatMessageTime = (timestamp) => {
  if (!timestamp) return '';
  
  try {
    // Handle different timestamp formats
    let date;
    if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      // Handle Unix timestamp (seconds or milliseconds)
      date = timestamp < 10000000000 ? new Date(timestamp * 1000) : new Date(timestamp);
    } else {
      date = new Date(timestamp);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }
    
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffSeconds = Math.floor(diffTime / 1000);
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Show "now" for messages less than 1 minute old
    if (diffSeconds < 60) return 'now';
    
    // Show minutes for messages less than 1 hour old
    if (diffMinutes < 60) return `${diffMinutes}m`;
    
    // Show hours for messages less than 24 hours old
    if (diffHours < 24) return `${diffHours}h`;
    
    // Show days for messages less than 7 days old
    if (diffDays < 7) return `${diffDays}d`;
    
    // For older messages, show date
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    const currentYear = now.getFullYear();
    
    if (year === currentYear) {
      return `${month}/${day}`;
    } else {
      return `${month}/${day}/${year.toString().slice(-2)}`;
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('Error formatting message time:', timestamp, error);
    }
    return '';
  }
};

/**
 * Get message status icon name
 */
export const getMessageStatusIcon = (status) => {
  const iconMap = {
    'sending': 'schedule',
    'sent': 'check',
    'delivered': 'done-all',
    'read': 'done-all',
    'failed': 'error',
  };
  
  return iconMap[status] || 'check';
};

/**
 * Get message status color
 */
export const getMessageStatusColor = (status, isMyMessage = false, colors) => {
  if (isMyMessage) {
    // User's messages are on dark background - use white/light colors
    switch (status) {
      case 'sending': return colors.textWhite + 'CC';
      case 'sent': return colors.textWhite + 'CC';
      case 'delivered': return colors.textWhite + 'CC';
      case 'read': return colors.textWhite;
      case 'failed': return colors.error;
      default: return colors.textWhite + 'CC';
    }
  } else {
    // Other messages are on white background - use dark colors
    switch (status) {
      case 'sending': return colors.textLight;
      case 'sent': return colors.textLight;
      case 'delivered': return colors.textLight;
      case 'read': return colors.primary;
      case 'failed': return colors.error;
      default: return colors.textLight;
    }
  }
};

/**
 * Get sender color based on role
 */
export const getSenderColor = (role, colors) => {
  switch (role) {
    case 'admin': return colors.primary;
    case 'client': return colors.success;
    case 'coral': return colors.warning;
    case 'cad': return colors.info;
    default: return colors.textSecondary;
  }
};

/**
 * Check if message is from current user
 */
export const isMyMessage = (message, user) => {
  if (!user) return false;
  
  const senderId = message.SenderId || message.senderId || message.Sender?.Id || message.sender?.id;
  if (!senderId) return false;
  
  const userId = user.id || user._id || user.Id;
  if (!userId) return false;
  
  return String(senderId).trim() === String(userId).trim();
};

/**
 * Format read receipt timestamp with date and time
 */
export const formatReadTimestamp = (timestamp) => {
  if (!timestamp) return '';
  
  try {
    // Handle different timestamp formats
    let date;
    if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      // Handle Unix timestamp (seconds or milliseconds)
      date = timestamp < 10000000000 ? new Date(timestamp * 1000) : new Date(timestamp);
    } else {
      date = new Date(timestamp);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }
    
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffSeconds = Math.floor(diffTime / 1000);
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Format time (12-hour format with AM/PM)
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const timeStr = `${displayHours}:${displayMinutes} ${ampm}`;
    
    // Format date
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    const currentYear = now.getFullYear();
    
    // Show relative time for recent reads
    if (diffSeconds < 60) {
      return `Just now • ${timeStr}`;
    }
    
    if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago • ${timeStr}`;
    }
    
    if (diffHours < 24) {
      const isToday = date.getDate() === now.getDate() && 
                      date.getMonth() === now.getMonth() && 
                      date.getFullYear() === now.getFullYear();
      if (isToday) {
        return `Today at ${timeStr}`;
      }
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago • ${timeStr}`;
    }
    
    if (diffDays === 1) {
      return `Yesterday at ${timeStr}`;
    }
    
    if (diffDays < 7) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[date.getDay()];
      return `${dayName} at ${timeStr}`;
    }
    
    // For older reads, show full date
    if (year === currentYear) {
      return `${month}/${day}/${year} at ${timeStr}`;
    } else {
      return `${month}/${day}/${year} at ${timeStr}`;
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('Error formatting read timestamp:', timestamp, error);
    }
    return '';
  }
};


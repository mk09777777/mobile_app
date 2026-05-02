/**
 * Unit tests for utility functions in helpers.js
 */
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getStatusColor,
  getPriorityColor,
  getRoleDisplayName,
  generateId,
  validateEmail,
  validatePassword,
  truncateText,
  formatCount,
  decodeJWT,
  mapRoleNumberToString,
  setRolesCache,
  formatHistoryDetails,
} from '../../utils/helpers';
import { colors } from '../../constants/colors';

describe('Helper Functions', () => {
  describe('formatCurrency', () => {
    it('should format currency in INR format', () => {
      expect(formatCurrency(1000)).toContain('1,000');
      expect(formatCurrency(100000)).toContain('1,00,000');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toContain('0');
    });

    it('should handle negative numbers', () => {
      const formatted = formatCurrency(-1000);
      expect(formatted).toContain('-');
      expect(formatted).toContain('1,000');
    });
  });

  describe('formatDate', () => {
    it('should format valid date string', () => {
      const date = '2024-01-15T00:00:00Z';
      const formatted = formatDate(date);
      expect(formatted).toBeTruthy();
      expect(formatted).not.toBe('Invalid date');
    });

    it('should return "No date" for null/undefined', () => {
      expect(formatDate(null)).toBe('No date');
      expect(formatDate(undefined)).toBe('No date');
    });

    it('should return "Invalid date" for invalid date string', () => {
      expect(formatDate('invalid-date')).toBe('Invalid date');
    });
  });

  describe('formatDateTime', () => {
    it('should format date and time', () => {
      const date = '2024-01-15T10:30:00Z';
      const formatted = formatDateTime(date);
      expect(formatted).toBeTruthy();
      expect(formatted).toContain('2024');
    });
  });

  describe('getStatusColor', () => {
    it('should return correct color for pending status', () => {
      expect(getStatusColor('pending')).toBe(colors.warning);
    });

    it('should return correct color for in_progress status', () => {
      expect(getStatusColor('in_progress')).toBe(colors.info);
    });

    it('should return correct color for completed status', () => {
      expect(getStatusColor('completed')).toBe(colors.success);
    });

    it('should return correct color for rejected status', () => {
      expect(getStatusColor('rejected')).toBe(colors.error);
    });

    it('should return default color for unknown status', () => {
      expect(getStatusColor('unknown')).toBe(colors.textSecondary);
    });
  });

  describe('getPriorityColor', () => {
    it('should return correct color for normal priority', () => {
      expect(getPriorityColor('normal')).toBe(colors.success);
    });

    it('should return correct color for high priority', () => {
      expect(getPriorityColor('high')).toBe(colors.warning);
    });

    it('should return correct color for super high priority', () => {
      expect(getPriorityColor('super high')).toBe(colors.error);
    });

    it('should handle case insensitive priority', () => {
      expect(getPriorityColor('HIGH')).toBe(colors.warning);
      expect(getPriorityColor('Super High')).toBe(colors.error);
    });
  });

  describe('getRoleDisplayName', () => {
    it('should return correct display name for admin', () => {
      expect(getRoleDisplayName('admin')).toBe('Administrator');
    });

    it('should return correct display name for client', () => {
      expect(getRoleDisplayName('client')).toBe('Client');
    });

    it('should return correct display name for coral', () => {
      expect(getRoleDisplayName('coral')).toBe('Coral Designer');
    });

    it('should return correct display name for cad', () => {
      expect(getRoleDisplayName('cad')).toBe('CAD Designer');
    });

    it('should return role as-is for unknown role', () => {
      expect(getRoleDisplayName('unknown')).toBe('unknown');
    });
  });

  describe('generateId', () => {
    it('should generate a unique ID', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it('should generate string ID', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate passwords with 6+ characters', () => {
      expect(validatePassword('123456')).toBe(true);
      expect(validatePassword('password123')).toBe(true);
    });

    it('should reject passwords with less than 6 characters', () => {
      expect(validatePassword('12345')).toBe(false);
      expect(validatePassword('')).toBe(false);
    });
  });

  describe('truncateText', () => {
    it('should truncate text longer than maxLength', () => {
      const text = 'This is a long text';
      expect(truncateText(text, 10)).toBe('This is a ...');
    });

    it('should not truncate text shorter than maxLength', () => {
      const text = 'Short';
      expect(truncateText(text, 10)).toBe('Short');
    });

    it('should handle empty string', () => {
      expect(truncateText('', 10)).toBe('');
    });
  });

  describe('formatCount', () => {
    it('should format numbers less than 1000', () => {
      expect(formatCount(500)).toBe('500');
      expect(formatCount(999)).toBe('999');
    });

    it('should format numbers in thousands', () => {
      expect(formatCount(1000)).toBe('1K');
      expect(formatCount(1500)).toBe('1.5K');
      expect(formatCount(9999)).toBe('10K');
    });

    it('should format numbers in lacs', () => {
      expect(formatCount(100000)).toBe('1L');
      expect(formatCount(150000)).toBe('1.5L');
    });

    it('should format numbers in crores', () => {
      expect(formatCount(10000000)).toBe('1Cr');
      expect(formatCount(15000000)).toBe('1.5Cr');
    });

    it('should handle zero', () => {
      expect(formatCount(0)).toBe('0');
    });

    it('should handle invalid input', () => {
      expect(formatCount('invalid')).toBe('0');
      expect(formatCount(null)).toBe('0');
    });
  });

  describe('decodeJWT', () => {
    it('should decode valid JWT token', () => {
      // Create a mock JWT token (header.payload.signature)
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ userId: 1, exp: 9999999999 }));
      const token = `${header}.${payload}.signature`;
      
      const decoded = decodeJWT(token);
      expect(decoded).toBeTruthy();
      expect(decoded.userId).toBe(1);
    });

    it('should return null for invalid token format', () => {
      expect(decodeJWT('invalid-token')).toBeNull();
      expect(decodeJWT('')).toBeNull();
    });

    it('should handle tokens with URL-safe base64', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256' })).replace(/\+/g, '-').replace(/\//g, '_');
      const payload = btoa(JSON.stringify({ userId: 1 })).replace(/\+/g, '-').replace(/\//g, '_');
      const token = `${header}.${payload}.signature`;
      
      const decoded = decodeJWT(token);
      expect(decoded).toBeTruthy();
    });
  });

  describe('setRolesCache and mapRoleNumberToString', () => {
    beforeEach(() => {
      // Clear cache before each test
      setRolesCache([]);
    });

    it('should cache roles and map role numbers to strings', () => {
      const roles = [
        { id: 1, code: 'AD', name: 'Admin' },
        { id: 2, code: 'CO', name: 'Coral Designer' },
        { id: 3, code: 'CD', name: 'CAD Designer' },
        { id: 4, code: 'CL', name: 'Client' },
      ];

      setRolesCache(roles);
      
      expect(mapRoleNumberToString(1)).toBe('admin');
      expect(mapRoleNumberToString(2)).toBe('coral');
      expect(mapRoleNumberToString(3)).toBe('cad');
      expect(mapRoleNumberToString(4)).toBe('client');
    });

    it('should use fallback map when cache is empty', () => {
      expect(mapRoleNumberToString(1)).toBe('admin');
      expect(mapRoleNumberToString(4)).toBe('client');
    });

    it('should return null for unknown role number', () => {
      expect(mapRoleNumberToString(999)).toBeNull();
    });
  });

  describe('formatHistoryDetails', () => {
    it('should return "-" for empty or null details', () => {
      expect(formatHistoryDetails(null)).toBe('-');
      expect(formatHistoryDetails('')).toBe('-');
      expect(formatHistoryDetails('-')).toBe('-');
    });

    it('should return simple messages as-is', () => {
      const message = 'Enquiry created';
      expect(formatHistoryDetails(message)).toBe(message);
    });

    it('should format field changes', () => {
      const details = 'Status: from "pending" to "in_progress"';
      const formatted = formatHistoryDetails(details);
      expect(formatted).toContain('Status');
      expect(formatted).toContain('pending');
      expect(formatted).toContain('in_progress');
    });

    it('should handle JSON values in changes', () => {
      const details = 'Metal: from "{\\"Color\\":\\"Gold\\",\\"Quality\\":\\"22K\\"}" to "{\\"Color\\":\\"Silver\\",\\"Quality\\":\\"18K\\"}"';
      const formatted = formatHistoryDetails(details);
      expect(formatted).toBeTruthy();
    });
  });
});


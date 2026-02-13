import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

describe('Authentication', () => {
  const JWT_SECRET = 'test-secret';

  describe('Password Hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'mySecurePassword123';
      const hash = await bcrypt.hash(password, 10);

      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(password.length);
    });

    it('should verify correct password', async () => {
      const password = 'mySecurePassword123';
      const hash = await bcrypt.hash(password, 10);

      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'mySecurePassword123';
      const wrongPassword = 'wrongPassword456';
      const hash = await bcrypt.hash(password, 10);

      const isValid = await bcrypt.compare(wrongPassword, hash);
      expect(isValid).toBe(false);
    });
  });

  describe('JWT Tokens', () => {
    it('should generate valid token', () => {
      const payload = { userId: '123', username: 'testuser' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should decode token correctly', () => {
      const payload = { userId: '123', username: 'testuser' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

      const decoded = jwt.verify(token, JWT_SECRET) as typeof payload;
      expect(decoded.userId).toBe('123');
      expect(decoded.username).toBe('testuser');
    });

    it('should reject invalid token', () => {
      const token = 'invalid.token.here';

      expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
    });

    it('should reject token with wrong secret', () => {
      const payload = { userId: '123' };
      const token = jwt.sign(payload, JWT_SECRET);

      expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
    });
  });

  describe('Input Validation', () => {
    const isValidEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    const isValidUsername = (username: string): boolean => {
      return username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(username);
    };

    const isValidPassword = (password: string): boolean => {
      return password.length >= 6;
    };

    it('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.org')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
    });

    it('should validate correct usernames', () => {
      expect(isValidUsername('john')).toBe(true);
      expect(isValidUsername('user_123')).toBe(true);
      expect(isValidUsername('GeoMaster2024')).toBe(true);
    });

    it('should reject invalid usernames', () => {
      expect(isValidUsername('ab')).toBe(false); // too short
      expect(isValidUsername('a'.repeat(21))).toBe(false); // too long
      expect(isValidUsername('user name')).toBe(false); // has space
      expect(isValidUsername('user@name')).toBe(false); // has special char
    });

    it('should validate passwords', () => {
      expect(isValidPassword('123456')).toBe(true);
      expect(isValidPassword('mypassword')).toBe(true);
    });

    it('should reject short passwords', () => {
      expect(isValidPassword('12345')).toBe(false);
      expect(isValidPassword('abc')).toBe(false);
    });
  });
});

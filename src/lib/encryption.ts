import CryptoJS from 'crypto-js';
import { env } from '../config/env';
import type { EncryptedData, ValidationHash } from '@/types';

export class EncryptionUtils {
  private static readonly ALGORITHM = 'AES-256-CBC';
  
  static encrypt(data: string): EncryptedData {
    try {
      const iv = CryptoJS.lib.WordArray.random(16);
      const encrypted = CryptoJS.AES.encrypt(data, env.ENCRYPTION_KEY, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      return {
        data: encrypted.toString(),
        iv: iv.toString(),
        authTag: encrypted.toString(), // In a real implementation, extract actual auth tag
      };
    } catch (error) {
      throw new Error('Encryption failed');
    }
  }

  static decrypt(encryptedData: EncryptedData): string {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedData.data, env.ENCRYPTION_KEY, {
        iv: CryptoJS.enc.Hex.parse(encryptedData.iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      throw new Error('Decryption failed');
    }
  }

  static generateHash(data: string): ValidationHash {
    const hash = CryptoJS.SHA256(data + env.ENCRYPTION_KEY).toString();
    
    return {
      hash,
      algorithm: 'SHA256',
      timestamp: new Date().toISOString(),
    };
  }

  static verifyHash(data: string, validationHash: ValidationHash): boolean {
    const computedHash = CryptoJS.SHA256(data + env.ENCRYPTION_KEY).toString();
    return computedHash === validationHash.hash;
  }

  static generateFileHash(fileBuffer: ArrayBuffer): string {
    const wordArray = CryptoJS.lib.WordArray.create(fileBuffer);
    return CryptoJS.SHA256(wordArray).toString();
  }

  static encryptVoteData(votes: any[]): string {
    const dataString = JSON.stringify(votes);
    const encrypted = this.encrypt(dataString);
    return JSON.stringify(encrypted);
  }

  static decryptVoteData(encryptedString: string): any[] {
    const encryptedData = JSON.parse(encryptedString) as EncryptedData;
    const decryptedString = this.decrypt(encryptedData);
    return JSON.parse(decryptedString);
  }

  static generateSecureToken(length: number = 32): string {
    return CryptoJS.lib.WordArray.random(length).toString();
  }

  static maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (data.length <= visibleChars * 2) {
      return '*'.repeat(data.length);
    }
    
    const start = data.substring(0, visibleChars);
    const end = data.substring(data.length - visibleChars);
    const masked = '*'.repeat(data.length - (visibleChars * 2));
    
    return `${start}${masked}${end}`;
  }
} 
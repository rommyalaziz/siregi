// src/lib/crypto.ts

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'siregi-secret-key-12345';

// Helper to convert ArrayBuffer to hex string
const buf2hex = (buffer: ArrayBuffer): string => {
  return Array.prototype.map.call(new Uint8Array(buffer), (x: number) => ('00' + x.toString(16)).slice(-2)).join('');
};

// Helper to convert hex string to ArrayBuffer
const hex2buf = (hex: string): ArrayBuffer => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
};

// Derive key using TextEncoder and SHA-256
async function getEncryptionKey(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawKey = enc.encode(password);
  
  // Hash the key using SHA-256 to ensure a 256-bit key length (32 bytes)
  const hash = await window.crypto.subtle.digest('SHA-256', rawKey);
  
  return window.crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a string using AES-GCM and VITE_ENCRYPTION_KEY.
 * Returns the format `ivHex:encryptedHex`
 */
export async function encryptText(text: string): Promise<string> {
  try {
    if (!text) return '';
    const key = await getEncryptionKey(ENCRYPTION_KEY);
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12 bytes IV is standard for AES-GCM
    const encText = new TextEncoder().encode(text);
    
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encText
    );
    
    const ivHex = buf2hex(iv.buffer);
    const encryptedHex = buf2hex(encrypted);
    return `${ivHex}:${encryptedHex}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Gagal mengenkripsi data');
  }
}

/**
 * Decrypts a string formatted as `ivHex:encryptedHex` using AES-GCM and VITE_ENCRYPTION_KEY.
 */
export async function decryptText(encryptedText: string): Promise<string> {
  try {
    if (!encryptedText) return '';
    if (!encryptedText.includes(':')) {
      return encryptedText; // If not formatted with colon, assume it's unencrypted
    }
    
    const [ivHex, encryptedHex] = encryptedText.split(':');
    const key = await getEncryptionKey(ENCRYPTION_KEY);
    const iv = new Uint8Array(hex2buf(ivHex));
    const encrypted = hex2buf(encryptedHex);
    
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '********'; // Fallback
  }
}

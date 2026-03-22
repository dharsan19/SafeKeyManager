/**
 * SafeKey Crypto Module
 *
 * Zero-knowledge AES-256-GCM encryption via Web Crypto API.
 * Key derivation: PBKDF2WithHmacSHA256 (310,000 iterations).
 *
 * Encrypted field format: Base64(iv[12] || ciphertext || gcm_tag[16])
 *
 * The vault key is derived client-side from the master password and
 * kdfSalt returned by the server. It is stored only in memory — never
 * persisted to localStorage, sessionStorage, or sent to the server.
 */
const CryptoModule = (() => {
    'use strict';

    const PBKDF2_ITERATIONS = 310_000;
    const KEY_LENGTH_BITS   = 256;
    const IV_LENGTH         = 12;  // 96-bit IV for AES-GCM (NIST recommendation)

    /**
     * Derive a non-extractable AES-256-GCM key from master password + salt.
     *
     * @param {string} masterPassword  - Plain-text master password (never leaves client)
     * @param {string} saltBase64      - Base64-encoded 16-byte salt from server
     * @returns {Promise<CryptoKey>}   - Non-extractable AES-GCM key (in-memory only)
     */
    async function deriveKey(masterPassword, saltBase64) {
        const enc      = new TextEncoder();
        const saltBytes = base64ToBytes(saltBase64);

        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(masterPassword),
            { name: 'PBKDF2' },
            false,              // not extractable
            ['deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name:       'PBKDF2',
                salt:       saltBytes,
                iterations: PBKDF2_ITERATIONS,
                hash:       'SHA-256',
            },
            keyMaterial,
            { name: 'AES-GCM', length: KEY_LENGTH_BITS },
            false,              // non-extractable — vault key never leaves memory
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypt a plaintext string with AES-256-GCM.
     * A new random 12-byte IV is generated for every call.
     *
     * @param {string}    plaintext - The value to encrypt (username, password, notes)
     * @param {CryptoKey} key       - Vault encryption key from deriveKey()
     * @returns {Promise<string>}   Base64(iv[12] || ciphertext || gcm_tag[16])
     *                              or '' if plaintext is falsy
     */
    async function encrypt(plaintext, key) {
        if (!plaintext) return '';
        const enc = new TextEncoder();
        const iv  = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

        const cipherBuffer = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            enc.encode(plaintext)
        );

        // Prepend IV to ciphertext+tag
        const combined = new Uint8Array(IV_LENGTH + cipherBuffer.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(cipherBuffer), IV_LENGTH);
        return bytesToBase64(combined);
    }

    /**
     * Decrypt a Base64(iv || ciphertext || gcm_tag) blob.
     *
     * @param {string}    encryptedBase64 - Encrypted blob from the server
     * @param {CryptoKey} key             - Vault encryption key from deriveKey()
     * @returns {Promise<string>}         Plaintext, or '' if input is falsy
     * @throws {DOMException}             If key is wrong or data is tampered
     */
    async function decrypt(encryptedBase64, key) {
        if (!encryptedBase64) return '';
        const combined        = base64ToBytes(encryptedBase64);
        const iv              = combined.slice(0, IV_LENGTH);
        const ciphertextAndTag = combined.slice(IV_LENGTH);

        const plaintextBuffer = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ciphertextAndTag
        );
        return new TextDecoder().decode(plaintextBuffer);
    }

    // ── Helpers ────────────────────────────────────────────────

    function base64ToBytes(base64) {
        const binary = atob(base64);
        const bytes  = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    function bytesToBase64(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    return Object.freeze({ deriveKey, encrypt, decrypt });
})();

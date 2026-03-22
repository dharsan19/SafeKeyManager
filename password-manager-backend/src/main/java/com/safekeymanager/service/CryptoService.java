package com.safekeymanager.service;

import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-GCM encryption service using PBKDF2WithHmacSHA256 key derivation.
 *
 * <p>Encrypted format: {@code Base64(iv[12] || ciphertext || gcm_tag[16])}
 *
 * <p><b>Zero-knowledge note:</b> In normal operation, vault entries are encrypted and
 * decrypted entirely client-side via the Web Crypto API. This service exists for:
 * <ul>
 *   <li>Unit testing the crypto primitives and format</li>
 *   <li>Server-side operations that may require crypto capabilities in the future</li>
 * </ul>
 */
@Service
public class CryptoService {

    private static final String KDF_ALGORITHM    = "PBKDF2WithHmacSHA256";
    private static final String CIPHER_ALGORITHM = "AES/GCM/NoPadding";
    private static final int    KDF_ITERATIONS   = 310_000;
    private static final int    KEY_LENGTH_BITS  = 256;
    private static final int    SALT_BYTES       = 16;
    private static final int    IV_BYTES         = 12;
    private static final int    GCM_TAG_BITS     = 128;

    private final SecureRandom secureRandom = new SecureRandom();

    /** Generate a 16-byte cryptographically secure random salt. */
    public byte[] generateSalt() {
        byte[] salt = new byte[SALT_BYTES];
        secureRandom.nextBytes(salt);
        return salt;
    }

    /** Generate a 12-byte cryptographically secure random IV for AES-GCM. */
    public byte[] generateIv() {
        byte[] iv = new byte[IV_BYTES];
        secureRandom.nextBytes(iv);
        return iv;
    }

    /**
     * Derive an AES-256 key from a master password and salt using
     * PBKDF2WithHmacSHA256 (310,000 iterations).
     *
     * @param masterPassword char array — zeroed out after use via PBEKeySpec.clearPassword()
     * @param salt           16-byte random salt
     */
    public SecretKey deriveKey(char[] masterPassword, byte[] salt) throws GeneralSecurityException {
        PBEKeySpec spec = new PBEKeySpec(masterPassword, salt, KDF_ITERATIONS, KEY_LENGTH_BITS);
        try {
            SecretKeyFactory factory = SecretKeyFactory.getInstance(KDF_ALGORITHM);
            byte[] keyBytes = factory.generateSecret(spec).getEncoded();
            return new SecretKeySpec(keyBytes, "AES");
        } finally {
            spec.clearPassword();
        }
    }

    /**
     * Encrypt plaintext with AES-256-GCM.
     *
     * @return Base64(iv[12] || ciphertext || gcm_tag[16])
     */
    public String encrypt(String plaintext, char[] masterPassword, byte[] salt)
            throws GeneralSecurityException {
        SecretKey key = deriveKey(masterPassword, salt);
        byte[] iv = generateIv();

        Cipher cipher = Cipher.getInstance(CIPHER_ALGORITHM);
        cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
        byte[] ciphertextAndTag = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

        byte[] combined = new byte[IV_BYTES + ciphertextAndTag.length];
        System.arraycopy(iv, 0, combined, 0, IV_BYTES);
        System.arraycopy(ciphertextAndTag, 0, combined, IV_BYTES, ciphertextAndTag.length);
        return Base64.getEncoder().encodeToString(combined);
    }

    /**
     * Decrypt a Base64(iv || ciphertext || gcm_tag) blob.
     *
     * @throws javax.crypto.AEADBadTagException if the key is wrong or the data was tampered with
     */
    public String decrypt(String encryptedBase64, char[] masterPassword, byte[] salt)
            throws GeneralSecurityException {
        byte[] combined = Base64.getDecoder().decode(encryptedBase64);
        if (combined.length < IV_BYTES + 16) {
            throw new IllegalArgumentException("Encrypted data too short");
        }
        byte[] iv              = new byte[IV_BYTES];
        byte[] ciphertextAndTag = new byte[combined.length - IV_BYTES];
        System.arraycopy(combined, 0, iv, 0, IV_BYTES);
        System.arraycopy(combined, IV_BYTES, ciphertextAndTag, 0, ciphertextAndTag.length);

        SecretKey key = deriveKey(masterPassword, salt);
        Cipher cipher = Cipher.getInstance(CIPHER_ALGORITHM);
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
        byte[] plaintext = cipher.doFinal(ciphertextAndTag);
        return new String(plaintext, StandardCharsets.UTF_8);
    }

    public String encodeBase64(byte[] bytes) {
        return Base64.getEncoder().encodeToString(bytes);
    }

    public byte[] decodeBase64(String base64) {
        return Base64.getDecoder().decode(base64);
    }
}

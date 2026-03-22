package com.safekeymanager.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.crypto.AEADBadTagException;
import java.security.GeneralSecurityException;
import java.util.Arrays;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("CryptoService — AES-256-GCM / PBKDF2 unit tests")
class CryptoServiceTest {

    private CryptoService cryptoService;

    @BeforeEach
    void setUp() {
        cryptoService = new CryptoService();
    }

    @Test
    @DisplayName("Encrypt → decrypt round-trip returns original plaintext")
    void encryptDecryptRoundTrip() throws GeneralSecurityException {
        String plaintext = "my-super-secret-password-123!@#";
        char[] password  = "correct-master-password-42".toCharArray();
        byte[] salt      = cryptoService.generateSalt();

        String encrypted = cryptoService.encrypt(plaintext, password, salt);
        String decrypted = cryptoService.decrypt(encrypted, password, salt);

        assertEquals(plaintext, decrypted, "Decrypted text must match original plaintext");
    }

    @Test
    @DisplayName("Wrong master password causes decryption to fail")
    void wrongPasswordFails() throws GeneralSecurityException {
        String plaintext    = "some very secret data";
        char[] correctPwd   = "correct-password-abc123".toCharArray();
        char[] wrongPwd     = "wrong-password-xyz789!".toCharArray();
        byte[] salt         = cryptoService.generateSalt();

        String encrypted = cryptoService.encrypt(plaintext, correctPwd, salt);

        assertThrows(GeneralSecurityException.class,
                () -> cryptoService.decrypt(encrypted, wrongPwd, salt),
                "Decryption with wrong password must throw GeneralSecurityException");
    }

    @Test
    @DisplayName("Each encryption of the same plaintext produces a different ciphertext (random IV)")
    void differentIvEachTime() throws GeneralSecurityException {
        String plaintext = "same plaintext every time";
        char[] password  = "stable-master-password-1".toCharArray();
        byte[] salt      = cryptoService.generateSalt();

        String enc1 = cryptoService.encrypt(plaintext, password, salt);
        String enc2 = cryptoService.encrypt(plaintext, password, salt);

        assertNotEquals(enc1, enc2,
                "Two encryptions of the same plaintext must produce different ciphertexts due to random IVs");
    }

    @Test
    @DisplayName("Tampered ciphertext fails GCM authentication")
    void tamperedCiphertextFails() throws GeneralSecurityException {
        String plaintext = "tamper-test-payload-content";
        char[] password  = "tamper-test-password-xyzABC1".toCharArray();
        byte[] salt      = cryptoService.generateSalt();

        String encrypted = cryptoService.encrypt(plaintext, password, salt);

        // Flip a byte in the ciphertext portion (after the 12-byte IV)
        byte[] combined = Base64.getDecoder().decode(encrypted);
        combined[20] ^= 0xFF;
        String tampered = Base64.getEncoder().encodeToString(combined);

        Exception ex = assertThrows(GeneralSecurityException.class,
                () -> cryptoService.decrypt(tampered, password, salt),
                "Tampered ciphertext must fail GCM tag verification");

        // Most JVM implementations throw AEADBadTagException specifically
        assertTrue(
                ex instanceof AEADBadTagException || ex.getCause() instanceof AEADBadTagException,
                "Root cause should be AEADBadTagException, got: " + ex.getClass().getName()
        );
    }

    @Test
    @DisplayName("generateSalt() produces 16-byte cryptographically random salts")
    void generateSaltProducesUniqueSalts() {
        byte[] salt1 = cryptoService.generateSalt();
        byte[] salt2 = cryptoService.generateSalt();

        assertNotNull(salt1);
        assertNotNull(salt2);
        assertEquals(16, salt1.length, "Salt must be 16 bytes");
        assertEquals(16, salt2.length, "Salt must be 16 bytes");
        assertFalse(Arrays.equals(salt1, salt2),
                "Two generated salts must be different (SecureRandom-backed)");
    }

    @Test
    @DisplayName("Wrong salt causes decryption to fail")
    void wrongSaltFails() throws GeneralSecurityException {
        String plaintext   = "salt-test-payload";
        char[] password    = "same-password-for-both".toCharArray();
        byte[] correctSalt = cryptoService.generateSalt();
        byte[] wrongSalt   = cryptoService.generateSalt();

        String encrypted = cryptoService.encrypt(plaintext, password, correctSalt);

        assertThrows(GeneralSecurityException.class,
                () -> cryptoService.decrypt(encrypted, password, wrongSalt),
                "Decryption with wrong salt must fail");
    }

    @Test
    @DisplayName("Unicode plaintext round-trips correctly")
    void unicodeRoundTrip() throws GeneralSecurityException {
        String plaintext = "密码🔐 パスワード 비밀번호 كلمة السر";
        char[] password  = "unicode-master-password-test1".toCharArray();
        byte[] salt      = cryptoService.generateSalt();

        String decrypted = cryptoService.decrypt(
                cryptoService.encrypt(plaintext, password, salt), password, salt);

        assertEquals(plaintext, decrypted, "Unicode plaintext must survive encrypt/decrypt round-trip");
    }

    @Test
    @DisplayName("Base64 encode/decode helpers are inverse operations")
    void base64Helpers() {
        byte[] original = new byte[32];
        new java.security.SecureRandom().nextBytes(original);

        String encoded  = cryptoService.encodeBase64(original);
        byte[] decoded  = cryptoService.decodeBase64(encoded);

        assertArrayEquals(original, decoded);
    }
}

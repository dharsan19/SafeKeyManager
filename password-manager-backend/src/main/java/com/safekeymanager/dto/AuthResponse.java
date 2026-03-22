package com.safekeymanager.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    private String tokenType;
    private long expiresIn;
    private String email;
    /**
     * Base64-encoded KDF salt returned to the client.
     * Client uses this + master password to derive the vault encryption key
     * via PBKDF2WithHmacSHA256 (310,000 iterations).
     * The server never uses this for decryption — zero-knowledge model.
     */
    private String kdfSalt;
}

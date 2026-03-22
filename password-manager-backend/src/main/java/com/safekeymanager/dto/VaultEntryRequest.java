package com.safekeymanager.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class VaultEntryRequest {

    @NotBlank(message = "Site name is required")
    @Size(max = 255, message = "Site name must not exceed 255 characters")
    private String siteName;

    @Size(max = 500, message = "Site URL must not exceed 500 characters")
    private String siteUrl;

    /**
     * AES-256-GCM encrypted blob: Base64(iv[12] || ciphertext || gcm_tag[16])
     * Encrypted client-side. Server stores opaque blob only.
     */
    private String usernameEncrypted;

    @NotBlank(message = "Encrypted password is required")
    private String passwordEncrypted;

    private String notesEncrypted;
}

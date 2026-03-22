package com.safekeymanager.dto;

import lombok.*;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VaultEntryResponse {
    private Long id;
    private String siteName;
    private String siteUrl;
    /** Encrypted blob — client decrypts with vault key */
    private String usernameEncrypted;
    /** Encrypted blob — client decrypts with vault key */
    private String passwordEncrypted;
    /** Encrypted blob — client decrypts with vault key */
    private String notesEncrypted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

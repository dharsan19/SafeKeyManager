package com.safekeymanager.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "vault_entries", indexes = {
    @Index(name = "idx_vault_user_id",   columnList = "user_id"),
    @Index(name = "idx_vault_site_name", columnList = "user_id, site_name")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VaultEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    @Column(name = "site_name", nullable = false, length = 255)
    private String siteName;

    @Column(name = "site_url", length = 500)
    private String siteUrl;

    /**
     * Client-side AES-256-GCM encrypted blob.
     * Format: Base64(iv[12] || ciphertext || gcm_tag[16])
     * The server never decrypts this (zero-knowledge).
     */
    @Column(name = "username_encrypted", columnDefinition = "TEXT")
    private String usernameEncrypted;

    @Column(name = "password_encrypted", nullable = false, columnDefinition = "TEXT")
    private String passwordEncrypted;

    @Column(name = "notes_encrypted", columnDefinition = "TEXT")
    private String notesEncrypted;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}

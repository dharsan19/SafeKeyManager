package com.safekeymanager.service;

import com.safekeymanager.dto.VaultEntryRequest;
import com.safekeymanager.dto.VaultEntryResponse;
import com.safekeymanager.exception.ResourceNotFoundException;
import com.safekeymanager.exception.UnauthorizedException;
import com.safekeymanager.model.User;
import com.safekeymanager.model.VaultEntry;
import com.safekeymanager.repository.UserRepository;
import com.safekeymanager.repository.VaultEntryRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class VaultService {

    private static final Logger log = LoggerFactory.getLogger(VaultService.class);

    private final VaultEntryRepository vaultEntryRepository;
    private final UserRepository       userRepository;

    @Transactional(readOnly = true)
    public List<VaultEntryResponse> getAll(String email) {
        User user = requireUser(email);
        return vaultEntryRepository.findByUserId(user.getId())
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public VaultEntryResponse create(String email, VaultEntryRequest request) {
        User user = requireUser(email);
        VaultEntry entry = VaultEntry.builder()
                .user(user)
                .siteName(request.getSiteName())
                .siteUrl(request.getSiteUrl())
                .usernameEncrypted(request.getUsernameEncrypted())
                .passwordEncrypted(request.getPasswordEncrypted())
                .notesEncrypted(request.getNotesEncrypted())
                .build();
        VaultEntry saved = vaultEntryRepository.save(entry);
        log.info("Vault entry created — user: {}, id: {}", email, saved.getId());
        return toResponse(saved);
    }

    @Transactional
    public VaultEntryResponse update(String email, Long id, VaultEntryRequest request) {
        User user = requireUser(email);
        // findByIdAndUserId prevents IDOR — user can only update their own entries
        VaultEntry entry = vaultEntryRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Vault entry not found: " + id));

        entry.setSiteName(request.getSiteName());
        entry.setSiteUrl(request.getSiteUrl());
        entry.setUsernameEncrypted(request.getUsernameEncrypted());
        entry.setPasswordEncrypted(request.getPasswordEncrypted());
        entry.setNotesEncrypted(request.getNotesEncrypted());

        VaultEntry saved = vaultEntryRepository.save(entry);
        log.info("Vault entry updated — user: {}, id: {}", email, id);
        return toResponse(saved);
    }

    @Transactional
    public void delete(String email, Long id) {
        User user = requireUser(email);
        // Verify ownership before delete
        vaultEntryRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Vault entry not found: " + id));
        vaultEntryRepository.deleteByIdAndUserId(id, user.getId());
        log.info("Vault entry deleted — user: {}, id: {}", email, id);
    }

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException("User not found: " + email));
    }

    private VaultEntryResponse toResponse(VaultEntry e) {
        return VaultEntryResponse.builder()
                .id(e.getId())
                .siteName(e.getSiteName())
                .siteUrl(e.getSiteUrl())
                .usernameEncrypted(e.getUsernameEncrypted())
                .passwordEncrypted(e.getPasswordEncrypted())
                .notesEncrypted(e.getNotesEncrypted())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }
}

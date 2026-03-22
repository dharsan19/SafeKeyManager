package com.safekeymanager.controller;

import com.safekeymanager.dto.VaultEntryRequest;
import com.safekeymanager.dto.VaultEntryResponse;
import com.safekeymanager.service.VaultService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/vault")
@RequiredArgsConstructor
public class VaultController {

    private final VaultService vaultService;

    @GetMapping
    public ResponseEntity<List<VaultEntryResponse>> getAll(
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(vaultService.getAll(user.getUsername()));
    }

    @PostMapping
    public ResponseEntity<VaultEntryResponse> create(
            @AuthenticationPrincipal UserDetails user,
            @Valid @RequestBody VaultEntryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(vaultService.create(user.getUsername(), request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<VaultEntryResponse> update(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable Long id,
            @Valid @RequestBody VaultEntryRequest request) {
        return ResponseEntity.ok(vaultService.update(user.getUsername(), id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable Long id) {
        vaultService.delete(user.getUsername(), id);
        return ResponseEntity.noContent().build();
    }
}

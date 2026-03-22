package com.safekeymanager.service;

import com.safekeymanager.dto.*;
import com.safekeymanager.exception.UnauthorizedException;
import com.safekeymanager.model.User;
import com.safekeymanager.repository.UserRepository;
import com.safekeymanager.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository  userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final CryptoService   cryptoService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new UnauthorizedException("Email already registered");
        }

        // Generate a random KDF salt — returned to client for vault-key derivation
        byte[] saltBytes = cryptoService.generateSalt();
        String kdfSalt   = cryptoService.encodeBase64(saltBytes);

        // BCrypt hash — plaintext password is NEVER stored
        String passwordHash = passwordEncoder.encode(request.getMasterPassword());

        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordHash)
                .kdfSalt(kdfSalt)
                .build();

        userRepository.save(user);
        log.info("Registered new user: {}", request.getEmail());

        return buildAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                // Return same error for unknown email or wrong password (prevents user enumeration)
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getMasterPassword(), user.getPasswordHash())) {
            log.warn("Failed login attempt for: {}", request.getEmail());
            throw new UnauthorizedException("Invalid email or password");
        }

        log.info("User logged in: {}", request.getEmail());
        return buildAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse refresh(RefreshTokenRequest request) {
        if (!jwtTokenProvider.validateRefreshToken(request.getRefreshToken())) {
            throw new UnauthorizedException("Invalid or expired refresh token");
        }

        String email = jwtTokenProvider.getEmailFromToken(request.getRefreshToken());
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException("User not found"));

        log.info("Token refreshed for: {}", email);
        return buildAuthResponse(user);
    }

    private AuthResponse buildAuthResponse(User user) {
        return AuthResponse.builder()
                .accessToken(jwtTokenProvider.generateAccessToken(user.getEmail()))
                .refreshToken(jwtTokenProvider.generateRefreshToken(user.getEmail()))
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getAccessTokenExpiryMs())
                .email(user.getEmail())
                .kdfSalt(user.getKdfSalt())
                .build();
    }
}

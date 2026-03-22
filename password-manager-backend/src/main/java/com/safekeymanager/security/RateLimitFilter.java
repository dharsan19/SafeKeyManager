package com.safekeymanager.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.safekeymanager.dto.ErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sliding-window rate limiter for /api/auth/** endpoints.
 * Uses an in-memory ConcurrentHashMap keyed by client IP.
 * Max {@code maxRequests} requests per {@code windowMs} milliseconds.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    private final int maxRequests;
    private final long windowMs;
    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, Deque<Long>> requestLog = new ConcurrentHashMap<>();

    public RateLimitFilter(
            @Value("${app.rate-limit.auth-max-requests}") int maxRequests,
            @Value("${app.rate-limit.auth-window-seconds}") int windowSeconds,
            ObjectMapper objectMapper) {
        this.maxRequests  = maxRequests;
        this.windowMs     = windowSeconds * 1000L;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/auth/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String clientIp = resolveClientIp(request);
        long now = System.currentTimeMillis();

        // Atomically update the request log for this IP
        requestLog.compute(clientIp, (ip, deque) -> {
            if (deque == null) deque = new ArrayDeque<>();
            long cutoff = now - windowMs;
            while (!deque.isEmpty() && deque.peekFirst() < cutoff) {
                deque.pollFirst();
            }
            deque.addLast(now);
            return deque;
        });

        Deque<Long> timestamps = requestLog.get(clientIp);
        if (timestamps != null && timestamps.size() > maxRequests) {
            log.warn("Rate limit exceeded for IP: {}", clientIp);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            ErrorResponse body = ErrorResponse.builder()
                    .status(429)
                    .error("Too Many Requests")
                    .message("Too many requests — please try again later.")
                    .timestamp(LocalDateTime.now())
                    .build();
            objectMapper.writeValue(response.getWriter(), body);
            return;
        }

        chain.doFilter(request, response);
    }

    private String resolveClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) return xRealIp.trim();
        return request.getRemoteAddr();
    }
}

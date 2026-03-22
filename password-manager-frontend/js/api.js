/**
 * SafeKey API Module
 *
 * All HTTP communication with the Spring Boot backend.
 * JWT tokens stored in sessionStorage only (cleared on tab close).
 */
const ApiModule = (() => {
    'use strict';

    const BASE_URL     = 'http://localhost:8080';
    const ACCESS_KEY   = 'skm_access';
    const REFRESH_KEY  = 'skm_refresh';

    // ── Token management ────────────────────────────────────────

    function getAccessToken()  { return sessionStorage.getItem(ACCESS_KEY); }
    function getRefreshToken() { return sessionStorage.getItem(REFRESH_KEY); }

    function storeTokens(access, refresh) {
        sessionStorage.setItem(ACCESS_KEY,  access);
        sessionStorage.setItem(REFRESH_KEY, refresh);
    }

    function clearTokens() {
        sessionStorage.removeItem(ACCESS_KEY);
        sessionStorage.removeItem(REFRESH_KEY);
    }

    function isAuthenticated() { return !!getAccessToken(); }

    // ── HTTP engine ─────────────────────────────────────────────

    /**
     * Make an authenticated API request.
     * Automatically retries once after token refresh on 401.
     */
    async function request(method, path, body = null, _retried = false) {
        const headers = { 'Content-Type': 'application/json' };
        const token   = getAccessToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const options = { method, headers };
        if (body !== null) options.body = JSON.stringify(body);

        let response;
        try {
            response = await fetch(`${BASE_URL}${path}`, options);
        } catch (networkErr) {
            throw new Error('Cannot reach server — is the backend running?');
        }

        // Auto-refresh on 401
        if (response.status === 401 && !_retried) {
            const refreshed = await tryRefresh();
            if (refreshed) return request(method, path, body, true);
            clearTokens();
            throw new Error('SESSION_EXPIRED');
        }

        if (response.status === 204) return null;

        const data = await response.json().catch(() => ({ message: response.statusText }));

        if (!response.ok) {
            throw new Error(data.message || `Request failed (${response.status})`);
        }

        return data;
    }

    /** Attempt to refresh the access token using the refresh token. */
    async function tryRefresh() {
        const refreshToken = getRefreshToken();
        if (!refreshToken) return false;
        try {
            const resp = await fetch(`${BASE_URL}/api/auth/refresh`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ refreshToken }),
            });
            if (!resp.ok) return false;
            const data = await resp.json();
            if (data.accessToken) {
                storeTokens(data.accessToken, data.refreshToken || refreshToken);
                return true;
            }
        } catch {}
        return false;
    }

    // ── Auth endpoints ───────────────────────────────────────────

    async function register(email, masterPassword) {
        // NOTE: masterPassword is sent here solely for BCrypt hashing on the server.
        // The server does NOT use it for encryption — vault key derivation is client-only.
        return request('POST', '/api/auth/register', { email, masterPassword });
    }

    /**
     * Login: returns AuthResponse including kdfSalt for client-side key derivation.
     * Tokens are stored in sessionStorage automatically.
     */
    async function login(email, masterPassword) {
        const data = await request('POST', '/api/auth/login', { email, masterPassword });
        storeTokens(data.accessToken, data.refreshToken);
        return data;  // caller needs kdfSalt + email
    }

    function logout() {
        clearTokens();
    }

    // ── Vault endpoints ──────────────────────────────────────────

    /** Returns array of VaultEntryResponse (encrypted blobs). */
    function getVault()            { return request('GET',    '/api/vault'); }

    /** entry = { siteName, siteUrl, usernameEncrypted, passwordEncrypted, notesEncrypted } */
    function createEntry(entry)    { return request('POST',   '/api/vault', entry); }

    function updateEntry(id, entry){ return request('PUT',    `/api/vault/${id}`, entry); }

    function deleteEntry(id)       { return request('DELETE', `/api/vault/${id}`); }

    return Object.freeze({
        isAuthenticated,
        register,
        login,
        logout,
        getVault,
        createEntry,
        updateEntry,
        deleteEntry,
    });
})();

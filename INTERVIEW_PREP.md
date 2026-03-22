# SafeKey Manager — Interview Preparation Guide

---

## 1. Elevator Pitch (30 seconds)

> "SafeKey Manager is a full-stack, zero-knowledge password manager I built from scratch. The key design principle is that the server **never sees your plaintext passwords** — all encryption and decryption happens in the browser using the Web Crypto API. Even if the database is fully compromised, the attacker only gets encrypted blobs they cannot read. On the backend, I used Spring Boot 3 with Spring Security, JWT authentication, AES-256-GCM encryption, and PostgreSQL. The frontend is a vanilla JavaScript SPA with no frameworks."

---

## 2. Project Overview

| Property        | Detail                                              |
|-----------------|-----------------------------------------------------|
| Type            | Full-stack web application                          |
| Backend         | Java 17, Spring Boot 3.2, Spring Security 6         |
| Frontend        | Vanilla HTML / CSS / JavaScript (no framework)      |
| Database        | PostgreSQL (prod), H2 in-memory (dev)               |
| Auth            | BCrypt + JWT (access 15min / refresh 7 days)        |
| Encryption      | AES-256-GCM + PBKDF2WithHmacSHA256 (310,000 iter)  |
| Key principle   | Zero-knowledge — server cannot decrypt vault data   |
| Migration       | Flyway                                              |
| Containerized   | Docker + Docker Compose                             |

---

## 3. Architecture — How to Explain It

### The Big Picture
```
Browser                          Spring Boot Backend           PostgreSQL
──────────────────────────────   ───────────────────────────   ────────────────────────
1. User types master password
2. POST /login (password only    3. BCrypt verify password     users: email, bcrypt_hash,
   for auth check)         ───►  4. Return JWT + kdfSalt  ◄──  kdf_salt

5. DERIVE vault key locally:
   PBKDF2(masterPwd, kdfSalt)
   → AES-256 key (in memory)

6. Encrypt each field with       7. Store encrypted blobs ───► vault_entries:
   AES-GCM + random IV     ───►     (no decryption done)       password_encrypted,
                                                               username_encrypted...
8. GET /vault ◄─────────────────── Return encrypted blobs ◄──
9. Decrypt locally with key
   (never hits the network)
```

### Key Point to Emphasise
The vault encryption **key never leaves the browser**. The server only receives and stores encrypted ciphertext. The `kdfSalt` the server returns is not secret — it's like a public seed that, combined with the master password the user knows, produces the key. Without the master password, the salt alone is useless.

---

## 4. Core Technical Concepts — Deep Dive

### 4.1 Zero-Knowledge Architecture
- **What it means:** The service provider (server) has zero knowledge of the user's vault contents.
- **How it's achieved:** Encryption key is derived client-side and never transmitted.
- **Why it matters:** A database breach, a malicious admin, or a server-side attack cannot expose user passwords.
- **Real-world examples:** Bitwarden, 1Password, ProtonMail use this model.

### 4.2 AES-256-GCM (Authenticated Encryption)
- **AES** = Advanced Encryption Standard, symmetric block cipher
- **256** = Key size in bits (very strong — same used by governments)
- **GCM** = Galois/Counter Mode — provides both **confidentiality** (no one can read it) AND **integrity** (any tampering is detected)
- **Why GCM over CBC?** CBC only provides confidentiality. GCM also produces an authentication tag (16 bytes) that detects if the ciphertext was modified. If you tamper with even one byte, decryption throws `AEADBadTagException`.
- **IV (Initialization Vector):** 12 random bytes generated fresh for every single encryption. Reusing an IV with the same key in GCM is catastrophic — it breaks both confidentiality and integrity. Our code generates a new IV per field per save.

**Encrypted format:**
```
Base64( iv[12 bytes] || ciphertext || gcm_auth_tag[16 bytes] )
```

### 4.3 PBKDF2 (Password-Based Key Derivation Function)
- Master password is a human-chosen string — too short and low-entropy to use as a key directly.
- PBKDF2 "stretches" the password into a strong 256-bit cryptographic key.
- **Parameters used:**
  - Algorithm: HMAC-SHA256
  - Iterations: **310,000** (OWASP 2023 recommendation)
  - Salt: 16 random bytes (prevents rainbow table attacks)
  - Output: 256-bit AES key
- **Why 310,000 iterations?** Each login attempt requires 310,000 hash computations. For a user logging in, this takes ~200ms — imperceptible. For an attacker brute-forcing offline, this multiplies their cost by 310,000x.

### 4.4 BCrypt (Master Password Auth)
- The master password is **also** BCrypt-hashed and stored for server-side authentication.
- BCrypt is separate from PBKDF2 — they serve different purposes:
  - **BCrypt** → proves the user knows the password (authentication)
  - **PBKDF2** → derives the key for encryption (authorization to decrypt)
- BCrypt cost factor = 12 → ~250ms per hash on modern hardware.
- **Why not use PBKDF2 for auth too?** You could, but BCrypt is the battle-tested standard for password storage. PBKDF2 is optimised for key derivation. Using purpose-built tools is good practice.

### 4.5 JWT (JSON Web Token)
- **Access token:** 15-minute expiry, signed with HMAC-SHA512.
- **Refresh token:** 7-day expiry, same signing key but carries a `type: "refresh"` claim.
- **Stateless:** Server doesn't store tokens — it just verifies the signature.
- **Storage:** `sessionStorage` only — automatically cleared when the tab is closed. Never `localStorage` (persists across sessions, XSS risk).
- **Type claim:** Prevents using a refresh token as an access token and vice versa.

### 4.6 Rate Limiting
- Applied only to `/api/auth/**` to prevent brute-force attacks.
- **Sliding window algorithm:** Tracks timestamps of last N requests per IP in a `ConcurrentHashMap<IP, Deque<Long>>`.
- Limit: 5 requests per 60 seconds per IP.
- Returns HTTP 429 Too Many Requests.
- No external library — implemented from scratch using Java concurrency primitives.

---

## 5. Security Features — Checklist to Walk Through

| Feature | Implementation | Why It Matters |
|---------|---------------|----------------|
| AES-256-GCM | Web Crypto API (client) + CryptoService (backend tests) | Authenticated encryption — tamper-proof |
| PBKDF2 (310k iters) | Web Crypto PBKDF2 / Java PBKDF2WithHmacSHA256 | Slow down brute-force attacks |
| BCrypt (cost 12) | Spring Security BCryptPasswordEncoder | Secure password storage |
| JWT auth | JJWT 0.12.3, HMAC-SHA512 | Stateless, scalable auth |
| Rate limiting | Sliding window filter | Prevent brute-force on login |
| XSS prevention | `escapeHtml()` in vault.js on all rendered content | Prevent script injection from vault entries |
| SQL injection | Spring Data JPA (parameterized queries only) | No raw SQL concatenation |
| IDOR prevention | `findByIdAndUserId()` — always verify ownership | User A cannot read/modify User B's entries |
| CSRF protection | Stateless JWT — no session cookies → no CSRF surface | Not applicable in stateless design |
| CSP headers | Spring Security `contentSecurityPolicy()` | Restricts what scripts can run |
| HSTS headers | `httpStrictTransportSecurity()` | Force HTTPS in production |
| No sensitive logging | `logback.xml` suppresses SQL/hibernate param logging | Passwords never appear in logs |
| sessionStorage JWT | Not localStorage | Clears on tab close |
| Auto-logout | 5-minute inactivity timer | Prevents shoulder surfing |
| Clipboard clear | 30-second auto-clear after copy | Reduce clipboard exposure |
| Non-extractable key | `extractable: false` in Web Crypto | Vault key cannot be exfiltrated via JS |
| SecureRandom | All random values use `SecureRandom` / `crypto.getRandomValues()` | Cryptographically secure randomness |

---

## 6. Database Design

### `users` table
```sql
id            BIGSERIAL PRIMARY KEY
email         VARCHAR(255) UNIQUE NOT NULL
password_hash VARCHAR(255) NOT NULL       -- BCrypt hash
kdf_salt      VARCHAR(255) NOT NULL       -- Base64(random 16 bytes) for PBKDF2
created_at    TIMESTAMP NOT NULL
```

### `vault_entries` table
```sql
id                 BIGSERIAL PRIMARY KEY
user_id            BIGINT FK → users(id) ON DELETE CASCADE
site_name          VARCHAR(255) NOT NULL   -- plaintext (used for search/display)
site_url           VARCHAR(500)            -- plaintext
username_encrypted TEXT                    -- Base64(iv||cipher||tag)
password_encrypted TEXT NOT NULL           -- Base64(iv||cipher||tag)
notes_encrypted    TEXT                    -- Base64(iv||cipher||tag)
created_at         TIMESTAMP NOT NULL
updated_at         TIMESTAMP NOT NULL
```

**Design decision:** `site_name` is stored in plaintext. This is a trade-off between searchability and privacy. In a production zero-knowledge system, you'd encrypt this too and use client-side search. For this project, the site name is considered acceptable metadata (it doesn't reveal credentials).

---

## 7. API Design

```
POST   /api/auth/register      → 201 Created  { accessToken, refreshToken, kdfSalt, email }
POST   /api/auth/login         → 200 OK       { accessToken, refreshToken, kdfSalt, email }
POST   /api/auth/refresh       → 200 OK       { accessToken, refreshToken }

GET    /api/vault              → 200 OK       [ { id, siteName, siteUrl, *Encrypted fields } ]
POST   /api/vault              → 201 Created  { vault entry }
PUT    /api/vault/{id}         → 200 OK       { updated vault entry }
DELETE /api/vault/{id}         → 204 No Content
```

**RESTful principles:**
- Resources are nouns (`/vault`, not `/getVault`)
- HTTP verbs express the action
- Appropriate status codes (201 for creation, 204 for deletion, 401 for auth failures)
- Consistent JSON error responses via `@RestControllerAdvice`

---

## 8. Frontend Architecture

### Why Vanilla JS (No Framework)?
- **Demonstrates fundamentals** — understanding DOM manipulation, event handling, async/await without abstractions.
- **Performance** — zero framework overhead, fast initial load.
- **Crypto APIs are browser-native** — no npm packages needed for the security layer.
- **Interviewers appreciate this** — shows you understand the platform, not just a framework.

### SPA Routing Without a Router
- All views exist in the DOM simultaneously, toggled with `display: none / flex`.
- No page reloads — single HTML file, state managed in JS modules.

### Module Pattern
Each JS file is an IIFE (Immediately Invoked Function Expression) that returns a frozen object:
```javascript
const CryptoModule = (() => {
    // private
    async function deriveKey(...) { ... }
    // public API
    return Object.freeze({ deriveKey, encrypt, decrypt });
})();
```
- Encapsulates private state
- `Object.freeze()` prevents external mutation
- No bundler/build step required

---

## 9. Key Design Decisions & Trade-offs

### Decision 1: Client-side vs Server-side Encryption
| | Client-side (chosen) | Server-side |
|--|--|--|
| Server knows plaintext? | ❌ No | ✅ Yes |
| Protects against DB breach | ✅ Yes | ❌ No |
| Protects against malicious admin | ✅ Yes | ❌ No |
| Server-side search | ❌ No | ✅ Yes |
| Complexity | Higher | Lower |

**Chosen:** Client-side. The privacy guarantee is worth the complexity trade-off.

### Decision 2: JWT Stateless vs Session-based Auth
| | JWT Stateless (chosen) | Sessions |
|--|--|--|
| Server state | None | DB/Redis session store |
| Scalability | Easy horizontal scaling | Requires sticky sessions or shared store |
| Token revocation | Hard (need blacklist) | Easy (delete session) |
| CSRF risk | Low (no cookies) | High (requires CSRF tokens) |

**Chosen:** JWT. Simpler for this architecture, no session infrastructure needed.

### Decision 3: AES-GCM vs AES-CBC
| | AES-GCM (chosen) | AES-CBC |
|--|--|--|
| Confidentiality | ✅ Yes | ✅ Yes |
| Integrity / Tamper detection | ✅ Yes (auth tag) | ❌ No |
| Padding oracle attacks | ✅ Immune | ❌ Vulnerable |
| Performance | ✅ Parallelizable | ❌ Sequential |

**Chosen:** AES-GCM. Strictly superior for this use case.

### Decision 4: Per-field Encryption vs Full-entry Encryption
**Per-field** (chosen): Each of username, password, notes gets its own random IV and encrypted independently.
- **Pro:** Server can update one field without re-encrypting others (future optimization).
- **Pro:** Field-level granularity.
- **Con:** Slightly more data transmitted.

---

## 10. What Happens Step-by-Step (Login Flow)

1. User types email + master password in browser.
2. Browser POSTs `{email, masterPassword}` to `/api/auth/login`.
3. Server looks up user by email, runs `BCrypt.matches(input, storedHash)`.
4. If valid: server returns `{accessToken, refreshToken, kdfSalt, email}`.
5. **Browser derives vault key (zero-knowledge step):**
   ```javascript
   const keyMaterial = await crypto.subtle.importKey('raw', encode(masterPassword), 'PBKDF2', ...)
   const vaultKey = await crypto.subtle.deriveKey(
     { name: 'PBKDF2', salt: decode(kdfSalt), iterations: 310000, hash: 'SHA-256' },
     keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
   )
   ```
6. Vault key stored as a `CryptoKey` object in a JS closure — `extractable: false` means even JS can't read its bytes.
7. Browser GETs `/api/vault` with `Authorization: Bearer <accessToken>`.
8. Server returns array of encrypted blobs (it cannot read them).
9. Browser decrypts each field with vault key → displays in UI.

---

## 11. Anticipated Interview Questions & Answers

### Q: What is zero-knowledge encryption?
> "Zero-knowledge means the server provides a service without being able to see the data it handles. In a password manager context, the server stores your encrypted vault but cannot decrypt it because it never has the encryption key. The key is derived in the browser from your master password, which is never transmitted in a form usable for decryption."

### Q: Why use PBKDF2 and not just hash the password directly?
> "A raw SHA-256 hash of a password is fast — an attacker with a GPU can compute billions per second. PBKDF2 is deliberately slow by iterating the hash function 310,000 times. This turns a GPU brute-force attack from feasible to computationally expensive. The salt ensures that two users with the same password produce different keys, defeating precomputed rainbow tables."

### Q: What's the difference between BCrypt and PBKDF2 here?
> "Both are slow hash functions, but they serve different roles. BCrypt is used server-side to verify the user's identity — it hashes the master password for authentication. PBKDF2 is used client-side to derive the AES encryption key from the same master password. It's the principle of using purpose-built tools — BCrypt for auth, PBKDF2 for key derivation."

### Q: Why store the kdfSalt in the database if it's needed for encryption?
> "The salt is not secret. It's a per-user random value that prevents two users with identical passwords from having identical vault keys. Without the master password, the salt alone is useless. Think of it like a lock combination that only works together with the key — the lock part (salt) can be public, but without the key (password), you can't open it."

### Q: What happens if a user forgets their master password?
> "They permanently lose access to their vault — there is no password reset. This is the fundamental trade-off of zero-knowledge: since the server cannot decrypt the vault, there's no recovery path. This is by design — if the server could recover your vault, it would mean the server has some access to your encryption key, which breaks the zero-knowledge guarantee. This is the same model used by Bitwarden and ProtonMail."

### Q: How do you prevent IDOR (Insecure Direct Object Reference) attacks?
> "Every vault query includes both the entry ID and the user's ID. The repository method `findByIdAndUserId(id, userId)` ensures a user can only access entries that belong to them. Even if a user manipulates the entry ID in a request, the server returns 404 unless that entry belongs to their account."

### Q: Why is JWT stored in sessionStorage and not localStorage?
> "localStorage persists across browser sessions and is accessible to any JavaScript on the page. If there's an XSS vulnerability, an attacker can steal localStorage tokens. sessionStorage is scoped to a single tab and is cleared when the tab closes, significantly reducing the exposure window. The trade-off is users must log in again after closing the tab — acceptable for a security-focused app."

### Q: How does the rate limiter work?
> "It's a sliding window algorithm. For each client IP, I maintain a deque of request timestamps in a ConcurrentHashMap. On each auth request, I remove timestamps older than 60 seconds (outside the window) and add the current timestamp. If the deque size exceeds 5, I return 429. ConcurrentHashMap's `compute()` method makes this atomic — no race conditions."

### Q: Why did you choose Spring Boot?
> "Spring Boot gives a production-ready foundation — embedded server, auto-configuration, dependency injection, and strong security via Spring Security. For a security-critical application, I wanted a mature, battle-tested framework with good security primitives rather than building auth/security infrastructure from scratch."

### Q: What would you improve in a production version?
> "Several things:
> 1. **Server-side token blacklist** — currently there's no way to invalidate a JWT (e.g., on logout from another device).
> 2. **TOTP/2FA** — second factor for login.
> 3. **Vault sharing** — allow sharing entries between users (complex crypto challenge).
> 4. **Encrypted site_name** — currently plaintext; in a true zero-knowledge system, all fields including site name would be encrypted with client-side search using deterministic encryption or bloom filters.
> 5. **HSM or KMS** — in production, the JWT signing key would be stored in a Hardware Security Module, not in environment variables.
> 6. **Audit logging** — immutable log of all vault access events."

### Q: How does the Web Crypto API's `extractable: false` improve security?
> "When you create a CryptoKey with `extractable: false`, the raw key bytes cannot be exported from the browser's crypto subsystem even via JavaScript. Even if there's an XSS attack that runs arbitrary JS in the page, `crypto.subtle.exportKey()` will throw an error. The key can be used for operations (encrypt/decrypt) but its bytes are never accessible to application code."

### Q: Walk me through what happens when a new vault entry is saved.
> "The user fills in site name, username, password, and notes in the modal. When they click Save, `vault.js` calls `CryptoModule.encrypt()` for each credential field independently. Each call generates a fresh 12-byte IV using `crypto.getRandomValues()`, runs AES-GCM encryption with the in-memory vault key, and returns `Base64(iv || ciphertext || tag)`. The three encrypted blobs plus the plaintext site name are POSTed to `/api/vault`. The Spring Boot controller validates the request, passes it to `VaultService`, which saves it to PostgreSQL. The server never decrypts anything."

### Q: How do you handle token refresh?
> "The API module intercepts HTTP 401 responses and automatically attempts a token refresh using the refresh token from sessionStorage. If the refresh succeeds, it retries the original request transparently. If the refresh token is also expired, it clears both tokens and throws a `SESSION_EXPIRED` error, which the app module catches to redirect the user to the login screen."

### Q: What testing have you done?
> "I wrote 8 unit tests for `CryptoService` covering the critical crypto paths: encrypt/decrypt round-trip, wrong password failure, different IV on each encryption, GCM tamper detection, wrong salt failure, unicode handling, and salt uniqueness. The crypto layer is the most critical code in the application, so it's the priority for testing. In a fuller test suite I'd add integration tests for the REST controllers using `@SpringBootTest` with MockMvc, and end-to-end tests for the encryption flow."

---

## 12. Technologies — One-Line Explanations

| Technology | What to say |
|------------|-------------|
| **Spring Boot 3** | "Opinionated Spring framework — embedded Tomcat, auto-config, reduces boilerplate" |
| **Spring Security 6** | "Authentication/authorization framework — handles JWT filter chain, CORS, CSP headers" |
| **Spring Data JPA** | "Repository abstraction over Hibernate — parameterized queries, no raw SQL" |
| **Flyway** | "Database migration tool — versioned SQL scripts (V1, V2) applied in order on startup" |
| **JJWT 0.12** | "Java JWT library — builds and parses signed JWTs using HMAC-SHA512" |
| **BCryptPasswordEncoder** | "Spring's BCrypt implementation — adaptive hash with configurable cost factor" |
| **H2** | "In-memory SQL database for dev — no setup required, reset on restart" |
| **Docker Compose** | "Multi-container orchestration — spins up Postgres + backend + nginx frontend together" |
| **Web Crypto API** | "Browser-native cryptography — SubtleCrypto for PBKDF2 and AES-GCM, no libraries needed" |
| **Vanilla JS IIFE modules** | "Module encapsulation without bundler — IIFE returns frozen public API, private state inside closure" |

---

## 13. Project Structure to Walk Through

```
password-manager-backend/src/main/java/com/safekeymanager/
├── service/
│   ├── CryptoService.java       ← Start here — the core crypto logic
│   ├── AuthService.java         ← Registration + login + refresh token
│   └── VaultService.java        ← CRUD with ownership enforcement
├── security/
│   ├── JwtTokenProvider.java    ← Token generation + validation
│   ├── JwtAuthenticationFilter  ← Extracts JWT from every request
│   └── RateLimitFilter.java     ← Sliding window rate limiter
├── config/
│   └── SecurityConfig.java      ← The security chain configuration
└── controller/
    ├── AuthController.java
    └── VaultController.java

password-manager-frontend/js/
├── crypto.js     ← Zero-knowledge key derivation + AES-GCM
├── api.js        ← HTTP client, token storage/refresh
├── vault.js      ← Encrypt on save, decrypt on load, XSS-safe render
├── generator.js  ← Password generator (crypto.getRandomValues)
└── app.js        ← SPA routing, inactivity timer, event wiring
```

**Suggested walk-through order:**
1. `CryptoService.java` — show the encrypt/decrypt core
2. `CryptoServiceTest.java` — show the 8 tests
3. `crypto.js` — show the Web Crypto equivalent (zero-knowledge part)
4. `SecurityConfig.java` — show the security chain
5. `VaultService.java` — show IDOR prevention with `findByIdAndUserId`
6. `vault.js` — show client-side encrypt/decrypt + XSS escaping

---

## 14. Challenges You Can Mention

1. **IV management** — Each encrypted field needs a unique random IV. Embedding the IV alongside the ciphertext (`Base64(iv || ciphertext || tag)`) keeps each blob self-contained without a separate database column.

2. **Lombok + Java 25** — The system Maven was running on Java 25; Lombok's annotation processor requires explicit version pinning (`1.18.34`) and `JAVA_HOME` set to Java 17 for compilation.

3. **Zero-knowledge with server-side validation** — The challenge is that the server must validate request structure (e.g., `siteName` is required, `passwordEncrypted` is not blank) without being able to validate the content of encrypted fields. The solution: validate only unencrypted metadata fields.

4. **Token refresh race condition** — If two requests return 401 simultaneously, both would attempt a refresh. The solution in `api.js` uses a `_retried` flag to prevent infinite loops, though a production system would use a mutex/promise to dedup concurrent refreshes.

5. **CORS for development** — When opening `index.html` directly as a `file://` URL, the browser sends `Origin: null` which doesn't match any CORS allowlist. The solution is to always serve the frontend through a local HTTP server.

---

## 15. Numbers to Remember

| Parameter | Value | Why |
|-----------|-------|-----|
| PBKDF2 iterations | 310,000 | OWASP 2023 recommendation for PBKDF2-HMAC-SHA256 |
| KDF salt length | 16 bytes (128 bits) | Standard salt size |
| AES-GCM IV length | 12 bytes (96 bits) | NIST recommended for GCM |
| GCM auth tag | 16 bytes (128 bits) | Maximum tag length for GCM |
| AES key size | 256 bits | Maximum AES key size |
| BCrypt cost | 12 | ~250ms per hash |
| Access token expiry | 15 minutes | Short-lived to limit exposure |
| Refresh token expiry | 7 days | Balance of convenience and security |
| Rate limit | 5 requests / 60 seconds | Per IP on auth endpoints |
| Auto-logout | 5 minutes | Inactivity timeout |
| Clipboard clear | 30 seconds | After copy-to-clipboard |

# SafeKey Manager

A full-stack, zero-knowledge password manager. Your vault is encrypted **client-side** using your master password — the server never sees plaintext credentials and cannot decrypt your vault, even if the database is compromised.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           SPA — Vanilla HTML / CSS / JavaScript          │   │
│  │                                                          │   │
│  │  ┌──────────┐   ┌──────────────┐   ┌─────────────────┐  │   │
│  │  │ Auth UI  │   │  Vault UI    │   │ Pwd Generator   │  │   │
│  │  └────┬─────┘   └──────┬───────┘   └────────┬────────┘  │   │
│  │       │                │                     │           │   │
│  │  ┌────▼────────────────▼─────────────────────▼────────┐  │   │
│  │  │               crypto.js (Web Crypto API)           │  │   │
│  │  │  PBKDF2(masterPwd, kdfSalt, 310000) → AES-256 key  │  │   │
│  │  │  encrypt(plaintext, key)  → Base64(iv‖cipher‖tag)  │  │   │
│  │  │  decrypt(Base64(…), key)  → plaintext              │  │   │
│  │  └────────────────────────┬───────────────────────────┘  │   │
│  └───────────────────────────┼──────────────────────────────┘   │
│                              │ HTTPS                             │
│                 Sends: encrypted blobs + JWT                     │
│                 NEVER sends: vault key or plaintext              │
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────┐
│                    Spring Boot 3 Backend                         │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │AuthController│  │VaultController│  │ JWT Filter           │   │
│  │ POST /register│  │ GET  /vault  │  │ Rate Limiter (auth)  │   │
│  │ POST /login  │  │ POST /vault  │  └──────────────────────┘   │
│  │ POST /refresh│  │ PUT  /vault/{id}│                           │
│  └──────┬───────┘  │ DELETE /vault/{id}│                         │
│         │          └──────┬───────────┘                          │
│  ┌──────▼────┐   ┌────────▼────────┐  ┌──────────────────────┐  │
│  │AuthService│   │  VaultService   │  │    CryptoService     │  │
│  │BCrypt hash│   │  Store/retrieve │  │  (tests + utilities) │  │
│  │kdfSalt gen│   │  encrypted blobs│  └──────────────────────┘  │
│  └──────┬────┘   └────────┬────────┘                            │
└─────────┼─────────────────┼────────────────────────────────────┘
          │                 │ Spring Data JPA / Hibernate
┌─────────▼─────────────────▼────────────────────────────────────┐
│                       PostgreSQL                                │
│                                                                 │
│  users:         id | email | password_hash (BCrypt) | kdf_salt │
│  vault_entries: id | user_id | site_name | site_url |          │
│                 username_encrypted | password_encrypted |       │
│                 notes_encrypted | created_at | updated_at       │
│                                                                 │
│  ⚠ Server cannot decrypt vault entries — only the client can   │
└────────────────────────────────────────────────────────────────┘
```

---

## Zero-Knowledge Encryption Model

### How it works

1. **Registration**
   - Client sends `email + masterPassword` to the server.
   - Server BCrypt-hashes the password (cost 12) and generates a random 16-byte `kdfSalt`.
   - Server stores `{email, passwordHash, kdfSalt}` — **never the plaintext password**.
   - Server returns `kdfSalt` (Base64) + JWT tokens to the client.
   - Client derives the **vault key** locally:
     `vaultKey = PBKDF2(masterPassword, kdfSalt, 310000 iterations, SHA-256) → AES-256`
   - The vault key lives only in memory (JS variable). It is **never persisted**.

2. **Login**
   - Client sends `email + masterPassword`.
   - Server verifies BCrypt hash. If valid, returns JWT + `kdfSalt`.
   - Client re-derives the vault key from `masterPassword + kdfSalt`.

3. **Saving a vault entry**
   - Client encrypts each field (username, password, notes) with AES-256-GCM:
     `encryptedBlob = Base64(randomIV[12] ‖ AES-GCM(plaintext) ‖ gcmTag[16])`
   - Client POSTs `{siteName, siteUrl, usernameEncrypted, passwordEncrypted, notesEncrypted}`.
   - Server stores opaque blobs — **it cannot decrypt them**.

4. **Loading vault entries**
   - Server returns encrypted blobs.
   - Client decrypts each field locally using the in-memory vault key.

### Security guarantees

| Threat                         | Mitigation                                                    |
|--------------------------------|---------------------------------------------------------------|
| DB breach                      | Attacker gets only ciphertext — vault key never reaches server|
| Network interception           | HTTPS in production; JWT for auth                             |
| Weak master password           | PBKDF2 with 310,000 iterations adds significant KDF cost      |
| IV reuse                       | New 12-byte `crypto.getRandomValues()` IV per field per save  |
| GCM tag tampering              | AES-GCM authentication tag — any tampering throws             |
| Credential stuffing            | Rate limiting: 5 requests / 60s per IP on `/api/auth/**`     |
| XSS                            | All vault content HTML-escaped on render (`esc()` function)   |
| CSRF                           | Stateless JWT — no cookies, no CSRF surface                   |
| Session hijacking              | JWT in `sessionStorage` (cleared on tab close)                |
| Inactivity exposure            | Auto-logout after 5 min + 60s countdown warning               |
| Clipboard exposure             | Clipboard auto-cleared after 30 seconds                       |

---

## Quick Start (Dev)

### Prerequisites
- Java 17+
- Maven 3.8+
- A modern browser (Chrome/Firefox/Safari/Edge)

### 1. Start the backend (H2 in-memory database)

```bash
cd password-manager-backend

# If your system Maven runs on JDK 21+, set JAVA_HOME to Java 17 explicitly:
export JAVA_HOME=$(/usr/libexec/java_home -v 17)   # macOS
# export JAVA_HOME=/usr/lib/jvm/java-17-openjdk    # Linux

mvn spring-boot:run -Dspring-boot.run.profiles=dev
# Backend → http://localhost:8080
# H2 Console → http://localhost:8080/h2-console (JDBC URL: jdbc:h2:mem:safekeymanager)
```

### 2. Open the frontend

```bash
# Option A: Open directly in browser
open password-manager-frontend/index.html

# Option B: Serve with Python (avoids CORS issues)
cd password-manager-frontend
python3 -m http.server 3000
# → http://localhost:3000
```

### 3. Run unit tests

```bash
cd password-manager-backend
JAVA_HOME=$(/usr/libexec/java_home -v 17) mvn test
# All 8 CryptoServiceTest tests should pass
```

---

## Docker Compose (Production-like)

```bash
# 1. Copy and configure environment
cp .env.example .env
#    Edit .env — set strong POSTGRES_PASSWORD and JWT_SECRET

# 2. Start all services
docker-compose up -d

# 3. View logs
docker-compose logs -f backend

# 4. Stop
docker-compose down

# 5. Destroy data volumes (destructive!)
docker-compose down -v
```

Services:
- **postgres** → `localhost:5432`
- **backend**  → `http://localhost:8080`
- **frontend** → `http://localhost:3000`

---

## API Reference

### Auth

| Method | Path                | Auth | Description                                        |
|--------|---------------------|------|----------------------------------------------------|
| POST   | `/api/auth/register`| No   | Register (email + masterPassword)                  |
| POST   | `/api/auth/login`   | No   | Login — returns JWT + kdfSalt                      |
| POST   | `/api/auth/refresh` | No   | Refresh access token using refresh token           |

**Login / Register response:**
```json
{
  "accessToken":  "eyJ...",
  "refreshToken": "eyJ...",
  "tokenType":    "Bearer",
  "expiresIn":    900000,
  "email":        "user@example.com",
  "kdfSalt":      "base64-encoded-16-byte-salt"
}
```
> `kdfSalt` is used by the client to derive the vault encryption key. The server never uses it for decryption.

### Vault

All vault endpoints require `Authorization: Bearer <accessToken>`.

| Method | Path              | Description                        |
|--------|-------------------|------------------------------------|
| GET    | `/api/vault`      | List all encrypted entries         |
| POST   | `/api/vault`      | Create new entry                   |
| PUT    | `/api/vault/{id}` | Update entry (ownership enforced)  |
| DELETE | `/api/vault/{id}` | Delete entry (ownership enforced)  |

**Vault entry (request/response):**
```json
{
  "siteName":           "GitHub",
  "siteUrl":            "https://github.com",
  "usernameEncrypted":  "Base64(iv||ciphertext||tag)",
  "passwordEncrypted":  "Base64(iv||ciphertext||tag)",
  "notesEncrypted":     "Base64(iv||ciphertext||tag)"
}
```

---

## Security Checklist

- [x] **AES-256-GCM** authenticated encryption (client-side)
- [x] **PBKDF2WithHmacSHA256** — 310,000 iterations for key derivation
- [x] **BCrypt** (cost 12) for master password hashing
- [x] **JWT** — 15-min access token / 7-day refresh token
- [x] **Rate limiting** — 5 req/60s per IP on `/api/auth/**`
- [x] **SQL injection prevention** — JPA parameterized queries only
- [x] **XSS prevention** — all user content HTML-escaped on render
- [x] **CSRF protection** — stateless JWT, no cookies
- [x] **Content-Security-Policy** headers
- [x] **IDOR prevention** — `findByIdAndUserId` ownership check
- [x] **No plaintext passwords** in logs (logback config)
- [x] **JWT in sessionStorage** — cleared on tab close
- [x] **Auto-logout** — 5-minute inactivity timer
- [x] **Clipboard auto-clear** — 30 seconds after copy
- [x] **SecureRandom** everywhere (never `Math.random()`)
- [x] **Non-extractable CryptoKey** — vault key cannot be exported from Web Crypto

---

## Project Structure

```
SafeKeyManager/
├── password-manager-backend/
│   ├── pom.xml
│   ├── Dockerfile
│   └── src/
│       ├── main/java/com/safekeymanager/
│       │   ├── SafeKeyManagerApplication.java
│       │   ├── config/
│       │   │   └── SecurityConfig.java
│       │   ├── controller/
│       │   │   ├── AuthController.java
│       │   │   └── VaultController.java
│       │   ├── dto/           (request/response DTOs)
│       │   ├── exception/     (GlobalExceptionHandler + custom exceptions)
│       │   ├── model/         (User, VaultEntry JPA entities)
│       │   ├── repository/    (UserRepository, VaultEntryRepository)
│       │   ├── security/      (JwtTokenProvider, JwtAuthenticationFilter,
│       │   │                   RateLimitFilter, UserDetailsServiceImpl)
│       │   └── service/       (AuthService, VaultService, CryptoService)
│       ├── main/resources/
│       │   ├── application.yml        (dev + prod profiles)
│       │   ├── logback.xml
│       │   └── db/migration/          (Flyway V1, V2)
│       └── test/java/com/safekeymanager/service/
│           └── CryptoServiceTest.java  (8 test cases)
│
├── password-manager-frontend/
│   ├── index.html             (SPA — all views inline)
│   ├── css/styles.css         (dark premium theme, responsive)
│   └── js/
│       ├── crypto.js          (Web Crypto API — PBKDF2 + AES-GCM)
│       ├── api.js             (REST client, JWT management)
│       ├── generator.js       (cryptographically secure pwd generator)
│       ├── vault.js           (vault rendering, encrypt/decrypt)
│       └── app.js             (SPA routing, events, inactivity timer)
│
├── docker-compose.yml
├── nginx.conf
├── .env.example
├── README.md
└── SafeKeyManager.postman_collection.json
```

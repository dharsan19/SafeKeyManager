# SafeKey Manager — Setup & Run Guide

Complete step-by-step instructions to run SafeKey Manager on **macOS** and **Windows**.

---

## Table of Contents

- [Prerequisites Overview](#prerequisites-overview)
- [macOS Setup](#macos-setup)
- [Windows Setup](#windows-setup)
- [Running the Application](#running-the-application)
- [Running with Docker (Both Platforms)](#running-with-docker-both-platforms)
- [Verifying Everything Works](#verifying-everything-works)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites Overview

You need the following tools installed before running the project:

| Tool | Version | Purpose |
|------|---------|---------|
| Java (JDK) | 17 | Run the Spring Boot backend |
| Apache Maven | 3.8+ | Build the backend |
| Python | 3.x | Serve the frontend locally |
| Git | Any | Clone the repository |
| Docker + Docker Compose | Latest | Optional — run everything in containers |

---

## macOS Setup

### Step 1 — Install Homebrew (Package Manager)

Open **Terminal** and run:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Verify installation:
```bash
brew --version
# Homebrew 4.x.x
```

> Skip this step if Homebrew is already installed.

---

### Step 2 — Install Java 17

```bash
brew install openjdk@17
```

After installation, add Java 17 to your shell profile:

```bash
# For zsh (default on macOS Ventura and later)
echo 'export PATH="/usr/local/opt/openjdk@17/bin:$PATH"' >> ~/.zshrc
echo 'export JAVA_HOME="/usr/local/opt/openjdk@17"' >> ~/.zshrc
source ~/.zshrc

# For bash
echo 'export PATH="/usr/local/opt/openjdk@17/bin:$PATH"' >> ~/.bash_profile
echo 'export JAVA_HOME="/usr/local/opt/openjdk@17"' >> ~/.bash_profile
source ~/.bash_profile
```

> **Apple Silicon (M1/M2/M3) Macs** — the path may be different:
> ```bash
> echo 'export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"' >> ~/.zshrc
> echo 'export JAVA_HOME="/opt/homebrew/opt/openjdk@17"' >> ~/.zshrc
> source ~/.zshrc
> ```

Verify:
```bash
java -version
# openjdk version "17.x.x"
```

---

### Step 3 — Install Maven

```bash
brew install maven
```

Verify:
```bash
mvn -version
# Apache Maven 3.x.x
# Java version: 17.x.x   ← must show 17, not 21/25
```

> **If Maven shows a Java version other than 17**, set JAVA_HOME explicitly before running Maven commands (see [Troubleshooting](#troubleshooting)).

---

### Step 4 — Install Python 3

macOS usually has Python 3 pre-installed. Check:

```bash
python3 --version
# Python 3.x.x
```

If not installed:
```bash
brew install python
```

---

### Step 5 — Install Git

```bash
brew install git
```

Verify:
```bash
git --version
```

---

### Step 6 — Install Docker (Optional — for Docker setup)

Download **Docker Desktop for Mac** from the official site and install it.

After installation:
```bash
docker --version
docker compose version
```

---

## Windows Setup

All commands below are for **PowerShell** (recommended) or **Command Prompt**.
To open PowerShell: press `Win + X` → select **Windows PowerShell** or **Terminal**.

---

### Step 1 — Install Chocolatey (Package Manager)

Open PowerShell **as Administrator** (right-click → Run as administrator) and run:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

Close and reopen PowerShell. Verify:
```powershell
choco --version
```

> Alternatively, you can install each tool manually — download links are provided at each step.

---

### Step 2 — Install Java 17

**Option A — Using Chocolatey (recommended):**
```powershell
choco install temurin17 -y
```

**Option B — Manual install:**
1. Go to: https://adoptium.net/temurin/releases/?version=17
2. Download the **Windows x64 MSI** installer for Java 17
3. Run the installer — check the box **"Set JAVA_HOME variable"** during installation

Verify (open a **new** PowerShell window after install):
```powershell
java -version
# openjdk version "17.x.x"
```

**Set JAVA_HOME manually if not set:**
```powershell
# Find your Java 17 install path first:
where java
# e.g. C:\Program Files\Eclipse Adoptium\jdk-17.0.x.x-hotspot\bin\java.exe

# Set JAVA_HOME (replace the path with your actual path):
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Eclipse Adoptium\jdk-17.0.x.x-hotspot", "Machine")

# Add to PATH:
$oldPath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
[System.Environment]::SetEnvironmentVariable("Path", "$oldPath;C:\Program Files\Eclipse Adoptium\jdk-17.0.x.x-hotspot\bin", "Machine")
```

Close and reopen PowerShell after setting environment variables.

---

### Step 3 — Install Maven

**Option A — Using Chocolatey:**
```powershell
choco install maven -y
```

**Option B — Manual install:**
1. Download from: https://maven.apache.org/download.cgi
   Get the **Binary zip archive** (e.g. `apache-maven-3.9.x-bin.zip`)
2. Extract to `C:\Program Files\Apache\maven`
3. Add to PATH:

```powershell
$oldPath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
[System.Environment]::SetEnvironmentVariable("Path", "$oldPath;C:\Program Files\Apache\maven\bin", "Machine")
```

Close and reopen PowerShell. Verify:
```powershell
mvn -version
# Apache Maven 3.x.x
# Java version: 17.x.x
```

---

### Step 4 — Install Python 3

**Option A — Using Chocolatey:**
```powershell
choco install python -y
```

**Option B — Microsoft Store:**
Open Microsoft Store, search for **Python 3.11** (or 3.12), click Install.

**Option C — Manual:**
Download from https://www.python.org/downloads/
During install: ✅ check **"Add Python to PATH"**

Verify (new PowerShell window):
```powershell
python --version
# Python 3.x.x
```

> On Windows, use `python` (not `python3`).

---

### Step 5 — Install Git

**Option A — Using Chocolatey:**
```powershell
choco install git -y
```

**Option B — Manual:**
Download from https://git-scm.com/download/win and run the installer.

Verify:
```powershell
git --version
```

---

### Step 6 — Install Docker Desktop (Optional — for Docker setup)

Download **Docker Desktop for Windows** from https://www.docker.com/products/docker-desktop/

Requirements: Windows 10/11 with WSL 2 enabled.

Enable WSL 2 first if not already enabled:
```powershell
wsl --install
```

After Docker Desktop is installed and running:
```powershell
docker --version
docker compose version
```

---

## Running the Application

These steps are the same on both macOS and Windows unless noted.

---

### Step 1 — Clone the Repository

**macOS (Terminal):**
```bash
git clone https://github.com/yourusername/SafeKeyManager.git
cd SafeKeyManager
```

**Windows (PowerShell):**
```powershell
git clone https://github.com/yourusername/SafeKeyManager.git
cd SafeKeyManager
```

> Replace the URL with your actual repository URL, or use the local path if already downloaded.

---

### Step 2 — Start the Backend

Navigate to the backend directory and run with the dev profile.

**macOS:**
```bash
cd password-manager-backend

# If your Maven/Java version is not 17, set it explicitly:
export JAVA_HOME=$(/usr/libexec/java_home -v 17)

mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

**Windows (PowerShell):**
```powershell
cd password-manager-backend

# If JAVA_HOME is not already Java 17, set it for this session:
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.x.x-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

mvn spring-boot:run "-Dspring-boot.run.profiles=dev"
```

**What to look for — success output:**
```
  .   ____          _            __ _ _
 /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
...
INFO  --- SafeKeyManagerApplication : Started SafeKeyManagerApplication in 4.x seconds
```

Backend is now running at: **http://localhost:8080**

> Leave this terminal window open. The backend must keep running while you use the app.

---

### Step 3 — Serve the Frontend

Open a **new** terminal window (keep the backend running in the first one).

**macOS:**
```bash
cd /path/to/SafeKeyManager/password-manager-frontend
python3 -m http.server 3000
```

**Windows (PowerShell):**
```powershell
cd C:\path\to\SafeKeyManager\password-manager-frontend
python -m http.server 3000
```

**What to look for — success output:**
```
Serving HTTP on 0.0.0.0 port 3000 (http://0.0.0.0:3000/) ...
```

---

### Step 4 — Open the App

Open your browser and go to:

```
http://localhost:3000
```

> ⚠️ **Do not open `index.html` directly** by double-clicking it. Opening as a `file://` URL causes CORS errors because the browser blocks requests from `file://` to `http://localhost:8080`. Always use the Python server URL.

---

### Step 5 — Use the App

1. Click **Register** → enter an email and a master password (minimum 12 characters)
2. Click **Sign In** with your credentials
3. Click **+ Add Entry** to save your first password
4. Use the **Generator** panel (top-right) to generate strong passwords

---

## Running with Docker (Both Platforms)

Docker provides the simplest way to run everything — no Java or Maven setup needed.

### Prerequisites
- Docker Desktop installed and running (see Step 6 in setup sections above)

### Steps

**1. Copy the environment file:**

macOS:
```bash
cd /path/to/SafeKeyManager
cp .env.example .env
```

Windows:
```powershell
cd C:\path\to\SafeKeyManager
Copy-Item .env.example .env
```

**2. (Optional) Edit `.env` with secure values:**

Open `.env` in any text editor and change the default values:
```
POSTGRES_PASSWORD=YourStrongPasswordHere
JWT_SECRET=YourRandomJwtSecretAtLeast64CharactersLong
```

**3. Start all services:**

```bash
docker compose up -d
```

This starts three containers:
- `safekeymanager-db` — PostgreSQL database
- `safekeymanager-backend` — Spring Boot API
- `safekeymanager-frontend` — Nginx serving the frontend

**4. Wait for startup (~60 seconds) then open:**
```
http://localhost:3000
```

**5. Useful Docker commands:**

```bash
# View backend logs
docker compose logs -f backend

# Check if all containers are running
docker compose ps

# Stop everything
docker compose down

# Stop and delete database data
docker compose down -v
```

---

## Verifying Everything Works

### Check the backend is responding:

**macOS:**
```bash
curl -s http://localhost:8080/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","masterPassword":"wrongpassword"}' \
  | python3 -m json.tool
```

**Windows (PowerShell):**
```powershell
$body = '{"email":"test@test.com","masterPassword":"wrongpassword"}'
Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

Expected response:
```json
{
  "status": 401,
  "error": "Unauthorized",
  "message": "Invalid email or password"
}
```

If you get this response, the backend is working correctly.

---

### Check H2 Database Console (Dev mode only):

Open in browser: **http://localhost:8080/h2-console**

| Field | Value |
|-------|-------|
| JDBC URL | `jdbc:h2:mem:safekeymanager` |
| Username | `sa` |
| Password | *(leave empty)* |

Click **Connect** to browse the database tables.

---

## Troubleshooting

### "Cannot reach server — is the backend running?"

**Cause:** The frontend cannot connect to the backend.

**Fix 1 — Are you using the Python server URL?**
- ✅ Use: `http://localhost:3000`
- ❌ Avoid: Opening `index.html` directly (file:// URL)

**Fix 2 — Is the backend actually running?**

macOS:
```bash
lsof -i :8080 | grep LISTEN
```
Windows:
```powershell
netstat -ano | findstr :8080
```
If nothing shows up, the backend is not running. Restart it.

**Fix 3 — Check backend logs** for startup errors in the terminal where you ran `mvn spring-boot:run`.

---

### "mvn: command not found" (macOS) or "'mvn' is not recognized" (Windows)

Maven is not in your PATH.

macOS:
```bash
export PATH="$PATH:/usr/local/opt/maven/bin"
# then retry
```

Windows: Close and reopen PowerShell after installing Maven. If still not found:
```powershell
# Verify Maven is installed and find its location
choco list maven
# or check C:\ProgramData\chocolatey\bin\mvn.cmd
```

---

### "Java version mismatch" — Maven running on wrong Java version

**Check which Java Maven is using:**

macOS / Windows:
```bash
mvn -version
# Look for "Java version: XX"
```

If it shows Java 21+ instead of Java 17:

**macOS — set JAVA_HOME for this terminal session:**
```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH="$JAVA_HOME/bin:$PATH"
mvn -version  # should now show Java 17
```

**Windows — set JAVA_HOME for this PowerShell session:**
```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.x.x-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
mvn -version  # should now show Java 17
```

---

### Port 8080 already in use

**macOS:**
```bash
# Find the process using 8080
lsof -i :8080
# Kill it (replace PID with actual number)
kill -9 <PID>
```

**Windows:**
```powershell
# Find process using port 8080
netstat -ano | findstr :8080
# Note the PID in the last column, then kill it
taskkill /PID <PID> /F
```

---

### Port 3000 already in use (Python server)

Use a different port:

```bash
python3 -m http.server 8081   # macOS
python -m http.server 8081    # Windows
```

Then update the CORS allowed origins in `application.yml` to include `http://localhost:8081` and restart the backend.

---

### Flyway migration error on startup

```
FlywayException: Found non-empty schema(s) with no schema history table
```

The H2 in-memory database starts fresh on every run — this error should not occur. If it does:

```bash
# Add this to application.yml under the dev profile:
spring:
  flyway:
    baseline-on-migrate: true
```

---

### Windows: `mvn spring-boot:run` fails with encoding error

Add UTF-8 flag:
```powershell
mvn spring-boot:run "-Dspring-boot.run.profiles=dev" "-Dfile.encoding=UTF-8"
```

---

### Docker: backend container keeps restarting

View the backend logs:
```bash
docker compose logs backend
```

Common causes:
- PostgreSQL not ready yet → wait longer or check `docker compose ps` for `healthy` status
- Wrong credentials in `.env` → fix `POSTGRES_USER` and `POSTGRES_PASSWORD` to match
- `JWT_SECRET` too short → must be at least 64 characters

---

### Browser shows blank page or JS errors

Open browser developer tools (`F12` → Console tab). Common fixes:

| Error in Console | Fix |
|---|---|
| `CORS error` | Make sure backend is running and you're on `http://localhost:3000` |
| `Failed to fetch` | Backend not running on port 8080 |
| `crypto.subtle is undefined` | Use `http://localhost:3000` (Web Crypto requires secure context or localhost) |

---

## Quick Reference

### macOS — Start Everything

```bash
# Terminal 1 — Backend
cd ~/SafeKeyManager/password-manager-backend
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# Terminal 2 — Frontend
cd ~/SafeKeyManager/password-manager-frontend
python3 -m http.server 3000

# Browser
open http://localhost:3000
```

### Windows — Start Everything

```powershell
# PowerShell 1 — Backend
cd C:\SafeKeyManager\password-manager-backend
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.x.x-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
mvn spring-boot:run "-Dspring-boot.run.profiles=dev"

# PowerShell 2 — Frontend
cd C:\SafeKeyManager\password-manager-frontend
python -m http.server 3000

# Browser — open manually
# http://localhost:3000
```

### Either Platform — Docker (Simplest)

```bash
cd SafeKeyManager
cp .env.example .env
docker compose up -d
# open http://localhost:3000
```

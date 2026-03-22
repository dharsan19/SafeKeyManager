/**
 * SafeKey App Module
 *
 * Main application orchestrator:
 * - SPA view routing
 * - Authentication flow (login, register, logout)
 * - Inactivity timer with 5-minute timeout and 60-second warning
 * - Toast notification system
 * - Modal and generator panel management
 */
const AppModule = (() => {
    'use strict';

    // ── Constants ────────────────────────────────────────────────
    const INACTIVITY_MS = 5 * 60 * 1000;   // 5 minutes
    const WARNING_MS    = 60 * 1000;        // show warning 60s before logout
    const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];

    // ── Inactivity timer handles ─────────────────────────────────
    let _inactivityTimer = null;
    let _warningTimer    = null;
    let _countdownTimer  = null;

    // ── View routing ─────────────────────────────────────────────

    function showView(id) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    // ── Toast system ─────────────────────────────────────────────

    /**
     * Show a transient toast notification.
     * @param {string} message
     * @param {'info'|'success'|'error'|'warning'} type
     * @param {number} durationMs
     */
    function showToast(message, type = 'info', durationMs = 3500) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        // Trigger CSS transition
        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('toast-show'));
        });

        setTimeout(() => {
            toast.classList.remove('toast-show');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, durationMs);
    }

    // ── Inactivity tracking ──────────────────────────────────────

    function resetInactivity() {
        clearTimeout(_inactivityTimer);
        clearTimeout(_warningTimer);
        clearInterval(_countdownTimer);
        document.getElementById('inactivity-warning').classList.add('hidden');

        _warningTimer = setTimeout(showInactivityWarning, INACTIVITY_MS - WARNING_MS);
        _inactivityTimer = setTimeout(() => {
            performLogout();
            showToast('Signed out due to inactivity.', 'warning', 6000);
        }, INACTIVITY_MS);
    }

    function showInactivityWarning() {
        const warning   = document.getElementById('inactivity-warning');
        const countdown = document.getElementById('inactivity-countdown');
        let remaining   = Math.ceil(WARNING_MS / 1000);

        countdown.textContent = remaining;
        warning.classList.remove('hidden');

        _countdownTimer = setInterval(() => {
            remaining--;
            countdown.textContent = remaining;
            if (remaining <= 0) {
                clearInterval(_countdownTimer);
                warning.classList.add('hidden');
            }
        }, 1000);
    }

    function startInactivityTracking() {
        ACTIVITY_EVENTS.forEach(ev =>
            document.addEventListener(ev, resetInactivity, { passive: true })
        );
        resetInactivity();
    }

    function stopInactivityTracking() {
        ACTIVITY_EVENTS.forEach(ev =>
            document.removeEventListener(ev, resetInactivity)
        );
        clearTimeout(_inactivityTimer);
        clearTimeout(_warningTimer);
        clearInterval(_countdownTimer);
        document.getElementById('inactivity-warning').classList.add('hidden');
    }

    // ── Auth actions ─────────────────────────────────────────────

    async function performLogin(email, masterPassword) {
        // 1. Authenticate with server → receive JWT + kdfSalt
        const data = await ApiModule.login(email, masterPassword);

        // 2. Derive vault key client-side from masterPassword + kdfSalt
        //    (zero-knowledge: key never sent to server)
        const vaultKey = await CryptoModule.deriveKey(masterPassword, data.kdfSalt);
        VaultModule.setVaultKey(vaultKey);

        showView('vault-view');
        startInactivityTracking();

        // 3. Load vault entries (encrypted blobs → decrypt locally)
        await VaultModule.loadAndRender();
    }

    function performLogout() {
        ApiModule.logout();
        VaultModule.clearVaultKey();
        stopInactivityTracking();
        showView('auth-view');
        document.getElementById('login-form').reset();
    }

    function handleSessionExpiry() {
        performLogout();
        showToast('Session expired — please sign in again.', 'warning', 5000);
    }

    // ── Modal management ─────────────────────────────────────────

    function openAddModal() {
        document.getElementById('entry-id').value = '';
        document.getElementById('entry-form').reset();
        document.getElementById('modal-title').textContent = 'Add Entry';
        _resetStrength('entry-strength-bar', 'entry-strength-label');
        document.getElementById('entry-modal').classList.remove('hidden');
        document.getElementById('entry-site-name').focus();
    }

    function openEditModal(entry) {
        document.getElementById('entry-id').value        = entry.id;
        document.getElementById('entry-site-name').value = entry.siteName || '';
        document.getElementById('entry-site-url').value  = entry.siteUrl  || '';
        document.getElementById('entry-username').value  = entry.username  || '';
        document.getElementById('entry-password').value  = entry.password  || '';
        document.getElementById('entry-notes').value     = entry.notes     || '';
        document.getElementById('modal-title').textContent = 'Edit Entry';

        // Update strength meter for existing password
        _updateStrength(entry.password || '', 'entry-strength-bar', 'entry-strength-label');
        document.getElementById('entry-modal').classList.remove('hidden');
        document.getElementById('entry-site-name').focus();
    }

    function closeModal() {
        document.getElementById('entry-modal').classList.add('hidden');
    }

    function _updateStrength(password, barId, labelId) {
        const s   = GeneratorModule.strength(password);
        const bar = document.getElementById(barId);
        bar.style.width      = s.pct + '%';
        bar.style.background = s.color;
        const lbl = document.getElementById(labelId);
        lbl.textContent  = s.label;
        lbl.style.color  = s.color || '';
    }

    function _resetStrength(barId, labelId) {
        const bar = document.getElementById(barId);
        bar.style.width      = '0';
        bar.style.background = '';
        document.getElementById(labelId).textContent = '';
    }

    function _setLoading(btn, loading) {
        const text    = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.btn-spinner');
        btn.disabled = loading;
        if (text)    text.classList.toggle('hidden', loading);
        if (spinner) spinner.classList.toggle('hidden', !loading);
    }

    // ── Event wiring ─────────────────────────────────────────────

    function init() {
        // ─ Auth tabs ─
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.auth-tab').forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
                document.getElementById(`${tab.dataset.tab}-form`).classList.add('active');
            });
        });

        // ─ Password visibility toggles ─
        document.querySelectorAll('.toggle-vis').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const input = e.currentTarget.previousElementSibling;
                const show  = input.type === 'password';
                input.type  = show ? 'text' : 'password';
            });
        });

        // ─ Register strength meter ─
        document.getElementById('register-password').addEventListener('input', (e) => {
            _updateStrength(e.target.value, 'register-strength-bar', 'register-strength-label');
        });

        // ─ Login form ─
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email    = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const errEl    = document.getElementById('login-error');
            const btn      = e.target.querySelector('[type=submit]');
            errEl.textContent = '';
            _setLoading(btn, true);
            try {
                await performLogin(email, password);
            } catch (err) {
                if (err.message === 'SESSION_EXPIRED') return;
                errEl.textContent = err.message || 'Login failed';
            } finally {
                _setLoading(btn, false);
            }
        });

        // ─ Register form ─
        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email    = document.getElementById('register-email').value.trim();
            const password = document.getElementById('register-password').value;
            const confirm  = document.getElementById('register-confirm').value;
            const errEl    = document.getElementById('register-error');
            const btn      = e.target.querySelector('[type=submit]');
            errEl.textContent = '';

            if (password !== confirm) {
                errEl.textContent = 'Passwords do not match';
                return;
            }
            if (password.length < 12) {
                errEl.textContent = 'Master password must be at least 12 characters';
                return;
            }

            _setLoading(btn, true);
            try {
                await ApiModule.register(email, password);
                showToast('Account created! Please sign in.', 'success', 4000);
                document.querySelector('[data-tab="login"]').click();
                document.getElementById('login-email').value = email;
                document.getElementById('login-password').focus();
            } catch (err) {
                errEl.textContent = err.message || 'Registration failed';
            } finally {
                _setLoading(btn, false);
            }
        });

        // ─ Logout ─
        document.getElementById('logout-btn').addEventListener('click', performLogout);

        // ─ Stay active ─
        document.getElementById('stay-active-btn').addEventListener('click', () => {
            clearInterval(_countdownTimer);
            document.getElementById('inactivity-warning').classList.add('hidden');
            resetInactivity();
        });

        // ─ Search ─
        document.getElementById('search-input').addEventListener('input', (e) => {
            VaultModule.filter(e.target.value);
        });

        // ─ Add entry ─
        document.getElementById('add-entry-btn').addEventListener('click', openAddModal);
        document.getElementById('empty-add-btn').addEventListener('click', openAddModal);

        // ─ Modal close ─
        document.getElementById('modal-close-btn').addEventListener('click', closeModal);
        document.getElementById('entry-cancel-btn').addEventListener('click', closeModal);
        document.querySelector('.modal-backdrop').addEventListener('click', closeModal);

        // Close modal on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.getElementById('generator-panel').classList.add('hidden');
            }
        });

        // ─ Entry form submit ─
        document.getElementById('entry-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id      = document.getElementById('entry-id').value;
            const editId  = id ? parseInt(id, 10) : null;
            const formData = {
                siteName: document.getElementById('entry-site-name').value.trim(),
                siteUrl:  document.getElementById('entry-site-url').value.trim(),
                username: document.getElementById('entry-username').value,
                password: document.getElementById('entry-password').value,
                notes:    document.getElementById('entry-notes').value.trim(),
            };
            const btn = document.getElementById('entry-save-btn');
            _setLoading(btn, true);
            try {
                await VaultModule.saveEntry(formData, editId);
                closeModal();
                showToast(editId ? 'Entry updated' : 'Entry saved', 'success');
            } catch (err) {
                if (err.message === 'SESSION_EXPIRED') { handleSessionExpiry(); return; }
                showToast(err.message || 'Save failed', 'error');
            } finally {
                _setLoading(btn, false);
            }
        });

        // ─ Entry password strength ─
        document.getElementById('entry-password').addEventListener('input', (e) => {
            _updateStrength(e.target.value, 'entry-strength-bar', 'entry-strength-label');
        });

        // ─ Generate for entry ─
        document.getElementById('generate-for-entry').addEventListener('click', () => {
            const pwd = GeneratorModule.generate({ length: 20, uppercase: true, numbers: true, symbols: true });
            const input = document.getElementById('entry-password');
            input.value = pwd;
            input.type  = 'text';
            input.dispatchEvent(new Event('input'));
            setTimeout(() => { input.type = 'password'; }, 3000);
        });

        // ─ Generator panel ─
        const genPanel = document.getElementById('generator-panel');

        document.getElementById('generator-btn').addEventListener('click', () => {
            genPanel.classList.remove('hidden');
            _generateAndDisplay();
        });

        document.getElementById('generator-close').addEventListener('click', () => {
            genPanel.classList.add('hidden');
        });

        document.getElementById('gen-length').addEventListener('input', (e) => {
            document.getElementById('length-display').textContent = e.target.value;
            _generateAndDisplay();
        });

        ['gen-uppercase', 'gen-numbers', 'gen-symbols'].forEach(id => {
            document.getElementById(id).addEventListener('change', _generateAndDisplay);
        });

        document.getElementById('generate-btn').addEventListener('click', _generateAndDisplay);

        document.getElementById('copy-generated').addEventListener('click', async () => {
            const pwd = document.getElementById('generated-password').textContent;
            if (!pwd || pwd === 'Click Generate') return;
            try {
                await navigator.clipboard.writeText(pwd);
                showToast('Password copied — clears in 30s', 'success');
                setTimeout(() => navigator.clipboard.writeText('').catch(() => {}), 30_000);
            } catch {
                showToast('Copy failed', 'error');
            }
        });
    }

    function _generateAndDisplay() {
        const pwd = GeneratorModule.generate({
            length:    parseInt(document.getElementById('gen-length').value, 10),
            uppercase: document.getElementById('gen-uppercase').checked,
            numbers:   document.getElementById('gen-numbers').checked,
            symbols:   document.getElementById('gen-symbols').checked,
        });
        document.getElementById('generated-password').textContent = pwd;
    }

    // ── Bootstrap ─────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', init);

    return Object.freeze({
        showToast,
        openEditModal,
        handleSessionExpiry,
    });
})();

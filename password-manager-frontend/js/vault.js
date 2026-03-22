/**
 * SafeKey Vault Module
 *
 * Handles vault rendering, client-side decryption for display,
 * client-side encryption on save, and CRUD operations.
 *
 * Security: all HTML rendering escapes user content to prevent XSS.
 */
const VaultModule = (() => {
    'use strict';

    let _vaultKey = null;
    let _entries  = [];   // Decrypted entries in memory

    // ── Key management ──────────────────────────────────────────

    function setVaultKey(key) { _vaultKey = key; }

    function clearVaultKey() {
        _vaultKey = null;
        _entries  = [];
        document.getElementById('vault-grid').innerHTML = '';
    }

    // ── XSS prevention ──────────────────────────────────────────

    function esc(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g,  '&amp;')
            .replace(/</g,  '&lt;')
            .replace(/>/g,  '&gt;')
            .replace(/"/g,  '&quot;')
            .replace(/'/g,  '&#x27;');
    }

    // ── Load & render ────────────────────────────────────────────

    async function loadAndRender() {
        const grid    = document.getElementById('vault-grid');
        const empty   = document.getElementById('vault-empty');
        const loading = document.getElementById('vault-loading');

        loading.classList.remove('hidden');
        grid.classList.add('hidden');
        empty.classList.add('hidden');

        try {
            const rawEntries = await ApiModule.getVault();

            _entries = await Promise.all(rawEntries.map(async (e) => ({
                id:        e.id,
                siteName:  e.siteName,
                siteUrl:   e.siteUrl,
                username:  await CryptoModule.decrypt(e.usernameEncrypted,  _vaultKey),
                password:  await CryptoModule.decrypt(e.passwordEncrypted,  _vaultKey),
                notes:     await CryptoModule.decrypt(e.notesEncrypted,     _vaultKey),
                createdAt: e.createdAt,
                updatedAt: e.updatedAt,
            })));

            loading.classList.add('hidden');
            renderGrid(_entries);
        } catch (err) {
            loading.classList.add('hidden');
            if (err.message !== 'SESSION_EXPIRED') {
                AppModule.showToast('Failed to load vault: ' + err.message, 'error');
            }
            throw err;
        }
    }

    // ── Render ───────────────────────────────────────────────────

    const AVATAR_COLORS = [
        { bg: 'rgba(67,97,238,0.12)',  border: 'rgba(67,97,238,0.25)',  text: '#6b8aff' },
        { bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.25)', text: '#a78bfa' },
        { bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.25)', text: '#38bdf8' },
        { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', text: '#34d399' },
        { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', text: '#fbbf24' },
        { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.25)',  text: '#f87171' },
    ];

    function renderGrid(toShow) {
        const grid  = document.getElementById('vault-grid');
        const empty = document.getElementById('vault-empty');

        if (toShow.length === 0) {
            grid.classList.add('hidden');
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        grid.classList.remove('hidden');
        grid.innerHTML = toShow.map(renderCard).join('');
        attachCardListeners();
    }

    function renderCard(entry) {
        const color    = AVATAR_COLORS[entry.siteName.charCodeAt(0) % AVATAR_COLORS.length];
        const initials = entry.siteName.trim().substring(0, 2).toUpperCase() || '??';

        return `
<article class="vault-card" data-id="${entry.id}" aria-label="${esc(entry.siteName)}">
    <div class="card-header">
        <div class="card-avatar" style="background:${color.bg};border-color:${color.border};color:${color.text}">
            ${esc(initials)}
        </div>
        <div class="card-title-group">
            <div class="card-title">${esc(entry.siteName)}</div>
            ${entry.siteUrl
                ? `<a class="card-url" href="${esc(entry.siteUrl)}" target="_blank" rel="noopener noreferrer"
                      title="${esc(entry.siteUrl)}">${esc(entry.siteUrl)}</a>`
                : ''}
        </div>
    </div>

    <div class="card-fields">
        <div class="card-field">
            <span class="field-label">Username</span>
            <div class="field-row">
                <span class="field-value ${entry.username ? '' : 'field-empty'}">
                    ${entry.username ? esc(entry.username) : '—'}
                </span>
                ${entry.username
                    ? `<button class="copy-btn" data-value="${esc(entry.username)}" data-label="Username"
                               title="Copy username" aria-label="Copy username">
                           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                               <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                               <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                           </svg>
                       </button>`
                    : ''}
            </div>
        </div>

        <div class="card-field">
            <span class="field-label">Password</span>
            <div class="field-row">
                <span class="field-value mono password-mask" data-pw="${esc(entry.password)}">••••••••</span>
                <button class="show-btn" title="Show/hide password" aria-label="Show password">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                </button>
                <button class="copy-btn" data-value="${esc(entry.password)}" data-label="Password"
                        title="Copy password" aria-label="Copy password">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                </button>
            </div>
        </div>
    </div>

    <div class="card-actions">
        <button class="btn btn-ghost btn-sm edit-btn" data-id="${entry.id}">Edit</button>
        <button class="btn btn-danger btn-sm delete-btn" data-id="${entry.id}">Delete</button>
    </div>
</article>`;
    }

    // ── Card event listeners ─────────────────────────────────────

    function attachCardListeners() {
        // Show / hide password toggle
        document.querySelectorAll('.show-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row    = e.currentTarget.closest('.field-row');
                const pwSpan = row.querySelector('.password-mask');
                const showing = pwSpan.dataset.showing === '1';
                if (showing) {
                    pwSpan.textContent   = '••••••••';
                    pwSpan.dataset.showing = '0';
                    btn.setAttribute('aria-label', 'Show password');
                } else {
                    pwSpan.textContent   = pwSpan.dataset.pw;
                    pwSpan.dataset.showing = '1';
                    btn.setAttribute('aria-label', 'Hide password');
                }
            });
        });

        // Copy to clipboard — auto-clear after 30s
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const value = e.currentTarget.dataset.value;
                const label = e.currentTarget.dataset.label || 'Value';
                try {
                    await navigator.clipboard.writeText(value);
                    AppModule.showToast(`${label} copied — clears in 30s`, 'success');
                    setTimeout(() => {
                        navigator.clipboard.writeText('').catch(() => {});
                    }, 30_000);
                } catch {
                    AppModule.showToast('Copy failed — try manually selecting the text', 'error');
                }
            });
        });

        // Edit
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id    = parseInt(e.currentTarget.dataset.id, 10);
                const entry = _entries.find(en => en.id === id);
                if (entry) AppModule.openEditModal(entry);
            });
        });

        // Delete
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.currentTarget.dataset.id, 10);
                if (!confirm('Permanently delete this entry?')) return;
                try {
                    await ApiModule.deleteEntry(id);
                    _entries = _entries.filter(en => en.id !== id);
                    renderGrid(_entries);
                    AppModule.showToast('Entry deleted', 'success');
                } catch (err) {
                    if (err.message === 'SESSION_EXPIRED') { AppModule.handleSessionExpiry(); return; }
                    AppModule.showToast(err.message, 'error');
                }
            });
        });
    }

    // ── Search / filter ──────────────────────────────────────────

    function filter(query) {
        if (!query.trim()) {
            renderGrid(_entries);
            return;
        }
        const q = query.toLowerCase();
        renderGrid(_entries.filter(e =>
            e.siteName.toLowerCase().includes(q) ||
            (e.siteUrl   && e.siteUrl.toLowerCase().includes(q)) ||
            (e.username  && e.username.toLowerCase().includes(q))
        ));
    }

    // ── Save (encrypt & send) ────────────────────────────────────

    /**
     * Encrypt form data client-side and persist via API.
     *
     * @param {{ siteName, siteUrl, username, password, notes }} formData
     * @param {number|null} editId  - Existing entry ID for updates, null for creates
     */
    async function saveEntry(formData, editId = null) {
        const { siteName, siteUrl, username, password, notes } = formData;

        // Client-side encryption — vault key never leaves the browser
        const [usernameEncrypted, passwordEncrypted, notesEncrypted] = await Promise.all([
            CryptoModule.encrypt(username, _vaultKey),
            CryptoModule.encrypt(password, _vaultKey),
            CryptoModule.encrypt(notes,    _vaultKey),
        ]);

        const payload = { siteName, siteUrl, usernameEncrypted, passwordEncrypted, notesEncrypted };

        if (editId !== null) {
            await ApiModule.updateEntry(editId, payload);
        } else {
            await ApiModule.createEntry(payload);
        }

        await loadAndRender();
    }

    return Object.freeze({
        setVaultKey,
        clearVaultKey,
        loadAndRender,
        filter,
        saveEntry,
    });
})();

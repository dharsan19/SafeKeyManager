/**
 * SafeKey Generator Module
 *
 * Cryptographically secure password generator using crypto.getRandomValues().
 * Never uses Math.random().
 */
const GeneratorModule = (() => {
    'use strict';

    const CHARS = {
        lower:   'abcdefghijklmnopqrstuvwxyz',
        upper:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        numbers: '0123456789',
        symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    };

    /**
     * Generate a cryptographically random password.
     *
     * @param {object} opts
     * @param {number}  opts.length    - Password length (8–64)
     * @param {boolean} opts.uppercase - Include A-Z
     * @param {boolean} opts.numbers   - Include 0-9
     * @param {boolean} opts.symbols   - Include special characters
     * @returns {string} Generated password
     */
    function generate({ length = 16, uppercase = true, numbers = true, symbols = true } = {}) {
        let charset  = CHARS.lower;
        const groups = [CHARS.lower];

        if (uppercase) { charset += CHARS.upper;   groups.push(CHARS.upper); }
        if (numbers)   { charset += CHARS.numbers; groups.push(CHARS.numbers); }
        if (symbols)   { charset += CHARS.symbols; groups.push(CHARS.symbols); }

        if (charset.length === 0) return '';

        const clampedLength = Math.min(Math.max(length, 8), 64);
        const password      = new Array(clampedLength);

        // Step 1: guarantee at least one character from each required group
        const randBuf = new Uint32Array(clampedLength + groups.length + 10);
        crypto.getRandomValues(randBuf);
        let ri = 0;

        for (let g = 0; g < groups.length && g < clampedLength; g++) {
            const group = groups[g];
            password[g] = group[randBuf[ri++] % group.length];
        }

        // Step 2: fill remaining positions from full charset
        for (let i = groups.length; i < clampedLength; i++) {
            password[i] = charset[randBuf[ri++] % charset.length];
        }

        // Step 3: Fisher-Yates shuffle with fresh random values
        const shuffleBuf = new Uint32Array(clampedLength);
        crypto.getRandomValues(shuffleBuf);
        for (let i = clampedLength - 1; i > 0; i--) {
            const j = shuffleBuf[i] % (i + 1);
            [password[i], password[j]] = [password[j], password[i]];
        }

        return password.join('');
    }

    /**
     * Estimate password strength.
     *
     * @param {string} password
     * @returns {{ score: number, label: string, color: string, pct: number }}
     */
    function strength(password) {
        if (!password) return { score: 0, label: '', color: '', pct: 0 };

        let score = 0;
        if (password.length >=  8) score++;
        if (password.length >= 12) score++;
        if (password.length >= 16) score++;
        if (password.length >= 20) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        // Penalise obvious patterns
        if (/(.)\1{2,}/.test(password)) score--;           // repeated chars
        if (/^(123|abc|qwerty|password)/i.test(password)) score -= 2;

        score = Math.max(0, score);

        if (score <= 2) return { score, label: 'Weak',   color: 'var(--strength-weak)',   pct: 20 };
        if (score <= 4) return { score, label: 'Fair',   color: 'var(--strength-fair)',   pct: 45 };
        if (score <= 5) return { score, label: 'Good',   color: 'var(--strength-good)',   pct: 70 };
                        return { score, label: 'Strong', color: 'var(--strength-strong)', pct: 100 };
    }

    return Object.freeze({ generate, strength });
})();

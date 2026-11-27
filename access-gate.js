'use strict';
const crypto = require('crypto');

// Optional second layer for temporary demos. Never a substitute for HTTPS or a security audit.
function createAccessGate({ required, password }) {
    if (!required && !password) return (_req, _res, next) => next();
    if (typeof password !== 'string' || password.length < 16 || password.length > 128 || /[\x00-\x1f\x7f]/.test(password)) {
        throw new Error('Set EPHARMA_ACCESS_PASSWORD to a unique 16–128 character password before enabling the access gate.');
    }
    const expected = crypto.createHash('sha256').update(`demo:${password}`, 'utf8').digest();
    const failures = new Map();
    const windowMs = 15 * 60 * 1000;
    return (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        const now = Date.now();
        const key = req.ip || 'unknown';
        const previous = failures.get(key);
        if (previous && previous.until > now && previous.count >= 10) {
            res.set('Retry-After', String(Math.ceil((previous.until - now) / 1000)));
            return res.status(429).send('Too many access attempts. Try again later.');
        }
        const auth = req.get('authorization') || '';
        let actual = null;
        const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(auth);
        if (match && match[1].length <= 1024) {
            const bytes = Buffer.from(match[1], 'base64');
            if (bytes.toString('base64') === match[1]) actual = crypto.createHash('sha256').update(bytes).digest();
        }
        if (actual && crypto.timingSafeEqual(actual, expected)) {
            failures.delete(key);
            return next();
        }
        if (failures.size >= 500 && !failures.has(key)) {
            for (const [ip, item] of failures) if (item.until <= now) failures.delete(ip);
            if (failures.size >= 500) return res.status(429).send('Too many access attempts. Try again later.');
        }
        const entry = previous && previous.until > now ? previous : {count:0, until:now + windowMs};
        entry.count++;
        failures.set(key, entry);
        res.set('WWW-Authenticate', 'Basic realm="E-Pharma demo access", charset="UTF-8"');
        return res.status(401).send('Demo access required.');
    };
}
module.exports = { createAccessGate };

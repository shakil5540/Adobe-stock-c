// Frontend Configuration - SAFE FOR PUBLIC
// Only contains public API endpoints, no secrets or implementation details
const CONFIG = {
    // Public backend URLs only
    PRIMARY_BACKEND: 'https://ds-zeta-flame.vercel.app',
    BACKUP_BACKEND: 'http://localhost:8080',

    // Client-side settings only
    TIMEOUT: 30000,
    MAX_RETRIES: 2,
    RETRY_DELAY: 1000
};

// Export for use in app.js
window.CONFIG = CONFIG;

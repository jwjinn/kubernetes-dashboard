declare global {
    interface Window {
        _env_?: Record<string, string>;
    }
}

/**
 * Retrieves an environment variable.
 * Prioritizes the runtime `window._env_` (injected via Kubernetes ConfigMap for example),
 * then falls back to `import.meta.env` (baked in at build time via Vite).
 * 
 * @param key The environment variable key, e.g. "VITE_ACCELERATOR_TYPE"
 * @param defaultValue An optional default value if the key is not found
 */
export function getEnv(key: string, defaultValue: string = ''): string {
    // 1. Check runtime environment configuration first (from public/env-config.js)
    if (window._env_ && window._env_[key] !== undefined) {
        return window._env_[key];
    }

    // 2. Check build-time environment configuration (from Vite / .env files)
    if (import.meta.env[key] !== undefined) {
        return import.meta.env[key] as string;
    }

    // 3. Fallback to default
    return defaultValue;
}

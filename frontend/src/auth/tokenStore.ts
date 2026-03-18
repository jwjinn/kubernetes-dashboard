let currentAccessToken: string | null = null;

export function setAccessToken(token: string | null) {
    currentAccessToken = token;
}

export function getAccessToken() {
    return currentAccessToken;
}

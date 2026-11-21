/**
 * Authentication service - connects to the backend auth API
 */

import { API_BASE_URL } from "./api-config";

const API_BASE = `${API_BASE_URL}/api/v1`;

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    email: string | null;
    full_name: string | null;
  };
  expires_at: string;
}

interface AuthUser {
  id: number;
  username: string;
  email: string | null;
  full_name: string | null;
  token: string;
}

const TOKEN_KEY = "tea.auth.token";
const USER_KEY = "tea.auth.user";

// Get stored auth data
// Login is kept per browser tab (sessionStorage): opening the site in a new tab or after
// closing the browser always starts at the login page.
function removeLegacyAuth() {
  try {
    // Older builds kept the login in localStorage, which skipped the login page forever
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Storage not available
  }
}

export function getStoredAuth(): AuthUser | null {
  removeLegacyAuth();
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const userStr = sessionStorage.getItem(USER_KEY);
    if (token && userStr) {
      return { ...JSON.parse(userStr), token };
    }
  } catch {
    // Invalid data in storage
  }
  return null;
}

// Store auth data
function setStoredAuth(user: AuthUser) {
  try {
    sessionStorage.setItem(TOKEN_KEY, user.token);
    sessionStorage.setItem(USER_KEY, JSON.stringify({
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
    }));
  } catch {
    // Storage not available
  }
}

// Clear auth data
function clearStoredAuth() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch {
    // Storage not available
  }
}

/**
 * Login with username and password
 */
export async function login(username: string, password: string): Promise<AuthUser> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password } as LoginRequest),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(error.detail || "Login failed");
  }

  const data: LoginResponse = await response.json();
  
  const authUser: AuthUser = {
    id: data.user.id,
    username: data.user.username,
    email: data.user.email,
    full_name: data.user.full_name,
    token: data.token,
  };

  setStoredAuth(authUser);
  return authUser;
}

/**
 * Logout - invalidate session token
 */
export async function logout(): Promise<void> {
  const auth = getStoredAuth();
  if (auth) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${auth.token}`,
        },
      });
    } catch {
      // Logout failed, but we'll clear local storage anyway
    }
  }
  clearStoredAuth();
}

/**
 * Get current user info from backend
 */
export async function getCurrentUserInfo(): Promise<AuthUser | null> {
  const auth = getStoredAuth();
  if (!auth) return null;

  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        "Authorization": `Bearer ${auth.token}`,
      },
    });

    if (!response.ok) {
      clearStoredAuth();
      return null;
    }

    const user = await response.json();
    return {
      ...user,
      token: auth.token,
    };
  } catch {
    clearStoredAuth();
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getStoredAuth() !== null;
}

import { UserProfile } from "../types/resq";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface AuthApiResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: UserProfile;
  error?: string;
  isOffline?: boolean;
}

/**
 * Checks whether the DRCH FastAPI Gateway is reachable.
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Login via Backend FastAPI Gateway.
 * If backend is offline, returns { success: false, isOffline: true }
 * allowing caller to gracefully fall back to local storage without user interruption.
 */
export async function backendLogin(
  identifier: string,
  password?: string,
  extraProfile?: Partial<UserProfile>
): Promise<AuthApiResponse> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const payload: Record<string, unknown> = {
      identifier,
      password: password || "",
    };
    if (extraProfile) {
      if (extraProfile.role) payload.role = extraProfile.role;
      if (extraProfile.name) payload.name = extraProfile.name;
      if (extraProfile.agency) payload.agency = extraProfile.agency;
    }

    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      // Fallback if backend is running without /api prefix
      if (res.status === 404) {
        res = await fetch(`${API_BASE_URL}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      }
    } finally {
      clearTimeout(timeout);
    }

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.detail || "Authentication failed on backend.",
      };
    }

    if (data.token && typeof window !== "undefined") {
      localStorage.setItem("resq_jwt_token", data.token);
    }

    return {
      success: true,
      token: data.token,
      user: data.user,
      message: data.message,
    };
  } catch {
    // Network or server unreachable - signal offline fallback
    return {
      success: false,
      isOffline: true,
      error: "Backend gateway unreachable",
    };
  }
}

/**
 * Signup via Backend FastAPI Gateway.
 */
export async function backendSignup(
  userData: Omit<UserProfile, "id"> & { password?: string }
): Promise<AuthApiResponse> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.detail || "Registration failed on backend.",
      };
    }

    if (data.token && typeof window !== "undefined") {
      localStorage.setItem("resq_jwt_token", data.token);
    }

    return {
      success: true,
      token: data.token,
      user: data.user,
      message: data.message,
    };
  } catch {
    return {
      success: false,
      isOffline: true,
      error: "Backend gateway unreachable",
    };
  }
}

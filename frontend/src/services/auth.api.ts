const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://safecart-backend-984543935964.europe-west1.run.app/api';

export const authApi = {
  // Internal user authentication (admin/member)
  async internalLogin(username: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw new Error('Internal login failed');
    }

    return response.json();
  },

  async internalLogout() {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Internal logout failed');
    }

    return response.json();
  },

  async getCurrentInternalUser() {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to get current internal user');
    }

    return response.json();
  },

  async internalLoginWithGoogle(idToken: string) {
    const response = await fetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Internal Google login failed');
    }

    return response.json();
  },

  // Account user authentication (normal public users)
  async accountLogin(email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/user/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Account login failed');
    }

    return response.json();
  },

  async accountRegister(name: string, email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/user/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      throw new Error('Account registration failed');
    }

    return response.json();
  },

  async accountLogout() {
    const response = await fetch(`${API_BASE_URL}/user/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Account logout failed');
    }

    return response.json();
  },

  async getCurrentAccountUser() {
    const response = await fetch(`${API_BASE_URL}/user/auth/me`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to get current account user');
    }

    return response.json();
  },

  // Legacy methods for backward compatibility (internal user)
  async login(username: string, password: string) {
    return this.internalLogin(username, password);
  },

  async logout() {
    return this.internalLogout();
  },

  async getCurrentUser() {
    return this.getCurrentInternalUser();
  },

  async loginWithGoogle(idToken: string) {
    return this.internalLoginWithGoogle(idToken);
  },
};
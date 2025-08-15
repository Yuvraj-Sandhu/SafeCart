// Internal user (admin/member roles)
export interface InternalUser {
  uid: string;
  username: string;
  email: string;
  role: 'member' | 'admin';
}

// Normal account user (public users)
export interface AccountUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  emailPreferences?: {
    states: string[];
    frequency: 'daily' | 'weekly';
    timeOfDay: 'morning' | 'evening';
    weekdays: boolean;
    weekends: boolean;
    subscribed: boolean;
  };
}

export interface InternalLoginRequest {
  username: string;
  password: string;
}

export interface AccountLoginRequest {
  email: string;
  password: string;
}

export interface InternalLoginResponse {
  success: boolean;
  token: string;
  user: InternalUser;
}

export interface AccountLoginResponse {
  success: boolean;
  token: string;
  user: AccountUser;
}

export interface AuthState {
  internal_user: InternalUser | null;
  account_user: AccountUser | null;
  isInternalAuthenticated: boolean;
  isAccountAuthenticated: boolean;
  isLoading: boolean;
}
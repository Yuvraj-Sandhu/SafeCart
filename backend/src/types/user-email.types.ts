export interface EmailPreferences {
  subscribed: boolean;
  states: string[];  // Array of state codes user is subscribed to (e.g., ['CA', 'TX', 'NY'])
  unsubscribeToken?: string;
  subscribedAt?: Date;
}

export interface User {
  uid: string;
  email: string;
  name: string;
  passwordHash?: string;
  emailVerified: boolean;
  createdAt: Date;
  emailPreferences?: EmailPreferences;
}

export interface UserCreateData {
  email: string;
  name: string;
  password: string;
}

export interface UserLoginData {
  email: string;
  password: string;
}
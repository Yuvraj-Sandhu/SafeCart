export interface EmailPreferences {
  subscribed: boolean;
  state?: string;
  schedule?: {
    weekdays: boolean;
    weekends: boolean;
    timeOfDay: 'morning' | 'evening';
    timezone: string;
  };
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
import { WelcomeEmail } from './templates/WelcomeEmail';

export default function WelcomeEmailPreview() {
  return (
    <WelcomeEmail
      user={{
        name: 'John Doe',
        email: 'john@example.com',
        unsubscribeToken: 'welcome-token-123456789'
      }}
      state="California"
      schedule={{
        weekdays: true,
        weekends: false,
        timeOfDay: 'morning'
      }}
    />
  );
}

// Multiple states version
export function WelcomeEmailMultiStatePreview() {
  return (
    <WelcomeEmail
      user={{
        name: 'Jane Smith',
        email: 'jane@example.com',
        unsubscribeToken: 'welcome-token-987654321'
      }}
      state="California, Texas, and New York"
      schedule={{
        weekdays: true,
        weekends: true,
        timeOfDay: 'evening'
      }}
    />
  );
}

// Weekend only version
export function WelcomeEmailWeekendPreview() {
  return (
    <WelcomeEmail
      user={{
        name: 'Bob Johnson',
        email: 'bob@example.com',
        unsubscribeToken: 'weekend-token-555555555'
      }}
      state="Florida and Georgia"
      schedule={{
        weekdays: false,
        weekends: true,
        timeOfDay: 'morning'
      }}
    />
  );
}
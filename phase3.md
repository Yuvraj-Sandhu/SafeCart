# Phase 3: Email Notification System - Roadmap

## Overview
**Goal**: Test consumer interest and feedback loops via state-level daily recall email alerts

**Core Features**:
- State-based daily digest emails
- Manual trigger system (due to image availability requirements)
- Engagement tracking and analytics
- Beta testing with internal users first

## Technology Stack
- **Email Provider**: Resend (other option: SendGrid, switch later maybe?)
- **Template Engine**: React Email
- **Queue**: Google Cloud Tasks
- **Scheduler**: Google Cloud Scheduler
- **Analytics**: Provider webhooks + custom dashboard

## Key Architecture Decisions

### 1. Provider Abstraction Layer
Create an interface to switch between email providers easily:
- EmailProvider interface with send, batch, and status methods
- Single environment variable to switch providers

### 2. Manual Trigger Workflow
Due to image availability uncertainty:
- Daily status dashboard showing recalls per state
- Image availability checker
- Preview system before sending (or send preview email to admins)
- Manual send button when images are ready
- Optional auto-send if all images available

### 3. Dual Account Systems
- **Internal team**: Rename existing `users` → `internal_users` collection (admin/member roles)
- **Client accounts**: New `users` collection for general public accounts  
- Separate auth systems but shared infrastructure
- Email subscription is optional feature within client accounts
- Future: Only clients with accounts can view recall data

## Database Schema Updates

### Internal Users Collection (Renamed from users)
Keep existing structure for admin/member roles - just rename collection

### Users Collection (New - for clients)
General accounts for public users:
- email (string, unique)
- name (string)
- passwordHash (string) 
- emailVerified (boolean)
- createdAt (timestamp)
- emailPreferences (object):
  - subscribed (boolean)
  - state (Array - multiple state selection possible)
  - schedule (weekdays, weekends, time of day)
  - unsubscribeToken (unique token)
  - subscribedAt (timestamp)

### New Collections
- **email_queue**: Track emails to be sent
- **email_logs**: Track delivery and engagement

## Implementation Steps

### Step 1: Foundation & Abstraction Layer
- Set up email service abstraction
- Implement Resend provider
- Create SendGrid provider stub
- Add email preferences to user model
- Create preference management endpoints

**API Endpoints**:
- `POST /api/auth/register` (client registration)
- `POST /api/auth/login` (client login)
- `GET /api/user/email-preferences`
- `PUT /api/user/email-preferences` 
- `POST /api/user/unsubscribe/:token`

### Step 2: Email Templates
- Set up React Email
- Create digest template
- Design recall card component
- Create welcome email template
- Build test email template

**Template Structure**:
- Header with date and location
- Recalls section
- Footer with unsubscribe link

### Step 3: Frontend Preferences UI
- Create email preferences page for client accounts
- Client registration/login flow
- State selector with current location detection
- Schedule preferences (weekdays/weekends, time)
- Test email button

**Route**: `/account/email-preferences`

### Step 4: Admin Dashboard
- Show all recalls for the week with images
- Image availability checker
- Preview functionality for all states
- Manual send button when all images ready
- Send digest to all subscribers

**API Endpoints**:
- `GET /api/admin/email/weekly-recalls`
- `GET /api/admin/email/preview`
- `POST /api/admin/email/test`
- `POST /api/admin/email/send-digest`

**Route**: `/internal/admin/email-digest`

### Step 5: Digest Generation Service
- Recall aggregation by state and date
- Image availability checking
- Email HTML generation
- Batch sending logic
- Error handling and retries

**Core Functions**:
- Get recalls for digest (by state/date)
- Check image availability
- Generate email HTML
- Send to subscribers
- Log delivery status

### Step 6: Scheduling Setup
- Configure Google Cloud Scheduler
- Morning preparation job (9 AM ET)
- Optional auto-send job (11 AM ET)
- Admin notification system
- Manual trigger endpoints

**Scheduler Jobs**:
- `daily-digest-prepare`: Check status, notify admin
- `daily-digest-check`: Optional auto-send if ready

### Step 7: Analytics & Tracking
- Webhook handlers for email events
- Open rate tracking
- Click tracking
- Bounce/complaint handling
- Analytics dashboard

**API Endpoints**:
- `POST /api/webhooks/email/:provider`
- `GET /api/admin/email/analytics`

**Tracked Metrics**:
- Delivery rate
- Open rate
- Click-through rate
- Unsubscribe rate
- Bounce rate

### Step 8: Beta Testing
- Each person subscribes to their state
- Run daily digests for test period
- Collect feedback
- Iterate based on results

## Migration Path to SendGrid (optional)

When reaching 50K+ emails/month:
1. Update environment variable: `EMAIL_PROVIDER=sendgrid`
2. Add SendGrid API key
3. Update webhook endpoints
4. Migrate historical data
5. Test and verify

## Security Considerations

- Email verification before subscription
- One-click unsubscribe (no login required)
- Webhook signature verification
- Rate limiting on subscription endpoints
- No PII in tracking data

## Monitoring & Alerts

**Daily Monitoring**:
- Total emails sent
- Delivery success rate
- Bounce/complaint rates
- Queue status
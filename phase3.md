# Phase 3: Email Notification System - Implementation Status & Roadmap

## Overview
**Goal**: Provide immediate food safety alerts via state-level email notifications

**Core Features** - IMPLEMENTED:
- State-based immediate email alerts (no scheduling delays for maximum safety)
- Dual authentication system (internal team + public user accounts)
- React Email templates with Mailchimp Transactional delivery
- Email preferences management with one-click unsubscribe
- Manual testing system for subscription verification

## Technology Stack - CURRENT IMPLEMENTATION
- **Email Provider**: Mailchimp Transactional (Mandrill) - IMPLEMENTED
- **Template Engine**: React Email - IMPLEMENTED  
- **Backend**: Express.js with Firebase Firestore - IMPLEMENTED
- **Frontend**: Next.js 14 with TypeScript - IMPLEMENTED
- **Authentication**: Dual JWT system (internal + public users) - IMPLEMENTED

## Key Architecture Decisions

### 1. Provider Abstraction Layer
Create an interface to switch between email providers easily:
- EmailProvider interface with send, batch, and status methods
- Single environment variable to switch providers

### 2. Immediate Alert Strategy - IMPLEMENTED
Changed from scheduled digests to immediate alerts for maximum user safety:
- Alerts sent immediately when recalls are issued
- No time-based scheduling to prevent delays in critical food safety information
- Manual test email functionality for subscription verification
- Simplified user preferences (states only, no delivery timing)

### 3. Dual Account Systems - IMPLEMENTED
- **Internal team**: `internal_users` collection with admin/member roles
- **Public accounts**: `users` collection for general public email subscriptions
- Separate authentication systems with different JWT token types
- Independent login/logout flows while maintaining shared infrastructure
- Email subscription system fully functional for public users

## Database Schema Updates

### Internal Users Collection (Renamed from users)
Keep existing structure for admin/member roles - just rename collection

### Users Collection - IMPLEMENTED
Public user accounts with simplified immediate alert preferences:
- email (string, unique)
- name (string)
- passwordHash (string) 
- emailVerified (boolean)
- createdAt (timestamp)
- emailPreferences (object):
  - subscribed (boolean)
  - states (Array - multiple state selection for targeted alerts)
  - unsubscribeToken (unique token for CAN-SPAM compliance)
  - subscribedAt (timestamp)

**Note**: Time-based scheduling removed for immediate alerts. Users receive notifications instantly when recalls are issued for maximum safety.

### New Collections
- **email_queue**: Track emails to be sent
- **email_logs**: Track delivery and engagement

## Implementation Steps

### Step 1: Foundation & Abstraction Layer - COMPLETED
- Email service abstraction with Mailchimp Transactional provider
- Email preferences integrated into user model
- Preference management endpoints implemented

**API Endpoints - IMPLEMENTED**:
- `POST /api/user/auth/register` (public user registration)
- `POST /api/user/auth/login` (public user login)
- `GET /api/user/email-preferences`
- `PUT /api/user/email-preferences` 
- `POST /api/user/unsubscribe/:token`
- `POST /api/user/send-test-email`

### Step 2: Email Templates - COMPLETED
- React Email setup with BaseLayout component
- Welcome email template with immediate alert messaging
- Recall digest template (ready for future digest implementation)
- CAN-SPAM compliant unsubscribe functionality

**Template Features - IMPLEMENTED**:
- Mobile-responsive design with SafeCart branding
- Immediate alert confirmation messaging
- One-click unsubscribe links
- State-specific personalization

### Step 3: Frontend Preferences UI - COMPLETED
- Email preferences page for public user accounts
- Public user registration/login flow with dual authentication
- State selector with autocomplete functionality
- Simplified immediate alert preferences (no scheduling)
- Test email functionality for subscription verification

**Route - IMPLEMENTED**: `/account/alerts`

### Step 4: Admin Email Dashboard - PLANNED IMPLEMENTATION

**Overview**: Centralized dashboard for managing email digests with both manual and queue-based systems.

**Route**: `/internal/admin/email-dashboard`

#### Dashboard UI Structure

**Three Main Tabs**:
1. **Manual Digest** - Build and send custom digests
2. **Automatic Queues** - Manage USDA/FDA recall queues  
3. **Email History** - View past sent digests

#### Manual Digest Builder
- **Filter Controls**: Source selector (USDA/FDA/Both), date range picker
- **Recall Display**: Shows all filtered recalls with image status indicator
- **Status Bar**: "15 of 25 recalls have images"
- **Actions**: 
  - Select All checkbox for bulk selection
  - Send Test Email (admin only)
  - Send to All Subscribers (state-filtered)

#### Automatic Queue System

**USDA Daily Queue**:
- Created by sync service when new recalls detected
- Displays pending recalls with image status
- Auto-triggers at 5pm ET daily if queue exists
- Admin controls: Preview, Send Now, Cancel (delete queue)

**FDA Weekly Queue**:
- Created by sync service when new FDA recalls detected
- Accumulates recalls throughout the week
- NO automatic sending - fully manual control
- Admin controls: Preview, Send Now, Cancel (delete queue)

**Queue Display Format**:
```
USDA Queue: 3 new recalls (2 with images) - Next: Today 5pm ET
FDA Queue: 8 new recalls (5 with images) - Manual send required
```

#### State-Based Email Filtering
Each subscriber receives only recalls affecting their selected states:
- Digest with 25 total recalls
- User selected California
- 8 recalls affect California
- User receives email with only those 8 recalls

#### Firestore Collections

**email_queues**:
```javascript
{
  type: 'USDA_DAILY' | 'FDA_WEEKLY',
  status: 'pending' | 'sent' | 'cancelled',
  recalls: [{ recallId, source, hasImage, addedAt }],
  scheduledFor: timestamp,  // 5pm ET for USDA, null for FDA
  imageStats: { total, withImages }
}
```

**email_digests**:
```javascript
{
  type: 'manual' | 'automatic',
  queueId: string | null,
  recalls: [{ recallId, source, hasImage }],
  sentAt: timestamp,
  sentBy: string,
  recipientStats: { total, byState },
  testMode: boolean
}
```

#### API Endpoints

**Manual Digest**:
- `POST /api/admin/digest/search` - Search recalls by source and date
- `POST /api/admin/digest/test` - Send test to admin
- `POST /api/admin/digest/send` - Send to all subscribers

**Queue Management**:
- `GET /api/admin/queues` - Get both queue statuses
- `GET /api/admin/queues/:type/preview` - Preview queue content
- `POST /api/admin/queues/:type/send` - Manually send queue
- `DELETE /api/admin/queues/:type` - Cancel/delete queue

**History**:
- `GET /api/admin/email-history` - View past digests with stats

### Step 5: Queue Integration with Sync Services - TO BE IMPLEMENTED

**Sync Service Modifications**:
- Update USDA sync to add new recalls to USDA_DAILY queue
- Update FDA sync to add new recalls to FDA_WEEKLY queue  
- Track queue status and prevent duplicates
- Update image processing to update queue image stats

**Queue Management Service**:
```javascript
// During sync operations
async function onNewRecallDetected(recall) {
  if (recall.source === 'USDA') {
    await addToQueue('USDA_DAILY', recall);
  } else if (recall.source === 'FDA') {
    await addToQueue('FDA_WEEKLY', recall);
  }
}

// Queue processing
async function processQueue(queueType) {
  const queue = await getActiveQueue(queueType);
  if (!queue || queue.recalls.length === 0) return;
  
  // Generate digest email
  const digest = await generateDigest(queue.recalls);
  
  // Send to subscribers based on states
  await sendStateFilteredEmails(digest);
  
  // Mark queue as processed
  await updateQueueStatus(queue.id, 'sent');
}
```

### Step 6: Scheduling and Automatic Processing - TO BE IMPLEMENTED

**USDA Daily Schedule**:
- Cloud Scheduler job at 5:00 PM ET daily
- Checks for pending USDA_DAILY queue
- Auto-sends if queue exists and not cancelled
- Notifies admin of send status

**FDA Manual Process**:
- No automatic scheduling
- Queue accumulates throughout the week
- Admin manually triggers send from dashboard
- Queue resets after manual send

**Cloud Scheduler Configuration**:
```yaml
# USDA Daily Job
name: usda-daily-digest
schedule: "0 17 * * *"  # 5pm ET
timezone: America/New_York
httpTarget:
  uri: /api/admin/queues/USDA_DAILY/auto-send
  httpMethod: POST
```

**Admin Override Capabilities**:
- Cancel today's USDA auto-send (deletes queue)
- Send USDA queue immediately (bypasses schedule)
- Send FDA queue at any time (always manual)
- Preview any queue before sending

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

## Impact Analysis: Recent Changes on Future Implementation

### 1. Email Provider Change: Resend → Mailchimp Transactional

**Positive Impacts**:
- Proven enterprise-grade reliability and deliverability
- Comprehensive API with all needed features implemented
- Webhook system already tested and working
- No migration needed in foreseeable future

**Implementation Considerations**:
- Webhook endpoints already configured for Mailchimp
- Analytics and tracking integration simplified
- Rate limiting and compliance features built-in
- Cost structure favorable for immediate alert volume

### 2. Scheduling Removal: From Digest → Immediate Alerts

**Fundamental Architecture Changes**:
- **Database triggers** now critical instead of scheduled jobs
- **Real-time processing** requirements instead of batch processing
- **Individual alert logic** instead of digest aggregation logic
- **Deduplication systems** needed to prevent spam from rapid-fire recalls

**Future Implementation Impacts**:

**Simplified**:
- User preference management (no complex scheduling UI)
- Email template logic (no time-based personalization)
- Database schema (removed schedule fields)
- Authentication flow (simplified user onboarding)

**New Requirements**:
- **Webhook/trigger system** for real-time recall detection
- **Alert deduplication** logic to prevent multiple emails for same recall
- **Rate limiting** per user to prevent overwhelming subscribers
- **Alert suppression** system for admin control during mass recall events

**Modified Priority**:
- Step 4 (Admin Dashboard) becomes more critical for alert management
- Step 5 (Alert Service) needs real-time architecture instead of batch
- Step 6 (Triggers) becomes foundational instead of optional enhancement

### 3. Dual Authentication Implementation Impact

**Architectural Benefits**:
- Clean separation between internal tools and public features
- Independent scaling of user systems
- Security isolation between team and public access
- Future-proof for additional public user features

**Future Feature Enablement**:
- Public user accounts ready for additional features (purchase tracking, etc.)
- Internal tools can evolve independently
- Cross-system analytics and reporting capabilities
- Foundation for premium user tiers

## Migration Considerations for Alternative Providers

**Current System Flexibility**:
- Email service abstraction layer allows provider switching
- Template system provider-agnostic with React Email
- Database schema not tied to specific email provider
- Webhook architecture adaptable to different providers

**Future Migration Path** (if needed):
1. Implement new provider in existing abstraction layer
2. Update environment variable: `EMAIL_PROVIDER=new_provider`
3. Update webhook endpoints and signature verification
4. Test parallel sending during transition period
5. Monitor deliverability and engagement metrics

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
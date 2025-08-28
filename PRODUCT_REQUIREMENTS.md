# SafeCart Product Requirements Document

## Executive Summary

SafeCart is a comprehensive food safety platform that protects United States consumers from foodborne illnesses by improving how food recall information is discovered, personalized, and delivered. The platform aggregates recall data from multiple government sources (USDA and FDA), enhances it with intelligent processing, and presents it through an intuitive interface that makes critical safety information accessible to everyone.

### Problem Statement

Every year, hundreds of food recalls occur across the United States, but consumers often remain unaware of products that could pose serious health risks. Current government recall systems are fragmented, difficult to navigate, and lack personalization. This information gap puts millions of Americans at risk of consuming contaminated or dangerous food products.

### Solution

SafeCart bridges this gap by creating a unified, user-friendly platform that:
- Automatically detects your location and shows relevant recalls for your area
- Aggregates data from both USDA (meat, poultry, eggs) and FDA (all other foods) sources
- Provides visual product identification through processed recall images
- Offers real-time search and filtering capabilities
- Sends proactive email notifications about new recalls (coming soon)

---

## Part 1: Public-Facing Features & Core Functionality

### 1.1 Homepage & Initial Experience

#### Purpose
Provide an immediate, zero-friction way for consumers to see food recalls affecting their area without requiring registration or complex navigation.

#### Location Detection
**What It Does:**
- Automatically detects user's state based on their IP address
- Uses the detected state as the default filter for recall searches
- Shows a visual indicator when location is detected vs manually selected
- Falls back to California if location cannot be determined or user is outside the US

**Expected Behavior:**
1. User visits the website
2. System attempts to detect location via IP geolocation service (ipapi.co)
3. If successful and user is in US: 
   - State dropdown shows detected state with a location pin icon
   - Text indicates "Detected location"
4. If unsuccessful or user is outside US:
   - State dropdown defaults to "California"
   - No detection indicator shown
5. User can manually override the detected state at any time
6. Manual selection removes the "detected" indicator

**Why This Matters:**
Most food recalls are geographically limited. By automatically detecting location, users immediately see the most relevant information without having to know or input their state, reducing friction and increasing safety awareness.

#### State Selection System
**What It Does:**
- Provides an autocomplete dropdown with all 50 US states plus "ALL" option
- Allows typing to filter states quickly
- Shows full state names (not abbreviations) for clarity
- Remembers user's manual selection during the session

**Expected Behavior:**
1. Dropdown shows current selected state
2. Clicking opens autocomplete menu with all states
3. Typing filters the list in real-time
4. Selecting "ALL" shows recalls from all states nationwide
5. Selection triggers automatic search with current date filters

### 1.2 Date Range Filtering

#### Purpose
Allow users to focus on recent recalls or look back at historical data based on their needs.

#### Date Selection Interface
**What It Does:**
- Provides manual date pickers for start and end dates
- Offers preset options for common time ranges
- Uses Eastern Time (ET) for all date calculations to match government systems
- Automatically selects "Last 30 Days" on page load

**Preset Options:**
1. **This Month** - From the 1st of current month to today
2. **Last Month** - Complete previous calendar month
3. **Year to Date** - From January 1st to today
4. **Last 30 Days** - Rolling 30-day window (default)
5. **Clear Dates** - Remove all date filters

**Expected Behavior:**
1. Page loads with "Last 30 Days" automatically selected
2. Date inputs show selected range in MM/DD/YYYY format
3. Clicking "Presets" button shows dropdown menu
4. Selecting preset immediately updates date inputs
5. Manual date selection overrides any preset
6. End date automatically includes the full day (11:59 PM ET)

**Why This Matters:**
Different users have different needs - some want only the latest recalls, others may be researching a specific incident from months ago. The preset system covers common use cases while manual selection provides full flexibility.

### 1.3 Search Execution

#### Automatic Search Trigger
**What It Does:**
- Automatically searches when page loads with detected/default state and date range
- Shows loading indicator during search
- Displays result count when complete

**Expected Behavior:**
1. Once state and dates are set on page load, search executes automatically
2. Loading spinner appears with "Loading recalls..." message
3. Results populate in masonry grid layout
4. Header shows total count: "Found X recalls"
5. No results shows friendly message suggesting different criteria

#### Manual Search Controls
**What It Does:**
- "Search Recalls" button executes search with current filters
- "Reset Filters" button clears all selections and results

**Expected Behavior:**
1. Search button disabled while search is in progress
2. Button text changes to "Searching..." during operation
3. Reset clears state selection, dates, and results
4. After reset, location detection can run again

### 1.4 Recall Display Grid

#### Masonry Layout System
**What It Does:**
- Displays recalls in Pinterest-style masonry grid
- Adjusts column count based on screen size
- Loads more recalls automatically as user scrolls
- Provides smooth animations for new items

**Responsive Columns:**
- Mobile (< 640px): 1 column
- Tablet (640-1024px): 2 columns  
- Desktop (1024-1280px): 3 columns
- Large Desktop (> 1280px): 4 columns

**Expected Behavior:**
1. Initial load shows first batch (10-40 items based on columns)
2. Scrolling near bottom triggers loading of next batch
3. "Loading more recalls..." indicator appears during fetch
4. New items animate in with staggered fade effect
5. "Showing all X recalls" message when list is complete

#### Recall Card Components
**What Each Card Shows:**
1. **Product Image** (if available)
   - First available image from USDA/FDA or user uploads
   - Click to open full-screen image gallery
   - "+N" badge shows additional image count
   - Placeholder icon if no images available

2. **Time Badge**
   - Shows relative time (e.g., "3 days ago", "2 months ago")
   - Overlaid on top-right of image/placeholder
   - Helps users quickly identify recent recalls

3. **Product Title**
   - Enhanced title if available (AI-processed for clarity)
   - Otherwise shows original government title
   - Bold, prominent display for quick scanning

4. **Recall Date**
   - Formatted as "Mon DD, YYYY" 
   - Shows when recall was initiated

5. **View Details Button**
   - If recall has website: Opens USDA/FDA page in new tab
   - If no website: Expands card to show additional information

**Expanded Card Details:**
When expanded, cards additionally show:
- Full recall reason/risk description
- Company/manufacturer name
- Complete product description
- Distribution information

### 1.5 Search Within Results

#### Purpose
Allow users to quickly filter displayed recalls without making new API calls.

#### Text Search Interface
**What It Does:**
- Search box appears above recall grid
- Filters results in real-time as user types
- Searches across product titles and company names
- Shows filtered count vs total count

**Expected Behavior:**
1. Search box appears after initial results load
2. Typing instantly filters displayed recalls
3. Header updates: "Found X recalls (filtered from Y)"
4. Clearing search box shows all results again
5. No results shows helpful message with original count

### 1.6 Image Gallery System

#### Purpose
Help users visually identify recalled products through product labels and packaging photos.

#### Image Modal Viewer
**What It Does:**
- Opens full-screen overlay with large image display
- Allows navigation between multiple images
- Shows image counter (e.g., "2 of 5")
- Provides zoom capability on mobile devices

**Expected Behavior:**
1. Clicking any recall image opens modal
2. Modal shows clicked image at full size
3. Left/right arrows navigate between images (if multiple)
4. Clicking outside modal or X button closes it
5. Keyboard navigation: Arrow keys change images, Escape closes

**Image Sources:**
1. **USDA Images** - Automatically extracted from recall summaries
2. **FDA Images** - Extracted when available
3. **User Uploads** - Added by internal team for better identification
4. **PDF Pages** - Converted from PDF labels to images

### 1.7 Recall Detail Pages

#### Purpose
Provide shareable, permanent links to specific recalls for social media, emails, and bookmarking.

#### Individual Recall View
**URL Structure:** `/recalls/[recall-id]`

**What It Shows:**
- Full recall information in focused view
- All images in gallery format
- Share buttons for social media
- "View More Recalls" call-to-action

**Social Sharing Features:**
1. **Copy Link** - Copies URL to clipboard
2. **Facebook** - Opens Facebook share dialog
3. **Twitter** - Pre-filled tweet with recall title
4. **LinkedIn** - Professional network sharing

**Expected Behavior:**
1. Direct navigation shows single recall
2. Page title and meta tags optimized for sharing
3. Shows preview image when shared on social media
4. "Copied!" confirmation when link copied
5. Returns to main page via "View More Recalls" button

### 1.8 Data Unification System

#### Purpose
Present recalls from different government sources in a consistent, user-friendly format.

#### Unified Display Format
**What It Does:**
- Converts USDA and FDA data to common structure
- Standardizes date formats across sources
- Normalizes state and location information
- Preserves source attribution

**Data Mapping:**
| Unified Field | USDA Source | FDA Source |
|---------------|-------------|------------|
| Product Title | AI-enhanced or original title | AI-enhanced or product description |
| Company | Establishment name | Recalling firm |
| Date | Recall date | Report date |
| Risk Level | Risk level (High/Low) | Classification (I/II/III) |
| States | Parsed from text | Parsed from distribution |
| Status | Based on closed date | Based on termination |

**Expected Behavior:**
1. Users see consistent cards regardless of source
2. Source badge (USDA/FDA) indicates origin
3. Dates converted to readable format
4. Risk levels use consistent color coding
5. All features work identically for both sources

### 1.9 Performance Features

#### Scroll-to-Top Button
**What It Does:**
- Appears after scrolling down 200 pixels
- Smoothly scrolls to page top when clicked
- Auto-hides when scrolling up

**Expected Behavior:**
1. Button hidden initially
2. Appears with fade animation on scroll down
3. Disappears when scrolling up
4. Click triggers smooth scroll to top
5. Button styled to match theme

#### Progressive Loading
**What It Does:**
- Loads recalls in batches to improve performance
- Shows loading indicator for additional content
- Implements image lazy loading

**Batch Sizes:**
- 1 column: 10 items per batch
- 2 columns: 20 items per batch
- 3 columns: 30 items per batch
- 4 columns: 40 items per batch

**Expected Behavior:**
1. Initial page shows first batch only
2. Scrolling loads next batch automatically
3. Images load only when approaching viewport
4. Smooth animation for new items
5. Memory efficient even with hundreds of recalls

---

*End of Part 1: Public-Facing Features & Core Functionality*

---

## Part 2: Internal Tools & Admin Features

### 2.1 Authentication System

#### Purpose
Secure the internal tools from unauthorized access and establish role-based permissions for different team members.

#### Two-Track Authentication
SafeCart maintains two separate authentication systems:

1. **Internal Team Authentication** (/internal/login)
   - For SafeCart team members (admins and content editors)
   - 7-day session duration for security
   - Access to editing tools and admin features

2. **Public User Authentication** (/account/login)
   - For email subscribers and registered users
   - 30-day session duration for convenience
   - Manage email preferences and subscriptions
   - Save preferred states for personalized alerts

#### Login Methods

##### Username & Password
**What It Does:**
- Traditional login with username and password
- Password visibility toggle for easier typing
- Remember session for 7 days

**Expected Behavior:**
1. User enters username (not email)
2. Password field includes show/hide toggle
3. Login button disabled until both fields filled
4. Error messages display for invalid credentials
5. Successful login redirects to editing page

##### Google Sign-In
**What It Does:**
- One-click authentication using Google account
- No password needed
- Automatic account creation for first-time users
- Pre-authorized email list for security

**Expected Behavior:**
1. User clicks "Sign in with Google" button
2. Google authentication popup appears
3. User selects Google account
4. System checks if email is pre-authorized
5. If authorized: Creates account or logs in
6. If not authorized: Shows error message

**Pre-Authorization System:**
- Admins maintain list of approved email addresses
- Each email has assigned role (admin or member)
- First sign-in creates account with assigned role
- Prevents unauthorized access even with valid Google account

### 2.2 User Roles & Permissions

#### Admin Role
**Capabilities:**
- Direct save: Changes apply immediately to live data
- Approve/reject: Review pending changes from members
- State override: Manually set affected states (FDA recalls)
- Queue management: Control email digest queues
- User management: Add authorized emails
- Data sync: Trigger manual synchronization

**Why This Matters:**
Admins have full control to ensure data quality and manage the platform. Their changes bypass the approval queue for rapid response to critical updates.

#### Member Role (Virtual Assistant)
**Capabilities:**
- Submit changes: All edits go to pending queue
- View all pending: See changes from all team members
- Edit pending: Modify any pending change before approval
- Withdraw own: Remove their pending changes
- Limited access: No access to admin dashboard

**Why This Matters:**
Members can contribute without risk of accidental damage. All changes are reviewed before going live, maintaining data integrity while allowing collaborative editing.

### 2.3 Internal Edit Page

#### Purpose
Central workspace for team members to search, review, and enhance recall data with better titles, images, and organization.

#### Search Interface (Enhanced)
**What It Does:**
Same as public search plus:
- Exclude pending changes automatically
- Advanced filtering options
- Show edit controls on cards

#### Advanced Filters
**Collapsible Section with:**

1. **"Show only recalls without images"**
   - Filters to recalls needing image uploads
   - Helps prioritize visual content addition
   
2. **USDA recalls toggle**
   - Show/hide USDA-sourced recalls
   - Default: On
   
3. **FDA recalls toggle**
   - Show/hide FDA-sourced recalls
   - Default: On
   
4. **Show Approved toggle**
   - Show/hide recalls already edited
   - Helps find untouched recalls
   - Default: On

5. **"Show FDA recalls with empty states" link**
   - Special filter for problematic FDA data
   - Finds recalls needing state assignment
   - Admin-only feature

**Expected Behavior:**
1. Clicking "Advanced options ▼" expands section
2. Toggles apply instantly (no reload)
3. Multiple filters work together
4. Result count updates in real-time

#### Editable Recall Cards
**Visual Indicators:**
- **Edit button**: Appears on hover
- **"Pending" badge**: Shows if changes submitted
- **"Approved" indicator**: Shows if previously edited

**Expected Behavior:**
1. Hover shows edit button
2. Click opens EditModal
3. Pending badge prevents duplicate edits
4. Cards update without page refresh after edit

### 2.4 Edit Modal

#### Purpose
Comprehensive interface for customizing how recalls display to users, managing images, and improving data quality.

#### Title Customization
**What It Does:**
- Override original government title
- Shows AI-enhanced title when available
- Preserves original for reference

**Title Hierarchy:**
1. Custom preview title (if set)
2. AI-enhanced title (if generated)
3. Original title (fallback)

**Expected Behavior:**
1. Text input for custom title
2. Placeholder shows current title
3. Empty field uses AI or original title
4. Changes preview in real-time

#### URL Override
**What It Does:**
- Replace or add recall webpage link
- Useful when USDA link is broken
- Changes button from "View Details" to "Visit Page"

**Expected Behavior:**
1. URL input field
2. Validation for proper URL format
3. Test button to verify link works
4. Empty field removes external link

#### Primary Image Selection
**What It Does:**
- Choose which image appears first
- Visual grid of all available images
- Click to set as primary

**Expected Behavior:**
1. Image grid shows all recall images
2. Current primary has checkmark badge
3. Click any image to make it primary
4. "-1" option removes primary (default order)

#### Image Upload System
**What It Does:**
- Add custom images to recalls
- Drag-and-drop or click to select
- Multiple file support
- Automatic optimization

**Upload Interface:**
1. **Drag Zone**
   - "Drag images here or click to select"
   - Visual feedback on hover
   - Accepts JPG, PNG, GIF, WebP

2. **File Selection**
   - Browse button opens file picker
   - Multi-select supported
   - 10MB limit per file
   - 10 files maximum per upload

3. **Preview Gallery**
   - Thumbnails of selected files
   - Remove button on each
   - File size indicator
   - Upload progress bars

**Expected Behavior:**
1. Files validate on selection
2. Invalid files show error message
3. Valid files show preview immediately
4. Upload starts on modal save
5. Progress indicator during upload
6. Uploaded images appear in main grid

#### States Override (FDA Admin Only)
**What It Does:**
- Manually specify affected states
- Overrides automatic parsing
- Fixes "empty states" problem

**Interface:**
1. **"Manage Affected States" button**
2. **State pills display**
   - Current states shown as removable pills
   - Click X to remove state
3. **Add state dropdown**
   - Autocomplete state selector
   - Add button to include state

**Expected Behavior:**
1. Only visible for FDA recalls + admin users
2. Changes persist through data syncs
3. Manual flag prevents automatic override
4. Affects email targeting immediately

#### Card Splitting
**What It Does:**
- Break multi-product recalls into separate cards
- Each split gets own title and primary image
- Improves readability for complex recalls

**Split Configuration:**
1. **"Add Split" button**
   - Creates new split section
   - Auto-calculates image ranges

2. **Split Controls**
   - Start image index selector
   - End image index selector  
   - Custom title for split
   - Primary image for split
   - Remove split button

3. **Preview Section**
   - Shows how cards will appear
   - Main card + split cards
   - Real-time updates

**Expected Behavior:**
1. Can only split if 2+ images exist
2. Splits cannot overlap ranges
3. Main card shows remaining images
4. Each split appears as separate card
5. All splits share same recall ID

#### Save Actions

##### Admin Save
**What Happens:**
1. Display data saves immediately
2. Images upload to Firebase Storage
3. Changes visible instantly on public site
4. No approval needed
5. Audit trail created with timestamp

**Button States:**
- "Save Changes" - Ready to save
- "Uploading..." - Images uploading
- "Saving..." - Writing to database
- "Saved!" - Success confirmation

##### Member Submit
**What Happens:**
1. Creates pending change record
2. Images upload to staging
3. Recall removed from edit list
4. Appears in pending queue
5. Email to admins (optional)

**Button States:**
- "Submit for Approval" - Ready
- "Uploading..." - Processing images
- "Submitting..." - Creating pending record
- "Submitted!" - Success confirmation

### 2.5 Pending Changes Workflow

#### Purpose
Quality control system ensuring all non-admin edits are reviewed before affecting live data.

#### Pending Changes Page (/internal/pending)

##### For Members
**What They See:**
- All pending changes from all users
- Edit capability for any pending change
- Withdraw option for own changes
- Collaborative environment

**Why Collaborative:**
Members can see and improve each other's work before admin review, reducing back-and-forth and improving efficiency.

**Expected Behavior:**
1. List shows all pending changes
2. Each shows: Proposer, date, recall title
3. Edit button opens change in EditModal
4. Edits overwrite previous pending change
5. Only one pending change per recall

##### For Admins (/internal/admin/pending)
**What They See:**
- Dedicated approval interface
- Before/after comparison
- Approve/reject buttons
- Bulk actions (future feature)

**Review Interface:**
1. **Card Layout**
   - Shows proposed version of recall
   - "Review" button on each
   
2. **Review Modal**
   - Before: Original recall display
   - Arrow pointing down
   - After: With proposed changes
   - Action buttons at bottom

3. **Actions**
   - **Approve**: Apply changes immediately
   - **Reject**: Delete pending change
   - **Edit**: Open in EditModal with changes pre-applied
   - **Close**: Return to list

**Expected Behavior:**
1. Click review opens comparison modal
2. Visual diff highlights changes
3. Approve updates live data instantly
4. Reject removes from queue
5. No rejection reason required
6. Page refreshes after action

#### Change Tracking
**What's Recorded:**
- Who proposed the change
- When it was proposed
- What was changed (before/after)
- Who approved/rejected
- When action was taken

**Overwrite Behavior:**
- Latest change overwrites previous
- Only one pending change per recall
- Previous proposer notified (future)

### 2.6 Email Dashboard

#### Purpose
Manage email digest system for sending recall alerts to subscribers, with both manual and automatic queue capabilities.

#### Three-Tab Interface

##### Manual Digest Tab
**What It Does:**
- Search and select specific recalls
- Create custom email digest
- Send to test or all subscribers
- Preview before sending

**Workflow:**
1. **Search Recalls**
   - Same interface as main edit page
   - Multi-select checkboxes
   - Selected count indicator

2. **Review Selection**
   - List of selected recalls
   - Remove individual items
   - Clear all button

3. **Preview Email**
   - Generate HTML preview
   - Desktop and mobile views
   - Edit subject line

4. **Send Options**
   - Test mode: Admin emails only
   - Production: All subscribers
   - Schedule for later (future)

**Expected Behavior:**
1. Search returns recalls with checkboxes
2. Selection persists across searches
3. Preview generates in ~2 seconds
4. Send confirmation required
5. Success/failure notification

##### Automatic Queues Tab
**What It Does:**
- Manage USDA daily and FDA weekly queues
- Review recalls before automatic send
- Manual override to send immediately
- Remove specific recalls from queue

**Queue Display:**
Each queue shows:
- Queue type (USDA Daily / FDA Weekly)
- Status (Pending/Processing/Sent)
- Recall count
- Scheduled send time
- Last updated timestamp

**Queue Actions:**
1. **Preview Queue**
   - Opens modal with recall list
   - Checkbox selection interface
   - Remove selected from queue
   - View as email preview

2. **Send Now**
   - Override schedule
   - Immediate dispatch
   - Confirmation required

3. **Cancel Queue**
   - Delete entire queue
   - Cannot be undone
   - Requires confirmation

**Expected Behavior:**
1. Queues auto-populate from sync services
2. USDA queues build throughout the day
3. FDA queues accumulate over the week
4. Preview shows actual email content
5. Sent queues disappear after 24 hours

##### Email History Tab
**What It Does:**
- View all sent digests
- Preview email content
- View analytics and metrics
- Track sending history

**History Table:**
| Date | Type | Recalls | Recipients | Sent By | Actions |
|------|------|---------|------------|---------|---------|
| Nov 15, 2024 | USDA Daily | 12 | 1,847 | System | Preview • Analytics |
| Nov 14, 2024 | Manual | 5 | 1,843 | John Admin | Preview • Analytics |

**Actions:**
- **Preview**: Opens modal showing exact email content that was sent
- **Analytics**: View delivery metrics and engagement stats

**Expected Behavior:**
1. History loads all past sends
2. Sorted by date (newest first)
3. Preview shows HTML email in modal
4. Analytics shows delivery statistics
5. Table updates after each new send

### 2.7 User Menu Navigation

#### Purpose
Compact navigation system showing user identity, role, and quick access to tools.

#### Hamburger Menu Design
**Visual:**
- Three horizontal lines icon
- User's initials or avatar (future)
- Notification badge for pending count

**Menu Contents:**
1. **Welcome Section**
   - "Welcome, [Username]"
   - Role badge (Admin/Member)

2. **Navigation Items**
   - Edit Recalls (default)
   - Pending Changes (with count)
   - Email Dashboard (admin only)
   - Admin Tools (admin only)

3. **Quick Actions** (Admin)
   - Sync USDA Data
   - Sync FDA Data
   - View Sync History

4. **Account Section**
   - Settings (future)
   - Help Documentation
   - Logout

**Expected Behavior:**
1. Click hamburger opens dropdown
2. Click outside closes menu
3. Current page highlighted
4. Pending count updates live
5. Role-specific items only

### 2.8 Data Quality Features

#### AI Title Enhancement
**What It Does:**
- Automatically improves recall titles
- Runs during data synchronization
- Uses OpenAI GPT-4 model
- Preserves original title

**How It Works:**
1. System identifies recalls without AI titles
2. Sends original title to AI service
3. AI returns consumer-friendly version
4. Both versions stored in database
5. UI prefers AI title when available

**Example Transformations:**
- Before: "CLASS I RECALL - FSIS-RC-094-2024"
- After: "Ground Beef Recalled for E. Coli Risk"

#### Duplicate Detection (Future)
**What It Does:**
- Identifies potential duplicate recalls
- Flags for manual review
- Prevents double-alerting users

### 2.9 Audit & Compliance

#### Activity Tracking
**What's Logged:**
- All login attempts
- Edit actions with timestamps
- Approval/rejection decisions
- Email sends
- Data synchronizations

**Where It's Stored:**
- User actions in display metadata
- System events in log files
- Email history in database

#### Data Retention
- Edit history: Indefinite
- Pending changes: 90 days after action
- Email history: 1 year
- User sessions: 7 days (internal), 30 days (public)

---

*End of Part 2: Internal Tools & Admin Features*

---

## Part 3: Backend Services & Data Processing

### 3.1 Data Synchronization Architecture

#### Purpose
Keep SafeCart's database continuously updated with the latest recall information from government sources while preserving custom enhancements and maintaining data integrity.

#### Two-Source Synchronization Strategy

##### USDA Data Sync
**What It Does:**
- Fetches recall data from USDA FSIS (Food Safety Inspection Service) API
- Runs automatically every 12 hours
- Processes last 60 days of recalls to catch updates
- Preserves all custom display data during updates

**Sync Process:**
1. **Fetch Phase**
   - Queries USDA API for recent recalls (60-day window)
   - Receives data in JSON format
   - Validates required fields

2. **Merge Phase**
   - Checks if recall already exists in database
   - New recalls: Creates complete record
   - Existing recalls: Updates only government fields
   - Preserves: Display settings, AI titles, uploaded images

3. **Queue Phase**
   - New recalls added to daily email queue
   - Marked for AI title enhancement
   - Flagged for image processing

**Data Fields Updated:**
- Recall number and status
- Risk level and classification
- Product descriptions
- Company information
- Distribution states
- Dates (recall, termination)

**Data Fields Preserved:**
- Custom preview titles
- Primary image selections
- Card split configurations
- Uploaded images
- Approval metadata

##### FDA Data Sync
**What It Does:**
- Fetches from OpenFDA API
- Runs daily at 3 AM Eastern Time
- Processes last 60 days by default
- Handles more complex state parsing

**FDA-Specific Challenges:**
1. **State Parsing**
   - Distribution patterns often text descriptions
   - "Nationwide" vs specific state lists
   - Manual override system for admins

2. **Date Format Conversion**
   - FDA uses YYYYMMDD format
   - System converts to YYYY-MM-DD
   - Ensures consistency across sources

**Sync Frequency:**
- USDA: Every 12 hours (more frequent due to higher volume)
- FDA: Daily at 3 AM ET (lower volume, less urgent)
- Manual: Available anytime via admin menu

### 3.2 Image Processing Pipeline

#### Purpose
Automatically extract, process, and store product label images from recall notices to help consumers visually identify affected products.

#### Image Discovery System
**What It Does:**
- Scans recall summaries for image links
- Handles PDFs, JPGs, PNGs, and other formats
- Converts multi-page PDFs to individual images
- Optimizes for web display

**URL Pattern Detection:**
The system looks for:
1. Links containing "label" or "labels"
2. "View label" or "View labels" links
3. PDF files in recall summaries
4. Links with text "here" pointing to PDFs
5. Product list links

**Processing Steps:**

##### Step 1: Extraction
```
Recall Summary HTML → Parse for URLs → Filter for images/PDFs
```

##### Step 2: Download
```
Fetch from USDA/FDA → Save to temp folder → Validate file type
```

##### Step 3: Conversion
**For PDFs:**
- Split into individual pages
- Convert each page to JPG
- Maintain page order
- Skip blank pages

**For Images:**
- Validate format
- Check dimensions
- Prepare for optimization

##### Step 4: Optimization
- Resize to max 1200px width
- Compress to ~85% quality
- Convert to progressive JPEG
- Reduce file size by ~60-70%

##### Step 5: Storage
- Upload to Firebase Storage
- Generate public URLs
- Update recall record
- Clean temp files

**Error Handling:**
- Failed downloads logged but don't stop processing
- Corrupted PDFs marked as errors
- Network timeouts retry 3 times
- Missing ImageMagick falls back to basic processing

#### Batch Processing
**What It Runs:**
- Processes up to 100 recalls at a time
- Runs after each sync cycle
- Can be triggered manually
- Tracks processing status

**Performance Metrics:**
- Average: 2-3 seconds per recall
- PDF conversion: 5-10 seconds per document
- Total images stored: ~50,000+
- Storage used: ~15GB

### 3.3 AI-Powered Enhancements

#### Purpose
Transform technical government recall titles into consumer-friendly descriptions that are easier to understand and search.

#### OpenAI Integration
**What It Does:**
- Uses GPT-4o model
- Processes new recalls automatically
- Limits to 50 per sync cycle (cost management)
- Preserves original title always

**Enhancement Process:**

##### Input Example:
```
"CLASS I RECALL - RTE MEAT AND POULTRY TAQUITO PRODUCTS 
FSIS-RC-094-2024 EST. 17523"
```

##### AI Processing:
1. Extracts product type
2. Identifies brand if present
3. Simplifies risk language
4. Removes technical codes

##### Output Example:
```
"Meat and Poultry Taquitos Recalled for Possible Contamination"
```

**Quality Controls:**
- AI titles never replace originals
- Manual override always available
- Admins can edit AI suggestions
- Failed processing doesn't block recall

**Processing Rules:**
- Only process recalls without AI titles
- Skip if custom title already set
- Maximum 50 per batch
- Run asynchronously (non-blocking)

### 3.4 Email Notification System

#### Purpose
Proactively alert subscribers about new recalls affecting their area through automated email digests.

#### Email Service Architecture
**Provider:** Mailchimp Transactional (formerly Mandrill)

**Why Mailchimp:**
- High deliverability rates
- Detailed analytics
- Template support
- Webhook tracking
- Cost-effective at scale

#### Queue Management System

##### USDA Daily Queue
**What It Does:**
- Collects new USDA recalls throughout the day
- Named by date: `USDA_DAILY_YYYY-MM-DD`
- Sends automatically at 10 AM ET
- Typically contains 5-15 recalls

**Queue Building:**
1. Each sync adds new recalls to today's queue
2. Duplicates automatically prevented
3. Queue persists until sent
4. Failed sends can be retried

##### FDA Weekly Queue
**What It Does:**
- Accumulates FDA recalls over the week
- Named by Monday's date: `FDA_WEEKLY_YYYY-MM-DD`
- Sends Fridays at 10 AM ET
- Usually contains 10-30 recalls

**Why Different Frequencies:**
- USDA has higher daily volume
- FDA recalls less time-sensitive
- Reduces email fatigue
- Matches government release patterns

#### Email Personalization
**State-Based Filtering:**
Each subscriber receives only recalls affecting:
1. Their selected states
2. Nationwide recalls
3. Multi-state recalls including theirs

**Example:**
- User subscribed to: California, Nevada
- Recall affects: California, Oregon, Washington
- User receives: Yes (California match)

#### Email Template System
**React Email Components:**
- Modern HTML email generation
- Mobile-responsive design
- Gmail-compatible tables
- Consistent branding

**Email Sections:**
1. **Header**
   - SafeCart logo
   - Date and digest type
   
2. **Summary**
   - Total recall count
   - Risk level breakdown
   
3. **Recall Cards**
   - Product image (if available)
   - Enhanced title
   - Company name
   - Risk level
   - View Details button

4. **Footer**
   - Unsubscribe link
   - Preference management
   - Contact information

### 3.5 Automated Scheduling

#### Purpose
Ensure all data processing and notifications happen automatically without manual intervention.

#### Cron Job Configuration

##### USDA Sync Schedule
```
Every 12 hours (0:00 and 12:00 UTC)
```
**What Runs:**
1. Fetch recent recalls from API
2. Update Firebase database
3. Queue new recalls for email
4. Trigger image processing
5. Request AI title enhancement

##### FDA Sync Schedule
```
Daily at 3:00 AM ET
```
**What Runs:**
1. Fetch last 60 days from OpenFDA
2. Merge with existing data
3. Add to weekly queue
4. Process new images

##### Email Send Schedule
```
USDA: Daily at 10:00 AM ET
FDA: Fridays at 10:00 AM ET
```
**What Happens:**
1. Check if queue has recalls
2. Get subscriber list by state
3. Generate personalized emails
4. Send via Mailchimp
5. Log to email history
6. Clear sent queue

#### Manual Overrides
**Available Actions:**
- Trigger immediate sync
- Send queue now
- Cancel scheduled send
- Process specific date range
- Reprocess failed items

### 3.6 Database Operations

#### Purpose
Efficiently manage large volumes of recall data while maintaining performance and data integrity.

#### Firebase Firestore Structure

##### Collections Architecture
```
/recalls              → USDA recall documents
/fda_recalls          → FDA recall documents  
/users                → Internal team accounts
/user_emails          → Public subscribers
/pending_changes      → Unapproved edits
/email_queues         → Daily/weekly queues
/email_digests        → Send history
/authorized_emails    → Pre-approved users
```

##### Document ID Strategy
**USDA Format:** Auto-generated Firebase IDs
**FDA Format:** `{recall_number}_{event_id}`

**Why Different:**
- USDA lacks consistent unique identifiers
- FDA has recall_number + event_id combination
- Prevents duplicate FDA entries
- Allows USDA flexibility

#### Batch Operations
**Firestore Limits:**
- 500 documents per batch write
- 1 write per second per document
- 10MB per batch operation

**System Handling:**
```javascript
For 2000 recalls to save:
→ Split into 4 batches of 500
→ Execute batches sequentially
→ Commit all or rollback on error
```

#### Data Preservation Strategy
**During Updates:**
1. Fetch existing document
2. Extract custom fields (display, etc.)
3. Update government fields only
4. Merge and save
5. Maintain edit history

**Protected Fields:**
Never overwritten by sync:
- `display` object
- `llmTitle` 
- `manualStatesOverride`
- `approvedBy` metadata
- Upload history

### 3.7 Performance & Monitoring

#### System Metrics
**Current Performance:**
- USDA sync: ~30 seconds for 60 days
- FDA sync: ~45 seconds for 60 days
- Image processing: 100 recalls in ~5 minutes
- Email generation: 1000 emails in ~10 seconds
- Database queries: <100ms average

#### Resource Usage
**Storage:**
- Database: ~500MB (text data)
- Images: ~15GB (50,000+ files)
- Temp files: Auto-cleaned after 24 hours

**API Limits:**
- USDA: No documented limits
- FDA: 1000 records per request max
- OpenAI: 50 requests per sync
- Mailchimp: 10 million emails/month

#### Error Recovery
**Automatic Retries:**
- Network failures: 3 attempts
- Image downloads: 3 attempts
- API timeouts: Exponential backoff
- Database writes: Transaction rollback

**Manual Recovery:**
- Failed sync: Run manual sync
- Missing images: Reprocess command
- Failed emails: Resend from history
- Corrupted data: Restore from backups

#### Monitoring Points
**What's Logged:**
- All sync operations with timing
- Failed image downloads
- AI processing results
- Email send confirmations
- Error details with stack traces

**Alert Conditions:**
- Sync fails 3 times consecutively
- Email queue fails to send
- Database connection lost
- Storage quota exceeded
- API rate limits hit

---

*End of Part 3: Backend Services & Data Processing*

---

## Part 4: Technical Infrastructure & Support Systems

### 4.1 System Architecture Overview

#### Purpose
Provide a scalable, secure, and maintainable infrastructure that supports millions of users while keeping operational costs manageable.

#### Architecture Design
**Deployment Model:** Serverless/Managed Services

**Frontend:**
- Platform: Vercel (Next.js hosting)
- CDN: Vercel Edge Network
- Domain: safecart.vercel.app

**Backend:**
- Platform: Google Cloud Run
- Container: Docker with Node.js
- Region: US Central
- Auto-scaling: 1-100 instances

**Database & Storage:**
- Database: Firebase Firestore
- File Storage: Firebase Storage
- Cache: In-memory (future: Redis)
- Backups: Daily automatic

**Third-Party Services:**
- Email: Mailchimp Transactional
- AI: OpenAI API
- Analytics: Google Analytics (future)
- Monitoring: Google Cloud Monitoring

### 4.2 Security Implementation

#### Purpose
Protect user data, prevent unauthorized access, and maintain system integrity against common web threats.

#### Authentication Security

##### Password Protection
**Implementation:**
- Bcrypt hashing with salt rounds (10)
- Minimum 6 characters required
- No maximum length restriction
- Password never stored in plain text
- No password in API responses

##### JWT Token Security
**Configuration:**
- Algorithm: HS256
- Secret: Environment variable (32+ characters)
- Expiration: 7 days (internal), 30 days (public)
- Storage: httpOnly cookies only
- No localStorage/sessionStorage

**Token Payload:**
```json
{
  "uid": "user-id",
  "email": "user@example.com",
  "role": "admin",
  "type": "internal",
  "iat": 1234567890,
  "exp": 1234567890
}
```

##### Cookie Security
**Settings:**
- httpOnly: true (prevents XSS attacks)
- secure: true (HTTPS only in production)
- sameSite: "none" (cross-origin support)
- path: "/" (site-wide access)

#### Data Protection

##### Input Validation
**What's Validated:**
- Email format checking
- State code verification
- Date range logic
- File type validation
- URL format checking

**SQL Injection Prevention:**
- Firestore parameterized queries only
- No raw SQL execution
- Input sanitization for all text fields

##### File Upload Security
**Restrictions:**
- Image files only (JPG, PNG, GIF, WebP)
- 10MB maximum per file
- 10 files maximum per upload
- Filename sanitization
- MIME type verification

**Storage Rules:**
```
allow read: if true;  // Public read
allow write: if request.auth != null;  // Authenticated write
```

#### API Security

##### CORS Configuration
**Allowed Origins:**
- https://localhost:3000 (development)
- https://safecart.vercel.app (production)
- Custom domain from environment

**Credentials:** Enabled for cookie support

##### Rate Limiting (Future)
**Planned Limits:**
- Authentication: 5 attempts per minute
- API calls: 100 per minute per user
- File uploads: 10 per hour
- Email sends: 1000 per day

### 4.3 Development Environment

#### Purpose
Enable developers to run and test SafeCart locally with minimal setup while maintaining consistency with production.

#### Local Development Setup

##### Prerequisites
**Required Software:**
1. Node.js 20+ and npm
2. Git for version control
3. VS Code or preferred IDE
4. Firebase CLI tools
5. Docker (optional)

##### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
# Server starts on http://localhost:3001
```

##### Frontend Setup
```bash
cd frontend
npm install
# For HTTPS (required for Google OAuth):
mkcert -install
mkcert localhost 127.0.0.1 ::1
npm run dev
# App starts on https://localhost:3000
```

#### Environment Variables

##### Backend Requirements
```
# Firebase Admin SDK
FIREBASE_PROJECT_ID=safecart-930e5
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
FIREBASE_STORAGE_BUCKET=safecart-930e5.firebasestorage.app

# Authentication
JWT_SECRET=your-32-character-secret-key

# External Services
GOOGLE_CLIENT_ID=your-google-oauth-client-id
OPENAI_API_KEY=sk-proj-...
MAILCHIMP_API_KEY=your-mailchimp-key

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=https://localhost:3000
```

##### Frontend Requirements
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_GOOGLE_CLIENT_ID=same-as-backend
```

#### Development Tools

##### Available Scripts
**Backend:**
- `npm run dev` - Start with hot reload
- `npm run build` - Compile TypeScript
- `npm run typecheck` - Check types
- `npm run email:dev` - Email template preview

**Frontend:**
- `npm run dev` - Start with HTTPS
- `npm run dev:http` - Start without HTTPS
- `npm run build` - Production build
- `npm run lint` - Code linting

### 4.4 Deployment Process

#### Purpose
Deploy updates safely and efficiently with zero downtime and rollback capability.

#### Frontend Deployment (Vercel)

##### Automatic Deployment
**GitHub Integration:**
1. Push to main branch
2. Vercel detects changes
3. Builds automatically
4. Deploys to production
5. Previous version kept for rollback

**Build Settings:**
```yaml
Framework: Next.js
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

##### Environment Setup
**Production Variables:**
- Set in Vercel dashboard
- Encrypted at rest
- Available during build
- Not exposed to client (except NEXT_PUBLIC_*)

#### Backend Deployment (Google Cloud Run)

##### Docker Deployment
```bash
# Build image
docker build -t safecart-backend .

# Tag for Google Cloud
docker tag safecart-backend gcr.io/PROJECT_ID/safecart-backend

# Push to registry
docker push gcr.io/PROJECT_ID/safecart-backend

# Deploy to Cloud Run
gcloud run deploy safecart-backend \
  --image gcr.io/PROJECT_ID/safecart-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

##### Configuration
**Cloud Run Settings:**
- Memory: 512MB minimum
- CPU: 1 vCPU
- Min instances: 1 (avoid cold starts)
- Max instances: 100
- Timeout: 300 seconds
- Port: 3001

**Environment Variables:**
- Set in Cloud Run console
- Stored securely
- Available at runtime
- Can be updated without rebuild

### 4.5 Database Management

#### Purpose
Maintain data integrity, enable recovery, and provide efficient access to recall information.

#### Firestore Configuration

##### Database Settings
**Location:** us-central1
**Mode:** Native mode (not Datastore mode)
**Security:** Firebase Admin SDK only

##### Indexes
**Composite Indexes Created:**
```
Collection: recalls
- field_recall_date (DESC) + langcode (ASC)
- affectedStatesArray (ARRAY) + field_recall_date (DESC)
- isActive (ASC) + field_recall_date (DESC)

Collection: fda_recalls
- report_date (DESC) + status (ASC)
- affectedStatesArray (ARRAY) + report_date (DESC)
```

##### Backup Strategy
**Automatic Backups:**
- Frequency: Daily at 2 AM ET
- Retention: 30 days
- Location: Google Cloud Storage
- Cost: ~$5/month

**Manual Backup Command:**
```bash
gcloud firestore export gs://safecart-backups/$(date +%Y%m%d)
```

**Restore Process:**
```bash
gcloud firestore import gs://safecart-backups/20240315
```

#### Data Migration

##### Schema Updates
**Safe Migration Process:**
1. Add new fields (non-breaking)
2. Deploy code to read both formats
3. Run migration script
4. Update code to use new format
5. Remove old field support

**Example Migration Script:**
```javascript
// Add llmTitle to all recalls without it
const batch = db.batch();
recalls.forEach(recall => {
  if (!recall.llmTitle) {
    batch.update(docRef, { 
      llmTitle: null,
      needsAIProcessing: true 
    });
  }
});
await batch.commit();
```

### 4.6 Monitoring & Logging

#### Purpose
Track system health, identify issues quickly, and maintain audit trails for compliance and debugging.

#### Application Logging

##### Winston Logger Configuration
**Log Levels:**
- Error: System failures
- Warning: Degraded performance
- Info: Normal operations
- Debug: Development details

**Log Format:**
```
[2024-03-15 10:30:45] [INFO] USDA sync completed in 28492ms
[2024-03-15 10:31:02] [ERROR] Failed to process image: Network timeout
```

##### What's Logged
**System Events:**
- Server start/stop
- Sync operations
- Email sends
- Authentication attempts
- API calls

**Error Details:**
- Stack traces
- Request context
- User information (no passwords)
- Timestamp and severity

#### Performance Monitoring

##### Key Metrics Tracked
**Response Times:**
- API endpoint latency
- Database query duration
- External service calls
- Image processing time

**Resource Usage:**
- Memory consumption
- CPU utilization
- Storage growth rate
- API call volumes

##### Health Checks
**Endpoint:** GET /health
```json
{
  "status": "ok",
  "timestamp": "2024-03-15T10:30:45Z",
  "environment": "production",
  "version": "1.0.0"
}
```

**Monitoring Frequency:**
- External: Every 60 seconds
- Internal: Every 10 seconds
- Alerts: After 3 consecutive failures

### 4.7 Cost Management

#### Purpose
Keep operational costs predictable and sustainable while maintaining service quality.

#### Current Monthly Costs (Estimated)

##### Infrastructure
| Service | Usage | Cost |
|---------|-------|------|
| Vercel Hosting | ~2M requests | Free tier |
| Google Cloud Run | ~500 hours | ~$25 |
| Firebase Firestore | 500MB, 5M reads | ~$30 |
| Firebase Storage | 15GB images | ~$3 |
| **Subtotal** | | **~$58** |

##### External Services
| Service | Usage | Cost |
|---------|-------|------|
| Mailchimp | 50K emails | ~$20 |
| OpenAI GPT-4 | 1500 requests | ~$15 |
| Domain | Annual / 12 | ~$1 |
| **Subtotal** | | **~$36** |

**Total Monthly: ~$94**

#### Cost Optimization Strategies

##### Current Optimizations
1. **Image Compression:** 60-70% size reduction
2. **Batch Processing:** Reduces API calls
3. **Caching:** Minimizes database reads
4. **Scheduled Syncs:** Off-peak processing

##### Future Optimizations
1. **CDN for Images:** CloudFlare free tier
2. **Redis Cache:** Reduce database queries
3. **Reserved Instances:** Cloud Run discounts
4. **Email Templates:** Reduce generation costs

### 4.8 Disaster Recovery

#### Purpose
Ensure business continuity and data protection in case of system failures or data loss.

#### Recovery Objectives
**RTO (Recovery Time Objective):** 4 hours
**RPO (Recovery Point Objective):** 24 hours

#### Backup Systems

##### Data Backups
**What's Backed Up:**
- All Firestore collections
- User uploaded images
- Configuration files
- Email templates

**Backup Locations:**
- Primary: Google Cloud Storage (same region)
- Secondary: Different region bucket
- Critical: Downloaded monthly to local

##### Recovery Procedures

**Database Corruption:**
1. Stop write operations
2. Identify corruption extent
3. Restore from latest backup
4. Replay transaction logs
5. Verify data integrity

**Service Outage:**
1. **Frontend Down:** Vercel auto-failover
2. **Backend Down:** Cloud Run auto-restart
3. **Database Down:** Firebase handles automatically
4. **Complete Failure:** Switch to backup region

#### Incident Response

##### Response Team
**Primary:** Technical lead
**Secondary:** Backend developer
**Escalation:** Project owner

##### Response Process
1. **Detect:** Monitoring alerts trigger
2. **Assess:** Determine severity and scope
3. **Contain:** Prevent further damage
4. **Resolve:** Fix immediate issue
5. **Review:** Post-mortem analysis

### 4.9 Maintenance Procedures

#### Purpose
Keep the system running smoothly with regular maintenance while minimizing disruption to users.

#### Regular Maintenance Tasks

##### Daily Tasks
- Review error logs
- Check sync status
- Monitor email queues
- Verify backups completed

##### Weekly Tasks
- Review pending changes
- Clean temp storage
- Check API usage
- Update dependencies (dev only)

##### Monthly Tasks
- Analyze performance metrics
- Review security logs
- Audit user access
- Download critical backups
- Clean old email history

#### Update Procedures

##### Zero-Downtime Updates
**Frontend:**
1. Deploy to preview URL
2. Test functionality
3. Promote to production
4. Previous version available instantly

**Backend:**
1. Deploy new version
2. Cloud Run routes gradually
3. Monitor for errors
4. Rollback if needed

##### Database Migrations
**Safe Migration Steps:**
1. Backup current data
2. Test on staging copy
3. Run during low traffic
4. Verify completion
5. Update application code

### 4.10 Future Scalability

#### Purpose
Design decisions that allow SafeCart to grow from thousands to millions of users without major rewrites.

#### Scaling Strategies

##### Horizontal Scaling
**Current Capability:**
- Frontend: Unlimited via CDN
- Backend: 1-100 instances auto-scaling
- Database: 10,000 writes/second capacity

**Future Needs:**
- Microservices architecture
- Message queue system
- Distributed caching
- Read replicas

##### Performance Optimization

**Current Optimizations:**
- Lazy loading images
- Progressive web app
- Batch API calls
- Indexed queries

**Planned Improvements:**
- Server-side rendering
- GraphQL API
- WebSocket updates
- Edge computing

#### Growth Projections

##### User Growth Scenarios
**Conservative (Year 1):**
- 10,000 registered users
- 100,000 monthly visitors
- 500 daily email subscribers

**Moderate (Year 2):**
- 100,000 registered users
- 1M monthly visitors
- 5,000 daily email subscribers

**Aggressive (Year 3):**
- 1M registered users
- 10M monthly visitors
- 50,000 daily email subscribers

##### Infrastructure Scaling
**At Each Level:**

**Conservative:** Current architecture sufficient

**Moderate:** 
- Add Redis caching
- Upgrade Cloud Run memory
- Implement CDN for images

**Aggressive:**
- Multiple regions
- Dedicated database clusters
- Custom email infrastructure
- Full microservices migration

---

*End of Part 4: Technical Infrastructure & Support Systems*

---

## Document Summary

This Product Requirements Document comprehensively covers all aspects of the SafeCart platform:

**Part 1:** Detailed the public-facing features including search, filtering, and recall display \
**Part 2:** Explained internal tools, authentication, and content management systems \
**Part 3:** Documented backend services, data processing, and automation \
**Part 4:** Covered infrastructure, security, deployment, and scalability

The platform successfully addresses the core problem of making food recall information accessible and actionable for consumers while providing robust tools for internal management and scalability for future growth.

---

*Document Version: 1.0*
*Last Updated: August 2025*
*Total Sections: 4*
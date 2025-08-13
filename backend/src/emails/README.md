# SafeCart Email Templates

This directory contains all email templates for SafeCart's notification system.

## 📧 Email Templates

### 1. **RecallDigest.tsx**
Daily digest email sent to subscribers with recalls for their selected states.
- Shows recall cards with images, titles, dates, and descriptions
- Handles empty state (no recalls) with positive messaging
- Includes test email variant with special header

### 2. **WelcomeEmail.tsx**
Welcome email sent to new subscribers after registration.
- Confirms subscription details and selected states
- Explains SafeCart service and features
- Shows delivery schedule preferences
- Includes helpful tips and support information

### 3. **BaseLayout.tsx**
Base layout component providing consistent structure for all emails.
- SafeCart header with logo
- Footer with links and unsubscribe option
- Responsive design for all email clients

### 4. **RecallCard.tsx**
Individual recall card component matching website design.
- Uses exact same styling as website for consistency
- Light theme colors from theme.ts
- Clean, minimalist design with focus on readability

## 🚀 How to Preview Email Templates

### Start the Preview Server

1. Open terminal in the backend directory
2. Run the following command:

```bash
npm run email:dev
```

3. The preview server will start at: **http://localhost:3002**

### What You'll See

The preview server shows:
- **List of all email templates** on the left sidebar
- **Live preview** in the center
- **Code view** to see the React component
- **HTML output** to see the final rendered HTML
- **Different preview variants** for each template

### Available Preview Variants

#### Recall Digest
- **Default**: Standard daily digest with 3 sample recalls
- **Test Email**: Shows test email banner and formatting
- **Empty State**: No recalls found (positive messaging)

#### Welcome Email
- **Default**: Single state subscription
- **Multi-State**: Multiple states selected
- **Weekend Only**: Weekend-only schedule

## 🎨 Customization

### Colors
All colors are from `frontend/src/styles/theme.ts` (light theme):
- Primary: `#15803d` (green)
- Background: `#faf6ed` (cream)
- Card Background: `#fffffc` (white)
- Text: `#111827` (dark gray)
- Text Secondary: `#374151` (medium gray)

### To Make Changes

1. Edit the `.tsx` files directly
2. The preview server will hot-reload automatically
3. Test in different email clients using the "Send test email" feature

### Design Principles

- **Consistency**: Match website design exactly
- **Simplicity**: Clean, uncluttered layout
- **Accessibility**: High contrast, readable fonts
- **Mobile-first**: Works on all devices
- **Email client compatibility**: Tested in Gmail, Outlook, Apple Mail

## 📝 Notes

- Email templates use React Email components for better compatibility
- Inline styles are required for email clients
- Images should be hosted (not local files)
- Keep total email size under 102KB for Gmail clipping prevention
- Test in multiple email clients before production use

## 🧪 Testing

To send a test email to yourself:

1. Make sure your backend server is running
2. Create a user account and subscribe to notifications
3. Use the "Send Test Email" endpoint:

```bash
POST /api/user/preferences/send-test-email
```

This will send a real email using your configured email provider (Resend).
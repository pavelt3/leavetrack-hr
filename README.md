# LeaveTrack HR Platform

## Quick Start

### Requirements
- Node.js v20 or newer (https://nodejs.org)

### Run in production

```bash
# 1. Install dependencies (first time only)
npm install --production

# 2. Start the server
node dist/index.cjs
```

The app runs on http://localhost:5000

### Default admin login
- Email: admin@company.com
- Password: admin123
(Change this immediately in Settings after first login)

### Environment variables (optional)
Create a .env file or set these before starting:

```
PORT=5000                          # Change port if needed
SESSION_SECRET=your_secret_here    # Random string for session security
APP_URL=https://your-domain.com    # Your public URL (for invite links in emails)

# Email (SMTP) - leave blank to use test mode
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@email.com
SMTP_PASS=yourpassword
SMTP_FROM="LeaveTrack HR" <hr@yourcompany.com>
```

### Deploy on Railway (free tier)
1. Sign up at https://railway.app
2. New Project → Deploy from GitHub (or upload this folder)
3. Set environment variables in Railway dashboard
4. Railway gives you a public HTTPS URL automatically

### Data
All data is stored in `hr_platform.db` (SQLite file) in the same folder.
Back this file up regularly.

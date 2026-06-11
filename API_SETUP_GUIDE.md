# 📋 PropReach — Complete API Setup Guide

This is a step-by-step walkthrough to set up all the APIs needed for PropReach. Follow each step in order. Total setup time: ~30 minutes.

---

## Step 1: Create a Meta Developer Account

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **Get Started** and log in with your Facebook account
3. Complete the registration if you haven't already
4. Accept the Meta Platform Terms

> **💡 Tip:** Use the Facebook account connected to your business. This is important for accessing your WhatsApp Business Account later.

---

## Step 2: Create a Meta Business App

1. In the [Meta Developer Dashboard](https://developers.facebook.com/apps/), click **Create App**
2. Choose **Other** for use case, then click **Next**
3. Select **Business** as the app type
4. Fill in:
   - **App Name**: `PropReach` (or any name)
   - **App Contact Email**: your email
   - **Business Account**: select your business account (or create one)
5. Click **Create App**

---

## Step 3: Add WhatsApp to Your App

1. In your app dashboard, scroll to **Add Products to Your App**
2. Find **WhatsApp** and click **Set up**
3. You'll be taken to the WhatsApp Getting Started page
4. This gives you a **test phone number** and a **Phone Number ID**

### Get Your IDs

| What | Where to Find | Example |
|------|--------------|---------|
| **Phone Number ID** | WhatsApp → API Setup → Phone number ID | `109876543210987` |
| **WhatsApp Business Account ID (WABA ID)** | WhatsApp → API Setup → WhatsApp Business Account ID | `123456789012345` |
| **Temporary Access Token** | WhatsApp → API Setup → Temporary access token | `EAAG...` |

> ⚠️ The temporary token expires in 24 hours. You'll create a permanent one in Step 5.

---

## Step 4: Register a Real Phone Number (Optional but Recommended)

The test number Meta provides can only send messages to numbers you manually add. For production:

1. Go to **WhatsApp** → **API Setup** → **Step 5: Add a phone number**
2. Click **Add phone number**
3. Enter a phone number NOT currently registered on WhatsApp
4. Verify via SMS or voice call
5. Display name review takes 1-3 business days

> **📱 Tip:** Use a dedicated number for the business. Don't use your personal WhatsApp number.

---

## Step 5: Generate a Permanent Access Token

Temporary tokens expire in 24 hours. You need a permanent one:

1. Go to [Meta Business Manager](https://business.facebook.com) → **Settings** (gear icon)
2. Navigate to **Users** → **System Users**
3. Click **Add** to create a new system user:
   - Name: `PropReach API`
   - Role: **Admin**
4. Click **Add Assets** → **Apps** → select your app → check **Full Control** → **Save**
5. Click **Generate New Token**:
   - Select your app
   - Choose token expiration: **Never** (or 60 days)
   - Select permissions:
     - ✅ `whatsapp_business_messaging`
     - ✅ `whatsapp_business_management`
   - Click **Generate Token**
6. **Copy this token immediately** — you won't see it again!

> 🔒 This token is a secret. Never share it, commit it to git, or put it in frontend code.

---

## Step 6: Get Your Meta App Secret

The App Secret is needed for webhook signature verification:

1. Go to your [app dashboard](https://developers.facebook.com/apps/)
2. Click on your app
3. Go to **Settings** → **Basic**
4. Click **Show** next to **App Secret**
5. Copy the App Secret

---

## Step 7: Create Message Templates

You can only send pre-approved templates to contacts (WhatsApp policy):

1. Go to [Meta Business Manager](https://business.facebook.com)
2. Navigate to **WhatsApp Manager** → **Message Templates**
3. Click **Create Template**
4. Choose **Category**: Marketing / Utility / Authentication
5. Enter **Template Name** (e.g., `property_launch_invite`)
6. Select **Language**: English
7. Write your template body with variables:
   ```
   Hi {{1}}, we're excited to invite you to our new property launch at {{2}}.
   Starting price: {{3}}. Reply YES to book a site visit!
   ```
8. Submit for approval (usually takes 1-24 hours)

### Template Tips:
- Use `{{1}}`, `{{2}}`, etc. for variables (these get mapped to contact fields in PropReach)
- Keep messages professional and compliant with WhatsApp's commerce policy
- Marketing templates take longer to approve — submit them early
- You need at least one APPROVED template before you can send campaigns

---

## Step 8: Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create an account
2. Click **New Project**:
   - **Name**: `propreach`
   - **Database Password**: generate and save a strong password
   - **Region**: choose the closest to your users
3. Wait for the project to be created (~2 minutes)
4. Go to **SQL Editor** → click **New Query**
5. Paste the entire contents of `schema.sql` from this repo
6. Click **Run**
7. Go to **Database** → **Replication** → toggle on Realtime for the `replies` table

### Copy Your Keys:

Go to **Settings** → **API** and copy:

| Key | What It's For |
|-----|--------------|
| **Project URL** | Both backend and frontend |
| **`anon` public key** | Frontend only (for Realtime) |
| **`service_role` key** | Backend only (full DB access) |

> ⚠️ The `service_role` key bypasses Row Level Security. Only use it in the backend, never expose it in frontend code.

---

## Step 9: Deploy Backend to Railway

1. Push the PropReach repo to GitHub (or fork it)
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub Repo**
3. Select your repo
4. Set **Root Directory** to `backend`
5. Go to **Variables** tab and add:

```
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_KEY=your-service-role-key-here
API_SECRET_KEY=generate-a-long-random-string
WEBHOOK_VERIFY_TOKEN=your-verify-token
META_APP_SECRET=your-app-secret-from-step-6
FRONTEND_URL=*
```

6. Railway will auto-detect `requirements.txt` and deploy
7. Go to **Settings** → **Networking** → **Generate Domain**
8. Copy your public Railway URL (e.g., `https://propreach-production.up.railway.app`)

> 💡 Generate the `API_SECRET_KEY` with: `openssl rand -hex 32`

---

## Step 10: Configure Meta Webhook

This connects WhatsApp to your backend so you receive replies and delivery updates:

1. Go to [developers.facebook.com](https://developers.facebook.com) → your app
2. Navigate to **WhatsApp** → **Configuration**
3. Under **Webhook**, click **Edit**
4. Enter:
   - **Callback URL**: `https://YOUR-RAILWAY-URL/webhook/whatsapp`
   - **Verify Token**: same value as `WEBHOOK_VERIFY_TOKEN` in Railway
5. Click **Verify and Save**
6. Under **Webhook Fields**, subscribe to:
   - ✅ `messages`
   - ✅ `message_template_status_update`
7. Click **Done**

If verification fails, check:
- Railway app is deployed and running (visit your Railway URL — should show `{"status": "healthy"}`)
- Verify token matches exactly between Meta and Railway env var
- URL ends with `/webhook/whatsapp` (no trailing slash)

---

## Step 11: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → **Import Git Repository**
2. Select your repo
3. Set **Root Directory** to `frontend`
4. Set **Framework Preset** to **Vite**
5. Add environment variables:

```
VITE_BACKEND_URL=https://YOUR-RAILWAY-URL
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_KEY=same-as-API_SECRET_KEY-in-railway
```

6. Click **Deploy**
7. Copy your Vercel URL

### Update Railway CORS:
Go back to Railway → Variables → update `FRONTEND_URL` to your Vercel URL → Redeploy.

---

## Step 12: First Launch — Enter API Credentials

1. Open your Vercel URL on your phone
2. Tap **Settings** in the bottom nav
3. Enter:
   - **WABA ID**: from Step 3
   - **Phone Number ID**: from Step 3
   - **Access Token**: the permanent token from Step 5
   - **Webhook Verify Token**: same as Railway env var
4. Tap **Save Credentials**
5. Tap **Test Connection**
6. You should see ✅ **Connected!** with your business account name

> 🎉 **That's it! Your credentials are saved in the database. You'll never need to enter them again.**

---

## Step 13: Install as Mobile App

### iPhone:
1. Open the Vercel URL in **Safari**
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add**

### Android:
1. Open the Vercel URL in **Chrome**
2. Tap the **three-dot menu** (⋮)
3. Tap **Add to Home Screen** or **Install App**
4. Tap **Add**

The app now opens in full-screen mode like a native app!

---

## 🔧 Troubleshooting

### "Webhook verification failed"
- Make sure the `WEBHOOK_VERIFY_TOKEN` in Railway matches exactly what you entered in Meta
- Check that your Railway URL is correct and the app is running
- Visit `https://YOUR-RAILWAY-URL/` — should return `{"status": "healthy"}`

### "Credentials not configured" when launching a campaign
- Go to Settings → enter all three credentials (WABA ID, Phone Number ID, Access Token)
- Click Save → then Test Connection

### Templates not showing up
- Templates must have **APPROVED** status in Meta Business Manager
- New templates take 1-24 hours for approval
- Check WhatsApp Manager → Message Templates for status

### Messages not being delivered
- Verify the recipient has WhatsApp installed on that number
- Check if the contact is in the blocked list
- Meta has rate limits for new accounts — start slow (1 msg/sec)
- Check message status in the campaign detail view

### Real-time inbox not updating
- Verify Supabase Realtime is enabled on the `replies` table
- Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correctly set in Vercel
- Refresh the page — sometimes the WebSocket needs to reconnect

### App not installable as PWA
- Must be accessed over HTTPS (Vercel provides this automatically)
- Use Safari on iPhone, Chrome on Android
- Clear browser cache and try again

---

## ✅ Setup Checklist

Use this to make sure everything is configured:

- [ ] Meta Developer Account created
- [ ] Business app created with WhatsApp product
- [ ] Phone Number ID and WABA ID noted
- [ ] Permanent access token generated (never-expiring)
- [ ] App Secret copied
- [ ] At least one message template APPROVED
- [ ] Supabase project created, schema.sql executed
- [ ] Realtime enabled on `replies` table
- [ ] Backend deployed to Railway with all env vars
- [ ] Webhook configured in Meta (URL + verify token)
- [ ] Frontend deployed to Vercel with all env vars
- [ ] CORS updated in Railway (`FRONTEND_URL`)
- [ ] Credentials entered in app Settings page
- [ ] Test Connection shows "Connected!"
- [ ] App installed on phone home screen

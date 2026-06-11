# 🏢 PropReach — WhatsApp Broadcast & CRM

**Professional WhatsApp broadcast and CRM tool built for real estate brokerages.** Run marketing campaigns to large contact lists, track every reply, and manage leads — all from your phone.

---

## 🏛️ Architecture

```
PropReach/
├── backend/          # FastAPI — API server + webhook receiver (Railway)
├── frontend/         # React + Vite — mobile-first PWA (Vercel)
├── schema.sql        # Supabase PostgreSQL schema
├── API_SETUP_GUIDE.md # Step-by-step API setup walkthrough
└── README.md         # You are here
```

| Component | Tech | Hosting |
|-----------|------|---------|
| **Backend** | FastAPI + Python | Railway (free tier) |
| **Frontend** | React 18 + Vite + TailwindCSS | Vercel (free tier) |
| **Database** | PostgreSQL + Realtime | Supabase (free tier) |
| **Background Jobs** | APScheduler on Railway | Railway (always-on) |

## ✨ Key Features

- 📤 **Campaign Broadcasting** — Send WhatsApp templates to thousands of contacts
- ⏰ **Scheduled Sends** — Schedule campaigns for later; runs server-side (phone doesn't need to stay open)
- 📥 **Real-time Inbox** — Live feed of all replies via Supabase Realtime
- 👥 **Contact Management** — CSV import, groups, search, blocklist
- 📊 **Analytics Dashboard** — KPIs, message trends, reply rates
- 🏷️ **Lead Labeling** — Mark replies as Interested / Not Interested / Needs Follow-Up
- 📱 **PWA** — Installable on iPhone/Android home screen, feels like a native app
- 🔒 **One-Time API Setup** — Enter credentials once, they're saved forever

---

## 🚀 Deployment Guide

### Prerequisites

- A [Meta Business Account](https://business.facebook.com) with WhatsApp Business API access
- A [Supabase](https://supabase.com) account (free tier)
- A [Railway](https://railway.app) account (free tier)
- A [Vercel](https://vercel.com) account (free tier)
- A GitHub account (to connect repos for deployment)

> **📋 For detailed API setup instructions, see [API_SETUP_GUIDE.md](./API_SETUP_GUIDE.md)**

### Step 1: Set Up Supabase

1. Create a new Supabase project
2. Go to **SQL Editor** → paste the contents of `schema.sql` → click **Run**
3. Go to **Database** → **Replication** → enable Realtime for the `replies` table
4. Copy your **Project URL** and **Service Role Key** from **Settings** → **API**
5. Also copy the **Anon Key** (for the frontend)

### Step 2: Deploy Backend to Railway

1. Push this repo to GitHub
2. Go to [Railway](https://railway.app) → **New Project** → **Deploy from GitHub**
3. Select the `backend/` directory as root
4. Set the following environment variables:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Your Supabase **service role** key |
| `API_SECRET_KEY` | Generate a random string (e.g., `openssl rand -hex 32`) |
| `WEBHOOK_VERIFY_TOKEN` | Any string you choose (you'll use this in Meta) |
| `META_APP_SECRET` | From Meta App Dashboard → Settings → Basic |
| `FRONTEND_URL` | Your Vercel URL (set after Vercel deploy) |

5. Railway will auto-deploy. Copy your Railway public URL (e.g., `https://propreach-backend.up.railway.app`)

### Step 3: Configure Meta Webhook

1. Go to [Meta Developer Console](https://developers.facebook.com)
2. Select your app → **WhatsApp** → **Configuration**
3. Set **Callback URL** to: `https://YOUR-RAILWAY-URL/webhook/whatsapp`
4. Set **Verify Token** to the same value as `WEBHOOK_VERIFY_TOKEN`
5. Subscribe to: `messages`, `message_template_status_update`

### Step 4: Deploy Frontend to Vercel

1. Go to [Vercel](https://vercel.com) → **New Project** → **Import Git Repository**
2. Set the **Root Directory** to `frontend/`
3. Set environment variables:

| Variable | Value |
|----------|-------|
| `VITE_BACKEND_URL` | Your Railway URL |
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase **anon** key |
| `VITE_API_KEY` | Same as `API_SECRET_KEY` in Railway |

4. Deploy!

### Step 5: First Launch & API Setup

1. Open your Vercel URL on your phone
2. Go to **Settings** tab
3. Enter your WhatsApp credentials:
   - **WABA ID** (from Meta Business Manager)
   - **Phone Number ID** (from Meta Developer Console)
   - **Access Token** (permanent system user token)
   - **Verify Token** (must match Railway env var)
4. Click **Save Credentials**
5. Click **Test Connection** — should show green "Connected!"
6. **These credentials are saved forever.** You never need to enter them again.

### Step 6: Install as Mobile App

1. Open the Vercel URL on your **iPhone**: tap Share → **Add to Home Screen**
2. On **Android**: tap the three-dot menu → **Add to Home Screen**
3. The app now launches like a native app with full-screen mode

---

## 🛡️ Security

- All API credentials stored in Supabase (encrypted at rest) — never in frontend code
- Backend validates every request with `X-API-Key` header
- Webhook validates Meta's `X-Hub-Signature-256` HMAC signature
- All database writes wrapped in try/except with error logging
- Failed sends automatically retried once after 60 seconds

---

## 🧑‍💻 Local Development

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Fill in your values
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env  # Fill in your values
npm run dev
```

---

## 🔧 Environment Variables Reference

### Backend (Railway)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_KEY` | ✅ | Supabase service role key |
| `API_SECRET_KEY` | ✅ | API key for frontend auth |
| `WEBHOOK_VERIFY_TOKEN` | ✅ | Meta webhook verify token |
| `META_APP_SECRET` | ✅ | Meta app secret (for HMAC) |
| `FRONTEND_URL` | ❌ | CORS origin (defaults to *) |
| `SEND_RATE_PER_SECOND` | ❌ | Default send rate (default: 1) |

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_BACKEND_URL` | ✅ | Railway backend URL |
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `VITE_API_KEY` | ✅ | Same as backend API_SECRET_KEY |

### WhatsApp Credentials (Saved in App Settings)

| Credential | Where to Find |
|-----------|---------------|
| WABA ID | Meta Business Manager → Business Settings → WhatsApp Accounts |
| Phone Number ID | Meta Developer Console → WhatsApp → API Setup |
| Access Token | Meta Business Manager → System Users → Generate Token |

---

## 📱 Usage

1. **Import contacts** via CSV (Contacts → + button)
2. **Create a campaign** (Campaigns → New → follow the 5-step wizard)
3. **Monitor sends** in real-time on the Dashboard
4. **Check replies** in the Inbox (updates live)
5. **Label leads** as Interested / Not Interested / Needs Follow-Up
6. **Reply to contacts** via the WhatsApp deep link (one tap)

---

Built with ❤️ for real estate professionals.

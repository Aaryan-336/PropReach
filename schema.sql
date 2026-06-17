-- ═══════════════════════════════════════════════════════
-- PropReach — Supabase PostgreSQL Schema
-- Run this in the Supabase SQL Editor to set up all tables.
-- ═══════════════════════════════════════════════════════

-- ── Settings (stores WhatsApp API credentials — ONE-TIME setup) ──

create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text not null,
  updated_at timestamptz default now()
);

-- Pre-populate setting keys for clarity
-- Values will be set via the Settings page in the app
comment on table settings is 'Stores API credentials and app configuration. Credentials are entered once via Settings page.';

-- ── Contacts ────────────────────────────────────────

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text unique not null,
  group_name text default 'General',
  custom_fields jsonb default '{}',
  is_blocked boolean default false,
  created_at timestamptz default now()
);

-- ── Campaigns ───────────────────────────────────────

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_name text,
  template_vars jsonb default '{}',
  contact_group text,
  status text default 'draft',  -- draft | running | paused | completed
  scheduled_at timestamptz,
  total_contacts int default 0,
  sent_count int default 0,
  delivered_count int default 0,
  failed_count int default 0,
  reply_count int default 0,
  send_rate int default 1,
  cooldown_seconds float default 3.0,  -- delay (seconds) between each message send, 0–60
  created_at timestamptz default now()
);

-- ── Messages (individual send log) ──────────────────

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  phone text,
  direction text not null,        -- 'outbound' | 'inbound'
  content text,
  wa_message_id text,
  status text default 'pending',  -- pending | sent | delivered | read | failed
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- ── Replies (inbound messages — the CRM inbox) ─────

create table if not exists replies (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete set null,
  phone text not null,
  message_text text,
  wa_message_id text,
  is_read boolean default false,
  label text default 'new',       -- new | interested | not_interested | needs_followup
  agent_note text,
  received_at timestamptz default now()
);


-- ═══════════════════════════════════════════════════════
-- Indexes for query performance
-- ═══════════════════════════════════════════════════════

create index if not exists idx_contacts_phone on contacts(phone);
create index if not exists idx_contacts_group on contacts(group_name);
create index if not exists idx_contacts_blocked on contacts(is_blocked);

create index if not exists idx_campaigns_status on campaigns(status);
create index if not exists idx_campaigns_created on campaigns(created_at desc);

create index if not exists idx_messages_campaign on messages(campaign_id);
create index if not exists idx_messages_contact on messages(contact_id);
create index if not exists idx_messages_wa_id on messages(wa_message_id);
create index if not exists idx_messages_direction on messages(direction);
create index if not exists idx_messages_created on messages(created_at desc);

create index if not exists idx_replies_contact on replies(contact_id);
create index if not exists idx_replies_phone on replies(phone);
create index if not exists idx_replies_label on replies(label);
create index if not exists idx_replies_unread on replies(is_read) where is_read = false;

create index if not exists idx_settings_key on settings(key);


-- ═══════════════════════════════════════════════════════
-- Enable Realtime
-- ═══════════════════════════════════════════════════════
-- After running this SQL, go to Supabase Dashboard:
-- Database → Replication → Enable Realtime for the `replies` table
-- This allows the frontend inbox to update live without polling.

-- Alternatively, you can run:
-- alter publication supabase_realtime add table replies;


-- ═══════════════════════════════════════════════════════
-- Row Level Security (RLS)
-- ═══════════════════════════════════════════════════════
-- This is an internal tool using service-role key.
-- We enable RLS but allow all operations for the service role.

alter table settings enable row level security;
alter table contacts enable row level security;
alter table campaigns enable row level security;
alter table messages enable row level security;
alter table replies enable row level security;

-- Service role bypasses RLS automatically.
-- These policies allow the anon key (used by frontend for real-time only) to read replies.
create policy "Allow read replies for realtime" on replies
  for select using (true);

create policy "Allow read contacts for realtime" on contacts
  for select using (true);

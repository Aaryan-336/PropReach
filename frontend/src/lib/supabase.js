/**
 * Supabase client for real-time subscriptions.
 * Used only for live inbox updates — all CRUD goes through the backend API.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Subscribe to new replies in real-time.
 * Returns an unsubscribe function.
 */
export function subscribeToReplies(onNewReply) {
  if (!supabase) {
    console.warn('Supabase not configured — real-time disabled');
    return () => {};
  }

  const channel = supabase
    .channel('replies-realtime')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'replies',
      },
      (payload) => {
        onNewReply(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to reply updates (label changes, read status).
 */
export function subscribeToReplyUpdates(onUpdate) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel('replies-updates')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'replies',
      },
      (payload) => {
        onUpdate(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Inbox as InboxIcon,
  ExternalLink,
  Star,
  XCircle,
  Clock,
  Eye,
  ChevronLeft,
  StickyNote,
  MessageCircle,
} from 'lucide-react';
import { fetchReplies, updateReply } from '../lib/api';
import { subscribeToReplies } from '../lib/supabase';
import ReplyThread from '../components/ReplyThread';

const LABELS = [
  { value: '', label: 'All', color: '' },
  { value: 'new', label: 'New', color: 'bg-navy-200' },
  { value: 'interested', label: 'Interested', color: 'bg-gold-500' },
  { value: 'not_interested', label: 'Not Interested', color: 'bg-danger' },
  { value: 'needs_followup', label: 'Follow-Up', color: 'bg-blue-500' },
];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function Inbox() {
  const [labelFilter, setLabelFilter] = useState('');
  const [selectedReply, setSelectedReply] = useState(null);
  const [noteInput, setNoteInput] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['replies', labelFilter],
    queryFn: () => fetchReplies({ label: labelFilter || undefined }),
    refetchInterval: 30_000,
  });

  const replies = data?.items || [];

  // Real-time subscription
  useEffect(() => {
    const unsubscribe = subscribeToReplies((newReply) => {
      queryClient.invalidateQueries({ queryKey: ['replies'] });
      queryClient.invalidateQueries({ queryKey: ['unread-replies'] });
    });
    return unsubscribe;
  }, [queryClient]);

  const labelMutation = useMutation({
    mutationFn: ({ id, label }) => updateReply(id, { label }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['replies'] });
    },
  });

  const noteMutation = useMutation({
    mutationFn: ({ id, agent_note }) => updateReply(id, { agent_note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['replies'] });
      setNoteInput('');
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => updateReply(id, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['replies'] });
      queryClient.invalidateQueries({ queryKey: ['unread-replies'] });
    },
  });

  const handleSelectReply = useCallback((reply) => {
    setSelectedReply(reply);
    setNoteInput(reply.agent_note || '');
    if (!reply.is_read) {
      markReadMutation.mutate(reply.id);
    }
  }, [markReadMutation]);

  // Show thread view
  if (selectedReply) {
    return (
      <div className="fixed inset-0 z-50 bg-surface flex flex-col" id="reply-detail">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 bg-white border-b border-navy-100">
          <button onClick={() => setSelectedReply(null)} className="btn-icon">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-semibold text-navy-900 truncate">
              {selectedReply.contact_name || selectedReply.phone}
            </h2>
            <p className="text-xs text-navy-400">{selectedReply.phone}</p>
          </div>
          <a
            href={`https://wa.me/${selectedReply.phone?.replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-icon !bg-success-light"
          >
            <ExternalLink size={16} className="text-success" />
          </a>
        </div>

        {/* Labels */}
        <div className="flex gap-2 p-4 bg-white border-b border-navy-100 overflow-x-auto">
          {LABELS.filter((l) => l.value).map(({ value, label, color }) => (
            <button
              key={value}
              onClick={() => labelMutation.mutate({ id: selectedReply.id, label: value })}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedReply.label === value
                  ? `${color} text-white`
                  : 'bg-navy-50 text-navy-600 hover:bg-navy-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Thread */}
        <div className="flex-1 overflow-hidden">
          <ReplyThread
            phone={selectedReply.phone}
            contactName={selectedReply.contact_name}
            contactId={selectedReply.contact_id}
          />
        </div>

        {/* Agent Note */}
        <div className="p-4 bg-white border-t border-navy-100">
          <div className="flex items-center gap-2 mb-2">
            <StickyNote size={14} className="text-gold-600" />
            <span className="text-xs font-semibold text-navy-500 uppercase tracking-wider">
              Internal Note
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              className="input-field !min-h-[40px] text-sm"
              placeholder="Add a note (team only)..."
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && noteInput.trim()) {
                  noteMutation.mutate({ id: selectedReply.id, agent_note: noteInput });
                }
              }}
            />
            <button
              onClick={() => noteInput.trim() && noteMutation.mutate({ id: selectedReply.id, agent_note: noteInput })}
              disabled={!noteInput.trim() || noteMutation.isPending}
              className="btn-primary !min-h-[40px] !px-4"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" id="inbox-page">
      {/* Header */}
      <div className="mb-2">
        <h1 className="page-title">Inbox</h1>
        <p className="page-subtitle">Real-time replies from your contacts</p>
      </div>

      {/* Label Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-4">
        {LABELS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setLabelFilter(value)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              labelFilter === value
                ? 'bg-navy-900 text-white'
                : 'bg-white text-navy-600 border border-navy-200 hover:border-navy-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Reply Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-[80px] animate-pulse bg-navy-50" />
          ))}
        </div>
      ) : replies.length > 0 ? (
        <div className="space-y-2">
          {replies.map((reply) => (
            <button
              key={reply.id}
              onClick={() => handleSelectReply(reply)}
              className={`w-full text-left card lead-border-${reply.label} flex items-center gap-3 active:scale-[0.98] transition-transform ${
                !reply.is_read ? 'bg-gold-50/30' : ''
              }`}
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-navy-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-navy-500">
                  {(reply.contact_name || reply.phone || '?')[0].toUpperCase()}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm truncate ${!reply.is_read ? 'font-bold text-navy-900' : 'font-medium text-navy-700'}`}>
                    {reply.contact_name || reply.phone}
                  </h3>
                  <span className="text-[10px] text-navy-400 flex-shrink-0 ml-2">
                    {timeAgo(reply.received_at)}
                  </span>
                </div>
                <p className="text-xs text-navy-500 truncate mt-0.5">
                  {reply.message_text || '[No content]'}
                </p>
                {reply.agent_note && (
                  <p className="text-[10px] text-gold-600 flex items-center gap-1 mt-1">
                    <StickyNote size={10} /> {reply.agent_note}
                  </p>
                )}
              </div>

              {/* Unread dot */}
              {!reply.is_read && (
                <div className="w-2.5 h-2.5 rounded-full bg-gold-500 flex-shrink-0 animate-pulse-dot" />
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <MessageCircle className="empty-state-icon" />
          <p className="text-sm font-medium text-navy-600 mb-1">No replies yet</p>
          <p className="empty-state-text">
            Replies from your campaigns will appear here in real-time
          </p>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  RotateCcw,
  Send,
  CheckCheck,
  AlertTriangle,
  MessageCircle,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  Users
} from 'lucide-react';
import {
  fetchCampaign,
  fetchMessages,
  rerunCampaign,
  pauseCampaign,
  resumeCampaign
} from '../lib/api';
import StatusPill from './StatusPill';

export default function CampaignInsights({ campaignId, onBack }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // 1. Fetch Campaign Details
  const { data: campaign, isLoading: isLoadingCampaign, refetch: refetchCampaign } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => fetchCampaign(campaignId),
    refetchInterval: (data) => {
      // Auto-poll every 3 seconds if the campaign is currently running
      return data?.status === 'running' ? 3000 : false;
    },
  });

  // 2. Fetch Campaign Message Logs
  const { data: messagesData, isLoading: isLoadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ['campaign-messages', campaignId, page],
    queryFn: () => fetchMessages({ campaignId, page, pageSize }),
    refetchInterval: () => {
      // Auto-poll logs if campaign is running
      return campaign?.status === 'running' ? 3000 : false;
    },
    keepPreviousData: true,
  });

  // 3. Campaign Mutations
  const rerunMutation = useMutation({
    mutationFn: () => rerunCampaign(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-messages', campaignId] });
      setPage(1);
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => pauseCampaign(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      refetchCampaign();
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => resumeCampaign(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      refetchCampaign();
    },
  });

  if (isLoadingCampaign) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <RefreshCw className="animate-spin text-navy-400" size={32} />
        <p className="text-sm text-navy-500">Loading insights...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-20 space-y-4">
        <AlertTriangle size={48} className="mx-auto text-danger" />
        <p className="text-navy-900 font-semibold">Campaign not found</p>
        <button onClick={onBack} className="btn-secondary">
          Go Back
        </button>
      </div>
    );
  }

  const {
    name,
    template_name,
    status,
    total_contacts,
    sent_count,
    delivered_count,
    failed_count,
    reply_count,
    created_at,
    contact_group,
    send_rate,
  } = campaign;

  const sentPct = total_contacts > 0 ? Math.min(100, (sent_count / total_contacts) * 100) : 0;
  const deliveredPct = total_contacts > 0 ? Math.min(100, (delivered_count / total_contacts) * 100) : 0;
  const readPct = total_contacts > 0 ? Math.min(100, (messagesData?.items?.filter(m => m.status === 'read').length / total_contacts) * 100) : 0;

  // Fetch replies from the message logs or calculate rates
  const replyRate = sent_count > 0 ? ((reply_count / sent_count) * 100).toFixed(1) : 0;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const logs = messagesData?.items || [];
  const totalLogs = messagesData?.total || 0;
  const totalPages = Math.ceil(totalLogs / pageSize);

  const handleRerun = () => {
    if (window.confirm('Are you sure you want to rerun this campaign? This will clear all existing message logs for this run and start sending again.')) {
      rerunMutation.mutate();
    }
  };

  return (
    <div className="space-y-4 animate-fade-in" id="campaign-insights-view">
      {/* Header & Navigation */}
      <div className="flex items-center justify-between border-b border-navy-100 pb-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-navy-600 hover:text-navy-900 font-medium transition-colors">
          <ArrowLeft size={16} />
          <span className="text-sm">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          {status === 'running' && (
            <button
              onClick={() => pauseMutation.mutate()}
              className="btn-icon !w-8 !h-8 bg-navy-50 hover:bg-navy-100 border border-navy-200"
              title="Pause Campaign"
            >
              <Pause size={14} className="text-navy-700" />
            </button>
          )}
          {status === 'paused' && (
            <button
              onClick={() => resumeMutation.mutate()}
              className="btn-icon !w-8 !h-8 bg-navy-50 hover:bg-navy-100 border border-navy-200"
              title="Resume Campaign"
            >
              <Play size={14} className="text-navy-700" />
            </button>
          )}
          <button
            onClick={handleRerun}
            disabled={rerunMutation.isLoading}
            className="btn-icon !w-8 !h-8 bg-gold-50 hover:bg-gold-100 border border-gold-200"
            title="Rerun Template Campaign"
          >
            <RotateCcw size={14} className={`text-gold-600 ${rerunMutation.isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Title block */}
      <div>
        <h2 className="text-xl font-bold font-display text-navy-900">{name}</h2>
        <div className="flex items-center gap-1.5 text-xs text-navy-400 mt-1">
          <Clock size={12} />
          <span>Created on {formatDate(created_at)}</span>
        </div>
      </div>

      {/* Delivery Progress Bar */}
      <div className="card space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-navy-700">
          <span>Delivery Progress</span>
          <span>{Math.round(sentPct)}% ({sent_count}/{total_contacts})</span>
        </div>
        <div className="h-2 bg-navy-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${sentPct}%`,
              background: status === 'failed'
                ? '#E05252'
                : `linear-gradient(90deg, #C9A84C ${deliveredPct}%, #2D9E6B 100%)`,
            }}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card flex items-center gap-3 p-3.5">
          <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center text-navy-500">
            <Send size={18} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-navy-400">Sent</p>
            <p className="text-lg font-bold text-navy-900">{sent_count}</p>
          </div>
        </div>

        <div className="card flex items-center gap-3 p-3.5">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success">
            <CheckCheck size={18} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-navy-400">Delivered</p>
            <p className="text-lg font-bold text-navy-900">{delivered_count}</p>
          </div>
        </div>

        <div className="card flex items-center gap-3 p-3.5">
          <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center text-danger">
            <AlertTriangle size={18} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-navy-400">Failed</p>
            <p className="text-lg font-bold text-navy-900">{failed_count}</p>
          </div>
        </div>

        <div className="card flex items-center gap-3 p-3.5">
          <div className="w-10 h-10 rounded-xl bg-gold-50 flex items-center justify-center text-gold-600">
            <MessageCircle size={18} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-navy-400">Replies</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-navy-900">{reply_count}</span>
              <span className="text-[10px] text-navy-400 font-semibold">({replyRate}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Parameters */}
      <div className="card p-4 text-sm space-y-2.5">
        <h3 className="font-semibold text-navy-800 border-b border-navy-50 pb-1.5 font-display text-xs uppercase tracking-wider">Campaign Settings</h3>
        <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
          <div>
            <p className="text-[10px] text-navy-400 font-semibold uppercase">Template Name</p>
            <p className="text-navy-900 font-medium truncate mt-0.5" title={template_name}>{template_name || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-navy-400 font-semibold uppercase">Target Group</p>
            <div className="flex items-center gap-1 mt-0.5 text-navy-900 font-medium">
              <Users size={12} className="text-navy-400" />
              <span>{contact_group || 'All Contacts'}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-navy-400 font-semibold uppercase">Send Rate</p>
            <p className="text-navy-900 font-medium mt-0.5">{send_rate} msg/sec</p>
          </div>
          <div>
            <p className="text-[10px] text-navy-400 font-semibold uppercase">Total Contacts</p>
            <p className="text-navy-900 font-medium mt-0.5">{total_contacts} leads</p>
          </div>
        </div>
      </div>

      {/* Detailed Delivery Log */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-navy-50 pb-2">
          <h3 className="font-semibold text-navy-800 font-display text-xs uppercase tracking-wider">Contact Delivery Log</h3>
          <span className="text-[10px] font-semibold text-navy-400 bg-navy-50 px-2 py-0.5 rounded-full">
            Total {totalLogs}
          </span>
        </div>

        {isLoadingLogs ? (
          <div className="py-10 text-center text-xs text-navy-400 flex items-center justify-center gap-1.5">
            <RefreshCw className="animate-spin" size={12} /> Loading delivery logs...
          </div>
        ) : logs.length > 0 ? (
          <div className="space-y-2.5 divide-y divide-navy-50/50 max-h-[400px] overflow-y-auto pr-1">
            {logs.map((log) => {
              const logDate = log.sent_at || log.created_at;
              return (
                <div key={log.id} className="pt-2.5 first:pt-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-navy-900 truncate">
                        {log.contact_name || 'Unknown'}
                      </p>
                      <p className="text-[10px] text-navy-400 font-mono mt-0.5">
                        +{log.phone}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {log.status === 'read' && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-gold-600 bg-gold-50 px-2 py-0.5 rounded-full">
                          Read
                        </span>
                      )}
                      {log.status === 'delivered' && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-success bg-success/10 px-2 py-0.5 rounded-full">
                          Delivered
                        </span>
                      )}
                      {log.status === 'sent' && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-navy-600 bg-navy-50 px-2 py-0.5 rounded-full">
                          Sent
                        </span>
                      )}
                      {log.status === 'failed' && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-danger bg-danger/10 px-2 py-0.5 rounded-full">
                          Failed
                        </span>
                      )}
                      {log.status === 'pending' && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-navy-400 bg-navy-50 px-2 py-0.5 rounded-full">
                          Pending
                        </span>
                      )}
                      <p className="text-[8px] text-navy-300 mt-0.5 font-semibold">
                        {logDate ? new Date(logDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                      </p>
                    </div>
                  </div>
                  {log.status === 'failed' && log.error_message && (
                    <div className="mt-1 p-1.5 bg-danger/5 border border-danger/10 rounded-lg text-[9px] text-danger leading-relaxed">
                      Error: {log.error_message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-10 text-center text-xs text-navy-400">
            No send records found for this run yet.
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-navy-50 pt-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 text-xs text-navy-500 hover:text-navy-900 disabled:opacity-30"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="text-xs text-navy-400 font-semibold">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 text-xs text-navy-500 hover:text-navy-900 disabled:opacity-30"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

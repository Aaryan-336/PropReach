import { Send, CheckCheck, AlertTriangle, MessageCircle, MoreVertical } from 'lucide-react';
import StatusPill from './StatusPill';

function MetricBadge({ icon: Icon, value, label, color }) {
  return (
    <div className="flex items-center gap-1">
      <Icon size={13} className={color} />
      <span className="text-xs font-semibold text-navy-700">{value}</span>
      <span className="text-[10px] text-navy-400 hidden sm:inline">{label}</span>
    </div>
  );
}

export default function CampaignCard({ campaign, onAction, onClick }) {
  const {
    id,
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
  } = campaign;

  const sentPct = total_contacts > 0 ? (sent_count / total_contacts) * 100 : 0;
  const deliveredPct = total_contacts > 0 ? (delivered_count / total_contacts) * 100 : 0;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div
      onClick={onClick}
      className={`card animate-fade-in ${onClick ? 'cursor-pointer hover:border-gold-300 active:scale-[0.99]' : ''} border border-transparent transition-all`}
      id={`campaign-${id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-navy-900 truncate">{name}</h3>
          <p className="text-xs text-navy-400 mt-0.5">
            {template_name || 'No template'} · {contact_group || 'All contacts'}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <StatusPill status={status} />
          {onAction && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAction(id, 'menu');
              }}
              className="btn-icon !w-8 !h-8"
              aria-label="Campaign actions"
            >
              <MoreVertical size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-navy-100 rounded-full overflow-hidden mb-3">
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

      {/* Metrics */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <MetricBadge icon={Send} value={sent_count} label="sent" color="text-navy-500" />
          <MetricBadge icon={CheckCheck} value={delivered_count} label="delivered" color="text-success" />
          {failed_count > 0 && (
            <MetricBadge icon={AlertTriangle} value={failed_count} label="failed" color="text-danger" />
          )}
          {reply_count > 0 && (
            <MetricBadge icon={MessageCircle} value={reply_count} label="replies" color="text-gold-600" />
          )}
        </div>
        <span className="text-[10px] text-navy-300">{formatDate(created_at)}</span>
      </div>
    </div>
  );
}

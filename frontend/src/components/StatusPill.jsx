const statusConfig = {
  draft: {
    bg: 'bg-navy-100',
    text: 'text-navy-600',
    label: 'Draft',
  },
  running: {
    bg: 'bg-gold-100',
    text: 'text-gold-700',
    label: 'Running',
  },
  paused: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    label: 'Paused',
  },
  completed: {
    bg: 'bg-success-light',
    text: 'text-success-dark',
    label: 'Completed',
  },
  failed: {
    bg: 'bg-danger-light',
    text: 'text-danger-dark',
    label: 'Failed',
  },
};

export default function StatusPill({ status }) {
  const config = statusConfig[status] || statusConfig.draft;

  return (
    <span className={`status-pill ${config.bg} ${config.text}`}>
      {status === 'running' && (
        <span className="w-1.5 h-1.5 rounded-full bg-gold-500 mr-1.5 animate-pulse-dot" />
      )}
      {config.label}
    </span>
  );
}

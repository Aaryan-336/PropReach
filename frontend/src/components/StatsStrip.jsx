import { useEffect, useRef, useState } from 'react';
import { Users, Megaphone, Send, MessageCircle } from 'lucide-react';

const stats = [
  { key: 'total_contacts', label: 'Contacts', icon: Users, color: 'text-navy-600', bg: 'bg-navy-50' },
  { key: 'active_campaigns', label: 'Active', icon: Megaphone, color: 'text-gold-600', bg: 'bg-gold-50' },
  { key: 'messages_sent_this_month', label: 'Sent', icon: Send, color: 'text-success', bg: 'bg-success-light' },
  { key: 'reply_rate', label: 'Reply Rate', icon: MessageCircle, color: 'text-blue-600', bg: 'bg-blue-50', suffix: '%' },
];

function AnimatedNumber({ value, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const end = typeof value === 'number' ? value : 0;
    const duration = 600;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = start + (end - start) * eased;

      setDisplay(suffix === '%' ? current.toFixed(1) : Math.round(current));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        prevRef.current = end;
      }
    };

    requestAnimationFrame(animate);
  }, [value, suffix]);

  return (
    <span className="animate-count-up">
      {display}{suffix}
    </span>
  );
}

export default function StatsStrip({ data }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide" id="stats-strip">
      {stats.map(({ key, label, icon: Icon, color, bg, suffix }, i) => (
        <div
          key={key}
          className={`card flex-shrink-0 flex items-center gap-3 min-w-[140px] animate-slide-up stagger-${i + 1}`}
        >
          <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
            <Icon size={18} className={color} />
          </div>
          <div>
            <p className="text-lg font-bold text-navy-900 leading-tight">
              <AnimatedNumber value={data?.[key] || 0} suffix={suffix || ''} />
            </p>
            <p className="text-[11px] text-navy-400 font-medium">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

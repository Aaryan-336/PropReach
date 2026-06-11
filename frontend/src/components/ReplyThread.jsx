import { MessageSquare, ExternalLink, Send } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchMessages } from '../lib/api';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function ReplyThread({ phone, contactName, contactId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['thread', contactId || phone],
    queryFn: () => fetchMessages({ contactId, pageSize: 100 }),
    enabled: !!(contactId || phone),
  });

  const messages = data?.items || [];

  // Group messages by date
  const grouped = messages.reduce((acc, msg) => {
    const date = formatDate(msg.created_at);
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {});

  // Sort each group by time ascending
  Object.values(grouped).forEach((msgs) =>
    msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  );

  const whatsappUrl = `https://wa.me/${phone?.replace(/[^0-9]/g, '')}`;

  return (
    <div className="flex flex-col h-full" id="reply-thread">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-navy-100">
        <div>
          <h3 className="font-display font-semibold text-navy-900">
            {contactName || 'Unknown Contact'}
          </h3>
          <p className="text-xs text-navy-400">{phone}</p>
        </div>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex items-center gap-2 !py-2 !px-4 !min-h-[40px]"
        >
          <ExternalLink size={14} />
          Reply
        </a>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="w-6 h-6 border-2 border-navy-200 border-t-navy-500 rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <MessageSquare className="empty-state-icon" />
            <p className="empty-state-text">No messages yet</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, msgs]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-navy-100" />
                <span className="text-[10px] text-navy-400 font-medium">{date}</span>
                <div className="h-px flex-1 bg-navy-100" />
              </div>
              <div className="space-y-2">
                {msgs.map((msg) => (
                  <div
                    key={msg.id}
                    className={`max-w-[85%] p-3 rounded-2xl text-sm animate-fade-in ${
                      msg.direction === 'outbound'
                        ? 'ml-auto bg-navy-900 text-white rounded-br-sm'
                        : 'mr-auto bg-white shadow-card rounded-bl-sm text-navy-900'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content || '[No content]'}</p>
                    <div className={`flex items-center gap-1 mt-1 ${
                      msg.direction === 'outbound' ? 'justify-end' : ''
                    }`}>
                      <span className={`text-[10px] ${
                        msg.direction === 'outbound' ? 'text-navy-300' : 'text-navy-400'
                      }`}>
                        {formatTime(msg.created_at)}
                      </span>
                      {msg.direction === 'outbound' && (
                        <span className={`text-[10px] ${
                          msg.status === 'read' ? 'text-blue-400' :
                          msg.status === 'delivered' ? 'text-navy-400' :
                          msg.status === 'failed' ? 'text-danger' :
                          'text-navy-500'
                        }`}>
                          {msg.status === 'read' ? '✓✓' :
                           msg.status === 'delivered' ? '✓✓' :
                           msg.status === 'sent' ? '✓' :
                           msg.status === 'failed' ? '✕' : '◦'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reply CTA */}
      <div className="p-4 border-t border-navy-100">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-gold w-full flex items-center justify-center gap-2"
        >
          <Send size={16} />
          Open in WhatsApp
        </a>
      </div>
    </div>
  );
}

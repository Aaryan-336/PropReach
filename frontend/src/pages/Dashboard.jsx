import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, TrendingUp, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchDashboardStats, fetchCampaigns } from '../lib/api';
import StatsStrip from '../components/StatsStrip';
import CampaignCard from '../components/CampaignCard';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-navy-900 text-white px-3 py-2 rounded-lg shadow-lg text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 60_000,
  });

  const { data: campaignsData } = useQuery({
    queryKey: ['campaigns', 'recent'],
    queryFn: () => fetchCampaigns(),
  });

  const recentCampaigns = (campaignsData?.campaigns || []).slice(0, 3);

  const chartData = (stats?.daily_stats || []).map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    Sent: d.sent,
    Delivered: d.delivered,
    Failed: d.failed,
  }));

  return (
    <div className="page-container" id="dashboard-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Welcome back to PropReach</p>
      </div>

      {/* KPI Strip */}
      {statsLoading ? (
        <div className="flex gap-3 overflow-hidden mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card flex-shrink-0 min-w-[140px] h-[72px] animate-pulse bg-navy-50" />
          ))}
        </div>
      ) : (
        <div className="mb-6">
          <StatsStrip data={stats} />
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => navigate('/campaigns')}
          className="card flex items-center gap-3 active:scale-[0.97] transition-transform"
          id="quick-new-campaign"
        >
          <div className="w-10 h-10 rounded-xl bg-gold-50 flex items-center justify-center">
            <Plus size={18} className="text-gold-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-navy-900">New Campaign</p>
            <p className="text-[11px] text-navy-400">Create & send</p>
          </div>
        </button>
        <button
          onClick={() => navigate('/contacts')}
          className="card flex items-center gap-3 active:scale-[0.97] transition-transform"
          id="quick-import"
        >
          <div className="w-10 h-10 rounded-xl bg-success-light flex items-center justify-center">
            <Upload size={18} className="text-success" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-navy-900">Import Contacts</p>
            <p className="text-[11px] text-navy-400">Upload CSV</p>
          </div>
        </button>
      </div>

      {/* Message Trends Chart */}
      <div className="card mb-6" id="message-chart">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-base font-semibold text-navy-900">Message Trends</h2>
            <p className="text-xs text-navy-400">Last 14 days</p>
          </div>
          <TrendingUp size={18} className="text-navy-300" />
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={2}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#708DAF' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#708DAF' }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(15,33,55,0.04)' }} />
              <Bar dataKey="Sent" fill="#C9A84C" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Delivered" fill="#2D9E6B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Failed" fill="#E05252" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-sm text-navy-400">
            No data yet — launch your first campaign!
          </div>
        )}
      </div>

      {/* Recent Campaigns */}
      <div id="recent-campaigns">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-semibold text-navy-900">Recent Campaigns</h2>
          <button
            onClick={() => navigate('/campaigns')}
            className="flex items-center gap-1 text-xs text-gold-600 font-semibold hover:text-gold-700"
          >
            View All <ArrowRight size={14} />
          </button>
        </div>

        {recentCampaigns.length > 0 ? (
          <div className="space-y-3">
            {recentCampaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        ) : (
          <div className="card text-center py-8">
            <p className="text-sm text-navy-400">No campaigns yet</p>
            <button
              onClick={() => navigate('/campaigns')}
              className="mt-3 text-sm text-gold-600 font-semibold hover:text-gold-700"
            >
              Create your first campaign →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

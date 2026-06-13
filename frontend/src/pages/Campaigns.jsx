import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pause, Play, Copy, Megaphone, RotateCcw } from 'lucide-react';
import { fetchCampaigns, pauseCampaign, resumeCampaign, duplicateCampaign, rerunCampaign } from '../lib/api';
import CampaignCard from '../components/CampaignCard';
import CreateCampaignModal from '../components/CreateCampaignModal';
import CampaignInsights from '../components/CampaignInsights';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'draft', label: 'Draft' },
  { value: 'paused', label: 'Paused' },
];

export default function Campaigns() {
  const [filter, setFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [actionMenu, setActionMenu] = useState(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const queryClient = useQueryClient();

  const rerunMutation = useMutation({
    mutationFn: rerunCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setActionMenu(null);
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', filter],
    queryFn: () => fetchCampaigns(filter || undefined),
    refetchInterval: 15_000,
  });

  const campaigns = data?.campaigns || [];

  const pauseMutation = useMutation({
    mutationFn: pauseCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setActionMenu(null);
    },
  });

  const resumeMutation = useMutation({
    mutationFn: resumeCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setActionMenu(null);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: duplicateCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setActionMenu(null);
    },
  });

  const handleAction = (campaignId, action) => {
    if (action === 'menu') {
      setActionMenu(actionMenu === campaignId ? null : campaignId);
    }
  };

  const getMenuCampaign = () => campaigns.find((c) => c.id === actionMenu);

  if (selectedCampaignId) {
    return (
      <div className="page-container" id="campaigns-page">
        <CampaignInsights
          campaignId={selectedCampaignId}
          onBack={() => setSelectedCampaignId(null)}
        />
      </div>
    );
  }

  return (
    <div className="page-container" id="campaigns-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="page-title">Campaigns</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-gold flex items-center gap-2 !py-2 !px-4 !min-h-[40px]"
          id="create-campaign-btn"
        >
          <Plus size={16} />
          <span className="text-sm">New</span>
        </button>
      </div>
      <p className="page-subtitle">Manage your WhatsApp broadcast campaigns</p>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-4">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filter === value
                ? 'bg-navy-900 text-white'
                : 'bg-white text-navy-600 border border-navy-200 hover:border-navy-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Campaign List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-[120px] animate-pulse bg-navy-50" />
          ))}
        </div>
      ) : campaigns.length > 0 ? (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="relative">
              <CampaignCard
                campaign={campaign}
                onAction={handleAction}
                onClick={() => setSelectedCampaignId(campaign.id)}
              />

              {/* Action Menu Dropdown */}
              {actionMenu === campaign.id && (
                <div className="absolute right-4 top-12 z-50 bg-white rounded-xl shadow-card-hover border border-navy-100 py-1 min-w-[160px] animate-fade-in">
                  {campaign.status === 'running' && (
                    <button
                      onClick={() => pauseMutation.mutate(campaign.id)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-navy-700 hover:bg-navy-50"
                    >
                      <Pause size={14} /> Pause
                    </button>
                  )}
                  {campaign.status === 'paused' && (
                    <button
                      onClick={() => resumeMutation.mutate(campaign.id)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-navy-700 hover:bg-navy-50"
                    >
                      <Play size={14} /> Resume
                    </button>
                  )}
                  <button
                    onClick={() => duplicateMutation.mutate(campaign.id)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-navy-700 hover:bg-navy-50"
                  >
                    <Copy size={14} /> Duplicate
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to rerun this campaign? This will clear all existing message logs for this run and start sending again.')) {
                        rerunMutation.mutate(campaign.id);
                      }
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-navy-700 hover:bg-navy-50 border-t border-navy-50"
                  >
                    <RotateCcw size={14} /> Rerun Campaign
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Megaphone className="empty-state-icon" />
          <p className="text-sm font-medium text-navy-600 mb-1">No campaigns yet</p>
          <p className="empty-state-text">
            Create your first campaign to start reaching your contacts
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-gold mt-4"
          >
            Create Campaign
          </button>
        </div>
      )}

      {/* Click outside to close menu */}
      {actionMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setActionMenu(null)} />
      )}

      {/* Create Modal */}
      <CreateCampaignModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}

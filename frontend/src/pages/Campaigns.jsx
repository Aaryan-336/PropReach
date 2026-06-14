import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pause, Play, Copy, Megaphone, RotateCcw, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { 
  fetchCampaigns, 
  pauseCampaign, 
  resumeCampaign, 
  duplicateCampaign, 
  rerunCampaign,
  fetchTemplates,
  deleteTemplate
} from '../lib/api';
import CampaignCard from '../components/CampaignCard';
import CreateCampaignModal from '../components/CreateCampaignModal';
import CampaignInsights from '../components/CampaignInsights';
import TemplateCreator from '../components/TemplateCreator';

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
  
  // Tab and Template Management States
  const [activeTab, setActiveTab] = useState('campaigns'); // 'campaigns' | 'templates'
  const [showTemplateCreator, setShowTemplateCreator] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [preselectedTemplate, setPreselectedTemplate] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const queryClient = useQueryClient();

  // Fetch Templates Query (automatically syncs every 60s)
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['templates-list'],
    queryFn: () => fetchTemplates(false),
    refetchInterval: 60_000,
    enabled: activeTab === 'templates',
  });

  const templates = templatesData?.templates || [];

  // Delete Template Mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates-list'] });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (err) => {
      alert(`Failed to delete template: ${err.message}`);
    }
  });

  const handleDeleteTemplate = (templateName) => {
    if (window.confirm(`Are you sure you want to delete the template "${templateName}"? This action cannot be undone.`)) {
      deleteTemplateMutation.mutate(templateName);
    }
  };

  const handleRefresh = async () => {
    setSyncing(true);
    try {
      await queryClient.fetchQuery({
        queryKey: ['templates-list'],
        queryFn: () => fetchTemplates(true),
      });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    } catch (e) {
      console.error('Failed to sync templates:', e);
      alert('Failed to sync templates with Meta. Please check your credentials.');
    }
    setSyncing(false);
  };

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

  if (showTemplateCreator) {
    return (
      <div className="page-container" id="campaigns-page">
        <TemplateCreator
          initialTemplate={editingTemplate}
          onBack={() => {
            setShowTemplateCreator(false);
            setEditingTemplate(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="page-container" id="campaigns-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="page-title">{activeTab === 'campaigns' ? 'Campaigns' : 'Templates'}</h1>
        {activeTab === 'campaigns' ? (
          <button
            onClick={() => setShowCreate(true)}
            className="btn-gold flex items-center gap-2 !py-2 !px-4 !min-h-[40px]"
            id="create-campaign-btn"
          >
            <Plus size={16} />
            <span className="text-sm">New Campaign</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setEditingTemplate(null);
              setShowTemplateCreator(true);
            }}
            className="btn-gold flex items-center gap-2 !py-2 !px-4 !min-h-[40px]"
            id="create-template-btn"
          >
            <Plus size={16} />
            <span className="text-sm">Create Template</span>
          </button>
        )}
      </div>
      <p className="page-subtitle">
        {activeTab === 'campaigns'
          ? 'Manage your WhatsApp broadcast campaigns'
          : 'Create and sync WhatsApp message templates'}
      </p>

      {/* Sub-tab Bar */}
      <div className="flex border-b border-navy-100 mb-6">
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'campaigns'
              ? 'border-gold-500 text-gold-600'
              : 'border-transparent text-navy-500 hover:text-navy-700'
          }`}
        >
          Campaigns
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'templates'
              ? 'border-gold-500 text-gold-600'
              : 'border-transparent text-navy-500 hover:text-navy-700'
          }`}
        >
          Templates
        </button>
      </div>

      {activeTab === 'campaigns' ? (
        <>
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
        </>
      ) : (
        <>
          {/* Sync status and Refresh row */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-navy-400">
              {templates.length} {templates.length === 1 ? 'template' : 'templates'} found
            </span>
            <button
              onClick={handleRefresh}
              disabled={syncing}
              className="text-xs text-gold-600 hover:text-gold-700 font-semibold flex items-center gap-1"
            >
              {syncing ? (
                <>
                  <RefreshCw className="animate-spin" size={12} /> Syncing...
                </>
              ) : (
                <>
                  <RefreshCw size={12} /> Sync with WhatsApp
                </>
              )}
            </button>
          </div>

          {/* Templates list view */}
          {templatesLoading && templates.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card h-[140px] animate-pulse bg-navy-50" />
              ))}
            </div>
          ) : templates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => {
                const bodyComponent = template.components?.find((c) => c.type === 'BODY');
                const bodyText = bodyComponent?.text || '';
                const statusColors = {
                  APPROVED: 'bg-success/10 text-success border border-success/20',
                  PENDING: 'bg-gold-500/10 text-gold-700 border border-gold-500/20',
                  REJECTED: 'bg-danger/10 text-danger border border-danger/20',
                  PAUSED: 'bg-gold-500/10 text-gold-700 border border-gold-500/20',
                };
                const currentStatus = template.status?.toUpperCase() || 'PENDING';
                const statusClass = statusColors[currentStatus] || statusColors.PENDING;

                return (
                  <div key={template.name} className="card flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-navy-900 text-sm break-all">{template.name}</h3>
                          <p className="text-[10px] text-navy-400 mt-0.5 uppercase tracking-wide">
                            {template.language} · {template.category}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusClass}`}>
                            {template.status || 'PENDING'}
                          </span>
                          <button
                            onClick={() => handleDeleteTemplate(template.name)}
                            className="p-1 hover:bg-navy-50 text-navy-400 hover:text-danger rounded-lg transition-colors border border-transparent hover:border-navy-100"
                            title="Delete template"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Bubble Preview */}
                      <div className="bg-navy-50/50 rounded-xl p-3 border border-navy-100/60 text-xs my-3 space-y-1">
                        {(() => {
                          const h = template.components?.find((c) => c.type === 'HEADER');
                          if (h) {
                            if (h.format === 'IMAGE') {
                              return <div className="text-[10px] text-navy-400 italic mb-1">📷 Image Header</div>;
                            }
                            if (h.format === 'TEXT' && h.text) {
                              return (
                                <div className="font-bold text-navy-900 border-b border-navy-100/40 pb-1 mb-1 truncate">
                                  {h.text}
                                </div>
                              );
                            }
                          }
                          return null;
                        })()}
                        <p className="text-navy-700 line-clamp-3 whitespace-pre-wrap leading-relaxed">
                          {bodyText}
                        </p>
                        {(() => {
                          const f = template.components?.find((c) => c.type === 'FOOTER');
                          if (f && f.text) {
                            return <div className="text-[9px] text-navy-400 italic mt-1">{f.text}</div>;
                          }
                          return null;
                        })()}
                      </div>

                      {/* Rejected Details */}
                      {currentStatus === 'REJECTED' && (
                        <div className="mb-3 p-2.5 bg-danger/10 border border-danger/20 rounded-xl text-[10px] text-danger space-y-0.5">
                          <p className="font-bold flex items-center gap-1">
                            <AlertCircle size={10} /> Rejection Reason:
                          </p>
                          <p className="opacity-95 leading-relaxed font-semibold">
                            {template.rejected_reason || template.reason || 'No specific reason provided by Meta.'}
                          </p>
                        </div>
                      )}

                      {/* Paused Details */}
                      {currentStatus === 'PAUSED' && (
                        <div className="mb-3 p-2.5 bg-gold-500/10 border border-gold-500/20 rounded-xl text-[10px] text-gold-800 space-y-0.5">
                          <p className="font-bold flex items-center gap-1">
                            <AlertCircle size={10} /> Template Paused:
                          </p>
                          <p className="opacity-95 leading-relaxed font-semibold">
                            This template has been paused by WhatsApp due to low quality rating. Campaigns using it will fail.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 mt-2 pt-2 border-t border-navy-50">
                      {currentStatus === 'APPROVED' && (
                        <button
                          onClick={() => {
                            setPreselectedTemplate(template.name);
                            setShowCreate(true);
                          }}
                          className="btn-gold flex-1 text-xs py-1.5 flex items-center justify-center gap-1"
                        >
                          Use in Campaign
                        </button>
                      )}
                      {currentStatus === 'REJECTED' && (
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setShowTemplateCreator(true);
                          }}
                          className="btn-secondary flex-1 text-xs py-1.5 flex items-center justify-center gap-1"
                        >
                          Edit & Resubmit
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <Megaphone className="empty-state-icon" />
              <p className="text-sm font-medium text-navy-600 mb-1">No templates yet</p>
              <p className="empty-state-text">
                Create a WhatsApp message template to start launching broker campaigns
              </p>
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setShowTemplateCreator(true);
                }}
                className="btn-gold mt-4"
              >
                Create Template
              </button>
            </div>
          )}
        </>
      )}

      {/* Click outside to close menu */}
      {actionMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setActionMenu(null)} />
      )}

      {/* Create Modal */}
      <CreateCampaignModal 
        isOpen={showCreate} 
        onClose={() => {
          setShowCreate(false);
          setPreselectedTemplate(null);
        }} 
        preselectedTemplateName={preselectedTemplate}
      />
    </div>
  );
}

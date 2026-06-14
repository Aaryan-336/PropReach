import { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Zap, Clock, Check, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchGroups, fetchTemplates, createCampaign, launchCampaign } from '../lib/api';

const STEPS = [
  { label: 'Name & Group', description: 'Campaign basics' },
  { label: 'Template', description: 'Pick a message template' },
  { label: 'Variables', description: 'Map template fields' },
  { label: 'Schedule', description: 'When to send' },
  { label: 'Confirm', description: 'Review & launch' },
];

const SEND_SPEEDS = [
  { value: 1, label: 'Slow (1/sec)', description: 'Safest, recommended for new accounts' },
  { value: 5, label: 'Medium (5/sec)', description: 'Good balance of speed and safety' },
  { value: 20, label: 'Fast (20/sec)', description: 'For high-volume verified accounts' },
];

export default function CreateCampaignModal({ isOpen, onClose }) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    contact_group: '',
    template_name: '',
    template_vars: {},
    send_rate: 1,
    scheduled_at: null,
    sendNow: true,
  });
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: fetchGroups,
    enabled: isOpen,
  });

  const [refreshing, setRefreshing] = useState(false);

  const { data: templatesData, isLoading: templatesLoading, refetch: refetchTemplates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => fetchTemplates(false),
    enabled: isOpen && step >= 1,
  });

  const handleRefreshTemplates = async () => {
    setRefreshing(true);
    try {
      const freshData = await fetchTemplates(true);
      queryClient.setQueryData(['templates'], freshData);
    } catch (e) {
      console.error('Failed to refresh templates:', e);
    }
    setRefreshing(false);
  };

  const groups = groupsData?.groups || [];
  const templates = templatesData?.templates || [];
  const selectedTemplate = templates.find((t) => t.name === formData.template_name);

  // Extract template variables ({{1}}, {{2}}, etc.) from BODY and HEADER
  const templateVars = [];
  const headerVars = [];
  if (selectedTemplate) {
    const bodyComponent = selectedTemplate.components?.find((c) => c.type === 'BODY');
    if (bodyComponent?.text) {
      const matches = bodyComponent.text.match(/\{\{(\d+)\}\}/g) || [];
      matches.forEach((m) => {
        const num = m.replace(/[{}]/g, '');
        if (!templateVars.includes(num)) templateVars.push(num);
      });
    }
    const headerComponent = selectedTemplate.components?.find((c) => c.type === 'HEADER');
    if (headerComponent?.text) {
      const matches = headerComponent.text.match(/\{\{(\d+)\}\}/g) || [];
      matches.forEach((m) => {
        const num = m.replace(/[{}]/g, '');
        if (!headerVars.includes(num)) headerVars.push(num);
      });
    }
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formData.name,
        contact_group: formData.contact_group || null,
        template_name: formData.template_name,
        template_vars: formData.template_vars,
        send_rate: formData.send_rate,
        scheduled_at: formData.sendNow ? null : formData.scheduled_at,
      };
      const result = await createCampaign(payload);
      const campaignId = result.data?.id;
      if (campaignId) {
        await launchCampaign(campaignId, {
          send_rate: formData.send_rate,
          scheduled_at: formData.sendNow ? null : formData.scheduled_at,
        });
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onClose();
      setStep(0);
      setFormData({
        name: '', contact_group: '', template_name: '',
        template_vars: {}, send_rate: 1, scheduled_at: null, sendNow: true,
      });
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const canProceed = () => {
    switch (step) {
      case 0: return formData.name.trim().length > 0;
      case 1: return formData.template_name.length > 0;
      case 2: return true;
      case 3: return formData.sendNow || formData.scheduled_at;
      case 4: return true;
      default: return false;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" id="create-campaign-modal">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-navy-900/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-navy-100">
          <div>
            <h2 className="font-display text-lg font-bold text-navy-900">New Campaign</h2>
            <p className="text-xs text-navy-400">{STEPS[step].description}</p>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X size={20} />
          </button>
        </div>

        {/* Progress */}
        <div className="flex gap-1 px-4 pt-3">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? 'bg-gold-500' : 'bg-navy-100'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="p-4 min-h-[300px] overflow-y-auto">
          {/* Step 1: Name & Group */}
          {step === 0 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="label">Campaign Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Powai Tower Launch"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Contact Group</label>
                <select
                  className="input-field"
                  value={formData.contact_group}
                  onChange={(e) => setFormData({ ...formData, contact_group: e.target.value })}
                >
                  <option value="">All Contacts</option>
                  {groups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Template */}
          {step === 1 && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex justify-end">
                <button
                  onClick={handleRefreshTemplates}
                  disabled={refreshing}
                  className="text-xs text-gold-600 hover:text-gold-700 font-medium flex items-center gap-1"
                >
                  {refreshing ? (
                    <><span className="w-3 h-3 border-2 border-gold-300 border-t-gold-600 rounded-full animate-spin" /> Refreshing...</>
                  ) : (
                    '↻ Refresh Templates'
                  )}
                </button>
              </div>
              {templatesLoading || refreshing ? (
                <div className="flex items-center justify-center py-8">
                  <span className="w-6 h-6 border-2 border-navy-200 border-t-navy-500 rounded-full animate-spin" />
                </div>
              ) : templates.length === 0 ? (
                <div className="p-4 bg-gold-50 rounded-xl">
                  <p className="text-sm text-gold-700 font-medium">No templates found</p>
                  <p className="text-xs text-gold-600 mt-1">
                    Create templates in Meta Business Manager first, then they'll appear here.
                  </p>
                </div>
              ) : (
                templates
                  .filter((t) => t.status === 'APPROVED')
                  .map((t) => (
                    <button
                      key={t.name}
                      onClick={() => setFormData({ ...formData, template_name: t.name })}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-200 ${
                        formData.template_name === t.name
                          ? 'border-gold-500 bg-gold-50'
                          : 'border-navy-100 hover:border-navy-200'
                      }`}
                    >
                      <p className="font-medium text-sm text-navy-900">{t.name}</p>
                      <p className="text-xs text-navy-400 mt-0.5">
                        {t.language} · {t.category}
                      </p>
                      {t.components?.find((c) => c.type === 'BODY')?.text && (
                        <p className="text-xs text-navy-500 mt-2 line-clamp-2">
                          {t.components.find((c) => c.type === 'BODY').text}
                        </p>
                      )}
                    </button>
                  ))
              )}
            </div>
          )}

          {/* Step 3: Variables */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              {templateVars.length === 0 && headerVars.length === 0 ? (
                <div className="p-4 bg-navy-50 rounded-xl">
                  <p className="text-sm text-navy-600">
                    This template has no variables. Skip to next step.
                  </p>
                </div>
              ) : (
                <>
                  {headerVars.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-navy-500 uppercase tracking-wider">Header Variables</p>
                      {headerVars.map((varNum) => (
                        <div key={`h-${varNum}`}>
                          <label className="label">{`Header {{${varNum}}} → Contact Field`}</label>
                          <select
                            className="input-field"
                            value={formData.template_vars[`header_${varNum}`] || ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                template_vars: { ...formData.template_vars, [`header_${varNum}`]: e.target.value },
                              })
                            }
                          >
                            <option value="">Select field...</option>
                            <option value="name">Name</option>
                            <option value="phone">Phone</option>
                            <option value="group_name">Group</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                  {templateVars.length > 0 && (
                    <div className="space-y-3">
                      {headerVars.length > 0 && (
                        <p className="text-xs font-semibold text-navy-500 uppercase tracking-wider">Body Variables</p>
                      )}
                      {templateVars.map((varNum) => (
                        <div key={varNum}>
                          <label className="label">{'{{' + varNum + '}} → Contact Field'}</label>
                          <select
                            className="input-field"
                            value={formData.template_vars[varNum] || ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                template_vars: { ...formData.template_vars, [varNum]: e.target.value },
                              })
                            }
                          >
                            <option value="">Select field...</option>
                            <option value="name">Name</option>
                            <option value="phone">Phone</option>
                            <option value="group_name">Group</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 4: Schedule */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setFormData({ ...formData, sendNow: true })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    formData.sendNow ? 'border-gold-500 bg-gold-50' : 'border-navy-100'
                  }`}
                >
                  <Zap size={20} className={formData.sendNow ? 'text-gold-600' : 'text-navy-400'} />
                  <p className="font-medium text-sm text-navy-900 mt-2">Send Now</p>
                  <p className="text-xs text-navy-400 mt-0.5">Start immediately</p>
                </button>
                <button
                  onClick={() => setFormData({ ...formData, sendNow: false })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    !formData.sendNow ? 'border-gold-500 bg-gold-50' : 'border-navy-100'
                  }`}
                >
                  <Clock size={20} className={!formData.sendNow ? 'text-gold-600' : 'text-navy-400'} />
                  <p className="font-medium text-sm text-navy-900 mt-2">Schedule</p>
                  <p className="text-xs text-navy-400 mt-0.5">Pick date & time</p>
                </button>
              </div>

              {!formData.sendNow && (
                <div>
                  <label className="label">Date & Time</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={formData.scheduled_at || ''}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="label">Send Speed</label>
                <div className="space-y-2">
                  {SEND_SPEEDS.map(({ value, label, description }) => (
                    <button
                      key={value}
                      onClick={() => setFormData({ ...formData, send_rate: value })}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                        formData.send_rate === value
                          ? 'border-gold-500 bg-gold-50'
                          : 'border-navy-100 hover:border-navy-200'
                      }`}
                    >
                      <p className="text-sm font-medium text-navy-900">{label}</p>
                      <p className="text-xs text-navy-400">{description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Confirm */}
          {step === 4 && (
            <div className="space-y-3 animate-fade-in">
              <div className="card !bg-navy-50">
                <h4 className="text-xs font-semibold text-navy-500 uppercase tracking-wider mb-3">Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-navy-500">Campaign</span>
                    <span className="text-sm font-medium text-navy-900">{formData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-navy-500">Group</span>
                    <span className="text-sm font-medium text-navy-900">
                      {formData.contact_group || 'All Contacts'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-navy-500">Template</span>
                    <span className="text-sm font-medium text-navy-900">{formData.template_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-navy-500">Speed</span>
                    <span className="text-sm font-medium text-navy-900">
                      {SEND_SPEEDS.find((s) => s.value === formData.send_rate)?.label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-navy-500">Schedule</span>
                    <span className="text-sm font-medium text-navy-900">
                      {formData.sendNow ? 'Immediately' : new Date(formData.scheduled_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-danger-light rounded-xl">
                  <AlertCircle size={16} className="text-danger flex-shrink-0" />
                  <p className="text-sm text-danger-dark">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-4 border-t border-navy-100">
          {step > 0 && (
            <button
              onClick={() => { setStep(step - 1); setError(null); }}
              className="btn-secondary flex items-center gap-1"
            >
              <ChevronLeft size={16} /> Back
            </button>
          )}
          <div className="flex-1" />
          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="btn-primary flex items-center gap-1"
            >
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="btn-gold flex items-center gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Check size={16} />
                  {formData.sendNow ? 'Launch Campaign' : 'Schedule Campaign'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

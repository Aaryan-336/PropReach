import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings as SettingsIcon,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Loader2,
  Link2,
  Shield,
  Wifi,
  WifiOff,
  Copy,
  Check,
} from 'lucide-react';
import { fetchSettings, saveSettings, testConnection } from '../lib/api';

export default function Settings() {
  const queryClient = useQueryClient();
  const [showToken, setShowToken] = useState(false);
  const [form, setForm] = useState({
    waba_id: '',
    phone_number_id: '',
    access_token: '',
    webhook_verify_token: '',
  });
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const isConfigured = settings?.is_configured || false;

  useEffect(() => {
    if (settings) {
      setForm({
        waba_id: settings.waba_id || '',
        phone_number_id: settings.phone_number_id || '',
        access_token: '', // Don't pre-fill token for security
        webhook_verify_token: settings.webhook_verify_token || '',
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data) => saveSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setDirty(false);
    },
  });

  const testMutation = useMutation({
    mutationFn: testConnection,
  });

  const handleSave = () => {
    // Only send fields that have values (don't overwrite with empty)
    const payload = {};
    if (form.waba_id) payload.waba_id = form.waba_id;
    if (form.phone_number_id) payload.phone_number_id = form.phone_number_id;
    if (form.access_token) payload.access_token = form.access_token;
    if (form.webhook_verify_token) payload.webhook_verify_token = form.webhook_verify_token;
    saveMutation.mutate(payload);
  };

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
    setDirty(true);
  };

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
  const webhookUrl = `${backendUrl}/webhook/whatsapp`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="page-container flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-navy-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-container" id="settings-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure your WhatsApp Business API</p>
      </div>

      {/* Status Banner */}
      <div className={`card mb-6 flex items-center gap-3 ${isConfigured ? '!bg-success-light' : '!bg-gold-50'}`}>
        {isConfigured ? (
          <>
            <CheckCircle size={20} className="text-success flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-success-dark">Connected</p>
              <p className="text-xs text-success">WhatsApp API is configured and ready</p>
            </div>
          </>
        ) : (
          <>
            <AlertCircle size={20} className="text-gold-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gold-700">Setup Required</p>
              <p className="text-xs text-gold-600">Enter your WhatsApp API credentials below to get started</p>
            </div>
          </>
        )}
      </div>

      {/* API Credentials Form */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-navy-500" />
          <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
            WhatsApp API Credentials
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">WhatsApp Business Account ID</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. 123456789012345"
              value={form.waba_id}
              onChange={(e) => handleChange('waba_id', e.target.value)}
            />
            {settings?.waba_id && !form.waba_id && (
              <p className="text-[11px] text-navy-400 mt-1">Currently set: {settings.waba_id}</p>
            )}
          </div>

          <div>
            <label className="label">Phone Number ID</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. 109876543210987"
              value={form.phone_number_id}
              onChange={(e) => handleChange('phone_number_id', e.target.value)}
            />
            {settings?.phone_number_id && !form.phone_number_id && (
              <p className="text-[11px] text-navy-400 mt-1">Currently set: {settings.phone_number_id}</p>
            )}
          </div>

          <div>
            <label className="label">Permanent Access Token</label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                className="input-field !pr-12"
                placeholder={settings?.access_token_masked || 'Paste your access token...'}
                value={form.access_token}
                onChange={(e) => handleChange('access_token', e.target.value)}
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-600"
              >
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {settings?.access_token_masked && (
              <p className="text-[11px] text-navy-400 mt-1">
                Current: {settings.access_token_masked} · Leave blank to keep existing
              </p>
            )}
          </div>

          <div>
            <label className="label">Webhook Verify Token</label>
            <input
              type="text"
              className="input-field"
              placeholder="Set a custom verify token"
              value={form.webhook_verify_token}
              onChange={(e) => handleChange('webhook_verify_token', e.target.value)}
            />
            <p className="text-[11px] text-navy-400 mt-1">
              Must match the WEBHOOK_VERIFY_TOKEN in your Railway environment variables
            </p>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!dirty || saveMutation.isPending}
          className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Saving...
            </>
          ) : saveMutation.isSuccess ? (
            <>
              <CheckCircle size={16} /> Saved!
            </>
          ) : (
            'Save Credentials'
          )}
        </button>

        {saveMutation.isError && (
          <p className="text-xs text-danger mt-2 text-center">{saveMutation.error.message}</p>
        )}
      </div>

      {/* Webhook URL */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Link2 size={16} className="text-navy-500" />
          <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
            Webhook URL
          </h2>
        </div>
        <p className="text-xs text-navy-400 mb-2">
          Set this as your Callback URL in Meta Developer Console
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="input-field !bg-navy-50 !text-navy-600 flex-1"
            value={webhookUrl}
            readOnly
          />
          <button onClick={copyWebhookUrl} className="btn-secondary !min-h-[44px] !px-3">
            {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      {/* Test Connection */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Wifi size={16} className="text-navy-500" />
          <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
            Connection Test
          </h2>
        </div>

        <button
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending || !isConfigured}
          className="btn-secondary w-full flex items-center justify-center gap-2"
        >
          {testMutation.isPending ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Testing...
            </>
          ) : (
            <>
              <Wifi size={16} /> Test Connection
            </>
          )}
        </button>

        {testMutation.isSuccess && (
          <div className={`mt-3 p-3 rounded-xl flex items-center gap-2 ${
            testMutation.data.success ? 'bg-success-light' : 'bg-danger-light'
          }`}>
            {testMutation.data.success ? (
              <>
                <CheckCircle size={16} className="text-success flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-success-dark">Connected!</p>
                  {testMutation.data.account_name && (
                    <p className="text-xs text-success">Account: {testMutation.data.account_name}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <WifiOff size={16} className="text-danger flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-danger-dark">Connection Failed</p>
                  <p className="text-xs text-danger">{testMutation.data.message}</p>
                </div>
              </>
            )}
          </div>
        )}

        {!isConfigured && (
          <p className="text-xs text-navy-400 mt-2 text-center">
            Save your credentials first to test the connection
          </p>
        )}
      </div>

      {/* App Info */}
      <div className="text-center py-4">
        <p className="text-xs text-navy-300">PropReach v1.0.0</p>
        <p className="text-[10px] text-navy-200 mt-0.5">WhatsApp Broadcast & CRM</p>
      </div>
    </div>
  );
}

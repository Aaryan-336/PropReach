import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Search,
  Plus,
  Shield,
  ShieldOff,
  Trash2,
  X,
  UserPlus,
} from 'lucide-react';
import { fetchContacts, fetchGroups, createContact, toggleBlockContact, deleteContact } from '../lib/api';
import ContactUploader from '../components/ContactUploader';

// Color palette for group card headers — cycles through these
const GROUP_COLORS = [
  { from: '#1a1f36', to: '#2d3352' },  // Navy
  { from: '#7c3aed', to: '#a78bfa' },  // Purple
  { from: '#0891b2', to: '#22d3ee' },  // Cyan
  { from: '#b45309', to: '#f59e0b' },  // Amber
  { from: '#059669', to: '#34d399' },  // Emerald
  { from: '#dc2626', to: '#f87171' },  // Red
  { from: '#4f46e5', to: '#818cf8' },  // Indigo
  { from: '#0d9488', to: '#5eead4' },  // Teal
  { from: '#c026d3', to: '#e879f9' },  // Fuchsia
  { from: '#ea580c', to: '#fb923c' },  // Orange
];

function getGroupColor(index) {
  return GROUP_COLORS[index % GROUP_COLORS.length];
}

function ContactRow({ contact, onBlock, onDelete }) {
  return (
    <div
      className={`flex items-center gap-2.5 px-3.5 py-2.5 border-b border-navy-50 last:border-b-0 transition-colors hover:bg-navy-50/50 ${
        contact.is_blocked ? 'opacity-50' : ''
      }`}
    >
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        contact.is_blocked ? 'bg-danger/10' : 'bg-navy-100'
      }`}>
        <span className={`text-[11px] font-bold ${
          contact.is_blocked ? 'text-danger' : 'text-navy-500'
        }`}>
          {(contact.name || contact.phone || '?')[0].toUpperCase()}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-navy-900 truncate leading-tight">
          {contact.name || 'No Name'}
        </p>
        <p className="text-[10px] text-navy-400 leading-tight mt-0.5">{contact.phone}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-0.5 flex-shrink-0">
        <button
          onClick={() => onBlock(contact.id)}
          className="p-1.5 rounded-lg hover:bg-navy-100 transition-colors"
          title={contact.is_blocked ? 'Unblock' : 'Block'}
        >
          {contact.is_blocked ? (
            <ShieldOff size={12} className="text-success" />
          ) : (
            <Shield size={12} className="text-navy-400" />
          )}
        </button>
        <button
          onClick={() => {
            if (window.confirm('Delete this contact?')) {
              onDelete(contact.id);
            }
          }}
          className="p-1.5 rounded-lg hover:bg-navy-100 transition-colors"
          title="Delete"
        >
          <Trash2 size={12} className="text-navy-400 hover:text-danger" />
        </button>
      </div>
    </div>
  );
}

export default function Contacts() {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [showBlocked, setShowBlocked] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', group_name: 'General' });
  const queryClient = useQueryClient();

  // Fetch all contacts (no pagination) for proper grouping
  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search, groupFilter, showBlocked],
    queryFn: () =>
      fetchContacts({
        page: 1,
        pageSize: 5000,
        search: search || undefined,
        group: groupFilter || undefined,
        blocked: showBlocked ? true : undefined,
      }),
  });

  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: fetchGroups,
  });

  const contacts = data?.items || [];
  const total = data?.total || 0;
  const groups = groupsData?.groups || [];

  // Group contacts by group_name for masonry display
  const groupedContacts = useMemo(() => {
    const grouped = {};
    contacts.forEach((contact) => {
      const gName = contact.group_name || 'General';
      if (!grouped[gName]) grouped[gName] = [];
      grouped[gName].push(contact);
    });
    // Sort groups alphabetically, but put "General" first
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === 'General') return -1;
      if (b === 'General') return 1;
      return a.localeCompare(b);
    });
    return sortedKeys.map((key) => ({ name: key, contacts: grouped[key] }));
  }, [contacts]);

  const addMutation = useMutation({
    mutationFn: () => createContact(newContact),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setShowAddForm(false);
      setNewContact({ name: '', phone: '', group_name: 'General' });
    },
  });

  const blockMutation = useMutation({
    mutationFn: toggleBlockContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  return (
    <div className="page-container" id="contacts-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="page-title">Contacts</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUploader(!showUploader)}
            className={`btn-icon ${showUploader ? '!bg-gold-50 !text-gold-600' : ''}`}
            title="Import CSV"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
      <p className="page-subtitle">{total} contacts total</p>

      {/* CSV Uploader */}
      {showUploader && (
        <div className="mb-4 animate-slide-up">
          <ContactUploader
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['contacts'] });
              queryClient.invalidateQueries({ queryKey: ['groups'] });
            }}
          />
        </div>
      )}

      {/* Search & Filters */}
      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-300" />
          <input
            type="text"
            className="input-field !pl-10"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy-500"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setGroupFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              !groupFilter ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 border border-navy-200'
            }`}
          >
            All Groups
          </button>
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => setGroupFilter(g)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                groupFilter === g ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 border border-navy-200'
              }`}
            >
              {g}
            </button>
          ))}
          <button
            onClick={() => { setShowBlocked(!showBlocked); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
              showBlocked ? 'bg-danger text-white' : 'bg-white text-navy-600 border border-navy-200'
            }`}
          >
            <Shield size={12} /> Blocked
          </button>
        </div>
      </div>

      {/* Add Contact Button */}
      <button
        onClick={() => setShowAddForm(!showAddForm)}
        className="w-full btn-secondary flex items-center justify-center gap-2 mb-4"
      >
        <UserPlus size={16} />
        Add Contact Manually
      </button>

      {/* Add Contact Form */}
      {showAddForm && (
        <div className="card mb-4 animate-slide-up">
          <div className="space-y-3">
            <div>
              <label className="label">Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="Contact name"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Phone *</label>
              <input
                type="tel"
                className="input-field"
                placeholder="919876543210"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Group</label>
              <select
                className="input-field"
                value={newContact.group_name}
                onChange={(e) => setNewContact({ ...newContact, group_name: e.target.value })}
              >
                <option value="General">General</option>
                {groups.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => addMutation.mutate()}
                disabled={!newContact.phone.trim() || addMutation.isPending}
                className="btn-primary flex-1"
              >
                {addMutation.isPending ? 'Adding...' : 'Add Contact'}
              </button>
              <button onClick={() => setShowAddForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
            {addMutation.isError && (
              <p className="text-xs text-danger">{addMutation.error.message}</p>
            )}
          </div>
        </div>
      )}

      {/* Contact List — Masonry Grouped Layout */}
      {isLoading ? (
        <div className="masonry-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="masonry-item">
              <div className="group-card">
                <div className="group-card-header animate-pulse" style={{ height: 40 }} />
                <div className="p-3 space-y-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-8 bg-navy-50 rounded-lg animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : groupedContacts.length > 0 ? (
        <div className={groupFilter ? 'space-y-3' : 'masonry-grid'}>
          {groupedContacts.map((group, groupIndex) => {
            const color = getGroupColor(groupIndex);
            return (
              <div key={group.name} className={`${groupFilter ? '' : 'masonry-item'} animate-fade-in`}>
                <div className="group-card">
                  {/* Group Header */}
                  <div
                    className="group-card-header"
                    style={{
                      '--group-color-from': color.from,
                      '--group-color-to': color.to,
                    }}
                  >
                    <h3>{group.name}</h3>
                    <span className="group-count">
                      {group.contacts.length}
                    </span>
                  </div>

                  {/* Contacts in this group */}
                  <div>
                    {group.contacts.map((contact) => (
                      <ContactRow
                        key={contact.id}
                        contact={contact}
                        onBlock={(id) => blockMutation.mutate(id)}
                        onDelete={(id) => deleteMutation.mutate(id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <Users className="empty-state-icon" />
          <p className="text-sm font-medium text-navy-600 mb-1">
            {search || groupFilter ? 'No contacts match your filters' : 'No contacts yet'}
          </p>
          <p className="empty-state-text">
            Import a CSV or add contacts manually to get started
          </p>
        </div>
      )}
    </div>
  );
}

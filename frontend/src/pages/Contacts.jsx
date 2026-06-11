import { useState } from 'react';
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
  Filter,
} from 'lucide-react';
import { fetchContacts, fetchGroups, createContact, toggleBlockContact, deleteContact } from '../lib/api';
import ContactUploader from '../components/ContactUploader';

export default function Contacts() {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [showBlocked, setShowBlocked] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', group_name: 'General' });
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', page, search, groupFilter, showBlocked],
    queryFn: () =>
      fetchContacts({
        page,
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
  const totalPages = Math.ceil(total / 50);

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
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
            onClick={() => { setGroupFilter(''); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              !groupFilter ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 border border-navy-200'
            }`}
          >
            All Groups
          </button>
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => { setGroupFilter(g); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                groupFilter === g ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 border border-navy-200'
              }`}
            >
              {g}
            </button>
          ))}
          <button
            onClick={() => { setShowBlocked(!showBlocked); setPage(1); }}
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

      {/* Contact List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card h-[60px] animate-pulse bg-navy-50" />
          ))}
        </div>
      ) : contacts.length > 0 ? (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className={`card flex items-center gap-3 animate-fade-in ${
                contact.is_blocked ? 'opacity-60' : ''
              }`}
            >
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                contact.is_blocked ? 'bg-danger-light' : 'bg-navy-100'
              }`}>
                <span className={`text-sm font-bold ${
                  contact.is_blocked ? 'text-danger' : 'text-navy-500'
                }`}>
                  {(contact.name || contact.phone || '?')[0].toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-navy-900 truncate">
                  {contact.name || 'No Name'}
                </p>
                <p className="text-xs text-navy-400">{contact.phone}</p>
              </div>

              {/* Group badge */}
              <span className="text-[10px] font-semibold text-navy-400 bg-navy-50 px-2 py-0.5 rounded-full">
                {contact.group_name}
              </span>

              {/* Actions */}
              <div className="flex gap-1">
                <button
                  onClick={() => blockMutation.mutate(contact.id)}
                  className="btn-icon !w-8 !h-8"
                  title={contact.is_blocked ? 'Unblock' : 'Block'}
                >
                  {contact.is_blocked ? (
                    <ShieldOff size={14} className="text-success" />
                  ) : (
                    <Shield size={14} className="text-navy-400" />
                  )}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Delete this contact?')) {
                      deleteMutation.mutate(contact.id);
                    }
                  }}
                  className="btn-icon !w-8 !h-8"
                  title="Delete"
                >
                  <Trash2 size={14} className="text-navy-400 hover:text-danger" />
                </button>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn-secondary !py-2 !px-3 !min-h-0 text-xs"
              >
                Prev
              </button>
              <span className="text-xs text-navy-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="btn-secondary !py-2 !px-3 !min-h-0 text-xs"
              >
                Next
              </button>
            </div>
          )}
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

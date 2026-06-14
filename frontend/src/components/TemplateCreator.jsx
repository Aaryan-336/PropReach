import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bold,
  Italic,
  Eye,
  X,
  Check,
  AlertCircle,
  Plus,
  Upload,
  ChevronUp,
  Smile,
  Info,
  Phone,
  Globe,
  Settings,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { uploadTemplateMedia, createTemplate, deleteTemplate } from '../lib/api';
import 'emoji-picker-element';

export default function TemplateCreator({ initialTemplate = null, onBack }) {
  const queryClient = useQueryClient();
  
  // ── Form State ──────────────────────────────────────
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('en');
  const [category] = useState('MARKETING'); // pre-filled and locked

  // Header State
  const [headerType, setHeaderType] = useState('NONE'); // NONE | TEXT | IMAGE
  const [headerText, setHeaderText] = useState('');
  const [headerExample, setHeaderExample] = useState('');
  const [headerImageFile, setHeaderImageFile] = useState(null);
  const [headerImageThumbnail, setHeaderImageThumbnail] = useState(null);
  const [headerImageHandle, setHeaderImageHandle] = useState('');
  const [headerUploadProgress, setHeaderUploadProgress] = useState(null); // 'uploading' | 'success' | 'failed'
  const [headerUploadError, setHeaderUploadError] = useState('');

  // Body State
  const [bodyText, setBodyText] = useState(
    'Hi {{1}}, we have a new property in {{2}} starting at {{3}}. Interested in a site visit?'
  );
  const [varLabels, setVarLabels] = useState({
    '1': 'Contact Name',
    '2': 'Property Location',
    '3': 'Price'
  });
  const [exampleVars, setExampleVars] = useState({
    '1': 'Rahul',
    '2': 'Powai',
    '3': '₹85L'
  });
  const [showVarPopover, setShowVarPopover] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Footer State
  const [addFooter, setAddFooter] = useState(false);
  const [footerText, setFooterText] = useState('Reply STOP to unsubscribe');

  // Buttons State
  const [addButtons, setAddButtons] = useState(false);
  const [buttonType, setButtonType] = useState('QUICK_REPLY'); // QUICK_REPLY | CTA
  const [quickReplies, setQuickReplies] = useState(['I\'m Interested', 'Not Now']);
  const [ctaCallLabel, setCtaCallLabel] = useState('Call Us');
  const [ctaCallPhone, setCtaCallPhone] = useState('+919987502755');
  const [ctaUrlLabel, setCtaUrlLabel] = useState('Visit Website');
  const [ctaUrlValue, setCtaUrlValue] = useState('https://');
  const [enableCtaCall, setEnableCtaCall] = useState(true);
  const [enableCtaUrl, setEnableCtaUrl] = useState(false);

  // UI States
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [customVarName, setCustomVarName] = useState('');
  const [showCustomVarInput, setShowCustomVarInput] = useState(false);

  // Refs
  const textareaRef = useRef(null);
  const headerInputRef = useRef(null);
  const emojiPopoverRef = useRef(null);
  const varPopoverRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load pre-fill data if in edit & resubmit mode
  useEffect(() => {
    if (initialTemplate) {
      setName(initialTemplate.name || '');
      setLanguage(initialTemplate.language || 'en');
      
      const headerComp = initialTemplate.components?.find(c => c.type === 'HEADER');
      if (headerComp) {
        if (headerComp.format === 'TEXT') {
          setHeaderType('TEXT');
          setHeaderText(headerComp.text || '');
          setHeaderExample(headerComp.example?.header_text?.[0] || '');
        } else if (headerComp.format === 'IMAGE') {
          setHeaderType('IMAGE');
          // If we had a previous image, we can just clear it or show fallback
          setHeaderImageThumbnail(headerComp.example?.header_handle?.[0] || null);
          setHeaderImageHandle(headerComp.example?.header_handle?.[0] || '');
          setHeaderUploadProgress(headerComp.example?.header_handle?.[0] ? 'success' : null);
        }
      } else {
        setHeaderType('NONE');
      }

      const bodyComp = initialTemplate.components?.find(c => c.type === 'BODY');
      if (bodyComp) {
        setBodyText(bodyComp.text || '');
        // Extract example values
        const examples = bodyComp.example?.body_text?.[0] || [];
        const matches = bodyComp.text.match(/\{\{(\d+)\}\}/g) || [];
        const newExamples = {};
        const newLabels = {};
        matches.forEach((m, idx) => {
          const num = m.replace(/[{}]/g, '');
          newExamples[num] = examples[idx] || '';
          newLabels[num] = idx === 0 ? 'Contact Name' : idx === 1 ? 'Location' : idx === 2 ? 'Price' : `Variable ${num}`;
        });
        setExampleVars(newExamples);
        setVarLabels(newLabels);
      }

      const footerComp = initialTemplate.components?.find(c => c.type === 'FOOTER');
      if (footerComp) {
        setAddFooter(true);
        setFooterText(footerComp.text || '');
      } else {
        setAddFooter(false);
      }

      const buttonsComp = initialTemplate.components?.find(c => c.type === 'BUTTONS');
      if (buttonsComp) {
        setAddButtons(true);
        const firstBtn = buttonsComp.buttons?.[0];
        if (firstBtn?.type === 'QUICK_REPLY') {
          setButtonType('QUICK_REPLY');
          setQuickReplies(buttonsComp.buttons.map(b => b.text));
        } else {
          setButtonType('CTA');
          const callBtn = buttonsComp.buttons.find(b => b.type === 'PHONE_NUMBER');
          const urlBtn = buttonsComp.buttons.find(b => b.type === 'URL');
          if (callBtn) {
            setEnableCtaCall(true);
            setCtaCallLabel(callBtn.text || 'Call Us');
            setCtaCallPhone(callBtn.phone_number || '');
          } else {
            setEnableCtaCall(false);
          }
          if (urlBtn) {
            setEnableCtaUrl(true);
            setCtaUrlLabel(urlBtn.text || 'Visit Website');
            setCtaUrlValue(urlBtn.url || 'https://');
          } else {
            setEnableCtaUrl(false);
          }
        }
      } else {
        setAddButtons(false);
      }
    }
  }, [initialTemplate]);

  // Click outside handlers to close popovers
  useEffect(() => {
    function handleClickOutside(event) {
      if (emojiPopoverRef.current && !emojiPopoverRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
      if (varPopoverRef.current && !varPopoverRef.current.contains(event.target)) {
        setShowVarPopover(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Set up emoji picker event listener
  useEffect(() => {
    const picker = document.querySelector('emoji-picker');
    if (picker) {
      const handleEmoji = (event) => {
        const emoji = event.detail.unicode;
        insertAtCursor(bodyText, setBodyText, emoji, textareaRef);
        setShowEmojiPicker(false);
      };
      picker.addEventListener('emoji-click', handleEmoji);
      return () => picker.removeEventListener('emoji-click', handleEmoji);
    }
  }, [showEmojiPicker]);

  // Extract variables dynamically from body text
  const bodyVariables = [];
  const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
  matches.forEach((m) => {
    const num = m.replace(/[{}]/g, '');
    if (!bodyVariables.includes(num)) bodyVariables.push(num);
  });

  // Convert name format
  const handleNameChange = (e) => {
    const val = e.target.value
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    setName(val);
  };

  // Helper to insert text at cursor position
  const insertAtCursor = (textState, textSetter, insertText, inputRef) => {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart;
    const end = input.selectionEnd;
    const before = textState.substring(0, start);
    const after = textState.substring(end, textState.length);

    textSetter(before + insertText + after);
    
    // Set selection cursor back
    setTimeout(() => {
      input.focus();
      input.selectionStart = input.selectionEnd = start + insertText.length;
    }, 50);
  };

  // Insert Variable in Header (max 1 variable)
  const insertHeaderVar = () => {
    if (headerText.includes('{{1}}')) return;
    insertAtCursor(headerText, setHeaderText, '{{1}}', headerInputRef);
  };

  // Insert Variable in Body
  const handleInsertBodyVar = (label) => {
    // Determine next sequential variable index
    const numbers = bodyText.match(/\{\{(\d+)\}\}/g) || [];
    const idxs = numbers.map(m => parseInt(m.replace(/[{}]/g, ''), 10));
    const nextIdx = idxs.length > 0 ? Math.max(...idxs) + 1 : 1;
    
    // Set labels & defaults
    setVarLabels(prev => ({ ...prev, [nextIdx]: label }));
    setExampleVars(prev => ({
      ...prev,
      [nextIdx]: label === 'Contact Name' ? 'Rahul' : label === 'Property Location' ? 'Powai' : label === 'Price' ? '₹85L' : 'Example'
    }));

    // Insert
    insertAtCursor(bodyText, setBodyText, `{{${nextIdx}}}`, textareaRef);
    setShowVarPopover(false);
  };

  // Handle header image upload
  const mediaUploadMutation = useMutation({
    mutationFn: (file) => uploadTemplateMedia(file),
    onMutate: () => {
      setHeaderUploadProgress('uploading');
      setHeaderUploadError('');
    },
    onSuccess: (data) => {
      setHeaderUploadProgress('success');
      setHeaderImageHandle(data.handle);
    },
    onError: (err) => {
      setHeaderUploadProgress('failed');
      setHeaderUploadError(err.message || 'Media upload failed');
    }
  });

  const handleImageFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setHeaderUploadProgress('failed');
      setHeaderUploadError('Only JPG or PNG images are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setHeaderUploadProgress('failed');
      setHeaderUploadError('Image size exceeds the 5MB limit.');
      return;
    }

    setHeaderImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setHeaderImageThumbnail(reader.result);
    };
    reader.readAsDataURL(file);

    // Call background upload
    mediaUploadMutation.mutate(file);
  };

  // Buttons Configuration Builders
  const handleAddQuickReply = () => {
    if (quickReplies.length >= 3) return;
    setQuickReplies([...quickReplies, '']);
  };

  const handleRemoveQuickReply = (idx) => {
    setQuickReplies(quickReplies.filter((_, i) => i !== idx));
  };

  const handleQuickReplyTextChange = (idx, val) => {
    const updated = [...quickReplies];
    updated[idx] = val.slice(0, 20); // enforce max 20 chars
    setQuickReplies(updated);
  };

  // Submit Template Mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (payload) => {
      // If we are in edit mode, delete the old template first to avoid duplicate name collision
      if (initialTemplate) {
        try {
          await deleteTemplate(initialTemplate.name);
        } catch (e) {
          console.warn('Failed to delete old template before recreate (it might not exist):', e);
        }
      }
      return createTemplate(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsSubmitted(true);
    },
    onError: (err) => {
      setFormErrors({ submit: err.message || 'Template submission failed' });
    }
  });

  // Validate and Submit
  const handleSubmit = () => {
    const errors = {};

    if (!name.trim()) {
      errors.name = 'Template name is required';
    } else if (name.length < 3) {
      errors.name = 'Template name must be at least 3 characters';
    }

    if (!bodyText.trim()) {
      errors.body = 'Template body message is required';
    }

    // Check all body variables have example values filled
    bodyVariables.forEach((num) => {
      if (!exampleVars[num] || !exampleVars[num].trim()) {
        errors[`var_${num}`] = `Example value for {{${num}}} is required`;
      }
    });

    // If text header has variable, require example
    if (headerType === 'TEXT' && headerText.includes('{{1}}') && (!headerExample || !headerExample.trim())) {
      errors.header_example = 'Example value for header variable is required';
    }

    // If image header, verify upload success
    if (headerType === 'IMAGE' && headerUploadProgress !== 'success') {
      errors.header_image = 'Please upload a valid header image first';
    }

    // Enforce footer character limit
    if (addFooter && footerText.length > 60) {
      errors.footer = 'Footer cannot exceed 60 characters';
    }

    // Quick replies validation
    if (addButtons && buttonType === 'QUICK_REPLY') {
      if (quickReplies.length === 0) {
        errors.buttons = 'At least 1 Quick Reply button is required';
      } else if (quickReplies.some(btn => !btn.trim())) {
        errors.buttons = 'Button text cannot be empty';
      }
    }

    // Call to Action validation
    if (addButtons && buttonType === 'CTA') {
      if (!enableCtaCall && !enableCtaUrl) {
        errors.buttons = 'Please enable at least one Call to Action button';
      }
      if (enableCtaCall) {
        if (!ctaCallLabel.trim()) errors.cta_call_label = 'Call button label is required';
        if (!ctaCallPhone.trim()) errors.cta_call_phone = 'Phone number is required';
      }
      if (enableCtaUrl) {
        if (!ctaUrlLabel.trim()) errors.cta_url_label = 'Website button label is required';
        if (!ctaUrlValue.trim() || ctaUrlValue === 'https://') errors.cta_url_value = 'Website URL is required';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      
      // Auto-scroll to the first error
      setTimeout(() => {
        const firstErrorEl = document.querySelector('.text-danger');
        if (firstErrorEl) {
          firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    setFormErrors({});

    // ── Build Meta Payload ────────────────────────────
    const components = [];

    // 1. Header component
    if (headerType === 'TEXT' && headerText.trim()) {
      const hComp = {
        type: 'HEADER',
        format: 'TEXT',
        text: headerText,
      };
      if (headerText.includes('{{1}}')) {
        hComp.example = {
          header_text: [headerExample]
        };
      }
      components.push(hComp);
    } else if (headerType === 'IMAGE' && headerImageHandle) {
      components.push({
        type: 'HEADER',
        format: 'IMAGE',
        example: {
          header_handle: [headerImageHandle]
        }
      });
    }

    // 2. Body component
    const bodyComp = {
      type: 'BODY',
      text: bodyText,
    };
    if (bodyVariables.length > 0) {
      // Map example values sequentially matching variables sorted list
      const examples = bodyVariables.map(num => exampleVars[num] || 'value');
      bodyComp.example = {
        body_text: [examples]
      };
    }
    components.push(bodyComp);

    // 3. Footer component
    if (addFooter && footerText.trim()) {
      components.push({
        type: 'FOOTER',
        text: footerText
      });
    }

    // 4. Buttons component
    if (addButtons) {
      const btns = [];
      if (buttonType === 'QUICK_REPLY') {
        quickReplies.forEach(btnText => {
          if (btnText.trim()) {
            btns.push({
              type: 'QUICK_REPLY',
              text: btnText
            });
          }
        });
      } else {
        // CTA buttons
        if (enableCtaCall && ctaCallLabel.trim() && ctaCallPhone.trim()) {
          btns.push({
            type: 'PHONE_NUMBER',
            text: ctaCallLabel,
            phone_number: ctaCallPhone
          });
        }
        if (enableCtaUrl && ctaUrlLabel.trim() && ctaUrlValue.trim()) {
          btns.push({
            type: 'URL',
            text: ctaUrlLabel,
            url: ctaUrlValue
          });
        }
      }
      if (btns.length > 0) {
        components.push({
          type: 'BUTTONS',
          buttons: btns
        });
      }
    }

    const payload = {
      name: name,
      language: language,
      category: category,
      components: components
    };

    createTemplateMutation.mutate(payload);
  };

  // Highlight formatting (bold/italic) in preview text
  const formatTextForPreview = (text) => {
    if (!text) return '';
    
    // Replace variables with example values
    let formatted = text;
    bodyVariables.forEach((num) => {
      const val = exampleVars[num] || `[${varLabels[num] || `Variable ${num}`}]`;
      formatted = formatted.replace(new RegExp(`\\{\\{${num}\\}\\}`, 'g'), val);
    });
    
    // Bold: *text* -> <strong>text</strong>
    formatted = formatted.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    // Italic: _text_ -> <em>text</em>
    formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
    
    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  // Bold selected text in textarea
  const wrapSelection = (wrapper) => {
    const input = textareaRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const val = bodyText;
    const selected = val.substring(start, end);
    const wrapped = `${wrapper}${selected}${wrapper}`;
    setBodyText(val.substring(0, start) + wrapped + val.substring(end));
    setTimeout(() => {
      input.focus();
      input.selectionStart = start;
      input.selectionEnd = start + wrapped.length;
    }, 50);
  };

  // Confirmation screen view
  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center animate-fade-in py-10">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center text-success mb-6">
          <Check size={36} strokeWidth={3} />
        </div>
        <h2 className="text-2xl font-bold font-display text-navy-900 mb-2">Template Submitted</h2>
        <p className="text-sm text-navy-500 max-w-sm mb-8 leading-relaxed">
          Your message template <strong>{name}</strong> has been successfully submitted to WhatsApp for approval. WhatsApp usually reviews templates in under 24 hours.
        </p>
        <div className="flex flex-col w-full max-w-xs gap-3">
          <button onClick={onBack} className="btn-gold w-full flex items-center justify-center gap-2">
            View All Templates
          </button>
          <button 
            onClick={() => {
              setIsSubmitted(false);
              setName('');
              setHeaderType('NONE');
              setHeaderText('');
              setHeaderExample('');
              setHeaderImageThumbnail(null);
              setHeaderImageHandle('');
              setHeaderUploadProgress(null);
              setBodyText('Hi {{1}}, we have a new property in {{2}} starting at {{3}}. Interested in a site visit?');
              setVarLabels({ '1': 'Contact Name', '2': 'Property Location', '3': 'Price' });
              setExampleVars({ '1': 'Rahul', '2': 'Powai', '3': '₹85L' });
              setAddFooter(false);
              setAddButtons(false);
            }} 
            className="btn-secondary w-full"
          >
            Create Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-16" id="template-creator-page">
      {/* Back Nav Header */}
      <div className="flex items-center gap-2 mb-4 border-b border-navy-100 pb-3">
        <button onClick={onBack} className="btn-icon">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-lg font-bold font-display text-navy-900">
            {initialTemplate ? 'Edit & Resubmit Template' : 'Create Message Template'}
          </h2>
          <p className="text-xs text-navy-400">Design an approved WhatsApp template</p>
        </div>
      </div>

      {/* Main Side-by-Side (Desktop) / Vertical Stack (Mobile) Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Left: Form Builder */}
        <div className="space-y-6">
          
          {/* Section 1: Template Basics */}
          <div className="card space-y-4">
            <h3 className="text-sm font-bold font-display text-navy-800 uppercase tracking-wider border-b border-navy-50 pb-2">
              1. Template Basics
            </h3>
            
            <div>
              <label className="label">Template Name</label>
              <input
                type="text"
                disabled={!!initialTemplate}
                className="input-field disabled:opacity-50"
                placeholder="e.g. property_launch_offer"
                value={name}
                onChange={handleNameChange}
              />
              <p className="text-[10px] text-navy-400 mt-1">
                Only lowercase letters, numbers, and underscores are allowed.
              </p>
              {formErrors.name && (
                <p className="text-xs text-danger mt-1 font-semibold flex items-center gap-1">
                  <AlertCircle size={12} /> {formErrors.name}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Language</label>
                <select
                  className="input-field"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="mr">Marathi</option>
                  <option value="gu">Gujarati</option>
                </select>
              </div>
              <div>
                <label className="label">Category</label>
                <div className="h-[52px] border border-navy-100 rounded-xl bg-navy-50 flex items-center px-4">
                  <span className="px-2 py-0.5 bg-navy-200 text-navy-700 text-[10px] font-bold uppercase rounded-md">
                    {category}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Header Configuration */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-navy-50 pb-2">
              <h3 className="text-sm font-bold font-display text-navy-800 uppercase tracking-wider">
                2. Header <span className="text-[10px] text-navy-400 font-normal italic lowercase">(optional)</span>
              </h3>
            </div>

            {/* Toggle Chips */}
            <div className="flex bg-navy-50 p-1 rounded-xl">
              {['NONE', 'TEXT', 'IMAGE'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setHeaderType(type)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    headerType === type
                      ? 'bg-white text-navy-950 shadow-sm'
                      : 'text-navy-400 hover:text-navy-600'
                  }`}
                >
                  {type === 'NONE' ? 'None' : type === 'TEXT' ? 'Text' : 'Image'}
                </button>
              ))}
            </div>

            {/* If Header is Text */}
            {headerType === 'TEXT' && (
              <div className="space-y-3 animate-fade-in">
                <div>
                  <label className="label">Header Text</label>
                  <div className="flex gap-2">
                    <input
                      ref={headerInputRef}
                      type="text"
                      maxLength={60}
                      className="input-field flex-1"
                      placeholder="e.g. New Launch at Powai"
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={insertHeaderVar}
                      disabled={headerText.includes('{{1}}')}
                      className="btn-secondary !py-2 !px-3 font-mono font-bold text-xs"
                      title={headerText.includes('{{1}}') ? 'Only 1 variable allowed in header' : 'Insert header variable'}
                    >
                      + Variable
                    </button>
                  </div>
                </div>

                {headerText.includes('{{1}}') && (
                  <div className="p-3 bg-navy-50 rounded-xl space-y-2 border border-navy-100 animate-fade-in">
                    <label className="label !mb-0 font-bold">Example for Header Variable {"{{1}}"}</label>
                    <input
                      type="text"
                      className="input-field !min-h-[40px] !py-2 bg-white"
                      placeholder="e.g. Rahul or Balaji Estate"
                      value={headerExample}
                      onChange={(e) => setHeaderExample(e.target.value)}
                    />
                    {formErrors.header_example && (
                      <p className="text-xs text-danger mt-1 font-semibold flex items-center gap-1">
                        <AlertCircle size={12} /> {formErrors.header_example}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* If Header is Image */}
            {headerType === 'IMAGE' && (
              <div className="space-y-3 animate-fade-in">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={handleImageFileSelect}
                />
                
                {!headerImageThumbnail ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-[21/9] border-2 border-dashed border-navy-200 rounded-xl hover:border-navy-300 transition-colors flex flex-col items-center justify-center gap-2 bg-navy-50/50"
                  >
                    <Upload size={24} className="text-navy-400" />
                    <span className="text-xs font-semibold text-navy-600">Tap to upload property photo</span>
                    <span className="text-[9px] text-navy-400">JPG or PNG, max 5MB</span>
                  </button>
                ) : (
                  <div className="relative aspect-[21/9] w-full rounded-xl overflow-hidden border border-navy-200">
                    <img src={headerImageThumbnail} alt="Header" className="w-full h-full object-cover" />
                    
                    {/* Status Overlays */}
                    {headerUploadProgress === 'uploading' && (
                      <div className="absolute inset-0 bg-navy-900/60 flex flex-col items-center justify-center text-white gap-2">
                        <RefreshCw className="animate-spin" size={20} />
                        <span className="text-[10px] font-semibold">Uploading to WhatsApp...</span>
                      </div>
                    )}

                    {headerUploadProgress === 'success' && (
                      <div className="absolute top-2 left-2 bg-success text-white px-2 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-1 shadow-sm">
                        <Check size={10} strokeWidth={3} /> Ready
                      </div>
                    )}

                    {headerUploadProgress === 'failed' && (
                      <div className="absolute inset-0 bg-danger/80 flex flex-col items-center justify-center text-white p-4 text-center gap-1">
                        <span className="text-xs font-bold">Upload failed</span>
                        <span className="text-[10px] opacity-90">{headerUploadError}</span>
                        <button
                          onClick={() => mediaUploadMutation.mutate(headerImageFile)}
                          className="mt-2 text-[10px] bg-white text-danger font-bold px-3 py-1 rounded-lg shadow-sm"
                        >
                          Tap to Retry
                        </button>
                      </div>
                    )}

                    {/* Delete button */}
                    {headerUploadProgress !== 'uploading' && (
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderImageFile(null);
                          setHeaderImageThumbnail(null);
                          setHeaderImageHandle('');
                          setHeaderUploadProgress(null);
                        }}
                        className="absolute top-2 right-2 w-7 h-7 bg-navy-900/60 rounded-full flex items-center justify-center text-white hover:bg-navy-900 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )}
                {formErrors.header_image && (
                  <p className="text-xs text-danger mt-1 font-semibold flex items-center gap-1">
                    <AlertCircle size={12} /> {formErrors.header_image}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Body Content (Required) */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-navy-50 pb-2">
              <h3 className="text-sm font-bold font-display text-navy-800 uppercase tracking-wider">
                3. Body Message <span className="text-danger">*</span>
              </h3>
              <span className="text-[10px] font-semibold text-navy-400">
                {bodyText.length} / 1024
              </span>
            </div>

            {/* Textarea Toolbar */}
            <div className="flex items-center gap-1.5 border-b border-navy-100 pb-2">
              <button
                type="button"
                onClick={() => wrapSelection('*')}
                className="btn-icon !w-8 !h-8 bg-navy-50 hover:bg-navy-100 border border-navy-200"
                title="Bold"
              >
                <Bold size={14} className="text-navy-700" />
              </button>
              <button
                type="button"
                onClick={() => wrapSelection('_')}
                className="btn-icon !w-8 !h-8 bg-navy-50 hover:bg-navy-100 border border-navy-200"
                title="Italic"
              >
                <Italic size={14} className="text-navy-700" />
              </button>
              
              {/* Personalised Variable Button */}
              <div className="relative" ref={varPopoverRef}>
                <button
                  type="button"
                  onClick={() => setShowVarPopover(!showVarPopover)}
                  className="btn-icon !w-16 !h-8 bg-navy-50 hover:bg-navy-100 border border-navy-200 text-xs font-bold text-navy-700 gap-1"
                  title="Insert personalized field"
                >
                  <span>{"{{x}}"}</span>
                </button>

                {showVarPopover && (
                  <div className="absolute top-10 left-0 z-50 bg-white rounded-xl shadow-card-hover border border-navy-100 p-3.5 w-64 animate-slide-up space-y-2">
                    <p className="text-[10px] font-bold text-navy-400 uppercase tracking-wider">
                      Insert a personalised field
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['Contact Name', 'Property Location', 'Price'].map(chip => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => handleInsertBodyVar(chip)}
                          className="px-2.5 py-1.5 bg-navy-50 hover:bg-navy-100 text-navy-800 text-[10px] font-bold rounded-lg border border-navy-100 text-left truncate"
                        >
                          + {chip}
                        </button>
                      ))}
                    </div>
                    
                    {/* Custom Var Toggle */}
                    {!showCustomVarInput ? (
                      <button
                        type="button"
                        onClick={() => setShowCustomVarInput(true)}
                        className="w-full text-center text-[10px] font-semibold text-gold-600 hover:text-gold-700 pt-1 border-t border-navy-50"
                      >
                        + Custom label...
                      </button>
                    ) : (
                      <div className="flex gap-1 border-t border-navy-50 pt-2">
                        <input
                          type="text"
                          className="input-field !min-h-[32px] !py-1 !px-2.5 text-xs"
                          placeholder="e.g. Offer Value"
                          value={customVarName}
                          onChange={(e) => setCustomVarName(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (customVarName.trim()) {
                              handleInsertBodyVar(customVarName.trim());
                              setCustomVarName('');
                              setShowCustomVarInput(false);
                            }
                          }}
                          className="btn-gold !py-1 !px-3 !min-h-[32px] text-xs font-bold"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Emoji Picker Button */}
              <div className="relative" ref={emojiPopoverRef}>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="btn-icon !w-8 !h-8 bg-navy-50 hover:bg-navy-100 border border-navy-200"
                  title="Insert Emoji"
                >
                  <Smile size={14} className="text-navy-700" />
                </button>
                {showEmojiPicker && (
                  <div className="absolute top-10 left-0 z-50 bg-white rounded-xl shadow-card-hover border border-navy-100 p-2 animate-slide-up">
                    <emoji-picker class="light"></emoji-picker>
                  </div>
                )}
              </div>
            </div>

            {/* Textarea Container */}
            <div>
              <textarea
                ref={textareaRef}
                className="input-field w-full min-h-[140px] font-sans text-sm p-4 leading-relaxed"
                placeholder="Compose your WhatsApp template body message here..."
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
              />
              {formErrors.body && (
                <p className="text-xs text-danger mt-1 font-semibold flex items-center gap-1">
                  <AlertCircle size={12} /> {formErrors.body}
                </p>
              )}
            </div>

            {/* Variable Example Fields */}
            {bodyVariables.length > 0 && (
              <div className="p-4 bg-navy-50/70 rounded-2xl border border-navy-100/50 space-y-3">
                <div className="flex items-center gap-1.5 border-b border-navy-100 pb-1.5">
                  <Info size={12} className="text-navy-400" />
                  <span className="text-[10px] font-bold text-navy-500 uppercase tracking-wider">
                    Example values (required by WhatsApp)
                  </span>
                </div>
                <div className="space-y-2.5">
                  {bodyVariables.map((num) => (
                    <div key={num} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-navy-400 bg-navy-200 px-1.5 py-0.5 rounded font-mono">
                          {"{{" + num + "}}"}
                        </span>
                        <span className="text-xs font-semibold text-navy-700">
                          {varLabels[num] || `Variable ${num}`}
                        </span>
                      </div>
                      <div className="flex-1 max-w-xs">
                        <input
                          type="text"
                          className="input-field !min-h-[38px] !py-1.5 !px-3 bg-white"
                          placeholder="Sample text (e.g. Rahul)"
                          value={exampleVars[num] || ''}
                          onChange={(e) =>
                            setExampleVars({ ...exampleVars, [num]: e.target.value })
                          }
                        />
                        {formErrors[`var_${num}`] && (
                          <p className="text-[10px] text-danger mt-0.5 font-semibold">
                            {formErrors[`var_${num}`]}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Footer Configuration */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-navy-50 pb-2">
              <h3 className="text-sm font-bold font-display text-navy-800 uppercase tracking-wider flex items-center gap-2">
                <span>4. Footer</span>
                <span className="text-[10px] text-navy-400 font-normal italic lowercase">(optional)</span>
              </h3>
              
              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => setAddFooter(!addFooter)}
                className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 ${
                  addFooter ? 'bg-gold-500 justify-end' : 'bg-navy-200 justify-start'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
              </button>
            </div>

            {addFooter && (
              <div className="space-y-2 animate-fade-in">
                <div className="flex justify-between items-baseline">
                  <label className="label">Footer Text</label>
                  <span className="text-[9px] font-semibold text-navy-400">
                    {footerText.length} / 60
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={60}
                  className="input-field"
                  placeholder="e.g. Reply STOP to unsubscribe"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                />
                <p className="text-[10px] text-navy-400">
                  Keep this short — footers do not support variables or formatting.
                </p>
                {formErrors.footer && (
                  <p className="text-xs text-danger mt-1 font-semibold flex items-center gap-1">
                    <AlertCircle size={12} /> {formErrors.footer}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Section 5: Buttons Configuration */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-navy-50 pb-2">
              <h3 className="text-sm font-bold font-display text-navy-800 uppercase tracking-wider flex items-center gap-2">
                <span>5. Buttons</span>
                <span className="text-[10px] text-navy-400 font-normal italic lowercase">(optional)</span>
              </h3>
              
              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => setAddButtons(!addButtons)}
                className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 ${
                  addButtons ? 'bg-gold-500 justify-end' : 'bg-navy-200 justify-start'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
              </button>
            </div>

            {addButtons && (
              <div className="space-y-4 animate-fade-in">
                {/* Button Type Selector */}
                <div className="flex bg-navy-50 p-1 rounded-xl">
                  {['QUICK_REPLY', 'CTA'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setButtonType(type)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                        buttonType === type
                          ? 'bg-white text-navy-950 shadow-sm'
                          : 'text-navy-400 hover:text-navy-600'
                      }`}
                    >
                      {type === 'QUICK_REPLY' ? 'Quick Reply' : 'Call to Action'}
                    </button>
                  ))}
                </div>

                {/* If Quick Replies */}
                {buttonType === 'QUICK_REPLY' && (
                  <div className="space-y-3 animate-fade-in">
                    <label className="label">Quick Reply Buttons</label>
                    <div className="space-y-2">
                      {quickReplies.map((btnText, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            type="text"
                            maxLength={20}
                            className="input-field !min-h-[44px] !py-2 flex-1"
                            placeholder={`Button ${idx + 1} text`}
                            value={btnText}
                            onChange={(e) => handleQuickReplyTextChange(idx, e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveQuickReply(idx)}
                            className="w-8 h-8 rounded-lg hover:bg-navy-50 text-navy-400 hover:text-navy-600 flex items-center justify-center border border-navy-200"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {quickReplies.length < 3 ? (
                      <button
                        type="button"
                        onClick={handleAddQuickReply}
                        className="text-xs text-gold-600 hover:text-gold-700 font-semibold flex items-center gap-1 mt-1"
                      >
                        + Add Button
                      </button>
                    ) : (
                      <p className="text-[10px] text-navy-400 mt-1 italic">
                        Maximum of 3 quick replies allowed by WhatsApp.
                      </p>
                    )}

                    {formErrors.buttons && (
                      <p className="text-xs text-danger mt-1 font-semibold flex items-center gap-1">
                        <AlertCircle size={12} /> {formErrors.buttons}
                      </p>
                    )}
                  </div>
                )}

                {/* If Call to Action */}
                {buttonType === 'CTA' && (
                  <div className="space-y-4 animate-fade-in">
                    {/* Call Us Toggle */}
                    <div className="p-3 bg-navy-50 rounded-xl border border-navy-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-navy-800 flex items-center gap-1.5">
                          <Phone size={12} /> Call Us Button
                        </span>
                        <button
                          type="button"
                          onClick={() => setEnableCtaCall(!enableCtaCall)}
                          className={`w-8 h-5 flex items-center rounded-full p-0.5 transition-colors duration-150 ${
                            enableCtaCall ? 'bg-gold-500 justify-end' : 'bg-navy-200 justify-start'
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                        </button>
                      </div>

                      {enableCtaCall && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
                          <div>
                            <label className="label !text-[9px]">Button Label</label>
                            <input
                              type="text"
                              maxLength={20}
                              className="input-field !min-h-[40px] !py-2 bg-white"
                              value={ctaCallLabel}
                              onChange={(e) => setCtaCallLabel(e.target.value)}
                            />
                            {formErrors.cta_call_label && (
                              <p className="text-[10px] text-danger mt-1">{formErrors.cta_call_label}</p>
                            )}
                          </div>
                          <div>
                            <label className="label !text-[9px]">Phone Number</label>
                            <input
                              type="text"
                              className="input-field !min-h-[40px] !py-2 bg-white"
                              placeholder="e.g. +919987502755"
                              value={ctaCallPhone}
                              onChange={(e) => setCtaCallPhone(e.target.value)}
                            />
                            {formErrors.cta_call_phone && (
                              <p className="text-[10px] text-danger mt-1">{formErrors.cta_call_phone}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Visit Website Toggle */}
                    <div className="p-3 bg-navy-50 rounded-xl border border-navy-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-navy-800 flex items-center gap-1.5">
                          <Globe size={12} /> Visit Website Button
                        </span>
                        <button
                          type="button"
                          onClick={() => setEnableCtaUrl(!enableCtaUrl)}
                          className={`w-8 h-5 flex items-center rounded-full p-0.5 transition-colors duration-150 ${
                            enableCtaUrl ? 'bg-gold-500 justify-end' : 'bg-navy-200 justify-start'
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                        </button>
                      </div>

                      {enableCtaUrl && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
                          <div>
                            <label className="label !text-[9px]">Button Label</label>
                            <input
                              type="text"
                              maxLength={20}
                              className="input-field !min-h-[40px] !py-2 bg-white"
                              value={ctaUrlLabel}
                              onChange={(e) => setCtaUrlLabel(e.target.value)}
                            />
                            {formErrors.cta_url_label && (
                              <p className="text-[10px] text-danger mt-1">{formErrors.cta_url_label}</p>
                            )}
                          </div>
                          <div>
                            <label className="label !text-[9px]">Website URL</label>
                            <input
                              type="text"
                              className="input-field !min-h-[40px] !py-2 bg-white"
                              placeholder="e.g. https://prop-reach.com"
                              value={ctaUrlValue}
                              onChange={(e) => setCtaUrlValue(e.target.value)}
                            />
                            {formErrors.cta_url_value && (
                              <p className="text-[10px] text-danger mt-1">{formErrors.cta_url_value}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {formErrors.buttons && (
                      <p className="text-xs text-danger mt-1 font-semibold flex items-center gap-1">
                        <AlertCircle size={12} /> {formErrors.buttons}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submission Feedback Toast / Message */}
          {formErrors.submit && (
            <div className="p-3 bg-danger/10 border border-danger/25 text-danger rounded-xl text-sm font-semibold flex items-center gap-2 animate-fade-in">
              <AlertCircle size={16} />
              <span>{formErrors.submit}</span>
            </div>
          )}

          {/* Create Button Actions */}
          <div className="pt-2">
            <button
              type="button"
              disabled={createTemplateMutation.isPending}
              onClick={handleSubmit}
              className="btn-gold w-full flex items-center justify-center gap-2"
              id="submit-template-btn"
            >
              {createTemplateMutation.isPending ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  Submitting to WhatsApp...
                </>
              ) : (
                'Submit for Approval'
              )}
            </button>
          </div>
        </div>

        {/* Right: Live Preview Mockup */}
        <div className="hidden lg:block lg:sticky lg:top-4 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-navy-500 uppercase tracking-wider pl-1">
            <Eye size={14} /> Live WhatsApp Preview
          </div>
          
          <div className="bg-navy-50/80 rounded-2xl border border-navy-100 p-8 flex flex-col items-center justify-center">
            {/* Phone outline SVG */}
            <div className="relative w-64 aspect-[9/18.5] bg-[#ece5dd] border-[6px] border-navy-900 rounded-[32px] overflow-hidden shadow-card flex flex-col">
              
              {/* Top notch/bar */}
              <div className="bg-navy-900 h-6 flex items-center justify-center text-[8px] text-white/80 font-semibold tracking-wider font-mono">
                WhatsApp Preview
              </div>

              {/* Chat Bubble Container */}
              <div className="flex-1 p-3 overflow-y-auto space-y-2 flex flex-col justify-start">
                
                {/* Message Bubble */}
                <div className="bg-white rounded-xl shadow-sm border border-navy-100/30 p-2.5 max-w-[90%] text-[10px] space-y-1 relative self-start">
                  
                  {/* Image header preview */}
                  {headerType === 'IMAGE' && headerImageThumbnail && (
                    <div className="aspect-[21/9] w-full rounded-lg bg-navy-100 overflow-hidden border border-navy-100 mb-1">
                      <img src={headerImageThumbnail} alt="Header" className="w-full h-full object-cover" />
                    </div>
                  )}

                  {/* Text Header */}
                  {headerType === 'TEXT' && headerText.trim() && (
                    <p className="font-bold text-navy-950 text-[11px] leading-tight pb-0.5 border-b border-navy-50/40">
                      {headerText.includes('{{1}}') 
                        ? headerText.replace('{{1}}', headerExample || '[Header Variable]') 
                        : headerText}
                    </p>
                  )}

                  {/* Body Text */}
                  {bodyText.trim() && (
                    <p className="text-navy-800 whitespace-pre-wrap leading-relaxed">
                      {formatTextForPreview(bodyText)}
                    </p>
                  )}

                  {/* Footer Text */}
                  {addFooter && footerText.trim() && (
                    <p className="text-[8px] text-navy-400 italic">
                      {footerText}
                    </p>
                  )}
                </div>

                {/* Buttons (Quick Reply / CTA) */}
                {addButtons && (
                  <div className="w-[90%] flex flex-col gap-1 z-10 self-start">
                    {buttonType === 'QUICK_REPLY' ? (
                      quickReplies.map((btnText, idx) => (
                        btnText.trim() && (
                          <div
                            key={idx}
                            className="bg-white hover:bg-navy-50 text-gold-600 border border-navy-100 rounded-lg py-1.5 text-[10px] font-bold text-center shadow-sm"
                          >
                            {btnText}
                          </div>
                        )
                      ))
                    ) : (
                      <>
                        {enableCtaCall && ctaCallLabel.trim() && (
                          <div className="bg-white text-gold-600 border border-navy-100 rounded-lg py-1.5 text-[10px] font-bold text-center shadow-sm flex items-center justify-center gap-1">
                            <Phone size={10} /> {ctaCallLabel}
                          </div>
                        )}
                        {enableCtaUrl && ctaUrlLabel.trim() && (
                          <div className="bg-white text-gold-600 border border-navy-100 rounded-lg py-1.5 text-[10px] font-bold text-center shadow-sm flex items-center justify-center gap-1">
                            <Globe size={10} /> {ctaUrlLabel}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <p className="text-[10px] text-navy-400 font-semibold text-center mt-3">
              This is how your template will appear on WhatsApp
            </p>
          </div>
        </div>
      </div>

      {/* Sticky Mobile Preview Button & Bottom Sheet */}
      <div className="lg:hidden">
        {/* Toggle Button */}
        <button
          type="button"
          onClick={() => setShowMobilePreview(true)}
          className="fixed bottom-16 right-4 z-40 bg-gold-500 hover:bg-gold-600 text-white shadow-nav rounded-full px-4 py-2.5 flex items-center gap-1.5 font-bold text-xs"
        >
          <Eye size={16} /> Preview
        </button>

        {/* Bottom Sheet Backdrop */}
        {showMobilePreview && (
          <div
            onClick={() => setShowMobilePreview(false)}
            className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-xs animate-fade-in"
          />
        )}

        {/* Bottom Sheet Card */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-[60] bg-[#ece5dd] rounded-t-3xl border-t border-navy-100 p-4 pb-8 shadow-nav max-h-[80vh] overflow-y-auto transition-transform duration-300 ${
            showMobilePreview ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-navy-100 pb-3 mb-4">
            <span className="text-xs font-bold text-navy-600 uppercase tracking-wider flex items-center gap-1.5">
              <Eye size={14} /> Live WhatsApp Preview
            </span>
            <button
              onClick={() => setShowMobilePreview(false)}
              className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-navy-200"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-col items-center py-2">
            {/* Mockup bubble */}
            <div className="bg-white rounded-xl shadow-sm border border-navy-100/30 p-3.5 w-full max-w-sm text-xs space-y-1 relative self-start">
              {headerType === 'IMAGE' && headerImageThumbnail && (
                <div className="aspect-[21/9] w-full rounded-lg bg-navy-100 overflow-hidden border border-navy-100 mb-1">
                  <img src={headerImageThumbnail} alt="Header" className="w-full h-full object-cover" />
                </div>
              )}

              {headerType === 'TEXT' && headerText.trim() && (
                <p className="font-bold text-navy-950 text-sm leading-tight pb-0.5 border-b border-navy-50/40">
                  {headerText.includes('{{1}}') 
                    ? headerText.replace('{{1}}', headerExample || '[Header Variable]') 
                    : headerText}
                </p>
              )}

              {bodyText.trim() && (
                <p className="text-navy-800 whitespace-pre-wrap leading-relaxed text-xs">
                  {formatTextForPreview(bodyText)}
                </p>
              )}

              {addFooter && footerText.trim() && (
                <p className="text-[10px] text-navy-400 italic">
                  {footerText}
                </p>
              )}
            </div>

            {/* Mockup buttons */}
            {addButtons && (
              <div className="w-full max-w-sm flex flex-col gap-1 pt-1.5">
                {buttonType === 'QUICK_REPLY' ? (
                  quickReplies.map((btnText, idx) => (
                    btnText.trim() && (
                      <div
                        key={idx}
                        className="bg-white text-gold-600 border border-navy-100 rounded-lg py-2 text-xs font-bold text-center shadow-sm"
                      >
                        {btnText}
                      </div>
                    )
                  ))
                ) : (
                  <>
                    {enableCtaCall && ctaCallLabel.trim() && (
                      <div className="bg-white text-gold-600 border border-navy-100 rounded-lg py-2 text-xs font-bold text-center shadow-sm flex items-center justify-center gap-1.5">
                        <Phone size={12} /> {ctaCallLabel}
                      </div>
                    )}
                    {enableCtaUrl && ctaUrlLabel.trim() && (
                      <div className="bg-white text-gold-600 border border-navy-100 rounded-lg py-2 text-xs font-bold text-center shadow-sm flex items-center justify-center gap-1.5">
                        <Globe size={12} /> {ctaUrlLabel}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            
            <p className="text-[10px] text-navy-400 font-semibold text-center mt-4">
              This is how your template will appear on WhatsApp
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

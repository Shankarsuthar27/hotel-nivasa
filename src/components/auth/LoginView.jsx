import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  AtSign,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  KeyRound,
  Building,
  Headset,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { loginStaff, quickStaffLogin, sendStaffPasswordReset, DEMO_STAFF_ACCOUNTS } from '../../services/firebaseAuth';
import { pmsStore } from '../../services/pmsStore';
import './login.css';

export default function LoginView({ onLoginSuccess, teamMembers = [] }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [generalError, setGeneralError] = useState('');

  // Modals state: null | 'forgot' | 'partner' | 'concierge' | 'privacy' | 'terms'
  const [activeModal, setActiveModal] = useState(null);

  // Language state & dropdown
  const [currentLang, setCurrentLang] = useState('EN · English');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langWrapperRef = useRef(null);

  // Demo role switcher collapsible state
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  // Remove window & body scrollbar completely when on the login screen
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  // Close language menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (langWrapperRef.current && !langWrapperRef.current.contains(e.target)) {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveModal(null);
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleFormSubmit = async (e) => {
    e?.preventDefault();
    setEmailError('');
    setPasswordError('');
    setGeneralError('');

    const cleanIdentifier = email.trim();
    const cleanPassword = password.trim();
    let hasError = false;

    const isEmailFormat = cleanIdentifier.includes('@') && cleanIdentifier.includes('.');
    const isStaffIdFormat = /^[a-zA-Z0-9._-]{3,32}$/.test(cleanIdentifier);

    if (!cleanIdentifier || (!isEmailFormat && !isStaffIdFormat)) {
      setEmailError('Please enter a valid Staff ID (e.g. MGR-4821) or email address.');
      hasError = true;
    }

    if (!cleanPassword || cleanPassword.length < 4) {
      setPasswordError('Please enter your account password.');
      hasError = true;
    }

    if (hasError) return;

    setIsLoading(true);

    try {
      const liveTeamMembers =
        Array.isArray(teamMembers) && teamMembers.length > 0
          ? teamMembers
          : pmsStore?.getState()?.teamMembers || [];
      const res = await loginStaff(cleanIdentifier, cleanPassword, liveTeamMembers);

      if (res.success) {
        try {
          localStorage.setItem('pms_remember_email', cleanIdentifier);
        } catch (err) {}

        if (onLoginSuccess) {
          onLoginSuccess(res.staff || { email: res.email || cleanIdentifier });
        }
      } else {
        setGeneralError(res.error || 'Invalid credentials. Please verify your Staff ID / email or password.');
      }
    } catch (err) {
      setGeneralError(err.message || 'An error occurred during authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async (account) => {
    setEmailError('');
    setPasswordError('');
    setGeneralError('');
    setIsLoading(true);

    try {
      const res = await quickStaffLogin(account.role);
      if (res.success) {
        if (onLoginSuccess) {
          onLoginSuccess(res.staff || account);
        }
      } else {
        setGeneralError(res.error || 'Unable to sign in as demo role.');
      }
    } catch (err) {
      setGeneralError(err.message || 'Error executing demo login.');
    } finally {
      setIsLoading(false);
    }
  };

  // Modal form states
  const [modalEmail, setModalEmail] = useState('');
  const [modalFeedback, setModalFeedback] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalFeedback(null);
    try {
      const res = await sendStaffPasswordReset(modalEmail);
      if (res.success) {
        setModalFeedback({
          type: 'success',
          text: `Password reset instructions sent to ${modalEmail}.`
        });
      } else {
        setModalFeedback({
          type: 'error',
          text: res.error || 'Failed to dispatch password recovery link.'
        });
      }
    } catch (err) {
      setModalFeedback({ type: 'error', text: err.message });
    } finally {
      setModalLoading(false);
    }
  };

  const handlePartnerSubmit = (e) => {
    e.preventDefault();
    setActiveModal(null);
    alert('Partner application received! Our onboarding team will reach out shortly.');
  };

  return (
    <div className="asthastay-auth-page">
      {/* Full-Screen Background Architectural Villa Image */}
      <div className="asthastay-bg-container">
        <img
          src="https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=2000&q=85"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = 'https://placehold.co/1920x1080/1e293b/ffffff?text=Luxury+Architectural+Villa';
          }}
          alt="Modern luxury architectural hotel villa exterior"
          className="asthastay-bg-img"
        />
        {/* Subtle Overall Gradient Overlay for Crisp Contrast */}
        <div className="asthastay-bg-gradient" />
        {/* Subtle Vertical Right-Side Tint Behind Card Area */}
        <div className="asthastay-bg-right-tint" />
      </div>

      {/* Main Viewport Container */}
      <main className="asthastay-main-viewport">
        {/* Top-Left Brand Mark */}
        <header className="asthastay-header">
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="asthastay-brand-link"
          >
            <img
              src="/logo/Gemini_Generated_Image_bxm6yabxm6yabxm6.png"
              alt="Asthastay"
              className="asthastay-header-logo-img"
            />
          </a>
        </header>

        {/* Center / Split Content Area */}
        <div className="asthastay-split-area">
          {/* Bottom-Left Editorial Tagline */}
          <section className="asthastay-editorial-section">
            <blockquote className="asthastay-editorial-quote font-serif-luxury">
              “Excellence in every square foot.”
            </blockquote>
            <p className="asthastay-editorial-sub">
              MODERN SOLUTIONS FOR SMART HOSPITALITY
            </p>
          </section>

          {/* Right-Aligned Elevated White Login Card */}
          <section className="asthastay-card-wrapper">
            <div className="asthastay-card">
              {/* Card Header */}
              <div className="asthastay-card-header">
                <div className="asthastay-card-logo-wrap">
                  <img
                    src="/logo/Gemini_Generated_Image_bxm6yabxm6yabxm6.png"
                    alt="Asthastay"
                    className="asthastay-card-logo-img"
                  />
                </div>
                <h1 className="asthastay-card-title font-serif-luxury">
                  Welcome Back
                </h1>
                <p className="asthastay-card-subtitle">
                  Enter your credentials to access your account
                </p>
              </div>

              {/* General Error Banner */}
              {generalError && (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '10px',
                    padding: '0.75rem 0.9rem',
                    color: '#991b1b',
                    fontSize: '0.82rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{generalError}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleFormSubmit} className="asthastay-form" noValidate autoComplete="off">
                {/* Staff ID or Email Address Input */}
                <div>
                  <label htmlFor="email" className="asthastay-label">
                    Staff ID or Email Address
                  </label>
                  <div className="asthastay-input-wrap">
                    <span className="asthastay-input-icon">
                      <AtSign size={17} />
                    </span>
                    <input
                      id="email"
                      name="email"
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter Staff ID or Email Address"
                      autoComplete="off"
                      className="asthastay-input"
                    />
                  </div>
                  {emailError && <p className="asthastay-field-error">{emailError}</p>}
                </div>

                {/* Password Input */}
                <div>
                  <div className="asthastay-label-row">
                    <label htmlFor="password" className="asthastay-label" style={{ marginBottom: 0 }}>
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setModalFeedback(null);
                        setModalEmail(email || '');
                        setActiveModal('forgot');
                      }}
                      className="asthastay-forgot-btn"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="asthastay-input-wrap">
                    <span className="asthastay-input-icon">
                      <Lock size={17} />
                    </span>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="new-password"
                      className="asthastay-input asthastay-input-pass"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Toggle password visibility"
                      className="asthastay-eye-btn"
                    >
                      {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                  {passwordError && <p className="asthastay-field-error">{passwordError}</p>}
                </div>

                {/* Primary CTA Button */}
                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="asthastay-submit-btn"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Signing In...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Card Footer Links */}
              <footer className="asthastay-card-footer">
                <button
                  type="button"
                  onClick={() => setActiveModal('privacy')}
                  className="asthastay-footer-link"
                >
                  PRIVACY
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('terms')}
                  className="asthastay-footer-link"
                >
                  TERMS
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('concierge')}
                  className="asthastay-footer-link"
                >
                  CONCIERGE
                </button>

                {/* Interactive Language Selector */}
                <div className="asthastay-lang-dropdown" ref={langWrapperRef}>
                  <button
                    type="button"
                    onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                    className="asthastay-footer-link"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                  >
                    <span>{currentLang.split(' · ')[0]}</span>
                  </button>

                  {isLangMenuOpen && (
                    <div className="asthastay-lang-menu">
                      {[
                        { label: 'English (EN)', val: 'EN · English' },
                        { label: 'हिन्दी (HI)', val: 'HI · हिन्दी' },
                        { label: 'Français (FR)', val: 'FR · Français' },
                        { label: 'العربية (AR)', val: 'AR · العربية' }
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => {
                            setCurrentLang(item.val);
                            setIsLangMenuOpen(false);
                          }}
                          className={`asthastay-lang-item ${currentLang === item.val ? 'active' : ''}`}
                        >
                          <span>{item.label}</span>
                          {currentLang === item.val && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </footer>
            </div>
          </section>
        </div>

        {/* Bottom Spacer for Balanced Desktop Alignment */}
        <div style={{ display: 'none', height: '8px' }} />
      </main>

      {/* --- ALL INTERACTIVE MODALS --- */}
      {activeModal && (
        <div
          className="asthastay-modal-backdrop"
          onClick={() => setActiveModal(null)}
        >
          {/* 1. Forgot Password Modal */}
          {activeModal === 'forgot' && (
            <div
              className="asthastay-modal-box"
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    backgroundColor: '#eff6ff',
                    color: '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <KeyRound size={20} />
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px' }}
                >
                  <X size={20} />
                </button>
              </div>

              <h3 className="font-serif-luxury" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                Reset Your Password
              </h3>
              <p style={{ margin: '0.35rem 0 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
                Enter your registered property email address and we’ll send a secure recovery link.
              </p>

              {modalFeedback && (
                <div
                  style={{
                    backgroundColor: modalFeedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${modalFeedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                    color: modalFeedback.type === 'success' ? '#166534' : '#991b1b',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    fontSize: '0.82rem',
                    marginBottom: '1rem'
                  }}
                >
                  {modalFeedback.text}
                </div>
              )}

              <form onSubmit={handleForgotSubmit}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Registered Email
                  </label>
                  <input
                    type="email"
                    required
                    value={modalEmail}
                    onChange={(e) => setModalEmail(e.target.value)}
                    className="asthastay-input"
                    style={{ paddingLeft: '1rem' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    style={{
                      padding: '0.6rem 1rem',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#475569',
                      background: '#f1f5f9',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    style={{
                      padding: '0.6rem 1.25rem',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#ffffff',
                      background: '#3b82f6',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {modalLoading ? 'Sending...' : 'Send Recovery Link'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 2. Apply for Access (Partner Modal) */}
          {activeModal === 'partner' && (
            <div
              className="asthastay-modal-box"
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    backgroundColor: '#eff6ff',
                    color: '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Building size={20} />
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px' }}
                >
                  <X size={20} />
                </button>
              </div>

              <h3 className="font-serif-luxury" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                Apply for Partner Access
              </h3>
              <p style={{ margin: '0.35rem 0 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
                Onboard your hotel, resort, or serviced villa portfolio onto ASTHASTAY PMS.
              </p>

              <form onSubmit={handlePartnerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Property / Group Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., The Grand Imperial Suites"
                    className="asthastay-input"
                    style={{ paddingLeft: '1rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Work Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="manager@hotelgroup.com"
                    className="asthastay-input"
                    style={{ paddingLeft: '1rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Total Keys / Rooms
                  </label>
                  <select
                    className="asthastay-input"
                    style={{ paddingLeft: '1rem' }}
                  >
                    <option>1 – 25 Boutique Keys</option>
                    <option>26 – 100 Rooms</option>
                    <option>100+ Enterprise / Multi-Property</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    style={{
                      padding: '0.6rem 1rem',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#475569',
                      background: '#f1f5f9',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '0.6rem 1.25rem',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#ffffff',
                      background: '#3b82f6',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Submit Application
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 3. Concierge Support Modal */}
          {activeModal === 'concierge' && (
            <div
              className="asthastay-modal-box"
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    backgroundColor: '#eff6ff',
                    color: '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Headset size={20} />
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px' }}
                >
                  <X size={20} />
                </button>
              </div>

              <h3 className="font-serif-luxury" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                24/7 Hospitality Concierge
              </h3>
              <p style={{ margin: '0.35rem 0 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
                Dedicated technical & front-desk operations support for ASTHASTAY partners.
              </p>

              <div style={{ backgroundColor: '#eef3fb', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, color: '#64748b' }}>Priority Desk:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>+91 (800) 123-4589</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, color: '#64748b' }}>Support Email:</span>
                  <span style={{ fontWeight: 600, color: '#3b82f6' }}>concierge@asthastay.com</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#64748b' }}>System Status:</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#059669' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                    <span>All Nodes Operational</span>
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#ffffff',
                    background: '#3b82f6',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* 4. Privacy Modal */}
          {activeModal === 'privacy' && (
            <div
              className="asthastay-modal-box"
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h3 className="font-serif-luxury" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                  Privacy & Data Governance
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px' }}
                >
                  <X size={20} />
                </button>
              </div>
              <p style={{ fontSize: '12px', lineHeight: 1.6, color: '#475569', margin: '0.5rem 0 1.25rem' }}>
                ASTHASTAY adheres to ISO 27001, GDPR, and PCI-DSS hospitality data standards. All guest folios, reservation records, and partner credentials are encrypted end-to-end using TLS 1.3 and AES-256 storage protocols.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  style={{
                    padding: '0.55rem 1.25rem',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#ffffff',
                    background: '#3b82f6',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Understood
                </button>
              </div>
            </div>
          )}

          {/* 5. Terms Modal */}
          {activeModal === 'terms' && (
            <div
              className="asthastay-modal-box"
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h3 className="font-serif-luxury" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                  Terms of Service
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px' }}
                >
                  <X size={20} />
                </button>
              </div>
              <p style={{ fontSize: '12px', lineHeight: 1.6, color: '#475569', margin: '0.5rem 0 1.25rem' }}>
                Access to the ASTHASTAY Property Management System is restricted to authorized hotel staff and registered partners. All session activities are logged for property audit compliance and front-desk security.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  style={{
                    padding: '0.55rem 1.25rem',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#ffffff',
                    background: '#3b82f6',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

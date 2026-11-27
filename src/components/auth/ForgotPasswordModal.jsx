import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2, X, KeyRound } from 'lucide-react';
import { sendStaffPasswordReset } from '../../services/firebaseAuth';

export default function ForgotPasswordModal({ isOpen, onClose, initialEmail = '' }) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = (email || '').trim();
    if (!cleanEmail) {
      setErrorMsg('Please enter your staff email address.');
      return;
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg('Please enter a valid work email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await sendStaffPasswordReset(cleanEmail);
      if (res.success) {
        setSuccessMsg(res.message || `Password reset instructions sent to ${cleanEmail}`);
      } else {
        setErrorMsg(res.error || 'Failed to dispatch reset email. Please contact your GM or Administrator.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'fadeInModal 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Accent */}
        <div style={{ height: '5px', background: 'linear-gradient(90deg, #2563EB 0%, #3B82F6 50%, #60A5FA 100%)' }} />

        {/* Modal Header */}
        <div style={{ padding: '1.5rem 1.75rem 1.25rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563EB',
                border: '1px solid #DBEAFE'
              }}
            >
              <KeyRound size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>
                Reset Staff Password
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: '#64748B' }}>
                Receive verification link on your work email
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94A3B8',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={19} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '0 1.75rem 1.75rem' }}>
          {successMsg ? (
            <div
              style={{
                backgroundColor: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '10px',
                padding: '1.25rem',
                textAlign: 'center',
                margin: '0.5rem 0 1rem'
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  backgroundColor: '#DCFCE7',
                  color: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 0.75rem'
                }}
              >
                <CheckCircle2 size={24} />
              </div>
              <h4 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 700, color: '#166534' }}>
                Instructions Dispatched
              </h4>
              <p style={{ margin: 0, fontSize: '0.86rem', color: '#15803D', lineHeight: 1.5 }}>
                {successMsg}
              </p>
              <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: '#64748B' }}>
                Check your inbox and spam folder. Once reset, sign in with your new password.
              </p>
              <button
                type="button"
                onClick={onClose}
                style={{
                  marginTop: '1.25rem',
                  width: '100%',
                  padding: '0.7rem 1rem',
                  backgroundColor: '#16A34A',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: 1.5 }}>
                Enter the email address registered with your hotel staff profile. We will dispatch instructions to securely reset your credentials.
              </p>

              {errorMsg && (
                <div
                  style={{
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    color: '#991B1B',
                    fontSize: '0.86rem'
                  }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="reset-email-input"
                  style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}
                >
                  Registered Staff Email
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={17}
                    color="#94A3B8"
                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    id="reset-email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. staff@hotelnivasa.com"
                    autoFocus
                    required
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.7rem 0.85rem 0.7rem 2.45rem',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '0.92rem',
                      color: '#0F172A',
                      outline: 'none',
                      transition: 'border-color 0.15s, box-shadow 0.15s'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#2563EB';
                      e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.12)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#CBD5E1';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '0.65rem 1.15rem',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    borderRadius: '8px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.65rem 1.35rem',
                    border: 'none',
                    backgroundColor: '#2563EB',
                    color: '#ffffff',
                    borderRadius: '8px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.25)'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) e.currentTarget.style.backgroundColor = '#1D4ED8';
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) e.currentTarget.style.backgroundColor = '#2563EB';
                  }}
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  <span>{loading ? 'Sending...' : 'Send Reset Link'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? ReactDOM.createPortal(modalContent, document.body)
    : modalContent;
}


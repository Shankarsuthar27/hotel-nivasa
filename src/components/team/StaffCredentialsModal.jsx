import React, { useState } from 'react';
import {
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  X,
  AlertTriangle,
  UserCheck
} from 'lucide-react';
import { summarizeGrantedPermissions } from '../../utils/permissions';

export default function StaffCredentialsModal({ isOpen, onClose, credentials }) {
  const [showPassword, setShowPassword] = useState(true);
  const [copiedField, setCopiedField] = useState('');

  if (!isOpen || !credentials) return null;

  const { member, staffId, loginEmail, tempPassword, firebaseAuthCreated } = credentials;
  const grantedList = summarizeGrantedPermissions(member?.permissions);

  const handleCopy = async (text, fieldKey) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(''), 2000);
    } catch (_) {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(''), 2000);
    }
  };

  const handleCopyAll = () => {
    const summary = [
      `Hotel Astha PMS — Staff Login Credentials`,
      `Name: ${member?.name || ''}`,
      `Role: ${member?.role || ''}`,
      `Staff Login ID: ${staffId}`,
      `Login Email: ${loginEmail}`,
      `Temporary Password: ${tempPassword}`,
      `Permissions: ${grantedList.join(', ') || 'Custom'}`
    ].join('\n');
    handleCopy(summary, 'all');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '500px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#059669'
              }}
            >
              <UserCheck size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                Staff Account Created
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748B' }}>
                {member?.name} &middot; {member?.role}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Security Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A',
              fontSize: '12.5px',
              color: '#92400E',
              lineHeight: 1.5
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong>Copy these credentials now.</strong> For security, the plaintext password is
              only displayed once and is never stored in readable form.
            </span>
          </div>

          {/* Staff ID Field */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#475569',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              Staff Login ID
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#F8FAFC'
              }}
            >
              <code
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#0F172A',
                  letterSpacing: '0.04em'
                }}
              >
                {staffId}
              </code>
              <button
                type="button"
                onClick={() => handleCopy(staffId, 'id')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  color: copiedField === 'id' ? '#059669' : '#334155',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {copiedField === 'id' ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedField === 'id' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p style={{ margin: '5px 0 0 2px', fontSize: '11.5px', color: '#64748B' }}>
              Mapped Firebase Email: <strong>{loginEmail}</strong>
              {firebaseAuthCreated ? ' (Synced to Firebase Auth)' : ''}
            </p>
          </div>

          {/* Password Field */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#475569',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              Generated Password
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#F8FAFC',
                gap: '8px'
              }}
            >
              <code
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#2563EB',
                  letterSpacing: '0.04em'
                }}
              >
                {showPassword ? tempPassword : '••••••••••'}
              </code>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '5px 7px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(tempPassword, 'pass')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    color: copiedField === 'pass' ? '#059669' : '#334155',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {copiedField === 'pass' ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedField === 'pass' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Granted Permissions Summary */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#475569',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              <ShieldCheck size={14} color="#2563EB" />
              <span>Authorized Functions ({grantedList.length})</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {grantedList.length > 0 ? (
                grantedList.map((perm) => (
                  <span
                    key={perm}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '3px 9px',
                      borderRadius: '9999px',
                      backgroundColor: '#EFF6FF',
                      border: '1px solid #DBEAFE',
                      color: '#1D4ED8',
                      fontSize: '11.5px',
                      fontWeight: 600
                    }}
                  >
                    {perm}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '12.5px', color: '#94A3B8' }}>
                  No permissions enabled yet
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            backgroundColor: '#F8FAFC'
          }}
        >
          <button
            type="button"
            onClick={handleCopyAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '9px 16px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: copiedField === 'all' ? '#059669' : '#0F172A',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {copiedField === 'all' ? <Check size={15} /> : <KeyRound size={15} />}
            <span>{copiedField === 'all' ? 'Copied All!' : 'Copy All Credentials'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 22px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}


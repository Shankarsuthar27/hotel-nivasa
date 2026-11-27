import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Mail,
  Users,
  Calendar,
  Edit3,
  Building2,
  MapPin,
  Phone,
  Clock,
  IndianRupee,
  Lock,
  KeyRound,
  Save,
  ShieldCheck,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import { changeUserPassword } from '../../services/firebaseAuth';

function formatJoinedDate(dateStr) {
  if (!dateStr) return 'Joined on 22 Jul 2026';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return `Joined on ${dateStr}`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `Joined on ${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getInitials(name) {
  const clean = String(name || 'HN').trim();
  if (!clean) return 'HN';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function ProfileView({
  currentUser,
  teamMembers = [],
  property,
  onSaveProfile,
  onShowToast
}) {
  const resolvedName =
    currentUser?.name === 'Astha India'
      ? (property?.name || 'HOTEL NIVASA')
      : (currentUser?.name || property?.name || 'HOTEL NIVASA');
  const rawEmail = currentUser?.email || property?.email || 'info@hotelnivasa.com';
  const resolvedEmail =
    rawEmail === 'owner@hotelastha.com' || rawEmail === 'owner@hotelnivasa.com'
      ? 'info@hotelnivasa.com'
      : rawEmail;
  const resolvedRole = currentUser?.role === 'Owner' ? 'Primary Owner' : (currentUser?.role || 'Staff');
  const resolvedAvatar = currentUser?.avatarUrl || property?.logo || '';

  const [fullName, setFullName] = useState(resolvedName);
  const [avatarPreview, setAvatarPreview] = useState(resolvedAvatar);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setFullName(resolvedName);
  }, [resolvedName]);

  useEffect(() => {
    setAvatarPreview(resolvedAvatar);
  }, [resolvedAvatar]);

  const hasChanges =
    fullName.trim() !== resolvedName.trim() ||
    avatarPreview !== resolvedAvatar;

  const handleAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      if (onShowToast) onShowToast('Please select a valid image file.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 256;
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.85);
        setAvatarPreview(compressed);
        if (onSaveProfile) {
          onSaveProfile({ avatarUrl: compressed });
        }
        if (onShowToast) {
          onShowToast('Avatar updated and saved to database.');
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const cleanName = fullName.trim();
    if (!cleanName) {
      if (onShowToast) onShowToast('Full Name cannot be empty.', 'error');
      return;
    }
    if (onSaveProfile) {
      onSaveProfile({
        name: cleanName,
        initials: getInitials(cleanName),
        avatarUrl: avatarPreview
      });
    }
    if (onShowToast) onShowToast('Profile updated successfully.');
  };

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPw(false);
    setShowNewPw(false);
    setShowConfirmPw(false);
    setPasswordError('');
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    setIsSendingReset(true);
    try {
      const result = await changeUserPassword({
        currentUser,
        teamMembers,
        currentPassword,
        newPassword
      });

      if (!result.success) {
        setPasswordError(result.error || 'Unable to update password.');
        return;
      }

      if (onSaveProfile) {
        onSaveProfile({
          passwordHash: result.passwordHash,
          passwordSalt: result.passwordSalt,
          passwordUpdatedAt: result.passwordUpdatedAt
        });
      }
      if (onShowToast) onShowToast('Password updated and saved to database.');
      closePasswordModal();
    } catch (err) {
      setPasswordError(err?.message || 'Unable to update password right now.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const locationDisplay = [property?.city, property?.state, property?.country]
    .filter(Boolean)
    .join(', ') || property?.address || 'Jalore, Rajasthan, India';

  const cardStyle = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)'
  };

  const detailBoxStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    background: '#f8fafc',
    borderRadius: '10px',
    border: '1px solid #f1f5f9'
  };

  const iconBadgeStyle = {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: '#eff6ff',
    color: '#2563eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1320px', margin: '0 auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 320px) 1fr',
          gap: '24px',
          alignItems: 'stretch'
        }}
      >
        {/* Left Profile Summary Card */}
        <div
          style={{
            ...cardStyle,
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '22px' }}>
              <div
                style={{
                  width: '104px',
                  height: '104px',
                  borderRadius: '50%',
                  background: avatarPreview ? 'transparent' : '#fde8d7',
                  border: '4px solid #fff7ed',
                  boxShadow: '0 2px 10px rgba(15, 23, 42, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  marginBottom: '14px',
                  color: '#d97706',
                  fontSize: '30px',
                  fontWeight: 700
                }}
              >
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt={resolvedName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  getInitials(resolvedName)
                )}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                {resolvedName}
              </div>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background: '#eff6ff',
                  color: '#2563eb',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                {resolvedRole}
              </span>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ ...iconBadgeStyle, borderRadius: '50%', width: '34px', height: '34px' }}>
                  <Mail size={16} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {resolvedEmail}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>Email Address</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ ...iconBadgeStyle, borderRadius: '50%', width: '34px', height: '34px' }}>
                  <Users size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{resolvedRole}</div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>Role</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ ...iconBadgeStyle, borderRadius: '50%', width: '34px', height: '34px' }}>
                  <Calendar size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                    {formatJoinedDate(currentUser?.createdAt)}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>Member Since</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '18px', marginTop: '24px' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '9px 14px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#2563eb',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Edit3 size={15} />
              <span>Edit Avatar</span>
            </button>
          </div>
        </div>

        {/* Right Details & Security Card */}
        <div style={{ ...cardStyle, padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Personal Information */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={iconBadgeStyle}>
                <User size={18} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Personal Information</div>
                <div style={{ fontSize: '12.5px', color: '#64748b' }}>Update your personal details and contact information.</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    color: '#0f172a',
                    background: '#ffffff',
                    outline: 'none'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={resolvedEmail}
                  disabled
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '13.5px',
                    color: '#94a3b8',
                    background: '#f1f5f9',
                    cursor: 'not-allowed'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Current Property Details */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={iconBadgeStyle}>
                <Building2 size={18} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Current Property Details</div>
                <div style={{ fontSize: '12.5px', color: '#64748b' }}>Information about your current property and its location.</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
              <div style={detailBoxStyle}>
                <div style={iconBadgeStyle}>
                  <Building2 size={17} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Property Name</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                    {property?.name || 'HOTEL NIVASA'}
                  </div>
                </div>
              </div>

              <div style={detailBoxStyle}>
                <div style={iconBadgeStyle}>
                  <MapPin size={17} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Location</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                    {locationDisplay}
                  </div>
                </div>
              </div>

              <div style={detailBoxStyle}>
                <div style={iconBadgeStyle}>
                  <Mail size={17} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Email Address</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                    {property?.email || resolvedEmail}
                  </div>
                </div>
              </div>

              <div style={detailBoxStyle}>
                <div style={iconBadgeStyle}>
                  <Phone size={17} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Phone Number</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                    {property?.phone || '+917023318111'}
                  </div>
                </div>
              </div>

              <div style={detailBoxStyle}>
                <div style={iconBadgeStyle}>
                  <Clock size={17} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Timezone</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                    {property?.timezone || 'Asia/Kolkata'}
                  </div>
                </div>
              </div>

              <div style={detailBoxStyle}>
                <div style={iconBadgeStyle}>
                  <IndianRupee size={17} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Currency</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                    {property?.currency || 'INR'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Security */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', paddingTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={iconBadgeStyle}>
                <Lock size={18} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Security</div>
                <div style={{ fontSize: '12.5px', color: '#64748b' }}>Manage your password to keep your account secure.</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <KeyRound size={15} />
              <span>Change Password</span>
            </button>
          </div>

          {/* Save Changes */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button
              type="button"
              disabled={!hasChanges}
              onClick={handleSave}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                background: hasChanges ? '#2563eb' : '#93c5fd',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: hasChanges ? 'pointer' : 'not-allowed',
                transition: 'background 0.15s ease'
              }}
            >
              <Save size={15} />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Security Notice Banner */}
      <div
        style={{
          ...cardStyle,
          marginTop: '20px',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: '#64748b',
          fontSize: '13px',
          fontWeight: 500
        }}
      >
        <ShieldCheck size={16} color="#2563eb" />
        <span>Your information is secure and only visible to authorized users.</span>
      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
          onClick={closePasswordModal}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '500px',
              padding: '28px',
              boxShadow: '0 24px 48px rgba(15, 23, 42, 0.22)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={iconBadgeStyle}>
                  <Lock size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', lineHeight: 1.25 }}>
                    Change Password
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', lineHeight: 1.45 }}>
                    Enter your current password and a new password to update your credentials.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={closePasswordModal}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {passwordError && (
              <div
                style={{
                  marginBottom: '14px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  fontSize: '12.5px',
                  fontWeight: 500
                }}
              >
                {passwordError}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
                  Current Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13.5px',
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw((v) => !v)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    tabIndex={-1}
                  >
                    {showCurrentPw ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13.5px',
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw((v) => !v)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    tabIndex={-1}
                  >
                    {showNewPw ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
                  Confirm New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13.5px',
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw((v) => !v)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    tabIndex={-1}
                  >
                    {showConfirmPw ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={closePasswordModal}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingReset}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {isSendingReset ? 'Updating...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

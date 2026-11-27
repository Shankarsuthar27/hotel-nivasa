import React from 'react';
import { Plus, RefreshCw, Home, LogOut } from 'lucide-react';

export default function TopNav({
  property,
  activeTab,
  onNewReservation,
  onRefresh,
  searchQuery,
  setSearchQuery,
  currentUser,
  onLogout
}) {
  const getTabLabel = (tab) => {
    switch (tab) {
      case 'calendar': return 'Calendar Tape Chart';
      case 'reservations': return 'Reservations Management';
      case 'housekeeping': return 'Housekeeping Room View';
      case 'cleaninghistory': return 'Room Cleaning History';
      case 'rates': return 'Rates, Inventory & Channel Manager';
      case 'nightaudit': return 'Night Audit & Financial Close';
      case 'reports': return 'Financial & Manager Reports';
      case 'guests': return 'Guest Directory & CRM';
      case 'permissions': return 'Staff & Granular RBAC Permissions';
      case 'settings':
      case 'properties': return 'Settings';
      case 'profile': return 'Profile';
      case 'myteam': return 'My Team';
      default: return 'Overview';
    }
  };

  return (
    <header className="top-nav">
      <div className="top-nav-left">
        <div className="breadcrumbs">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Home size={14} color="#64748B" />
            <span>PMS</span>
          </span>
          <span style={{ color: '#94A3B8' }}>&gt;</span>
          <span className="current">{getTabLabel(activeTab)}</span>
        </div>
      </div>

      <div className="top-nav-right">
        {/* Refresh Sync */}
        <button
          className="btn-secondary"
          onClick={onRefresh}
          title="Refresh & Sync PMS State"
          style={{ height: '36px', padding: '0 0.75rem' }}
        >
          <RefreshCw size={14} />
        </button>

        {/* Primary CTA: Walk-In / New Booking */}
        <button
          type="button"
          className="btn-create-reservation"
          onClick={onNewReservation}
        >
          <span
            className="material-symbols-outlined select-none"
            style={{ fontSize: '18px', lineHeight: 1 }}
            aria-hidden="true"
          >
            add
          </span>
          <span>Create Reservation</span>
        </button>

        {/* User Profile Badge & Quick Sign Out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderLeft: '1px solid #E2E8F0', paddingLeft: '0.75rem', marginLeft: '0.25rem' }}>
          <div
            title={`Signed in as ${currentUser?.name === 'Astha India' ? 'HOTEL NIVASA' : (currentUser?.name || 'HOTEL NIVASA')} (${currentUser?.role || 'Staff'})`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.25rem 0.5rem',
              borderRadius: '6px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0'
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#2563EB',
                color: '#ffffff',
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {(currentUser?.initials === 'AI' || !currentUser?.initials) ? 'HN' : currentUser.initials}
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
              {currentUser?.name === 'Astha India' ? 'HOTEL NIVASA' : (currentUser?.name ? currentUser.name.split(' ')[0] : 'Staff')}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B', backgroundColor: '#F1F5F9', padding: '1px 5px', borderRadius: '4px' }}>
              {currentUser?.role || 'Staff'}
            </span>
          </div>

          {onLogout && (
            <button
              className="btn-secondary"
              onClick={onLogout}
              title="Sign Out"
              style={{
                height: '36px',
                padding: '0 0.65rem',
                color: '#DC2626',
                borderColor: '#FCA5A5',
                backgroundColor: '#FEF2F2',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer'
              }}
            >
              <LogOut size={14} color="#DC2626" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#DC2626' }}>Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

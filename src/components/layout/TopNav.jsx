import React from 'react';
import { Plus, RefreshCw, Calendar, Search, Bell, CheckCircle, Home, ChevronDown, LogOut } from 'lucide-react';

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
      case 'rates': return 'Rates, Inventory & Channel Manager';
      case 'nightaudit': return 'Night Audit & Financial Close';
      case 'reports': return 'Financial & Manager Reports';
      case 'guests': return 'Guest Directory & CRM';
      case 'permissions': return 'Staff & Granular RBAC Permissions';
      case 'settings':
      case 'properties': return 'Settings';
      case 'myteam': return 'My Team';
      case 'cashier': return 'Cashier';
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

        {/* Operational Business Date Pill */}
        <div className="business-date-badge" title="Hotel System Operational Date">
          <Calendar size={14} color="#2563eb" />
          <span>Business Date: <strong>{property?.businessDate || '2026-10-24'}</strong></span>
        </div>

        {/* Cloud Firestore Live Status */}
        <div
          className="cloud-live-badge"
          title="Google Cloud Firestore Live Multi-terminal Sync"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.3rem 0.65rem',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#166534'
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              boxShadow: '0 0 0 2px rgba(34, 197, 94, 0.25)'
            }}
          />
          <span>Cloud: <strong>Live Sync</strong></span>
        </div>
      </div>

      <div className="top-nav-right">
        {/* Quick Search */}
        <div style={{ position: 'relative' }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search guest, #RES, phone..."
            value={searchQuery || ''}
            onChange={(e) => setSearchQuery && setSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px', height: '36px', width: '220px', fontSize: '0.82rem' }}
          />
        </div>

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
          className="btn-primary"
          onClick={onNewReservation}
          style={{ height: '36px' }}
        >
          <Plus size={16} />
          <span>Create Reservation</span>
        </button>

        {/* User Profile Badge & Quick Sign Out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderLeft: '1px solid #E2E8F0', paddingLeft: '0.75rem', marginLeft: '0.25rem' }}>
          <div
            title={`Signed in as ${currentUser?.name || 'Astha India'} (${currentUser?.role || 'Staff'})`}
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
              {currentUser?.initials || (currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'AI')}
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
              {currentUser?.name ? currentUser.name.split(' ')[0] : 'Staff'}
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

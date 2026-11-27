import React, { useState } from 'react';
import {
  LayoutDashboard,
  CalendarCheck2,
  Calendar,
  CreditCard,
  LayoutGrid,
  FileText,
  BarChart2,
  Users,
  Menu,
  LogOut,
  Building2,
  Settings,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  History
} from 'lucide-react';
import { canAccessRoute } from '../../utils/permissions';

export default function Sidebar({
  activeTab,
  activeSubtab,
  setActiveTab,
  counts,
  property,
  currentUser,
  teamMembers = [],
  onSwitchUser,
  hasPermission,
  onLogout,
  isCollapsed = false,
  onToggleCollapse
}) {
  const [isUserSwitcherOpen, setIsUserSwitcherOpen] = useState(false);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(activeTab === 'properties');

  React.useEffect(() => {
    if (activeTab === 'properties') {
      setIsPropertiesOpen(true);
    }
  }, [activeTab]);

  const propertyName = (property?.name === 'HOTEL ASTHA' || property?.name === 'Hotel Astha' || !property?.name) ? 'HOTEL NIVASA' : property.name;
  const propertyTagline = (property?.tagline === 'HOTEL ASTHA' || property?.tagline === 'Hotel Astha' || !property?.tagline) ? 'HOTEL NIVASA' : property.tagline;
  const propertyInitials = (property?.initials === 'HA' || property?.initials === 'AI' || !property?.initials) ? 'HN' : property.initials;
  const propertyLogo = property?.organizationIcon || property?.logo || null;

  const activeUser = currentUser || property?.userProfile || {
    name: 'HOTEL NIVASA',
    role: 'Owner',
    initials: 'HN'
  };

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard
    },
    {
      id: 'reservations',
      label: 'Reservations',
      icon: CalendarCheck2,
      badge: counts?.reservations > 0 ? counts.reservations : null
    },
    {
      id: 'calendar',
      label: 'Calendar View',
      icon: Calendar
    },
    {
      id: 'rates',
      label: 'Rates & Inventory',
      icon: CreditCard
    },
    {
      id: 'housekeeping',
      label: 'Room View',
      icon: LayoutGrid,
      badge: counts?.dirtyRooms > 0 ? counts.dirtyRooms : null,
      badgeDanger: true
    },
    {
      id: 'cleaninghistory',
      label: 'Cleaning History',
      icon: History
    },
    {
      id: 'nightaudit',
      label: 'Night Audit',
      icon: FileText
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: BarChart2
    },
    {
      id: 'guests',
      label: 'Guests',
      icon: Users
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings
    },
    {
      id: 'myteam',
      label: 'My Team',
      icon: Users
    },
    {
      id: 'permissions',
      label: 'Permissions',
      icon: ShieldCheck
    },
    {
      id: 'properties',
      label: 'Properties',
      icon: Building2,
      hasDropdown: true
    }
  ];

  return (
    <aside className={`sidebar-light ${isCollapsed ? 'collapsed' : ''}`}>
      {/* 1. Header Bar: Hamburger + Asthastay Brand Logo */}
      <div className="sidebar-brand-row">
        <button
          className="sidebar-menu-btn"
          title={isCollapsed ? "Expand Navigation" : "Collapse Navigation"}
          onClick={onToggleCollapse}
        >
          <Menu size={18} color="#0f172a" />
        </button>
        <div
          className="sidebar-brand-title"
          onClick={() => setActiveTab && setActiveTab('calendar')}
          style={{ cursor: 'pointer' }}
          title="Asthastay"
        >
          <img
            src="/logo/Gemini_Generated_Image_bxm6yabxm6yabxm6.png"
            alt="Asthastay"
            className="sidebar-brand-logo-img"
          />
        </div>
      </div>

      {/* 2. Hotel Switcher Card */}
      <div className="sidebar-hotel-card">
        <div
          className="hotel-avatar-ha"
          style={propertyLogo ? { overflow: 'hidden', padding: 0, background: 'transparent' } : undefined}
        >
          {propertyLogo ? (
            <img
              src={propertyLogo}
              alt={propertyName}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', display: 'block' }}
            />
          ) : (
            propertyInitials
          )}
        </div>
        <div className="hotel-info">
          <div className="hotel-name">{propertyName}</div>
          <div className="hotel-sub">{propertyTagline}</div>
        </div>
      </div>

      {/* 3. Navigation List */}
      <nav className="sidebar-menu-list">
        {navItems.map((item) => {
          if (!canAccessRoute(activeUser, item.id)) {
            return null;
          }

          const Icon = item.icon;
          const isActive = activeTab === item.id;
          if (item.id === 'properties') {
            const isPropertiesActive = activeTab === 'properties';
            const propertySubItems = [
              { id: 'all', label: 'All Properties' },
              { id: 'meal-plans', label: 'Meal Plans' },
              { id: 'rooms', label: 'Rooms' },
              { id: 'rate-plans', label: 'Rate Plans' },
              { id: 'tax-services', label: 'Tax & Services' }
            ];

            return (
              <div key="properties-group" className="sidebar-group-wrap">
                <button
                  type="button"
                  className={`sidebar-nav-btn ${isPropertiesActive ? 'active' : ''}`}
                  onClick={() => {
                    const nextOpen = !isPropertiesOpen;
                    setIsPropertiesOpen(nextOpen);
                    if (nextOpen && activeTab !== 'properties') {
                      setActiveTab('properties', activeSubtab || 'all');
                    }
                  }}
                >
                  <div className="nav-btn-left">
                    <Icon size={18} className="nav-btn-icon" />
                    <span className="nav-btn-label">{item.label}</span>
                  </div>
                  {isPropertiesOpen ? (
                    <ChevronUp size={14} color={isPropertiesActive ? "#0066ff" : "#64748b"} style={{ flexShrink: 0 }} />
                  ) : (
                    <ChevronDown size={14} color="#64748b" style={{ flexShrink: 0 }} />
                  )}
                </button>

                {isPropertiesOpen && !isCollapsed && (
                  <div className="sidebar-sub-menu">
                    {propertySubItems.map((sub) => {
                      const isSubActive =
                        isPropertiesActive &&
                        (activeSubtab === sub.id || (!activeSubtab && sub.id === 'all'));
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          className={`sidebar-sub-nav-btn ${isSubActive ? 'active' : ''}`}
                          onClick={() => setActiveTab('properties', sub.id)}
                        >
                          {sub.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <button
              key={item.id}
              className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <div className="nav-btn-left">
                <Icon size={18} className="nav-btn-icon" />
                <span className="nav-btn-label">{item.label}</span>
              </div>
              {item.badge && (
                <span className={`nav-pill-badge ${item.badgeDanger ? 'badge-danger' : 'badge-primary'}`}>
                  {item.badge}
                </span>
              )}
              {item.hasDropdown && (
                <ChevronDown size={14} color="#64748b" style={{ flexShrink: 0 }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* 4. Bottom Controls: User Card */}
      <div className="sidebar-bottom-section">
        {/* User Profile Card */}
        <div className="sidebar-user-card" style={{ position: 'relative' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer', overflow: 'hidden' }}
            onClick={() => setIsUserSwitcherOpen(!isUserSwitcherOpen)}
            title="Click to switch active role or profile"
          >
            <div
              className="user-avatar-ai"
              style={propertyLogo ? { overflow: 'hidden', padding: 0, background: 'transparent' } : undefined}
            >
              {propertyLogo ? (
                <img
                  src={propertyLogo}
                  alt={activeUser.name === 'Astha India' ? 'HOTEL NIVASA' : activeUser.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', display: 'block' }}
                />
              ) : (
                (activeUser.initials === 'AI' || !activeUser.initials) ? 'HN' : activeUser.initials
              )}
            </div>
            <div className="user-details">
              <div className="user-name">{activeUser.name === 'Astha India' ? 'HOTEL NIVASA' : activeUser.name}</div>
              <div className="user-role">{activeUser.role}</div>
            </div>
          </div>

          <button
            className="user-logout-btn"
            title="Sign out / Switch user"
            onClick={() => {
              if (onLogout) onLogout();
              else setIsUserSwitcherOpen(!isUserSwitcherOpen);
            }}
          >
            <LogOut size={16} color="#ef4444" />
          </button>

          {/* User Switcher Dropdown Menu */}
          {isUserSwitcherOpen && (
            <div
              className="sidebar-user-switcher-menu"
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 8px)',
                left: 0,
                right: 0,
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                padding: '6px',
                zIndex: 100
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                {activeUser.role === 'Owner' ? 'Active Profile (Owner Preview)' : 'Signed In Staff'}
              </div>

              {activeUser.role === 'Owner' ? (
                <>
                  {/* Owner */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      fontWeight: 600
                    }}
                    onClick={() => {
                      if (onSwitchUser) onSwitchUser('usr_owner');
                      setIsUserSwitcherOpen(false);
                    }}
                  >
                    <span>👑</span>
                    <span>HOTEL NIVASA (Owner)</span>
                  </div>

                  {/* Team Members */}
                  {teamMembers
                    .filter((m) => {
                      if (!m || m.role === 'Owner' || m.isDeleted || m.status === 'Removed') return false;
                      if (m.id === 'usr_02' || m.name === 'Shankar L' || m.email === 'owner@hotelastha.com' || m.name === 'Astha India') return false;
                      const currentPropRaw = property?.name || 'HOTEL NIVASA';
                      const targetProp = currentPropRaw === 'HOTEL ASTHA' || currentPropRaw === 'Hotel Astha' ? 'HOTEL NIVASA' : currentPropRaw;
                      const memberProps = (m.properties || []).map((p) =>
                        p === 'HOTEL ASTHA' || p === 'Hotel Astha' ? 'HOTEL NIVASA' : p
                      );
                      return memberProps.length === 0 || memberProps.includes(targetProp) || memberProps.includes('HOTEL NIVASA') || targetProp === 'ALL';
                    })
                    .map((m) => {
                      const isCurrent = activeUser.id === m.id;
                      return (
                        <div
                          key={m.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '7px 10px',
                            borderRadius: '6px',
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            backgroundColor: isCurrent ? '#eff6ff' : 'transparent',
                            color: isCurrent ? '#1d4ed8' : '#334155',
                            fontWeight: isCurrent ? 600 : 500
                          }}
                          onClick={() => {
                            if (onSwitchUser) onSwitchUser(m.id);
                            setIsUserSwitcherOpen(false);
                          }}
                        >
                          <span>👤</span>
                          <span className="truncate">{m.name || m.email} ({m.role})</span>
                        </div>
                      );
                    })}
                </>
              ) : (
                <div style={{ padding: '6px 10px', fontSize: '12.5px', color: '#334155' }}>
                  <div style={{ fontWeight: 600, color: '#0F172A' }}>{activeUser.name}</div>
                  <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                    {activeUser.staffId ? `${activeUser.staffId} · ` : ''}{activeUser.role}
                  </div>
                </div>
              )}

              {/* Divider & Sign Out */}
              <div style={{ height: '1px', backgroundColor: '#E2E8F0', margin: '6px 0' }} />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  fontWeight: 600
                }}
                onClick={() => {
                  setIsUserSwitcherOpen(false);
                  if (onLogout) onLogout();
                }}
              >
                <LogOut size={14} color="#DC2626" />
                <span>Sign Out of Terminal</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Building2,
  ChevronDown,
  MoreVertical,
  Trash2,
  Mail,
  Copy,
  Pencil,
  ExternalLink,
  Home,
  CheckCircle2,
  AlertCircle,
  Archive,
  Lock,
  Ban,
  KeyRound
} from 'lucide-react';
import AddTeamMemberModal from './AddTeamMemberModal';
import EditTeamMemberModal from './EditTeamMemberModal';
import InviteEmailModal from './InviteEmailModal';
import StaffCredentialsModal from './StaffCredentialsModal';
import './my-team.css';

export default function MyTeamView({
  teamMembers = [],
  propertiesList = ['HOTEL NIVASA'],
  currentProperty = 'HOTEL NIVASA',
  propertyId = 'hotel_astha_main',
  currentUser,
  onInviteMembers,
  onStaffCreated,
  onToggleStaffStatus,
  onUpdateMember,
  onManagePermissions,
  onRemoveInvitation,
  onRemoveMember,
  showToast,
  onNavigateToAccept
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProperty, setSelectedProperty] = useState(currentProperty);
  const [isPropertyDropdownOpen, setIsPropertyDropdownOpen] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [previewEmailMember, setPreviewEmailMember] = useState(null);
  const [createdCredentials, setCreatedCredentials] = useState(null);

  // Action Menu dropdown state: memberId or null + fixed viewport position (avoids clipping inside overflow table)
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [actionMenuPos, setActionMenuPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!openActionMenuId) return;
    const handleDismiss = () => setOpenActionMenuId(null);
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpenActionMenuId(null);
    };
    window.addEventListener('scroll', handleDismiss, true);
    window.addEventListener('resize', handleDismiss);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('scroll', handleDismiss, true);
      window.removeEventListener('resize', handleDismiss);
      window.removeEventListener('keydown', handleKey);
    };
  }, [openActionMenuId]);

  const handleToggleActionMenu = (e, memberId) => {
    e.stopPropagation();
    if (openActionMenuId === memberId) {
      setOpenActionMenuId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 196;
    const menuHeight = 172;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < menuHeight + 16;

    setActionMenuPos({
      top: openUpward ? Math.max(10, rect.top - menuHeight - 6) : rect.bottom + 6,
      left: Math.max(10, Math.min(window.innerWidth - menuWidth - 12, rect.right - menuWidth))
    });
    setOpenActionMenuId(memberId);
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filter team members:
  // Hide Owner / Astha India account from the visible My Team list
  const eligibleMembers = (teamMembers || []).filter(
    (m) =>
      m &&
      m.id !== 'usr_02' &&
      m.name !== 'Shankar L' &&
      m.role !== 'Owner' &&
      m.email !== 'info@hotelnivasa.com' &&
      m.email !== 'owner@hotelnivasa.com' &&
      m.email !== 'owner@hotelastha.com' &&
      m.name !== 'HOTEL NIVASA'
  );

  const filteredMembers = eligibleMembers.filter((m) => {
    // Property filter: match current property, canonicalizing 'HOTEL ASTHA' and 'HOTEL NIVASA'
    const memberProps = (m.properties || []).map((p) =>
      p === 'HOTEL ASTHA' || p === 'Hotel Astha' ? 'HOTEL NIVASA' : p
    );
    const targetProp =
      selectedProperty === 'HOTEL ASTHA' || selectedProperty === 'Hotel Astha'
        ? 'HOTEL NIVASA'
        : selectedProperty;

    const matchesProp =
      memberProps.length === 0 ||
      memberProps.includes(targetProp) ||
      memberProps.includes('HOTEL NIVASA') ||
      targetProp === 'ALL';

    // Search filter
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      m.name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.staffId?.toLowerCase().includes(q) ||
      m.role?.toLowerCase().includes(q);

    return matchesProp && matchesSearch;
  });

  const totalResults = filteredMembers.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const visibleMembers = filteredMembers.slice(startIndex, startIndex + pageSize);

  const handleOpenAddModal = () => {
    setIsAddModalOpen(true);
  };

  const handleSendInvitations = ({ emails, assignments }) => {
    if (onInviteMembers) {
      onInviteMembers({ emails, assignments });
    }
    if (showToast) {
      showToast('Success: Invitations sent successfully');
    }
  };

  const handleRemoveInvite = (member) => {
    setOpenActionMenuId(null);
    if (onRemoveInvitation) {
      onRemoveInvitation(member.id);
    }
    if (showToast) {
      showToast(`🗑️ Invitation to ${member.email} removed.`);
    }
  };

  const handleRemoveActiveMember = (member) => {
    setOpenActionMenuId(null);
    if (onRemoveMember) {
      onRemoveMember(member.id);
    }
    if (showToast) {
      showToast(`🗑️ Member ${member.name} removed from property.`);
    }
  };

  return (
    <div className="my-team-container" onClick={() => setOpenActionMenuId(null)}>
      {/* 1. Top Header Bar matching OTAL PMS */}
      <header className="my-team-top-header">
        <div className="my-team-breadcrumbs">
          <span className="my-team-crumb-home">
            <Home size={14} />
          </span>
          <span className="my-team-crumb-link">PMS</span>
          <span className="my-team-crumb-sep">&gt;</span>
          <span className="my-team-crumb-active">My Team</span>
        </div>
      </header>

      {/* 2. Controls Bar: Property Dropdown & Search & Invite CTA */}
      <div className="my-team-controls-bar">
        <div />

        <div className="my-team-controls-right">
          {/* Property Selector Dropdown */}
          <div className="my-team-property-dropdown-wrap" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="my-team-property-selector-btn"
              onClick={() => setIsPropertyDropdownOpen(!isPropertyDropdownOpen)}
            >
              <Building2 size={15} color="#64748B" />
              <span>{selectedProperty}</span>
              <ChevronDown size={14} color="#64748B" />
            </button>

            {isPropertyDropdownOpen && (
              <div className="my-team-property-menu">
                {propertiesList.map((propName) => (
                  <div
                    key={propName}
                    className={`my-team-property-option ${selectedProperty === propName ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedProperty(propName);
                      setIsPropertyDropdownOpen(false);
                      setCurrentPage(1);
                    }}
                  >
                    <Building2 size={14} />
                    <span>{propName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search by name or email... */}
          <div className="my-team-search-wrap">
            <Search size={14} color="#94A3B8" className="my-team-search-icon" />
            <input
              type="text"
              className="my-team-search-input"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Primary Blue Create Staff CTA Button (visible when members exist) */}
          {eligibleMembers.length > 0 && (
            <button
              type="button"
              className="my-team-btn-invite"
              onClick={handleOpenAddModal}
            >
              <UserPlus size={15} />
              <span>+ Create Staff Member</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Content: Empty State vs Data Table */}
      <div className="my-team-content-area">
        {eligibleMembers.length === 0 ? (
          /* EMPTY STATE - Pixel Perfect Match to Screenshot */
          <div className="my-team-empty-state">
            <div className="my-team-empty-icon-box">
              <Users size={28} color="#64748B" />
            </div>

            <h2 className="my-team-empty-title">No Team Members Yet</h2>
            <p className="my-team-empty-sub">
              Create your first staff member (like a Hotel Manager), select their allowed permissions, and generate their Staff ID &amp; Password.
            </p>

            <button
              type="button"
              className="my-team-empty-btn-cta"
              onClick={handleOpenAddModal}
            >
              <UserPlus size={16} />
              <span>+ Create Staff Member</span>
            </button>
          </div>
        ) : filteredMembers.length === 0 ? (
          /* Search Empty State */
          <div className="my-team-no-search-results">
            <p>No team members match your filter criteria.</p>
            <button
              type="button"
              className="my-team-link-reset"
              onClick={() => setSearchQuery('')}
            >
              Reset Search
            </button>
          </div>
        ) : (
          /* TEAM MEMBERS TABLE */
          <div className="my-team-table-card">
            <div className="my-team-table-wrapper">
              <table className="my-team-table">
                <thead>
                  <tr>
                    <th style={{ width: '28%' }}>Member</th>
                    <th style={{ width: '20%' }}>Role</th>
                    <th style={{ width: '20%' }}>Properties</th>
                    <th style={{ width: '14%' }}>Invited At</th>
                    <th style={{ width: '12%' }}>Status</th>
                    <th style={{ width: '6%', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMembers.map((member) => {
                    const initials =
                      member.initials ||
                      (member.name ? member.name.charAt(0).toUpperCase() : member.email.charAt(0).toUpperCase());

                    const isInvited = member.status === 'INVITED';
                    const isSuspended = member.status === 'SUSPENDED' || member.status === 'INACTIVE';
                    const isActive = !isInvited && !isSuspended;

                    return (
                      <tr key={member.id} className="my-team-row">
                        {/* 1. Member Column */}
                        <td>
                          <div className="my-team-member-cell">
                            <div className="my-team-avatar-circle">
                              {initials}
                            </div>
                            <div className="my-team-member-info">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span className="my-team-member-name">{member.name || 'Invited Staff'}</span>
                                {member.staffId && (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      padding: '1px 7px',
                                      borderRadius: '9999px',
                                      backgroundColor: '#EFF6FF',
                                      border: '1px solid #DBEAFE',
                                      color: '#1D4ED8',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      fontFamily: 'monospace'
                                    }}
                                  >
                                    <KeyRound size={10} />
                                    {member.staffId}
                                  </span>
                                )}
                              </div>
                              <span className="my-team-member-email">{member.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Role Badge */}
                        <td>
                          <span className="my-team-role-pill">
                            {member.role || 'Hotel Manager / GM'}
                          </span>
                        </td>

                        {/* 3. Properties Badge */}
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {member.properties && member.properties.length > 0 ? (
                              member.properties.map((prop) => (
                                <span key={prop} className="my-team-property-pill">
                                  {prop}
                                </span>
                              ))
                            ) : (
                              <span className="my-team-property-pill">{currentProperty}</span>
                            )}
                          </div>
                        </td>

                        {/* 4. Invited At */}
                        <td>
                          <span className="my-team-date-text">
                            {member.invitedAt || '11 Nov 2026'}
                          </span>
                        </td>

                        {/* 5. Status Badge */}
                        <td>
                          {isInvited && (
                            <span className="my-team-status-pill invited">
                              Invited
                            </span>
                          )}
                          {isActive && (
                            <span className="my-team-status-pill active">
                              Active
                            </span>
                          )}
                          {isSuspended && (
                            <span
                              className="my-team-status-pill"
                              style={{
                                backgroundColor: '#FEF2F2',
                                color: '#DC2626',
                                border: '1px solid #FECACA'
                              }}
                            >
                              Suspended
                            </span>
                          )}
                        </td>

                        {/* 6. Action Menu */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="my-team-action-dots-btn"
                            onClick={(e) => handleToggleActionMenu(e, member.id)}
                          >
                            <MoreVertical size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Fixed-position Action Popover (rendered outside overflow table so it never clips or causes scrollbars) */}
            {openActionMenuId && (() => {
              const member = visibleMembers.find((m) => m.id === openActionMenuId);
              if (!member) return null;
              const isInvited = member.status === 'INVITED';
              const isSuspended = member.status === 'SUSPENDED' || member.status === 'INACTIVE';
              const isActive = !isInvited && !isSuspended;

              return (
                <div
                  className="my-team-action-menu"
                  style={{
                    top: `${actionMenuPos.top}px`,
                    left: `${actionMenuPos.left}px`
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isInvited && (
                    <>
                      <button
                        type="button"
                        className="my-team-action-item"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setPreviewEmailMember(member);
                        }}
                      >
                        <Mail size={14} color="#2563EB" />
                        <span>Preview Invite Email</span>
                      </button>
                      <button
                        type="button"
                        className="my-team-action-item"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          if (onNavigateToAccept && member.invitationToken) {
                            onNavigateToAccept(member.invitationToken);
                          }
                        }}
                      >
                        <ExternalLink size={14} color="#059669" />
                        <span>Open Accept Flow</span>
                      </button>
                      <div className="my-team-menu-divider" />
                      <button
                        type="button"
                        className="my-team-action-item danger"
                        onClick={() => handleRemoveInvite(member)}
                      >
                        <Trash2 size={14} />
                        <span>Remove Invitation</span>
                      </button>
                    </>
                  )}

                  {(isActive || isSuspended) && (
                    <>
                      <button
                        type="button"
                        className="my-team-action-item"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setEditingMember(member);
                        }}
                      >
                        <Pencil size={14} color="#334155" />
                        <span>Edit Member</span>
                      </button>
                      <button
                        type="button"
                        className="my-team-action-item"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          if (onManagePermissions) {
                            onManagePermissions(member.id);
                          }
                        }}
                      >
                        <Lock size={14} color="#334155" />
                        <span>Manage Permissions</span>
                      </button>
                      {member.role !== 'Owner' && (
                        <>
                          <button
                            type="button"
                            className="my-team-action-item"
                            onClick={() => {
                              setOpenActionMenuId(null);
                              if (onToggleStaffStatus) {
                                onToggleStaffStatus(member.id);
                              }
                              if (showToast) {
                                showToast(
                                  isSuspended
                                    ? `Reactivated ${member.name}'s account.`
                                    : `Suspended ${member.name}'s account.`
                                );
                              }
                            }}
                          >
                            <Ban size={14} color={isSuspended ? '#059669' : '#D97706'} />
                            <span>{isSuspended ? 'Reactivate Account' : 'Suspend Account'}</span>
                          </button>
                          <div className="my-team-menu-divider" />
                          <button
                            type="button"
                            className="my-team-action-item danger"
                            onClick={() => handleRemoveActiveMember(member)}
                          >
                            <Trash2 size={14} color="#EF4444" />
                            <span>Remove Member</span>
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

            {/* Pagination Footer */}
            <div className="my-team-pagination-footer">
              <span className="my-team-pagination-text">
                Showing {totalResults > 0 ? startIndex + 1 : 0}-{Math.min(startIndex + pageSize, totalResults)} of {totalResults} results
              </span>

              <div className="my-team-pagination-controls">
                <button
                  type="button"
                  className="my-team-page-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  &lt;
                </button>
                <button type="button" className="my-team-page-btn active">
                  {currentPage}
                </button>
                <button
                  type="button"
                  className="my-team-page-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Staff Member & Generate Credentials Drawer */}
      <AddTeamMemberModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        propertiesList={propertiesList}
        currentProperty={currentProperty}
        propertyId={propertyId}
        currentUserId={currentUser?.id || 'usr_owner'}
        onStaffCreated={(result) => {
          if (onStaffCreated && result.member) {
            onStaffCreated(result.member);
          }
          setCreatedCredentials(result);
          if (showToast) {
            showToast(`Staff account created! Login ID: ${result.staffId}`, 'success');
          }
        }}
      />

      {/* One-Time Generated Staff ID & Password Modal */}
      <StaffCredentialsModal
        isOpen={!!createdCredentials}
        onClose={() => setCreatedCredentials(null)}
        credentials={createdCredentials}
      />

      {/* Edit Team Member Modal (Matches Image 2) */}
      <EditTeamMemberModal
        isOpen={!!editingMember}
        onClose={() => setEditingMember(null)}
        member={editingMember}
        propertiesList={propertiesList}
        onUpdateMember={onUpdateMember}
        showToast={showToast}
      />

      {/* Invitation Email Preview Modal */}
      <InviteEmailModal
        isOpen={!!previewEmailMember}
        onClose={() => setPreviewEmailMember(null)}
        member={previewEmailMember}
        organizationName={currentProperty}
        inviterName="HOTEL NIVASA"
        onNavigateToAccept={(tok) => {
          setPreviewEmailMember(null);
          if (onNavigateToAccept) onNavigateToAccept(tok);
        }}
      />
    </div>
  );
}


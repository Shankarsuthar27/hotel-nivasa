import React, { useState, useEffect } from 'react';
import {
  Users,
  X,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  Loader2,
  Check
} from 'lucide-react';
import { PREDEFINED_ROLES, getRoleDefaultPermissions } from '../../data/rolePresets';
import { createEmptyPermissions } from '../../utils/permissions';
import { createStaffAccount } from '../../services/firebaseAuth';

const PERMISSION_GROUPS = [
  {
    title: 'Dashboard & Calendar',
    items: [
      { path: 'dashboard.viewDashboard', label: 'View Dashboard' },
      { path: 'dashboard.viewCalendar', label: 'Calendar / Tape Chart' }
    ]
  },
  {
    title: 'Reservations & Front Desk',
    items: [
      { path: 'reservations.view', label: 'View Reservations' },
      { path: 'reservations.create', label: 'Create Reservation', requires: 'reservations.view' },
      { path: 'reservations.actions.checkIn', label: 'Check-In Guest', requires: 'reservations.view' },
      { path: 'reservations.actions.checkOut', label: 'Check-Out Guest', requires: 'reservations.view' },
      { path: 'reservations.actions.assignRoom', label: 'Assign / Move Room', requires: 'reservations.view' },
      { path: 'reservations.actions.amendStay', label: 'Amend Stay / Edit', requires: 'reservations.view' },
      { path: 'reservations.actions.cancel', label: 'Cancel Booking', requires: 'reservations.view' },
      { path: 'reservations.actions.delete', label: 'Delete Reservation', requires: 'reservations.view' },
      { path: 'reservations.nightAudit', label: 'Run Night Audit' }
    ]
  },
  {
    title: 'Reports & Analytics',
    items: [
      { path: 'reports.accessReports', label: 'View Reports' },
      { path: 'reports.reportActions.managerReport', label: 'Manager Report', requires: 'reports.accessReports' },
      { path: 'reports.reportActions.reservationReport', label: 'Reservation Report', requires: 'reports.accessReports' },
      { path: 'reports.reportActions.folioList', label: 'Folio & Ledger List', requires: 'reports.accessReports' }
    ]
  },
  {
    title: 'Rates, Rooms & Guests',
    items: [
      { path: 'ratesInventory.view', label: 'View Rates & Inventory' },
      { path: 'ratesInventory.actions.editRates', label: 'Edit Room Rates', requires: 'ratesInventory.view' },
      { path: 'ratesInventory.actions.stopSell', label: 'Stop Sell / Restrictions', requires: 'ratesInventory.view' },
      { path: 'advanced.roomInventory.view', label: 'Room View & Housekeeping' },
      { path: 'advanced.guestDatabase.view', label: 'Guests CRM' }
    ]
  },
  {
    title: 'Property, Taxes & Admin',
    items: [
      { path: 'taxesAddons.manageTaxes', label: 'Tax Rules & Services' },
      { path: 'team.viewTeam', label: 'View Team Directory' },
      { path: 'team.memberManagement', label: 'Create / Manage Staff', requires: 'team.viewTeam' },
      { path: 'team.permissionManagement', label: 'Manage Permissions' },
      { path: 'advanced.settings.view', label: 'Property Settings' }
    ]
  }
];

function getNestedBool(obj, path) {
  return path.split('.').reduce((acc, k) => acc?.[k], obj) === true;
}

function setNestedBool(obj, path, value) {
  const clone = JSON.parse(JSON.stringify(obj));
  const keys = path.split('.');
  let curr = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!curr[keys[i]] || typeof curr[keys[i]] !== 'object') {
      curr[keys[i]] = {};
    }
    curr = curr[keys[i]];
  }
  curr[keys[keys.length - 1]] = value;
  clone.allowAll = false;
  return clone;
}

export default function AddTeamMemberModal({
  isOpen,
  onClose,
  propertiesList = ['HOTEL NIVASA'],
  currentProperty = 'HOTEL NIVASA',
  propertyId = 'hotel_astha_main',
  currentUserId = 'usr_owner',
  onStaffCreated
}) {
  const [name, setName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [role, setRole] = useState('Hotel Manager / GM');
  const [selectedProperties, setSelectedProperties] = useState([currentProperty]);
  const [permissions, setPermissions] = useState(() => createEmptyPermissions());
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize sensible default permissions when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setContactEmail('');
      setRole('Hotel Manager / GM');
      setSelectedProperties([currentProperty]);
      const presets = getRoleDefaultPermissions();
      const preset = presets['Hotel Manager / GM']
        ? JSON.parse(JSON.stringify(presets['Hotel Manager / GM']))
        : createEmptyPermissions();
      preset.allowAll = false;
      // By default give manager dashboard, reservations (view+create+checkin+checkout), reports — owner can freely toggle any box
      setPermissions(preset);
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen, currentProperty]);

  if (!isOpen) return null;

  const canDeleteReservation = role === 'Owner' || role === 'Hotel Manager / GM';

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    const presets = getRoleDefaultPermissions();
    if (presets[newRole]) {
      const nextPerms = JSON.parse(JSON.stringify(presets[newRole]));
      nextPerms.allowAll = false;
      if (newRole !== 'Owner' && newRole !== 'Hotel Manager / GM' && nextPerms.reservations?.actions) {
        nextPerms.reservations.actions.delete = false;
      }
      setPermissions(nextPerms);
    }
  };

  const handleTogglePerm = (item) => {
    const currentlyChecked = getNestedBool(permissions, item.path);
    const nextVal = !currentlyChecked;
    let nextPerms = setNestedBool(permissions, item.path, nextVal);

    // If enabling a dependent action (e.g. Create Reservation), automatically enable its parent view
    if (nextVal && item.requires) {
      nextPerms = setNestedBool(nextPerms, item.requires, true);
    }
    setPermissions(nextPerms);
  };

  const handleClearAllPerms = () => {
    setPermissions(createEmptyPermissions());
  };

  const handleSelectAllPerms = () => {
    let next = createEmptyPermissions();
    PERMISSION_GROUPS.forEach((group) => {
      group.items.forEach((item) => {
        if (item.path === 'reservations.actions.delete' && !canDeleteReservation) return;
        next = setNestedBool(next, item.path, true);
      });
    });
    setPermissions(next);
  };

  const handleToggleProperty = (propName) => {
    if (selectedProperties.includes(propName)) {
      if (selectedProperties.length === 1) return;
      setSelectedProperties(selectedProperties.filter((p) => p !== propName));
    } else {
      setSelectedProperties([...selectedProperties, propName]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter the staff member full name.');
      return;
    }

    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      setError('Please enter a valid email address, or leave blank to auto-generate a Staff ID login.');
      return;
    }

    // Ensure at least one permission is enabled
    const hasAnyPerm = PERMISSION_GROUPS.some((g) =>
      g.items.some((item) => getNestedBool(permissions, item.path))
    );
    if (!hasAnyPerm) {
      setError('Please select at least one permission for this staff member.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createStaffAccount({
        name: name.trim(),
        contactEmail: contactEmail.trim(),
        role,
        properties: selectedProperties,
        permissions,
        propertyId,
        createdBy: currentUserId
      });

      if (!result.success) {
        setError(result.error || 'Could not create staff account.');
        return;
      }

      if (onStaffCreated) {
        onStaffCreated(result);
      }
      onClose();
    } catch (err) {
      setError(err?.message || 'Unexpected error creating staff account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="team-drawer-overlay" onClick={onClose}>
      <div
        className="team-drawer-container"
        style={{ maxWidth: '620px' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Drawer Header */}
        <div className="team-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="team-drawer-icon-badge">
              <Users size={18} color="#2563EB" />
            </div>
            <div>
              <h3 className="team-drawer-title">Create Staff Member & Permissions</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                Select allowed operations and auto-generate a Staff Login ID & Password
              </p>
            </div>
          </div>
          <button
            type="button"
            className="team-drawer-close-btn"
            onClick={onClose}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Body Form */}
        <form onSubmit={handleSubmit} className="team-drawer-form">
          <div className="team-drawer-body" style={{ gap: '18px' }}>
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#DC2626',
                  fontSize: '13px',
                  fontWeight: 500
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Row 1: Staff Name & Role */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="team-drawer-field">
                <label className="team-drawer-label">
                  Full Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="team-drawer-input"
                  placeholder="e.g. Rahul Verma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="team-drawer-field">
                <label className="team-drawer-label">
                  Role Preset <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  className="team-drawer-input"
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  disabled={isSubmitting}
                  style={{ backgroundColor: '#FFFFFF', cursor: 'pointer' }}
                >
                  {PREDEFINED_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value="Night Auditor">Night Auditor</option>
                  <option value="Custom Staff">Custom Staff</option>
                </select>
              </div>
            </div>

            {/* Row 2: Optional Contact Email & Property */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
              <div className="team-drawer-field">
                <label className="team-drawer-label">
                  Email Address <span style={{ color: '#94A3B8', fontWeight: 400 }}>(Optional)</span>
                </label>
                <input
                  type="email"
                  className="team-drawer-input"
                  placeholder="Leave blank to use Staff ID login"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="team-drawer-field">
                <label className="team-drawer-label">Assigned Property</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '4px' }}>
                  {propertiesList.map((propName) => {
                    const checked = selectedProperties.includes(propName);
                    return (
                      <button
                        key={propName}
                        type="button"
                        onClick={() => handleToggleProperty(propName)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 12px',
                          borderRadius: '8px',
                          border: checked ? '1px solid #2563EB' : '1px solid #E2E8F0',
                          backgroundColor: checked ? '#EFF6FF' : '#FFFFFF',
                          color: checked ? '#1D4ED8' : '#475569',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {checked && <Check size={13} />}
                        <span>{propName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Granular Permissions Selection Matrix */}
            <div
              style={{
                borderTop: '1px solid #E2E8F0',
                paddingTop: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <ShieldCheck size={16} color="#2563EB" />
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                    Select Allowed Functions & Operations
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleClearAllPerms}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      color: '#64748B',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Clear All
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectAllPerms}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #DBEAFE',
                      backgroundColor: '#EFF6FF',
                      color: '#2563EB',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Select All
                  </button>
                </div>
              </div>

              {PERMISSION_GROUPS.map((group) => (
                <div
                  key={group.title}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    backgroundColor: '#F8FAFC'
                  }}
                >
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#334155',
                      marginBottom: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em'
                    }}
                  >
                    {group.title}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: '8px'
                    }}
                  >
                    {group.items
                      .filter((item) => item.path !== 'reservations.actions.delete' || canDeleteReservation)
                      .map((item) => {
                      const isChecked = getNestedBool(permissions, item.path);
                      return (
                        <label
                          key={item.path}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '7px 10px',
                            borderRadius: '8px',
                            border: isChecked ? '1px solid #93C5FD' : '1px solid #E2E8F0',
                            backgroundColor: isChecked ? '#EFF6FF' : '#FFFFFF',
                            cursor: 'pointer',
                            fontSize: '12.5px',
                            fontWeight: isChecked ? 600 : 500,
                            color: isChecked ? '#1E40AF' : '#475569',
                            userSelect: 'none',
                            transition: 'all 0.12s ease'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTogglePerm(item)}
                            style={{
                              width: '15px',
                              height: '15px',
                              accentColor: '#2563EB',
                              cursor: 'pointer',
                              margin: 0
                            }}
                          />
                          <span>{item.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="team-drawer-footer">
            <button
              type="button"
              className="team-drawer-btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="team-drawer-btn-submit"
              disabled={isSubmitting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Generating Credentials...</span>
                </>
              ) : (
                <>
                  <KeyRound size={15} />
                  <span>Create Staff & Generate ID / Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

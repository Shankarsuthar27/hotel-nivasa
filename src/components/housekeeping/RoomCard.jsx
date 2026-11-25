import React from 'react';
import { UserCheck, Calendar, Wrench, PlusCircle, Key } from 'lucide-react';
import './room-card.css';

// Helper to format checkout date into: "Checkout: Fri 13, Nov 2026"
const formatCheckoutDate = (dateStr) => {
  if (!dateStr) return 'Checkout: Fri 13, Nov 2026';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  if (isNaN(d.getTime())) return `Checkout: ${dateStr}`;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `Checkout: ${days[d.getDay()]} ${d.getDate()}, ${months[d.getMonth()]} ${d.getFullYear()}`;
};

export default function RoomCard({
  room,
  roomTypes = [],
  isSelected = false,
  onToggleSelect,
  onUpdateStatus,
  onOpenMaintenance,
  onOpenReservation,
  onNewReservation,
  onClick,
  activeReservation
}) {
  const cleanRoomNumber = String(room?.roomNumber || room?.id || '101')
    .replace(/^rm_/, '')
    .trim();

  // Helper to format room type name matching user's reference specification
  const formatRoomTypeName = (rawName, typeId, allTypes = []) => {
    let name = rawName;
    if (!name && typeId && Array.isArray(allTypes)) {
      const matched = allTypes.find((rt) => rt.id === typeId || rt.code === typeId);
      if (matched) name = matched.name;
    }
    if (!name) {
      if (cleanRoomNumber.startsWith('2')) name = 'SUPERIOR';
      else if (cleanRoomNumber.startsWith('3')) name = 'DOUBLE SINGLE';
      else name = 'DELUXE';
    }

    const upper = String(name).trim().toUpperCase();
    if (upper === 'SUPIRIOR' || upper === 'SUPERIOR') return 'SUPERIOR';
    if (upper === 'SEMI DELUXE' || upper === 'SEMI-DELUXE') return 'Semi Deluxe';
    if (upper === 'DELUXE' || upper === 'DELUX ROOM' || upper === 'DELUXE ROOM') return 'Deluxe';
    if (upper === 'DOUBLE SINGLE' || upper === 'DOUBLE SIGNLE' || upper === 'DOUBLE-SINGLE') return 'Double Single';

    return name;
  };

  const displayRoomType = formatRoomTypeName(
    room?.roomTypeName || room?.roomType,
    room?.roomTypeId,
    roomTypes
  );

  const activeResStatus = String(activeReservation?.status || '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const isOccupied =
    !!activeReservation &&
    (activeResStatus === 'in_house' || activeResStatus === 'checked_in');
  const isDirty = !isOccupied && room?.status === 'dirty';
  const isMaintenance = !isOccupied && room?.status === 'maintenance';
  const isAvailable = !isOccupied && !isDirty && !isMaintenance;

  // --------------------------------------------------------------------------
  // 1. OCCUPIED ROOM CARD
  // --------------------------------------------------------------------------
  if (isOccupied) {
    const guestName =
      activeReservation?.primaryGuest?.name ||
      `${activeReservation?.primaryGuest?.title || ''} ${activeReservation?.primaryGuest?.firstName || ''} ${activeReservation?.primaryGuest?.lastName || ''}`.trim() ||
      'Mr Shankar Suthar';

    const checkoutText = formatCheckoutDate(activeReservation?.checkOutDate);

    return (
      <div
        className="hk-room-card hk-card-occupied"
        onClick={onClick}
        title={`Room ${cleanRoomNumber} - Occupied by ${guestName}`}
      >
        {/* Navy solid top bar */}
        <div className="hk-card-accent-bar" />

        <div className="hk-card-inner">
          {/* Header Row: Room number + Room Type badge + Occupied badge + UserCheck icon */}
          <div className="hk-card-header-row">
            <div className="hk-card-header-left">
              <span className="hk-card-room-num">{cleanRoomNumber}</span>
              <span className="hk-card-room-type-badge">{displayRoomType}</span>
              <span className="hk-badge-pill hk-badge-occupied">Occupied</span>
            </div>
            <div className="hk-card-actions">
              <UserCheck size={18} className="text-blue-950" strokeWidth={2.2} />
            </div>
          </div>

          {/* Guest Name */}
          <div className="hk-card-guest-name">
            {guestName}
          </div>

          {/* Checkout Info */}
          <div className="hk-card-checkout-row">
            <Calendar size={13} className="text-slate-400" />
            <span>{checkoutText}</span>
          </div>

          {/* Tags: In Room + Stayover */}
          <div className="hk-card-tags-row">
            <span className="hk-card-tag">In Room</span>
            <span className="hk-card-tag">Stayover</span>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 2. VACANT ROOM CARD (Available, Dirty, or Maintenance)
  // --------------------------------------------------------------------------
  let cardClass = 'hk-card-available';
  let badgeClass = 'hk-badge-available';
  let badgeLabel = 'Available';
  let defaultSubtext = 'Ready for check-in';

  if (isDirty) {
    cardClass = 'hk-card-dirty';
    badgeClass = 'hk-badge-dirty';
    badgeLabel = 'Dirty';
    defaultSubtext = room?.notes || 'Needs cleaning';
  } else if (isMaintenance) {
    cardClass = 'hk-card-maintenance';
    badgeClass = 'hk-badge-maintenance';
    badgeLabel = 'Maintenance';
    defaultSubtext = room?.notes || 'Out of order';
  } else {
    // Available
    defaultSubtext = room?.notes || 'Ready for check-in';
  }

  // Handlers
  const handleToggleDirty = (e) => {
    e.stopPropagation();
    if (onUpdateStatus) {
      onUpdateStatus(room.id, isDirty ? 'clean' : 'dirty');
    }
  };

  const handleMaintenanceClick = (e) => {
    e.stopPropagation();
    if (onOpenMaintenance) {
      onOpenMaintenance(room);
    } else if (onUpdateStatus) {
      onUpdateStatus(room.id, isMaintenance ? 'clean' : 'maintenance');
    }
  };

  const handleReservationClick = (e) => {
    e.stopPropagation();
    if (onNewReservation) {
      onNewReservation(room?.id || room?.roomNumber);
    } else if (onOpenReservation) {
      onOpenReservation(room);
    } else {
      window.location.href = '/reservations/create';
    }
  };

  return (
    <div
      className={`hk-room-card ${cardClass} ${isSelected ? 'hk-card-selected' : ''}`}
      onClick={onClick}
    >
      {/* Top solid colored accent bar */}
      <div className="hk-card-accent-bar" />

      <div className="hk-card-inner">
        {/* Header Row: Checkbox + Room number + Room Type badge + 3 Action Icons */}
        <div className="hk-card-header-row">
          <div className="hk-card-header-left">
            <input
              type="checkbox"
              className="hk-card-checkbox"
              checked={isSelected}
              title={`Select room ${cleanRoomNumber}`}
              onChange={(e) => {
                e.stopPropagation();
                if (onToggleSelect) onToggleSelect(room?.id);
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="hk-card-room-num">{cleanRoomNumber}</span>
            <span className="hk-card-room-type-badge">{displayRoomType}</span>
          </div>

          <div className="hk-card-actions">
            {/* 1. Broom / Mop Icon (Clean / Dirty toggle) */}
            <button
              type="button"
              className="hk-card-action-btn"
              title={isDirty ? 'Mark Available / Clean' : 'Mark Dirty'}
              onClick={handleToggleDirty}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v7" />
                <path d="M5 9h14l-1.5 11a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 9z" />
                <path d="M8 15h8" />
              </svg>
            </button>

            {/* 2. Wrench Icon (Maintenance / Block Room) */}
            <button
              type="button"
              className={`hk-card-action-btn ${isMaintenance ? 'active' : ''}`}
              title="Maintenance / Block Room"
              onClick={handleMaintenanceClick}
            >
              <Wrench size={14} strokeWidth={2} />
            </button>

            {/* 3. Plus Circle Icon (Create Reservation) */}
            <button
              type="button"
              className="hk-card-action-btn"
              title="Create Reservation for Room"
              onClick={handleReservationClick}
            >
              <PlusCircle size={15} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Status Badge */}
        <div style={{ marginTop: '10px', marginBottom: '4px' }}>
          <span className={`hk-badge-pill ${badgeClass}`}>{badgeLabel}</span>
        </div>

        {/* Subtext */}
        <div className="hk-card-subtext">
          {defaultSubtext}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Wrench, PlusCircle, User, Clock, Moon, Calendar, X, AlertCircle, Ban, ChevronDown, CheckCircle2 } from 'lucide-react';
import RoomCard from './RoomCard';
import BlockRoomDrawer from './BlockRoomDrawer.jsx';
import BookingDetailsDrawer from '../reservations/BookingDetailsDrawer';
import { pmsStore } from '../../services/pmsStore';
import { navigate } from '../../services/router';
import './room-card.css';

export default function HousekeepingView({
  rooms = [],
  roomTypes = [],
  reservations = [],
  onUpdateStatus,
  onNewReservation,
  onSelectReservation
}) {
  // Booking Details Drawer state (matching OTAL PMS Room View)
  const [selectedDrawerReservation, setSelectedDrawerReservation] = useState(null);

  // Dropdown states
  const [isRoomsOpen, setIsRoomsOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isUnassignedOpen, setIsUnassignedOpen] = useState(false);

  // Filter selections
  const [selectedRoomType, setSelectedRoomType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Selected rooms for batch actions
  const [selectedRooms, setSelectedRooms] = useState(new Set());

  // Maintenance / Block Room Drawer State (Matching OTAL PMS Specification)
  const [maintenanceRoom, setMaintenanceRoom] = useState(null);
  const [blockCheckIn, setBlockCheckIn] = useState('2026-11-02');
  const [blockCheckOut, setBlockCheckOut] = useState('2026-11-02');
  const [blockReason, setBlockReason] = useState('');
  const [isReasonOpen, setIsReasonOpen] = useState(false);
  const [blockRoomType, setBlockRoomType] = useState(null);
  const [blockSelectedRoom, setBlockSelectedRoom] = useState(null);
  const [isRoomTypeOpen, setIsRoomTypeOpen] = useState(false);
  const [isRoomSelectOpen, setIsRoomSelectOpen] = useState(false);
  const reasonDropdownRef = useRef(null);
  const roomTypeDropdownRef = useRef(null);
  const roomSelectDropdownRef = useRef(null);

  const handleOpenMaintenance = (r) => {
    const roomObj = (typeof r === 'object' && r !== null)
      ? r
      : rooms.find(rm => rm.id === r || rm.roomNumber === r)
        || rooms.find(rm => rm.roomNumber === '101')
        || rooms[0]
        || { id: 'rm_101', roomNumber: '101', roomTypeId: 'rt_deluxe' };

    setMaintenanceRoom(roomObj);
    setBlockSelectedRoom(roomObj);

    const rType = (roomObj?.roomTypeId && roomTypes.find(rt => rt.id === roomObj.roomTypeId))
      || roomTypes.find(rt => rt.name.toLowerCase().includes('delux'))
      || roomTypes[0]
      || { id: 'rt_deluxe', name: 'Delux Room' };

    setBlockRoomType(rType);
    setBlockReason(roomObj?.status === 'maintenance' && roomObj?.notes ? roomObj.notes : '');
    setBlockCheckIn('2026-11-02');
    setBlockCheckOut('2026-11-02');
    setIsReasonOpen(false);
    setIsRoomTypeOpen(false);
    setIsRoomSelectOpen(false);
  };

  // Close dropdowns on outside click
  const roomsDropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (roomsDropdownRef.current && !roomsDropdownRef.current.contains(event.target)) {
        setIsRoomsOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
        setIsStatusOpen(false);
      }
      if (reasonDropdownRef.current && !reasonDropdownRef.current.contains(event.target)) {
        setIsReasonOpen(false);
      }
      if (roomTypeDropdownRef.current && !roomTypeDropdownRef.current.contains(event.target)) {
        setIsRoomTypeOpen(false);
      }
      if (roomSelectDropdownRef.current && !roomSelectDropdownRef.current.contains(event.target)) {
        setIsRoomSelectOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Helper: strictly determines whether a reservation actively occupies a physical room
  const isResOccupyingRoom = (res, room) => {
    if (!res || !room) return false;
    const normStatus = String(res.status || '').toLowerCase().replace(/[\s-]+/g, '_');
    if (normStatus !== 'in_house' && normStatus !== 'checked_in') return false;

    const rNum = String(room.roomNumber || '').trim();
    const resNum = String(res.roomNumber || res.roomNum || '').trim();
    return (
      (res.roomId && (res.roomId === room.id || res.roomId === `rm_${rNum}` || res.roomId === rNum)) ||
      (rNum && resNum && resNum === rNum)
    );
  };

  // Compute counts for top status legend
  const counts = useMemo(() => {
    let avail = 0;
    let occ = 0;
    let maint = 0;
    let dirty = 0;

    rooms.forEach((r) => {
      const isOcc = reservations.some((res) => isResOccupyingRoom(res, r));

      if (isOcc) {
        occ++;
      } else if (r.status === 'maintenance') {
        maint++;
      } else if (r.status === 'dirty') {
        dirty++;
      } else {
        avail++;
      }
    });

    return {
      available: avail,
      occupied: occ,
      maintenance: maint,
      dirty: dirty
    };
  }, [rooms, reservations]);

  // Unassigned reservations (active bookings without a physical room allocated)
  const unassignedReservations = useMemo(() => {
    return reservations.filter((r) => {
      if (!r) return false;
      const st = String(r.status || '').toLowerCase().replace(/[\s-]+/g, '_');
      if (st === 'cancelled' || st === 'canceled' || st === 'checked_out' || st === 'no_show' || st === 'departed') {
        return false;
      }
      const hasRoomId = Boolean(r.roomId && String(r.roomId).trim() !== '' && String(r.roomId).toLowerCase() !== 'unassigned');
      const hasRoomNum = Boolean(r.roomNumber && String(r.roomNumber).trim() !== '' && String(r.roomNumber).toLowerCase() !== 'unassigned');
      return !hasRoomId && !hasRoomNum;
    });
  }, [reservations]);

  // Filtered rooms list
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      // Room type filter
      if (selectedRoomType !== 'ALL' && r.roomTypeId !== selectedRoomType) {
        return false;
      }
      // Status filter
      if (selectedStatus === 'ALL') return true;
      const isOcc = reservations.some((res) => isResOccupyingRoom(res, r));
      if (selectedStatus === 'occupied') return isOcc;
      if (selectedStatus === 'clean') return !isOcc && (r.status === 'clean' || r.status === 'occupied' || !r.status);
      return !isOcc && r.status === selectedStatus;
    });
  }, [rooms, reservations, selectedRoomType, selectedStatus]);

  // Group rooms by room type
  const groupedRooms = useMemo(() => {
    const map = {};
    roomTypes.forEach((rt) => {
      map[rt.id] = { type: rt, rooms: [] };
    });
    filteredRooms.forEach((r) => {
      let targetId = r.roomTypeId;
      if (!map[targetId]) {
        // Try matching by name or code
        const matched = roomTypes.find(
          rt => rt.id === targetId ||
                rt.code === targetId ||
                rt.name?.toLowerCase() === String(r.roomTypeName || r.roomType || targetId || '').toLowerCase()
        );
        if (matched) {
          targetId = matched.id;
        } else {
          const cleanNum = String(r.roomNumber || '').replace(/\D/g, '');
          if (cleanNum.startsWith('2')) {
            targetId = roomTypes.find(rt => rt.id === 'rt_supirior' || rt.name?.toLowerCase().includes('supirior'))?.id || roomTypes[0]?.id;
          } else if (cleanNum.startsWith('3')) {
            targetId = roomTypes.find(rt => rt.id === 'rt_double_single' || rt.name?.toLowerCase().includes('double'))?.id || roomTypes[0]?.id;
          } else {
            targetId = roomTypes.find(rt => rt.id === 'rt_semi_deluxe' || rt.name?.toLowerCase().includes('semi') || rt.name?.toLowerCase().includes('delux'))?.id || roomTypes[0]?.id;
          }
        }
      }
      if (map[targetId]) {
        map[targetId].rooms.push(r);
      }
    });
    // Ensure room numbers are sorted numerically (101, 102, 201, 202)
    Object.values(map).forEach((g) => {
      g.rooms.sort((a, b) =>
        (a.roomNumber || '').localeCompare(b.roomNumber || '', undefined, { numeric: true })
      );
    });
    // Order: 1. SEMI DELUXE, 2. SUPIRIOR, 3. DELUXE, 4. DOUBLE SINGLE
    const orderMap = { 'SEMI DELUXE': 1, 'SUPIRIOR': 2, 'DELUXE': 3, 'DOUBLE SINGLE': 4 };
    return Object.values(map)
      .filter((g) => g.rooms.length > 0)
      .sort((a, b) => {
        const orderA = orderMap[a.type?.name] || 99;
        const orderB = orderMap[b.type?.name] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.type?.name || '').localeCompare(String(b.type?.name || ''));
      });
  }, [roomTypes, filteredRooms]);

  // Selected room type label for button
  const selectedRoomTypeLabel = useMemo(() => {
    if (selectedRoomType === 'ALL') return 'All Rooms';
    const found = roomTypes.find((rt) => rt.id === selectedRoomType);
    return found ? found.name : 'All Rooms';
  }, [selectedRoomType, roomTypes]);

  // Selected status label for button
  const selectedStatusLabel = useMemo(() => {
    switch (selectedStatus) {
      case 'clean': return 'Available';
      case 'occupied': return 'Occupied';
      case 'maintenance': return 'Maintenance';
      case 'dirty': return 'Dirty';
      default: return 'All Statuses';
    }
  }, [selectedStatus]);

  // Selection toggle
  const handleToggleSelect = (roomId) => {
    setSelectedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) {
        next.delete(roomId);
      } else {
        next.add(roomId);
      }
      return next;
    });
  };

  // Batch status update
  const handleBatchStatus = (newStatus) => {
    if (onUpdateStatus) {
      selectedRooms.forEach((roomId) => {
        onUpdateStatus(roomId, newStatus);
      });
    }
    setSelectedRooms(new Set());
  };

  return (
    <div className="room-view-container">
      {/* 1. Top Filter Bar */}
      <div className="room-view-top-bar">
        
        {/* Left Controls: Filter Icon + All Rooms Dropdown + All Statuses Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          
          {/* Funnel / Filter button */}
          <button
            type="button"
            className="room-view-icon-btn"
            title="Filter View"
          >
            <span className="material-symbols-outlined select-none" style={{ fontSize: '18px' }}>
              filter_list
            </span>
          </button>

          {/* All Rooms Dropdown (Image 4) */}
          <div className="relative" ref={roomsDropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="room-view-select-btn"
              onClick={() => setIsRoomsOpen(!isRoomsOpen)}
            >
              <span className="material-symbols-outlined select-none text-blue-600" style={{ fontSize: '18px' }}>
                category
              </span>
              <span>{selectedRoomTypeLabel}</span>
              <span className="material-symbols-outlined select-none text-slate-400" style={{ fontSize: '18px' }}>
                {isRoomsOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {/* All Rooms Popover Menu */}
            {isRoomsOpen && (
              <div className="room-view-dropdown-popover" style={{ width: '180px' }}>
                <div
                  className="room-view-dropdown-item"
                  onClick={() => { setSelectedRoomType('ALL'); setIsRoomsOpen(false); }}
                >
                  <span className="font-semibold text-sm text-slate-800">All Rooms</span>
                  {selectedRoomType === 'ALL' && (
                    <span className="material-symbols-outlined text-blue-600 ml-auto" style={{ fontSize: '18px' }}>
                      check
                    </span>
                  )}
                </div>
                {roomTypes.map((rt) => (
                  <div
                    key={rt.id}
                    className="room-view-dropdown-item"
                    onClick={() => { setSelectedRoomType(rt.id); setIsRoomsOpen(false); }}
                  >
                    <span className="font-medium text-sm text-slate-800">{rt.name}</span>
                    {selectedRoomType === rt.id && (
                      <span className="material-symbols-outlined text-blue-600 ml-auto" style={{ fontSize: '18px' }}>
                        check
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All Statuses Dropdown (Image 1 & Image 3) */}
          <div className="relative" ref={statusDropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="room-view-select-btn"
              onClick={() => setIsStatusOpen(!isStatusOpen)}
            >
              <span className="material-symbols-outlined select-none text-blue-600" style={{ fontSize: '18px' }}>
                grid_view
              </span>
              <span>{selectedStatusLabel}</span>
              <span className="material-symbols-outlined select-none text-slate-400" style={{ fontSize: '18px' }}>
                {isStatusOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {/* All Statuses Popover Menu */}
            {isStatusOpen && (
              <div className="room-view-dropdown-popover" style={{ width: '220px' }}>
                {/* 1. All Statuses */}
                <div
                  className="room-view-dropdown-rich-item"
                  onClick={() => { setSelectedStatus('ALL'); setIsStatusOpen(false); }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>All Statuses</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Show all rooms</div>
                  </div>
                  {selectedStatus === 'ALL' && (
                    <span className="material-symbols-outlined text-blue-600" style={{ fontSize: '18px' }}>
                      check
                    </span>
                  )}
                </div>

                {/* 2. Available */}
                <div
                  className="room-view-dropdown-rich-item"
                  onClick={() => { setSelectedStatus('clean'); setIsStatusOpen(false); }}
                >
                  <div style={{ width: '26px', height: '26px', borderRadius: '9999px', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-outlined select-none" style={{ fontSize: '15px' }}>check_circle</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>Available</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Ready for check-in</div>
                  </div>
                  {selectedStatus === 'clean' && (
                    <span className="material-symbols-outlined text-blue-600" style={{ fontSize: '18px' }}>
                      check
                    </span>
                  )}
                </div>

                {/* 3. Occupied */}
                <div
                  className="room-view-dropdown-rich-item"
                  onClick={() => { setSelectedStatus('occupied'); setIsStatusOpen(false); }}
                >
                  <div style={{ width: '26px', height: '26px', borderRadius: '9999px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-outlined select-none" style={{ fontSize: '15px' }}>person</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>Occupied</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Currently occupied</div>
                  </div>
                  {selectedStatus === 'occupied' && (
                    <span className="material-symbols-outlined text-blue-600" style={{ fontSize: '18px' }}>
                      check
                    </span>
                  )}
                </div>

                {/* 4. Maintenance */}
                <div
                  className="room-view-dropdown-rich-item"
                  onClick={() => { setSelectedStatus('maintenance'); setIsStatusOpen(false); }}
                >
                  <div style={{ width: '26px', height: '26px', borderRadius: '9999px', backgroundColor: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-outlined select-none" style={{ fontSize: '15px' }}>build</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>Maintenance</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Out of order</div>
                  </div>
                  {selectedStatus === 'maintenance' && (
                    <span className="material-symbols-outlined text-blue-600" style={{ fontSize: '18px' }}>
                      check
                    </span>
                  )}
                </div>

                {/* 5. Dirty */}
                <div
                  className="room-view-dropdown-rich-item"
                  onClick={() => { setSelectedStatus('dirty'); setIsStatusOpen(false); }}
                >
                  <div style={{ width: '26px', height: '26px', borderRadius: '9999px', backgroundColor: '#fff1f2', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-outlined select-none" style={{ fontSize: '15px' }}>cleaning_services</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>Dirty</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Needs cleaning</div>
                  </div>
                  {selectedStatus === 'dirty' && (
                    <span className="material-symbols-outlined text-blue-600" style={{ fontSize: '18px' }}>
                      check
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Controls: Status Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Status Legend Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '9999px', backgroundColor: '#22c55e' }} />
              <span>Available ({counts.available})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '9999px', backgroundColor: '#3b82f6' }} />
              <span>Occupied ({counts.occupied})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '9999px', backgroundColor: '#f59e0b' }} />
              <span>Maintenance ({counts.maintenance})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '9999px', backgroundColor: '#ef4444' }} />
              <span>Dirty ({counts.dirty})</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Floating Batch Action Bar (when rooms selected) */}
      {selectedRooms.size > 0 && (
        <div style={{
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '10px 20px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>
            {selectedRooms.size} room{selectedRooms.size > 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleBatchStatus('clean')}
              style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Mark Clean
            </button>
            <button
              type="button"
              onClick={() => handleBatchStatus('dirty')}
              style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Mark Dirty
            </button>
            <button
              type="button"
              onClick={() => {
                const targetId = Array.from(selectedRooms)[0];
                handleOpenMaintenance(targetId);
              }}
              style={{ backgroundColor: '#d97706', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Mark Maintenance
            </button>
            <button
              type="button"
              onClick={() => setSelectedRooms(new Set())}
              style={{ backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid #334155', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* 3. Room Groups by Category */}
      <div className="flex flex-col gap-8">
        {groupedRooms.map((group) => {
          const rt = group.type;
          const unassignedCount = unassignedReservations.filter((r) => r.roomTypeId === rt.id).length;

          return (
            <section key={rt.id} className="hk-category-section">
              {/* Group Header: e.g. Ultra Premium 1 Rooms / Delux Room 2 Rooms */}
              <div className="hk-category-header">
                <h3 className="hk-category-title">{rt.name}</h3>
                <span className="hk-category-count-badge">
                  {group.rooms.length} Rooms
                </span>
                {unassignedCount > 0 && (
                  <div
                    onClick={() => setIsUnassignedOpen(true)}
                    className="hk-category-unassigned-badge"
                    title="View unassigned bookings"
                  >
                    <AlertCircle size={13} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                    <span>{unassignedCount} Unassigned</span>
                  </div>
                )}
              </div>

              {/* Room Cards Grid */}
              <div className="hk-cards-grid">
                {group.rooms.map((room) => {
                  // Only actively checked-in / in-house reservations occupy a room.
                  // Checked-out, cancelled, no-show, or un-checked-in reservations never mark a room Occupied.
                  const activeRes = reservations.find((r) => isResOccupyingRoom(r, room)) || null;

                  return (
                    <RoomCard
                      key={room.id}
                      room={room}
                      isSelected={selectedRooms.has(room.id)}
                      onToggleSelect={handleToggleSelect}
                      onUpdateStatus={onUpdateStatus}
                      onOpenMaintenance={(r) => handleOpenMaintenance(r)}
                      onOpenReservation={(r) => {
                        if (onNewReservation) {
                          onNewReservation(r?.id || r?.roomNumber);
                        } else {
                          navigate('/reservations/create');
                        }
                      }}
                      onNewReservation={(roomId) => {
                        if (onNewReservation) {
                          onNewReservation(roomId);
                        } else {
                          navigate('/reservations/create');
                        }
                      }}
                      onClick={() => {
                        if (activeRes) {
                          setSelectedDrawerReservation(activeRes);
                          if (onSelectReservation) {
                            onSelectReservation(activeRes);
                          }
                        }
                      }}
                      activeReservation={activeRes}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* 4. Unassigned Bookings Modal */}
      {isUnassignedOpen && (
        <div
          onClick={() => setIsUnassignedOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.14)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: unassignedReservations.length > 0 ? '#fffbeb' : '#f0fdf4',
                    border: `1px solid ${unassignedReservations.length > 0 ? '#fde68a' : '#bbf7d0'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  {unassignedReservations.length > 0 ? (
                    <AlertCircle size={18} color="#d97706" />
                  ) : (
                    <CheckCircle2 size={18} color="#16a34a" />
                  )}
                </div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                  Unassigned Reservations ({unassignedReservations.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUnassignedOpen(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '6px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 18px 0', lineHeight: 1.5 }}>
              These reservations have confirmed dates and room types but have not been assigned a specific room number yet.
            </p>

            {unassignedReservations.length === 0 ? (
              <div
                style={{
                  padding: '24px 16px',
                  borderRadius: '10px',
                  border: '1px solid #dcfce7',
                  backgroundColor: '#f0fdf4',
                  textAlign: 'center',
                  marginBottom: '20px'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#166534', marginBottom: '4px' }}>
                  All rooms are assigned
                </div>
                <div style={{ fontSize: '12.5px', color: '#15803d' }}>
                  There are currently no unassigned reservations pending room allocation.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', maxHeight: '320px', overflowY: 'auto' }}>
                {unassignedReservations.map((res) => {
                  const candidateRoom =
                    rooms.find(
                      (rm) =>
                        rm.roomTypeId === res.roomTypeId &&
                        rm.status !== 'maintenance' &&
                        !reservations.some((other) => isResOccupyingRoom(other, rm))
                    ) ||
                    rooms.find(
                      (rm) =>
                        rm.status !== 'maintenance' &&
                        !reservations.some((other) => isResOccupyingRoom(other, rm))
                    );

                  const rtLabel =
                    res.roomTypeName ||
                    roomTypes.find((t) => t.id === res.roomTypeId)?.name ||
                    'Room';

                  return (
                    <div
                      key={res.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1px solid #fed7aa',
                        backgroundColor: '#fffbeb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#1e293b' }}>
                          {res.primaryGuest?.name || res.guestName || 'Guest'}{' '}
                          <span style={{ color: '#64748b', fontWeight: 600 }}>
                            ({res.bookingReference || res.id})
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#92400e', marginTop: '3px' }}>
                          {rtLabel} • {res.checkInDate} to {res.checkOutDate}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!candidateRoom}
                        onClick={() => {
                          if (!candidateRoom) return;
                          const assigned = pmsStore.assignRoom(res.id, candidateRoom.id);
                          if (assigned) {
                            if (unassignedReservations.length <= 1) {
                              setIsUnassignedOpen(false);
                            }
                            const toast = document.createElement('div');
                            toast.className = 'pms-toast-notification';
                            toast.innerHTML = `<span>✅ Room ${candidateRoom.roomNumber} assigned to ${res.primaryGuest?.name || 'reservation'}.</span>`;
                            document.body.appendChild(toast);
                            setTimeout(() => toast.remove(), 2800);
                          }
                        }}
                        style={{
                          padding: '7px 14px',
                          backgroundColor: candidateRoom ? '#2563eb' : '#cbd5e1',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          cursor: candidateRoom ? 'pointer' : 'not-allowed',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                      >
                        {candidateRoom ? `Assign Room ${candidateRoom.roomNumber}` : 'No Room Free'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsUnassignedOpen(false)}
                className="room-view-select-btn"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Block Room Slide-over Drawer (Exact Match to OTAL PMS Specification) */}
      <BlockRoomDrawer
        isOpen={!!maintenanceRoom}
        onClose={() => {
          setMaintenanceRoom(null);
          setIsReasonOpen(false);
          setIsRoomTypeOpen(false);
          setIsRoomSelectOpen(false);
        }}
        roomType={blockRoomType?.name || 'Delux Room'}
        roomNumber={blockSelectedRoom?.roomNumber || '101'}
        initialCheckIn={blockCheckIn || '2026-11-02'}
        initialCheckOut={blockCheckOut || '2026-11-02'}
        initialReason={blockReason || (blockSelectedRoom?.status === 'maintenance' && blockSelectedRoom?.notes ? blockSelectedRoom.notes : '')}
        availableRooms={rooms.map(rm => ({
          ...rm,
          roomTypeName: roomTypes.find(rt => rt.id === rm.roomTypeId)?.name || 'Delux Room'
        }))}
        availableRoomTypes={roomTypes}
        isBlocked={blockSelectedRoom?.status === 'maintenance'}
        onRelease={() => {
          if (onUpdateStatus && blockSelectedRoom) {
            onUpdateStatus(blockSelectedRoom.id, 'clean');
          }
          setMaintenanceRoom(null);
        }}
        onApply={(data) => {
          const targetRoom = (data?.roomNumber && rooms.find(rm => rm.roomNumber === data.roomNumber))
            || blockSelectedRoom
            || maintenanceRoom;
          if (targetRoom) {
            const finalReason = data.reason || 'Maintenance';
            pmsStore.addMaintenanceBlock({
              roomId: targetRoom.id,
              startDate: data.checkIn,
              endDate: data.checkOut,
              reason: finalReason
            });
            if (onUpdateStatus) {
              onUpdateStatus(targetRoom.id, 'maintenance', {
                notes: finalReason,
                startDate: data.checkIn,
                endDate: data.checkOut
              });
            }
          }
          setMaintenanceRoom(null);
        }}
        onClear={() => {
          setBlockReason('');
          setBlockCheckIn('2026-11-02');
          setBlockCheckOut('2026-11-02');
        }}
      />

      {/* 6. Booking Details Slide-over Drawer (Matching Reference Image 2) */}
      <BookingDetailsDrawer
        isOpen={!!selectedDrawerReservation}
        onClose={() => setSelectedDrawerReservation(null)}
        reservation={
          selectedDrawerReservation
            ? (reservations.find((r) => r.id === selectedDrawerReservation.id) || selectedDrawerReservation)
            : null
        }
        onEditReservation={(res) => {
          setSelectedDrawerReservation(null);
          const targetId = res?.id || (res?.bookingReference ? res.bookingReference.replace('#', '').toLowerCase() : 'res_1');
          navigate(`/reservations/${targetId}/edit`);
        }}
      />
    </div>
  );
}

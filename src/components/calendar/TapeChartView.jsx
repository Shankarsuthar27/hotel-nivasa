import React, { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Wrench,
  Info,
  X,
  CalendarCheck,
  ChevronDown
} from 'lucide-react';
import BlockRoomDrawer from '../housekeeping/BlockRoomDrawer.jsx';
import BookingDetailsDrawer from '../reservations/BookingDetailsDrawer.jsx';
import { CustomCalendar } from '../common/CustomDatePicker';
import ScheduleCalendarAvailabilityCell from './ScheduleCalendarAvailabilityCell';
import { pmsStore } from '../../services/pmsStore';
import { navigate } from '../../services/router';
import { normalizeDateStr, isResMatchingRoom, getNextDayIsoDate } from '../../services/dateUtils';

// ==========================================
// Memoized Subcomponents for Peak Performance
// ==========================================

const DateHeaderRow = memo(function DateHeaderRow({
  dateList,
  allCategoryKeys,
  allCollapsed,
  onToggleAllCategories
}) {
  return (
    <tr className="sticky-header-row">
      <th
        className="sticky-room-col"
        style={{
          padding: '0.75rem 0.85rem',
          textAlign: 'left',
          background: '#ffffff',
          verticalAlign: 'middle'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
            Room Info
          </span>
          {allCategoryKeys.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleAllCategories();
              }}
              style={{
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                color: '#64748b',
                fontSize: '0.68rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '2px 7px',
                borderRadius: '4px',
                transition: 'all 0.15s ease'
              }}
              title={allCollapsed ? 'Expand all room categories' : 'Collapse all room categories'}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#2563eb';
                e.currentTarget.style.borderColor = '#93c5fd';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#64748b';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              {allCollapsed ? 'Expand All' : 'Collapse All'}
            </button>
          )}
        </div>
      </th>

      {dateList.map((col) => {
        const headerColor = col.isWeekend ? '#ea580c' : '#1e293b';
        const subColor = col.isWeekend ? '#ea580c' : '#64748b';

        return (
          <th
            key={col.isoStr}
            className="date-col-header"
            style={{
              textAlign: 'center',
              padding: '0.55rem 0.2rem',
              background: col.isWeekend ? '#fffdfa' : '#ffffff',
              borderBottom: col.isToday ? '2px solid #2563eb' : undefined
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: subColor,
                letterSpacing: '0.02em'
              }}
            >
              {col.dayName}
            </div>
            <div
              style={{
                fontSize: '1rem',
                fontWeight: 800,
                color: headerColor,
                margin: '1px 0'
              }}
            >
              {col.dayNum}
            </div>
            <div
              style={{
                fontSize: '0.66rem',
                fontWeight: 600,
                color: subColor,
                letterSpacing: '0.04em'
              }}
            >
              {col.month}
            </div>
          </th>
        );
      })}
    </tr>
  );
});

const CategoryRow = memo(function CategoryRow({
  group,
  dateList,
  cellWidth,
  isCollapsed,
  onToggleCollapse,
  categoryAvailMap
}) {
  const rt = group.type;

  return (
    <tr
      className="tape-chart-category-row"
      style={{ background: '#ffffff', cursor: 'pointer' }}
      onClick={() => onToggleCollapse(rt.id)}
      title={isCollapsed ? `Click to expand ${rt.name}` : `Click to collapse ${rt.name}`}
    >
      <td
        className="sticky-room-col"
        style={{
          padding: '0.5rem 0.85rem',
          background: '#ffffff',
          borderBottom: '1px solid #f1f5f9',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 700,
            fontSize: '0.82rem',
            color: '#1e293b'
          }}
        >
          <div
            className="tape-chart-category-chevron"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '16px',
              height: '16px',
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              color: '#64748b'
            }}
          >
            <ChevronDown size={14} strokeWidth={2.4} />
          </div>
          <span style={{ letterSpacing: '0.02em' }}>{rt.name.toUpperCase()}</span>
        </div>
      </td>

      {/* Date columns in Category Header: show available rooms count in circular badge */}
      {dateList.map((col) => {
        const availableCount = categoryAvailMap.get(`${rt.id}_${col.isoStr}`) ?? group.rooms.length;

        return (
          <td
            key={col.isoStr}
            className="date-col-cell"
            style={{
              padding: 0,
              minWidth: `${cellWidth}px`,
              maxWidth: `${cellWidth}px`,
              width: `${cellWidth}px`,
              height: '43.2px',
              background: col.isWeekend ? '#fffdfa' : '#ffffff',
              borderBottom: '1px solid #f1f5f9',
              verticalAlign: 'middle'
            }}
          >
            <ScheduleCalendarAvailabilityCell
              count={availableCount}
              width="100%"
            />
          </td>
        );
      })}
    </tr>
  );
});

const RoomRow = memo(function RoomRow({
  room,
  rt,
  dateList,
  cellWidth,
  startingResMap,
  coveringResMap,
  startingMbMap,
  coveringMbMap,
  selectedSlot,
  justDraggedRef,
  onSlotClickCell,
  onBookingClick,
  onMaintenanceClick,
  onToggleRoomStatus,
  onOpenMaintenanceDrawer
}) {
  return (
    <tr>
      {/* Sticky Room Label with Broom and Wrench icons */}
      <td
        className="sticky-room-col"
        style={{
          padding: '0.6rem 0.85rem',
          background: '#ffffff',
          verticalAlign: 'middle'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
            {room.roomNumber}
          </span>
          <div className="tape-chart-room-icons">
            {/* Broom Housekeeping Icon */}
            <button
              type="button"
              className="tape-chart-icon-btn"
              title={`Room ${room.roomNumber} status: ${room.status} (Click to toggle)`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleRoomStatus(room);
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#10b981"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3v9" />
                <path d="M5 15h14l-1.5 6h-11L5 15Z" />
                <path d="M7 15c0-2 1.5-3 5-3s5 1 5 3" />
                <path d="M9 21v-3" />
                <path d="M12 21v-3" />
                <path d="M15 21v-3" />
              </svg>
            </button>

            {/* Wrench Maintenance Block Icon */}
            <button
              type="button"
              className="tape-chart-icon-btn"
              title={`Block Room ${room.roomNumber} for Maintenance`}
              onClick={(e) => {
                e.stopPropagation();
                onOpenMaintenanceDrawer(room, rt);
              }}
            >
              <Wrench size={15} color="#94a3b8" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </td>

      {/* Date Slots */}
      {dateList.map((col) => {
        const cellKey = `${room.id}_${col.isoStr}`;
        const startingRes = startingResMap.get(cellKey);
        const coveringRes = coveringResMap.get(cellKey);
        const startingMb = startingMbMap.get(cellKey);
        const coveringMb = coveringMbMap.get(cellKey);

        const spanNights = startingRes
          ? (normalizeDateStr(startingRes.checkInDate) === col.isoStr
              ? (startingRes.nights || 1)
              : Math.max(1, Math.round((new Date(normalizeDateStr(startingRes.checkOutDate)) - new Date(col.isoStr)) / (1000 * 60 * 60 * 24))))
          : 1;

        const isSelected =
          selectedSlot?.room?.id === room.id &&
          selectedSlot?.col?.isoStr === col.isoStr;

        return (
          <td
            key={col.isoStr}
            className={`timeline-slot ${
              col.isWeekend ? 'weekend' : ''
            } ${isSelected ? 'selected-slot' : ''}`}
            onClick={(e) => {
              if (justDraggedRef.current) return;
              if (coveringRes) {
                onBookingClick(coveringRes);
              } else if (coveringMb) {
                onMaintenanceClick(coveringMb);
              } else {
                onSlotClickCell(e, room, col);
              }
            }}
            title={
              coveringRes
                ? `${coveringRes.primaryGuest?.name || 'Guest'} (${(coveringRes.status || '').toUpperCase()}) - ₹${coveringRes.totalAmount?.toLocaleString()}`
                : coveringMb
                ? `Maintenance: ${coveringMb.reason}`
                : `Click to book or block Room ${room.roomNumber} on ${col.isoStr}`
            }
          >
            {/* Spanning Booking Block */}
            {startingRes && (
              (startingRes.status === 'in_house' || startingRes.status === 'checked_out') ? (
                <div
                  className={`absolute inset-y-1 h-9 rounded-md flex items-center px-2 space-x-2 text-white shadow-sm mx-0.5 cursor-pointer hover:scale-[1.01] hover:brightness-105 transition-transform group/booking ${
                    startingRes.status === 'checked_out' ? 'bg-[#6B7280]' : 'bg-[#3B82F6]'
                  }`}
                  style={{
                    left: '2px',
                    width: `calc(${spanNights * cellWidth}px - 4px)`
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (justDraggedRef.current) return;
                    onBookingClick(startingRes);
                  }}
                  title={`${startingRes.status === 'checked_out' ? 'Checked-Out' : 'In-House'}: ${startingRes.primaryGuest?.name || 'Guest'} • Room ${room.roomNumber}`}
                >
                  <div
                    className="pl-1 flex items-center space-x-2 w-full"
                    style={{ paddingLeft: '4px', display: 'flex', alignItems: 'center', width: '100%', gap: '8px' }}
                  >
                    <div
                      className="flex-1 flex min-w-0 gap-2"
                      style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <span
                        className="material-symbols-outlined select-none text-white shrink-0"
                        style={{ fontSize: '18px', userSelect: 'none', color: '#ffffff', flexShrink: 0, lineHeight: 1 }}
                      >
                        person
                      </span>
                      <p
                        className="small-title-3 font-bold truncate"
                        style={{
                          fontWeight: 700,
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: '#ffffff',
                          fontSize: '13px'
                        }}
                      >
                        {startingRes.primaryGuest?.name || 'Guest'}
                      </p>
                    </div>
                    <span
                      className="material-symbols-outlined select-none text-white/50 shrink-0"
                      style={{
                        fontSize: '16px',
                        userSelect: 'none',
                        color: 'rgba(255, 255, 255, 0.5)',
                        flexShrink: 0,
                        lineHeight: 1
                      }}
                    >
                      chevron_right
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className={`booking-block status-${startingRes.status}`}
                  style={{
                    left: '2px',
                    width: `calc(${spanNights * cellWidth}px - 4px)`
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (justDraggedRef.current) return;
                    onBookingClick(startingRes);
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.25rem'
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: '0.74rem'
                      }}
                    >
                      {startingRes.primaryGuest?.name}
                    </span>
                    {startingRes.isVIP && (
                      <span
                        style={{
                          fontSize: '0.6rem',
                          background: '#fbbf24',
                          color: '#78350f',
                          padding: '1px 3px',
                          borderRadius: '2px',
                          fontWeight: 800
                        }}
                      >
                        VIP
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '0.64rem',
                      opacity: 0.9,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden'
                    }}
                  >
                    {startingRes.nights}N • ₹
                    {startingRes.totalAmount?.toLocaleString()} •{' '}
                    {startingRes.bookingSource}
                  </div>
                </div>
              )
            )}

            {/* Spanning Maintenance Block */}
            {startingMb && !coveringRes && (
              <div
                className="booking-block status-maintenance"
                style={{
                  left: '2px',
                  width: `calc(4 * ${cellWidth}px - 4px)`
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (justDraggedRef.current) return;
                  onMaintenanceClick(startingMb);
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.72rem',
                    fontWeight: 700
                  }}
                >
                  <Wrench size={12} />
                  <span>{startingMb.reason}</span>
                </div>
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
});

const FooterRow = memo(function FooterRow({ dateList, dailyStatsMap }) {
  return (
    <tr className="sticky-bottom-row" style={{ background: '#ffffff' }}>
      <td
        className="sticky-room-col"
        style={{
          position: 'sticky',
          left: 0,
          bottom: 0,
          zIndex: 30,
          padding: '0.65rem 0.85rem',
          fontWeight: 700,
          fontSize: '0.82rem',
          color: '#334155',
          background: '#ffffff',
          borderTop: '2px solid #e2e8f0',
          borderBottom: 'none',
          boxShadow: '2px -3px 6px rgba(0, 0, 0, 0.05)'
        }}
      >
        Availability Occupancy %
      </td>
      {dateList.map((col) => {
        const stats = dailyStatsMap.get(col.isoStr) || { available: 0, occPercent: 0 };
        return (
          <td
            key={col.isoStr}
            className="date-col-foot"
            style={{
              position: 'sticky',
              bottom: 0,
              zIndex: 25,
              textAlign: 'center',
              padding: '0.5rem 0.2rem',
              background: col.isWeekend ? '#fffdfa' : '#ffffff',
              borderTop: '2px solid #e2e8f0',
              borderBottom: 'none',
              boxShadow: '0 -3px 6px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
              {stats.available}
            </div>
            <div
              style={{
                fontSize: '0.68rem',
                color: '#64748b',
                fontWeight: 500,
                marginTop: '1px'
              }}
            >
              {stats.occPercent}%
            </div>
          </td>
        );
      })}
    </tr>
  );
});

// ==========================================
// Main TapeChartView Component
// ==========================================

export default function TapeChartView({
  property,
  roomTypes = [],
  rooms = [],
  reservations = [],
  maintenanceBlocks = [],
  onSelectReservation,
  onEditReservation,
  onSlotClick,
  onSlotMaintenanceClick
}) {
  const [baseDate, setBaseDate] = useState(() => new Date(property?.businessDate || '2026-10-26'));
  const [selectedRoomType, setSelectedRoomType] = useState('all');
  const [density, setDensity] = useState('cozy'); // 'cozy' | 'wide'
  const [isRoomTypeDropdownOpen, setIsRoomTypeDropdownOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null); // { room, col, position: { top, left } }
  const [maintenanceDrawerData, setMaintenanceDrawerData] = useState(null);
  const [selectedBookingDetails, setSelectedBookingDetails] = useState(null);
  const [isBaseDateCalOpen, setIsBaseDateCalOpen] = useState(false);

  // Track collapsed room categories (Set of roomTypeId strings)
  const [collapsedCategories, setCollapsedCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('hotel_astha_tape_collapsed');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleCategoryCollapse = useCallback((categoryKey) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryKey)) {
        next.delete(categoryKey);
      } else {
        next.add(categoryKey);
      }
      try {
        localStorage.setItem('hotel_astha_tape_collapsed', JSON.stringify(Array.from(next)));
      } catch (_) {}
      return next;
    });
  }, []);

  const popoverRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const roomTypeDropdownRef = useRef(null);

  // High-performance continuous buffer: 35 days past + 65 days future = 100 continuous days (~3.5 months)
  const BUFFER_PAST_DAYS = 35;
  const BUFFER_FUTURE_DAYS = 65;
  const TOTAL_DAYS = BUFFER_PAST_DAYS + BUFFER_FUTURE_DAYS;

  const cellWidth = density === 'cozy' ? 52 : 84;

  // Compute start date of the timeline buffer
  const bufferStartDate = useMemo(() => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - BUFFER_PAST_DAYS);
    return d;
  }, [baseDate]);

  // Currently visible start date (synchronized with horizontal scroll)
  const [visibleDate, setVisibleDate] = useState(() => new Date(baseDate));
  const isInitialScrollDone = useRef(false);

  // Format date range for popover header: e.g. "16 Nov – 16 Nov 2026"
  const formatSlotRange = (isoStr) => {
    if (!isoStr) return '';
    const [year, month, day] = isoStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const dayNum = d.getDate();
    const monthName = d.toLocaleDateString('en-US', { month: 'short' });
    const yearNum = d.getFullYear();
    return `${dayNum} ${monthName} – ${dayNum} ${monthName} ${yearNum}`;
  };

  // Format base date display: "DD/MM/YYYY"
  const formatBaseDateDisplay = (d) => {
    const target = d || baseDate;
    const dd = String(target.getDate()).padStart(2, '0');
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const yyyy = target.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  // Fast date columns generation (lean date objects only, no nested calculations)
  const dateList = useMemo(() => {
    const list = [];
    for (let i = 0; i < TOTAL_DAYS; i++) {
      const d = new Date(bufferStartDate);
      d.setDate(d.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const isoStr = `${y}-${m}-${day}`;
      const isToday = isoStr === property?.businessDate;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

      list.push({
        date: d,
        isoStr,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        dayNum: d.getDate(),
        month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
        isToday,
        isWeekend
      });
    }
    return list;
  }, [bufferStartDate, property?.businessDate]);

  // Filter rooms
  const filteredRooms = useMemo(() => {
    if (selectedRoomType === 'all') return rooms;
    return rooms.filter((r) => r.roomTypeId === selectedRoomType);
  }, [rooms, selectedRoomType]);

  // Group rooms by Room Type and sort rooms numerically
  const groupedRooms = useMemo(() => {
    const map = {};
    roomTypes.forEach((rt) => {
      map[rt.id] = { type: rt, rooms: [] };
    });
    filteredRooms.forEach((r) => {
      if (map[r.roomTypeId]) {
        map[r.roomTypeId].rooms.push(r);
      }
    });
    return Object.values(map)
      .filter((g) => g.rooms.length > 0)
      .map((g) => ({
        ...g,
        rooms: [...g.rooms].sort((a, b) =>
          a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })
        )
      }));
  }, [roomTypes, filteredRooms]);

  const allCategoryKeys = useMemo(() => groupedRooms.map((g) => g.type.id), [groupedRooms]);
  const allCollapsed = allCategoryKeys.length > 0 && allCategoryKeys.every((k) => collapsedCategories.has(k));

  const toggleAllCategories = useCallback(() => {
    setCollapsedCategories((prev) => {
      let next;
      if (allCategoryKeys.length > 0 && allCategoryKeys.every((k) => prev.has(k))) {
        next = new Set();
      } else {
        next = new Set(allCategoryKeys);
      }
      try {
        localStorage.setItem('hotel_astha_tape_collapsed', JSON.stringify(Array.from(next)));
      } catch (_) {}
      return next;
    });
  }, [allCategoryKeys]);

  // =========================================================================
  // High-performance single-pass pre-indexed lookup maps (O(1) lookups)
  // Replaces millions of repeated linear scans across cells with instant Map lookups
  // =========================================================================
  const {
    startingResMap,
    coveringResMap,
    startingMbMap,
    coveringMbMap,
    categoryAvailMap,
    dailyStatsMap
  } = useMemo(() => {
    const startingResMap = new Map();
    const coveringResMap = new Map();
    const startingMbMap = new Map();
    const coveringMbMap = new Map();
    const categoryAvailMap = new Map();
    const dailyStatsMap = new Map();

    const activeReservations = (reservations || []).filter((r) => {
      if (!r) return false;
      const st = (r.status || '').toLowerCase().replace('-', '_').replace(' ', '_');
      return st !== 'cancelled' && st !== 'no_show';
    });

    const assignedResList = [];
    const unassignedResList = [];

    activeReservations.forEach((res) => {
      const matchedRoom = rooms.find((rm) => isResMatchingRoom(res, rm));
      if (matchedRoom) {
        assignedResList.push({ res, room: matchedRoom });
      } else {
        unassignedResList.push(res);
      }
    });

    // Populate starting and covering reservations for rooms
    assignedResList.forEach(({ res, room }) => {
      const rIn = normalizeDateStr(res.checkInDate);
      let rOut = normalizeDateStr(res.checkOutDate);
      if (!rIn) return;
      if (!rOut || rOut <= rIn) {
        rOut = getNextDayIsoDate(rIn);
      }

      const roomId = room.id;
      startingResMap.set(`${roomId}_${rIn}`, res);

      let curr = rIn;
      while (curr < rOut) {
        coveringResMap.set(`${roomId}_${curr}`, res);
        curr = getNextDayIsoDate(curr);
      }
    });

    // Populate maintenance blocks
    (maintenanceBlocks || []).forEach((mb) => {
      const matchedRoom = rooms.find((rm) =>
        isResMatchingRoom({ roomId: mb.roomId, roomNumber: mb.roomNumber }, rm)
      );
      if (!matchedRoom) return;

      const mbIn = normalizeDateStr(mb.startDate);
      let mbOut = normalizeDateStr(mb.endDate);
      if (!mbIn) return;
      if (!mbOut || mbOut < mbIn) {
        mbOut = mbIn;
      }

      const roomId = matchedRoom.id;
      startingMbMap.set(`${roomId}_${mbIn}`, mb);

      let curr = mbIn;
      while (curr <= mbOut) {
        coveringMbMap.set(`${roomId}_${curr}`, mb);
        curr = getNextDayIsoDate(curr);
      }
    });

    // Handle reservations that start before the first column in dateList
    // (so the first column shows them spanning)
    const firstColIso = dateList[0]?.isoStr;
    if (firstColIso) {
      assignedResList.forEach(({ res, room }) => {
        const rIn = normalizeDateStr(res.checkInDate);
        const rOut = normalizeDateStr(res.checkOutDate);
        if (rIn < firstColIso && rOut > firstColIso) {
          const key = `${room.id}_${firstColIso}`;
          if (!startingResMap.has(key)) {
            startingResMap.set(key, res);
          }
        }
      });
    }

    const totalRoomsCount = rooms.length;

    dateList.forEach((col) => {
      const isoStr = col.isoStr;

      const unassignedForDate = unassignedResList.filter((res) => {
        const rIn = normalizeDateStr(res.checkInDate);
        const rOut = normalizeDateStr(res.checkOutDate);
        return isoStr >= rIn && isoStr < rOut;
      });

      // Category availability calculation
      groupedRooms.forEach((group) => {
        const rt = group.type;
        const typeRooms = group.rooms;

        const physicalOccupied = typeRooms.filter((rm) => {
          return coveringResMap.has(`${rm.id}_${isoStr}`) || coveringMbMap.has(`${rm.id}_${isoStr}`);
        }).length;

        const unassignedForType = unassignedForDate.filter((res) => {
          return (
            res.roomTypeId === rt.id ||
            (rt.id === 'rt_standard' && res.roomTypeId === 'rt_normal') ||
            (rt.id === 'rt_normal' && res.roomTypeId === 'rt_standard')
          );
        }).length;

        const totalBooked = Math.min(typeRooms.length, physicalOccupied + unassignedForType);
        const availableCount = Math.max(0, typeRooms.length - totalBooked);
        categoryAvailMap.set(`${rt.id}_${isoStr}`, availableCount);
      });

      // Daily totals for bottom footer
      const physicalOccupiedTotal = rooms.filter((rm) => {
        return coveringResMap.has(`${rm.id}_${isoStr}`) || coveringMbMap.has(`${rm.id}_${isoStr}`);
      }).length;

      const totalOccupied = Math.min(totalRoomsCount, physicalOccupiedTotal + unassignedForDate.length);
      const available = Math.max(0, totalRoomsCount - totalOccupied);
      const occPercent = totalRoomsCount > 0 ? Math.round((totalOccupied / totalRoomsCount) * 100) : 0;

      dailyStatsMap.set(isoStr, { totalOccupied, available, occPercent });
    });

    return {
      startingResMap,
      coveringResMap,
      startingMbMap,
      coveringMbMap,
      categoryAvailMap,
      dailyStatsMap
    };
  }, [rooms, reservations, maintenanceBlocks, dateList, groupedRooms]);

  // Close slot popover on outside click, Escape, or scroll
  useEffect(() => {
    if (!selectedSlot) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedSlot(null);
      }
    };

    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        if (!e.target.closest('.timeline-slot')) {
          setSelectedSlot(null);
        }
      }
    };

    const handleScroll = () => {
      setSelectedSlot(null);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    const scrollEl = scrollContainerRef.current;
    if (scrollEl) {
      scrollEl.addEventListener('scroll', handleScroll);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      if (scrollEl) {
        scrollEl.removeEventListener('scroll', handleScroll);
      }
    };
  }, [selectedSlot]);

  // Close Room Type dropdown on outside click
  useEffect(() => {
    const handleDropdownOutside = (e) => {
      if (roomTypeDropdownRef.current && !roomTypeDropdownRef.current.contains(e.target)) {
        setIsRoomTypeDropdownOpen(false);
      }
    };
    if (isRoomTypeDropdownOpen) {
      document.addEventListener('mousedown', handleDropdownOutside);
    }
    return () => document.removeEventListener('mousedown', handleDropdownOutside);
  }, [isRoomTypeDropdownOpen]);

  // Initial scroll position alignment (align baseDate to the left of the visible grid)
  useEffect(() => {
    if (scrollContainerRef.current && !isInitialScrollDone.current) {
      scrollContainerRef.current.scrollLeft = BUFFER_PAST_DAYS * cellWidth;
      isInitialScrollDone.current = true;
    }
  }, [cellWidth]);

  // Synchronize visible date on scroll with debouncing so scrolling NEVER triggers table re-renders
  const lastVisibleIsoStr = useRef('');
  const scrollDebounceTimer = useRef(null);

  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return;

    const handleScroll = () => {
      if (selectedSlot) {
        setSelectedSlot(null);
      }

      if (scrollDebounceTimer.current) {
        clearTimeout(scrollDebounceTimer.current);
      }
      scrollDebounceTimer.current = setTimeout(() => {
        const scrollLeft = scrollEl.scrollLeft;
        const colIdx = Math.max(0, Math.min(dateList.length - 1, Math.round(scrollLeft / cellWidth)));
        const curItem = dateList[colIdx];
        if (curItem && curItem.isoStr && curItem.isoStr !== lastVisibleIsoStr.current) {
          lastVisibleIsoStr.current = curItem.isoStr;
          if (curItem.date) {
            setVisibleDate(curItem.date);
          }
        }
      }, 100);
    };

    scrollEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener('scroll', handleScroll);
      if (scrollDebounceTimer.current) {
        clearTimeout(scrollDebounceTimer.current);
      }
    };
  }, [cellWidth, dateList, selectedSlot]);

  // Click-and-Drag / Panning State & Handlers (zero React re-renders during drag)
  const dragInfo = useRef({
    isDown: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    hasMoved: false
  });
  const justDraggedRef = useRef(false);

  const onTimelineMouseDown = (e) => {
    if (e.button !== 0) return;
    if (
      e.target.closest(
        'button, input, select, .slot-popover-close-btn, .slot-action-card, .custom-calendar-popover, .tape-chart-icon-btn, .tape-chart-category-chevron, .group\\/booking, .booking-block'
      )
    ) {
      return;
    }

    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return;

    dragInfo.current = {
      isDown: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: scrollEl.scrollLeft,
      scrollTop: scrollEl.scrollTop,
      hasMoved: false
    };
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragInfo.current.isDown) return;
      const scrollEl = scrollContainerRef.current;
      if (!scrollEl) return;

      const dx = e.clientX - dragInfo.current.startX;
      const dy = e.clientY - dragInfo.current.startY;

      if (!dragInfo.current.hasMoved) {
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          dragInfo.current.hasMoved = true;
          scrollEl.style.cursor = 'grabbing';
          scrollEl.style.userSelect = 'none';
        }
      }

      if (dragInfo.current.hasMoved) {
        if (e.cancelable) {
          e.preventDefault();
        }
        scrollEl.scrollLeft = dragInfo.current.scrollLeft - dx;
        scrollEl.scrollTop = dragInfo.current.scrollTop - dy;
      }
    };

    const onMouseUp = () => {
      if (dragInfo.current.isDown) {
        if (dragInfo.current.hasMoved) {
          justDraggedRef.current = true;
          setTimeout(() => {
            justDraggedRef.current = false;
          }, 80);
        }
        dragInfo.current.isDown = false;
        dragInfo.current.hasMoved = false;
        const scrollEl = scrollContainerRef.current;
        if (scrollEl) {
          scrollEl.style.cursor = '';
          scrollEl.style.userSelect = '';
        }
      }
    };

    window.addEventListener('mousemove', onMouseMove, { passive: false });
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Native non-passive wheel listener on sticky date header to translate vertical wheel into horizontal timeline scroll
  const headerRef = useRef(null);
  useEffect(() => {
    const headerEl = headerRef.current;
    if (!headerEl) return;

    const onWheelHandler = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        if (e.cancelable) {
          e.preventDefault();
        }
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft += e.deltaY;
        }
      }
    };

    headerEl.addEventListener('wheel', onWheelHandler, { passive: false });
    return () => {
      headerEl.removeEventListener('wheel', onWheelHandler);
    };
  }, []);

  // Date Navigation handlers with smooth scroll animation
  const handlePrev = useCallback(() => {
    if (!scrollContainerRef.current) return;
    setSelectedSlot(null);
    const scrollLeft = scrollContainerRef.current.scrollLeft;
    if (scrollLeft < 7 * cellWidth) {
      setBaseDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() - 30);
        return next;
      });
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft += 23 * cellWidth;
        }
      });
      return;
    }
    scrollContainerRef.current.scrollBy({
      left: -7 * cellWidth,
      behavior: 'smooth'
    });
  }, [cellWidth]);

  const handleNext = useCallback(() => {
    if (!scrollContainerRef.current) return;
    setSelectedSlot(null);
    const scrollLeft = scrollContainerRef.current.scrollLeft;
    const maxScroll = (dateList.length - 14) * cellWidth;
    if (scrollLeft > maxScroll) {
      setBaseDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + 30);
        return next;
      });
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft -= 23 * cellWidth;
        }
      });
      return;
    }
    scrollContainerRef.current.scrollBy({
      left: 7 * cellWidth,
      behavior: 'smooth'
    });
  }, [cellWidth, dateList.length]);

  // DatePicker selection: smooth scrolls to target date
  const handleDatePickerSelect = useCallback((isoStr) => {
    const [y, m, d] = isoStr.split('-').map(Number);
    const pickedDate = new Date(y, m - 1, d);
    setIsBaseDateCalOpen(false);
    setSelectedSlot(null);

    const targetIndex = dateList.findIndex((col) => col.isoStr === isoStr);
    if (targetIndex >= 0 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        left: targetIndex * cellWidth,
        behavior: 'smooth'
      });
      setVisibleDate(pickedDate);
    } else {
      setBaseDate(pickedDate);
      setVisibleDate(pickedDate);
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = BUFFER_PAST_DAYS * cellWidth;
        }
      });
    }
  }, [cellWidth, dateList]);

  // Density switcher: preserves anchor position
  const handleDensityChange = useCallback((newDensity) => {
    if (newDensity === density) return;
    const oldWidth = cellWidth;
    const newWidth = newDensity === 'cozy' ? 52 : 84;
    const currentScroll = scrollContainerRef.current?.scrollLeft || 0;
    const colIndex = Math.round(currentScroll / oldWidth);
    setDensity(newDensity);
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = colIndex * newWidth;
      }
    });
  }, [cellWidth, density]);

  // Memoized cell click callbacks
  const handleSlotClickCell = useCallback((e, room, col) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const popoverWidth = 360;
    const popoverHeight = 220;

    let left = rect.left;
    let top = rect.bottom + 6;

    if (left + popoverWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - popoverWidth - 16);
    }

    if (top + popoverHeight > window.innerHeight - 16) {
      top = Math.max(16, rect.top - popoverHeight - 6);
    }

    setSelectedSlot({
      room,
      col,
      position: { top, left }
    });
  }, []);

  const handleBookingClick = useCallback((res) => {
    setSelectedBookingDetails(res);
  }, []);

  const handleMaintenanceClick = useCallback((mb) => {
    if (onSlotMaintenanceClick) {
      onSlotMaintenanceClick(mb);
    }
  }, [onSlotMaintenanceClick]);

  const handleToggleRoomStatus = useCallback((room) => {
    const nextStatus = room.status === 'clean' ? 'dirty' : 'clean';
    pmsStore.updateRoomStatus(room.id, nextStatus);
  }, []);

  const handleOpenMaintenanceDrawer = useCallback((room, rt) => {
    setMaintenanceDrawerData({
      roomId: room.id,
      roomNumber: room.roomNumber,
      roomType: rt?.name || 'Delux Room',
      date: property?.businessDate || '2026-11-02'
    });
  }, [property?.businessDate]);

  return (
    <div className={`tape-chart-container ${density}`}>
      {/* 1. Tape Chart Toolbar matching live PMS screenshot */}
      <div className="tape-chart-toolbar">
        {/* Left: Info icon & Room Type selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              background: '#ffffff'
            }}
            title="Tape Chart Info"
          >
            <Info size={16} />
          </div>

          {/* Select Room Types Dropdown */}
          <div ref={roomTypeDropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsRoomTypeDropdownOpen(!isRoomTypeDropdownOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.42rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                cursor: 'pointer',
                fontSize: '0.84rem',
                fontWeight: 600,
                color: '#334155',
                transition: 'border-color 0.15s ease'
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>
                {selectedRoomType === 'all'
                  ? 'Select Room Types'
                  : roomTypes.find((rt) => rt.id === selectedRoomType)?.name || 'Select Room Types'}
              </span>
              <ChevronDown size={14} color="#64748b" />
            </button>

            {isRoomTypeDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  zIndex: 60,
                  minWidth: '200px',
                  padding: '4px 0'
                }}
              >
                <div
                  onClick={() => {
                    setSelectedRoomType('all');
                    setIsRoomTypeDropdownOpen(false);
                  }}
                  style={{
                    padding: '8px 14px',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    background: selectedRoomType === 'all' ? '#eff6ff' : 'transparent',
                    color: selectedRoomType === 'all' ? '#2563eb' : '#1e293b',
                    fontWeight: selectedRoomType === 'all' ? 700 : 500
                  }}
                >
                  All Room Types
                </div>
                {roomTypes.map((rt) => (
                  <div
                    key={rt.id}
                    onClick={() => {
                      setSelectedRoomType(rt.id);
                      setIsRoomTypeDropdownOpen(false);
                    }}
                    style={{
                      padding: '8px 14px',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      background: selectedRoomType === rt.id ? '#eff6ff' : 'transparent',
                      color: selectedRoomType === rt.id ? '#2563eb' : '#1e293b',
                      fontWeight: selectedRoomType === rt.id ? 700 : 500
                    }}
                  >
                    {rt.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cozy / Wide toggle and Date Navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {/* Cozy / Wide Segmented Switcher */}
          <div
            style={{
              display: 'flex',
              background: '#f1f5f9',
              borderRadius: '24px',
              padding: '3px',
              border: '1px solid #e2e8f0'
            }}
          >
            <button
              onClick={() => handleDensityChange('cozy')}
              style={{
                border: 'none',
                background: density === 'cozy' ? '#ffffff' : 'transparent',
                color: density === 'cozy' ? '#0f172a' : '#64748b',
                padding: '0.32rem 0.95rem',
                borderRadius: '18px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: density === 'cozy' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Cozy
            </button>
            <button
              onClick={() => handleDensityChange('wide')}
              style={{
                border: 'none',
                background: density === 'wide' ? '#ffffff' : 'transparent',
                color: density === 'wide' ? '#0f172a' : '#64748b',
                padding: '0.32rem 0.95rem',
                borderRadius: '18px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: density === 'wide' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Wide
            </button>
          </div>

          {/* Date Navigator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={handlePrev}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
                transition: 'background-color 0.12s ease'
              }}
              title="Previous Week"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Date Picker Display */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                padding: '0.38rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                fontSize: '0.84rem',
                fontWeight: 600,
                color: '#1e293b',
                gap: '8px',
                cursor: 'pointer'
              }}
              onClick={() => setIsBaseDateCalOpen((prev) => !prev)}
            >
              <span>{formatBaseDateDisplay(visibleDate || baseDate)}</span>
              <CalendarIcon size={15} color="#64748b" />

              {isBaseDateCalOpen && (
                <CustomCalendar
                  value={visibleDate || baseDate}
                  placement="bottom-right"
                  outputFormat="iso"
                  onChange={handleDatePickerSelect}
                  onClose={() => setIsBaseDateCalOpen(false)}
                />
              )}
            </div>

            <button
              type="button"
              onClick={handleNext}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
                transition: 'background-color 0.12s ease'
              }}
              title="Next Week"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Tape Chart Gantt Table */}
      <div
        className="tape-chart-scroll"
        ref={scrollContainerRef}
        onMouseDown={onTimelineMouseDown}
        style={{
          flex: 1,
          minHeight: 0,
          height: '100%',
          overflowX: 'auto',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        <table
          className="tape-chart-table"
          style={{
            width: '100%',
            height: '100%',
            minHeight: '100%',
            flex: 1
          }}
        >
          <thead ref={headerRef}>
            <DateHeaderRow
              dateList={dateList}
              allCategoryKeys={allCategoryKeys}
              allCollapsed={allCollapsed}
              onToggleAllCategories={toggleAllCategories}
            />
          </thead>

          <tbody>
            {groupedRooms.map((group) => {
              const rt = group.type;
              const categoryKey = rt.id;
              const isCollapsed = collapsedCategories.has(categoryKey);

              return (
                <React.Fragment key={rt.id}>
                  {/* Category Header Row: e.g. DELUX ROOM */}
                  <CategoryRow
                    group={group}
                    dateList={dateList}
                    cellWidth={cellWidth}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={toggleCategoryCollapse}
                    categoryAvailMap={categoryAvailMap}
                  />

                  {/* Physical Room Rows: e.g. 101, 102 */}
                  {!isCollapsed &&
                    group.rooms.map((room) => (
                      <RoomRow
                        key={room.id}
                        room={room}
                        rt={rt}
                        dateList={dateList}
                        cellWidth={cellWidth}
                        startingResMap={startingResMap}
                        coveringResMap={coveringResMap}
                        startingMbMap={startingMbMap}
                        coveringMbMap={coveringMbMap}
                        selectedSlot={selectedSlot}
                        justDraggedRef={justDraggedRef}
                        onSlotClickCell={handleSlotClickCell}
                        onBookingClick={handleBookingClick}
                        onMaintenanceClick={handleMaintenanceClick}
                        onToggleRoomStatus={handleToggleRoomStatus}
                        onOpenMaintenanceDrawer={handleOpenMaintenanceDrawer}
                      />
                    ))}
                </React.Fragment>
              );
            })}

            {/* Flexible spacer row that absorbs extra height and anchors tfoot to the bottom */}
            <tr className="tape-chart-spacer-row" style={{ height: '100%' }}>
              <td
                className="sticky-room-col"
                style={{
                  background: '#ffffff',
                  borderBottom: 'none',
                  borderRight: '2px solid #e2e8f0',
                  padding: 0
                }}
              />
              {dateList.map((col) => (
                <td
                  key={`spacer-${col.isoStr}`}
                  className="date-col-cell"
                  style={{
                    background: col.isWeekend ? '#fffdfa' : '#ffffff',
                    borderBottom: 'none',
                    borderRight: '1px solid #f1f5f9',
                    padding: 0
                  }}
                />
              ))}
            </tr>
          </tbody>

          {/* Bottom Row: Sticky Availability Occupancy % matching live PMS */}
          <tfoot
            className="sticky-bottom-foot"
            style={{
              position: 'sticky',
              bottom: 0,
              zIndex: 25,
              marginTop: 'auto'
            }}
          >
            <FooterRow dateList={dateList} dailyStatsMap={dailyStatsMap} />
          </tfoot>
        </table>
      </div>

      {/* 3. Anchored Slot Popover Card matching screenshot */}
      {selectedSlot && (
        <div
          ref={popoverRef}
          className="tape-chart-slot-popover"
          style={{
            position: 'fixed',
            top: `${selectedSlot.position.top}px`,
            left: `${selectedSlot.position.left}px`,
            zIndex: 9999
          }}
        >
          {/* Popover Header */}
          <div className="slot-popover-header">
            <div className="slot-popover-header-left">
              <div className="slot-popover-cal-icon">
                <CalendarIcon size={18} />
              </div>
              <div>
                <div className="slot-popover-date-title">
                  {formatSlotRange(selectedSlot.col.isoStr)}
                </div>
                <div className="slot-popover-room-subtitle">
                  Room {selectedSlot.room.roomNumber}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="slot-popover-close-btn"
              onClick={() => setSelectedSlot(null)}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Action Cards */}
          <div className="slot-action-list">
            {/* Action 1: Maintenance Block */}
            <div
              className="slot-action-card maintenance"
              onClick={() => {
                const rt = roomTypes.find((t) => t.id === selectedSlot.room.roomTypeId);
                setMaintenanceDrawerData({
                  roomId: selectedSlot.room.id,
                  roomNumber: selectedSlot.room.roomNumber,
                  roomType: rt?.name || 'Delux Room',
                  date: selectedSlot.col.isoStr
                });
                setSelectedSlot(null);
              }}
            >
              <div className="slot-action-icon maintenance">
                <Wrench size={18} />
              </div>
              <div className="slot-action-text">
                <div className="slot-action-title maintenance">Maintenance Block</div>
                <div className="slot-action-desc">Block room for maintenance</div>
              </div>
              <ChevronRight size={18} className="slot-action-arrow maintenance" />
            </div>

            {/* Action 2: Quick Booking */}
            <div
              className="slot-action-card booking"
              onClick={() => {
                const r = selectedSlot.room;
                const d = selectedSlot.col.isoStr;
                setSelectedSlot(null);
                onSlotClick(r, d);
              }}
            >
              <div className="slot-action-icon booking">
                <CalendarCheck size={18} />
              </div>
              <div className="slot-action-text">
                <div className="slot-action-title booking">Quick Booking</div>
                <div className="slot-action-desc">Make a reservation with default options</div>
              </div>
              <ChevronRight size={18} className="slot-action-arrow booking" />
            </div>
          </div>
        </div>
      )}

      {/* 4. Block Room Slide-over Drawer when Maintenance Block is triggered */}
      {maintenanceDrawerData && (
        <BlockRoomDrawer
          isOpen={true}
          onClose={() => setMaintenanceDrawerData(null)}
          roomType={maintenanceDrawerData.roomType}
          roomNumber={maintenanceDrawerData.roomNumber}
          initialCheckIn={maintenanceDrawerData.date}
          initialCheckOut={maintenanceDrawerData.date}
          initialReason="Maintenance"
          availableRooms={rooms.map((rm) => ({
            ...rm,
            roomTypeName: roomTypes.find((rt) => rt.id === rm.roomTypeId)?.name || 'Delux Room'
          }))}
          availableRoomTypes={roomTypes}
          isBlocked={rooms.find((r) => r.id === maintenanceDrawerData.roomId)?.status === 'maintenance'}
          onRelease={() => {
            pmsStore.updateRoomStatus(maintenanceDrawerData.roomId, 'clean');
            setMaintenanceDrawerData(null);
          }}
          onApply={(data) => {
            pmsStore.addMaintenanceBlock({
              roomId: maintenanceDrawerData.roomId,
              startDate: data.checkIn,
              endDate: data.checkOut,
              reason: data.reason || 'Maintenance'
            });
            pmsStore.updateRoomStatus(maintenanceDrawerData.roomId, 'maintenance', {
              notes: data.reason || 'Maintenance',
              startDate: data.checkIn,
              endDate: data.checkOut
            });
            setMaintenanceDrawerData(null);
          }}
        />
      )}

      {/* 5. Booking Details Side-Over Drawer matching live OTAL PMS screenshot */}
      {selectedBookingDetails && (
        <BookingDetailsDrawer
          isOpen={true}
          onClose={() => setSelectedBookingDetails(null)}
          reservation={
            reservations.find((r) => r.id === selectedBookingDetails.id) || selectedBookingDetails
          }
          onEditReservation={(res) => {
            const statusNorm = (res?.status || '').toLowerCase().replace('-', '_').replace(' ', '_');
            if (statusNorm === 'cancelled' || statusNorm === 'no_show') {
              return;
            }
            setSelectedBookingDetails(null);
            const targetId = res?.id || (res?.bookingReference ? res.bookingReference.replace('#', '').toLowerCase() : 'res_1');
            if (onEditReservation) {
              onEditReservation(res);
            } else {
              navigate(`/reservations/${targetId}/edit`);
            }
          }}
        />
      )}
    </div>
  );
}

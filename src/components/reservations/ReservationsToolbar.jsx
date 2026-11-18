import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  Tag,
  Star,
  UserCheck,
  Download,
  Users,
  User,
  List,
  LayoutGrid,
  Check,
  X
} from 'lucide-react';
import './reservations-toolbar.css';

/**
 * ReservationsToolbar Component
 * Rebuilt exactly according to the authoritative OTAL PMS specification and screenshots:
 * - filter_list reset button
 * - Status combobox dropdown (All Active, All Statuses, Confirmed, In-house, Checked Out, Cancelled, No-Show, Unmapped) with custom scrollbar & checkmarks
 * - Date range picker [ 📅 From 📅 - To 📅 ] with interactive custom Calendar Popup matching image
 * - Search bar with placeholder "Search Name, Email, Phone"
 * - Booking Source dropdown with 'sell' icon
 * - VIP toggle with amber star
 * - Single Lady toggle with pink female icon
 * - Report download button
 * - Segmented controls: groups, group, list, grid_view
 */
export default function ReservationsToolbar({
  statusFilter = 'all_active',
  onStatusFilterChange,
  searchQuery = '',
  onSearchChange,
  fromDate = '',
  onFromDateChange,
  toDate = '',
  onToDateChange,
  sourceFilter = 'all',
  onSourceChange,
  filterVip = false,
  onToggleVip,
  filterSingleLady = false,
  onToggleSingleLady,
  viewMode = 'grid',
  onViewModeChange,
  bookingType = 'ALL',
  onBookingTypeChange,
  onResetFilters,
  onExportReport
}) {
  // Dropdown states
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isSourceOpen, setIsSourceOpen] = useState(false);
  const [activeCalendarField, setActiveCalendarField] = useState(null); // null | 'from' | 'to'
  const isCalendarOpen = activeCalendarField !== null;

  // Calendar View Date: defaults to October 2026 or fromDate's month
  const [calendarViewDate, setCalendarViewDate] = useState(() => {
    if (fromDate) {
      const d = new Date(fromDate + 'T00:00:00');
      if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    return new Date(2026, 9, 1); // October 2026
  });

  const statusDropdownRef = useRef(null);
  const sourceRef = useRef(null);
  const calendarRef = useRef(null);

  // Close dropdowns on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)) {
        setIsStatusOpen(false);
      }
      if (sourceRef.current && !sourceRef.current.contains(e.target)) {
        setIsSourceOpen(false);
      }
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setActiveCalendarField(null);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsStatusOpen(false);
        setIsSourceOpen(false);
        setActiveCalendarField(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Status Filter Options matching OTAL PMS dropdown specification
  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'all_active', label: 'All Active' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'in_house', label: 'In-house' },
    { value: 'checked_out', label: 'Checked Out' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'no_show', label: 'No-Show' },
    { value: 'unmapped', label: 'Unmapped' }
  ];

  const currentStatusLabel =
    statusOptions.find((opt) => opt.value === statusFilter)?.label || 'All Statuses';

  // Booking Sources
  const bookingSources = [
    { value: 'all', label: 'Booking Source (All)' },
    { value: 'WALK_IN', label: 'Walk-in' },
    { value: 'BOOKING_COM', label: 'Booking.com' },
    { value: 'AGODA', label: 'Agoda' },
    { value: 'DIRECT', label: 'Direct Website' },
    { value: 'MAKEMYTRIP', label: 'MakeMyTrip' }
  ];

  const currentSourceLabel =
    sourceFilter === 'all'
      ? 'Booking Source'
      : (bookingSources.find((s) => s.value === sourceFilter)?.label || sourceFilter);

  // Calendar Helpers
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Today string for highlighting October 27, 2026
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const handlePrevMonth = () => {
    setCalendarViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setCalendarViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  // Build calendar matrix (Sunday to Saturday)
  const calendarDays = useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();

    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Trailing days from previous month (e.g. Sep 27, 28, 29, 30 for Oct 2026)
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const y = prevDate.getFullYear();
      const m = String(prevDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(dayNum).padStart(2, '0');
      days.push({
        dayNum,
        dateStr: `${y}-${m}-${dStr}`,
        isCurrentMonth: false
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const y = year;
      const m = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      days.push({
        dayNum: d,
        dateStr: `${y}-${m}-${dStr}`,
        isCurrentMonth: true
      });
    }

    return days;
  }, [calendarViewDate]);

  // Click on a day in calendar
  const handleDayClick = (clickedDateStr) => {
    if (activeCalendarField === 'to') {
      if (fromDate && clickedDateStr < fromDate) {
        if (onFromDateChange) onFromDateChange(clickedDateStr);
        if (onToDateChange) onToDateChange('');
      } else {
        if (onToDateChange) onToDateChange(clickedDateStr);
        setTimeout(() => {
          setActiveCalendarField(null);
        }, 200);
      }
      return;
    }

    // Selecting From date
    if (!fromDate || (fromDate && toDate) || activeCalendarField === 'from') {
      if (onFromDateChange) onFromDateChange(clickedDateStr);
      if (toDate && clickedDateStr > toDate) {
        if (onToDateChange) onToDateChange('');
      }
      setActiveCalendarField('to');
    } else if (fromDate && !toDate) {
      if (clickedDateStr < fromDate) {
        if (onFromDateChange) onFromDateChange(clickedDateStr);
      } else {
        if (onToDateChange) onToDateChange(clickedDateStr);
        setTimeout(() => {
          setActiveCalendarField(null);
        }, 200);
      }
    }
  };

  const handleToggleDateField = (field) => {
    setActiveCalendarField((prev) => {
      if (prev === field) return null;
      const targetStr = field === 'to' ? toDate || fromDate : fromDate;
      if (targetStr) {
        const parsed = new Date(targetStr + 'T00:00:00');
        if (!isNaN(parsed.getTime())) {
          setCalendarViewDate(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
        }
      }
      return field;
    });
  };

  return (
    <div className="w-full flex flex-wrap items-center gap-2 px-0 py-2 otal-res-toolbar">
      {/* 1. Subtle Filter Reset Button */}
      <button
        type="button"
        className="otal-filter-icon-btn"
        title="Reset All Filters"
        onClick={onResetFilters}
      >
        <Filter size={16} className="text-slate-400 shrink-0" />
      </button>

      {/* 2. Status Dropdown (All Active, All Statuses, Confirmed, In-house, etc.) */}
      <div className="relative otal-status-dropdown-wrap" ref={statusDropdownRef}>
        <button
          type="button"
          className={`otal-status-btn ${isStatusOpen ? 'open' : ''}`}
          onClick={() => setIsStatusOpen((prev) => !prev)}
          aria-haspopup="menu"
          aria-expanded={isStatusOpen}
        >
          <span className="truncate">{currentStatusLabel}</span>
          <ChevronDown
            size={16}
            className={`otal-status-arrow ${
              isStatusOpen ? 'open' : ''
            }`}
          />
        </button>

        {isStatusOpen && (
          <div className="otal-status-dropdown-menu" role="menu">
            {statusOptions.map((opt) => {
              const isSelected = statusFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`otal-status-menu-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    if (onStatusFilterChange) onStatusFilterChange(opt.value);
                    setIsStatusOpen(false);
                  }}
                >
                  <span>{opt.label}</span>
                  {isSelected && (
                    <Check size={14} className="check-icon shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Date Range Picker — Rebuilt to Exact OTAL PMS Specification */}
      <div className="relative otal-date-range-container" ref={calendarRef}>
        <div
          className={`otal-date-range-box flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2 py-0.5 h-9 shrink-0 ${
            isCalendarOpen ? 'active' : ''
          }`}
        >
          {/* Leading calendar_month icon (16px, slate-400) */}
          <span
            className="material-symbols-outlined select-none text-slate-400 shrink-0 otal-date-range-lead-icon"
            style={{ fontSize: '16px' }}
          >
            calendar_month
          </span>

          {/* From Date Input Trigger */}
          <div
            className="w-full cursor-pointer otal-date-field-trigger"
            role="button"
            tabIndex={0}
            aria-haspopup="dialog"
            aria-expanded={activeCalendarField === 'from'}
            data-state={activeCalendarField === 'from' ? 'open' : 'closed'}
            onClick={() => handleToggleDateField('from')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggleDateField('from');
              }
            }}
          >
            <div className="w-full relative">
              <div className="flex items-center justify-between" />
              <div className="relative flex otal-date-field-inner">
                <input
                  className="otal-date-field-input flex max-[1370px]:rounded-md rounded-lg bg-white max-[1370px]:h-9 small-title-4 outline-none border focus:border-[#3B82F6]/20 focus:bg-white transition-all placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-100 cursor-pointer select-none max-[1370px]:h-7! h-8 w-28 border-none shadow-none small-title-2 p-0 focus:ring-0"
                  readOnly
                  tabIndex={-1}
                  placeholder="From"
                  value={formatDisplayDate(fromDate)}
                />
                <div className="flex absolute right-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none otal-date-field-icon-wrap">
                  <span
                    className="material-symbols-outlined select-none text-gray-500 otal-date-field-icon"
                    style={{ fontSize: '18px' }}
                  >
                    calendar_month
                  </span>
                </div>
              </div>
              <div className="otal-date-field-helper-grid grid absolute transition-all duration-200 ease-in-out grid-rows-[0fr] opacity-0 pointer-events-none w-full">
                <div className="overflow-hidden small-title-2" />
              </div>
            </div>
          </div>

          {/* Hyphen Separator */}
          <span className="text-slate-400 small-title-2 otal-date-sep">-</span>

          {/* To Date Input Trigger */}
          <div
            className="w-full cursor-pointer otal-date-field-trigger"
            role="button"
            tabIndex={0}
            aria-haspopup="dialog"
            aria-expanded={activeCalendarField === 'to'}
            data-state={activeCalendarField === 'to' ? 'open' : 'closed'}
            onClick={() => handleToggleDateField('to')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggleDateField('to');
              }
            }}
          >
            <div className="w-full relative">
              <div className="flex items-center justify-between" />
              <div className="relative flex otal-date-field-inner">
                <input
                  className="otal-date-field-input flex max-[1370px]:rounded-md rounded-lg bg-white max-[1370px]:h-9 small-title-4 outline-none border focus:border-[#3B82F6]/20 focus:bg-white transition-all placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-100 cursor-pointer select-none max-[1370px]:h-7! h-8 w-28 border-none shadow-none small-title-2 p-0 focus:ring-0"
                  readOnly
                  tabIndex={-1}
                  placeholder="To"
                  value={formatDisplayDate(toDate)}
                />
                <div className="flex absolute right-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none otal-date-field-icon-wrap">
                  <span
                    className="material-symbols-outlined select-none text-gray-500 otal-date-field-icon"
                    style={{ fontSize: '18px' }}
                  >
                    calendar_month
                  </span>
                </div>
              </div>
              <div className="otal-date-field-helper-grid grid absolute transition-all duration-200 ease-in-out grid-rows-[0fr] opacity-0 pointer-events-none w-full">
                <div className="overflow-hidden small-title-2" />
              </div>
            </div>
          </div>

          {/* Trailing Clear Button (24px × 24px, close icon 14px) */}
          {(fromDate || toDate) && (
            <button
              type="button"
              className="otal-date-clear-btn inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md small-title-4 font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent h-6 w-6 text-slate-400 hover:text-slate-600 p-0"
              title="Clear Dates"
              aria-label="Clear date range"
              onClick={(e) => {
                e.stopPropagation();
                if (onFromDateChange) onFromDateChange('');
                if (onToDateChange) onToDateChange('');
                setActiveCalendarField(null);
              }}
            >
              <span
                className="material-symbols-outlined select-none"
                style={{ fontSize: '14px' }}
              >
                close
              </span>
            </button>
          )}
        </div>

        {/* Custom Calendar Popup Modal matching Image 4 */}
        {isCalendarOpen && (
          <div className="otal-calendar-popup">
            {/* Calendar Header with Navigation */}
            <div className="otal-calendar-header">
              <button
                type="button"
                className="otal-cal-nav-btn"
                onClick={handlePrevMonth}
                title="Previous month"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="otal-cal-title">
                {monthNames[calendarViewDate.getMonth()]} {calendarViewDate.getFullYear()}
              </div>

              <button
                type="button"
                className="otal-cal-nav-btn"
                onClick={handleNextMonth}
                title="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Weekday Names Header */}
            <div className="otal-cal-weekdays">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div key={day} className="otal-cal-weekday">
                  {day}
                </div>
              ))}
            </div>

            {/* Days Matrix */}
            <div className="otal-cal-grid">
              {calendarDays.map((cell, idx) => {
                const isToday = cell.dateStr === todayStr;
                const isFrom = cell.dateStr === fromDate;
                const isTo = cell.dateStr === toDate;
                const inRange =
                  fromDate && toDate && cell.dateStr > fromDate && cell.dateStr < toDate;

                return (
                  <button
                    key={idx}
                    type="button"
                    className={`otal-cal-day ${
                      cell.isCurrentMonth ? 'current-month' : 'other-month'
                    } ${isToday ? 'today' : ''} ${isFrom ? 'selected-from' : ''} ${
                      isTo ? 'selected-to' : ''
                    } ${inRange ? 'in-range' : ''}`}
                    onClick={() => handleDayClick(cell.dateStr)}
                  >
                    {cell.dayNum}
                  </button>
                );
              })}
            </div>

            {/* Calendar Footer Shortcuts */}
            <div className="otal-cal-footer">
              <div className="otal-cal-helper-text">
                {!fromDate
                  ? 'Select Check-in'
                  : !toDate
                  ? 'Select Check-out'
                  : `${fromDate} → ${toDate}`}
              </div>
              <div className="flex items-center gap-1.5">
                {(fromDate || toDate) && (
                  <button
                    type="button"
                    className="otal-cal-footer-btn clear"
                    onClick={() => {
                      if (onFromDateChange) onFromDateChange('');
                      if (onToDateChange) onToDateChange('');
                    }}
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  className="otal-cal-footer-btn today"
                  onClick={() => {
                    if (onFromDateChange) onFromDateChange(todayStr);
                    if (onToDateChange) onToDateChange('');
                  }}
                >
                  Today
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Search Bar */}
      <div className="otal-search-box">
        <Search size={16} className="otal-search-icon text-slate-400 shrink-0" />
        <input
          className="otal-search-input"
          placeholder="Search Name, Email, Phone"
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
        />
      </div>

      {/* 5. Booking Source Combobox */}
      <div className="relative otal-combobox-wrap" ref={sourceRef}>
        <button
          className={`otal-combobox-btn ${isSourceOpen ? 'open' : ''}`}
          role="combobox"
          aria-expanded={isSourceOpen}
          type="button"
          onClick={() => setIsSourceOpen((prev) => !prev)}
        >
          <div className="flex items-center flex-1 min-w-0">
            <Tag size={15} className="mr-2 text-gray-500 shrink-0" />
            <span className="capitalize truncate text-gray-600">
              {currentSourceLabel}
            </span>
          </div>
          <ChevronDown
            size={16}
            className="ml-2 text-gray-400 shrink-0"
            style={{
              transform: isSourceOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease'
            }}
          />
        </button>

        {isSourceOpen && (
          <div className="otal-combobox-dropdown" role="menu">
            {bookingSources.map((source) => (
              <button
                key={source.value}
                type="button"
                className={`otal-combobox-item ${sourceFilter === source.value ? 'active' : ''}`}
                onClick={() => {
                  if (onSourceChange) onSourceChange(source.value);
                  setIsSourceOpen(false);
                }}
              >
                {sourceFilter === source.value ? (
                  <Check size={14} className="shrink-0 text-blue-600 mr-2" />
                ) : (
                  <Tag size={14} className="shrink-0 text-gray-400 mr-2" />
                )}
                <span>{source.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 6. VIP Filter Button */}
      <button
        type="button"
        className={`otal-vip-btn ${filterVip ? 'active' : ''}`}
        onClick={onToggleVip}
      >
        <Star size={16} className="text-[#D97706] fill-amber-500 shrink-0" />
        <span className="small-title-4 ml-1">VIP</span>
      </button>

      {/* 7. Single Lady Filter Button */}
      <button
        type="button"
        className={`otal-single-lady-btn ${filterSingleLady ? 'active' : ''}`}
        onClick={onToggleSingleLady}
      >
        <UserCheck size={16} className="text-[#C026D3] shrink-0" />
        <span className="small-title-4 ml-1">Single Lady</span>
      </button>

      {/* 8. Right Cluster: Report Button + View Mode Controls */}
      <div className="ml-auto flex items-center gap-2 shrink-0 otal-right-cluster">
        {/* Report Button */}
        <button
          type="button"
          className="otal-report-btn"
          id="download-reservation-report-btn"
          onClick={onExportReport}
          title="Download Reservation Report (Excel)"
        >
          <Download size={16} className="shrink-0" />
          <span className="small-title-4">Report</span>
        </button>

        {/* Segmented View Mode Toggle Group */}
        <div className="otal-view-toggle-group">
          {/* All Bookings */}
          <button
            type="button"
            className={`otal-toggle-tab-btn ${bookingType === 'ALL' ? 'active' : ''}`}
            title="All Bookings"
            onClick={() => onBookingTypeChange && onBookingTypeChange('ALL')}
          >
            <Users size={18} className="shrink-0" />
          </button>

          {/* Group Bookings */}
          <button
            type="button"
            className={`otal-toggle-tab-btn ${bookingType === 'GROUP' ? 'active' : ''}`}
            title="Group Bookings Only"
            onClick={() => onBookingTypeChange && onBookingTypeChange('GROUP')}
          >
            <User size={18} className="shrink-0" />
          </button>

          {/* List View */}
          <button
            type="button"
            className={`otal-toggle-action-btn has-border-right ${viewMode === 'list' ? 'active' : ''}`}
            title="List View"
            onClick={() => onViewModeChange && onViewModeChange('list')}
          >
            <List size={18} className="shrink-0" />
          </button>

          {/* Grid View */}
          <button
            type="button"
            className={`otal-toggle-action-btn ${viewMode === 'grid' ? 'active' : ''}`}
            title="Grid View"
            onClick={() => onViewModeChange && onViewModeChange('grid')}
          >
            <LayoutGrid size={18} className="shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}

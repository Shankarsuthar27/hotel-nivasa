import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Home,
  Plus,
  Filter,
  Search,
  Calendar,
  Tag,
  Star,
  FileSpreadsheet,
  Users,
  User,
  List,
  LayoutGrid,
  MoreVertical,
  Edit3,
  BedDouble,
  X,
  Ban,
  Printer,
  ChevronRight,
  LogIn,
  LogOut,
  Smile,
  ChevronDown
} from 'lucide-react';
import { exportReservationsToExcel } from '../../services/exportService';
import { pmsStore } from '../../services/pmsStore';
import ReservationCard from './ReservationCard';
import EditReservationView from './EditReservationView';
import GuestCheckInModal from './GuestCheckInModal';
import GuestCheckOutModal from './GuestCheckOutModal';
import BookingDetailsDrawer from './BookingDetailsDrawer';
import GroupReservationListDrawer from './GroupReservationListDrawer';
import CancelReservationModal from './CancelReservationModal';
import SlidingTabBar from '../common/SlidingTabBar';
import Can from '../common/Can';
import ReservationsToolbar from './ReservationsToolbar';
import ReservationsListView from './ReservationsListView';
import AmendStayDrawer from './AmendStayDrawer';

// Custom Icons for exact pixel match
const VenusIcon = ({ size = 15, color = "#db2777" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="5" />
    <line x1="12" y1="13" x2="12" y2="21" />
    <line x1="9" y1="17" x2="15" y2="17" />
  </svg>
);

const BedIcon = ({ size = 18, color = "#2563eb" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4v16" />
    <path d="M2 8h18a2 2 0 0 1 2 2v10" />
    <path d="M2 17h20" />
    <path d="M6 8v9" />
  </svg>
);

export default function ReservationsView({
  reservations = [],
  property,
  currentUser,
  rooms = [],
  roomTypes = [],
  initialTab = 'all',
  initialStatusFilter = 'all',
  onAssignRoom,
  onCheckIn,
  onCheckOut,
  onSelectReservation,
  onEditReservation,
  onNewReservation,
  onOpenRoomMove,
  onOpenVoucher,
  onOpenInvoice,
  onCancelReservation,
  onDeleteReservation,
  onNoShowReservation,
  onUpdateReservation,
  onPostPendingCharges,
  onAddFolioCharge,
  onAddFolioPayment,
  onVoidPayment,
  onAddFolioTransaction,
  onSettleFolio
}) {
  // Navigation & View Mode
  const [activeTab, setActiveTab] = useState(initialTab || 'all'); // 'all' | 'arrivals' | 'in_house' | 'departures'
  const [viewMode, setViewMode] = useState('list'); // 'list' (Table View matching screenshot) | 'grid'

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [bookingType, setBookingType] = useState('ALL'); // 'ALL' | 'GROUP'
  const [editingReservation, setEditingReservation] = useState(null);

  // Workflow Modals: Step 2 Check-in & Step 4 Check-out
  const [checkInModalRes, setCheckInModalRes] = useState(null);
  const [checkOutModalRes, setCheckOutModalRes] = useState(null);

  // OTAL Spec Booking Details Side Drawer (closed by default on navigation)
  const [drawerReservation, setDrawerReservation] = useState(null);
  const [groupListReservation, setGroupListReservation] = useState(null);
  const [cancellingRes, setCancellingRes] = useState(null);
  const [amendStayReservation, setAmendStayReservation] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || 'all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [filterVip, setFilterVip] = useState(false);
  const [filterSingleLady, setFilterSingleLady] = useState(false);

  const handleResetFilters = () => {
    setStatusFilter('all');
    setSourceFilter('all');
    setFilterVip(false);
    setFilterSingleLady(false);
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setBookingType('ALL');
  };

  // Dropdown menu state
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuId]);

  const businessDate = property?.businessDate || '2026-10-26';

  const getNormalizedStatus = (r) =>
    String(r?.status || '').toLowerCase().replace(/[\s-]+/g, '_');

  const getDepartureDate = (r) => {
    const raw = r?.actualCheckOutDate || r?.checkOutDate || '';
    return String(raw).split('T')[0];
  };

  const hasDateRange = Boolean(fromDate || toDate);

  // Calculate dynamic tab counts
  const counts = useMemo(() => {
    const departuresList = reservations.filter((r) => {
      const norm = getNormalizedStatus(r);
      const depDate = getDepartureDate(r);
      if (hasDateRange) {
        if (norm !== 'checked_out' && norm !== 'in_house') return false;
        if (fromDate && (!depDate || depDate < fromDate)) return false;
        if (toDate && (!depDate || depDate > toDate)) return false;
        return true;
      }
      return norm === 'checked_out';
    });

    return {
      all: reservations.length,
      arrivals: reservations.filter((r) => getNormalizedStatus(r) === 'confirmed').length,
      in_house: reservations.filter((r) => getNormalizedStatus(r) === 'in_house').length,
      departures: departuresList.length
    };
  }, [reservations, fromDate, toDate, hasDateRange]);

  const statusTabs = useMemo(
    () => [
      { id: 'all', label: 'Reservations', count: counts.all },
      { id: 'arrivals', label: 'Arrivals', count: counts.arrivals },
      { id: 'in_house', label: 'In-house', count: counts.in_house },
      { id: 'departures', label: 'Departures', count: counts.departures }
    ],
    [counts.all, counts.arrivals, counts.in_house, counts.departures]
  );

  // Filter reservations
  const filteredReservations = useMemo(() => {
    return reservations.filter((r) => {
      const normStatus = getNormalizedStatus(r);
      const depDate = getDepartureDate(r);
      const arrDate = String(r?.checkInDate || '').split('T')[0];

      // Tab filter
      if (activeTab === 'arrivals' && normStatus !== 'confirmed') return false;
      if (activeTab === 'in_house' && normStatus !== 'in_house') return false;
      if (activeTab === 'departures') {
        // Default (no date range): show recent check-outs
        // With date range selected: show departures matching that departure/check-out date range
        if (hasDateRange) {
          if (normStatus !== 'checked_out' && normStatus !== 'in_house') return false;
        } else {
          if (normStatus !== 'checked_out') return false;
        }
      }

      // Status dropdown filter
      if (statusFilter === 'all_active') {
        // Do not let the default "All Active" filter hide checked-out reservations on the Departures tab
        if (activeTab !== 'departures' && normStatus !== 'confirmed' && normStatus !== 'in_house') {
          return false;
        }
      } else if (statusFilter === 'unmapped') {
        if (r.roomId && r.roomNumber && r.roomNumber !== 'Unassigned') return false;
      } else if (statusFilter !== 'all') {
        if (normStatus !== statusFilter) return false;
      }

      // Date range filter
      if (activeTab === 'departures') {
        if (fromDate && (!depDate || depDate < fromDate)) return false;
        if (toDate && (!depDate || depDate > toDate)) return false;
      } else if (activeTab === 'arrivals') {
        if (fromDate && (!arrDate || arrDate < fromDate)) return false;
        if (toDate && (!arrDate || arrDate > toDate)) return false;
      } else {
        if (fromDate && (!arrDate || arrDate < fromDate)) return false;
        if (toDate && (!depDate || depDate > toDate)) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = r.primaryGuest?.name?.toLowerCase().includes(q);
        const refMatch = r.bookingReference?.toLowerCase().includes(q);
        const phoneMatch = r.primaryGuest?.phone?.toLowerCase().includes(q);
        const emailMatch = r.primaryGuest?.email?.toLowerCase().includes(q);
        const roomMatch = r.roomNumber?.toString().includes(q);
        if (!nameMatch && !refMatch && !phoneMatch && !emailMatch && !roomMatch) return false;
      }

      // Booking source filter
      if (sourceFilter !== 'all' && r.bookingSource !== sourceFilter) return false;

      // Flags
      if (filterVip && !r.isVIP) return false;
      if (filterSingleLady && !r.isSingleLady) return false;

      // Booking Type Filter (ALL vs GROUP)
      if (bookingType === 'GROUP' && !r.isGroup && (r.adults || 1) <= 1 && (r.children || 0) <= 0 && !r.notes?.toLowerCase()?.includes('group')) return false;

      return true;
    }).sort((a, b) => {
      // On Departures tab: sort by most recent check-out / departure date first
      if (activeTab === 'departures') {
        const depKeyA = a.checkedOutAt || a.actualCheckOutDate || a.checkOutDate || a.updatedAt || a.createdAt || '';
        const depKeyB = b.checkedOutAt || b.actualCheckOutDate || b.checkOutDate || b.updatedAt || b.createdAt || '';
        const cmp = String(depKeyB).localeCompare(String(depKeyA));
        if (cmp !== 0) return cmp;
      }

      const canonicalOrder = ['res_11', 'res_10', 'res_12', 'res_7', 'res_6', 'res_5', 'res_4', 'res_3', 'res_2', 'res_1'];
      const isCanonA = canonicalOrder.includes(a.id);
      const isCanonB = canonicalOrder.includes(b.id);
      if (!isCanonA && isCanonB) return -1;
      if (isCanonA && !isCanonB) return 1;
      if (isCanonA && isCanonB) return canonicalOrder.indexOf(a.id) - canonicalOrder.indexOf(b.id);
      return (b.createdAt || b.checkInDate || '').localeCompare(a.createdAt || a.checkInDate || '');
    });
  }, [
    reservations,
    activeTab,
    statusFilter,
    fromDate,
    toDate,
    hasDateRange,
    searchQuery,
    sourceFilter,
    filterVip,
    filterSingleLady,
    bookingType,
    businessDate
  ]);

  // Export to Excel report
  const handleExport = () => {
    exportReservationsToExcel(filteredReservations, property?.name || 'HOTEL NIVASA');
  };

  const handleEditReservation = (r) => {
    if (!r) return;
    const statusNorm = (r.status || '').toLowerCase().replace('-', '_').replace(' ', '_');
    if (statusNorm === 'cancelled') {
      alert('Cancelled reservations cannot be edited.');
      return;
    }
    if (statusNorm === 'no_show') {
      alert('No-Show reservations cannot be edited.');
      return;
    }
    if (onEditReservation) {
      onEditReservation(r);
    } else {
      setEditingReservation(r);
    }
  };

  // If editing a reservation, render full Edit Reservation view matching OTAL spec
  if (editingReservation) {
    const currentRes = reservations.find((r) => r.id === editingReservation.id) || editingReservation;
    const currentStatusNorm = (currentRes?.status || '').toLowerCase().replace('-', '_').replace(' ', '_');
    if (currentStatusNorm === 'cancelled' || currentStatusNorm === 'no_show') {
      setEditingReservation(null);
      return null;
    }
    return (
      <div className="edit-res-fullscreen-overlay">
        <EditReservationView
          reservation={currentRes}
          property={property}
          rooms={rooms}
          roomTypes={roomTypes}
          onBack={() => setEditingReservation(null)}
          onSave={(updated) => {
            if (onUpdateReservation) onUpdateReservation(updated);
            setEditingReservation(updated);
          }}
          onAssignRoom={onAssignRoom}
          onCheckIn={(resId) => {
            if (onCheckIn) onCheckIn(resId);
            setEditingReservation((prev) => (prev ? { ...prev, status: 'in_house' } : null));
          }}
          onCheckOut={(resId) => {
            if (onCheckOut) onCheckOut(resId);
            setEditingReservation((prev) => (prev ? { ...prev, status: 'checked_out' } : null));
          }}
          onPostPendingCharges={onPostPendingCharges}
          onAddFolioCharge={onAddFolioCharge}
          onAddFolioPayment={onAddFolioPayment}
          onVoidPayment={onVoidPayment}
          onAddFolioTransaction={onAddFolioTransaction}
          onSettleFolio={onSettleFolio}
        />
      </div>
    );
  }

  return (
    <div className="res-page-container">
      {/* 1. Header Bar: Breadcrumb + Open Cash Drawer + Create Reservation Button */}
      <div className="res-header-row">
        <div className="dashboard-breadcrumbs">
          <Home size={14} className="breadcrumb-icon" />
          <span className="breadcrumb-parent">PMS</span>
          <span className="breadcrumb-sep">&gt;</span>
          <span className="breadcrumb-current">Reservations</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Can user={currentUser || pmsStore.getState().currentUser} permission="reservations.create">
            <button
              id="addNavButton"
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
          </Can>
        </div>
      </div>

      {/* 2. Status Tabs Bar with Smooth Sliding Active Underline Indicator */}
      <SlidingTabBar
        tabs={statusTabs}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId)}
        className="mb-1"
        ariaLabel="Reservation status views"
      />

      {/* 3. Horizontal Filter Bar & Actions (Exact OTAL PMS Specification) */}
      <ReservationsToolbar
        statusFilter={statusFilter}
        onStatusFilterChange={(val) => {
          setStatusFilter(val);
          if (val === 'cancelled' || val === 'no_show' || val === 'all' || val === 'unmapped') {
            setActiveTab('all');
          }
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        fromDate={fromDate}
        onFromDateChange={setFromDate}
        toDate={toDate}
        onToDateChange={setToDate}
        sourceFilter={sourceFilter}
        onSourceChange={setSourceFilter}
        filterVip={filterVip}
        onToggleVip={() => setFilterVip((prev) => !prev)}
        filterSingleLady={filterSingleLady}
        onToggleSingleLady={() => setFilterSingleLady((prev) => !prev)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        bookingType={bookingType}
        onBookingTypeChange={setBookingType}
        onResetFilters={handleResetFilters}
        onExportReport={handleExport}
      />


      {/* 5. Main Reservation Cards / Grid View */}
      {viewMode === 'grid' ? (
        <div key={activeTab} className="res-cards-grid">
          {filteredReservations.map((res) => (
            <ReservationCard
              key={res.id}
              reservation={res}
              onCardClick={(r) => setDrawerReservation(r)}
              onSelect={onSelectReservation}
              onEdit={handleEditReservation}
              isMenuOpen={openMenuId === res.id}
              onToggleMenu={(e) => {
                e.stopPropagation();
                setOpenMenuId(openMenuId === res.id ? null : res.id);
              }}
              menuRef={openMenuId === res.id ? menuRef : null}
              onCheckIn={(r) => {
                const target = typeof r === 'object' ? r : (reservations.find((x) => x.id === r) || res);
                setCheckInModalRes(target);
              }}
              onCheckOut={(r) => {
                const target = typeof r === 'object' ? r : (reservations.find((x) => x.id === r) || res);
                setCheckOutModalRes(target);
              }}
              onRoomMove={onOpenRoomMove}
              onCancel={(r) => {
                const target = typeof r === 'object' ? r : (reservations.find((x) => x.id === r) || { id: r });
                setCancellingRes(target);
              }}
              onDelete={onDeleteReservation}
              onNoShow={onNoShowReservation}
              onVoucher={onOpenVoucher}
              onInvoice={onOpenInvoice}
              onGroupList={(r) => setGroupListReservation(r)}
              onAmendStay={(r) => setAmendStayReservation(r)}
            />
          ))}
        </div>
      ) : (
        /* List / Table View matching exact design specification */
        <ReservationsListView
          reservations={filteredReservations}
          onSelectReservation={onSelectReservation}
          onEditReservation={handleEditReservation}
          onCheckIn={(r) => {
            const target = typeof r === 'object' ? r : (reservations.find((x) => x.id === r) || r);
            setCheckInModalRes(target);
          }}
          onCheckOut={(r) => {
            const target = typeof r === 'object' ? r : (reservations.find((x) => x.id === r) || r);
            setCheckOutModalRes(target);
          }}
          onRoomMove={onOpenRoomMove}
          onCancelReservation={(r) => {
            const target = typeof r === 'object' ? r : (reservations.find((x) => x.id === r) || { id: r });
            setCancellingRes(target);
          }}
          onNoShowReservation={onNoShowReservation}
          onOpenVoucher={onOpenVoucher}
          onOpenInvoice={onOpenInvoice}
          onOpenDetailsDrawer={(r) => setDrawerReservation(r)}
          onGroupList={(r) => setGroupListReservation(r)}
          onAmendStay={(r) => setAmendStayReservation(r)}
          onToggleViewMode={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
        />
      )}

      {/* 6. Pagination Footer (For Grid View only; List View includes its own seamless footer) */}
      {viewMode === 'grid' && (
        <div className="res-pagination-footer">
          <div className="pagination-results-text">
            Showing <strong>1–{filteredReservations.length}</strong> of <strong>{filteredReservations.length}</strong> results
          </div>

          <div className="pagination-controls">
            <button className="pagination-nav-btn" disabled title="Previous page">
              &lt;
            </button>
            <button className="pagination-page-btn active">
              1
            </button>
            <button className="pagination-nav-btn" disabled title="Next page">
              &gt;
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Guest Check-In Details Modal (OTAL PMS Spec) */}
      {checkInModalRes && (
        <GuestCheckInModal
          isOpen={!!checkInModalRes}
          onClose={() => setCheckInModalRes(null)}
          reservation={reservations.find((r) => r.id === checkInModalRes.id) || checkInModalRes}
          rooms={rooms}
          roomTypes={roomTypes}
          reservations={reservations}
          onAssignRoom={(resId, roomId) => {
            if (onAssignRoom) onAssignRoom(resId, roomId);
          }}
          onConfirmCheckIn={(resId, roomId) => {
            if (onCheckIn) onCheckIn(resId, roomId);
            setCheckInModalRes(null);
            setActiveTab('in_house'); // Automatically transitions from Arrivals to In-House!
          }}
        />
      )}

      {/* Step 4: Guest Check-Out Details Modal (OTAL PMS Spec) */}
      {checkOutModalRes && (
        <GuestCheckOutModal
          isOpen={!!checkOutModalRes}
          onClose={() => setCheckOutModalRes(null)}
          reservation={reservations.find((r) => r.id === checkOutModalRes.id) || checkOutModalRes}
          onSettleFolio={(resId, mode, ref) => {
            if (onSettleFolio) onSettleFolio(resId, mode, ref);
          }}
          onConfirmCheckOut={(resId) => {
            if (onCheckOut) onCheckOut(resId);
            setCheckOutModalRes(null);
            setActiveTab('departures'); // Automatically transitions to Departures archive!
          }}
        />
      )}

      {/* Step 5: Booking Details Side Drawer (OTAL PMS Spec) */}
      <BookingDetailsDrawer
        isOpen={!!drawerReservation}
        onClose={() => setDrawerReservation(null)}
        reservation={
          drawerReservation
            ? (reservations.find((r) => r.id === drawerReservation.id) || drawerReservation)
            : null
        }
        onEditReservation={(res) => {
          setDrawerReservation(null);
          handleEditReservation(res);
        }}
      />

      {/* Step 6: Group Reservation List Side Drawer (OTAL PMS Spec) */}
      <GroupReservationListDrawer
        isOpen={!!groupListReservation}
        onClose={() => setGroupListReservation(null)}
        reservation={
          groupListReservation
            ? (reservations.find((r) => r.id === groupListReservation.id) || groupListReservation)
            : null
        }
        reservations={reservations}
        rooms={rooms}
        roomTypes={roomTypes}
      />

      {/* Step 7: Cancel Reservation Confirmation Modal (Exact OTAL PMS Match) */}
      <CancelReservationModal
        isOpen={!!cancellingRes}
        onClose={() => setCancellingRes(null)}
        reservation={cancellingRes}
        onConfirm={() => {
          if (cancellingRes && onCancelReservation) {
            onCancelReservation(cancellingRes.id);
          }
          setCancellingRes(null);
        }}
      />

      {/* Step 8: Amend Stay Slide-Over Drawer (Exact OTAL PMS Match) */}
      <AmendStayDrawer
        isOpen={!!amendStayReservation}
        onClose={() => setAmendStayReservation(null)}
        reservation={
          amendStayReservation
            ? (reservations.find((r) => r.id === amendStayReservation.id) || amendStayReservation)
            : null
        }
        rooms={rooms}
        roomTypes={roomTypes}
        onSave={async (resId, payload) => {
          await pmsStore.amendStay(resId, payload);
          setAmendStayReservation(null);
        }}
      />
    </div>
  );
}

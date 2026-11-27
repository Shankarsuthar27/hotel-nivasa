// Central Enterprise PMS Store for Hotel PMS Pro
// Features: Firebase Cloud Firestore Live Real-time Sync, Offline Persistence,
// ACID Transactions, Night Audit, Double-Entry Folio Ledger, GST & Audit Trails

import {
  initialProperty,
  initialRoomTypes,
  initialRooms,
  initialMealPlans,
  initialRatePlans,
  initialReservations,
  initialFolios,
  initialStaffNotes,
  initialOtaChannels,
  initialTeamMembers,
  initialNightAudits,
  initialAuditTrail,
  initialTaxRules,
  initialServiceCharges
} from '../data/initialPmsData';
import { calculateRoomTax, setActiveTaxRules } from './taxEngine';
import { getRoleDefaultPermissions } from '../data/rolePresets';
import { hasPermission as checkUserPermission } from '../utils/permissions';
import { normalizeDateStr, getNextDayIsoDate, getTodayIsoDate, getCurrentTimeString, formatTimeToHhMm, getAccurateArrivalTime, formatDisplayDate, formatBookingDateTime } from './dateUtils';
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  limit,
  orderBy,
  writeBatch,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db } from './firebase';
import { checkAndSeedFirestore } from './firebaseSeeder';

const STORAGE_KEY = 'hotel_astha_pms_v5';

class PMSStore {
  constructor() {
    this.listeners = new Set();
    this.propertyId = 'prop_astha_01';
    this.cloudStatus = 'CONNECTING'; // 'CONNECTING' | 'LIVE' | 'OFFLINE_CACHE'
    this.unsubscribers = [];

    // 1. Instant local load (auth session & baseline memory state)
    this.load();

    // 2. Fetch room types and room data directly from Firebase database
    this.fetchRoomsAndRoomTypesFromFirebase();

    // 3. Initialize Firebase Cloud Firestore synchronization
    this.initFirebaseSync();
  }

  load() {
    this.deletedReservationIds = new Set();
    this.deletedRoomIds = new Set();
    this.deletedRoomTypeIds = new Set();
    this.deletedTeamMemberIds = new Set();
    this.deletedRatePlanIds = new Set();
    this.inFlightDeletes = new Set();

    // Clean up any stale legacy deleted entities & tombstones from localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('pms_deleted_entities');
        const savedRaw = localStorage.getItem(STORAGE_KEY);
        if (savedRaw) {
          const parsedCheck = JSON.parse(savedRaw);
          let changed = false;
          if (parsedCheck.deletedRoomIds || parsedCheck.deletedRoomTypeIds) {
            delete parsedCheck.deletedRoomIds;
            delete parsedCheck.deletedRoomTypeIds;
            changed = true;
          }
          if (Array.isArray(parsedCheck.teamMembers)) {
            const prevLen = parsedCheck.teamMembers.length;
            parsedCheck.teamMembers = parsedCheck.teamMembers.filter(
              (m) => m && m.id !== 'usr_02' && m.name !== 'Shankar L'
            );
            if (parsedCheck.teamMembers.length !== prevLen) {
              changed = true;
            }
          }
          if (changed) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsedCheck));
          }
        }
      }
    } catch (_) {}

    const authSaved = localStorage.getItem('pms_is_authenticated');
    let savedSessionUser = null;
    try {
      const rawUser = localStorage.getItem('pms_current_user');
      if (rawUser) savedSessionUser = JSON.parse(rawUser);
    } catch (_) {}

    if (savedSessionUser && (savedSessionUser.name === 'Astha India' || savedSessionUser.name === 'HOTEL NIVASA' || savedSessionUser.role === 'Owner')) {
      savedSessionUser.name = 'HOTEL NIVASA';
      savedSessionUser.initials = 'HN';
      if (savedSessionUser.email === 'owner@hotelastha.com' || savedSessionUser.email === 'owner@hotelnivasa.com') {
        savedSessionUser.email = 'info@hotelnivasa.com';
      }
      try {
        localStorage.setItem('pms_current_user', JSON.stringify(savedSessionUser));
      } catch (_) {}
    }

    this.isAuthenticated = authSaved === 'true';
    this.currentUser = this.isAuthenticated ? savedSessionUser : null;
    if (this.currentUser && (this.currentUser.name === 'Astha India' || this.currentUser.name === 'HOTEL NIVASA' || this.currentUser.role === 'Owner')) {
      this.currentUser.name = 'HOTEL NIVASA';
      this.currentUser.initials = 'HN';
    }

    // Room types & Rooms: Initialized in-memory only; authoritative data comes directly from Firebase
    this.roomTypes = initialRoomTypes.map((rt) => ({ ...rt }));
    this.rooms = [];
    this.canonicalizeRoomsAndRoomTypes();

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.isAuthenticated === true && authSaved === null && (savedSessionUser || parsed.currentUser)) {
          this.isAuthenticated = true;
        }
        (parsed.deletedReservationIds || []).forEach((id) => this.deletedReservationIds.add(String(id)));
        (parsed.deletedTeamMemberIds || []).forEach((id) => this.deletedTeamMemberIds.add(String(id)));
        (parsed.deletedRatePlanIds || []).forEach((id) => this.deletedRatePlanIds.add(String(id)));
        this.deletedRoomIds = new Set();
        this.deletedRoomTypeIds = new Set();
        this.property = parsed.property || initialProperty;
        if (this.property) {
          if (!this.property.name || this.property.name === 'HOTEL ASTHA' || this.property.name === 'Hotel Astha' || this.property.name === 'Astha') {
            this.property.name = 'HOTEL NIVASA';
          }
          if (!this.property.tagline || this.property.tagline === 'HOTEL ASTHA' || this.property.tagline === 'Hotel Astha' || this.property.tagline === 'Astha') {
            this.property.tagline = 'HOTEL NIVASA';
          }
          if (!this.property.legalName || this.property.legalName === 'HOTEL ASTHA' || this.property.legalName === 'Hotel Astha' || this.property.legalName === 'Astha') {
            this.property.legalName = 'HOTEL NIVASA';
          }
          if (!this.property.tradeName || this.property.tradeName === 'HOTEL ASTHA' || this.property.tradeName === 'Hotel Astha' || this.property.tradeName === 'Astha') {
            this.property.tradeName = 'HOTEL NIVASA';
          }
          if (!this.property.initials || this.property.initials === 'HA' || this.property.initials === 'AI') {
            this.property.initials = 'HN';
          }
          const todayStr = getTodayIsoDate();
          if (!this.property.businessDate || this.property.businessDate < todayStr) {
            this.property.businessDate = todayStr;
          }
        }
        // NOTE: roomTypes and rooms are strictly loaded from Firebase Database, NOT localStorage!
        let loadedPlans = (parsed.mealPlans || initialMealPlans).filter(
          mp => mp.id !== 'mp_ep' && mp.code !== 'EP'
        );
        if (!loadedPlans || !loadedPlans.some(mp => mp.code === 'STD')) {
          loadedPlans = [
            {
              id: 'mp_std',
              code: 'STD',
              name: 'Standard',
              inclusions: ['Breakfast', 'Lunch', 'Dinner'],
              inclusionDetails: [
                { type: 'Breakfast', from: '7:30 AM', to: '10:30 AM' },
                { type: 'Lunch', from: '12:30 PM', to: '3:30 PM' },
                { type: 'Dinner', from: '7:30 PM', to: '10:30 PM' }
              ],
              pricingModel: 'PER_PERSON',
              adultPrice: 1000,
              childPrice: 500,
              status: 'ACTIVE'
            },
            ...loadedPlans
          ];
        } else {
          loadedPlans = loadedPlans.map(mp => {
            if (mp.code === 'STD') {
              return {
                ...mp,
                inclusions: ['Breakfast', 'Lunch', 'Dinner'],
                adultPrice: 1000,
                childPrice: 500
              };
            }
            return mp;
          });
        }
        this.mealPlans = loadedPlans;
        this.reservations = (parsed.reservations || initialReservations).filter(r => {
          if (!r || !r.id) return false;
          if (r.id === 'res_unassigned_1') return false;
          if (this.deletedReservationIds && this.deletedReservationIds.has(r.id)) return false;
          const name = (r.primaryGuest?.name || r.guestName || '').toLowerCase();
          if (name.includes('rahul kumar') && (r.status === 'cancelled' || !r.status)) return false;
          return true;
        });

        const canonicalOrder = ['res_11', 'res_10', 'res_12', 'res_7', 'res_6', 'res_5', 'res_4', 'res_3', 'res_2', 'res_1'];
        canonicalOrder.forEach(id => {
          if (this.deletedReservationIds && this.deletedReservationIds.has(id)) return;
          const initRes = initialReservations.find(r => r.id === id);
          if (initRes) {
            const existingIdx = this.reservations.findIndex(r => r.id === id);
            if (existingIdx === -1) {
              this.reservations.push(initRes);
            } else {
              const cur = this.reservations[existingIdx];
              this.reservations[existingIdx] = {
                ...initRes,
                ...cur,
                roomId: cur.roomId || initRes.roomId,
                roomNumber: cur.roomNumber || initRes.roomNumber,
                roomTypeId: cur.roomTypeId || initRes.roomTypeId,
                roomTypeName: cur.roomTypeName || initRes.roomTypeName,
                primaryGuest: {
                  ...(initRes.primaryGuest || {}),
                  ...(cur.primaryGuest || {})
                },
                checkInDate: cur.checkInDate || initRes.checkInDate,
                checkOutDate: cur.checkOutDate || initRes.checkOutDate,
                nights: cur.nights !== undefined ? cur.nights : initRes.nights,
                status: cur.status || initRes.status,
                totalAmount: cur.totalAmount !== undefined ? cur.totalAmount : initRes.totalAmount,
                paidAmount: cur.paidAmount !== undefined ? cur.paidAmount : initRes.paidAmount,
                balanceDue: cur.balanceDue !== undefined ? cur.balanceDue : initRes.balanceDue
              };
            }
          }
        });

        // Ensure newly created user reservations are always placed at the top
        this.reservations.sort((a, b) => {
          const isCanonA = canonicalOrder.includes(a.id);
          const isCanonB = canonicalOrder.includes(b.id);
          if (!isCanonA && isCanonB) return -1;
          if (isCanonA && !isCanonB) return 1;
          if (isCanonA && isCanonB) return canonicalOrder.indexOf(a.id) - canonicalOrder.indexOf(b.id);
          return (b.createdAt || b.checkInDate || '').localeCompare(a.createdAt || a.checkInDate || '');
        });

        // Clean up checked_out or cancelled reservation room occupancy links
        this.reservations.forEach(r => {
          if (r.status === 'checked_out' || r.status === 'cancelled') {
            if (r.roomId && !this.rooms.some(rm => rm.id === r.roomId)) {
              r.roomId = '';
            }
          }
        });

        // Sanitize any room left with stale "occupied" status OR operational="occupied" when no active in_house reservation exists for it
        this.rooms = this.dedupeRoomsByNumber(
          this.sanitizeStaleOccupiedRooms(this.rooms, this.reservations),
          false
        );

        // Ensure canonical room mapping and synchronization
        this.canonicalizeRoomsAndRoomTypes();

        this.folios = parsed.folios || initialFolios;
        ['fol_3', 'fol_4', 'fol_5'].forEach(fId => {
          if (!this.folios[fId] && initialFolios[fId]) {
            this.folios[fId] = initialFolios[fId];
          }
        });

        // Retroactively heal & sanitize all folio payment transactions:
        // Ensure accurate current date, type, category, particulars, and direction
        const todayIso = getTodayIsoDate();
        Object.entries(this.folios).forEach(([fId, folio]) => {
          if (!folio || !Array.isArray(folio.transactions)) return;
          const matchedRes = this.reservations.find(r => r.id === folio.reservationId || r.folioId === fId);
          folio.transactions.forEach(tx => {
            if (!tx) return;
            const isCredit =
              String(tx.direction || '').toUpperCase() === 'CREDIT' ||
              tx.type === 'PAYMENT' ||
              String(tx.category || '').toLowerCase().includes('payment') ||
              String(tx.desc || tx.description || '').toLowerCase().includes('payment') ||
              Number(tx.amount || 0) < 0;

            if (isCredit) {
              tx.type = 'PAYMENT';
              tx.direction = 'CREDIT';
              if (!tx.particulars || tx.particulars === 'Charge') {
                tx.particulars = 'Payment';
              }
              if (!tx.category || tx.category === 'Charge') {
                tx.category = 'Payment';
              }
              // If payment date is stale (e.g. '2026-11-03') or earlier than reservation check-in date
              if (
                tx.date === '2026-11-03' ||
                !tx.date ||
                (matchedRes?.checkInDate && tx.date < matchedRes.checkInDate)
              ) {
                tx.date = matchedRes?.checkInDate || todayIso;
              }
            }
          });
        });
        this.announcements = parsed.announcements || initialStaffNotes || [];
        this.otaChannels = parsed.otaChannels || initialOtaChannels;
        const existingMembers = Array.isArray(parsed.teamMembers) ? parsed.teamMembers : [];
        const memberMap = new Map();
        (initialTeamMembers || []).forEach((m) => {
          if (m && m.id) memberMap.set(m.id, m);
        });
        existingMembers.forEach((m) => {
          if (m && m.id) memberMap.set(m.id, m);
        });
        this.teamMembers = Array.from(memberMap.values())
          .filter((m) => m && m.id !== 'usr_02' && m.name !== 'Shankar L')
          .map((m) => ({
            ...m,
            properties: (m.properties && m.properties.length > 0 ? m.properties : ['HOTEL NIVASA']).map((p) =>
              p === 'HOTEL ASTHA' || p === 'Hotel Astha' ? 'HOTEL NIVASA' : p
            )
          }));
        const localAudits = Array.isArray(parsed.nightAudits) ? parsed.nightAudits : [];
        const auditMap = new Map();
        (initialNightAudits || []).forEach((a) => {
          if (a && a.id) auditMap.set(a.id, a);
        });
        localAudits.forEach((a) => {
          if (a && a.id) auditMap.set(a.id, a);
        });
        this.nightAudits = this.standardizeAndSortNightAudits(Array.from(auditMap.values()));
        this.auditTrail = parsed.auditTrail || initialAuditTrail;
        this.cleaningHistory = Array.isArray(parsed.cleaningHistory) ? parsed.cleaningHistory : [];
        if (this.auditTrail && Array.isArray(this.auditTrail)) {
          const seenKeys = new Set();
          this.auditTrail = this.auditTrail.filter(entry => {
            if (!entry) return false;
            const key = entry.id || `${entry.meta?.actionType || entry.action || ''}_${entry.meta?.bookingReference || entry.entityId || ''}_${entry.timestamp}_${entry.details || ''}`;
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
          });
        }
        this.stopouts = parsed.stopouts || {};
        this.dailyRates = parsed.dailyRates || {
          base: {
            'rt_deluxe_2026-11-05': 1000,
            'rt_deluxe_2026-11-06': 1000
          },
          extra_adult: {},
          extra_child: {}
        };
        if (!this.dailyRates.base) this.dailyRates.base = {};
        if (!this.dailyRates.extra_adult) this.dailyRates.extra_adult = {};
        if (!this.dailyRates.extra_child) this.dailyRates.extra_child = {};
        if (!this.dailyRates.min_nights) this.dailyRates.min_nights = {};
        this.rateMatrixUpdatedAt = parsed.rateMatrixUpdatedAt || null;
        if (this.dailyRates.base['rt_deluxe_2026-11-05'] === undefined) {
          this.dailyRates.base['rt_deluxe_2026-11-05'] = 1000;
        }
        if (this.dailyRates.base['rt_deluxe_2026-11-06'] === undefined) {
          this.dailyRates.base['rt_deluxe_2026-11-06'] = 1000;
        }
        this.propertiesList = (parsed.propertiesList || ['HOTEL NIVASA']).map(p => (p === 'HOTEL ASTHA' || p === 'Hotel Astha') ? 'HOTEL NIVASA' : p).filter(p => p !== 'HOTEL ASTHA RESORT');
        if (this.propertiesList.length === 0) this.propertiesList = ['HOTEL NIVASA'];
        if (this.teamMembers && Array.isArray(this.teamMembers)) {
          this.teamMembers = this.teamMembers.map(tm => ({
            ...tm,
            properties: (tm.properties || ['HOTEL NIVASA']).map(p => (p === 'HOTEL ASTHA' || p === 'Hotel Astha') ? 'HOTEL NIVASA' : p).filter(p => p !== 'HOTEL ASTHA RESORT')
          }));
        }
        this.currentUser = this.isAuthenticated
          ? (savedSessionUser || parsed.currentUser || null)
          : null;
        this.syncCurrentUserWithTeamMembers();
        this.invitationTokens = parsed.invitationTokens || [];
        const obsoleteRatePlanKeys = new Set(['rp_test_plan', 'test plan', '132']);
        if (!parsed.ratePlans || parsed.ratePlans.length === 0) {
          this.ratePlans = JSON.parse(JSON.stringify(initialRatePlans));
        } else {
          const sanitized = parsed.ratePlans.filter(rp => {
            if (!rp) return false;
            const id = String(rp.id || '').trim().toLowerCase();
            const code = String(rp.code || '').trim().toLowerCase();
            const name = String(rp.name || '').trim().toLowerCase();
            if (obsoleteRatePlanKeys.has(id) || obsoleteRatePlanKeys.has(code) || obsoleteRatePlanKeys.has(name)) return false;
            if (this.deletedRatePlanIds && (this.deletedRatePlanIds.has(String(rp.id)) || this.deletedRatePlanIds.has(String(rp.code)))) return false;
            return true;
          });
          this.ratePlans = this.dedupeRatePlans(sanitized.length > 0 ? sanitized : initialRatePlans);
        }
        if (this.property) {
          const now = new Date();
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, '0');
          const d = String(now.getDate()).padStart(2, '0');
          const todayStr = `${y}-${m}-${d}`;
          if (!this.property.businessDate || this.property.businessDate < todayStr) {
            this.property.businessDate = todayStr;
          }
        }
        this.restrictions = parsed.restrictions || {};
        this.maintenanceBlocks = parsed.maintenanceBlocks || [];
        this.deletedReservationIds = new Set(parsed.deletedReservationIds || []);
        this.taxRules = (parsed.taxRules && parsed.taxRules.length > 0)
          ? parsed.taxRules
          : JSON.parse(JSON.stringify(initialTaxRules));
        setActiveTaxRules(this.taxRules);
        this.serviceCharges = parsed.serviceCharges || JSON.parse(JSON.stringify(initialServiceCharges));
        this.save();
        return;
      } catch (e) {
        console.warn('Failed to parse saved PMS state, resetting to defaults.', e);
      }
    }
    this.resetToDefaults();
  }

  canonicalizeRoomsAndRoomTypes() {
    // 1. Filter out obsolete room types (Ultra Premium, Premium, Standard, Normal)
    const obsoleteRtKeys = new Set([
      'rt_standard', 'rt_normal', 'rt_ultra_premium', 'rt_premium',
      'ultra premium', 'premium', 'normal', 'standard', 'standard room',
      'nrm', 'ulp', 'prm', 'std'
    ]);

    // If roomTypes is empty, initialize from defaults
    if (!this.roomTypes || this.roomTypes.length === 0) {
      this.roomTypes = initialRoomTypes.map((rt) => ({ ...rt }));
    }

    // Filter surviving room types: only exclude obsolete legacy template types
    const survivingTypes = (this.roomTypes || []).filter((rt) => {
      if (!rt) return false;
      const id = String(rt.id || '').trim().toLowerCase();
      const name = String(rt.name || '').trim().toLowerCase();
      const code = String(rt.code || '').trim().toLowerCase();
      if (obsoleteRtKeys.has(id) || obsoleteRtKeys.has(name) || obsoleteRtKeys.has(code)) {
        return false;
      }
      if (this.inFlightDeletes && this.inFlightDeletes.has(String(rt.id))) {
        return false;
      }
      return true;
    });

    // Only supply canonical active room types if completely empty
    if (survivingTypes.length === 0) {
      const canonicalRtDefs = [
        { id: 'rt_supirior', name: 'SUPIRIOR', code: 'SUP', baseAdults: 2, maxAdults: 3, baseChildren: 1, maxChildren: 2, status: 'ACTIVE' },
        { id: 'rt_double_single', name: 'DOUBLE SINGLE', code: 'DB', baseAdults: 2, maxAdults: 3, baseChildren: 1, maxChildren: 1, status: 'ACTIVE' },
        { id: 'rt_deluxe', name: 'DELUXE', code: 'DX', baseAdults: 1, maxAdults: 2, baseChildren: 2, maxChildren: 2, status: 'ACTIVE' },
        { id: 'rt_semi_deluxe', name: 'SEMI DELUXE', code: 'SD', baseAdults: 2, maxAdults: 2, baseChildren: 1, maxChildren: 1, status: 'ACTIVE' }
      ];
      canonicalRtDefs.forEach((def) => {
        survivingTypes.push({ ...def });
      });
    }

    // Deduplicate by ID / code while strictly preserving all user-edited fields (name, code, adults, rates)
    const mapRt = new Map();
    survivingTypes.forEach((rt) => {
      const key = rt.id || rt.code;
      if (key && !mapRt.has(key)) {
        mapRt.set(key, { ...rt });
      }
    });
    this.roomTypes = Array.from(mapRt.values());

    // 2. Process physical rooms
    // Filter out invalid rooms and in-flight deleted rooms
    this.rooms = (this.rooms || []).filter((rm) => {
      if (!rm) return false;
      const cleanNum = String(rm.roomNumber || rm.id || '').trim().replace(/^rm_/, '');
      if (!cleanNum) return false;
      if (this.inFlightDeletes && (this.inFlightDeletes.has(String(rm.id)) || this.inFlightDeletes.has(`rm_${cleanNum}`))) {
        return false;
      }
      return true;
    });

    if ((!this.rooms || this.rooms.length === 0) && initialRooms && initialRooms.length > 0) {
      this.rooms = initialRooms.map((rm) => ({ ...rm }));
    }

    // Sanitize rooms while strictly respecting user edits (roomNumber, roomTypeId, roomTypeName, status)
    this.rooms = this.rooms.map((rm) => {
      const cleanNum = String(rm.roomNumber || rm.id || '').trim().replace(/^rm_/, '');
      const docId = rm.id || `rm_${cleanNum}`;

      const typeIdLower = String(rm.roomTypeId || '').trim().toLowerCase();
      const typeNameLower = String(rm.roomTypeName || rm.roomType || '').trim().toLowerCase();

      // Check if current roomTypeId or roomTypeName is obsolete or missing
      const isObsoleteType =
        !rm.roomTypeId ||
        obsoleteRtKeys.has(typeIdLower) ||
        obsoleteRtKeys.has(typeNameLower);

      let finalTypeId = rm.roomTypeId;
      let finalTypeName = rm.roomTypeName || rm.roomType;

      if (isObsoleteType) {
        // Fall back based on floor
        if (cleanNum.startsWith('2')) {
          finalTypeId = 'rt_supirior';
          finalTypeName = 'SUPERIOR';
        } else if (cleanNum.startsWith('3')) {
          finalTypeId = 'rt_double_single';
          finalTypeName = 'Double Single';
        } else {
          finalTypeId = 'rt_deluxe';
          finalTypeName = 'Deluxe';
        }
      } else {
        // Active room type: look up exact name from this.roomTypes
        const matchedRt = this.roomTypes.find(
          (rt) =>
            rt.id === finalTypeId ||
            rt.code === finalTypeId ||
            rt.name?.toLowerCase() === typeIdLower ||
            rt.name?.toLowerCase() === typeNameLower
        );
        if (matchedRt) {
          finalTypeName = matchedRt.name;
          finalTypeId = matchedRt.id;
        } else {
          if (!finalTypeName || obsoleteRtKeys.has(String(finalTypeName).toLowerCase())) {
            if (cleanNum.startsWith('2')) {
              finalTypeId = 'rt_supirior';
              finalTypeName = 'SUPIRIOR';
            } else if (cleanNum.startsWith('3')) {
              finalTypeId = 'rt_double_single';
              finalTypeName = 'DOUBLE SIGNLE';
            } else {
              finalTypeId = 'rt_deluxe';
              finalTypeName = 'Delux Room';
            }
          }
        }
      }

      return {
        ...rm,
        id: docId,
        roomNumber: cleanNum,
        roomTypeId: finalTypeId,
        roomTypeName: finalTypeName || 'Room',
        roomType: finalTypeName || 'Room',
        floor: rm.floor || cleanNum.charAt(0) || '1',
        status: rm.status || 'clean',
        operational: rm.operational || 'available',
        notes: rm.notes || 'Ready for check-in'
      };
    });

    // Deduplicate any accidental duplicate room numbers, keeping the freshest
    this.rooms = this.dedupeRoomsByNumber(this.rooms, false);

    // Sort rooms numerically: 101, 102, 103, 201...
    this.rooms.sort((a, b) =>
      String(a.roomNumber || '').localeCompare(String(b.roomNumber || ''), undefined, { numeric: true })
    );

    // 3. Update reservations referencing rooms or obsolete roomTypeId
    (this.reservations || []).forEach((r) => {
      if (r.roomId || r.roomNumber) {
        const cleanNum = String(r.roomNumber || r.roomId || '').replace(/^rm_/, '');
        const matchedRoom = this.rooms.find((rm) => rm.roomNumber === cleanNum || rm.id === r.roomId);
        if (matchedRoom) {
          r.roomId = matchedRoom.id;
          r.roomNumber = matchedRoom.roomNumber;
          r.roomTypeId = matchedRoom.roomTypeId;
          r.roomTypeName = matchedRoom.roomTypeName;
        } else {
          // If the room was deleted, unlink from this reservation
          r.roomId = '';
          r.roomNumber = '';
          if (r.status === 'in_house') {
            r.status = 'checked_out';
          }
        }
      } else if (r.roomTypeId) {
        const rtId = String(r.roomTypeId).toLowerCase();
        if (rtId === 'rt_standard' || rtId === 'rt_normal' || rtId === 'nrm' || rtId === 'std') {
          r.roomTypeId = 'rt_deluxe';
          r.roomTypeName = 'Delux Room';
        } else if (rtId === 'rt_premium' || rtId === 'rt_ultra_premium') {
          r.roomTypeId = 'rt_supirior';
          r.roomTypeName = 'SUPIRIOR';
        }
      }
    });

    return this.rooms;
  }

  standardizeAndSortNightAudits(audits = []) {
    if (!Array.isArray(audits)) return [];
    const map = new Map();

    audits.forEach((a) => {
      if (!a) return;
      const id = String(a.id || `na_${Date.now()}`);

      // Determine canonical audit date string
      const rawIso = a.rawDate || normalizeDateStr(a.auditDate || a.date) || getTodayIsoDate();
      const dispDate = a.date && a.date.length >= 10 && !a.date.startsWith('20')
        ? a.date
        : formatDisplayDate(rawIso);

      // Determine next business date
      let nextDateIso = a.newBusinessDateIso || normalizeDateStr(a.newBusinessDate);
      if (!nextDateIso || nextDateIso === rawIso) {
        nextDateIso = getNextDayIsoDate(rawIso);
      }
      const dispNextDate = a.newBusinessDate && a.newBusinessDate.length >= 10 && !a.newBusinessDate.startsWith('20')
        ? a.newBusinessDate
        : formatDisplayDate(nextDateIso);

      // Determine completed time
      let compTime = a.completedTime;
      if (!compTime || compTime === '—') {
        if (a.completedAt && a.completedAt !== '—') {
          compTime = a.completedAt;
        } else if (a.performedAt) {
          try {
            const dt = new Date(a.performedAt);
            const tf = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            compTime = `${dispDate} ${tf}`;
          } catch (_) {
            compTime = `${dispDate} 01:00 am`;
          }
        } else {
          compTime = `${dispNextDate} 01:00 am`;
        }
      }

      const chargesCount = Number(a.chargesPostedCount ?? (a.roomCharges ? a.roomCharges.length : (a.roomChargesLog ? a.roomChargesLog.length : 0))) || 0;
      const totalRev = Number(a.totalRevenue ?? a.amountPosted ?? 0) || 0;
      const occPercent = Number(a.occupancyPercent ?? a.kpis?.occupancyPercent ?? (a.occupiedRooms && a.vacantRooms ? Math.round((a.occupiedRooms / (a.occupiedRooms + a.vacantRooms)) * 100) : (a.occupiedRooms ? 25 : 0))) || 0;

      const record = {
        ...a,
        id,
        auditDate: rawIso,
        date: dispDate,
        newBusinessDate: dispNextDate,
        newBusinessDateIso: nextDateIso,
        completedTime: compTime,
        completedAt: a.completedAt || compTime,
        performedBy: a.performedBy || a.startedBy || a.completedBy || 'System',
        status: 'COMPLETED',
        statusText: 'Completed',
        chargesPostedCount: chargesCount,
        amountPosted: totalRev,
        totalRevenue: totalRev,
        occupancyPercent: occPercent,
        isLocked: true
      };

      const dedupeKey = record.auditDate || record.date || id;
      if (!map.has(dedupeKey)) {
        map.set(dedupeKey, record);
      } else {
        const prev = map.get(dedupeKey);
        map.set(dedupeKey, {
          ...prev,
          ...record,
          roomCharges: record.roomCharges || prev.roomCharges || record.roomChargesLog || prev.roomChargesLog
        });
      }
    });

    const list = Array.from(map.values());
    list.sort((a, b) => {
      const dateA = a.auditDate || a.rawDate || a.date;
      const dateB = b.auditDate || b.rawDate || b.date;
      const timeA = new Date(a.performedAt || dateA || 0).getTime();
      const timeB = new Date(b.performedAt || dateB || 0).getTime();
      return timeB - timeA;
    });

    return list;
  }

  dedupeRoomsByNumber(roomsList, pruneCloudDuplicates = false) {
    const byNum = new Map();
    const duplicateDocIdsToPrune = [];

    const getRoomUpdatedMs = (r) => {
      const ts = r?.updatedAt || r?.lastSyncedAt || '';
      const ms = ts ? Date.parse(ts) : 0;
      return isNaN(ms) ? 0 : ms;
    };

    (roomsList || []).forEach((rm) => {
      if (!rm) return;
      const rawNum = String(rm.roomNumber || rm.id || '').trim();
      const numKey = rawNum.toLowerCase().replace(/^(rm_|room_|room)/i, '').trim();
      const digitMatch = numKey.match(/\d+/);
      const canonicalNum = digitMatch ? digitMatch[0] : numKey;
      if (!canonicalNum) return;

      if (this.inFlightDeletes && (this.inFlightDeletes.has(String(rm.id)) || this.inFlightDeletes.has(`rm_${canonicalNum}`) || this.inFlightDeletes.has(canonicalNum))) {
        return;
      }

      const canonicalId = `rm_${canonicalNum}`;
      const existing = byNum.get(canonicalNum);
      if (!existing) {
        byNum.set(canonicalNum, { ...rm, id: rm.id || canonicalId, roomNumber: String(rm.roomNumber || canonicalNum).trim() });
        return;
      }

      const existingIsCanonical = String(existing.id || '').toLowerCase() === canonicalId;
      const incomingIsCanonical = String(rm.id || '').toLowerCase() === canonicalId;
      const existingMs = getRoomUpdatedMs(existing);
      const incomingMs = getRoomUpdatedMs(rm);

      // Floor 2 rooms (203, 204, 205, 206) are canonically SUPERIOR
      const incomingIsSuperior = String(rm.roomTypeName || rm.roomType || '').toUpperCase().includes('SUPERIOR');
      const existingIsSuperior = String(existing.roomTypeName || existing.roomType || '').toUpperCase().includes('SUPERIOR');
      const floor2SuperiorTiebreaker = canonicalNum.startsWith('2') && (incomingIsSuperior !== existingIsSuperior)
        ? (incomingIsSuperior ? rm : existing)
        : null;

      // Keep canonical id if either has it, while taking the freshest operational/housekeeping fields
      const winner = floor2SuperiorTiebreaker || (incomingIsCanonical
        ? rm
        : existingIsCanonical
        ? existing
        : incomingMs >= existingMs
        ? rm
        : existing);
      const loser = winner === rm ? existing : rm;
      const winnerId = winner.id || canonicalId;

      const loserCloudDocId = loser._firestoreDocId || loser.id;
      const winnerCloudDocId = winner._firestoreDocId || winner.id;
      if (loserCloudDocId && loserCloudDocId !== winnerCloudDocId) {
        duplicateDocIdsToPrune.push(loserCloudDocId);
      }

      const base = incomingMs > existingMs ? { ...existing, ...rm } : { ...rm, ...existing };
      byNum.set(canonicalNum, {
        ...base,
        id: winnerId,
        _firestoreDocId: winnerCloudDocId,
        roomNumber: String(base.roomNumber || canonicalNum).trim()
      });
    });

    if (pruneCloudDuplicates && duplicateDocIdsToPrune.length > 0) {
      Array.from(new Set(duplicateDocIdsToPrune)).forEach((dupId) => {
        this.deleteDocFromFirestore('rooms', dupId);
      });
    }

    return Array.from(byNum.values());
  }

  dedupeRatePlans(plansList) {
    const byId = new Map();
    const byCode = new Map();

    (plansList || []).forEach((rp) => {
      if (!rp) return;
      const idKey = (rp.id || '').trim();
      const codeKey = (rp.code || '').trim().toUpperCase();
      if (!idKey && !codeKey) return;

      const existing = (idKey && byId.get(idKey)) || (codeKey && byCode.get(codeKey));
      if (!existing) {
        const item = { ...rp, id: idKey || `rp_${codeKey}`, code: codeKey || rp.code || '' };
        if (idKey) byId.set(idKey, item);
        if (codeKey) byCode.set(codeKey, item);
      } else {
        const prevHasRates = existing.roomTypeRates && Object.values(existing.roomTypeRates).some(r => r && (r.active || r.basePrice > 0));
        const curHasRates = rp.roomTypeRates && Object.values(rp.roomTypeRates).some(r => r && (r.active || r.basePrice > 0));
        const canonicalId = existing.id || idKey;
        const canonicalCode = existing.code || codeKey;
        const merged = (curHasRates && !prevHasRates)
          ? { ...existing, ...rp, id: canonicalId, code: canonicalCode }
          : { ...rp, ...existing, id: canonicalId, code: canonicalCode };

        if (canonicalId) byId.set(canonicalId, merged);
        if (canonicalCode) byCode.set(canonicalCode, merged);
        if (idKey) byId.set(idKey, merged);
        if (codeKey) byCode.set(codeKey, merged);
      }
    });

    return Array.from(new Set(byId.values()));
  }

  sanitizeStaleOccupiedRooms(roomsList, reservationsList) {
    const resList = Array.isArray(reservationsList) ? reservationsList : [];
    return (roomsList || []).map((rm) => {
      if (!rm) return rm;
      const isMarkedOccupied =
        rm.status === 'occupied' ||
        rm.operational === 'occupied' ||
        !!rm.currentReservationId;
      if (!isMarkedOccupied) return rm;

      const rNum = String(rm.roomNumber || '').trim();
      const hasActiveGuest = resList.some((r) => {
        if (!r) return false;
        const st = String(r.status || '').toLowerCase().replace(/[\s-]+/g, '_');
        if (st !== 'in_house' && st !== 'checked_in') return false;
        return (
          (rm.id && r.roomId === rm.id) ||
          (rNum && String(r.roomNumber || '').trim() === rNum) ||
          (rNum && r.roomId === `rm_${rNum}`)
        );
      });

      if (!hasActiveGuest) {
        return {
          ...rm,
          status: rm.status === 'occupied' ? 'dirty' : (rm.status || 'clean'),
          operational: rm.operational === 'occupied' ? 'available' : (rm.operational || 'available'),
          currentReservationId: null,
          currentGuestName: null
        };
      }
      return rm;
    });
  }

  resetToDefaults() {
    this.deletedReservationIds = new Set();
    this.property = { ...initialProperty, businessDate: getTodayIsoDate() };
    this.roomTypes = JSON.parse(JSON.stringify(initialRoomTypes));
    this.rooms = JSON.parse(JSON.stringify(initialRooms));
    this.mealPlans = JSON.parse(JSON.stringify(initialMealPlans));
    this.ratePlans = JSON.parse(JSON.stringify(initialRatePlans));
    this.reservations = JSON.parse(JSON.stringify(initialReservations));
    this.folios = JSON.parse(JSON.stringify(initialFolios));
    this.announcements = JSON.parse(JSON.stringify(initialStaffNotes || []));
    this.otaChannels = JSON.parse(JSON.stringify(initialOtaChannels));
    this.teamMembers = JSON.parse(JSON.stringify(initialTeamMembers));
    this.nightAudits = JSON.parse(JSON.stringify(initialNightAudits));
    this.auditTrail = JSON.parse(JSON.stringify(initialAuditTrail));
    this.taxRules = JSON.parse(JSON.stringify(initialTaxRules));
    setActiveTaxRules(this.taxRules);
    this.serviceCharges = JSON.parse(JSON.stringify(initialServiceCharges));
    this.stopouts = {};
    this.dailyRates = {
      base: {
        'rt_deluxe_2026-11-05': 1000,
        'rt_deluxe_2026-11-06': 1000
      },
      extra_adult: {},
      extra_child: {}
    };
    this.restrictions = {};
    this.maintenanceBlocks = [
      {
        id: 'mb_01',
        roomId: 'rm_203',
        roomNumber: '203',
        reason: 'AC Compressor overhaul & coolant flush',
        startDate: '2026-10-23',
        endDate: '2026-10-26',
        createdAt: '2026-10-23T08:00:00Z'
      }
    ];
    this.save();
  }

  save() {
    const payload = {
      property: this.property,
      roomTypes: this.roomTypes,
      rooms: this.rooms,
      mealPlans: this.mealPlans,
      ratePlans: this.ratePlans,
      reservations: this.reservations,
      folios: this.folios,
      announcements: this.announcements,
      otaChannels: this.otaChannels,
      teamMembers: this.teamMembers,
      nightAudits: this.nightAudits,
      auditTrail: this.auditTrail,
      cleaningHistory: this.cleaningHistory || [],
      stopouts: this.stopouts,
      dailyRates: this.dailyRates,
      restrictions: this.restrictions,
      rateMatrixUpdatedAt: this.rateMatrixUpdatedAt || null,
      maintenanceBlocks: this.maintenanceBlocks,
      taxRules: this.taxRules,
      serviceCharges: this.serviceCharges,
      propertiesList: (this.propertiesList || ['HOTEL NIVASA']).map(p => (p === 'HOTEL ASTHA' || p === 'Hotel Astha') ? 'HOTEL NIVASA' : p).filter(p => p !== 'HOTEL ASTHA RESORT'),
      currentUser: this.isAuthenticated ? this.currentUser : null,
      isAuthenticated: this.isAuthenticated === true && !!this.currentUser,
      invitationTokens: this.invitationTokens || [],
      deletedReservationIds: Array.from(this.deletedReservationIds || []),
      deletedTeamMemberIds: Array.from(this.deletedTeamMemberIds || []),
      deletedRatePlanIds: Array.from(this.deletedRatePlanIds || []),
      deletedRoomIds: [],
      deletedRoomTypeIds: []
    };
    try {
      if (this.isAuthenticated && this.currentUser) {
        localStorage.setItem('pms_is_authenticated', 'true');
        localStorage.setItem('pms_current_user', JSON.stringify(this.currentUser));
      }
      localStorage.removeItem('pms_deleted_entities');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('LocalStorage write warning:', e);
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (
              k &&
              k !== STORAGE_KEY &&
              k !== 'pms_is_authenticated' &&
              k !== 'pms_current_user'
            ) {
              localStorage.removeItem(k);
            }
          }
          payload.auditTrail = (payload.auditTrail || []).slice(0, 20);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (_) {}
      }
    }
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('PMSStore listener error:', err);
      }
    });
  }

  getState() {
    return {
      property: this.property,
      roomTypes: this.roomTypes,
      rooms: this.rooms,
      mealPlans: this.mealPlans,
      ratePlans: this.ratePlans,
      reservations: this.reservations,
      folios: this.folios,
      announcements: this.announcements || [],
      otaChannels: this.otaChannels,
      teamMembers: this.teamMembers,
      nightAudits: this.nightAudits,
      auditTrail: this.auditTrail,
      cleaningHistory: this.cleaningHistory || [],
      stopouts: this.stopouts,
      dailyRates: this.dailyRates,
      restrictions: this.restrictions,
      rateMatrixUpdatedAt: this.rateMatrixUpdatedAt || null,
      maintenanceBlocks: this.maintenanceBlocks,
      taxRules: Array.isArray(this.taxRules) ? this.taxRules : JSON.parse(JSON.stringify(initialTaxRules)),
      serviceCharges: this.serviceCharges || [],
      propertiesList: (this.propertiesList || ['HOTEL NIVASA']).map(p => (p === 'HOTEL ASTHA' || p === 'Hotel Astha') ? 'HOTEL NIVASA' : p).filter(p => p !== 'HOTEL ASTHA RESORT'),
      currentUser: this.isAuthenticated ? this.currentUser : null,
      isAuthenticated: this.isAuthenticated === true && !!this.currentUser,
      invitationTokens: this.invitationTokens || [],
      cloudStatus: this.cloudStatus,
      isCloudLive: this.cloudStatus === 'LIVE'
    };
  }

  updateProperty(patch) {
    const nextProp = { ...this.property, ...patch };
    if (typeof nextProp.logo === 'string' && nextProp.logo.length > 400000) {
      nextProp.logo = '';
    }
    if (typeof nextProp.organizationIcon === 'string' && nextProp.organizationIcon.length > 400000) {
      nextProp.organizationIcon = '';
    }
    this.property = nextProp;
    this.save();
    this.syncDocToFirestore('', this.propertyId, this.property);
    this.notify();
    return this.property;
  }

  updateCurrentUserProfile(patch = {}) {
    if (!this.currentUser) return null;
    const nextUser = {
      ...this.currentUser,
      ...patch
    };
    this.currentUser = nextUser;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('pms_current_user', JSON.stringify(nextUser));
      }
    } catch (_) {}
    if (Array.isArray(this.teamMembers)) {
      this.teamMembers = this.teamMembers.map((m) => {
        if (!m) return m;
        const matches =
          (nextUser.id && m.id === nextUser.id) ||
          (nextUser.uid && m.uid === nextUser.uid) ||
          (nextUser.email && m.email && m.email.toLowerCase() === nextUser.email.toLowerCase()) ||
          (nextUser.role === 'Owner' && m.role === 'Owner');
        if (!matches) return m;
        const updatedMember = { ...m, ...patch };
        this.syncDocToFirestore('teamMembers', updatedMember.id, updatedMember);
        if (updatedMember.uid || updatedMember.id) {
          this.syncDocToFirestore('staff', updatedMember.uid || updatedMember.id, updatedMember);
        }
        return updatedMember;
      });
    }
    this.save();
    this.notify();
    return this.currentUser;
  }

  getReservation(resId) {
    if (!resId) return null;
    return this.reservations.find((r) => r.id === resId || r.bookingReference === resId) || null;
  }

  getFolio(folioId) {
    if (!folioId) return null;
    return this.folios[folioId] || null;
  }

  getRoom(roomId) {
    if (!roomId) return null;
    return this.rooms.find((r) => r.id === roomId || r.roomNumber === roomId) || null;
  }

  getCloudStatus() {
    return {
      status: this.cloudStatus,
      isLive: this.cloudStatus === 'LIVE',
      propertyId: this.propertyId
    };
  }

  // --- FIREBASE CLOUD FIRESTORE REAL-TIME SYNCHRONIZATION ---

  cleanDataForFirestore(obj) {
    if (obj === undefined || obj === null) return null;
    if (typeof obj === 'number') {
      return Number.isNaN(obj) || !Number.isFinite(obj) ? 0 : obj;
    }
    if (typeof obj === 'function' || typeof obj === 'symbol') return null;
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) {
      return obj
        .filter(item => typeof item !== 'function' && typeof item !== 'symbol')
        .map(item => this.cleanDataForFirestore(item));
    }
    const cleaned = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined && typeof val !== 'function' && typeof val !== 'symbol') {
        cleaned[key] = this.cleanDataForFirestore(val);
      }
    }
    return cleaned;
  }

  async initFirebaseSync() {
    try {
      // 1. Ensure property seed exists in Cloud Firestore
      await checkAndSeedFirestore(this.propertyId, false);

      // Clean up any existing listeners
      this.unsubscribers.forEach((unsub) => typeof unsub === 'function' && unsub());
      this.unsubscribers = [];

      // 1. Real-time Listener: Shared Cloud Deletion Tombstones (Syncs deletions across all devices instantly)
      const delRef = doc(db, 'properties', this.propertyId, 'metadata', 'deletions');
      const unsubDeletions = onSnapshot(
        delRef,
        (snapshot) => {
          if (!snapshot.exists()) return;
          const data = snapshot.data() || {};
          let stateChanged = false;

          // 1. Process cloud-deleted rooms by exact doc ID
          if (Array.isArray(data.rooms) && data.rooms.length > 0) {
            const delIds = new Set(data.rooms.map((id) => String(id || '').trim().toLowerCase()));
            const prevCount = (this.rooms || []).length;
            this.rooms = (this.rooms || []).filter((r) => {
              const rId = String(r.id || '').trim().toLowerCase();
              return !delIds.has(rId);
            });
            if (this.rooms.length !== prevCount) {
              stateChanged = true;
            }
          }

          // 2. Process cloud-deleted room types by exact doc ID
          if (Array.isArray(data.roomTypes) && data.roomTypes.length > 0) {
            const delRtIds = new Set(data.roomTypes.map((id) => String(id || '').trim().toLowerCase()));
            const prevRtCount = (this.roomTypes || []).length;
            this.roomTypes = (this.roomTypes || []).filter((rt) => {
              const rId = String(rt.id || '').trim().toLowerCase();
              return !delRtIds.has(rId);
            });
            if (this.roomTypes.length !== prevRtCount) {
              stateChanged = true;
            }
          }

          // 3. Process cloud-deleted team members by ID / staffId / uid / email
          if (Array.isArray(data.teamMembers) && data.teamMembers.length > 0) {
            if (!this.deletedTeamMemberIds) this.deletedTeamMemberIds = new Set();
            const delTmIds = new Set();
            data.teamMembers.forEach((id) => {
              const clean = String(id || '').trim().toLowerCase();
              if (clean) {
                delTmIds.add(clean);
                this.deletedTeamMemberIds.add(clean);
                this.deletedTeamMemberIds.add(String(id));
              }
            });
            const prevTmCount = (this.teamMembers || []).length;
            this.teamMembers = (this.teamMembers || []).filter((tm) => {
              if (!tm) return false;
              const candidates = [tm.id, tm._firestoreDocId, tm.staffId, tm.uid, tm.email]
                .map((v) => String(v || '').trim().toLowerCase())
                .filter(Boolean);
              return !candidates.some((c) => delTmIds.has(c));
            });
            if (this.teamMembers.length !== prevTmCount) {
              stateChanged = true;
            }
          }

          // 4. Process cloud-deleted reservations by ID / bookingReference / _firestoreDocId
          if (Array.isArray(data.reservations) && data.reservations.length > 0) {
            if (!this.deletedReservationIds) this.deletedReservationIds = new Set();
            const delResIds = new Set();
            data.reservations.forEach((id) => {
              const clean = String(id || '').trim().toLowerCase();
              if (clean) {
                delResIds.add(clean);
                this.deletedReservationIds.add(clean);
                this.deletedReservationIds.add(String(id));
              }
            });
            const prevResCount = (this.reservations || []).length;
            this.reservations = (this.reservations || []).filter((r) => {
              if (!r) return false;
              const candidates = [r.id, r.bookingReference, r._firestoreDocId]
                .map((v) => String(v || '').trim().toLowerCase())
                .filter(Boolean);
              return !candidates.some((c) => delResIds.has(c));
            });
            if (this.reservations.length !== prevResCount) {
              stateChanged = true;
            }
          }

          this.canonicalizeRoomsAndRoomTypes();

          if (stateChanged) {
            this.save();
            this.notify();
          }
        },
        () => {}
      );
      this.unsubscribers.push(unsubDeletions);

      // 2. Real-time Listener: Reservations (bounded to active/recent 150 records)
      const resCol = collection(db, 'properties', this.propertyId, 'reservations');
      const resQuery = query(resCol, limit(150));
      const unsubRes = onSnapshot(
        resQuery,
        (snapshot) => {
          const cloudRes = snapshot.docs.map((d) => ({ ...d.data(), _firestoreDocId: d.id }));
          const validCloudRes = cloudRes.filter((r) => {
            if (r.id === 'res_unassigned_1') return false;
            return true;
          });

          // Two-way merge: Preserve all local reservations created in PMS while merging cloud updates
          const resMap = new Map();
          const isDeleted = (resOrId) => {
            if (!this.deletedReservationIds || this.deletedReservationIds.size === 0) return false;
            if (typeof resOrId === 'string') {
              return (
                this.deletedReservationIds.has(resOrId) ||
                this.deletedReservationIds.has(resOrId.trim().toLowerCase())
              );
            }
            if (!resOrId || typeof resOrId !== 'object') return false;
            return [resOrId.id, resOrId.bookingReference, resOrId._firestoreDocId]
              .filter(Boolean)
              .some(
                (v) =>
                  this.deletedReservationIds.has(String(v)) ||
                  this.deletedReservationIds.has(String(v).trim().toLowerCase())
              );
          };

          // 1. Local reservations in memory (from localStorage or newly created by user)
          (this.reservations || []).forEach((r) => {
            if (r && r.id && !isDeleted(r)) resMap.set(r.id, r);
          });

          // 3. Incoming cloud updates with non-destructive state protection
          validCloudRes.forEach((r) => {
            if (r && r.id && !isDeleted(r)) {
              const existing = resMap.get(r.id);
              if (existing) {
                const normLocal = String(existing.status || '').toLowerCase().replace(/[\s-]/g, '_');
                const normCloud = String(r.status || '').toLowerCase().replace(/[\s-]/g, '_');

                // If local reservation was checked in (in_house) and incoming cloud snapshot still has confirmed,
                // do not clobber local in_house state! Push in_house back to cloud.
                if (normLocal === 'in_house' && normCloud === 'confirmed') {
                  const mergedItem = {
                    ...r,
                    ...existing,
                    status: 'in_house',
                    roomId: existing.roomId || r.roomId,
                    roomNumber: existing.roomNumber || r.roomNumber,
                    checkedInAt: existing.checkedInAt || r.checkedInAt || new Date().toISOString(),
                    updatedAt: existing.updatedAt || new Date().toISOString()
                  };
                  resMap.set(r.id, mergedItem);
                  this.syncDocToFirestore('reservations', r.id, mergedItem);
                  return;
                }

                // If local reservation was checked out and cloud snapshot is confirmed or in_house, preserve checked_out
                if (normLocal === 'checked_out' && (normCloud === 'confirmed' || normCloud === 'in_house')) {
                  const mergedItem = {
                    ...r,
                    ...existing,
                    status: 'checked_out',
                    checkedOutAt: existing.checkedOutAt || r.checkedOutAt || new Date().toISOString()
                  };
                  resMap.set(r.id, mergedItem);
                  this.syncDocToFirestore('reservations', r.id, mergedItem);
                  return;
                }

                // If local reservation has a newer timestamp than cloud, preserve local changes
                const localTime = new Date(existing.updatedAt || existing.checkedInAt || 0).getTime();
                const cloudTime = new Date(r.updatedAt || r.lastSyncedAt || 0).getTime();
                if (localTime > cloudTime) {
                  resMap.set(r.id, { ...r, ...existing });
                } else {
                  resMap.set(r.id, { ...existing, ...r });
                }
              } else {
                resMap.set(r.id, r);
              }
            }
          });

          // Sort: User-created / custom reservations at top, canonical seed reservations in defined order
          const merged = Array.from(resMap.values());
          const canonicalOrder = ['res_11', 'res_10', 'res_12', 'res_7', 'res_6', 'res_5', 'res_4', 'res_3', 'res_2', 'res_1'];
          merged.sort((a, b) => {
            const isCanonA = canonicalOrder.includes(a.id);
            const isCanonB = canonicalOrder.includes(b.id);
            if (!isCanonA && isCanonB) return -1;
            if (isCanonA && !isCanonB) return 1;
            if (isCanonA && isCanonB) return canonicalOrder.indexOf(a.id) - canonicalOrder.indexOf(b.id);
            return (b.createdAt || b.checkInDate || '').localeCompare(a.createdAt || a.checkInDate || '');
          });

          this.reservations = merged;
          this.rooms = this.sanitizeStaleOccupiedRooms(this.rooms, this.reservations);
          this.cloudStatus = 'LIVE';
          this.save();
          this.notify();
        },
        (err) => {
          console.warn('[Firebase Firestore] Reservations listener note:', err.message);
          this.cloudStatus = 'OFFLINE_CACHE';
          this.notify();
        }
      );
      this.unsubscribers.push(unsubRes);

      // 3. Real-time Listener: Rooms from Cloud Firestore primary collection 'properties/{propertyId}/rooms'
      const roomsCol = collection(db, 'properties', this.propertyId, 'rooms');
      const unsubRooms = onSnapshot(
        roomsCol,
        async (snapshot) => {
          let docs = snapshot.docs;
          // Fallback to root rooms collection if subcollection is empty
          if (snapshot.empty) {
            try {
              const rootSnap = await getDocs(collection(db, 'rooms'));
              if (!rootSnap.empty) {
                docs = rootSnap.docs;
              }
            } catch (_) {}
          }

          const obsoleteRtKeys = new Set([
            'rt_standard', 'rt_normal', 'rt_ultra_premium', 'rt_premium',
            'ultra premium', 'premium', 'normal', 'standard', 'standard room',
            'nrm', 'ulp', 'prm', 'std'
          ]);

          const cloudRooms = docs
            .map((d) => {
              const data = d.data() || {};
              const cleanNum = String(data.roomNumber || data.id || d.id || '')
                .trim()
                .replace(/^rm_/, '');
              if (!cleanNum) return null;

              // Skip only if currently in-flight being deleted
              if (this.inFlightDeletes && (this.inFlightDeletes.has(d.id) || this.inFlightDeletes.has(`rm_${cleanNum}`))) {
                return null;
              }

              let rTypeId = data.roomTypeId;
              let rTypeName = data.roomTypeName || data.roomType;
              const isObsolete =
                !rTypeId ||
                obsoleteRtKeys.has(String(rTypeId).toLowerCase()) ||
                obsoleteRtKeys.has(String(rTypeName || '').toLowerCase());

              if (isObsolete) {
                if (cleanNum.startsWith('2')) {
                  rTypeId = 'rt_supirior';
                  rTypeName = 'SUPIRIOR';
                } else if (cleanNum.startsWith('3')) {
                  rTypeId = 'rt_double_single';
                  rTypeName = 'DOUBLE SINGLE';
                } else {
                  rTypeId = 'rt_deluxe';
                  rTypeName = 'DELUXE';
                }
              } else {
                const matchedRt = (this.roomTypes || []).find(
                  (rt) => rt.id === rTypeId || rt.code === rTypeId || rt.name?.toLowerCase() === String(rTypeId).toLowerCase()
                );
                if (matchedRt) {
                  rTypeName = matchedRt.name;
                  rTypeId = matchedRt.id;
                }
              }

              return {
                ...data,
                id: data.id || d.id || `rm_${cleanNum}`,
                _firestoreDocId: d.id,
                roomNumber: cleanNum,
                roomTypeId: rTypeId,
                roomTypeName: rTypeName || 'Room',
                roomType: rTypeName || 'Room',
                floor: data.floor || cleanNum.charAt(0) || '1',
                status: data.status || 'clean',
                operational: data.operational || 'available',
                notes: data.notes || 'Ready for check-in'
              };
            })
            .filter(Boolean);

          // Robust Two-Way Merge: Keep freshest room doc per room number and preserve newer/pending local updates
          const getRoomTs = (r) => {
            const ts = r?.statusUpdatedAt || r?.updatedAt || r?.lastSyncedAt || '';
            const ms = ts ? Date.parse(ts) : 0;
            return isNaN(ms) ? 0 : ms;
          };

          const roomMap = new Map();
          cloudRooms.forEach((cr) => {
            const numKey = String(cr.roomNumber || cr.id || '').trim().toLowerCase().replace(/^rm_/, '');
            if (!numKey) return;
            const prev = roomMap.get(numKey);
            if (!prev || getRoomTs(cr) >= getRoomTs(prev)) {
              roomMap.set(numKey, cr);
            }
          });

          (this.rooms || []).forEach((localRm) => {
            if (!localRm) return;
            const numKey = String(localRm.roomNumber || localRm.id || '').trim().toLowerCase().replace(/^rm_/, '');
            if (!numKey) return;
            if (this.inFlightDeletes && (this.inFlightDeletes.has(numKey) || this.inFlightDeletes.has(`rm_${numKey}`) || this.inFlightDeletes.has(String(localRm.id)))) {
              return;
            }
            const existingCloud = roomMap.get(numKey);
            if (!existingCloud) {
              // ONLY preserve local room if it was created in this session and is actively pending cloud sync
              if (localRm._pendingSync) {
                roomMap.set(numKey, localRm);
              }
            } else {
              // Preserve local room changes if pending sync OR if local update is strictly newer than cloud
              const localMs = getRoomTs(localRm);
              const cloudMs = getRoomTs(existingCloud);
              if (localRm._pendingSync || (localMs > 0 && localMs > cloudMs)) {
                roomMap.set(numKey, { ...existingCloud, ...localRm });
              }
            }
          });

          const mergedRooms = Array.from(roomMap.values());
          const deduped = this.dedupeRoomsByNumber(mergedRooms, false);
          this.rooms = this.sanitizeStaleOccupiedRooms(deduped, this.reservations);
          this.canonicalizeRoomsAndRoomTypes();
          this.cloudStatus = 'LIVE';
          this.save();
          this.notify();
        },
        (err) => {
          console.warn('[Firebase Firestore] Rooms listener note:', err.message);
        }
      );
      this.unsubscribers.push(unsubRooms);

      // Real-time Listener: Room Types (Instantly syncs additions, edits, and deletions across all devices)
      const rtCol = collection(db, 'properties', this.propertyId, 'roomTypes');
      const unsubRt = onSnapshot(
        rtCol,
        (snapshot) => {
          const cloudRt = snapshot.docs.map((d) => {
            const data = d.data() || {};
            return { ...data, id: data.id || d.id, _docId: d.id };
          });
          const obsoleteRtKeys = new Set([
            'rt_standard', 'rt_normal', 'rt_ultra_premium', 'rt_premium',
            'ultra premium', 'premium', 'normal', 'standard', 'standard room',
            'nrm', 'ulp', 'prm', 'std'
          ]);
          const surviving = cloudRt.filter((rt) => {
            if (!rt) return false;
            const id = String(rt.id || '').trim().toLowerCase();
            const name = String(rt.name || '').trim().toLowerCase();
            const code = String(rt.code || '').trim().toLowerCase();
            if (obsoleteRtKeys.has(id) || obsoleteRtKeys.has(name) || obsoleteRtKeys.has(code)) return false;
            if (this.inFlightDeletes && this.inFlightDeletes.has(String(rt.id))) return false;
            return true;
          });
          if (cloudRt.length > 0) {
            const map = new Map();
            surviving.forEach((rt) => {
              const key = rt.id || rt.code || rt.name;
              if (key) map.set(key, rt);
            });
            this.roomTypes = Array.from(map.values());
            this.canonicalizeRoomsAndRoomTypes();
            this.save();
            this.notify();
          }
        },
        () => {}
      );
      this.unsubscribers.push(unsubRt);

      // 4. Real-time Listener: Folios (bounded to active/recent 100 folios)
      const foliosCol = collection(db, 'properties', this.propertyId, 'folios');
      const foliosQuery = query(foliosCol, limit(100));
      const unsubFolios = onSnapshot(
        foliosQuery,
        (snapshot) => {
          const newFolios = {};
          snapshot.docs.forEach((d) => {
            newFolios[d.id] = d.data();
          });
          this.folios = { ...this.folios, ...newFolios };
          this.cloudStatus = 'LIVE';
          this.save();
          this.notify();
        },
        (err) => {
          console.warn('[Firebase Firestore] Folios listener note:', err.message);
        }
      );
      this.unsubscribers.push(unsubFolios);

      // 5. Real-time Listener: Maintenance Blocks
      const mbCol = collection(db, 'properties', this.propertyId, 'maintenanceBlocks');
      const unsubMb = onSnapshot(
        mbCol,
        (snapshot) => {
          this.maintenanceBlocks = snapshot.docs.map((d) => d.data());
          this.save();
          this.notify();
        },
        () => {}
      );
      this.unsubscribers.push(unsubMb);

      // 6. Real-time Listener: Root Property Master Information
      const propRef = doc(db, 'properties', this.propertyId);
      const unsubProp = onSnapshot(
        propRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const cloudProp = snapshot.data();
            this.property = { ...this.property, ...cloudProp };
            let propNeedsSync = false;
            if (!this.property.name || this.property.name === 'HOTEL ASTHA' || this.property.name === 'Hotel Astha' || this.property.name === 'Astha') {
              this.property.name = 'HOTEL NIVASA';
              propNeedsSync = true;
            }
            if (!this.property.tagline || this.property.tagline === 'HOTEL ASTHA' || this.property.tagline === 'Hotel Astha' || this.property.tagline === 'Astha') {
              this.property.tagline = 'HOTEL NIVASA';
              propNeedsSync = true;
            }
            if (!this.property.legalName || this.property.legalName === 'HOTEL ASTHA' || this.property.legalName === 'Hotel Astha' || this.property.legalName === 'Astha') {
              this.property.legalName = 'HOTEL NIVASA';
              propNeedsSync = true;
            }
            if (!this.property.tradeName || this.property.tradeName === 'HOTEL ASTHA' || this.property.tradeName === 'Hotel Astha' || this.property.tradeName === 'Astha') {
              this.property.tradeName = 'HOTEL NIVASA';
              propNeedsSync = true;
            }
            if (!this.property.initials || this.property.initials === 'HA' || this.property.initials === 'AI') {
              this.property.initials = 'HN';
              propNeedsSync = true;
            }
            if (propNeedsSync) {
              this.syncDocToFirestore('', this.propertyId, this.property);
            }
            this.save();
            this.notify();
          }
        },
        (err) => {
          console.warn('[Firebase Firestore] Property listener note:', err.message);
        }
      );
      this.unsubscribers.push(unsubProp);

      // 6B. Real-time Listener: Rates, Inventory, Stop-Sell & Restrictions Matrix
      const ariRef = doc(db, 'properties', this.propertyId, 'rateMatrix', 'ari_config');
      const unsubAri = onSnapshot(
        ariRef,
        (snapshot) => {
          if (!snapshot.exists()) return;
          const ariData = snapshot.data() || {};
          const cloudTs = new Date(ariData.updatedAt || ariData.lastSyncedAt || 0).getTime();
          const localTs = new Date(this.rateMatrixUpdatedAt || 0).getTime();
          if (cloudTs > localTs || (!localTs && cloudTs > 0)) {
            const cloudRates = ariData.dailyRates || {};
            const localRates = this.dailyRates || { base: {}, extra_adult: {}, extra_child: {}, min_nights: {} };
            this.dailyRates = {
              base: { ...(localRates.base || {}), ...(cloudRates.base || {}) },
              extra_adult: { ...(localRates.extra_adult || {}), ...(cloudRates.extra_adult || {}) },
              extra_child: { ...(localRates.extra_child || {}), ...(cloudRates.extra_child || {}) },
              min_nights: { ...(localRates.min_nights || {}), ...(cloudRates.min_nights || {}) }
            };
            if (ariData.stopouts) {
              this.stopouts = { ...(this.stopouts || {}), ...ariData.stopouts };
            }
            if (ariData.restrictions) {
              this.restrictions = { ...(this.restrictions || {}), ...ariData.restrictions };
            }
            this.rateMatrixUpdatedAt = ariData.updatedAt || ariData.lastSyncedAt || new Date().toISOString();
            this.save();
          }
        },
        (err) => {
          console.warn('[Firebase Firestore] Rate Matrix listener note:', err.message);
        }
      );
      this.unsubscribers.push(unsubAri);

      // 7. Real-time Listener: Team Members
      const tmCol = collection(db, 'properties', this.propertyId, 'teamMembers');
      const unsubTm = onSnapshot(
        tmCol,
        (snapshot) => {
          const cloudTm = snapshot.docs.map((d) => {
            const data = d.data() || {};
            const props = (data.properties && data.properties.length > 0 ? data.properties : ['HOTEL NIVASA']).map((p) =>
              p === 'HOTEL ASTHA' || p === 'Hotel Astha' ? 'HOTEL NIVASA' : p
            );
            return { id: d.id, ...data, _firestoreDocId: d.id, properties: props };
          });
          const deletedTm = this.deletedTeamMemberIds || new Set();
          const isTmDeleted = (tm) => {
            if (!tm) return true;
            if (tm.id === 'usr_02' || tm.name === 'Shankar L' || tm.isDeleted) return true;
            if (tm.id && deletedTm.has(String(tm.id))) return true;
            if (tm._firestoreDocId && deletedTm.has(String(tm._firestoreDocId))) return true;
            if (tm.staffId && deletedTm.has(String(tm.staffId))) return true;
            if (tm.uid && deletedTm.has(String(tm.uid))) return true;
            if (tm.email && deletedTm.has(String(tm.email).toLowerCase())) return true;
            return false;
          };
          const map = new Map();
          cloudTm.forEach((tm) => {
            if (isTmDeleted(tm)) return;
            const key = tm.id || tm.staffId || tm.email;
            if (key) {
              map.set(key, tm);
            }
          });
          (this.teamMembers || initialTeamMembers).forEach((tm) => {
            if (isTmDeleted(tm)) return;
            const key = tm.id || tm.staffId || tm.email;
            if (key) {
              if (tm.role === 'Owner' || tm._pendingSync) {
                if (!map.has(key)) map.set(key, tm);
              }
            }
          });
          (initialTeamMembers || []).forEach((tm) => {
            if (isTmDeleted(tm)) return;
            const key = tm.id || tm.staffId || tm.email;
            if (key) {
              if (!map.has(key)) map.set(key, tm);
            }
          });
          this.teamMembers = Array.from(map.values()).map((tm) =>
            tm && (tm.role === 'Owner' || tm.email === 'owner@hotelastha.com' || tm.email === 'owner@hotelnivasa.com')
              ? { ...tm, email: (tm.email === 'owner@hotelastha.com' || tm.email === 'owner@hotelnivasa.com') ? 'info@hotelnivasa.com' : tm.email }
              : tm
          );
          this.syncCurrentUserWithTeamMembers();
          this.save();
          this.notify();
        },
        () => {}
      );
      this.unsubscribers.push(unsubTm);

      // 8. Real-time Listener: Night Audits (History & Immutable Snapshots)
      const naCol = collection(db, 'properties', this.propertyId, 'nightAudits');
      const unsubNa = onSnapshot(
        naCol,
        (snapshot) => {
          if (snapshot.empty) return;
          const cloudAudits = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          const auditMap = new Map();
          (initialNightAudits || []).forEach((a) => {
            if (a && a.id) auditMap.set(a.id, a);
          });
          (this.nightAudits || []).forEach((a) => {
            if (a && a.id) auditMap.set(a.id, a);
          });
          cloudAudits.forEach((a) => {
            if (a && a.id) {
              const existing = auditMap.get(a.id);
              auditMap.set(a.id, existing ? { ...existing, ...a } : a);
            }
          });
          this.nightAudits = this.standardizeAndSortNightAudits(Array.from(auditMap.values()));
          this.save();
          this.notify();
        },
        (err) => {
          console.warn('[Firebase Firestore] Night audits listener note:', err?.message);
        }
      );
      this.unsubscribers.push(unsubNa);

      // 8. Load Static Configuration Collections via one-shot cached read (no permanent listener overhead)
      await this.fetchStaticConfigs();

      // 8. Real-time Listener: Audit Trail (bounded to latest 30 entries)
      const auditCol = collection(db, 'properties', this.propertyId, 'auditTrail');
      const auditQuery = query(auditCol, orderBy('timestamp', 'desc'), limit(30));
      const unsubAudit = onSnapshot(
        auditQuery,
        (snapshot) => {
          const cloudAudits = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((item) => !(this.inFlightDeletes && this.inFlightDeletes.has(`auditTrail/${item.id}`)));

          const mergedMap = new Map();
          cloudAudits.forEach((item) => {
            if (item && item.id) mergedMap.set(item.id, item);
          });

          // Preserve local entries only if pending sync or snapshot is still from offline cache
          (this.auditTrail || []).forEach((item) => {
            if (!item || !item.id) return;
            if (this.inFlightDeletes && this.inFlightDeletes.has(`auditTrail/${item.id}`)) return;
            if (!mergedMap.has(item.id) && (item._pendingSync || snapshot.metadata?.fromCache)) {
              mergedMap.set(item.id, item);
            }
          });

          const parseAuditTime = (entry) => {
            if (typeof entry?.createdAtMs === 'number' && !isNaN(entry.createdAtMs)) {
              return entry.createdAtMs;
            }
            if (entry?.timestamp) {
              const iso = String(entry.timestamp).includes('T')
                ? String(entry.timestamp)
                : String(entry.timestamp).replace(' ', 'T');
              const ms = Date.parse(iso);
              if (!isNaN(ms)) return ms;
            }
            return 0;
          };

          const mergedList = Array.from(mergedMap.values())
            .sort((a, b) => parseAuditTime(b) - parseAuditTime(a))
            .slice(0, 50);

          this.auditTrail = mergedList;
          this.save();
          this.notify();
        },
        (err) => {
          console.warn('[Firebase Firestore] Audit Trail listener note:', err?.message);
        }
      );
      this.unsubscribers.push(unsubAudit);

      // 9. Real-time Listener: Cleaning History (Firestore is authoritative so cross-device deletions sync immediately)
      const cleanCol = collection(db, 'properties', this.propertyId, 'cleaningHistory');
      const cleanQuery = query(cleanCol, orderBy('createdAtMs', 'desc'), limit(200));
      const unsubClean = onSnapshot(
        cleanQuery,
        (snapshot) => {
          const cloudRecords = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((item) => !(this.inFlightDeletes && this.inFlightDeletes.has(`cleaningHistory/${item.id}`)));

          const mergedMap = new Map();
          cloudRecords.forEach((item) => {
            if (item && item.id) mergedMap.set(item.id, item);
          });

          // Only keep local records that are actively pending sync or if reading from offline cache
          (this.cleaningHistory || []).forEach((item) => {
            if (!item || !item.id) return;
            if (this.inFlightDeletes && this.inFlightDeletes.has(`cleaningHistory/${item.id}`)) return;
            if (!mergedMap.has(item.id) && (item._pendingSync || snapshot.metadata?.fromCache)) {
              mergedMap.set(item.id, item);
            }
          });

          this.cleaningHistory = Array.from(mergedMap.values())
            .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
            .slice(0, 500);
          this.save();
          this.notify();
        },
        (err) => {
          console.warn('[Firebase Firestore] Cleaning History listener note:', err?.message);
        }
      );
      this.unsubscribers.push(unsubClean);

      // Keep main database (both subcollection and root mirror) 100% updated with exact room types, room numbers, and summaries
      await this.purgeObsoleteRoomsAndTypesFromCloud();

      this.cloudStatus = 'LIVE';
      this.notify();
    } catch (e) {
      console.warn('[Firebase Firestore] Sync initialization fallback to local storage:', e.message);
      this.cloudStatus = 'OFFLINE_CACHE';
      this.notify();
    }
  }

  async fetchRoomsAndRoomTypesFromFirebase() {
    if (!db) return;
    try {
      console.info('🔥 [Firebase Database] Fetching all room types and rooms directly from Firebase...');
      const [rtSnap, rmSnap] = await Promise.all([
        getDocs(collection(db, 'properties', this.propertyId, 'roomTypes')).catch(() => null),
        getDocs(collection(db, 'properties', this.propertyId, 'rooms')).catch(() => null)
      ]);

      const obsoleteRtKeys = new Set([
        'rt_standard', 'rt_normal', 'rt_ultra_premium', 'rt_premium',
        'ultra premium', 'premium', 'normal', 'standard', 'standard room',
        'nrm', 'ulp', 'prm', 'std'
      ]);

      // 1. Process Room Types from Firebase
      if (rtSnap && !rtSnap.empty) {
        const cloudRt = rtSnap.docs.map((d) => {
          const data = d.data() || {};
          return { ...data, id: data.id || d.id, _docId: d.id };
        });
        const surviving = cloudRt.filter((rt) => {
          if (!rt) return false;
          const id = String(rt.id || '').trim().toLowerCase();
          const name = String(rt.name || '').trim().toLowerCase();
          const code = String(rt.code || '').trim().toLowerCase();
          if (obsoleteRtKeys.has(id) || obsoleteRtKeys.has(name) || obsoleteRtKeys.has(code)) return false;
          if (this.inFlightDeletes && this.inFlightDeletes.has(String(rt.id))) return false;
          return true;
        });

        if (surviving.length > 0) {
          const map = new Map();
          surviving.forEach((rt) => {
            const key = rt.id || rt.code || rt.name;
            if (key) map.set(key, rt);
          });
          this.roomTypes = Array.from(map.values());
        }
      }

      // 2. Process Physical Rooms from Firebase
      let rmDocs = rmSnap && !rmSnap.empty ? rmSnap.docs : [];
      if (rmDocs.length === 0) {
        try {
          const rootSnap = await getDocs(collection(db, 'rooms')).catch(() => null);
          if (rootSnap && !rootSnap.empty) rmDocs = rootSnap.docs;
        } catch (_) {}
      }

      if (rmDocs.length > 0) {
        const cloudRooms = rmDocs
          .map((d) => {
            const data = d.data() || {};
            const cleanNum = String(data.roomNumber || data.id || d.id || '').trim().replace(/^rm_/, '');
            if (!cleanNum) return null;

            // Skip only if actively in-flight being deleted
            if (this.inFlightDeletes && (this.inFlightDeletes.has(d.id) || this.inFlightDeletes.has(`rm_${cleanNum}`))) {
              return null;
            }

            let rTypeId = data.roomTypeId;
            let rTypeName = data.roomTypeName || data.roomType;
            const isObsolete =
              !rTypeId ||
              obsoleteRtKeys.has(String(rTypeId).toLowerCase()) ||
              obsoleteRtKeys.has(String(rTypeName || '').toLowerCase());

            if (isObsolete) {
              if (cleanNum.startsWith('2')) {
                rTypeId = 'rt_supirior';
                rTypeName = 'SUPIRIOR';
              } else if (cleanNum.startsWith('3')) {
                rTypeId = 'rt_double_single';
                rTypeName = 'DOUBLE SINGLE';
              } else {
                rTypeId = 'rt_deluxe';
                rTypeName = 'DELUXE';
              }
            } else {
              const matchedRt = (this.roomTypes || []).find(
                (rt) => rt.id === rTypeId || rt.code === rTypeId || rt.name?.toLowerCase() === String(rTypeId).toLowerCase()
              );
              if (matchedRt) {
                rTypeName = matchedRt.name;
                rTypeId = matchedRt.id;
              }
            }

            return {
              ...data,
              id: data.id || d.id || `rm_${cleanNum}`,
              _firestoreDocId: d.id,
              roomNumber: cleanNum,
              roomTypeId: rTypeId,
              roomTypeName: rTypeName || 'Room',
              roomType: rTypeName || 'Room',
              floor: data.floor || cleanNum.charAt(0) || '1',
              status: data.status || 'clean',
              operational: data.operational || 'available',
              notes: data.notes || 'Ready for check-in'
            };
          })
          .filter(Boolean);

        if (cloudRooms.length > 0) {
          const getRoomTs = (r) => {
            const ts = r?.statusUpdatedAt || r?.updatedAt || r?.lastSyncedAt || '';
            const ms = ts ? Date.parse(ts) : 0;
            return isNaN(ms) ? 0 : ms;
          };
          const dedupedCloud = this.dedupeRoomsByNumber(cloudRooms, false);
          const mergedWithLocal = dedupedCloud.map((cr) => {
            const numKey = String(cr.roomNumber || cr.id || '').trim().toLowerCase().replace(/^rm_/, '');
            const localMatch = (this.rooms || []).find((lr) =>
              lr && String(lr.roomNumber || lr.id || '').trim().toLowerCase().replace(/^rm_/, '') === numKey
            );
            if (localMatch && (localMatch._pendingSync || getRoomTs(localMatch) > getRoomTs(cr))) {
              return { ...cr, ...localMatch };
            }
            return cr;
          });
          this.rooms = this.sanitizeStaleOccupiedRooms(mergedWithLocal, this.reservations);
        }
      }

      this.canonicalizeRoomsAndRoomTypes();
      console.info(`🔥 [Firebase Database] Successfully loaded ${this.roomTypes.length} room types and ${this.rooms.length} rooms from Firebase.`);
      this.notify();
    } catch (e) {
      console.warn('[Firebase Database] Note fetching rooms and types directly:', e?.message);
    }
  }

  async fetchStaticConfigs() {
    if (!db) return;
    try {
      const [rtSnap, rpSnap, mpSnap, tmSnap, annSnap, naSnap, ariSnap] = await Promise.all([
        getDocs(collection(db, 'properties', this.propertyId, 'roomTypes')).catch(() => null),
        getDocs(collection(db, 'properties', this.propertyId, 'ratePlans')).catch(() => null),
        getDocs(collection(db, 'properties', this.propertyId, 'mealPlans')).catch(() => null),
        getDocs(collection(db, 'properties', this.propertyId, 'teamMembers')).catch(() => null),
        getDocs(collection(db, 'properties', this.propertyId, 'announcements')).catch(() => null),
        getDocs(collection(db, 'properties', this.propertyId, 'nightAudits')).catch(() => null),
        getDoc(doc(db, 'properties', this.propertyId, 'rateMatrix', 'ari_config')).catch(() => null)
      ]);

      let hasChanges = false;

      // 1. Room Types
      if (rtSnap && !rtSnap.empty) {
        const cloudRt = rtSnap.docs.map((d) => {
          const data = d.data() || {};
          return { ...data, id: data.id || d.id, _docId: d.id };
        });
        const obsoleteRtKeys = new Set([
          'rt_standard', 'rt_normal', 'rt_ultra_premium', 'rt_premium',
          'ultra premium', 'premium', 'normal', 'standard', 'standard room',
          'nrm', 'ulp', 'prm', 'std'
        ]);
        const surviving = cloudRt.filter((rt) => {
          if (!rt) return false;
          const id = String(rt.id || '').trim().toLowerCase();
          const name = String(rt.name || '').trim().toLowerCase();
          const code = String(rt.code || '').trim().toLowerCase();
          return !obsoleteRtKeys.has(id) && !obsoleteRtKeys.has(name) && !obsoleteRtKeys.has(code);
        });

        const map = new Map();
        surviving.forEach((rt) => {
          const key = rt.id || rt.code || rt.name;
          if (key) map.set(key, rt);
        });
        this.roomTypes = Array.from(map.values());
        this.canonicalizeRoomsAndRoomTypes();
        hasChanges = true;
      }

      // 2. Rate Plans
      if (rpSnap && !rpSnap.empty) {
        const obsoleteRatePlanKeys = new Set(['rp_test_plan', 'test plan', '132']);
        const cloudRp = rpSnap.docs
          .map((d) => ({ ...d.data(), id: d.id || d.data()?.id }))
          .filter((rp) => {
            if (!rp) return false;
            const id = String(rp.id || '').trim().toLowerCase();
            const code = String(rp.code || '').trim().toLowerCase();
            const name = String(rp.name || '').trim().toLowerCase();
            if (obsoleteRatePlanKeys.has(id) || obsoleteRatePlanKeys.has(code) || obsoleteRatePlanKeys.has(name)) return false;
            if (this.deletedRatePlanIds && (this.deletedRatePlanIds.has(String(rp.id)) || this.deletedRatePlanIds.has(String(rp.code)))) return false;
            return true;
          });
        const deduped = this.dedupeRatePlans(cloudRp);
        if (deduped.length > 0) {
          this.ratePlans = deduped;
          hasChanges = true;
        }
      }

      // 3. Meal Plans
      if (mpSnap && !mpSnap.empty) {
        const cloudMp = mpSnap.docs.map((d) => d.data());
        const map = new Map();
        cloudMp.forEach((mp) => {
          const key = mp.id || mp.code;
          if (key && !map.has(key)) map.set(key, mp);
        });
        this.mealPlans = Array.from(map.values());
        hasChanges = true;
      }

      // 4. Team Members
      if (tmSnap && !tmSnap.empty) {
        const cloudTm = tmSnap.docs.map((d) => {
          const data = d.data() || {};
          const props = (data.properties && data.properties.length > 0 ? data.properties : ['HOTEL NIVASA']).map((p) =>
            p === 'HOTEL ASTHA' || p === 'Hotel Astha' ? 'HOTEL NIVASA' : p
          );
          return { id: d.id, ...data, _firestoreDocId: d.id, properties: props };
        });
        const deletedTm = this.deletedTeamMemberIds || new Set();
        const isTmDeleted = (tm) => {
          if (!tm) return true;
          if (tm.id === 'usr_02' || tm.name === 'Shankar L' || tm.isDeleted) return true;
          if (tm.id && deletedTm.has(String(tm.id))) return true;
          if (tm._firestoreDocId && deletedTm.has(String(tm._firestoreDocId))) return true;
          if (tm.staffId && deletedTm.has(String(tm.staffId))) return true;
          if (tm.uid && deletedTm.has(String(tm.uid))) return true;
          if (tm.email && deletedTm.has(String(tm.email).toLowerCase())) return true;
          return false;
        };
        const map = new Map();
        cloudTm.forEach((tm) => {
          if (isTmDeleted(tm)) return;
          const key = tm.id || tm.staffId || tm.email;
          if (key) {
            map.set(key, tm);
          }
        });
        (this.teamMembers || []).forEach((tm) => {
          if (isTmDeleted(tm)) return;
          const key = tm.id || tm.staffId || tm.email;
          if (key) {
            if (tm.role === 'Owner' || tm._pendingSync) {
              if (!map.has(key)) map.set(key, tm);
            }
          }
        });
        this.teamMembers = Array.from(map.values())
          .filter((m) => m && m.id !== 'usr_02' && m.name !== 'Shankar L')
          .map((tm) =>
            tm.role === 'Owner' && (tm.email === 'owner@hotelastha.com' || tm.email === 'owner@hotelnivasa.com')
              ? { ...tm, email: 'info@hotelnivasa.com' }
              : tm
          );
        this.syncCurrentUserWithTeamMembers();
        hasChanges = true;
      } else {
        this.teamMembers = (this.teamMembers || []).filter(
          (m) => m && m.id !== 'usr_02' && m.name !== 'Shankar L'
        );
      }

      // 5. Announcements
      if (annSnap && !annSnap.empty) {
        const cloudAnn = annSnap.docs.map((d) => d.data());
        if (cloudAnn.length > 0) {
          this.announcements = cloudAnn;
          hasChanges = true;
        }
      }

      // 6. Night Audits (History & Immutable Snapshots)
      if (naSnap && !naSnap.empty) {
        const cloudAudits = naSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const auditMap = new Map();
        (initialNightAudits || []).forEach((a) => {
          if (a && a.id) auditMap.set(a.id, a);
        });
        (this.nightAudits || []).forEach((a) => {
          if (a && a.id) auditMap.set(a.id, a);
        });
        cloudAudits.forEach((a) => {
          if (a && a.id) {
            const existing = auditMap.get(a.id);
            auditMap.set(a.id, existing ? { ...existing, ...a } : a);
          }
        });
        this.nightAudits = this.standardizeAndSortNightAudits(Array.from(auditMap.values()));
        hasChanges = true;
      }

      // 7. Rates, Inventory, Stop-Sell & Restrictions Matrix
      if (ariSnap && ariSnap.exists()) {
        const ariData = ariSnap.data() || {};
        const cloudTs = new Date(ariData.updatedAt || ariData.lastSyncedAt || 0).getTime();
        const localTs = new Date(this.rateMatrixUpdatedAt || 0).getTime();
        if (cloudTs >= localTs || (!localTs && cloudTs > 0)) {
          const cloudRates = ariData.dailyRates || {};
          const localRates = this.dailyRates || { base: {}, extra_adult: {}, extra_child: {}, min_nights: {} };
          this.dailyRates = {
            base: { ...(localRates.base || {}), ...(cloudRates.base || {}) },
            extra_adult: { ...(localRates.extra_adult || {}), ...(cloudRates.extra_adult || {}) },
            extra_child: { ...(localRates.extra_child || {}), ...(cloudRates.extra_child || {}) },
            min_nights: { ...(localRates.min_nights || {}), ...(cloudRates.min_nights || {}) }
          };
          if (ariData.stopouts) {
            this.stopouts = { ...(this.stopouts || {}), ...ariData.stopouts };
          }
          if (ariData.restrictions) {
            this.restrictions = { ...(this.restrictions || {}), ...ariData.restrictions };
          }
          this.rateMatrixUpdatedAt = ariData.updatedAt || ariData.lastSyncedAt || this.rateMatrixUpdatedAt;
          hasChanges = true;
        }
      }

      // 7. Rates, Inventory, Stop-Sell & Restrictions Matrix
      if (ariSnap && ariSnap.exists()) {
        const ariData = ariSnap.data() || {};
        const cloudTs = new Date(ariData.updatedAt || ariData.lastSyncedAt || 0).getTime();
        const localTs = new Date(this.rateMatrixUpdatedAt || 0).getTime();
        if (cloudTs >= localTs) {
          const cloudRates = ariData.dailyRates || {};
          const localRates = this.dailyRates || { base: {}, extra_adult: {}, extra_child: {}, min_nights: {} };
          this.dailyRates = {
            base: { ...(localRates.base || {}), ...(cloudRates.base || {}) },
            extra_adult: { ...(localRates.extra_adult || {}), ...(cloudRates.extra_adult || {}) },
            extra_child: { ...(localRates.extra_child || {}), ...(cloudRates.extra_child || {}) },
            min_nights: { ...(localRates.min_nights || {}), ...(cloudRates.min_nights || {}) }
          };
          if (ariData.stopouts) {
            this.stopouts = { ...(this.stopouts || {}), ...ariData.stopouts };
          }
          if (ariData.restrictions) {
            this.restrictions = { ...(this.restrictions || {}), ...ariData.restrictions };
          }
          this.rateMatrixUpdatedAt = ariData.updatedAt || ariData.lastSyncedAt || this.rateMatrixUpdatedAt;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        this.save();
        this.notify();
      }
    } catch (err) {
      console.warn('[Firebase] Static config fetch note:', err?.message);
    }
  }

  async syncDocToFirestore(collectionName, docId, data) {
    if (!data || !db) return;
    try {
      const payload = this.cleanDataForFirestore({
        ...data,
        propertyId: this.propertyId,
        lastSyncedAt: new Date().toISOString()
      });

      // If syncing the property profile itself (empty collectionName or 'properties')
      if (!collectionName || collectionName === 'property' || collectionName === 'properties') {
        if (typeof payload.logo === 'string' && payload.logo.length > 400000) {
          payload.logo = '';
        }
        if (typeof payload.organizationIcon === 'string' && payload.organizationIcon.length > 400000) {
          payload.organizationIcon = '';
        }
        const propRef = doc(db, 'properties', this.propertyId);
        await setDoc(propRef, payload, { merge: true });

        // Also update settings/property_config for global settings resolution
        try {
          const configRef = doc(db, 'settings', 'property_config');
          await setDoc(configRef, payload, { merge: true });
        } catch (_) {}

        console.info(`🔥 [Firebase Cloud] Synced property master config for ${this.propertyId}`);
        return;
      }

      // Exact data enrichment for rooms, roomTypes, and reservations
      if (collectionName === 'rooms') {
        const cleanRoomNum = String(data.roomNumber || data.id || docId || '').trim().replace(/^rm_/, '');
        const matchedRt = (this.roomTypes || []).find((rt) =>
          rt.id === data.roomTypeId ||
          rt.code === data.roomTypeId ||
          rt.name?.toLowerCase() === String(data.roomTypeId || '').toLowerCase() ||
          (data.roomTypeName && rt.name?.toLowerCase() === String(data.roomTypeName).toLowerCase())
        );
        let fallbackName = 'Delux Room';
        let fallbackId = 'rt_deluxe';
        let fallbackCode = 'DXL';
        if (cleanRoomNum.startsWith('2')) {
          fallbackName = 'SUPIRIOR';
          fallbackId = 'rt_supirior';
          fallbackCode = 'SUP';
        } else if (cleanRoomNum.startsWith('3')) {
          fallbackName = 'DOUBLE SIGNLE';
          fallbackId = 'rt_double_single';
          fallbackCode = 'DS';
        }
        payload.roomNumber = cleanRoomNum;
        payload.roomTypeId = matchedRt ? matchedRt.id : fallbackId;
        payload.roomTypeCode = matchedRt ? (matchedRt.code || fallbackCode) : fallbackCode;
        payload.roomTypeName = matchedRt ? matchedRt.name : fallbackName;
        payload.roomType = payload.roomTypeName;
      }

      if (collectionName === 'roomTypes') {
        const cleanId = String(data.id || docId || '').trim();
        const cleanName = String(data.name || '').trim();
        const cleanCode = String(data.code || '').trim().toUpperCase();
        const assigned = (this.rooms || []).filter((r) =>
          r.roomTypeId === cleanId ||
          r.roomTypeId === cleanCode ||
          String(r.roomTypeName || r.roomType || '').toLowerCase() === cleanName.toLowerCase()
        );
        payload.id = cleanId;
        payload.name = cleanName;
        payload.code = cleanCode;
        payload.assignedRoomsCount = assigned.length;
        payload.assignedRoomNumbers = assigned.map((r) => String(r.roomNumber || '').replace(/^rm_/, '')).filter(Boolean);
      }

      if (collectionName === 'reservations') {
        let matchedRoom = null;
        if (data.roomId || data.roomNumber) {
          matchedRoom = (this.rooms || []).find((rm) =>
            rm.id === data.roomId ||
            String(rm.roomNumber) === String(data.roomNumber) ||
            rm.id === data.roomNumber
          );
        }
        const effectiveRoomTypeId = matchedRoom ? matchedRoom.roomTypeId : data.roomTypeId;
        const matchedRt = (this.roomTypes || []).find((rt) =>
          rt.id === effectiveRoomTypeId ||
          rt.code === effectiveRoomTypeId ||
          rt.name?.toLowerCase() === String(effectiveRoomTypeId || '').toLowerCase() ||
          (data.roomTypeName && rt.name?.toLowerCase() === String(data.roomTypeName).toLowerCase())
        );

        if (matchedRoom) {
          payload.roomId = matchedRoom.id;
          payload.roomNumber = String(matchedRoom.roomNumber).replace(/^rm_/, '');
        }
        if (matchedRt) {
          payload.roomTypeId = matchedRt.id;
          payload.roomTypeCode = matchedRt.code || '';
          payload.roomTypeName = matchedRt.name;
          payload.roomType = matchedRt.name;
        }
      }

      // 1. Nested under property subcollection (Primary PMS Cloud Store)
      const nestedRef = doc(db, 'properties', this.propertyId, collectionName, String(docId));
      await setDoc(nestedRef, payload, { merge: true });

      // 2. Also keep root collection mirror updated with exact info for rooms, roomTypes, reservations, and nightAudits
      if (['rooms', 'roomTypes', 'reservations', 'nightAudits'].includes(collectionName)) {
        try {
          const rootRef = doc(db, collectionName, String(docId));
          await setDoc(rootRef, payload, { merge: true });
        } catch (_) {}
      }

      console.info(`🔥 [Firebase Cloud] Successfully stored ${collectionName}/${docId} with exact info in Cloud Firestore.`);
      return true;
    } catch (err) {
      console.warn(`[Firebase Sync Note] Could not write to ${collectionName}/${docId}:`, err.message);
      return false;
    }
  }

  async purgeObsoleteRoomsAndTypesFromCloud() {
    if (!db) return;
    try {
      console.info('🔥 [Firebase Cloud] Checking and purging obsolete room types and non-canonical rooms...');
      const batch = writeBatch(db);
      let purgeCount = 0;

      // 1. Obsolete room types to delete
      const obsoleteRtIds = [
        'rt_standard', 'rt_normal', 'rt_ultra_premium', 'rt_premium',
        'Standard', 'Normal', 'Ultra Premium', 'Premium',
        'standard', 'normal', 'ultra_premium', 'premium'
      ];
      obsoleteRtIds.forEach((id) => {
        const nestedRef = doc(db, 'properties', this.propertyId, 'roomTypes', id);
        batch.delete(nestedRef);
        const rootRef = doc(db, 'roomTypes', id);
        batch.delete(rootRef);
        purgeCount += 2;
      });

      // 2. Obsolete room documents to delete (such as 501, rm_501, and non-canonical duplicate 205 documents)
      const obsoleteRoomIds = ['501', 'rm_501', '205', 'room_205', 'rm_205_deluxe', 'rm_205_dx'];
      obsoleteRoomIds.forEach((id) => {
        const nestedRef = doc(db, 'properties', this.propertyId, 'rooms', id);
        batch.delete(nestedRef);
        const rootRef = doc(db, 'rooms', id);
        batch.delete(rootRef);
        purgeCount += 2;
      });

      // 3. Obsolete dummy rate plans to delete (such as test plan / 132)
      const obsoleteRatePlanIds = ['132', 'rp_test_plan'];
      obsoleteRatePlanIds.forEach((id) => {
        const nestedRef = doc(db, 'properties', this.propertyId, 'ratePlans', id);
        batch.delete(nestedRef);
        const rootRef = doc(db, 'ratePlans', id);
        batch.delete(rootRef);
        purgeCount += 2;
      });

      await batch.commit();
      console.info(`🔥 [Firebase Cloud] Obsolete room purge committed (${purgeCount} targets removed).`);
    } catch (err) {
      console.warn('[Firebase Cloud] Obsolete room purge note:', err?.message);
    }
  }

  async syncAllRoomsAndTypesToCloud() {
    if (!db) return;
    try {
      this.canonicalizeRoomsAndRoomTypes();
      // Only update master property document with full room & roomType summary
      // Never overwrite physical room documents in batch to strictly prevent resurrecting deleted rooms!
      const propRef = doc(db, 'properties', this.propertyId);
      const summaryPayload = this.cleanDataForFirestore({
        totalRooms: (this.rooms || []).length,
        roomNumbers: (this.rooms || []).map((r) => String(r.roomNumber || '').replace(/^rm_/, '')).filter(Boolean),
        roomTypesSummary: (this.roomTypes || []).map((rt) => ({
          id: rt.id,
          name: rt.name,
          code: rt.code || '',
          count: (this.rooms || []).filter((r) => r.roomTypeId === rt.id || r.roomTypeId === rt.code).length
        })),
        lastSyncedAt: new Date().toISOString()
      });
      await setDoc(propRef, summaryPayload, { merge: true });
      console.info('🔥 [Firebase Cloud] Synchronized property room count and room types summary.');
    } catch (err) {
      console.warn('[Firebase Sync Note] Could not update room summary:', err?.message);
    }
  }

  async deleteDocFromFirestore(collectionName, docId) {
    if (!docId || !collectionName || !db) return;
    const cleanDocId = String(docId).trim();
    if (!cleanDocId) return;

    if (!this.inFlightDeletes) this.inFlightDeletes = new Set();
    const deleteKey = `${collectionName}/${cleanDocId}`;
    if (this.inFlightDeletes.has(deleteKey)) {
      return;
    }
    this.inFlightDeletes.add(deleteKey);

    try {
      const nestedRef = doc(db, 'properties', this.propertyId, collectionName, cleanDocId);
      const rootRef = doc(db, collectionName, cleanDocId);
      await Promise.allSettled([
        deleteDoc(nestedRef).catch((e) => console.warn(`[Firebase] Could not delete nested ${collectionName}/${cleanDocId}:`, e.message)),
        deleteDoc(rootRef).catch((e) => console.warn(`[Firebase] Could not delete root ${collectionName}/${cleanDocId}:`, e.message))
      ]);
      console.info(`🔥 [Firebase Cloud] Deleted ${collectionName}/${cleanDocId}`);
    } catch (err) {
      console.warn(`[Firebase Sync Note] Could not delete ${collectionName}/${cleanDocId}:`, err.message);
    } finally {
      setTimeout(() => {
        this.inFlightDeletes?.delete(deleteKey);
      }, 3000);
    }
  }

  async recordCloudDeletion(type, ids) {
    if (!db || !ids || !ids.length) return;
    try {
      const delRef = doc(db, 'properties', this.propertyId, 'metadata', 'deletions');
      const cleanIds = ids.map((id) => String(id || '').trim().toLowerCase()).filter(Boolean);
      if (cleanIds.length === 0) return;
      await setDoc(
        delRef,
        {
          [type]: arrayUnion(...cleanIds),
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
      console.info(`🔥 [Firebase Cloud] Recorded ${type} deletion tombstone for [${cleanIds.join(', ')}]`);
    } catch (e) {
      console.warn('[Firebase Cloud] Note recording deletion tombstone:', e?.message);
    }
  }

  async recordCloudRestoration(type, ids) {
    if (!db || !ids || !ids.length) return;
    try {
      const delRef = doc(db, 'properties', this.propertyId, 'metadata', 'deletions');
      const cleanIds = ids.map((id) => String(id || '').trim().toLowerCase()).filter(Boolean);
      if (cleanIds.length === 0) return;
      await setDoc(
        delRef,
        {
          [type]: arrayRemove(...cleanIds),
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
      console.info(`🔥 [Firebase Cloud] Removed ${type} deletion tombstone for [${cleanIds.join(', ')}]`);
    } catch (e) {
      console.warn('[Firebase Cloud] Note removing deletion tombstone:', e?.message);
    }
  }

  async purgeMatchingCloudRooms(roomId, roomNumKey) {
    if (!db) return;
    const cleanNum = String(roomNumKey || '').trim().toLowerCase();
    const cleanId = String(roomId || '').trim().toLowerCase();
    try {
      const batch = writeBatch(db);
      let count = 0;

      // 1. Sweep properties/{propertyId}/rooms subcollection
      try {
        const snap = await getDocs(collection(db, 'properties', this.propertyId, 'rooms'));
        snap.forEach((d) => {
          const data = d.data() || {};
          const dIdLower = String(d.id || '').trim().toLowerCase();
          const dataIdLower = String(data.id || '').trim().toLowerCase();
          const dataNumKey = String(data.roomNumber || data.id || d.id || '')
            .trim()
            .toLowerCase()
            .replace(/^rm_/, '');
          if (
            (cleanId && (dIdLower === cleanId || dataIdLower === cleanId)) ||
            (cleanNum && (dataNumKey === cleanNum || dIdLower === `rm_${cleanNum}` || dIdLower === cleanNum))
          ) {
            batch.delete(d.ref);
            count++;
          }
        });
      } catch (_) {}

      // 2. Sweep root collection 'rooms'
      try {
        const rootSnap = await getDocs(collection(db, 'rooms'));
        rootSnap.forEach((d) => {
          const data = d.data() || {};
          const dIdLower = String(d.id || '').trim().toLowerCase();
          const dataIdLower = String(data.id || '').trim().toLowerCase();
          const dataNumKey = String(data.roomNumber || data.id || d.id || '')
            .trim()
            .toLowerCase()
            .replace(/^rm_/, '');
          if (
            (cleanId && (dIdLower === cleanId || dataIdLower === cleanId)) ||
            (cleanNum && (dataNumKey === cleanNum || dIdLower === `rm_${cleanNum}` || dIdLower === cleanNum))
          ) {
            batch.delete(d.ref);
            count++;
          }
        });
      } catch (_) {}

      if (count > 0) {
        await batch.commit();
        console.info(`🔥 [Firebase Cloud] Batch purged ${count} room doc(s) across cloud collections.`);
      }
    } catch (err) {
      console.warn('[Firebase Sync Note] Room cloud sweep note:', err?.message);
    }
  }

  async purgeMatchingCloudRoomTypes(roomTypeId, rtCode, rtName, aliasSet = null) {
    if (!db) return;
    const aliases = new Set();
    if (aliasSet) {
      Array.from(aliasSet).forEach((a) => a && aliases.add(String(a).trim().toLowerCase()));
    }
    if (roomTypeId) aliases.add(String(roomTypeId).trim().toLowerCase());
    if (rtCode) aliases.add(String(rtCode).trim().toLowerCase());
    if (rtName) aliases.add(String(rtName).trim().toLowerCase());

    try {
      const snap = await getDocs(collection(db, 'properties', this.propertyId, 'roomTypes'));
      const batch = writeBatch(db);
      let count = 0;
      snap.forEach((d) => {
        const data = d.data() || {};
        const dIdLower = String(d.id || '').trim().toLowerCase();
        const dataIdLower = String(data.id || '').trim().toLowerCase();
        const dataCodeLower = String(data.code || '').trim().toLowerCase();
        const dataNameLower = String(data.name || '').trim().toLowerCase();
        if (
          aliases.has(dIdLower) ||
          aliases.has(dataIdLower) ||
          aliases.has(dataCodeLower) ||
          aliases.has(dataNameLower)
        ) {
          batch.delete(d.ref);
          count++;
        }
      });

      // Also clean root roomTypes collection if present
      try {
        const rootSnap = await getDocs(collection(db, 'roomTypes'));
        rootSnap.forEach((d) => {
          const data = d.data() || {};
          const dIdLower = String(d.id || '').trim().toLowerCase();
          const dataIdLower = String(data.id || '').trim().toLowerCase();
          const dataCodeLower = String(data.code || '').trim().toLowerCase();
          const dataNameLower = String(data.name || '').trim().toLowerCase();
          if (
            aliases.has(dIdLower) ||
            aliases.has(dataIdLower) ||
            aliases.has(dataCodeLower) ||
            aliases.has(dataNameLower)
          ) {
            batch.delete(d.ref);
            count++;
          }
        });
      } catch (_) {}

      if (count > 0) {
        await batch.commit();
        console.info(`🔥 [Firebase Cloud] Batch purged ${count} roomType doc(s)`);
      }
    } catch (err) {
      console.warn('[Firebase Sync Note] RoomType cloud sweep note:', err?.message);
    }
  }

  async syncAllToFirestore() {
    this.cloudStatus = 'SYNCING';
    this.notify();
    const result = await checkAndSeedFirestore(this.propertyId, true);
    if (result.success) {
      this.cloudStatus = 'LIVE';
    } else {
      this.cloudStatus = 'OFFLINE_CACHE';
    }
    this.notify();
    return result;
  }

  // --- AUDIT TRAIL ---

  logAudit(action, entity, entityId, details, actor = 'HOTEL NIVASA', meta = {}) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const fallbackRef = entity === 'RESERVATION' ? entityId : (meta?.bookingReference || meta?.reservationId || '');
    const resolvedResId = meta?.reservationId || fallbackRef;
    const resolvedBookingRef = meta?.bookingReference || fallbackRef;

    const entry = {
      id: `at_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp,
      createdAtMs: now.getTime(),
      actor: actor || 'HOTEL NIVASA',
      userName: actor || 'HOTEL NIVASA',
      action,
      entity,
      entityId,
      reservationId: resolvedResId,
      bookingReference: resolvedBookingRef,
      details,
      meta: meta || {}
    };
    if (!this.auditTrail) this.auditTrail = [];
    this.auditTrail = [entry, ...this.auditTrail.slice(0, 299)];

    // Also persist reservation-linked audit entries directly on the reservation document in Firestore
    if (resolvedResId || resolvedBookingRef) {
      const targetRes = (this.reservations || []).find(
        (r) =>
          (resolvedResId && r.id === resolvedResId) ||
          (resolvedBookingRef && r.bookingReference === resolvedBookingRef)
      );
      if (targetRes) {
        const existingLogs = Array.isArray(targetRes.auditLogs) ? targetRes.auditLogs : [];
        targetRes.auditLogs = [entry, ...existingLogs.filter((l) => l?.id !== entry.id).slice(0, 99)];
        this.syncDocToFirestore('reservations', targetRes.id, targetRes);
      }
    }

    // Async write to Firestore auditTrail collection
    this.syncDocToFirestore('auditTrail', entry.id, entry);
    return entry;
  }

  addAnnouncement(note) {
    if (!this.announcements) this.announcements = [];
    this.announcements.unshift(note);
    this.logAudit('CREATE_ANNOUNCEMENT', 'ANNOUNCEMENT', note.id, `Created staff note: "${note.message.substring(0, 30)}..."`, note.author || 'HOTEL NIVASA');
    this.save();
    this.syncDocToFirestore('announcements', note.id, note);
  }

  deleteAnnouncement(noteId) {
    if (!this.announcements) this.announcements = [];
    this.announcements = this.announcements.filter((n) => n.id !== noteId);
    this.logAudit('DELETE_ANNOUNCEMENT', 'ANNOUNCEMENT', noteId, 'Deleted staff note', 'HOTEL NIVASA');
    this.save();
    this.deleteDocFromFirestore('announcements', noteId);
  }

  // --- RESERVATIONS & BOOKING ENGINE ---

  async createReservation(bookingData) {
    let maxNum = 370;
    const considerNum = (valStr) => {
      const numMatch = String(valStr || '').match(/\d+/);
      if (numMatch) {
        const val = parseInt(numMatch[0], 10);
        if (val > maxNum && val < 999999) {
          maxNum = val;
        }
      }
    };
    (this.reservations || []).forEach(r => {
      considerNum(r.id);
      considerNum(r.bookingReference);
      considerNum(r._firestoreDocId);
    });
    Object.keys(this.folios || {}).forEach(fid => considerNum(fid));
    if (this.deletedReservationIds) {
      this.deletedReservationIds.forEach(delId => considerNum(delId));
    }

    let nextNum = Math.max(maxNum + 1, 378);
    const isIdTakenOrDeleted = (num) => {
      const cId = `res_${num}`;
      const cRef = `#RES_${num}`;
      const cFol = `fol_${num}`;
      if (this.deletedReservationIds) {
        if (
          this.deletedReservationIds.has(cId) ||
          this.deletedReservationIds.has(cRef) ||
          this.deletedReservationIds.has(cRef.toLowerCase())
        ) {
          return true;
        }
      }
      if ((this.reservations || []).some(r => r.id === cId || r.bookingReference === cRef)) {
        return true;
      }
      if (this.folios && this.folios[cFol]) {
        return true;
      }
      return false;
    };
    while (isIdTakenOrDeleted(nextNum)) {
      nextNum += 1;
    }

    const ref = `#RES_${nextNum}`;
    const id = `res_${nextNum}`;
    const folioId = `fol_${nextNum}`;
    if (this.deletedReservationIds) {
      this.deletedReservationIds.delete(id);
      this.deletedReservationIds.delete(ref);
      this.deletedReservationIds.delete(ref.toLowerCase());
    }
    const isUnassigned = !bookingData.roomId || bookingData.roomId === 'unassigned' || bookingData.roomId === '';
    const room = !isUnassigned
      ? this.rooms.find(
          r =>
            r.id === bookingData.roomId ||
            r.roomNumber === bookingData.roomId ||
            (bookingData.roomNumber && String(r.roomNumber) === String(bookingData.roomNumber)) ||
            (r.id && bookingData.roomId && r.id.replace(/^rm_/, '') === String(bookingData.roomId).replace(/^rm_/, ''))
        )
      : null;
    const roomNumber = isUnassigned ? '' : (bookingData.roomNumber || room?.roomNumber || bookingData.roomId || '');
    const finalRoomId = isUnassigned ? '' : (room?.id || bookingData.roomId);

    const taxCalc = calculateRoomTax(bookingData.baseRatePerNight, bookingData.nights, {
      isComplimentary: bookingData.isComplimentary,
      isTaxExempt: bookingData.isTaxExempt,
      isTaxInclusive: bookingData.isTaxInclusive,
      taxRules: this.taxRules
    });

    const totalRoomCharges =
      bookingData.totalRoomCharges !== undefined
        ? Number(bookingData.totalRoomCharges)
        : taxCalc.taxableAmount;
    const taxAmount =
      bookingData.taxAmount !== undefined ? Number(bookingData.taxAmount) : taxCalc.totalTax;
    const totalAmount =
      bookingData.totalAmount !== undefined
        ? Number(bookingData.totalAmount)
        : Math.round((totalRoomCharges + taxAmount) * 100) / 100;
    const paidAmount = Number(bookingData.advanceAmount !== undefined ? bookingData.advanceAmount : bookingData.paidAmount) || 0;
    const balanceDue = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);

    const checkInIso = normalizeDateStr(bookingData.checkInDate) ||
      (this.property?.businessDate || getTodayIsoDate());
    const checkOutIso = normalizeDateStr(bookingData.checkOutDate) ||
      getNextDayIsoDate(checkInIso);

    const liveTimeStr = getCurrentTimeString();
    const effectiveCheckInTime = bookingData.checkInTime || liveTimeStr;

    const newRes = {
      ...bookingData,
      id,
      bookingReference: ref,
      primaryGuest: {
        ...(bookingData.primaryGuest || {}),
        name: bookingData.guestName || bookingData.primaryGuest?.name || '',
        phone: bookingData.guestPhone || bookingData.primaryGuest?.phone || '',
        email: bookingData.guestEmail || bookingData.primaryGuest?.email || '',
        gstin: bookingData.guestGstin || bookingData.primaryGuest?.gstin || '',
        nationality: bookingData.nationality || bookingData.primaryGuest?.nationality || '',
        idType: bookingData.idType || bookingData.primaryGuest?.idType || '',
        idNumber: bookingData.idNumber || bookingData.primaryGuest?.idNumber || '',
        idDocumentUrl: bookingData.idDocumentUrl || bookingData.primaryGuest?.idDocumentUrl || '',
        address: bookingData.primaryGuest?.address || '',
        city: bookingData.primaryGuest?.city || '',
        state: bookingData.primaryGuest?.state || '',
        zip: bookingData.primaryGuest?.zip || '',
        country: bookingData.primaryGuest?.country || ''
      },
      roomId: finalRoomId,
      roomNumber,
      roomTypeId: room?.roomTypeId || bookingData.roomTypeId,
      roomTypeName: (room ? this.roomTypes.find(rt => rt.id === room.roomTypeId)?.name : null) || bookingData.roomTypeName || this.roomTypes.find(rt => rt.id === bookingData.roomTypeId)?.name || 'Normal',
      ratePlanCode: bookingData.ratePlanCode || 'BAR_CP',
      checkInDate: checkInIso,
      checkOutDate: checkOutIso,
      checkInTime: effectiveCheckInTime,
      actualCheckInTime: bookingData.actualCheckInTime || (bookingData.status === 'in_house' ? effectiveCheckInTime : undefined),
      arrivalTime: effectiveCheckInTime,
      checkOutTime: bookingData.checkOutTime || '11:00',
      roomsCount: bookingData.roomsCount || (bookingData.configuredRooms ? bookingData.configuredRooms.length : 1),
      nights: Number(bookingData.nights) || 1,
      adults: Number(bookingData.adults) || 1,
      children: Number(bookingData.children) || 0,
      baseRatePerNight: Number(bookingData.baseRatePerNight) || 0,
      totalRoomCharges,
      taxAmount,
      totalAmount,
      paidAmount,
      balanceDue,
      status: (bookingData.status || 'confirmed').toLowerCase(),
      billTo: bookingData.billTo || 'Guest',
      company: bookingData.company || '',
      guestGstin: bookingData.guestGstin || bookingData.primaryGuest?.gstin || '',
      bookingSource: (bookingData.bookingSource || 'walk-in').toLowerCase(),
      marketSegment: (bookingData.marketSegment || 'corporate').toLowerCase(),
      isVIP: !!bookingData.isVIP,
      isSingleLady: !!bookingData.isSingleLady,
      noPosting: !!bookingData.noPosting,
      isComplimentary: !!bookingData.isComplimentary,
      specialRequests: bookingData.specialRequests || bookingData.notes || '',
      notes: bookingData.specialRequests || bookingData.notes || '',
      createdAt: (bookingData.createdAt && typeof bookingData.createdAt === 'string')
        ? bookingData.createdAt
        : (bookingData.createdAt instanceof Date ? bookingData.createdAt.toISOString() : new Date().toISOString()),
      updatedAt: new Date().toISOString(),
      bookingDate: bookingData.bookingDate || checkInIso || getTodayIsoDate(),
      bookingTime: bookingData.bookingTime || getCurrentTimeString(),
      bookingDateFormatted: bookingData.bookingDateFormatted || formatBookingDateTime(bookingData.createdAt || new Date()),
      folioId
    };

    // Initialize Folio with transactions
    const transactions = [];

    // Debit for room tariff per night
    const startDate = new Date(checkInIso);
    for (let i = 0; i < newRes.nights; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const dailyBase = Math.round((totalRoomCharges / newRes.nights) * 100) / 100;
      const dailyTax = Math.round((taxAmount / newRes.nights) * 100) / 100;
      transactions.push({
        id: `tx_${Date.now()}_${i}`,
        date: iso,
        type: 'ROOM_CHARGE',
        desc: `Room Tariff - Room ${roomNumber}`,
        amount: dailyBase,
        tax: dailyTax,
        taxRate: taxCalc.gstRate,
        isTaxInclusive: Boolean(bookingData.isTaxInclusive),
        direction: 'DEBIT'
      });
    }

    // Credit if advance was paid
    if (paidAmount > 0) {
      const operationalDate = (this.property?.businessDate && this.property.businessDate >= getTodayIsoDate())
        ? this.property.businessDate
        : getTodayIsoDate();
      transactions.push({
        id: `tx_adv_${Date.now()}`,
        date: operationalDate || checkInIso,
        particulars: 'Payment',
        category: 'Payment',
        type: 'PAYMENT',
        paymentMethod: bookingData.paymentMethod || 'UPI',
        paymentReference: bookingData.paymentReference || 'Direct',
        desc: `Advance Payment (${bookingData.paymentMethod || 'UPI'}) Ref: ${bookingData.paymentReference || 'Direct'}`,
        amount: -paidAmount,
        tax: 0,
        direction: 'CREDIT'
      });
    }

    const newFolio = {
      folioNumber: `FOL_${nextNum}`,
      reservationId: id,
      roomNumber,
      status: balanceDue <= 0 ? 'SETTLED' : 'OPEN',
      transactions
    };

    this.folios[folioId] = newFolio;
    this.reservations = [newRes, ...this.reservations];

    // Find and update the room state in inventory
    const allocatedRoomIds = new Set();
    if (newRes.roomId && newRes.roomId !== 'unassigned') allocatedRoomIds.add(newRes.roomId);
    if (roomNumber) allocatedRoomIds.add(roomNumber);
    if (Array.isArray(bookingData.configuredRooms)) {
      bookingData.configuredRooms.forEach(cr => {
        if (cr.roomId && cr.roomId !== 'unassigned') allocatedRoomIds.add(cr.roomId);
        if (cr.roomNumber) allocatedRoomIds.add(cr.roomNumber);
      });
    }

    const isCheckIn = (bookingData.status || '').toLowerCase() === 'in_house' || bookingData.isCheckIn;
    if (isCheckIn) {
      if (!newRes.checkedInAt) {
        newRes.checkedInAt = new Date().toISOString();
      }
      newRes.actualCheckInTime = effectiveCheckInTime;
      newRes.checkInTime = effectiveCheckInTime;
      newRes.arrivalTime = effectiveCheckInTime;
    }

    const updatedRooms = [];
    if (allocatedRoomIds.size > 0) {
      this.rooms = this.rooms.map(r => {
        if (allocatedRoomIds.has(r.id) || allocatedRoomIds.has(r.roomNumber)) {
          const up = {
            ...r,
            currentReservationId: id,
            currentGuestName: newRes.primaryGuest.name,
            operational: isCheckIn ? 'occupied' : 'allocated',
            status: isCheckIn ? (r.status === 'dirty' ? 'clean' : r.status) : (r.status || 'clean'),
            updatedAt: new Date().toISOString()
          };
          updatedRooms.push(up);
          return up;
        }
        return r;
      });
    }

    // 1. Log Reservation Created
    this.logAudit(
      'CREATE_RESERVATION',
      'RESERVATION',
      ref,
      `Created booking for ${newRes.primaryGuest.name} in Room ${roomNumber || 'Unassigned'} (${newRes.nights} Nights). Total: ₹${totalAmount}${paidAmount > 0 ? `, Advance Paid: ₹${paidAmount}` : ''}`,
      'HOTEL NIVASA',
      {
        actionType: 'RESERVATION_CREATED',
        reservationId: id,
        bookingReference: ref,
        guestName: newRes.primaryGuest.name,
        stayDates: `${newRes.checkInDate} → ${newRes.checkOutDate}`,
        nights: newRes.nights,
        rooms: newRes.roomsCount,
        totalAmount: totalAmount,
        advanceAmount: paidAmount,
        advancePaid: paidAmount,
        paidAmount: paidAmount,
        bookingSource: newRes.bookingSource,
        status: newRes.status.toUpperCase(),
        affectedDates: [newRes.checkInDate]
      }
    );

    // 2. Log Room Assigned if room is allocated
    if (roomNumber) {
      this.logAudit(
        'ROOM_ASSIGNED',
        'RESERVATION',
        ref,
        `Room assigned: UNASSIGNED → ${roomNumber}`,
        'HOTEL NIVASA',
        {
          actionType: 'ROOM_ASSIGNED',
          reservationId: id,
          bookingReference: ref,
          oldRoom: 'UNASSIGNED',
          newRoom: roomNumber,
          affectedDates: [newRes.checkInDate]
        }
      );
    }

    // 3. Log Guest Checked In if checking in immediately
    if (isCheckIn) {
      this.logAudit(
        'CHECK_IN',
        'RESERVATION',
        ref,
        `Guest ${newRes.primaryGuest.name} checked in to Room ${roomNumber || 'Assigned'}.`,
        'HOTEL NIVASA',
        {
          actionType: 'GUEST_CHECKED_IN',
          reservationId: id,
          bookingReference: ref,
          oldStatus: 'RESERVED',
          newStatus: 'CHECKED_IN',
          roomNumber: roomNumber,
          affectedDates: [newRes.checkInDate]
        }
      );
    }

    // 4. Log Advance Payment if advance was paid
    if (paidAmount > 0) {
      const advMethod = bookingData.paymentMethod || 'UPI';
      const advRef = bookingData.paymentReference || 'Direct';
      this.logAudit(
        'ADD_PAYMENT',
        'RESERVATION',
        ref,
        `Advance payment of ₹${Number(paidAmount).toFixed(2)} received via ${advMethod}. Ref: ${advRef}`,
        'HOTEL NIVASA',
        {
          actionType: 'PAYMENT_ADDED',
          reservationId: id,
          bookingReference: ref,
          isAdvance: true,
          paymentMethod: advMethod,
          paymentType: 'Advance Payment',
          amount: Number(paidAmount),
          voucherNumber: advRef,
          date: newRes.checkInDate || getTodayIsoDate(),
          affectedDates: [newRes.checkInDate || getTodayIsoDate()]
        }
      );
    }

    this.save();
    this.notify();

    // 1. Store in Cloud Firestore in background (non-blocking) so reservation creation & check-in completes instantly
    const guestPhoneClean = (newRes.primaryGuest.phone || '').replace(/[^0-9]/g, '');
    const guestId = `gst_${guestPhoneClean || Date.now()}`;
    const guestDoc = {
      id: guestId,
      name: newRes.primaryGuest.name,
      title: newRes.primaryGuest.title || '',
      firstName: newRes.primaryGuest.firstName || '',
      lastName: newRes.primaryGuest.lastName || '',
      phone: newRes.primaryGuest.phone,
      email: newRes.primaryGuest.email || '',
      nationality: newRes.primaryGuest.nationality || '',
      idType: newRes.primaryGuest.idType || '',
      idNumber: newRes.primaryGuest.idNumber || '',
      idDocumentUrl: newRes.primaryGuest.idDocumentUrl || '',
      address: newRes.primaryGuest.address || '',
      city: newRes.primaryGuest.city || '',
      state: newRes.primaryGuest.state || '',
      zip: newRes.primaryGuest.zip || '',
      gstin: newRes.primaryGuest.gstin || '',
      totalStays: 1,
      totalSpent: totalAmount,
      recentBookingRef: ref,
      lastStayDate: newRes.checkInDate,
      activeRoom: roomNumber,
      status: newRes.status,
      updatedAt: new Date().toISOString()
    };

    Promise.allSettled([
      this.syncDocToFirestore('reservations', id, newRes),
      this.syncDocToFirestore('folios', folioId, newFolio),
      ...updatedRooms.map((upRm) => this.syncDocToFirestore('rooms', upRm.id, upRm)),
      this.syncDocToFirestore('guests', guestId, guestDoc)
    ]).then(() => {
      console.info(`🔥 [Firebase Cloud] Successfully stored Reservation ${ref}, Room ${roomNumber}, Folio ${folioId}, and Guest Profile in Cloud Firestore.`);
    }).catch((err) => {
      console.warn(`[Firebase Cloud Sync Note]:`, err);
    });

    return newRes;
  }

  updateReservation(resId, updatedFields) {
    if (!resId) return null;
    const cleanId = typeof resId === 'object' ? (resId?.id || resId?.bookingReference) : resId;
    const cleanStr = String(cleanId || '').trim();
    const cleanNum = cleanStr.replace(/[^0-9]/g, '');

    const idx = this.reservations.findIndex((r) => {
      if (!r) return false;
      if (r.id === cleanStr || r.bookingReference === cleanStr) return true;
      if (String(r.id).toLowerCase() === cleanStr.toLowerCase()) return true;
      if (String(r.bookingReference).toLowerCase() === cleanStr.toLowerCase()) return true;
      if (cleanNum && (r.id === `res_${cleanNum}` || r.bookingReference === `#RES_${cleanNum}`)) return true;
      return false;
    });

    if (idx !== -1) {
      const target = this.reservations[idx];
      const statusNorm = (target.status || '').toLowerCase().replace(/[\s-]/g, '_');
      if (statusNorm === 'cancelled') {
        console.warn(`[PMSStore] Cannot modify cancelled reservation ${resId}. Details are locked.`);
        return null;
      }
      if (statusNorm === 'no_show') {
        console.warn(`[PMSStore] Cannot modify no-show reservation ${resId}. Details are locked.`);
        return null;
      }
      if (statusNorm === 'checked_out') {
        console.warn(`[PMSStore] Cannot modify checked-out reservation ${resId}. Details are locked.`);
        return null;
      }
      const fieldsToApply = { ...updatedFields };
      if (fieldsToApply.checkInTime) {
        fieldsToApply.actualCheckInTime = fieldsToApply.checkInTime;
        fieldsToApply.arrivalTime = fieldsToApply.checkInTime;
      }
      if (fieldsToApply.specialRequests !== undefined) {
        fieldsToApply.notes = fieldsToApply.specialRequests;
      } else if (fieldsToApply.notes !== undefined) {
        fieldsToApply.specialRequests = fieldsToApply.notes;
      }
      if (fieldsToApply.guestGstin) {
        fieldsToApply.primaryGuest = {
          ...(this.reservations[idx].primaryGuest || {}),
          ...(fieldsToApply.primaryGuest || {}),
          gstin: fieldsToApply.guestGstin
        };
      }
      this.reservations[idx] = {
        ...this.reservations[idx],
        ...fieldsToApply,
        updatedAt: new Date().toISOString()
      };
      const updated = this.reservations[idx];
      this.logAudit('UPDATE_RESERVATION', 'RESERVATION', updated.bookingReference || updated.id, `Updated reservation details for ${updated.primaryGuest?.name || updated.guestName || updated.id}`, 'HOTEL NIVASA');
      this.save();
      this.syncDocToFirestore('reservations', updated.id, updated);
      this.notify();
      return updated;
    }
    return null;
  }

  updateRoomTariffDetails(resId, {
    applyMode = 'whole_stay',
    selectedDate,
    selectedDateIso,
    roomId,
    roomNumber,
    ratePlanCode,
    ratePlanName,
    adults,
    children,
    rate,
    baseRatePerNight,
    overrideRate = false
  }) {
    if (!resId) return null;
    const cleanId = typeof resId === 'object' ? (resId?.id || resId?.bookingReference) : resId;
    const cleanStr = String(cleanId || '').trim();
    const cleanNum = cleanStr.replace(/[^0-9]/g, '');

    const idx = this.reservations.findIndex((r) => {
      if (!r) return false;
      if (r.id === cleanStr || r.bookingReference === cleanStr) return true;
      if (String(r.id).toLowerCase() === cleanStr.toLowerCase()) return true;
      if (String(r.bookingReference).toLowerCase() === cleanStr.toLowerCase()) return true;
      if (cleanNum && (r.id === `res_${cleanNum}` || r.bookingReference === `#RES_${cleanNum}`)) return true;
      return false;
    });

    if (idx === -1) return null;

    const res = this.reservations[idx];
    const statusNorm = (res.status || '').toLowerCase().replace(/[\s-]/g, '_');
    if (statusNorm === 'cancelled' || statusNorm === 'no_show' || statusNorm === 'checked_out') {
      console.warn(`[PMSStore] Cannot modify room charges on ${res.status} reservation ${resId}.`);
      return null;
    }

    const nowIso = new Date().toISOString();
    const nights = Math.max(1, Number(res.nights) || 1);
    const newRate = Number(rate !== undefined ? rate : baseRatePerNight) >= 0
      ? Number(rate !== undefined ? rate : baseRatePerNight)
      : (Number(res.baseRatePerNight) || 2500);

    const newAdults = Number(adults) > 0 ? Number(adults) : (res.adults || 1);
    const newChildren = Number(children) >= 0 ? Number(children) : (res.children || 0);

    let totalRoomCharges = 0;
    let taxAmount = 0;

    // Resolve room details if room changed
    let finalRoomId = res.roomId;
    let finalRoomNumber = res.roomNumber;
    let finalRoomTypeId = res.roomTypeId;

    if (roomId || roomNumber) {
      const targetRoom = this.rooms.find(
        (r) =>
          (roomId && r.id === roomId) ||
          (roomNumber && r.roomNumber === roomNumber) ||
          (roomId && r.roomNumber === roomId)
      );
      if (targetRoom) {
        finalRoomId = targetRoom.id;
        finalRoomNumber = targetRoom.roomNumber;
        finalRoomTypeId = targetRoom.roomTypeId || res.roomTypeId;
      }
    }

    // Update Folio and Room Charges
    if (res.folioId && this.folios[res.folioId]) {
      const folio = this.folios[res.folioId];
      folio.roomNumber = finalRoomNumber;

      const nonRoomCharges = (folio.transactions || []).filter((t) => t.type !== 'ROOM_CHARGE');
      let existingRoomCharges = (folio.transactions || []).filter((t) => t.type === 'ROOM_CHARGE');

      const startDt = new Date(res.checkInDate || Date.now());

      if (existingRoomCharges.length === 0) {
        for (let i = 0; i < nights; i++) {
          const d = new Date(startDt);
          d.setDate(d.getDate() + i);
          const iso = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : (res.checkInDate || '');
          const singleTax = calculateRoomTax(newRate, 1, {
            isComplimentary: res.isComplimentary,
            isTaxExempt: res.isTaxExempt
          });
          existingRoomCharges.push({
            id: `tx_rc_${res.id}_${i}`,
            date: iso,
            type: 'ROOM_CHARGE',
            category: 'Room (Room Rent / Accommodation)',
            desc: `Room Tariff - Room ${finalRoomNumber}`,
            amount: newRate,
            tax: Number(singleTax.totalTax) || 0,
            direction: 'DEBIT',
            isVoided: false
          });
        }
      }

      const cleanTargetDate = selectedDateIso || (selectedDate && (selectedDate.includes('/') ? selectedDate.split('/').reverse().join('-') : selectedDate));

      if (applyMode === 'selected_date' && cleanTargetDate) {
        existingRoomCharges = existingRoomCharges.map((rc, i) => {
          const rcIso = rc.date ? rc.date.split('T')[0] : '';
          if (rcIso === cleanTargetDate || rc.date === selectedDate || (i === 0 && !rc.date)) {
            const singleTax = calculateRoomTax(newRate, 1, {
              isComplimentary: res.isComplimentary,
              isTaxExempt: res.isTaxExempt
            });
            return {
              ...rc,
              amount: newRate,
              tax: Number(singleTax.totalTax) || 0
            };
          }
          return rc;
        });
      } else {
        // whole stay
        existingRoomCharges = existingRoomCharges.map((rc) => {
          const singleTax = calculateRoomTax(newRate, 1, {
            isComplimentary: res.isComplimentary,
            isTaxExempt: res.isTaxExempt
          });
          return {
            ...rc,
            amount: newRate,
            tax: Number(singleTax.totalTax) || 0
          };
        });
      }

      totalRoomCharges = existingRoomCharges.reduce((sum, rc) => sum + (Number(rc.amount) || 0), 0);
      taxAmount = existingRoomCharges.reduce((sum, rc) => sum + (Number(rc.tax) || 0), 0);

      folio.transactions = [...existingRoomCharges, ...nonRoomCharges];
      this.folios[res.folioId] = folio;
      this.recomputeFolioTotals(res.id);
      this.syncDocToFirestore('folios', res.folioId, this.folios[res.folioId]);
    } else {
      totalRoomCharges = newRate * nights;
      const taxCalc = calculateRoomTax(newRate, nights, {
        isComplimentary: res.isComplimentary,
        isTaxExempt: res.isTaxExempt
      });
      taxAmount = Number(taxCalc.totalTax) || 0;
    }

    const totalAmount = totalRoomCharges + taxAmount;
    const paidAmount = Number(res.paidAmount) || 0;
    const balanceDue = Math.max(0, totalAmount - paidAmount);

    const updatedRes = {
      ...res,
      roomId: finalRoomId,
      roomNumber: finalRoomNumber,
      roomTypeId: finalRoomTypeId,
      adults: newAdults,
      children: newChildren,
      baseRatePerNight: applyMode === 'whole_stay' ? newRate : (res.baseRatePerNight || newRate),
      ratePerNight: applyMode === 'whole_stay' ? newRate : (res.ratePerNight || newRate),
      rate: applyMode === 'whole_stay' ? newRate : (res.rate || newRate),
      totalRoomCharges,
      taxAmount,
      totalAmount,
      paidAmount,
      balanceDue,
      updatedAt: nowIso
    };

    this.reservations[idx] = updatedRes;

    this.logAudit(
      'UPDATE_ROOM_CHARGES',
      'RESERVATION',
      updatedRes.bookingReference || updatedRes.id,
      `Updated room charges for ${updatedRes.primaryGuest?.name || 'Guest'}: ${applyMode === 'selected_date' ? `Date ${selectedDate}` : 'Whole Stay'}, Rate ₹${newRate}, Pax ${newAdults}/${newChildren}. Total ₹${totalAmount}.`,
      'HOTEL NIVASA',
      {
        actionType: 'RATE_OVERRIDDEN',
        reservationId: updatedRes.id,
        bookingReference: updatedRes.bookingReference,
        date: selectedDateIso || selectedDate || updatedRes.checkInDate,
        oldAmount: res.baseRatePerNight,
        newAmount: newRate,
        oldTax: 0,
        newTax: taxAmount,
        affectedDates: [selectedDateIso || selectedDate || updatedRes.checkInDate].filter(Boolean)
      }
    );

    this.save();
    this.syncDocToFirestore('reservations', updatedRes.id, updatedRes);
    this.notify();
    return updatedRes;
  }

  async amendStay(resId, { checkInDate, checkOutDate, nights, roomId, roomNumber }) {
    if (!resId) return null;
    const cleanId = typeof resId === 'object' ? (resId?.id || resId?.bookingReference) : resId;
    const cleanStr = String(cleanId || '').trim();
    const cleanNum = cleanStr.replace(/[^0-9]/g, '');

    const idx = this.reservations.findIndex((r) => {
      if (!r) return false;
      if (r.id === cleanStr || r.bookingReference === cleanStr) return true;
      if (String(r.id).toLowerCase() === cleanStr.toLowerCase()) return true;
      if (String(r.bookingReference).toLowerCase() === cleanStr.toLowerCase()) return true;
      if (cleanNum && (r.id === `res_${cleanNum}` || r.bookingReference === `#RES_${cleanNum}`)) return true;
      return false;
    });

    if (idx === -1) return null;

    const res = this.reservations[idx];
    const newNights = Number(nights) || 1;
    const baseRate = Number(res.baseRatePerNight) || 2500;
    const totalRoomCharges = baseRate * newNights;

    // Recalculate taxes
    const taxCalc = calculateRoomTax(baseRate, newNights, {
      isComplimentary: res.isComplimentary,
      isTaxExempt: res.isTaxExempt
    });
    const taxAmount = Number(taxCalc.totalTax) || 0;
    const totalAmount = totalRoomCharges + taxAmount;
    const paidAmount = Number(res.paidAmount) || 0;
    const balanceDue = Math.max(0, totalAmount - paidAmount);

    let finalRoomId = res.roomId;
    let finalRoomNumber = res.roomNumber;
    let finalRoomTypeId = res.roomTypeId;

    if (roomId || roomNumber) {
      const targetRoom = this.rooms.find(
        (r) =>
          (roomId && r.id === roomId) ||
          (roomNumber && r.roomNumber === roomNumber) ||
          (roomId && r.roomNumber === roomId)
      );
      if (targetRoom) {
        finalRoomId = targetRoom.id;
        finalRoomNumber = targetRoom.roomNumber;
        finalRoomTypeId = targetRoom.roomTypeId || res.roomTypeId;

        // Reallocate room status in inventory
        const oldRoomId = res.roomId;
        const nowIso = new Date().toISOString();
        this.rooms = this.rooms.map((r) => {
          if (r.id === targetRoom.id) {
            return {
              ...r,
              currentReservationId: res.id,
              currentGuestName: res.primaryGuest?.name || res.guestName,
              operational: res.status === 'in_house' ? 'occupied' : 'allocated',
              updatedAt: nowIso
            };
          }
          if (oldRoomId && r.id === oldRoomId && r.id !== targetRoom.id) {
            return {
              ...r,
              currentReservationId: null,
              currentGuestName: '',
              operational: 'available',
              updatedAt: nowIso
            };
          }
          return r;
        });
      }
    }

    const nowIso = new Date().toISOString();
    const updatedRes = {
      ...res,
      checkInDate,
      checkOutDate,
      nights: newNights,
      roomId: finalRoomId,
      roomNumber: finalRoomNumber,
      roomTypeId: finalRoomTypeId,
      totalRoomCharges,
      taxAmount,
      totalAmount,
      balanceDue,
      updatedAt: nowIso
    };

    this.reservations[idx] = updatedRes;

    // Regenerate nightly room charges on folio
    if (res.folioId && this.folios[res.folioId]) {
      const folio = this.folios[res.folioId];
      const nonRoomCharges = (folio.transactions || []).filter((t) => t.type !== 'ROOM_CHARGE');
      const newRoomCharges = [];
      const startDt = new Date(checkInDate);
      const dailyTax = Math.round(taxAmount / newNights);

      for (let i = 0; i < newNights; i++) {
        const d = new Date(startDt);
        d.setDate(d.getDate() + i);
        const iso = d.toISOString().split('T')[0];
        newRoomCharges.push({
          id: `tx_amend_${Date.now()}_${i}`,
          date: iso,
          type: 'ROOM_CHARGE',
          category: 'Room (Room Rent / Accommodation)',
          desc: `Room Tariff - Room ${finalRoomNumber}`,
          amount: baseRate,
          tax: dailyTax,
          direction: 'DEBIT',
          isVoided: false
        });
      }

      folio.transactions = [...newRoomCharges, ...nonRoomCharges];
      folio.roomNumber = finalRoomNumber;
      this.folios[res.folioId] = folio;
      this.recomputeFolioTotals(res.id);
      this.syncDocToFirestore('folios', res.folioId, this.folios[res.folioId]);
    }

    this.logAudit(
      'AMEND_STAY',
      'RESERVATION',
      updatedRes.bookingReference || updatedRes.id,
      `Amended stay for ${updatedRes.primaryGuest?.name || 'Guest'} to ${checkInDate} - ${checkOutDate} (${newNights} Nights). Room ${finalRoomNumber}, Total ₹${totalAmount}.`,
      'HOTEL NIVASA',
      {
        actionType: 'STAY_EXTENDED',
        reservationId: updatedRes.id,
        bookingReference: updatedRes.bookingReference,
        oldDates: `${res.checkInDate} → ${res.checkOutDate}`,
        newDates: `${checkInDate} → ${checkOutDate}`,
        affectedDates: [checkInDate, checkOutDate].filter(Boolean)
      }
    );

    this.save();
    this.syncDocToFirestore('reservations', updatedRes.id, updatedRes);
    this.notify();
    return updatedRes;
  }

  assignRoom(resId, targetRoomId) {
    if (!resId) return false;
    const cleanId = typeof resId === 'object' ? (resId?.id || resId?.bookingReference) : resId;
    const cleanStr = String(cleanId || '').trim();
    const cleanNum = cleanStr.replace(/[^0-9]/g, '');

    const res = this.reservations.find(r => {
      if (!r) return false;
      if (r.id === cleanStr || r.bookingReference === cleanStr) return true;
      if (String(r.id).toLowerCase() === cleanStr.toLowerCase()) return true;
      if (String(r.bookingReference).toLowerCase() === cleanStr.toLowerCase()) return true;
      if (cleanNum && (r.id === `res_${cleanNum}` || r.bookingReference === `#RES_${cleanNum}`)) return true;
      return false;
    });

    const room = this.rooms.find(r => r.id === targetRoomId || r.roomNumber === targetRoomId);
    if (!res || !room) return false;
    const statusNorm = (res.status || '').toLowerCase().replace(/[\s-]/g, '_');
    if (statusNorm === 'checked_out' || statusNorm === 'cancelled' || statusNorm === 'no_show') {
      console.warn(`[PMSStore] Cannot reassign room on ${res.status} reservation ${resId}.`);
      return false;
    }

    // Check if room is currently occupied by another in-house reservation
    const otherInHouse = this.reservations.find(r => {
      if (!r || r.status !== 'in_house') return false;
      if (r.id === res.id || r.bookingReference === res.bookingReference) return false;
      return (r.roomId && (r.roomId === room.id || r.roomId === room.roomNumber)) ||
             (r.roomNumber && (r.roomNumber === room.roomNumber || r.roomNumber === room.id));
    });

    if (otherInHouse) {
      const occupant = otherInHouse.primaryGuest?.name || otherInHouse.guestName || 'another guest';
      console.warn(`[PMSStore] Cannot assign room: Room ${room.roomNumber} is full (occupied by ${occupant}).`);
      alert(`Cannot assign: Room ${room.roomNumber} is FULL (currently occupied by ${occupant}).`);
      return false;
    }

    const nowIso = new Date().toISOString();
    const targetId = res.id;
    const targetRef = res.bookingReference || `#${targetId}`;
    const guestName = res.primaryGuest?.name || res.guestName || 'Guest';

    const targetRt = this.roomTypes.find(rt => rt.id === room.roomTypeId || rt.name?.toLowerCase() === String(room.roomTypeId).toLowerCase());
    const updatedRoomTypeId = room.roomTypeId || res.roomTypeId;
    const updatedRoomTypeName = targetRt?.name || res.roomTypeName || 'Normal';

    this.reservations = this.reservations.map(r =>
      (r.id === targetId || r.bookingReference === targetRef)
        ? {
            ...r,
            roomId: room.id,
            roomNumber: room.roomNumber,
            roomTypeId: updatedRoomTypeId,
            roomTypeName: updatedRoomTypeName,
            updatedAt: nowIso
          }
        : r
    );

    if (res.folioId && this.folios[res.folioId]) {
      this.folios[res.folioId].roomNumber = room.roomNumber;
      this.folios[res.folioId].updatedAt = nowIso;
      this.syncDocToFirestore('folios', res.folioId, this.folios[res.folioId]);
    }

    this.logAudit(
      'ROOM_ASSIGNED',
      'RESERVATION',
      targetRef,
      `Assigned Room ${room.roomNumber} (${room.status.toUpperCase()}) to ${guestName}.`
    );

    this.save();
    const updatedRes = this.getReservation(targetId) || this.getReservation(targetRef);
    if (updatedRes) {
      this.syncDocToFirestore('reservations', targetId, updatedRes);
    }
    this.syncAllRoomsAndTypesToCloud();
    this.notify();
    return true;
  }

  checkInReservation(resId, assignedRoomId = null) {
    if (!resId) return false;
    const cleanId = typeof resId === 'object' ? (resId?.id || resId?.bookingReference) : resId;
    const cleanStr = String(cleanId || '').trim();
    const cleanNum = cleanStr.replace(/[^0-9]/g, '');

    const res = this.reservations.find(r => {
      if (!r) return false;
      if (r.id === cleanStr || r.bookingReference === cleanStr) return true;
      if (String(r.id).toLowerCase() === cleanStr.toLowerCase()) return true;
      if (String(r.bookingReference).toLowerCase() === cleanStr.toLowerCase()) return true;
      if (cleanStr.startsWith('#') && r.bookingReference === cleanStr) return true;
      if (!cleanStr.startsWith('#') && r.bookingReference === `#${cleanStr}`) return true;
      if (cleanNum && (r.id === `res_${cleanNum}` || r.bookingReference === `#RES_${cleanNum}`)) return true;
      return false;
    });

    if (!res) {
      console.warn(`[PMSStore] Cannot find reservation ${cleanStr} for check-in.`);
      return false;
    }

    const statusNorm = (res.status || '').toLowerCase().replace(/[\s-]/g, '_');
    if (statusNorm === 'cancelled' || statusNorm === 'no_show' || statusNorm === 'checked_out') {
      console.warn(`[PMSStore] Cannot check-in ${res.status} reservation ${res.bookingReference || cleanStr}.`);
      return false;
    }

    let targetRoomId = assignedRoomId || res.roomId;
    let room = this.rooms.find(r => r.id === targetRoomId || r.roomNumber === targetRoomId);
    if (!room && res.roomNumber) {
      room = this.rooms.find(r => r.roomNumber === res.roomNumber);
    }
    if (!room) {
      room = this.rooms.find(r => r.roomTypeId === res.roomTypeId && (r.status === 'clean' || r.operational === 'available')) ||
             this.rooms.find(r => r.status === 'clean') ||
             this.rooms[0];
    }

    targetRoomId = room?.id || targetRoomId || '';
    const roomNumber = room ? room.roomNumber : (res.roomNumber || '');
    const nowIso = new Date().toISOString();
    const liveCheckInTime = getCurrentTimeString();
    const targetId = res.id;
    const targetRef = res.bookingReference || `#${targetId}`;
    const guestName = res.primaryGuest?.name || res.guestName || 'Guest';

    // Verify room is not already full (occupied by another in-house reservation)
    const otherInHouse = this.reservations.find(r => {
      if (!r || r.status !== 'in_house') return false;
      if (r.id === res.id || r.bookingReference === res.bookingReference) return false;
      return (r.roomId && (r.roomId === targetRoomId || r.roomId === roomNumber)) ||
             (r.roomNumber && (r.roomNumber === roomNumber || r.roomNumber === targetRoomId));
    });

    if (otherInHouse) {
      const occupant = otherInHouse.primaryGuest?.name || otherInHouse.guestName || 'another guest';
      console.warn(`[PMSStore] Cannot check-in: Room ${roomNumber} is full (occupied by ${occupant}).`);
      alert(`Cannot check in: Room ${roomNumber} is FULL (currently occupied by ${occupant}). Please assign an available room.`);
      return false;
    }

    const targetRt = room ? this.roomTypes.find(rt => rt.id === room.roomTypeId || rt.name?.toLowerCase() === String(room.roomTypeId).toLowerCase()) : null;
    const updatedRoomTypeId = room?.roomTypeId || res.roomTypeId;
    const updatedRoomTypeName = targetRt?.name || res.roomTypeName || 'Normal';

    // 1. Immediately update reservation status to in_house in memory
    this.reservations = this.reservations.map(r => {
      const isMatch = r.id === targetId ||
        r.bookingReference === targetRef ||
        r.id === cleanStr ||
        r.bookingReference === cleanStr ||
        (cleanNum && (r.id === `res_${cleanNum}` || r.bookingReference === `#RES_${cleanNum}`));
      if (!isMatch) return r;
      return {
        ...r,
        roomId: targetRoomId,
        roomNumber: roomNumber,
        roomTypeId: updatedRoomTypeId,
        roomTypeName: updatedRoomTypeName,
        status: 'in_house',
        checkedInAt: nowIso,
        actualCheckInTime: liveCheckInTime,
        checkInTime: liveCheckInTime,
        arrivalTime: liveCheckInTime,
        updatedAt: nowIso
      };
    });

    // 2. Update folio room assignment
    if (res.folioId && this.folios[res.folioId]) {
      this.folios[res.folioId].roomNumber = roomNumber;
      this.folios[res.folioId].updatedAt = nowIso;
      this.syncDocToFirestore('folios', res.folioId, this.folios[res.folioId]);
    }

    // 3. Update room operational status to occupied
    if (targetRoomId) {
      this.rooms = this.rooms.map(rm =>
        (rm.id === targetRoomId || rm.roomNumber === roomNumber) ? {
          ...rm,
          operational: 'occupied',
          currentReservationId: targetId,
          currentGuestName: guestName,
          status: rm.status === 'dirty' ? 'clean' : rm.status,
          updatedAt: nowIso
        } : rm
      );
      const updatedRoom = this.rooms.find(rm => rm.id === targetRoomId || rm.roomNumber === roomNumber);
      if (updatedRoom) {
        this.syncDocToFirestore('rooms', updatedRoom.id, updatedRoom);
      }
    }

    this.logAudit(
      'CHECK_IN',
      'RESERVATION',
      targetRef,
      `Guest ${guestName} checked in to Room ${roomNumber || 'Assigned'}.`,
      'HOTEL NIVASA',
      {
        actionType: 'GUEST_CHECKED_IN',
        reservationId: targetId,
        bookingReference: targetRef,
        oldStatus: 'RESERVED',
        newStatus: 'CHECKED_IN',
        roomNumber: roomNumber,
        affectedDates: [res.checkInDate || getTodayIsoDate()]
      }
    );

    this.save();

    const updatedRes = this.getReservation(targetId) || this.getReservation(targetRef);
    if (updatedRes) {
      this.syncDocToFirestore('reservations', targetId, updatedRes);
      if (targetRef && targetRef.replace('#', '') !== targetId) {
        this.syncDocToFirestore('reservations', targetRef.replace('#', ''), updatedRes);
      }
    }

    this.notify();
    return true;
  }

  checkOutReservation(resId) {
    if (!resId) return { success: false, message: 'Reservation ID required' };
    const cleanId = typeof resId === 'object' ? (resId?.id || resId?.bookingReference) : resId;
    const cleanStr = String(cleanId || '').trim();
    const cleanNum = cleanStr.replace(/[^0-9]/g, '');

    const res = this.reservations.find(r => {
      if (!r) return false;
      if (r.id === cleanStr || r.bookingReference === cleanStr) return true;
      if (String(r.id).toLowerCase() === cleanStr.toLowerCase()) return true;
      if (String(r.bookingReference).toLowerCase() === cleanStr.toLowerCase()) return true;
      if (cleanNum && (r.id === `res_${cleanNum}` || r.bookingReference === `#RES_${cleanNum}`)) return true;
      return false;
    });

    if (!res) return { success: false, message: 'Reservation not found' };

    // STRICT VALIDATION: PMS enforces folio settlement prior to departure!
    if (res.balanceDue > 0) {
      return {
        success: false,
        message: `Checkout blocked: Unpaid balance of ₹${Number(res.balanceDue).toFixed(2)} remaining. Settle folio first.`
      };
    }

    const nowIso = new Date().toISOString();
    const targetId = res.id;
    const targetRef = res.bookingReference || `#${targetId}`;
    const guestName = res.primaryGuest?.name || res.guestName || 'Guest';

    this.reservations = this.reservations.map(r => {
      const isMatch = r.id === targetId ||
        r.bookingReference === targetRef ||
        r.id === cleanStr ||
        r.bookingReference === cleanStr ||
        (cleanNum && (r.id === `res_${cleanNum}` || r.bookingReference === `#RES_${cleanNum}`));
      if (!isMatch) return r;
      return {
        ...r,
        status: 'checked_out',
        checkedOutAt: nowIso,
        actualCheckOutDate: this.property?.businessDate || nowIso.split('T')[0],
        updatedAt: nowIso
      };
    });

    // Automatic Housekeeping Trigger: Checked-out room automatically becomes DIRTY!
    if (res.roomId || res.roomNumber) {
      const targetRmNum = String(res.roomNumber || '').trim();
      const targetRmId = String(res.roomId || '').trim();
      const isMatchingRm = (rm) =>
        (targetRmId && (rm.id === targetRmId || rm.roomNumber === targetRmId)) ||
        (targetRmNum && (String(rm.roomNumber || '').trim() === targetRmNum || rm.id === `rm_${targetRmNum}`));

      this.rooms = this.rooms.map(rm =>
        isMatchingRm(rm) ? {
          ...rm,
          status: 'dirty',
          operational: 'available',
          currentReservationId: null,
          currentGuestName: null,
          notes: 'Turnaround required post check-out',
          updatedAt: nowIso
        } : rm
      );
      const dirtyRoom = this.rooms.find(isMatchingRm);
      if (dirtyRoom) {
        this.syncDocToFirestore('rooms', dirtyRoom.id, dirtyRoom);
      }
    }

    // Mark folio as closed if zero balance
    if (res.folioId && this.folios[res.folioId]) {
      this.folios[res.folioId].status = 'CLOSED';
      this.folios[res.folioId].updatedAt = nowIso;
      this.syncDocToFirestore('folios', res.folioId, this.folios[res.folioId]);
    }

    const checkoutDateStr = this.property?.businessDate || nowIso.split('T')[0];
    this.logAudit(
      'CHECK_OUT',
      'RESERVATION',
      targetRef,
      `Guest ${guestName} checked out from Room ${res.roomNumber || 'Unassigned'}. Room auto-flagged DIRTY.`,
      this.currentUser?.name || 'HOTEL NIVASA',
      {
        actionType: 'CHECK_OUT',
        reservationId: targetId,
        bookingReference: targetRef,
        guestName,
        roomNumber: res.roomNumber || '',
        oldStatus: 'CHECKED_IN',
        newStatus: 'CHECKED_OUT',
        actualCheckOutDate: checkoutDateStr,
        folioStatus: 'CLOSED',
        affectedDates: [checkoutDateStr]
      }
    );
    this.save();

    const updatedRes = this.getReservation(targetId) || this.getReservation(targetRef);
    if (updatedRes) {
      this.syncDocToFirestore('reservations', targetId, updatedRes);
      if (targetRef && targetRef.replace('#', '') !== targetId) {
        this.syncDocToFirestore('reservations', targetRef.replace('#', ''), updatedRes);
      }
    }

    this.notify();
    return { success: true, message: 'Check-out successful' };
  }

  cancelReservation(resId, reason = 'Guest requested') {
    const res = this.reservations.find(r => r.id === resId || r.bookingReference === resId);
    if (!res) return;

    const targetResId = res.id;
    const targetFolioId = res.folioId;

    // 1. Mark status as cancelled in reservations array (do not delete so it remains visible under All Statuses & Cancelled filter)
    this.reservations = this.reservations.map(r =>
      (r.id === targetResId || r.bookingReference === targetResId)
        ? {
            ...r,
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
            cancellationReason: reason,
            roomId: '',
            roomNumber: 'Unassigned'
          }
        : r
    );

    // 2. Free up any allocated room
    if (res.roomId) {
      this.rooms = this.rooms.map(rm => {
        if (rm.id === res.roomId && rm.operational === 'allocated') {
          return { ...rm, operational: 'available' };
        }
        return rm;
      });
      const updatedRoom = this.rooms.find(rm => rm.id === res.roomId);
      if (updatedRoom) {
        this.syncDocToFirestore('rooms', updatedRoom.id, updatedRoom);
      }
    }

    // 3. Mark associated folio as CANCELLED if present
    if (targetFolioId && this.folios[targetFolioId]) {
      this.folios[targetFolioId] = {
        ...this.folios[targetFolioId],
        status: 'CANCELLED'
      };
      this.syncDocToFirestore('folios', targetFolioId, this.folios[targetFolioId]);
    }

    // 4. Log audit trail
    this.logAudit(
      'CANCEL_RESERVATION',
      'RESERVATION',
      res.bookingReference,
      `Reservation ${res.bookingReference} (${res.primaryGuest?.name || 'Guest'}) marked cancelled. Reason: ${reason}`
    );

    // 5. Save locally and sync cancelled record to Cloud Firestore
    this.save();
    const updated = this.getReservation(targetResId);
    if (updated) {
      this.syncDocToFirestore('reservations', targetResId, updated);
    }
    this.notify();
  }

  markNoShow(resId) {
    const res = this.reservations.find(r => r.id === resId);
    if (!res) return;

    this.reservations = this.reservations.map(r =>
      r.id === resId ? { ...r, status: 'no_show' } : r
    );

    this.logAudit('NO_SHOW', 'RESERVATION', res.bookingReference, `Guest did not arrive. Marked No-Show.`);
    this.save();
    this.syncDocToFirestore('reservations', resId, this.getReservation(resId));
    this.notify();
  }

  // --- ROOM MOVES & REASSIGNMENT ---

  groupRoomMove(reservationId, targetRoomId) {
    const res = this.reservations.find(r => r.id === reservationId);
    const targetRoom = this.rooms.find(r => r.id === targetRoomId);
    if (!res || !targetRoom) return false;

    const oldRoomNumber = res.roomNumber;
    const oldRoomId = res.roomId;
    const targetRoomType = this.roomTypes.find(rt => rt.id === targetRoom.roomTypeId);

    this.reservations = this.reservations.map(r => {
      if (r.id === reservationId) {
        return {
          ...r,
          roomId: targetRoomId,
          roomNumber: targetRoom.roomNumber,
          roomTypeId: targetRoom.roomTypeId || r.roomTypeId,
          roomTypeName: targetRoomType ? targetRoomType.name : (r.roomTypeName || '')
        };
      }
      return r;
    });

    // Update rooms housekeeping & operational state
    if (oldRoomId && oldRoomId !== targetRoomId) {
      this.rooms = this.rooms.map(rm => {
        if (rm.id === oldRoomId) {
          return { ...rm, status: 'dirty', operational: 'available' };
        }
        if (rm.id === targetRoomId) {
          return { ...rm, operational: 'allocated' };
        }
        return rm;
      });
    }

    if (res.folioId && this.folios[res.folioId]) {
      this.folios[res.folioId].roomNumber = targetRoom.roomNumber;
      this.syncDocToFirestore('folios', res.folioId, this.folios[res.folioId]);
    }

    this.logAudit(
      'ROOM_MOVE',
      'RESERVATION',
      res.bookingReference,
      `Room moved from ${oldRoomNumber} to ${targetRoom.roomNumber} (${targetRoom.status.toUpperCase()}).`
    );

    this.save();
    this.syncDocToFirestore('reservations', reservationId, this.getReservation(reservationId));
    this.notify();
    return true;
  }

  // --- HOUSEKEEPING & MAINTENANCE ---

  updateRoomStatus(roomId, newStatus, meta = {}) {
    const nowIso = new Date().toISOString();
    const targetNum = String(roomId || '').trim().replace(/^rm_/, '');
    const isTargetRoom = (rm) =>
      rm.id === roomId ||
      String(rm.roomNumber || '').trim() === String(roomId || '').trim() ||
      (targetNum && String(rm.roomNumber || '').trim() === targetNum);

    this.rooms = this.rooms.map(rm => {
      if (!isTargetRoom(rm)) return rm;
      if (newStatus === 'clean') {
        const cleanedBy = meta?.cleanedBy || '';
        const cleanedTimeFormatted = meta?.cleanedTimeFormatted || meta?.cleanedTime || '';
        const cleanNote = cleanedBy
          ? `Cleaned by ${cleanedBy}${cleanedTimeFormatted ? ` at ${cleanedTimeFormatted}` : ''}`
          : (meta?.notes || 'Ready for check-in');
        return {
          ...rm,
          status: newStatus,
          lastCleanedBy: cleanedBy || rm.lastCleanedBy || '',
          lastCleanedDate: meta?.cleanedDate || rm.lastCleanedDate || '',
          lastCleanedTime: cleanedTimeFormatted || rm.lastCleanedTime || '',
          lastCleanedAt: cleanedBy ? nowIso : (rm.lastCleanedAt || ''),
          notes: cleanNote,
          updatedAt: nowIso,
          statusUpdatedAt: nowIso,
          _pendingSync: true
        };
      }
      if (newStatus === 'dirty') {
        return {
          ...rm,
          status: newStatus,
          notes: meta?.notes || 'Needs cleaning',
          updatedAt: nowIso,
          statusUpdatedAt: nowIso,
          _pendingSync: true
        };
      }
      return {
        ...rm,
        status: newStatus,
        ...(meta?.notes !== undefined ? { notes: meta.notes } : {}),
        updatedAt: nowIso,
        statusUpdatedAt: nowIso,
        _pendingSync: true
      };
    });
    const room = this.rooms.find(isTargetRoom);
    const auditDetail = newStatus === 'clean' && meta?.cleanedBy
      ? `Marked CLEAN by ${meta.cleanedBy}${meta.cleanedTimeFormatted ? ` at ${meta.cleanedTimeFormatted}` : ''}`
      : `Status set to ${newStatus.toUpperCase()}`;
    this.logAudit('HOUSEKEEPING_UPDATE', 'ROOM', room ? room.roomNumber : roomId, auditDetail);

    if (newStatus === 'clean' && meta?.cleanedBy && room) {
      const rtObj = (this.roomTypes || []).find(rt => rt.id === room.roomTypeId);
      const cleaningRecord = {
        id: `clean_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        roomId: room.id,
        roomNumber: room.roomNumber || String(room.id).replace(/^rm_/, ''),
        roomTypeId: room.roomTypeId || '',
        roomTypeName: rtObj?.name || room.roomTypeName || room.roomType || 'Room',
        cleanedBy: meta.cleanedBy,
        cleanedDate: meta.cleanedDate || getTodayIsoDate(),
        cleanedTime: meta.cleanedTime || getCurrentTimeString(),
        cleanedTimeFormatted: meta.cleanedTimeFormatted || meta.cleanedTime || '',
        notes: meta.notes || '',
        markedBy: this.currentUser?.name || this.property?.userProfile?.name || 'Front Desk',
        createdAt: nowIso,
        createdAtMs: Date.now(),
        _pendingSync: true
      };
      if (!Array.isArray(this.cleaningHistory)) this.cleaningHistory = [];
      this.cleaningHistory = [cleaningRecord, ...this.cleaningHistory.slice(0, 499)];
      const cleanRecordPayload = { ...cleaningRecord };
      delete cleanRecordPayload._pendingSync;
      this.syncDocToFirestore('cleaningHistory', cleaningRecord.id, cleanRecordPayload).then(() => {
        this.cleaningHistory = (this.cleaningHistory || []).map((rec) =>
          rec.id === cleaningRecord.id ? { ...rec, _pendingSync: false } : rec
        );
        this.save();
      });
    }

    this.save();

    if (room) {
      const cleanPayload = { ...room };
      delete cleanPayload._pendingSync;
      const syncPromises = [this.syncDocToFirestore('rooms', room.id || roomId, cleanPayload)];
      if (room._firestoreDocId && room._firestoreDocId !== (room.id || roomId)) {
        syncPromises.push(this.syncDocToFirestore('rooms', room._firestoreDocId, cleanPayload));
      }
      Promise.all(syncPromises).then(() => {
        this.rooms = this.rooms.map((rm) =>
          rm.id === room.id && rm.statusUpdatedAt === nowIso
            ? { ...rm, _pendingSync: false }
            : rm
        );
        this.save();
      });
    }
    this.notify();
  }

  deleteCleaningHistory(recordId) {
    if (!recordId) return;
    const idStr = String(recordId);

    const targetClean = (this.cleaningHistory || []).find((rec) => String(rec.id) === idStr);
    const targetAudit = (this.auditTrail || []).find((entry) => String(entry.id) === idStr);

    const targetRoomNum = String(
      targetClean?.roomNumber || targetAudit?.entityId || ''
    ).trim();
    const targetMs =
      targetClean?.createdAtMs ||
      (targetClean?.createdAt ? Date.parse(targetClean.createdAt) : 0) ||
      targetAudit?.createdAtMs ||
      (targetAudit?.timestamp ? Date.parse(String(targetAudit.timestamp).replace(' ', 'T')) : 0) ||
      0;

    // Collect any paired cleaningHistory & auditTrail IDs for the same room & event timestamp (±15s)
    const cleanIdsToDelete = new Set([idStr]);
    const auditIdsToDelete = new Set([idStr]);

    if (targetRoomNum && targetMs > 0) {
      (this.cleaningHistory || []).forEach((rec) => {
        if (!rec || !rec.id) return;
        const rNum = String(rec.roomNumber || '').trim();
        const rMs = rec.createdAtMs || (rec.createdAt ? Date.parse(rec.createdAt) : 0) || 0;
        if (rNum === targetRoomNum && Math.abs(rMs - targetMs) < 15000) {
          cleanIdsToDelete.add(String(rec.id));
        }
      });

      (this.auditTrail || []).forEach((entry) => {
        if (!entry || !entry.id || entry.action !== 'HOUSEKEEPING_UPDATE') return;
        if (!/^Marked CLEAN by /i.test(String(entry.details || ''))) return;
        const eRoom = String(entry.entityId || '').trim();
        const eMs =
          entry.createdAtMs ||
          (entry.timestamp ? Date.parse(String(entry.timestamp).replace(' ', 'T')) : 0) ||
          0;
        if (eRoom === targetRoomNum && Math.abs(eMs - targetMs) < 15000) {
          auditIdsToDelete.add(String(entry.id));
        }
      });
    }

    this.cleaningHistory = (this.cleaningHistory || []).filter(
      (rec) => !cleanIdsToDelete.has(String(rec.id))
    );
    this.auditTrail = (this.auditTrail || []).filter(
      (entry) => !auditIdsToDelete.has(String(entry.id))
    );
    this.save();

    cleanIdsToDelete.forEach((cid) => this.deleteDocFromFirestore('cleaningHistory', cid));
    auditIdsToDelete.forEach((aid) => this.deleteDocFromFirestore('auditTrail', aid));
    this.notify();
  }

  addMaintenanceBlock(blockData) {
    const room = this.rooms.find(r => r.id === blockData.roomId);
    const newBlock = {
      id: `mb_${Date.now()}`,
      roomId: blockData.roomId,
      roomNumber: room ? room.roomNumber : '',
      reason: blockData.reason || 'General Maintenance',
      startDate: blockData.startDate,
      endDate: blockData.endDate,
      createdAt: new Date().toISOString()
    };

    this.maintenanceBlocks = [newBlock, ...this.maintenanceBlocks];
    if (room) {
      this.updateRoomStatus(room.id, 'maintenance');
    }
    this.logAudit('MAINTENANCE_LOCK', 'ROOM', room ? room.roomNumber : '', `Blocked ${blockData.startDate} to ${blockData.endDate}. Reason: ${blockData.reason}`);
    this.save();
    this.syncDocToFirestore('maintenanceBlocks', newBlock.id, newBlock);
    this.notify();
    return newBlock;
  }

  removeMaintenanceBlock(blockId) {
    const block = this.maintenanceBlocks.find(b => b.id === blockId);
    this.maintenanceBlocks = this.maintenanceBlocks.filter(b => b.id !== blockId);
    if (block) {
      this.updateRoomStatus(block.roomId, 'clean');
      this.logAudit('MAINTENANCE_RELEASE', 'ROOM', block.roomNumber, `Maintenance block removed.`);
      this.deleteDocFromFirestore('maintenanceBlocks', blockId);
    }
    this.save();
    this.notify();
    return { success: true };
  }




  // --- FOLIO & SETTLEMENT ENGINE ---

  recomputeFolioTotals(reservationId) {
    const res = this.reservations.find(r => r.id === reservationId);
    if (!res || !res.folioId || !this.folios[res.folioId]) return;

    const folio = this.folios[res.folioId];
    let totalDebits = 0;
    let totalCredits = 0;
    let totalTax = 0;

    folio.transactions.forEach(t => {
      if (t.isVoided) return;
      if (t.direction === 'DEBIT' || Number(t.amount) > 0) {
        totalDebits += Number(t.amount);
        totalTax += Number(t.tax || 0);
      } else {
        totalCredits += Math.abs(Number(t.amount));
      }
    });

    const newTotal = totalDebits + totalTax;
    const newPaid = totalCredits;
    const newBalance = Math.max(0, newTotal - newPaid);

    this.reservations = this.reservations.map(r => {
      if (r.id === reservationId) {
        return {
          ...r,
          totalAmount: newTotal,
          paidAmount: newPaid,
          taxAmount: totalTax,
          balanceDue: newBalance
        };
      }
      return r;
    });

    this.folios[res.folioId].status = newBalance <= 0 ? 'SETTLED' : 'OPEN';
  }

  addFolioTransaction(reservationId, transaction) {
    const res = this.reservations.find(r => r.id === reservationId);
    if (!res || !res.folioId) return null;
    const statusNorm = (res.status || '').toLowerCase().replace('-', '_').replace(' ', '_');
    if (statusNorm === 'checked_out' || statusNorm === 'cancelled' || statusNorm === 'no_show') {
      console.warn(`[PMSStore] Cannot add transaction to ${res.status} reservation ${reservationId}.`);
      return null;
    }

    const folio = this.folios[res.folioId] || {
      folioNumber: `FOL_${res.id.replace('res_', '')}`,
      reservationId,
      roomNumber: res.roomNumber,
      status: 'OPEN',
      transactions: []
    };

    const effectiveDate = transaction.date ? normalizeDateStr(transaction.date) : getTodayIsoDate();

    const newTx = {
      id: transaction.id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: effectiveDate,
      category: transaction.category || (Number(transaction.amount) < 0 ? 'Payment' : 'Room'),
      type: transaction.type || (Number(transaction.amount) < 0 ? 'PAYMENT' : 'EXTRA_SERVICE'),
      desc: transaction.desc || 'Folio Transaction',
      voucherNumber: transaction.voucherNumber || transaction.reference || `VCH-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: Number(transaction.amount) || 0,
      tax: Number(transaction.tax) || 0,
      direction: Number(transaction.amount) < 0 ? 'CREDIT' : 'DEBIT',
      paymentMethod: transaction.paymentMethod || 'CASH',
      paymentType: transaction.paymentType || (Number(transaction.amount) < 0 ? 'Settlement' : undefined),
      isVoided: false
    };

    folio.transactions.push(newTx);
    this.folios[res.folioId] = { ...folio };
    this.recomputeFolioTotals(reservationId);

    this.logAudit('FOLIO_UPDATE', 'FOLIO', folio.folioNumber, `Posted ${newTx.type}: ₹${Math.abs(newTx.amount)} (${newTx.desc})`);
    this.save();

    // Async Cloud sync
    this.syncDocToFirestore('folios', res.folioId, this.folios[res.folioId]);
    this.syncDocToFirestore('reservations', reservationId, this.getReservation(reservationId));

    return newTx;
  }

  postPendingCharges(reservationId) {
    const res = this.reservations.find(r => r.id === reservationId);
    if (!res || !res.folioId) return null;
    const statusNorm = (res.status || '').toLowerCase().replace('-', '_').replace(' ', '_');
    if (statusNorm === 'checked_out' || statusNorm === 'cancelled' || statusNorm === 'no_show') {
      console.warn(`[PMSStore] Cannot post pending charges to ${res.status} reservation ${reservationId}.`);
      return null;
    }

    // Guard against accidental duplicate posting within 1 second
    const now = Date.now();
    if (
      this._lastPostPendingCall &&
      this._lastPostPendingCall.reservationId === reservationId &&
      now - this._lastPostPendingCall.timestamp < 1000
    ) {
      console.warn(`[PMSStore] Blocked duplicate postPendingCharges call within 1s for ${reservationId}.`);
      return null;
    }
    this._lastPostPendingCall = { reservationId, timestamp: now };

    const folio = this.folios[res.folioId] || {
      folioNumber: `FOL_${res.id.replace('res_', '')}`,
      reservationId,
      roomNumber: res.roomNumber,
      status: 'OPEN',
      transactions: []
    };

    const taxCalc = calculateRoomTax(res.baseRatePerNight, 1, {
      isComplimentary: res.isComplimentary,
      isTaxExempt: res.isTaxExempt
    });

    const effectiveDate = getTodayIsoDate();
    const newTx = {
      id: `tx_nightly_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      date: effectiveDate,
      category: 'Room (Room Rent / Accommodation)',
      type: 'ROOM_CHARGE',
      desc: `Nightly Room Tariff - Room ${res.roomNumber}`,
      voucherNumber: `VCH-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: Number(res.baseRatePerNight) || 2500,
      tax: Number(taxCalc.totalTax) || 125,
      direction: 'DEBIT',
      isVoided: false
    };

    folio.transactions.push(newTx);
    this.folios[res.folioId] = { ...folio };
    this.recomputeFolioTotals(reservationId);

    this.logAudit(
      'POST_PENDING_CHARGES',
      'FOLIO',
      folio.folioNumber,
      `Posted pending nightly tariff ₹${newTx.amount} + Tax ₹${newTx.tax} on ${effectiveDate} for Room ${res.roomNumber}.`
    );
    this.save();

    // Async Cloud sync
    this.syncDocToFirestore('folios', res.folioId, this.folios[res.folioId]);
    this.syncDocToFirestore('reservations', reservationId, this.getReservation(reservationId));

    this.notify();
    return newTx;
  }

  addFolioCharge(reservationId, { date, category, receiptNumber, amount, description }) {
    const res = this.reservations.find(r => r.id === reservationId);
    if (!res || !res.folioId) return null;
    const statusNorm = (res.status || '').toLowerCase().replace('-', '_').replace(' ', '_');
    if (statusNorm === 'checked_out' || statusNorm === 'cancelled' || statusNorm === 'no_show') {
      console.warn(`[PMSStore] Cannot add charge to ${res.status} reservation ${reservationId}.`);
      return null;
    }

    const folio = this.folios[res.folioId] || {
      folioNumber: `FOL_${res.id.replace('res_', '')}`,
      reservationId,
      roomNumber: res.roomNumber,
      status: 'OPEN',
      transactions: []
    };

    const amt = Number(amount) || 0;

    // Guard against accidental duplicate posting within 1 second
    const now = Date.now();
    if (
      this._lastChargeCall &&
      this._lastChargeCall.reservationId === reservationId &&
      this._lastChargeCall.amount === amt &&
      this._lastChargeCall.category === category &&
      now - this._lastChargeCall.timestamp < 1000
    ) {
      console.warn(`[PMSStore] Blocked duplicate addFolioCharge call within 1s for ${reservationId}.`);
      return folio.transactions[folio.transactions.length - 1] || null;
    }
    this._lastChargeCall = { reservationId, amount: amt, category, timestamp: now };

    const tax = res.isTaxExempt || res.isComplimentary ? 0 : Math.round(amt * 0.05 * 100) / 100;
    const effectiveDate = date ? normalizeDateStr(date) : getTodayIsoDate();

    const newTx = {
      id: `tx_chg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: effectiveDate,
      category: category || 'Service (General Guest Services)',
      type: 'EXTRA_SERVICE',
      desc: description || category || 'Incidental / Service Charge',
      voucherNumber: receiptNumber || `VCH-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: amt,
      tax: tax,
      direction: 'DEBIT',
      isVoided: false
    };

    folio.transactions.push(newTx);
    this.folios[res.folioId] = { ...folio };
    this.recomputeFolioTotals(reservationId);

    this.logAudit(
      'CHARGE_ADDED',
      'RESERVATION',
      res.bookingReference || res.id,
      `Added charge [${newTx.category}]: ₹${amt} (Receipt: ${newTx.voucherNumber}) on ${effectiveDate}. Desc: ${newTx.desc}`,
      'HOTEL NIVASA',
      {
        actionType: 'CHARGE_ADDED',
        reservationId,
        bookingReference: res.bookingReference,
        category: newTx.category,
        amount: amt,
        tax: tax,
        description: newTx.desc,
        date: effectiveDate,
        voucherNumber: newTx.voucherNumber,
        affectedDates: [effectiveDate]
      }
    );
    this.save();

    // Async Cloud sync
    this.syncDocToFirestore('folios', res.folioId, this.folios[res.folioId]);
    this.syncDocToFirestore('reservations', reservationId, this.getReservation(reservationId));

    this.notify();
    return newTx;
  }

  addFolioPayment(reservationId, { folioId, date, type, paymentMethod, amount, description, reference }) {
    const res = this.reservations.find(r => r.id === reservationId);
    if (!res || !res.folioId) return null;
    const statusNorm = (res.status || '').toLowerCase().replace('-', '_').replace(' ', '_');
    if (statusNorm === 'checked_out' || statusNorm === 'cancelled' || statusNorm === 'no_show') {
      console.warn(`[PMSStore] Cannot add payment to ${res.status} reservation ${reservationId}.`);
      return null;
    }

    const folio = this.folios[res.folioId] || {
      folioNumber: `FOL_${res.id.replace('res_', '')}`,
      reservationId,
      roomNumber: res.roomNumber,
      status: 'OPEN',
      transactions: []
    };

    const amt = Number(amount) || 0;

    // Guard against accidental duplicate payment posting within 1 second
    const now = Date.now();
    if (
      this._lastPaymentCall &&
      this._lastPaymentCall.reservationId === reservationId &&
      this._lastPaymentCall.amount === amt &&
      this._lastPaymentCall.paymentMethod === paymentMethod &&
      now - this._lastPaymentCall.timestamp < 1000
    ) {
      console.warn(`[PMSStore] Blocked duplicate addFolioPayment call within 1s for ${reservationId}.`);
      return folio.transactions[folio.transactions.length - 1] || null;
    }
    this._lastPaymentCall = { reservationId, amount: amt, paymentMethod, timestamp: now };

    const effectiveDate = date ? normalizeDateStr(date) : (this.property?.businessDate && this.property.businessDate >= getTodayIsoDate() ? this.property.businessDate : getTodayIsoDate());

    const newTx = {
      id: `tx_pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: effectiveDate,
      particulars: 'Payment',
      category: 'Payment',
      type: 'PAYMENT',
      paymentType: type || 'Settlement',
      paymentMethod: paymentMethod || 'UPI',
      desc: description || `${type || 'Settlement'} Payment via ${paymentMethod || 'UPI'}${reference ? ` Ref: ${reference}` : ''}`,
      voucherNumber: reference || `PAY-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: -Math.abs(amt),
      tax: 0,
      direction: 'CREDIT',
      isVoided: false
    };

    folio.transactions.push(newTx);
    this.folios[res.folioId] = { ...folio };
    this.recomputeFolioTotals(reservationId);

    this.logAudit(
      'PAYMENT_ADDED',
      'RESERVATION',
      res.bookingReference || res.id,
      `Processed ${newTx.paymentType} payment of ₹${amt} via ${newTx.paymentMethod}. Outstanding: ₹${this.reservations.find(r => r.id === reservationId)?.balanceDue.toFixed(2)}`,
      'HOTEL NIVASA',
      {
        actionType: 'PAYMENT_ADDED',
        reservationId,
        bookingReference: res.bookingReference,
        amount: amt,
        paymentMethod: newTx.paymentMethod,
        paymentType: newTx.paymentType,
        voucherNumber: newTx.voucherNumber,
        date: effectiveDate,
        affectedDates: [effectiveDate]
      }
    );
    this.save();

    // Async Cloud sync
    this.syncDocToFirestore('folios', res.folioId, this.folios[res.folioId]);
    this.syncDocToFirestore('reservations', reservationId, this.getReservation(reservationId));

    return newTx;
  }

  voidPayment(reservationId, transactionId, voidReason) {
    const res = this.reservations.find(r => r.id === reservationId);
    if (!res || !res.folioId || !this.folios[res.folioId]) return false;
    const statusNorm = (res.status || '').toLowerCase().replace('-', '_').replace(' ', '_');
    if (statusNorm === 'checked_out' || statusNorm === 'cancelled' || statusNorm === 'no_show') {
      console.warn(`[PMSStore] Cannot void payment on ${res.status} reservation ${reservationId}.`);
      return false;
    }

    const folio = this.folios[res.folioId];
    const tx = folio.transactions.find(t => t.id === transactionId);
    if (!tx || tx.isVoided) return false;

    tx.isVoided = true;
    tx.voidReason = voidReason || 'Voided by front desk operator';
    tx.voidedAt = new Date().toISOString();
    tx.voidedBy = 'HOTEL NIVASA';

    this.recomputeFolioTotals(reservationId);

    this.logAudit(
      'VOID_PAYMENT',
      'RESERVATION',
      res.bookingReference || res.id,
      `VOIDED payment of ₹${Math.abs(tx.amount)} (${tx.paymentMethod || 'Payment'}) on ${folio.folioNumber}. Reason: "${tx.voidReason}". Balance restored.`,
      this.currentUser?.name || 'HOTEL NIVASA',
      {
        actionType: 'VOID_PAYMENT',
        reservationId: res.id,
        bookingReference: res.bookingReference,
        folioNumber: folio.folioNumber,
        amount: Math.abs(tx.amount || 0),
        paymentMethod: tx.paymentMethod || 'Payment',
        voidReason: tx.voidReason,
        date: tx.date || getTodayIsoDate(),
        affectedDates: [tx.date || getTodayIsoDate()]
      }
    );
    this.save();

    this.syncDocToFirestore('folios', res.folioId, this.folios[res.folioId]);
    this.syncDocToFirestore('reservations', reservationId, this.getReservation(reservationId));

    return true;
  }

  updateFolioTransaction(reservationId, transactionId, { amount, description, date }) {
    const res = this.reservations.find(r => r.id === reservationId || r.bookingReference === reservationId);
    if (!res || !res.folioId || !this.folios[res.folioId]) return false;

    const folio = this.folios[res.folioId];
    const tx = folio.transactions.find(t => t.id === transactionId);
    if (!tx || tx.isVoided) return false;

    const isCredit =
      tx.direction === 'CREDIT' ||
      tx.direction === 'Credit' ||
      (tx.category && String(tx.category).toUpperCase().includes('PAYMENT')) ||
      (tx.type && String(tx.type).toUpperCase().includes('PAYMENT'));

    const oldAmt = Math.abs(Number(tx.amount || 0));
    const oldDate = normalizeDateStr(tx.date) || getTodayIsoDate();
    const oldDesc = String(tx.desc || tx.description || '').trim();
    const parsedNewAmt = Number(amount);
    const finalNewAmt = !isNaN(parsedNewAmt) && parsedNewAmt >= 0 ? parsedNewAmt : oldAmt;

    if (!isNaN(parsedNewAmt) && parsedNewAmt >= 0) {
      tx.amount = isCredit ? -Math.abs(parsedNewAmt) : Math.abs(parsedNewAmt);
    }
    if (description !== undefined) {
      tx.desc = description;
      tx.description = description;
    }
    if (date !== undefined && date) {
      tx.date = normalizeDateStr(date);
    }
    const newDate = normalizeDateStr(tx.date) || oldDate;
    const newDesc = String(tx.desc || tx.description || '').trim();
    tx.updatedAt = new Date().toISOString();

    this.recomputeFolioTotals(res.id);

    const updatedRes = this.reservations.find(r => r.id === res.id);
    const actionType = isCredit ? 'PAYMENT_UPDATED' : 'CHARGE_UPDATED';
    const paymentMethod = tx.paymentMethod || (isCredit ? 'UPI' : '-');
    const affectedDates = Array.from(new Set([oldDate, newDate].filter(Boolean)));
    const actorName = this.currentUser?.name || 'HOTEL NIVASA';

    const changeParts = [];
    if (oldAmt !== finalNewAmt) {
      changeParts.push(`Amount: ₹${oldAmt.toFixed(2)} → ₹${finalNewAmt.toFixed(2)}`);
    } else {
      changeParts.push(`Amount: ₹${finalNewAmt.toFixed(2)}`);
    }
    if (oldDate !== newDate) {
      changeParts.push(`Date: ${oldDate} → ${newDate}`);
    }
    if (oldDesc !== newDesc) {
      changeParts.push(`Description: "${oldDesc || '-'}" → "${newDesc || '-'}"`);
    }

    this.logAudit(
      actionType,
      'RESERVATION',
      res.bookingReference || res.id,
      `Edited folio ${isCredit ? 'payment' : 'charge'} (${folio.folioNumber}) — ${changeParts.join(' | ')}. Outstanding: ₹${Number(updatedRes?.balanceDue || 0).toFixed(2)}`,
      actorName,
      {
        actionType,
        reservationId: res.id,
        bookingReference: res.bookingReference,
        folioNumber: folio.folioNumber,
        transactionId: tx.id,
        isPayment: isCredit,
        paymentMethod,
        voucherNumber: tx.voucherNumber || '',
        oldAmount: oldAmt,
        newAmount: finalNewAmt,
        oldDate,
        newDate,
        oldDescription: oldDesc,
        newDescription: newDesc,
        date: newDate,
        affectedDates
      }
    );
    this.save();
    this.notify();

    this.syncDocToFirestore('folios', res.folioId, this.folios[res.folioId]);
    this.syncDocToFirestore('reservations', res.id, this.getReservation(res.id));

    return true;
  }

  moveFolioTransaction(reservationId, transactionId, targetFolioId) {
    const res = this.reservations.find(r => r.id === reservationId || r.bookingReference === reservationId);
    if (!res || !res.folioId || !this.folios[res.folioId]) return false;

    const sourceFolio = this.folios[res.folioId];
    const txIndex = sourceFolio.transactions.findIndex(t => t.id === transactionId);
    if (txIndex === -1) return false;

    const [tx] = sourceFolio.transactions.splice(txIndex, 1);

    if (!this.folios[targetFolioId]) {
      this.folios[targetFolioId] = {
        folioNumber: targetFolioId.toUpperCase(),
        reservationId: res.id,
        roomNumber: res.roomNumber,
        status: 'OPEN',
        transactions: []
      };
    }
    this.folios[targetFolioId].transactions.push(tx);

    this.recomputeFolioTotals(res.id);

    this.logAudit(
      'MOVE_TRANSACTION',
      'FOLIO',
      sourceFolio.folioNumber,
      `Moved transaction ₹${Math.abs(tx.amount || 0)} from ${sourceFolio.folioNumber} to ${targetFolioId}.`
    );
    this.save();
    this.notify();

    this.syncDocToFirestore('folios', res.folioId, sourceFolio);
    this.syncDocToFirestore('folios', targetFolioId, this.folios[targetFolioId]);
    this.syncDocToFirestore('reservations', res.id, this.getReservation(res.id));

    return true;
  }

  settleFolio(reservationId, paymentMode = 'UPI', reference = 'Direct Settlement', date, explicitAmount) {
    const res = this.reservations.find(r => r.id === reservationId || r.bookingReference === reservationId);
    if (!res) return false;

    // Determine exact outstanding amount from explicit amount, live folio transactions, or res.balanceDue
    let settleAmt = Number(explicitAmount);
    if (!settleAmt || isNaN(settleAmt) || settleAmt <= 0) {
      const folio = res.folioId ? this.folios[res.folioId] : null;
      if (folio && Array.isArray(folio.transactions) && folio.transactions.length > 0) {
        let debits = 0;
        let credits = 0;
        folio.transactions.forEach((tx) => {
          if (!tx || tx.isVoided) return;
          const isCred =
            String(tx.direction || '').toUpperCase() === 'CREDIT' ||
            tx.type === 'PAYMENT' ||
            Number(tx.amount || 0) < 0;
          if (isCred) {
            credits += Math.abs(Number(tx.amount) || 0);
          } else {
            debits += (Number(tx.amount) || 0) + (Number(tx.tax) || 0);
          }
        });
        settleAmt = Math.max(0, Math.round((debits - credits) * 100) / 100);
      } else {
        settleAmt = Math.max(0, Number(res.balanceDue) || 0);
      }
    }

    if (settleAmt > 0) {
      this.addFolioPayment(res.id, {
        date: date ? normalizeDateStr(date) : getTodayIsoDate(),
        type: 'Settlement',
        paymentMethod: paymentMode,
        amount: settleAmt,
        description: `Folio Settlement (${paymentMode}) Ref: ${reference}`,
        reference
      });
    }

    if (res.folioId && this.folios[res.folioId]) {
      this.folios[res.folioId] = {
        ...this.folios[res.folioId],
        status: 'SETTLED',
        settledAt: new Date().toISOString()
      };
      this.syncDocToFirestore('folios', res.folioId, this.folios[res.folioId]);
    }

    this.logAudit(
      'SETTLE_FOLIO',
      'FOLIO',
      res.folioId || res.id,
      `Folio ${res.folioId || res.id} settled (₹${settleAmt.toFixed(2)} via ${paymentMode}) and marked CLOSED.`,
      this.currentUser?.name || 'HOTEL NIVASA',
      {
        actionType: 'SETTLE_FOLIO',
        reservationId: res.id,
        bookingReference: res.bookingReference,
        amount: settleAmt,
        paymentMethod: paymentMode
      }
    );
    this.save();
    this.notify();
    return true;
  }

  // --- RATES, STOPOUTS & RESTRICTIONS ---

  syncRateMatrixToFirestore() {
    const nowIso = new Date().toISOString();
    this.rateMatrixUpdatedAt = nowIso;
    this.save();
    this.syncDocToFirestore('rateMatrix', 'ari_config', {
      dailyRates: this.dailyRates || { base: {}, extra_adult: {}, extra_child: {}, min_nights: {} },
      stopouts: this.stopouts || {},
      restrictions: this.restrictions || {},
      updatedAt: nowIso
    });
  }

  toggleStopout(roomTypeId, dateStr) {
    const key = `${roomTypeId}_${dateStr}`;
    const next = !this.stopouts[key];
    this.stopouts = {
      ...this.stopouts,
      [key]: next
    };
    const rt = this.roomTypes.find(r => r.id === roomTypeId);
    this.logAudit('STOPOUT_TOGGLE', 'RATE_MATRIX', key, `${rt ? rt.name : roomTypeId} stop-sell set to ${next ? 'CLOSED' : 'OPEN'} on ${dateStr}`);
    this.syncRateMatrixToFirestore();
  }

  updateDailyRates(ratesMap, tier = 'base') {
    if (!ratesMap || typeof ratesMap !== 'object') return;
    const prevRates = this.dailyRates || { base: {}, extra_adult: {}, extra_child: {}, min_nights: {} };
    const nextTierMap = { ...(prevRates[tier] || {}) };
    const nextRestrictions = { ...(this.restrictions || {}) };

    Object.entries(ratesMap).forEach(([key, val]) => {
      const num = Number(val);
      const isValid = tier === 'min_nights' ? (!isNaN(num) && num >= 1) : (!isNaN(num) && num >= 0);
      if (isValid) {
        nextTierMap[key] = num;
        if (tier === 'min_nights') {
          nextRestrictions[key] = { ...(nextRestrictions[key] || {}), minStay: num };
          nextRestrictions[`min_${key}`] = num;
        }
      }
    });

    this.dailyRates = {
      base: prevRates.base || {},
      extra_adult: prevRates.extra_adult || {},
      extra_child: prevRates.extra_child || {},
      min_nights: prevRates.min_nights || {},
      [tier]: nextTierMap
    };
    this.restrictions = nextRestrictions;

    const count = Object.keys(ratesMap).length;
    if (count > 0) {
      this.logAudit('RATES_UPDATE', 'RATE_MATRIX', tier, `Updated ${count} daily rates for tier: ${tier}`);
    }
    this.syncRateMatrixToFirestore();
  }

  updateSingleRate(roomTypeId, dateStr, rate, tier = 'base') {
    const prevRates = this.dailyRates || { base: {}, extra_adult: {}, extra_child: {}, min_nights: {} };
    const num = Number(rate);
    const isValid = tier === 'min_nights' ? (!isNaN(num) && num >= 1) : (!isNaN(num) && num >= 0);
    if (isValid) {
      const key = `${roomTypeId}_${dateStr}`;
      this.dailyRates = {
        ...prevRates,
        [tier]: {
          ...(prevRates[tier] || {}),
          [key]: num
        }
      };
      this.syncRateMatrixToFirestore();
    }
  }

  bulkUpdateRates(payload) {
    if (!payload) return;

    const prevRates = this.dailyRates || { base: {}, extra_adult: {}, extra_child: {}, min_nights: {} };
    const nextDailyRates = {
      base: { ...(prevRates.base || {}) },
      extra_adult: { ...(prevRates.extra_adult || {}) },
      extra_child: { ...(prevRates.extra_child || {}) },
      min_nights: { ...(prevRates.min_nights || {}) }
    };
    const nextStopouts = { ...(this.stopouts || {}) };
    const nextRestrictions = { ...(this.restrictions || {}) };

    // 1. Direct inline rate matrix save
    if (payload.rates && typeof payload.rates === 'object') {
      this.updateDailyRates(payload.rates, payload.tier || 'base');
      return;
    }

    // 2. Bulk Update from Modal
    const targetRoomTypeIds = payload.roomTypeIds || this.roomTypes.map(r => r.id);
    const rtNames = this.roomTypes.filter(rt => targetRoomTypeIds.includes(rt.id)).map(r => r.name).join(', ');

    const startDateStr = payload.startDate || '2026-10-24';
    const endDateStr = payload.endDate || '2026-11-15';
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const cur = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');

    while (cur <= end) {
      const dayName = dayMap[cur.getDay()];
      if (!payload.daysOfWeek || payload.daysOfWeek.length === 0 || payload.daysOfWeek.includes(dayName)) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        const iso = `${y}-${m}-${d}`;
        targetRoomTypeIds.forEach(rtId => {
          const cellKey = `${rtId}_${iso}`;

          // Rate override
          if (payload.baseRate !== undefined && payload.baseRate !== null && payload.baseRate !== '') {
            const rateNum = Number(payload.baseRate);
            if (!isNaN(rateNum) && rateNum >= 0) {
              nextDailyRates.base[cellKey] = rateNum;
            }
          }

          // Extra adult
          if (payload.extraAdultRate !== undefined && payload.extraAdultRate !== null && payload.extraAdultRate !== '') {
            const eaNum = Number(payload.extraAdultRate);
            if (!isNaN(eaNum) && eaNum >= 0) {
              nextDailyRates.extra_adult[cellKey] = eaNum;
            }
          }

          // Extra child
          if (payload.extraChildRate !== undefined && payload.extraChildRate !== null && payload.extraChildRate !== '') {
            const ecNum = Number(payload.extraChildRate);
            if (!isNaN(ecNum) && ecNum >= 0) {
              nextDailyRates.extra_child[cellKey] = ecNum;
            }
          }

          // Stop sell
          if (payload.stopSell !== undefined) {
            nextStopouts[cellKey] = !!payload.stopSell;
          }

          // Min nights
          if (payload.minNights !== undefined && payload.minNights !== '') {
            const minNum = Number(payload.minNights);
            if (!isNaN(minNum) && minNum >= 1) {
              nextDailyRates.min_nights[cellKey] = minNum;
              nextRestrictions[cellKey] = { ...(nextRestrictions[cellKey] || {}), minStay: minNum };
              nextRestrictions[`min_${cellKey}`] = minNum;
            }
          }

          // Max nights
          if (payload.maxNights !== undefined) {
            nextRestrictions[`max_${cellKey}`] = Number(payload.maxNights);
          }

          // CTA (Closed to arrival)
          if (payload.cta !== undefined) {
            nextRestrictions[`cta_${cellKey}`] = !!payload.cta;
          }

          // CTD (Closed to departure)
          if (payload.ctd !== undefined) {
            nextRestrictions[`ctd_${cellKey}`] = !!payload.ctd;
          }
        });
      }
      cur.setDate(cur.getDate() + 1);
    }

    this.dailyRates = nextDailyRates;
    this.stopouts = nextStopouts;
    this.restrictions = nextRestrictions;

    // Update roomTypes default basePrice if provided and sync updated roomTypes to Firestore
    if (payload.baseRate !== undefined && payload.baseRate !== null && payload.baseRate !== '') {
      const bNum = Number(payload.baseRate);
      if (!isNaN(bNum) && bNum > 0) {
        const updatedTypes = [];
        this.roomTypes = this.roomTypes.map(rt => {
          if (targetRoomTypeIds.includes(rt.id)) {
            const upRt = { ...rt, basePrice: bNum, updatedAt: new Date().toISOString() };
            updatedTypes.push(upRt);
            return upRt;
          }
          return rt;
        });
        updatedTypes.forEach((rt) => this.syncDocToFirestore('roomTypes', rt.id, rt));
      }
    }

    this.logAudit(
      'BULK_RATE_UPDATE',
      'INVENTORY_RATES',
      `${startDateStr} to ${endDateStr}`,
      `Bulk updated for [${rtNames}]. Base Rate: ₹${payload.baseRate || 'Unchanged'}, StopSell: ${payload.stopSell !== undefined ? (payload.stopSell ? 'YES' : 'NO') : 'Unchanged'}`
    );

    this.syncRateMatrixToFirestore();
  }

  updateOtaChannel(channelId, patch) {
    this.otaChannels = this.otaChannels.map(c =>
      c.id === channelId ? { ...c, ...patch, lastSync: 'Just now' } : c
    );
    this.logAudit('OTA_CONFIG', 'CHANNEL', channelId, `Updated channel configuration & sync parameters.`);
    this.save();
  }

  triggerOtaFullSync(channelId) {
    this.otaChannels = this.otaChannels.map(c =>
      c.id === channelId ? { ...c, lastSync: 'Just now (Synced)', connectionStatus: 'Connected & Live' } : c
    );
    const channel = this.otaChannels.find(c => c.id === channelId);
    this.logAudit('OTA_SYNC', 'CHANNEL', channel ? channel.name : channelId, `Pushed full ARI update (Availability, Rates & Inventory).`);
    this.save();
  }

  // --- NIGHT AUDIT AUTOMATION & FINANCIAL DAY-CLOSE ---

  checkAndRunScheduledNightAudit() {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const autoAuditEnabled = this.property?.autoNightAuditEnabled;
      const scheduledHour = this.property?.nightAuditHour ?? 1; // Default 01:00 AM
      if (autoAuditEnabled && currentHour === scheduledHour && currentMinute === 0) {
        const curDate = this.property?.businessDate;
        const alreadyDone = (this.nightAudits || []).some(a => a.date === curDate || a.auditDate === curDate);
        if (!alreadyDone) {
          return this.executeNightAudit('System Automated Scheduler');
        }
      }
    } catch (err) {
      console.error('[PMSStore] checkAndRunScheduledNightAudit error:', err);
    }
    return null;
  }

  executeNightAudit(auditorName = 'Amit Patel (Night Auditor)') {
    const curDate = this.property.businessDate;
    const inHouse = this.reservations.filter(r => r.status === 'in_house');

    let totalRev = 0;
    let totalTax = 0;
    const roomChargesLog = [];

    inHouse.forEach(res => {
      const taxCalc = calculateRoomTax(res.baseRatePerNight, 1);
      totalRev += res.baseRatePerNight;
      totalTax += taxCalc.totalTax;

      roomChargesLog.push({
        room: res.roomNumber,
        guest: res.primaryGuest?.name || res.guestName,
        rate: res.baseRatePerNight,
        tax: taxCalc.totalTax,
        net: res.baseRatePerNight + taxCalc.totalTax,
        folio: res.folioId ? (this.folios[res.folioId]?.folioNumber || 'FOL') : 'FOL'
      });

      // Log per-reservation audit entry so it shows up in Audit Trail
      this.logAudit(
        'NIGHT_AUDIT_PROCESSED',
        'RESERVATION',
        res.bookingReference || res.id,
        `Night Audit Processed: Room charge of ₹${res.baseRatePerNight} + ₹${taxCalc.totalTax} tax posted to folio for ${curDate}.`,
        auditorName || 'HOTEL NIVASA',
        {
          actionType: 'NIGHT_AUDIT_PROCESSED',
          reservationId: res.id,
          bookingReference: res.bookingReference,
          roomNumber: res.roomNumber,
          roomTypeName: res.roomTypeName || '',
          date: curDate,
          amount: res.baseRatePerNight,
          taxAmount: taxCalc.totalTax,
          affectedDates: [curDate],
          status: 'POSTED_TO_FOLIO'
        }
      );
    });

    const nextDateObj = new Date(curDate);
    nextDateObj.setDate(nextDateObj.getDate() + 1);
    const nextDate = nextDateObj.toISOString().split('T')[0];

    this.property = {
      ...this.property,
      businessDate: nextDate
    };

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const curDateFormatted = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const auditRecord = {
      id: `na_${curDate.replace(/-/g, '')}`,
      auditDate: curDate,
      date: formatDisplayDate(curDate),
      newBusinessDate: formatDisplayDate(nextDate),
      newBusinessDateIso: nextDate,
      startedTime: `${curDateFormatted} ${timeFormatted}`,
      startedDate: curDateFormatted,
      startedHour: timeFormatted,
      completedTime: `${curDateFormatted} ${timeFormatted}`,
      completedDate: curDateFormatted,
      completedHour: timeFormatted,
      completedAt: now.toISOString(),
      performedAt: now.toISOString(),
      performedBy: auditorName,
      totalRevenue: totalRev,
      amountPosted: totalRev,
      totalTax: totalTax,
      occupiedRooms: inHouse.length,
      vacantRooms: Math.max(0, this.rooms.length - inHouse.length),
      adr: inHouse.length > 0 ? Math.round(totalRev / inHouse.length) : 0,
      revPar: this.rooms.length > 0 ? Math.round(totalRev / this.rooms.length) : 0,
      occupancyPercent: this.rooms.length > 0 ? Math.round((inHouse.length / this.rooms.length) * 100) : 0,
      status: 'COMPLETED',
      statusText: 'Completed',
      isLocked: true,
      checkedOutCount: this.reservations.filter(r => r.status === 'checked_out' && r.checkOutDate === curDate).length,
      chargesPostedCount: inHouse.length,
      roomCharges: roomChargesLog,
      roomChargesLog
    };

    this.nightAudits = this.standardizeAndSortNightAudits([auditRecord, ...this.nightAudits]);

    this.logAudit(
      'NIGHT_AUDIT',
      'SYSTEM',
      auditRecord.id,
      `Night Audit completed for ${curDate}. Posted ₹${totalRev} room tariffs across ${inHouse.length} in-house folios. Business date advanced to ${nextDate}.`,
      auditorName
    );

    this.save();

    // Async Cloud Firestore Writes
    this.syncDocToFirestore('nightAudits', auditRecord.id, auditRecord);
    this.syncDocToFirestore('', this.propertyId, { businessDate: nextDate, lastAuditDate: curDate, lastAuditId: auditRecord.id });

    return auditRecord;
  }

  setBusinessDate(newDate) {
    if (!newDate) return this.property?.businessDate;
    const cleanDate = normalizeDateStr(newDate) || newDate;
    this.property = {
      ...(this.property || {}),
      businessDate: cleanDate
    };
    this.save();
    this.syncDocToFirestore('', this.propertyId, { businessDate: cleanDate });
    this.notify();
    return cleanDate;
  }

  // --- MULTI-PROPERTY TEAM INVITATION & GRANULAR RBAC ENGINE ---

  inviteTeamMembers({ emails = [], assignments = [], invitedBy = 'HOTEL NIVASA' }) {
    if (!emails.length) return [];

    const newMembers = [];
    const formattedDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    emails.forEach((email, idx) => {
      const trimmedEmail = email.trim().toLowerCase();
      const namePart = trimmedEmail.split('@')[0];
      const displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      const initials = (namePart.charAt(0) || 'U').toUpperCase();

      const propNames = assignments.map(a => a.property).filter(Boolean);
      const primaryRole = assignments[0]?.role || 'Front Desk / Receptionist';

      const token = `inv_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const memberId = `usr_${Date.now()}_${idx}`;

      const initialPermissions = getRoleDefaultPermissions(primaryRole);

      const member = {
        id: memberId,
        name: displayName,
        email: trimmedEmail,
        initials,
        role: primaryRole,
        properties: propNames.length ? propNames : [this.property.name],
        propertyAssignments: assignments,
        status: 'INVITED',
        invitedAt: formattedDate,
        invitedBy,
        invitationToken: token,
        permissions: initialPermissions,
        hasAccount: trimmedEmail === 'ss2137789@gmail.com'
      };

      newMembers.push(member);

      if (!this.invitationTokens) this.invitationTokens = [];
      this.invitationTokens.push({
        token,
        email: trimmedEmail,
        memberId,
        organizationName: this.property.name,
        properties: member.properties,
        role: member.role,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'PENDING'
      });

      this.logAudit('INVITE_MEMBER', 'TEAM', trimmedEmail, `Invited to ${member.properties.join(', ')} as ${primaryRole}`);
    });

    this.teamMembers = [...this.teamMembers, ...newMembers];
    this.save();
    newMembers.forEach(m => {
      this.syncDocToFirestore('teamMembers', m.id, m);
    });
    this.notify();
    return newMembers;
  }

  inviteTeamMember(memberData) {
    return this.inviteTeamMembers({
      emails: [memberData.email],
      assignments: [{ property: this.property.name, role: memberData.role || 'Front Desk / Receptionist' }],
      invitedBy: 'HOTEL NIVASA'
    })[0];
  }

  removeInvitation(memberId) {
    const member = this.teamMembers.find(
      (m) => m.id === memberId || m._firestoreDocId === memberId || m.staffId === memberId || m.email === memberId
    );
    const delIds = [memberId, member?.id, member?._firestoreDocId, member?.staffId, member?.uid, member?.email].filter(Boolean);
    if (!this.deletedTeamMemberIds) this.deletedTeamMemberIds = new Set();
    delIds.forEach((id) => {
      this.deletedTeamMemberIds.add(String(id));
      this.deletedTeamMemberIds.add(String(id).toLowerCase());
    });

    this.teamMembers = this.teamMembers.filter(
      (m) =>
        m.id !== memberId &&
        m._firestoreDocId !== memberId &&
        m.staffId !== memberId &&
        (!member?.email || m.email !== member.email) &&
        (!member?.uid || m.uid !== member.uid)
    );
    if (this.invitationTokens) {
      this.invitationTokens = this.invitationTokens.filter((t) => t.memberId !== memberId);
    }
    if (member) {
      this.logAudit('REVOKE_INVITE', 'TEAM', member.email, `Invitation revoked.`);
      this.deleteDocFromFirestore('teamMembers', memberId);
      if (member.id && member.id !== memberId) {
        this.deleteDocFromFirestore('teamMembers', member.id);
      }
      if (member._firestoreDocId && member._firestoreDocId !== memberId && member._firestoreDocId !== member.id) {
        this.deleteDocFromFirestore('teamMembers', member._firestoreDocId);
      }
      if (member.uid) {
        this.deleteDocFromFirestore('staff', member.uid);
      }
    }
    this.recordCloudDeletion('teamMembers', delIds);
    this.save();
    this.notify();
    return { success: true };
  }

  removeTeamMember(memberId) {
    const member = this.teamMembers.find(
      (m) => m.id === memberId || m._firestoreDocId === memberId || m.staffId === memberId || m.email === memberId
    );
    const delIds = [memberId, member?.id, member?._firestoreDocId, member?.staffId, member?.uid, member?.email].filter(Boolean);
    if (!this.deletedTeamMemberIds) this.deletedTeamMemberIds = new Set();
    delIds.forEach((id) => {
      this.deletedTeamMemberIds.add(String(id));
      this.deletedTeamMemberIds.add(String(id).toLowerCase());
    });
    this.teamMembers = this.teamMembers.filter(
      (m) =>
        m.id !== memberId &&
        m._firestoreDocId !== memberId &&
        m.staffId !== memberId &&
        (!member?.email || m.email !== member.email) &&
        (!member?.uid || m.uid !== member.uid)
    );
    if (member) {
      this.logAudit('REMOVE_MEMBER', 'TEAM', member.email, `Member removed from organization.`);
      this.deleteDocFromFirestore('teamMembers', memberId);
      if (member.id && member.id !== memberId) {
        this.deleteDocFromFirestore('teamMembers', member.id);
      }
      if (member._firestoreDocId && member._firestoreDocId !== memberId && member._firestoreDocId !== member.id) {
        this.deleteDocFromFirestore('teamMembers', member._firestoreDocId);
      }
      if (member.staffId && member.staffId !== memberId && member.staffId !== member.id) {
        this.deleteDocFromFirestore('teamMembers', member.staffId);
      }
      if (member.uid && member.uid !== memberId) {
        this.deleteDocFromFirestore('staff', member.uid);
      } else {
        this.deleteDocFromFirestore('staff', memberId);
      }
    }
    this.recordCloudDeletion('teamMembers', delIds);
    this.syncCurrentUserWithTeamMembers();
    this.save();
    this.notify();
    return { success: true };
  }




  updateTeamMember(memberId, patch) {
    let updatedMember = null;
    this.teamMembers = this.teamMembers.map(m => {
      if (m.id === memberId) {
        updatedMember = { ...m, ...patch };
        return updatedMember;
      }
      return m;
    });
    this.save();
    if (updatedMember) {
      this.syncDocToFirestore('teamMembers', memberId, updatedMember);
    }
    this.notify();
  }

  verifyInviteToken(token) {
    if (!token) return { valid: false, error: 'No invitation token provided.' };
    const member = this.teamMembers.find(m => m.invitationToken === token);
    const tokenRecord = this.invitationTokens?.find(t => t.token === token);

    if (!member && !tokenRecord) {
      return { valid: false, error: 'Invalid or expired invitation token.' };
    }

    const email = member?.email || tokenRecord?.email;
    const properties = member?.properties || tokenRecord?.properties || [this.property.name];
    const role = member?.role || tokenRecord?.role || 'Team Member';
    const accountExists = member?.hasAccount ?? (email === 'ss2137789@gmail.com');

    return {
      valid: true,
      token,
      memberId: member?.id,
      email,
      name: member?.name,
      properties,
      role,
      accountExists,
      organizationName: this.property.name
    };
  }

  acceptInvitation({ token, email, name, password }) {
    const verification = this.verifyInviteToken(token);
    if (!verification.valid) {
      return { success: false, error: verification.error };
    }

    const member = this.teamMembers.find(m => m.invitationToken === token || m.email?.toLowerCase() === email?.toLowerCase());
    if (!member) {
      return { success: false, error: 'Member record not found.' };
    }

    const updatedName = name || member.name || email.split('@')[0];
    const initials = (updatedName.charAt(0) || 'U').toUpperCase();

    member.status = 'ACTIVE';
    member.name = updatedName;
    member.initials = initials;
    member.acceptedAt = new Date().toISOString();
    member.hasAccount = true;

    // Switch active session to this newly accepted member
    this.currentUser = {
      id: member.id,
      name: updatedName,
      email: member.email,
      role: member.role,
      initials,
      status: 'ACTIVE',
      permissions: member.permissions
    };

    this.logAudit('ACCEPT_INVITE', 'TEAM', member.email, `Invitation accepted. Account activated.`);
    this.save();
    this.syncDocToFirestore('teamMembers', member.id, member);
    this.notify();
    return { success: true, member };
  }

  switchUser(userId) {
    if (userId === 'usr_owner' || userId === 'owner') {
      this.currentUser = {
        id: 'usr_owner',
        name: 'HOTEL NIVASA',
        email: 'info@hotelnivasa.com',
        role: 'Owner',
        initials: 'HN',
        status: 'ACTIVE'
      };
    } else {
      const member = this.teamMembers.find(m => m.id === userId);
      if (member) {
        this.currentUser = {
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          initials: member.initials || (member.name ? member.name.charAt(0).toUpperCase() : 'U'),
          status: member.status,
          permissions: member.permissions
        };
      }
    }
    this.save();
    this.notify();
    return { success: true };
  }




  hasPermission(permissionPath) {
    return checkUserPermission(this.currentUser, permissionPath);
  }

  registerProvisionedStaff(memberRecord) {
    if (!memberRecord || !memberRecord.id) return null;
    const existsIdx = (this.teamMembers || []).findIndex(
      (m) => m.id === memberRecord.id || (memberRecord.staffId && m.staffId === memberRecord.staffId)
    );
    if (existsIdx >= 0) {
      this.teamMembers = this.teamMembers.map((m, idx) =>
        idx === existsIdx ? { ...m, ...memberRecord } : m
      );
    } else {
      this.teamMembers = [memberRecord, ...(this.teamMembers || [])];
    }

    this.syncDocToFirestore('teamMembers', memberRecord.id, memberRecord);
    this.syncDocToFirestore('staff', memberRecord.uid || memberRecord.id, memberRecord);
    this.logAudit(
      'CREATE_STAFF_ACCOUNT',
      'RBAC',
      memberRecord.staffId || memberRecord.id,
      `Created staff member ${memberRecord.name} (${memberRecord.role}) with ID ${memberRecord.staffId}.`
    );
    this.save();
    this.notify();
    return memberRecord;
  }

  toggleStaffStatus(memberId) {
    let toggledMember = null;
    this.teamMembers = (this.teamMembers || []).map((m) => {
      if (m.id === memberId) {
        const currentStatus = String(m.status || 'ACTIVE').toUpperCase();
        const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        toggledMember = { ...m, status: nextStatus, updatedAt: new Date().toISOString() };
        this.syncDocToFirestore('teamMembers', m.id, toggledMember);
        this.syncDocToFirestore('staff', toggledMember.uid || toggledMember.id, toggledMember);
        return toggledMember;
      }
      return m;
    });

    if (toggledMember) {
      if (this.currentUser && this.currentUser.id === toggledMember.id) {
        this.currentUser = { ...this.currentUser, status: toggledMember.status };
        if (toggledMember.status === 'SUSPENDED') {
          this.isAuthenticated = false;
        }
      }
      this.logAudit(
        toggledMember.status === 'SUSPENDED' ? 'SUSPEND_STAFF' : 'ACTIVATE_STAFF',
        'RBAC',
        toggledMember.staffId || toggledMember.id,
        `${toggledMember.status === 'SUSPENDED' ? 'Suspended' : 'Activated'} staff member ${toggledMember.name}.`
      );
      this.save();
      this.notify();
    }
    return toggledMember;
  }

  updateGranularPermissions(userId, permissions, targetPropertyNames = [], copyToUserIds = []) {
    const applyToIds = new Set([userId, ...copyToUserIds]);

    this.teamMembers = this.teamMembers.map(m => {
      if (applyToIds.has(m.id)) {
        const updated = {
          ...m,
          permissions: JSON.parse(JSON.stringify(permissions)),
          ...(targetPropertyNames.length ? { properties: targetPropertyNames } : {}),
          updatedAt: new Date().toISOString()
        };
        this.syncDocToFirestore('teamMembers', m.id, updated);
        this.syncDocToFirestore('staff', updated.uid || updated.id, updated);
        return updated;
      }
      return m;
    });

    if (this.currentUser && applyToIds.has(this.currentUser.id)) {
      this.currentUser = {
        ...this.currentUser,
        permissions: JSON.parse(JSON.stringify(permissions))
      };
    }

    this.logAudit('UPDATE_PERMISSIONS', 'RBAC', userId, `Updated granular operational permissions.`);
    this.save();
    this.notify();
    return { success: true };
  }

  syncCurrentUserWithTeamMembers() {
    if (!this.isAuthenticated) {
      this.currentUser = null;
      return;
    }

    const cur = this.currentUser;
    if (!cur) {
      this.isAuthenticated = false;
      try {
        localStorage.setItem('pms_is_authenticated', 'false');
      } catch (e) {}
      return;
    }

    const curEmail = String(cur.email || cur.loginEmail || '').trim().toLowerCase();
    const curStaffId = String(cur.staffId || '').trim().toLowerCase();
    const curName = String(cur.name || '').trim();

    // Purge any stale anonymous "Staff Member" ghost session created by legacy auto-login
    if (curName === 'Staff Member' && !curStaffId && !curEmail) {
      this.isAuthenticated = false;
      this.currentUser = null;
      try {
        localStorage.setItem('pms_is_authenticated', 'false');
        localStorage.removeItem('pms_current_user');
      } catch (e) {}
      return;
    }

    // If explicitly removed by Owner, force sign out
    if (this.deletedTeamMemberIds && cur.id && this.deletedTeamMemberIds.has(String(cur.id))) {
      this.isAuthenticated = false;
      this.currentUser = null;
      try {
        localStorage.setItem('pms_is_authenticated', 'false');
        localStorage.removeItem('pms_current_user');
      } catch (e) {}
      return;
    }

    // Match live record from teamMembers so Owner edits / suspensions apply immediately
    const liveMember = (this.teamMembers || []).find((m) => {
      if (!m) return false;
      if (cur.id && (m.id === cur.id || m.uid === cur.id)) return true;
      if (cur.uid && (m.uid === cur.uid || m.id === cur.uid)) return true;
      if (curStaffId && String(m.staffId || '').trim().toLowerCase() === curStaffId) return true;
      if (
        curEmail &&
        (String(m.email || '').trim().toLowerCase() === curEmail ||
          String(m.loginEmail || '').trim().toLowerCase() === curEmail)
      ) {
        return true;
      }
      return false;
    });

    if (liveMember) {
      const st = String(liveMember.status || 'ACTIVE').toUpperCase();
      if (st === 'SUSPENDED' || st === 'INACTIVE') {
        this.isAuthenticated = false;
        this.currentUser = null;
        try {
          localStorage.setItem('pms_is_authenticated', 'false');
          localStorage.removeItem('pms_current_user');
        } catch (e) {}
        return;
      }

      const rolePresets = getRoleDefaultPermissions();
      const liveRole = liveMember.role || cur.role || 'Front Desk / Receptionist';
      const defaultPerms = rolePresets[liveRole] || rolePresets['Front Desk / Receptionist'];

      this.currentUser = {
        ...cur,
        id: liveMember.id || cur.id,
        uid: liveMember.uid || liveMember.id || cur.uid || cur.id,
        staffId: liveMember.staffId || cur.staffId || '',
        name: (liveRole === 'Owner' || liveMember.name === 'Astha India') ? 'HOTEL NIVASA' : (liveMember.name || cur.name),
        initials: (liveRole === 'Owner' || liveMember.initials === 'AI') ? 'HN' : (liveMember.initials || cur.initials || 'ST'),
        email: liveMember.email || liveMember.loginEmail || cur.email,
        loginEmail: liveMember.loginEmail || liveMember.email || cur.loginEmail,
        role: liveRole,
        status: 'ACTIVE',
        properties: liveMember.properties || cur.properties || ['HOTEL NIVASA'],
        permissions: liveMember.permissions
          ? JSON.parse(JSON.stringify(liveMember.permissions))
          : JSON.parse(JSON.stringify(cur.permissions || defaultPerms))
      };
      try {
        localStorage.setItem('pms_current_user', JSON.stringify(this.currentUser));
      } catch (e) {}
      return;
    }

    // Keep valid authenticated session intact (never falsely log out on refresh while cloud sync catches up)
    if (!cur.role) {
      this.isAuthenticated = false;
      this.currentUser = null;
      try {
        localStorage.setItem('pms_is_authenticated', 'false');
        localStorage.removeItem('pms_current_user');
      } catch (e) {}
    }
  }

  loginUser(userProfile) {
    if (!userProfile || typeof userProfile !== 'object') {
      return { success: false, error: 'Invalid staff credentials.' };
    }

    const cleanEmail = String(userProfile.email || userProfile.loginEmail || '').trim().toLowerCase();
    const cleanStaffId = String(userProfile.staffId || '').trim().toLowerCase();

    if (!cleanEmail && !cleanStaffId && !userProfile.role) {
      return { success: false, error: 'Please sign in with a valid Staff ID or email.' };
    }

    // Match live record from teamMembers so Owner-configured permissions & status always win
    const liveRecord = (this.teamMembers || []).find((m) => {
      if (!m) return false;
      if (userProfile.id && (m.id === userProfile.id || m.uid === userProfile.id)) return true;
      if (userProfile.uid && (m.uid === userProfile.uid || m.id === userProfile.uid)) return true;
      if (cleanStaffId && String(m.staffId || '').trim().toLowerCase() === cleanStaffId) return true;
      if (
        cleanEmail &&
        (String(m.email || '').trim().toLowerCase() === cleanEmail ||
          String(m.loginEmail || '').trim().toLowerCase() === cleanEmail)
      ) {
        return true;
      }
      return false;
    });

    const merged = liveRecord ? { ...userProfile, ...liveRecord } : userProfile;
    const mergedStatus = String(merged.status || 'ACTIVE').toUpperCase();
    if (mergedStatus === 'SUSPENDED' || mergedStatus === 'INACTIVE') {
      this.isAuthenticated = false;
      this.currentUser = null;
      try {
        localStorage.setItem('pms_is_authenticated', 'false');
      } catch (e) {}
      this.save();
      this.notify();
      return { success: false, error: 'Account has been suspended by the Owner.' };
    }

    const isExplicitOwner =
      merged.role === 'Owner' ||
      merged.id === 'usr_owner' ||
      cleanEmail === 'info@hotelnivasa.com' ||
      cleanEmail === 'owner@hotelnivasa.com' ||
      cleanEmail === 'owner@hotelastha.com' ||
      cleanEmail === 'info@asthasoftindia.com';

    const userRole = merged.role || (isExplicitOwner ? 'Owner' : null);
    if (!userRole) {
      return { success: false, error: 'Unrecognized staff account. Contact the hotel Owner.' };
    }

    const rolePresets = getRoleDefaultPermissions();
    const defaultPerms = rolePresets[userRole] || rolePresets['Front Desk / Receptionist'];

    this.currentUser = {
      id: merged.id || `usr_${Date.now()}`,
      uid: merged.uid || merged.id || `usr_${Date.now()}`,
      staffId: merged.staffId || '',
      name: merged.name || (isExplicitOwner ? 'HOTEL NIVASA' : cleanEmail.split('@')[0] || 'Staff'),
      email: merged.email || merged.loginEmail || '',
      loginEmail: merged.loginEmail || merged.email || '',
      role: userRole,
      initials:
        merged.initials ||
        (merged.name
          ? merged.name
              .split(/\s+/)
              .map((p) => p[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
          : 'ST'),
      avatar: merged.avatar || (userRole === 'Owner' ? '👑' : '👤'),
      status: 'ACTIVE',
      properties: merged.properties || ['HOTEL NIVASA'],
      permissions: merged.permissions
        ? JSON.parse(JSON.stringify(merged.permissions))
        : JSON.parse(JSON.stringify(defaultPerms))
    };

    this.isAuthenticated = true;
    try {
      localStorage.setItem('pms_is_authenticated', 'true');
      localStorage.setItem('pms_current_user', JSON.stringify(this.currentUser));
    } catch (e) {}
    this.logAudit(
      'STAFF_LOGIN',
      'AUTH',
      this.currentUser?.staffId || this.currentUser?.id || 'usr_staff',
      `Staff ${this.currentUser?.name} (${this.currentUser?.role}) signed in successfully.`
    );
    this.save();
    this.notify();
    return { success: true, user: this.currentUser };
  }

  logoutUser() {
    const prevUser = this.currentUser;
    this.logAudit('STAFF_LOGOUT', 'AUTH', prevUser?.staffId || prevUser?.id || 'usr_staff', `Staff ${prevUser?.name || 'User'} signed out.`);
    this.isAuthenticated = false;
    this.currentUser = null;
    try {
      localStorage.setItem('pms_is_authenticated', 'false');
      localStorage.removeItem('pms_current_user');
    } catch (e) {}
    this.save();
    this.notify();
    return { success: true };
  }

  updatePermissions(userId, permissions) {
    this.updateGranularPermissions(userId, permissions);
  }

  addMealPlan(planData) {
    const id = `mp_${Date.now()}`;
    const newPlan = {
      id,
      code: planData.code?.toUpperCase() || `MP${this.mealPlans.length + 1}`,
      name: planData.name || 'Custom Meal Plan',
      inclusions: planData.inclusions || [],
      pricingModel: planData.pricingModel || 'PER_PERSON',
      adultPrice: Number(planData.adultPrice) || 0,
      childPrice: Number(planData.childPrice) || 0,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    this.mealPlans = [...(this.mealPlans || []), newPlan];
    this.logAudit('CREATE_MEAL_PLAN', 'PROPERTIES', newPlan.code, `Created meal plan ${newPlan.name}`);
    this.save();
    this.syncDocToFirestore('mealPlans', newPlan.id, newPlan);
    this.notify();
    return newPlan;
  }

  updateMealPlan(planId, patch) {
    let updatedPlan = null;
    this.mealPlans = (this.mealPlans || []).map(p => {
      if (p.id === planId) {
        updatedPlan = { ...p, ...patch };
        return updatedPlan;
      }
      return p;
    });
    this.logAudit('UPDATE_MEAL_PLAN', 'PROPERTIES', planId, `Updated meal plan.`);
    this.save();
    if (updatedPlan) {
      this.syncDocToFirestore('mealPlans', planId, updatedPlan);
    }
    this.notify();
  }

  deleteMealPlan(planId) {
    const plan = this.mealPlans?.find(p => p.id === planId || p.code === planId);
    this.mealPlans = (this.mealPlans || []).filter(p => p.id !== planId && p.code !== planId);
    if (plan) {
      this.logAudit('DELETE_MEAL_PLAN', 'PROPERTIES', plan.code, `Removed meal plan ${plan.name}`);
      this.deleteDocFromFirestore('mealPlans', plan.id);
      if (plan.code && plan.code !== plan.id) {
        this.deleteDocFromFirestore('mealPlans', plan.code);
      }
    } else {
      this.deleteDocFromFirestore('mealPlans', planId);
    }
    this.save();
    this.notify();
    return { success: true };
  }




  addRatePlan(planData) {
    const id = planData.id || `rp_${Date.now()}`;
    const code = (planData.code || `RP${(this.ratePlans || []).length + 1}`).trim().toUpperCase();
    const newPlan = {
      id,
      name: (planData.name || 'New Rate Plan').trim(),
      code,
      mealPlanId: planData.mealPlanId || null,
      mealPlanName: planData.mealPlanName || (planData.mealPlanId ? this.mealPlans?.find(m => m.id === planData.mealPlanId)?.name : '-'),
      status: planData.status || 'ACTIVE',
      roomTypeRates: planData.roomTypeRates || {},
      createdAt: new Date().toISOString()
    };

    let found = false;
    this.ratePlans = (this.ratePlans || []).map(p => {
      const pCode = (p.code || '').trim().toUpperCase();
      const pId = (p.id || '').trim();
      if (pCode === code || pId === id) {
        found = true;
        return { ...p, ...newPlan, id: p.id || id };
      }
      return p;
    });
    if (!found) {
      this.ratePlans = [...(this.ratePlans || []), newPlan];
    }
    this.logAudit('CREATE_RATE_PLAN', 'PROPERTIES', newPlan.code, `Created rate plan ${newPlan.name}`);
    this.save();
    this.syncDocToFirestore('ratePlans', newPlan.id, newPlan);
    if (newPlan.code && newPlan.code !== newPlan.id) {
      this.syncDocToFirestore('ratePlans', newPlan.code, newPlan);
    }
    this.notify();
    return newPlan;
  }

  updateRatePlan(planId, patch) {
    let updatedPlan = null;
    const targetId = String(planId || '').trim();
    const targetCode = String(patch?.code || '').trim().toUpperCase();
    const targetName = String(patch?.name || '').trim().toLowerCase();

    this.ratePlans = (this.ratePlans || []).map(p => {
      const pId = String(p.id || '').trim();
      const pCode = String(p.code || '').trim().toUpperCase();
      const pName = String(p.name || '').trim().toLowerCase();

      const isMatch = (
        (targetId && (pId === targetId || pCode === targetId)) ||
        (targetCode && pCode === targetCode) ||
        (targetName && pName === targetName)
      );

      if (isMatch && !updatedPlan) {
        updatedPlan = {
          ...p,
          ...patch,
          id: p.id || (targetId.startsWith('rp_') ? targetId : `rp_${Date.now()}`),
          code: (patch.code || p.code || targetCode).toUpperCase(),
          name: (patch.name || p.name || 'Rate Plan').trim(),
          mealPlanId: patch.mealPlanId !== undefined ? patch.mealPlanId : p.mealPlanId,
          mealPlanName: patch.mealPlanName !== undefined ? patch.mealPlanName : p.mealPlanName,
          status: patch.status || p.status || 'ACTIVE',
          roomTypeRates: patch.roomTypeRates !== undefined ? patch.roomTypeRates : (p.roomTypeRates || {})
        };
        return updatedPlan;
      }
      return p;
    });

    if (!updatedPlan) {
      const newId = (targetId && targetId.startsWith('rp_')) ? targetId : `rp_${Date.now()}`;
      updatedPlan = {
        id: newId,
        name: (patch.name || 'New Rate Plan').trim(),
        code: (patch.code || targetCode || 'RP').toUpperCase(),
        mealPlanId: patch.mealPlanId || null,
        mealPlanName: patch.mealPlanName || '-',
        status: patch.status || 'ACTIVE',
        roomTypeRates: patch.roomTypeRates || {},
        ...patch
      };
      this.ratePlans = [...(this.ratePlans || []), updatedPlan];
    }

    // Deduplicate ratePlans by code/id so duplicates are completely eliminated
    const dedupeMap = new Map();
    (this.ratePlans || []).forEach(rp => {
      const c = (rp.code || rp.id || '').trim().toUpperCase();
      if (!dedupeMap.has(c)) {
        dedupeMap.set(c, rp);
      } else {
        const existing = dedupeMap.get(c);
        dedupeMap.set(c, { ...existing, ...rp });
      }
    });
    this.ratePlans = Array.from(dedupeMap.values());

    this.logAudit('UPDATE_RATE_PLAN', 'PROPERTIES', updatedPlan.code || planId, `Updated rate plan ${updatedPlan.name}.`);
    this.save();

    // Sync to Firestore under both the plan.id and the plan.code to ensure complete cloud persistence
    if (updatedPlan) {
      if (updatedPlan.id) {
        this.syncDocToFirestore('ratePlans', updatedPlan.id, updatedPlan);
      }
      if (updatedPlan.code && updatedPlan.code !== updatedPlan.id) {
        this.syncDocToFirestore('ratePlans', updatedPlan.code, updatedPlan);
      }
      if (planId && planId !== updatedPlan.id && planId !== updatedPlan.code) {
        this.syncDocToFirestore('ratePlans', planId, updatedPlan);
      }
    }
    this.notify();
    return updatedPlan;
  }

  deleteRatePlan(planId) {
    const plan = this.ratePlans?.find(p => p.id === planId || p.code === planId);
    this.ratePlans = (this.ratePlans || []).filter(p => p.id !== planId && p.code !== planId);
    if (!this.deletedRatePlanIds) this.deletedRatePlanIds = new Set();
    this.deletedRatePlanIds.add(String(planId));
    if (plan?.code) this.deletedRatePlanIds.add(String(plan.code));
    if (plan?.id) this.deletedRatePlanIds.add(String(plan.id));

    if (plan) {
      this.logAudit('DELETE_RATE_PLAN', 'PROPERTIES', plan.code, `Removed rate plan ${plan.name}`);
      this.deleteDocFromFirestore('ratePlans', plan.id);
      if (plan.code && plan.code !== plan.id) {
        this.deleteDocFromFirestore('ratePlans', plan.code);
      }
    } else {
      this.deleteDocFromFirestore('ratePlans', planId);
    }
    this.save();
    this.notify();
    return { success: true };
  }

  addTaxRule(ruleData) {
    const id = ruleData.id || `tax_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newRule = {
      id,
      name: (ruleData.name || 'Custom Tax Rule').trim(),
      presentationLabel: (ruleData.presentationLabel || ruleData.name || 'TAX').trim(),
      categoryType: ruleData.categoryType || 'GST',
      calculationMode: ruleData.calculationMode || 'percentage',
      priceInclusion: ruleData.priceInclusion || 'EXCLUSIVE',
      useSlabs: ruleData.useSlabs === true,
      rate: Number(ruleData.rate) || 0,
      slabs: Array.isArray(ruleData.slabs) ? ruleData.slabs : [],
      splits: Array.isArray(ruleData.splits) ? ruleData.splits : [],
      status: ruleData.status || 'active',
      createdAt: new Date().toISOString()
    };
    this.taxRules = [...(this.taxRules || []), newRule];
    setActiveTaxRules(this.taxRules);
    this.logAudit('CREATE_TAX_RULE', 'PROPERTIES', newRule.id, `Created tax rule ${newRule.name}`);
    this.save();
    this.syncDocToFirestore('taxRules', newRule.id, newRule);
    this.notify();
    return newRule;
  }

  updateTaxRule(ruleId, patch) {
    let updatedRule = null;
    this.taxRules = (this.taxRules || []).map(r => {
      if (r.id === ruleId) {
        updatedRule = {
          ...r,
          ...patch,
          id: r.id,
          updatedAt: new Date().toISOString()
        };
        return updatedRule;
      }
      return r;
    });

    if (updatedRule) {
      setActiveTaxRules(this.taxRules);
      this.logAudit('UPDATE_TAX_RULE', 'PROPERTIES', updatedRule.id, `Updated tax rule ${updatedRule.name}`);
      this.save();
      this.syncDocToFirestore('taxRules', updatedRule.id, updatedRule);
      this.notify();
    }
    return updatedRule;
  }

  deleteTaxRule(ruleId) {
    const rule = (this.taxRules || []).find(r => r.id === ruleId);
    this.taxRules = (this.taxRules || []).filter(r => r.id !== ruleId);
    setActiveTaxRules(this.taxRules);
    if (rule) {
      this.logAudit('DELETE_TAX_RULE', 'PROPERTIES', rule.id, `Deleted tax rule ${rule.name}`);
      this.deleteDocFromFirestore('taxRules', rule.id);
    }
    this.save();
    this.notify();
    return { success: true };
  }

  addServiceCharge(chargeData) {
    const id = chargeData.id || `svc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newCharge = {
      id,
      name: (chargeData.name || 'Service Charge').trim(),
      category: chargeData.category || 'Food & Beverage',
      sacCode: (chargeData.sacCode || '').trim(),
      price: Number(chargeData.price) || 0,
      taxRuleId: chargeData.taxRuleId || '',
      status: chargeData.status || 'active',
      createdAt: new Date().toISOString()
    };
    this.serviceCharges = [...(this.serviceCharges || []), newCharge];
    this.logAudit('CREATE_SERVICE_CHARGE', 'PROPERTIES', newCharge.id, `Created service charge ${newCharge.name}`);
    this.save();
    this.syncDocToFirestore('serviceCharges', newCharge.id, newCharge);
    this.notify();
    return newCharge;
  }

  updateServiceCharge(chargeId, patch) {
    let updatedCharge = null;
    this.serviceCharges = (this.serviceCharges || []).map(s => {
      if (s.id === chargeId) {
        updatedCharge = {
          ...s,
          ...patch,
          id: s.id,
          updatedAt: new Date().toISOString()
        };
        return updatedCharge;
      }
      return s;
    });

    if (updatedCharge) {
      this.logAudit('UPDATE_SERVICE_CHARGE', 'PROPERTIES', updatedCharge.id, `Updated service charge ${updatedCharge.name}`);
      this.save();
      this.syncDocToFirestore('serviceCharges', updatedCharge.id, updatedCharge);
      this.notify();
    }
    return updatedCharge;
  }

  deleteServiceCharge(chargeId) {
    const charge = (this.serviceCharges || []).find(s => s.id === chargeId);
    this.serviceCharges = (this.serviceCharges || []).filter(s => s.id !== chargeId);
    if (charge) {
      this.logAudit('DELETE_SERVICE_CHARGE', 'PROPERTIES', charge.id, `Deleted service charge ${charge.name}`);
      this.deleteDocFromFirestore('serviceCharges', charge.id);
    }
    this.save();
    this.notify();
    return { success: true };
  }




  addRoomType(roomTypeData) {
    const cleanName = String(roomTypeData.name || 'New Room Type').trim();
    const cleanCode = String(roomTypeData.code || '').trim().toUpperCase();
    const newRoomType = {
      id: `rt_${Date.now()}`,
      name: cleanName,
      code: cleanCode,
      baseAdults: Number.isFinite(parseInt(roomTypeData.baseAdults, 10)) ? parseInt(roomTypeData.baseAdults, 10) : 2,
      maxAdults: Number.isFinite(parseInt(roomTypeData.maxAdults, 10)) ? parseInt(roomTypeData.maxAdults, 10) : 2,
      baseChildren: Number.isFinite(parseInt(roomTypeData.baseChildren, 10)) ? parseInt(roomTypeData.baseChildren, 10) : 0,
      maxChildren: Number.isFinite(parseInt(roomTypeData.maxChildren, 10)) ? parseInt(roomTypeData.maxChildren, 10) : 0,
      status: roomTypeData.status || 'ACTIVE',
      basePrice: Number(roomTypeData.basePrice) || 1000,
      extraAdultPrice: Number(roomTypeData.extraAdultPrice) || 500,
      extraChildPrice: Number(roomTypeData.extraChildPrice) || 250,
      color: roomTypeData.color || '#3b82f6'
    };

    if (this.inFlightDeletes) {
      this.inFlightDeletes.delete(cleanCode);
      this.inFlightDeletes.delete(cleanName.toLowerCase());
      this.inFlightDeletes.delete(newRoomType.id);
    }
    this.recordCloudRestoration('roomTypes', [newRoomType.id, cleanCode, cleanName.toLowerCase()]);
    newRoomType._pendingSync = true;

    this.roomTypes = [...(this.roomTypes || []), newRoomType];

    // Automatically update existing rate plans so this room type is included with default active rate
    this.ratePlans = (this.ratePlans || []).map(rp => {
      const updatedRates = {
        ...(rp.roomTypeRates || {}),
        [newRoomType.id]: {
          active: true,
          basePrice: newRoomType.basePrice || 1000,
          extraAdult: newRoomType.extraAdultPrice || 500,
          extraChild: newRoomType.extraChildPrice || 250
        }
      };
      const updatedPlan = { ...rp, roomTypeRates: updatedRates };
      this.syncDocToFirestore('ratePlans', updatedPlan.id, updatedPlan);
      if (updatedPlan.code && updatedPlan.code !== updatedPlan.id) {
        this.syncDocToFirestore('ratePlans', updatedPlan.code, updatedPlan);
      }
      return updatedPlan;
    });

    this.logAudit('ADD_ROOM_TYPE', 'PROPERTIES', newRoomType.id, `Created room type ${newRoomType.name}`);
    this.save();
    this.syncDocToFirestore('roomTypes', newRoomType.id, newRoomType);
    this.syncAllRoomsAndTypesToCloud();
    this.notify();
    return newRoomType;
  }

  updateRoomType(roomTypeId, patch) {
    let updated = null;
    let oldRt = null;
    this.roomTypes = (this.roomTypes || []).map((rt) => {
      if (rt.id === roomTypeId || rt.code === roomTypeId) {
        oldRt = { ...rt };
        updated = { ...rt, ...patch, id: rt.id, updatedAt: new Date().toISOString() };
        return updated;
      }
      return rt;
    });

    if (updated) {
      // 1. If room type name or code changed, cascade update to rooms
      if (patch.name && oldRt?.name !== patch.name) {
        this.rooms = (this.rooms || []).map((rm) => {
          if (rm.roomTypeId === updated.id || rm.roomTypeName === oldRt?.name || rm.roomType === oldRt?.name) {
            return {
              ...rm,
              roomTypeId: updated.id,
              roomTypeName: updated.name,
              roomType: updated.name,
              roomTypeCode: updated.code || rm.roomTypeCode
            };
          }
          return rm;
        });

        // Also cascade to reservations
        (this.reservations || []).forEach((res) => {
          if (res.roomTypeId === updated.id || res.roomTypeName === oldRt?.name) {
            res.roomTypeName = updated.name;
            res.roomType = updated.name;
          }
        });
      }

      // 2. If rate info changed, update in rate plans
      if (patch.basePrice || patch.extraAdultPrice || patch.extraChildPrice) {
        this.ratePlans = (this.ratePlans || []).map((rp) => {
          if (rp.roomTypeRates && rp.roomTypeRates[roomTypeId]) {
            const prev = rp.roomTypeRates[roomTypeId];
            const updatedRates = {
              ...rp.roomTypeRates,
              [roomTypeId]: {
                ...prev,
                basePrice: patch.basePrice !== undefined ? Number(patch.basePrice) : prev.basePrice,
                extraAdult: patch.extraAdultPrice !== undefined ? Number(patch.extraAdultPrice) : prev.extraAdult,
                extraChild: patch.extraChildPrice !== undefined ? Number(patch.extraChildPrice) : prev.extraChild
              }
            };
            const updatedPlan = { ...rp, roomTypeRates: updatedRates };
            this.syncDocToFirestore('ratePlans', updatedPlan.id, updatedPlan);
            if (updatedPlan.code && updatedPlan.code !== updatedPlan.id) {
              this.syncDocToFirestore('ratePlans', updatedPlan.code, updatedPlan);
            }
            return updatedPlan;
          }
          return rp;
        });
      }

      this.logAudit('UPDATE_ROOM_TYPE', 'PROPERTIES', roomTypeId, `Updated room type ${updated.name}.`);
      this.save();
      this.syncDocToFirestore('roomTypes', updated.id, updated);
      this.syncAllRoomsAndTypesToCloud();
      this.notify();
    }
    return { success: !!updated, roomType: updated };
  }

  deleteRoomType(roomTypeId) {
    if (!roomTypeId) return { success: false, message: 'Invalid room type ID' };

    const targetKey = String(roomTypeId).trim().toLowerCase();
    const rt = (this.roomTypes || []).find((r) => {
      const rId = String(r.id || '').trim().toLowerCase();
      const rCode = String(r.code || '').trim().toLowerCase();
      const rName = String(r.name || '').trim().toLowerCase();
      return rId === targetKey || rCode === targetKey || rName === targetKey || (targetKey && (rId === `rt_${targetKey}` || `rt_${rId}` === targetKey));
    });

    const toDeleteAliases = new Set();
    toDeleteAliases.add(targetKey);
    toDeleteAliases.add(String(roomTypeId));
    if (rt) {
      if (rt.id) {
        toDeleteAliases.add(String(rt.id));
        toDeleteAliases.add(String(rt.id).toLowerCase());
      }
      if (rt.code) {
        toDeleteAliases.add(String(rt.code));
        toDeleteAliases.add(String(rt.code).toLowerCase());
      }
      if (rt.name) {
        toDeleteAliases.add(String(rt.name));
        toDeleteAliases.add(String(rt.name).toLowerCase());
      }
    }

    // Include common synonyms ONLY for obsolete system legacy types
    if (targetKey.includes('normal') || targetKey.includes('standard') || (rt && (rt.name?.toLowerCase().includes('normal') || rt.name?.toLowerCase().includes('standard')))) {
      ['rt_standard', 'rt_normal', 'nrm', 'std', 'normal', 'standard', 'standard room'].forEach((a) => toDeleteAliases.add(a));
    }
    if (targetKey.includes('premium') && !targetKey.includes('ultra') && (rt && rt.name?.toLowerCase() === 'premium')) {
      ['rt_premium', 'prm', 'premium'].forEach((a) => toDeleteAliases.add(a));
    }
    if (targetKey.includes('ultra') || (rt && rt.name?.toLowerCase().includes('ultra'))) {
      ['rt_ultra_premium', 'ulp', 'ultra premium'].forEach((a) => toDeleteAliases.add(a));
    }

    const isMatch = (r) => {
      if (!r) return false;
      const rId = String(r.id || '').trim().toLowerCase();
      const rCode = String(r.code || '').trim().toLowerCase();
      const rName = String(r.name || '').trim().toLowerCase();
      return toDeleteAliases.has(rId) || toDeleteAliases.has(rCode) || toDeleteAliases.has(rName);
    };

    const remainingRoomTypes = (this.roomTypes || []).filter((r) => !isMatch(r));
    const fallbackRt = remainingRoomTypes.length > 0 ? remainingRoomTypes[0] : null;

    // Safely reassign any rooms assigned to this room type (even if occupied)
    this.rooms = (this.rooms || []).map((r) => {
      const rTypeId = String(r.roomTypeId || '').trim().toLowerCase();
      const rTypeName = String(r.roomTypeName || r.roomType || '').trim().toLowerCase();
      const isAssigned = toDeleteAliases.has(rTypeId) || toDeleteAliases.has(rTypeName);
      if (isAssigned) {
        const updatedRoom = {
          ...r,
          roomTypeId: fallbackRt ? fallbackRt.id : '',
          roomTypeName: fallbackRt ? fallbackRt.name : 'Unassigned',
          roomType: fallbackRt ? fallbackRt.name : 'Unassigned'
        };
        this.syncDocToFirestore('rooms', updatedRoom.id, updatedRoom);
        return updatedRoom;
      }
      return r;
    });

    // Also safely update any reservations linked to this room type
    this.reservations = (this.reservations || []).map((res) => {
      const resTypeId = String(res.roomTypeId || '').trim().toLowerCase();
      const resTypeName = String(res.roomTypeName || res.roomType || '').trim().toLowerCase();
      const isLinked = toDeleteAliases.has(resTypeId) || toDeleteAliases.has(resTypeName);
      if (isLinked) {
        const updatedRes = {
          ...res,
          roomTypeId: fallbackRt ? fallbackRt.id : (res.roomTypeId || ''),
          roomTypeName: fallbackRt ? fallbackRt.name : (res.roomTypeName || 'Unassigned'),
          roomType: fallbackRt ? fallbackRt.name : (res.roomType || 'Unassigned')
        };
        this.syncDocToFirestore('reservations', updatedRes.id, updatedRes);
        return updatedRes;
      }
      return res;
    });

    this.roomTypes = remainingRoomTypes;
    if (!this.inFlightDeletes) this.inFlightDeletes = new Set();
    if (rt?.id) this.inFlightDeletes.add(String(rt.id));
    this.inFlightDeletes.add(String(roomTypeId));

    this.logAudit('DELETE_ROOM_TYPE', 'PROPERTIES', rt?.id || roomTypeId, `Deleted room type ${rt?.name || roomTypeId}`);

    toDeleteAliases.forEach((did) => {
      this.deleteDocFromFirestore('roomTypes', did);
    });

    this.purgeMatchingCloudRoomTypes(rt?.id || roomTypeId, rt?.code, rt?.name, toDeleteAliases);
    const cloudDelIds = [rt?.id, roomTypeId].filter(Boolean);
    this.recordCloudDeletion('roomTypes', cloudDelIds);

    // Clean up rates in rate plans
    this.ratePlans = (this.ratePlans || []).map((rp) => {
      if (!rp.roomTypeRates) return rp;
      let changed = false;
      const newRates = { ...rp.roomTypeRates };
      Array.from(toDeleteAliases).forEach((key) => {
        if (newRates[key]) {
          delete newRates[key];
          changed = true;
        }
      });
      if (changed) {
        const updatedPlan = { ...rp, roomTypeRates: newRates };
        this.syncDocToFirestore('ratePlans', updatedPlan.id, updatedPlan);
        return updatedPlan;
      }
      return rp;
    });

    this.save();
    this.syncAllRoomsAndTypesToCloud();
    this.notify();
    return { success: true };
  }




  addRooms(newRoomsList) {
    const created = [];
    (newRoomsList || []).forEach((item) => {
      const cleanNum = String(item.roomNumber || '').trim();
      if (!cleanNum) return;
      const numKey = cleanNum.toLowerCase().replace(/^rm_/, '');
      const canonicalId = `rm_${numKey}`;
      const existing = (this.rooms || []).find(
        (r) =>
          String(r.roomNumber || '').trim().toLowerCase() === numKey ||
          String(r.id || '').trim().toLowerCase() === canonicalId
      );

      let rTypeName = item.roomTypeName;
      const matchedRt = (this.roomTypes || []).find(
        (rt) => rt.id === item.roomTypeId || rt.code === item.roomTypeId || rt.name?.toLowerCase() === String(item.roomTypeId || '').toLowerCase()
      );
      if (matchedRt) {
        rTypeName = matchedRt.name;
      } else if (!rTypeName) {
        if (cleanNum.startsWith('2')) rTypeName = 'SUPIRIOR';
        else if (cleanNum.startsWith('3')) rTypeName = 'DOUBLE SIGNLE';
        else rTypeName = 'Delux Room';
      }

      if (existing) {
        existing.roomTypeId = item.roomTypeId || existing.roomTypeId;
        existing.roomTypeName = rTypeName || existing.roomTypeName;
        existing.roomType = rTypeName || existing.roomType;
        existing.status = item.status === 'Active' || item.status === 'clean' ? 'clean' : (item.status || existing.status);
        existing.updatedAt = new Date().toISOString();
        existing._pendingSync = true;
        created.push(existing);
      } else {
        const rm = {
          id: canonicalId,
          roomNumber: cleanNum,
          roomTypeId: item.roomTypeId || (matchedRt ? matchedRt.id : (cleanNum.startsWith('2') ? 'rt_supirior' : cleanNum.startsWith('3') ? 'rt_double_single' : 'rt_deluxe')),
          roomTypeName: rTypeName,
          roomType: rTypeName,
          floor: item.floor || cleanNum.charAt(0) || '1',
          status: item.status === 'Active' || item.status === 'clean' ? 'clean' : (item.status || 'clean'),
          operational: 'available',
          notes: 'Ready for check-in',
          updatedAt: new Date().toISOString(),
          _pendingSync: true
        };
        if (this.inFlightDeletes) {
          this.inFlightDeletes.delete(canonicalId);
          this.inFlightDeletes.delete(cleanNum);
          this.inFlightDeletes.delete(numKey);
          this.inFlightDeletes.delete(String(cleanNum));
        }
        created.push(rm);
      }

      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem('pms_deleted_entities');
        }
      } catch (_) {}

      this.recordCloudRestoration('rooms', [canonicalId, cleanNum, numKey]);
    });

    this.rooms = this.dedupeRoomsByNumber([...(this.rooms || []), ...created], false);
    this.canonicalizeRoomsAndRoomTypes();
    this.logAudit('ADD_ROOMS', 'PROPERTIES', '', `Added ${created.length} new rooms.`);
    this.save();
    this.notify(); // Immediate UI render with zero latency!

    // Asynchronous background cloud sync
    Promise.resolve().then(async () => {
      for (const rm of created) {
        await this.syncDocToFirestore('rooms', rm.id, rm);
      }
      await this.syncAllRoomsAndTypesToCloud();
    });

    return created;
  }

  updateRoom(roomId, patch) {
    let updated = null;
    let oldRoom = null;
    const targetKey = String(roomId || '').trim().toLowerCase().replace(/^rm_/, '');

    this.rooms = (this.rooms || []).map((rm) => {
      const rKey = String(rm.roomNumber || rm.id || '').trim().toLowerCase().replace(/^rm_/, '');
      if (rm.id === roomId || rm.roomNumber === roomId || (targetKey && rKey === targetKey)) {
        oldRoom = { ...rm };
        let rtName = patch.roomTypeName;
        let rtCode = patch.roomTypeCode;
        if (patch.roomTypeId) {
          const matchedRt = (this.roomTypes || []).find(
            (rt) => rt.id === patch.roomTypeId || rt.code === patch.roomTypeId
          );
          if (matchedRt) {
            rtName = matchedRt.name;
            rtCode = matchedRt.code;
          }
        }
        const cleanNewNum = patch.roomNumber ? String(patch.roomNumber).trim() : rm.roomNumber;
        updated = {
          ...rm,
          ...patch,
          roomNumber: cleanNewNum,
          roomTypeId: patch.roomTypeId || rm.roomTypeId,
          roomTypeName: rtName || patch.roomTypeName || rm.roomTypeName,
          roomType: rtName || patch.roomTypeName || rm.roomType || rm.roomTypeName,
          roomTypeCode: rtCode || rm.roomTypeCode,
          floor: patch.floor || (cleanNewNum ? cleanNewNum.charAt(0) : rm.floor) || '1',
          updatedAt: new Date().toISOString()
        };
        return updated;
      }
      return rm;
    });

    if (updated) {
      const oldNum = String(oldRoom?.roomNumber || '').trim();
      const newNum = String(updated.roomNumber || '').trim();

      // If room number changed, delete old document keys from Firestore and update reservations
      if (oldNum && newNum && oldNum !== newNum) {
        this.deleteDocFromFirestore('rooms', `rm_${oldNum}`);
        this.deleteDocFromFirestore('rooms', oldNum);
        if (oldRoom?.id && oldRoom.id !== updated.id) {
          this.deleteDocFromFirestore('rooms', oldRoom.id);
        }
        (this.reservations || []).forEach((res) => {
          if (res.roomId === oldRoom?.id || res.roomNumber === oldNum) {
            res.roomId = updated.id;
            res.roomNumber = newNum;
          }
        });
      }

      // If room type changed, update reservations assigned to this room
      if (patch.roomTypeId && updated.roomTypeId) {
        (this.reservations || []).forEach((res) => {
          if (res.roomId === updated.id || res.roomNumber === updated.roomNumber) {
            res.roomTypeId = updated.roomTypeId;
            res.roomTypeName = updated.roomTypeName;
          }
        });
      }

      this.logAudit('UPDATE_ROOM', 'PROPERTIES', updated.roomNumber, `Updated room ${updated.roomNumber}`);
      this.save();
      this.syncDocToFirestore('rooms', updated.id, updated);
      if (updated.roomNumber) {
        this.syncDocToFirestore('rooms', `rm_${updated.roomNumber}`, updated);
      }
      this.syncAllRoomsAndTypesToCloud();
      this.notify();
    }
    return { success: !!updated, room: updated };
  }

  deleteRoom(roomId) {
    const targetNumKey = String(roomId || '').trim().toLowerCase().replace(/^rm_/, '');
    const rm = (this.rooms || []).find((r) => {
      const rNumKey = String(r.roomNumber || r.id || '').trim().toLowerCase().replace(/^rm_/, '');
      return r.id === roomId || r.roomNumber === roomId || (targetNumKey && rNumKey === targetNumKey);
    });
    const rmNumKey = rm
      ? String(rm.roomNumber || rm.id || '').trim().toLowerCase().replace(/^rm_/, '')
      : targetNumKey;

    this.rooms = (this.rooms || []).filter((r) => {
      const rNumKey = String(r.roomNumber || r.id || '').trim().toLowerCase().replace(/^rm_/, '');
      return r.id !== roomId && r.roomNumber !== roomId && (!rmNumKey || rNumKey !== rmNumKey);
    });

    if (!this.inFlightDeletes) this.inFlightDeletes = new Set();
    this.inFlightDeletes.add(String(roomId));
    const canonicalId = rmNumKey ? `rm_${rmNumKey}` : roomId;
    if (canonicalId) this.inFlightDeletes.add(canonicalId);
    if (rm?.id) this.inFlightDeletes.add(String(rm.id));
    if (rm?._firestoreDocId) this.inFlightDeletes.add(String(rm._firestoreDocId));

    if (rm) {
      this.logAudit('DELETE_ROOM', 'PROPERTIES', rm.roomNumber, `Deleted room ${rm.roomNumber}`);

      const toDelete = new Set([rm.id, rm._firestoreDocId, canonicalId, String(rm.roomNumber || '')].filter(Boolean));
      toDelete.forEach((did) => {
        this.deleteDocFromFirestore('rooms', did);
      });
      this.purgeMatchingCloudRooms(rm.id, rmNumKey);
      const cloudDelDocIds = [rm.id, rm._firestoreDocId, canonicalId].filter(Boolean);
      this.recordCloudDeletion('rooms', cloudDelDocIds);

      // Clear room allocation from active reservations so they don't hold a deleted room
      (this.reservations || []).forEach((res) => {
        if (res.roomId === rm.id || res.roomNumber === rm.roomNumber) {
          res.roomId = '';
          res.roomNumber = '';
        }
      });
    } else {
      this.deleteDocFromFirestore('rooms', canonicalId);
      if (roomId && roomId !== canonicalId) {
        this.deleteDocFromFirestore('rooms', roomId);
      }
      this.purgeMatchingCloudRooms(roomId, targetNumKey);
      this.recordCloudDeletion('rooms', [roomId, canonicalId].filter(Boolean));
    }
    this.save();
    this.syncAllRoomsAndTypesToCloud();
    this.notify();
    return { success: true };
  }






  deleteReservation(resId) {
    const res = this.reservations.find(r => r.id === resId || r.bookingReference === resId);
    if (!res) return false;

    const targetResId = res.id;
    const targetFolioId = res.folioId;
    const deleteIds = [targetResId, res.bookingReference, res._firestoreDocId].filter(Boolean);

    if (!this.deletedReservationIds) this.deletedReservationIds = new Set();
    deleteIds.forEach((id) => {
      this.deletedReservationIds.add(String(id));
      this.deletedReservationIds.add(String(id).trim().toLowerCase());
    });

    this.reservations = this.reservations.filter(r => r.id !== targetResId);

    // Free up any allocated room
    if (res.roomId) {
      this.rooms = this.rooms.map(rm => {
        if (rm.id === res.roomId && (rm.operational === 'allocated' || rm.currentReservationId === targetResId)) {
          return { ...rm, operational: 'available', currentReservationId: null };
        }
        return rm;
      });
      const updatedRoom = this.rooms.find(rm => rm.id === res.roomId);
      if (updatedRoom) {
        this.syncDocToFirestore('rooms', updatedRoom.id, updatedRoom);
      }
    }

    // Delete associated folio
    if (targetFolioId && this.folios[targetFolioId]) {
      delete this.folios[targetFolioId];
      this.deleteDocFromFirestore('folios', targetFolioId);
    }

    // Reconcile any Night Audit snapshots that referenced this deleted reservation/folio
    this.reconcileNightAuditsAfterReservationDelete(res, targetFolioId);

    this.logAudit(
      'DELETE_RESERVATION',
      'RESERVATION',
      res.bookingReference,
      `Reservation ${res.bookingReference} deleted permanently.`
    );

    this.save();
    this.deleteDocFromFirestore('reservations', targetResId);
    if (res._firestoreDocId && res._firestoreDocId !== targetResId) {
      this.deleteDocFromFirestore('reservations', res._firestoreDocId);
    }
    if (res.bookingReference && res.bookingReference !== targetResId) {
      this.deleteDocFromFirestore('reservations', res.bookingReference);
    }
    this.recordCloudDeletion('reservations', deleteIds);
    this.notify();
    return true;
  }

  reconcileNightAuditsAfterReservationDelete(res, targetFolioId) {
    if (!Array.isArray(this.nightAudits) || this.nightAudits.length === 0) return;

    const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
    const norm = (v) => String(v || '').trim().toLowerCase();
    const targetResId = norm(res?.id);
    const targetRef = norm(res?.bookingReference);
    const targetFolio = norm(targetFolioId);
    const targetGuest = norm(res?.primaryGuest?.name || res?.guestName);
    const targetRoom = norm(res?.roomNumber ? `Room ${res.roomNumber}` : '');

    const matchesDeleted = (entry) => {
      if (!entry) return false;
      const eFolio = norm(entry.folio || entry.folioId);
      const eResId = norm(entry.reservationId || entry.resId);
      const eRef = norm(entry.bookingReference);
      if (targetFolio && eFolio && eFolio === targetFolio) return true;
      if (targetResId && eResId && eResId === targetResId) return true;
      if (targetRef && eRef && eRef === targetRef) return true;
      if (!eFolio && targetGuest && targetRoom && norm(entry.guest) === targetGuest && norm(entry.room) === targetRoom) {
        return true;
      }
      return false;
    };

    this.nightAudits = this.nightAudits.map((audit) => {
      if (!audit) return audit;
      const origRc = Array.isArray(audit.roomCharges) ? audit.roomCharges : [];
      const origLog = Array.isArray(audit.roomChargesLog) ? audit.roomChargesLog : [];
      const origCo = Array.isArray(audit.checkedOutList) ? audit.checkedOutList : [];

      const nextRc = origRc.filter((rc) => !matchesDeleted(rc));
      const nextLog = origLog.filter((rc) => !matchesDeleted(rc));
      const nextCo = origCo.filter((co) => !matchesDeleted(co));

      if (nextRc.length === origRc.length && nextLog.length === origLog.length && nextCo.length === origCo.length) {
        return audit;
      }

      const nextTariff = r2(nextRc.reduce((s, r) => s + (Number(r.ofrdTariff) || 0), 0));
      const nextCgst = r2(nextRc.reduce((s, r) => s + (Number(r.cgst) || 0), 0));
      const nextSgst = r2(nextRc.reduce((s, r) => s + (Number(r.sgst) || 0), 0));
      const nextTax = r2(nextCgst + nextSgst);
      const nextNet = r2(nextRc.reduce((s, r) => s + (Number(r.totalRent) || 0), 0));

      const totalRooms = Number(audit.kpis?.totalRooms || audit.roomStatus?.total || this.rooms?.length || 0);
      const blockedRooms = Number(audit.kpis?.blockedRooms || audit.roomStatus?.blocked || 0);
      const sellableRooms = Math.max(0, totalRooms - blockedRooms);
      const occupiedRooms = nextRc.length;
      const vacantRooms = Math.max(0, sellableRooms - occupiedRooms);
      const occupancyPercent = sellableRooms > 0 ? Math.round((occupiedRooms / sellableRooms) * 100) : 0;
      const adr = occupiedRooms > 0 ? r2(nextTariff / occupiedRooms) : 0;
      const revpar = sellableRooms > 0 ? r2(nextTariff / sellableRooms) : 0;

      const nextAudit = {
        ...audit,
        roomCharges: nextRc,
        roomChargesLog: nextLog,
        checkedOutList: nextCo,
        totalRoomTariff: nextTariff,
        totalCGST: nextCgst,
        totalSGST: nextSgst,
        totalTax: nextTax,
        totalRevenue: nextNet,
        amountPosted: nextNet,
        chargesPostedCount: nextRc.length,
        occupiedRooms,
        occupancyPercent,
        adr,
        revpar,
        kpis: {
          ...(audit.kpis || {}),
          totalRooms,
          sellableRooms,
          occupiedRooms,
          vacantRooms,
          blockedRooms,
          occupancyPercent,
          adr,
          revpar,
          totalRoomRevenue: nextTariff
        },
        roomStatus: {
          ...(audit.roomStatus || {}),
          total: totalRooms,
          occupied: occupiedRooms,
          vacant: vacantRooms,
          departed: nextCo.length,
          blocked: blockedRooms
        },
        outletRevenues: audit.outletRevenues
          ? {
              ...audit.outletRevenues,
              roomRent: {
                ...(audit.outletRevenues.roomRent || { name: 'Front Office / Rooms' }),
                amount: nextTariff
              }
            }
          : audit.outletRevenues,
        paxStatus: Array.isArray(audit.paxStatus)
          ? audit.paxStatus.map((p) => {
              if (p.status === 'Checked Out') return { ...p, rooms: nextCo.length };
              if (p.status === 'Stayover') return { ...p, rooms: nextRc.length };
              return p;
            })
          : audit.paxStatus
      };

      this.syncDocToFirestore('nightAudits', nextAudit.id, nextAudit);
      return nextAudit;
    });
  }
}

export const pmsStore = new PMSStore();

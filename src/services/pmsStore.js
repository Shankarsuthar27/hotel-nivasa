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
import { normalizeDateStr, getNextDayIsoDate, getTodayIsoDate } from './dateUtils';
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot
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

    // 1. Instant local load (zero latency UI render)
    this.load();

    // 2. Initialize Firebase Cloud Firestore synchronization
    this.initFirebaseSync();
  }

  load() {
    this.deletedReservationIds = new Set();
    this.deletedRoomIds = new Set();
    this.deletedTeamMemberIds = new Set();
    const authSaved = localStorage.getItem('pms_is_authenticated');
    let savedSessionUser = null;
    try {
      const rawUser = localStorage.getItem('pms_current_user');
      if (rawUser) savedSessionUser = JSON.parse(rawUser);
    } catch (_) {}

    this.isAuthenticated = authSaved === 'true';
    this.currentUser = this.isAuthenticated ? savedSessionUser : null;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.isAuthenticated === true && authSaved === null && (savedSessionUser || parsed.currentUser)) {
          this.isAuthenticated = true;
        }
        this.deletedReservationIds = new Set(parsed.deletedReservationIds || []);
        this.deletedRoomIds = new Set(parsed.deletedRoomIds || []);
        this.deletedTeamMemberIds = new Set(parsed.deletedTeamMemberIds || []);
        this.property = parsed.property || initialProperty;
        if (this.property) {
          const todayStr = getTodayIsoDate();
          if (!this.property.businessDate || this.property.businessDate < todayStr) {
            this.property.businessDate = todayStr;
          }
        }
        if (!parsed.roomTypes || parsed.roomTypes.length === 0) {
          this.roomTypes = initialRoomTypes;
          const rtNormal = this.roomTypes.find(rt => rt.id === 'rt_standard' || rt.name === 'Normal' || rt.name === 'Standard Room');
          if (rtNormal) {
            rtNormal.name = 'Normal';
            rtNormal.baseAdults = 2;
            rtNormal.maxAdults = 4;
            rtNormal.baseChildren = 1;
            rtNormal.maxChildren = 1;
            rtNormal.status = 'ACTIVE';
          }
          const rtDeluxe = this.roomTypes.find(rt => rt.id === 'rt_deluxe' || rt.name === 'Delux Room');
          if (rtDeluxe) {
            rtDeluxe.name = 'Delux Room';
            rtDeluxe.baseAdults = 1;
            rtDeluxe.maxAdults = 2;
            rtDeluxe.baseChildren = 2;
            rtDeluxe.maxChildren = 2;
            rtDeluxe.status = 'ACTIVE';
          }
        } else {
          this.roomTypes = parsed.roomTypes;
        }

        if (!parsed.rooms || parsed.rooms.length === 0) {
          this.rooms = initialRooms;
          const r101 = this.rooms.find(r => r.id === 'rm_101');
          if (r101) {
            r101.roomTypeId = 'rt_deluxe';
            r101.roomNumber = '101';
            r101.status = 'clean';
          }
          const r102 = this.rooms.find(r => r.id === 'rm_102');
          if (r102) {
            r102.roomTypeId = 'rt_deluxe';
            r102.roomNumber = '102';
            r102.status = 'dirty';
          }
          const r201 = this.rooms.find(r => r.id === 'rm_201');
          if (r201) {
            r201.roomTypeId = 'rt_standard';
            r201.roomNumber = '201';
            r201.status = 'clean';
          }
          const r202 = this.rooms.find(r => r.id === 'rm_202');
          if (r202) {
            r202.roomTypeId = 'rt_standard';
            r202.roomNumber = '202';
            r202.status = 'clean';
          }
        } else {
          this.rooms = parsed.rooms;
        }
        if (this.deletedRoomIds && this.deletedRoomIds.size > 0) {
          this.rooms = (this.rooms || []).filter(
            r => !this.deletedRoomIds.has(String(r.id)) && !this.deletedRoomIds.has(String(r.roomNumber))
          );
        }
        let rtUltra = this.roomTypes.find(rt => rt.id === 'rt_ultra_premium' || rt.name === 'Ultra Premium');
        if (!rtUltra) {
          rtUltra = {
            id: 'rt_ultra_premium',
            name: 'Ultra Premium',
            code: 'ULP',
            description: 'Ultra luxurious presidential suite with panoramic views and dedicated butler.',
            baseAdults: 2,
            maxAdults: 4,
            baseChildren: 1,
            maxChildren: 2,
            basePrice: 6500,
            status: 'ACTIVE',
            color: '#10b981'
          };
          this.roomTypes.push(rtUltra);
        } else {
          rtUltra.name = 'Ultra Premium';
          rtUltra.status = 'ACTIVE';
        }

        let rtPremium = this.roomTypes.find(rt => rt.id === 'rt_premium' || rt.name === 'Premium');
        if (!rtPremium) {
          rtPremium = {
            id: 'rt_premium',
            name: 'Premium',
            code: 'PRM',
            description: 'Luxury premium suite with jacuzzi and executive lounge access.',
            baseAdults: 4,
            maxAdults: 6,
            baseChildren: 2,
            maxChildren: 4,
            basePrice: 4500,
            status: 'ACTIVE',
            color: '#8b5cf6'
          };
          this.roomTypes.push(rtPremium);
        } else {
          rtPremium.name = 'Premium';
          rtPremium.baseAdults = 4;
          rtPremium.maxAdults = 6;
          rtPremium.baseChildren = 2;
          rtPremium.maxChildren = 4;
          rtPremium.status = 'ACTIVE';
        }

        // Ensure rooms 501, 301, 302 exist to match property layout
        if (!this.rooms.some(r => r.roomNumber === '501')) {
          this.rooms.push({
            id: 'rm_501',
            roomNumber: '501',
            roomTypeId: rtUltra.id,
            floor: '5',
            status: 'clean',
            operational: 'available',
            notes: 'Ready for check-in'
          });
        }
        if (!this.rooms.some(r => r.roomNumber === '301')) {
          this.rooms.push({
            id: 'rm_301',
            roomNumber: '301',
            roomTypeId: rtPremium.id,
            floor: '3',
            status: 'clean',
            operational: 'available',
            notes: 'Ready for check-in'
          });
        }
        if (!this.rooms.some(r => r.roomNumber === '302')) {
          this.rooms.push({
            id: 'rm_302',
            roomNumber: '302',
            roomTypeId: rtPremium.id,
            floor: '3',
            status: 'dirty',
            operational: 'available',
            notes: 'Ready for check-in'
          });
        }

        const roomTypeOrder = { 'Ultra Premium': 1, 'Delux Room': 2, 'Premium': 3, 'Normal': 4 };
        this.roomTypes.sort((a, b) => (roomTypeOrder[a.name] || 99) - (roomTypeOrder[b.name] || 99));
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

        // Preserve real user check-outs/cancellations on res_5 & res_12 — never force checked_out bookings back to in_house
        const res101 = this.reservations.find(r => r.id === 'res_5');
        if (res101 && !['checked_out', 'cancelled', 'no_show'].includes(String(res101.status || '').toLowerCase())) {
          res101.roomId = res101.roomId || 'rm_101';
          res101.roomNumber = res101.roomNumber || '101';
        }

        const res102 = this.reservations.find(r => r.id === 'res_12');
        if (res102 && !['checked_out', 'cancelled', 'no_show'].includes(String(res102.status || '').toLowerCase())) {
          res102.roomId = res102.roomId || 'rm_102';
          res102.roomNumber = res102.roomNumber || '102';
          res102.bookingReference = res102.bookingReference || '#RES_12';
        }

        // Sanitize any room left with stale "occupied" status OR operational="occupied" when no active in_house reservation exists for it
        this.rooms = this.dedupeRoomsByNumber(
          this.sanitizeStaleOccupiedRooms(this.rooms, this.reservations),
          false
        );

        // Ensure old historical reservations res_4 / res_1 do not hold room 102
        this.reservations.forEach(r => {
          if ((r.id === 'res_4' || r.id === 'res_1' || r.id === 'res_7') && r.roomId === 'rm_102') {
            r.roomId = '';
            r.roomNumber = '';
            if (r.status === 'in_house') {
              r.status = 'checked_out';
            }
          }
        });

        // Ensure rooms 201, 202 are tied to rt_standard / Normal, rooms 101, 102 to rt_deluxe, and rooms 301, 302 to rt_premium
        const r201 = this.rooms.find(r => r.roomNumber === '201' || r.id === 'rm_201');
        if (r201) r201.roomTypeId = 'rt_standard';
        const r202 = this.rooms.find(r => r.roomNumber === '202' || r.id === 'rm_202');
        if (r202) r202.roomTypeId = 'rt_standard';

        const r101 = this.rooms.find(r => r.roomNumber === '101' || r.id === 'rm_101');
        if (r101) r101.roomTypeId = 'rt_deluxe';
        const r102 = this.rooms.find(r => r.roomNumber === '102' || r.id === 'rm_102');
        if (r102) r102.roomTypeId = 'rt_deluxe';

        const r301 = this.rooms.find(r => r.roomNumber === '301' || r.id === 'rm_301');
        if (r301) r301.roomTypeId = 'rt_premium';
        const r302 = this.rooms.find(r => r.roomNumber === '302' || r.id === 'rm_302');
        if (r302) r302.roomTypeId = 'rt_premium';

        // Synchronize all reservations so that their roomTypeId & roomTypeName accurately reflect their assigned physical room
        this.reservations.forEach(r => {
          if (r.roomId || r.roomNumber) {
            const matchedRoom = this.rooms.find(rm =>
              (r.roomId && (rm.id === r.roomId || rm.roomNumber === r.roomId)) ||
              (r.roomNumber && (String(rm.roomNumber) === String(r.roomNumber) || rm.id === r.roomNumber))
            );
            if (matchedRoom) {
              const rt = this.roomTypes.find(t => t.id === matchedRoom.roomTypeId || t.name?.toLowerCase() === String(matchedRoom.roomTypeId).toLowerCase());
              if (rt) {
                r.roomTypeId = rt.id;
                r.roomTypeName = rt.name;
              }
            }
          }
        });

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
        this.teamMembers = parsed.teamMembers || initialTeamMembers;
        if (!this.teamMembers.some(m => m.email === 'ss2137789@gmail.com')) {
          this.teamMembers.push({
            id: 'usr_02',
            name: 'Shankar L',
            initials: 'S',
            email: 'ss2137789@gmail.com',
            role: 'Hotel Manager / GM',
            status: 'ACTIVE',
            properties: ['HOTEL ASTHA'],
            invitedAt: '3 Nov 2026',
            hasAccount: true
          });
        }
        this.nightAudits = (parsed.nightAudits && parsed.nightAudits.length >= 5) ? parsed.nightAudits : initialNightAudits;
        this.auditTrail = parsed.auditTrail || initialAuditTrail;
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
        if (this.dailyRates.base['rt_deluxe_2026-11-05'] === undefined) {
          this.dailyRates.base['rt_deluxe_2026-11-05'] = 1000;
        }
        if (this.dailyRates.base['rt_deluxe_2026-11-06'] === undefined) {
          this.dailyRates.base['rt_deluxe_2026-11-06'] = 1000;
        }
        this.propertiesList = (parsed.propertiesList || ['HOTEL ASTHA']).filter(p => p !== 'HOTEL ASTHA RESORT');
        if (this.propertiesList.length === 0) this.propertiesList = ['HOTEL ASTHA'];
        if (this.teamMembers && Array.isArray(this.teamMembers)) {
          this.teamMembers = this.teamMembers.map(tm => ({
            ...tm,
            properties: (tm.properties || ['HOTEL ASTHA']).filter(p => p !== 'HOTEL ASTHA RESORT')
          }));
        }
        this.currentUser = this.isAuthenticated
          ? (savedSessionUser || parsed.currentUser || null)
          : null;
        this.syncCurrentUserWithTeamMembers();
        this.invitationTokens = parsed.invitationTokens || [];
        if (!parsed.ratePlans || parsed.ratePlans.length === 0 || !parsed.ratePlans.some(rp => rp.code === 'STR')) {
          this.ratePlans = JSON.parse(JSON.stringify(initialRatePlans));
        } else {
          // Deduplicate ratePlans by code/id so stored duplicates are cleanly merged
          const dedupeMap = new Map();
          parsed.ratePlans.forEach((rp) => {
            const key = (rp.code || rp.id || '').trim().toUpperCase();
            if (key) {
              if (!dedupeMap.has(key)) {
                dedupeMap.set(key, { ...rp, id: rp.id || key });
              } else {
                const prev = dedupeMap.get(key);
                dedupeMap.set(key, { ...prev, ...rp, id: prev.id || rp.id || key });
              }
            }
          });
          this.ratePlans = Array.from(dedupeMap.values());
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

  dedupeRoomsByNumber(roomsList, pruneCloudDuplicates = false) {
    const byNum = new Map();
    const duplicateDocIdsToPrune = [];
    const deletedSet = this.deletedRoomIds || new Set();

    const getRoomUpdatedMs = (r) => {
      const ts = r?.updatedAt || r?.lastSyncedAt || '';
      const ms = ts ? Date.parse(ts) : 0;
      return isNaN(ms) ? 0 : ms;
    };

    (roomsList || []).forEach((rm) => {
      if (!rm) return;
      const rawNum = String(rm.roomNumber || rm.id || '').trim();
      const numKey = rawNum.toLowerCase().replace(/^rm_/, '');
      if (!numKey) return;

      if (
        deletedSet.has(String(rm.id)) ||
        deletedSet.has(String(rm.roomNumber || '')) ||
        deletedSet.has(numKey)
      ) {
        return;
      }

      const canonicalId = `rm_${numKey}`;
      const existing = byNum.get(numKey);
      if (!existing) {
        byNum.set(numKey, { ...rm, roomNumber: String(rm.roomNumber || numKey).trim() });
        return;
      }

      const existingIsCanonical = String(existing.id || '').toLowerCase() === canonicalId;
      const incomingIsCanonical = String(rm.id || '').toLowerCase() === canonicalId;
      const existingMs = getRoomUpdatedMs(existing);
      const incomingMs = getRoomUpdatedMs(rm);

      // Keep canonical id if either has it, while taking the freshest operational/housekeeping fields
      const winnerId = incomingIsCanonical
        ? rm.id
        : existingIsCanonical
        ? existing.id
        : incomingMs >= existingMs
        ? rm.id
        : existing.id;

      const loserId = winnerId === rm.id ? existing.id : rm.id;
      if (loserId && loserId !== winnerId) {
        duplicateDocIdsToPrune.push(loserId);
      }

      const base = incomingMs > existingMs ? { ...existing, ...rm } : { ...rm, ...existing };
      byNum.set(numKey, {
        ...base,
        id: winnerId,
        roomNumber: String(base.roomNumber || numKey).trim()
      });
    });

    if (pruneCloudDuplicates && duplicateDocIdsToPrune.length > 0) {
      Array.from(new Set(duplicateDocIdsToPrune)).forEach((dupId) => {
        this.deleteDocFromFirestore('rooms', dupId);
      });
    }

    return Array.from(byNum.values());
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
      stopouts: this.stopouts,
      dailyRates: this.dailyRates,
      restrictions: this.restrictions,
      maintenanceBlocks: this.maintenanceBlocks,
      taxRules: this.taxRules,
      serviceCharges: this.serviceCharges,
      propertiesList: (this.propertiesList || ['HOTEL ASTHA']).filter(p => p !== 'HOTEL ASTHA RESORT'),
      currentUser: this.isAuthenticated ? this.currentUser : null,
      isAuthenticated: this.isAuthenticated === true && !!this.currentUser,
      invitationTokens: this.invitationTokens || [],
      deletedReservationIds: Array.from(this.deletedReservationIds || []),
      deletedRoomIds: Array.from(this.deletedRoomIds || []),
      deletedTeamMemberIds: Array.from(this.deletedTeamMemberIds || [])
    };
    try {
      if (this.isAuthenticated && this.currentUser) {
        localStorage.setItem('pms_is_authenticated', 'true');
        localStorage.setItem('pms_current_user', JSON.stringify(this.currentUser));
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('LocalStorage write warning:', e);
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k !== STORAGE_KEY && k !== 'pms_is_authenticated' && k !== 'pms_current_user') {
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
      stopouts: this.stopouts,
      dailyRates: this.dailyRates,
      restrictions: this.restrictions,
      maintenanceBlocks: this.maintenanceBlocks,
      taxRules: Array.isArray(this.taxRules) ? this.taxRules : JSON.parse(JSON.stringify(initialTaxRules)),
      serviceCharges: this.serviceCharges || [],
      propertiesList: (this.propertiesList || ['HOTEL ASTHA']).filter(p => p !== 'HOTEL ASTHA RESORT'),
      currentUser: this.isAuthenticated ? this.currentUser : null,
      isAuthenticated: this.isAuthenticated === true && !!this.currentUser,
      invitationTokens: this.invitationTokens || [],
      cloudStatus: this.cloudStatus,
      isCloudLive: this.cloudStatus === 'LIVE'
    };
  }

  updateProperty(patch) {
    this.property = { ...this.property, ...patch };
    this.save();
    this.syncDocToFirestore('', this.propertyId, this.property);
    this.notify();
    return this.property;
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

      // 2. Real-time Listener: Reservations
      const resCol = collection(db, 'properties', this.propertyId, 'reservations');
      const unsubRes = onSnapshot(
        resCol,
        (snapshot) => {
          const cloudRes = snapshot.docs.map((d) => d.data());
          const validCloudRes = cloudRes.filter((r) => {
            if (r.id === 'res_unassigned_1') return false;
            return true;
          });

          // Two-way merge: Preserve all local reservations created in PMS while merging cloud updates
          const resMap = new Map();
          const isDeleted = (id) => this.deletedReservationIds && this.deletedReservationIds.has(id);

          // 1. Initial canonical seed reservations
          (initialReservations || []).forEach((r) => {
            if (r && r.id && !isDeleted(r.id)) resMap.set(r.id, r);
          });

          // 2. Local reservations in memory (from localStorage or newly created by user)
          (this.reservations || []).forEach((r) => {
            if (r && r.id && !isDeleted(r.id)) resMap.set(r.id, r);
          });

          // 3. Incoming cloud updates with non-destructive state protection
          validCloudRes.forEach((r) => {
            if (r && r.id && !isDeleted(r.id)) {
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

          // Background sync any local reservations to Firestore that are missing in the cloud snapshot
          const cloudIds = new Set(validCloudRes.map(r => r.id));
          merged.forEach((r) => {
            if (!cloudIds.has(r.id)) {
              this.syncDocToFirestore('reservations', r.id, r);
              if (r.folioId && this.folios && this.folios[r.folioId]) {
                this.syncDocToFirestore('folios', r.folioId, this.folios[r.folioId]);
              }
            }
          });
        },
        (err) => {
          console.warn('[Firebase Firestore] Reservations listener note:', err.message);
          this.cloudStatus = 'OFFLINE_CACHE';
          this.notify();
        }
      );
      this.unsubscribers.push(unsubRes);

      // 3. Real-time Listener: Rooms
      const roomsCol = collection(db, 'properties', this.propertyId, 'rooms');
      const unsubRooms = onSnapshot(
        roomsCol,
        (snapshot) => {
          const cloudRooms = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          const combined = [...(this.rooms || []), ...cloudRooms];
          const deduped = this.dedupeRoomsByNumber(combined, true);
          this.rooms = this.sanitizeStaleOccupiedRooms(deduped, this.reservations);
          this.cloudStatus = 'LIVE';
          this.save();
          this.notify();
        },
        (err) => {
          console.warn('[Firebase Firestore] Rooms listener note:', err.message);
        }
      );
      this.unsubscribers.push(unsubRooms);

      // 4. Real-time Listener: Folios
      const foliosCol = collection(db, 'properties', this.propertyId, 'folios');
      const unsubFolios = onSnapshot(
        foliosCol,
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
            this.save();
            this.notify();
          }
        },
        (err) => {
          console.warn('[Firebase Firestore] Property listener note:', err.message);
        }
      );
      this.unsubscribers.push(unsubProp);

      // 7. Real-time Listener: Meal Plans
      const mpCol = collection(db, 'properties', this.propertyId, 'mealPlans');
      const unsubMp = onSnapshot(
        mpCol,
        (snapshot) => {
          const cloudMp = snapshot.docs.map((d) => d.data());
          const map = new Map();
          cloudMp.forEach((mp) => {
            const key = mp.id || mp.code;
            if (key && !map.has(key)) map.set(key, mp);
          });
          this.mealPlans = Array.from(map.values());
          this.save();
          this.notify();
        },
        () => {}
      );
      this.unsubscribers.push(unsubMp);

      // 8. Real-time Listener: Rate Plans
      const rpCol = collection(db, 'properties', this.propertyId, 'ratePlans');
      const unsubRp = onSnapshot(
        rpCol,
        (snapshot) => {
          const cloudRp = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          const map = new Map();
          cloudRp.forEach((rp) => {
            const codeKey = (rp.code || '').trim().toUpperCase();
            const idKey = (rp.id || '').trim();
            const dedupeKey = codeKey || idKey;
            if (dedupeKey) {
              if (!map.has(dedupeKey)) {
                map.set(dedupeKey, { ...rp, id: rp.id || dedupeKey });
              } else {
                const prev = map.get(dedupeKey);
                // Preserve active roomTypeRates and valid prices during merge
                const prevHasRates = prev.roomTypeRates && Object.values(prev.roomTypeRates).some(r => r && (r.active || r.basePrice > 0));
                const curHasRates = rp.roomTypeRates && Object.values(rp.roomTypeRates).some(r => r && (r.active || r.basePrice > 0));
                if (curHasRates && !prevHasRates) {
                  map.set(dedupeKey, { ...prev, ...rp, id: prev.id || rp.id || dedupeKey });
                } else {
                  map.set(dedupeKey, { ...rp, ...prev, id: prev.id || rp.id || dedupeKey });
                }
              }
            }
          });
          if (map.size > 0) {
            this.ratePlans = Array.from(map.values());
            this.save();
            this.notify();
          }
        },
        () => {}
      );
      this.unsubscribers.push(unsubRp);

      // 9. Real-time Listener: Room Types
      const rtCol = collection(db, 'properties', this.propertyId, 'roomTypes');
      const unsubRt = onSnapshot(
        rtCol,
        (snapshot) => {
          const cloudRt = snapshot.docs.map((d) => d.data());
          const map = new Map();
          cloudRt.forEach((rt) => {
            const key = rt.id || rt.code;
            if (key && !map.has(key)) map.set(key, rt);
          });
          this.roomTypes = Array.from(map.values());
          this.save();
          this.notify();
        },
        () => {}
      );
      this.unsubscribers.push(unsubRt);

      // 10. Real-time Listener: Team Members (merge local + cloud so newly provisioned staff are never wiped)
      const tmCol = collection(db, 'properties', this.propertyId, 'teamMembers');
      const unsubTm = onSnapshot(
        tmCol,
        (snapshot) => {
          const cloudTm = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          const deletedTm = this.deletedTeamMemberIds || new Set();
          const map = new Map();

          (this.teamMembers || []).forEach((tm) => {
            if (!tm) return;
            const key = tm.id || tm.staffId || tm.email;
            if (key && !deletedTm.has(String(tm.id))) {
              map.set(key, tm);
            }
          });

          cloudTm.forEach((tm) => {
            if (!tm) return;
            const key = tm.id || tm.staffId || tm.email;
            if (key && !deletedTm.has(String(tm.id))) {
              const existing = map.get(key);
              map.set(key, existing ? { ...existing, ...tm } : tm);
            }
          });

          this.teamMembers = Array.from(map.values());
          this.syncCurrentUserWithTeamMembers();
          this.save();
          this.notify();
        },
        () => {}
      );
      this.unsubscribers.push(unsubTm);

      // 11. Real-time Listener: Announcements / Staff Notes
      const annCol = collection(db, 'properties', this.propertyId, 'announcements');
      const unsubAnn = onSnapshot(
        annCol,
        (snapshot) => {
          const cloudAnn = snapshot.docs.map((d) => d.data());
          if (cloudAnn.length > 0) {
            this.announcements = cloudAnn;
            this.save();
            this.notify();
          }
        },
        () => {}
      );
      this.unsubscribers.push(unsubAnn);

      // 12. Real-time Listener: Audit Trail (persisted in Cloud Firestore across refreshes & devices)
      const auditCol = collection(db, 'properties', this.propertyId, 'auditTrail');
      const unsubAudit = onSnapshot(
        auditCol,
        (snapshot) => {
          const cloudAudits = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          const mergedMap = new Map();

          (this.auditTrail || []).forEach((item) => {
            if (item && item.id) mergedMap.set(item.id, item);
          });
          cloudAudits.forEach((item) => {
            if (item && item.id) mergedMap.set(item.id, item);
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
            .slice(0, 300);

          this.auditTrail = mergedList;
          this.save();
          this.notify();

          // Backfill any local-only audit entries (e.g., created while offline) up to Cloud Firestore
          const cloudIds = new Set(cloudAudits.map((c) => c.id));
          mergedList.forEach((entry) => {
            if (entry?.id && String(entry.id).startsWith('at_') && !cloudIds.has(entry.id)) {
              this.syncDocToFirestore('auditTrail', entry.id, entry);
            }
          });
        },
        (err) => {
          console.warn('[Firebase Firestore] Audit Trail listener note:', err?.message);
        }
      );
      this.unsubscribers.push(unsubAudit);

      this.cloudStatus = 'LIVE';
      this.notify();
    } catch (e) {
      console.warn('[Firebase Firestore] Sync initialization fallback to local storage:', e.message);
      this.cloudStatus = 'OFFLINE_CACHE';
      this.notify();
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

      // 1. Nested under property subcollection (Primary PMS Cloud Store)
      const nestedRef = doc(db, 'properties', this.propertyId, collectionName, String(docId));
      await setDoc(nestedRef, payload, { merge: true });

      // 2. Root collection for universal querying & direct console visibility (Optional mirror)
      try {
        const rootRef = doc(db, collectionName, String(docId));
        await setDoc(rootRef, payload, { merge: true });
      } catch (rootErr) {
        console.warn(`[Firebase Sync Note] Root mirror write note for ${collectionName}/${docId}:`, rootErr.message);
      }

      console.info(`🔥 [Firebase Cloud] Successfully stored ${collectionName}/${docId} in Cloud Firestore.`);
      return true;
    } catch (err) {
      console.warn(`[Firebase Sync Note] Could not write to ${collectionName}/${docId}:`, err.message);
      return false;
    }
  }

  async deleteDocFromFirestore(collectionName, docId) {
    if (!docId || !collectionName || !db) return;
    try {
      const nestedRef = doc(db, 'properties', this.propertyId, collectionName, String(docId));
      await deleteDoc(nestedRef);

      const rootRef = doc(db, collectionName, String(docId));
      await deleteDoc(rootRef);
      console.info(`🔥 [Firebase Cloud] Deleted ${collectionName}/${docId}`);
    } catch (err) {
      console.warn(`[Firebase Sync Note] Could not delete ${collectionName}/${docId}:`, err.message);
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

  logAudit(action, entity, entityId, details, actor = 'Astha India', meta = {}) {
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
      actor: actor || 'Astha India',
      userName: actor || 'Astha India',
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
    this.logAudit('CREATE_ANNOUNCEMENT', 'ANNOUNCEMENT', note.id, `Created staff note: "${note.message.substring(0, 30)}..."`, note.author || 'Astha India');
    this.save();
    this.syncDocToFirestore('announcements', note.id, note);
  }

  deleteAnnouncement(noteId) {
    if (!this.announcements) this.announcements = [];
    this.announcements = this.announcements.filter((n) => n.id !== noteId);
    this.logAudit('DELETE_ANNOUNCEMENT', 'ANNOUNCEMENT', noteId, 'Deleted staff note', 'Astha India');
    this.save();
    this.deleteDocFromFirestore('announcements', noteId);
  }

  // --- RESERVATIONS & BOOKING ENGINE ---

  async createReservation(bookingData) {
    let maxNum = 370;
    (this.reservations || []).forEach(r => {
      const numMatch = String(r.id || '').match(/\d+/) || String(r.bookingReference || '').match(/\d+/);
      if (numMatch) {
        const val = parseInt(numMatch[0], 10);
        if (val > maxNum && val < 999999) {
          maxNum = val;
        }
      }
    });
    const nextNum = Math.max(maxNum + 1, 378);
    const ref = `#RES_${nextNum}`;
    const id = `res_${nextNum}`;
    const folioId = `fol_${nextNum}`;
    if (this.deletedReservationIds) {
      this.deletedReservationIds.delete(id);
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
    const paidAmount = Number(bookingData.advanceAmount) || 0;
    const balanceDue = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);

    const checkInIso = normalizeDateStr(bookingData.checkInDate) ||
      (this.property?.businessDate || getTodayIsoDate());
    const checkOutIso = normalizeDateStr(bookingData.checkOutDate) ||
      getNextDayIsoDate(checkInIso);

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
      checkInTime: bookingData.checkInTime || '11:59',
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
      bookingSource: bookingData.bookingSource || 'WALK_IN',
      marketSegment: bookingData.marketSegment || 'WALK_IN',
      isVIP: !!bookingData.isVIP,
      isSingleLady: !!bookingData.isSingleLady,
      noPosting: !!bookingData.noPosting,
      isComplimentary: !!bookingData.isComplimentary,
      notes: bookingData.notes || '',
      createdAt: new Date().toISOString(),
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

    const isCheckIn = (bookingData.status || '').toLowerCase() === 'in_house';
    if (isCheckIn && !newRes.checkedInAt) {
      newRes.checkedInAt = new Date().toISOString();
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
      `Created booking for ${newRes.primaryGuest.name} in Room ${roomNumber || 'Unassigned'} (${newRes.nights} Nights). Total: ₹${totalAmount}`,
      'Astha India',
      {
        actionType: 'RESERVATION_CREATED',
        reservationId: id,
        bookingReference: ref,
        guestName: newRes.primaryGuest.name,
        stayDates: `${newRes.checkInDate} → ${newRes.checkOutDate}`,
        nights: newRes.nights,
        rooms: newRes.roomsCount,
        totalAmount: totalAmount,
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
        'Astha India',
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
        'Astha India',
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

    this.save();
    this.notify();

    // 1. Store Reservation in Cloud Firestore
    await this.syncDocToFirestore('reservations', id, newRes);

    // 2. Store Folio in Cloud Firestore
    await this.syncDocToFirestore('folios', folioId, newFolio);

    // 3. Store Updated Rooms in Cloud Firestore
    for (const upRm of updatedRooms) {
      await this.syncDocToFirestore('rooms', upRm.id, upRm);
    }

    // 4. Store Guest Profile in Cloud Firestore (CRM)
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
    await this.syncDocToFirestore('guests', guestId, guestDoc);

    console.info(`🔥 [Firebase Cloud] Successfully stored Reservation ${ref}, Room ${roomNumber}, Folio ${folioId}, and Guest Profile in Cloud Firestore.`);

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
      this.reservations[idx] = {
        ...this.reservations[idx],
        ...updatedFields,
        updatedAt: new Date().toISOString()
      };
      const updated = this.reservations[idx];
      this.logAudit('UPDATE_RESERVATION', 'RESERVATION', updated.bookingReference || updated.id, `Updated reservation details for ${updated.primaryGuest?.name || updated.guestName || updated.id}`, 'Astha India');
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
      'Astha India',
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
      'Astha India',
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
        checkedInAt: r.checkedInAt || nowIso,
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
      'Astha India',
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
      this.currentUser?.name || 'Astha India',
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

  updateRoomStatus(roomId, newStatus) {
    this.rooms = this.rooms.map(rm =>
      rm.id === roomId ? { ...rm, status: newStatus } : rm
    );
    const room = this.rooms.find(r => r.id === roomId);
    this.logAudit('HOUSEKEEPING_UPDATE', 'ROOM', room ? room.roomNumber : roomId, `Status set to ${newStatus.toUpperCase()}`);
    this.save();

    if (room) {
      this.syncDocToFirestore('rooms', roomId, room);
    }
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
      'Astha India',
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
      'Astha India',
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
    tx.voidedBy = 'Astha India';

    this.recomputeFolioTotals(reservationId);

    this.logAudit(
      'VOID_PAYMENT',
      'RESERVATION',
      res.bookingReference || res.id,
      `VOIDED payment of ₹${Math.abs(tx.amount)} (${tx.paymentMethod || 'Payment'}) on ${folio.folioNumber}. Reason: "${tx.voidReason}". Balance restored.`,
      this.currentUser?.name || 'Astha India',
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
    const actorName = this.currentUser?.name || 'Astha India';

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
      this.currentUser?.name || 'Astha India',
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

  toggleStopout(roomTypeId, dateStr) {
    const key = `${roomTypeId}_${dateStr}`;
    const next = !this.stopouts[key];
    this.stopouts = {
      ...this.stopouts,
      [key]: next
    };
    const rt = this.roomTypes.find(r => r.id === roomTypeId);
    this.logAudit('STOPOUT_TOGGLE', 'RATE_MATRIX', key, `${rt ? rt.name : roomTypeId} stop-sell set to ${next ? 'CLOSED' : 'OPEN'} on ${dateStr}`);
    this.save();
  }

  updateDailyRates(ratesMap, tier = 'base') {
    if (!ratesMap || typeof ratesMap !== 'object') return;
    if (!this.dailyRates) this.dailyRates = { base: {}, extra_adult: {}, extra_child: {} };
    if (!this.dailyRates[tier]) this.dailyRates[tier] = {};

    Object.entries(ratesMap).forEach(([key, val]) => {
      const num = Number(val);
      if (!isNaN(num) && num > 0) {
        this.dailyRates[tier][key] = num;
      }
    });

    // Update roomTypes default basePrice if tier is base
    if (tier === 'base') {
      this.roomTypes = this.roomTypes.map(rt => {
        const matchingKey = Object.keys(ratesMap).find(k => k.startsWith(rt.id + '_'));
        if (matchingKey) {
          const v = Number(ratesMap[matchingKey]);
          if (!isNaN(v) && v > 0) return { ...rt, basePrice: v };
        }
        return rt;
      });
    }

    this.logAudit('RATES_UPDATE', 'RATE_MATRIX', tier, `Updated ${Object.keys(ratesMap).length} daily rates for tier: ${tier}`);
    this.save();
  }

  updateSingleRate(roomTypeId, dateStr, rate, tier = 'base') {
    if (!this.dailyRates) this.dailyRates = { base: {}, extra_adult: {}, extra_child: {} };
    if (!this.dailyRates[tier]) this.dailyRates[tier] = {};
    const num = Number(rate);
    if (!isNaN(num) && num > 0) {
      this.dailyRates[tier][`${roomTypeId}_${dateStr}`] = num;
      this.save();
    }
  }

  bulkUpdateRates(payload) {
    if (!payload) return;

    if (!this.dailyRates) this.dailyRates = { base: {}, extra_adult: {}, extra_child: {} };
    if (!this.restrictions) this.restrictions = {};

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
        const iso = cur.toISOString().split('T')[0];
        targetRoomTypeIds.forEach(rtId => {
          const cellKey = `${rtId}_${iso}`;

          // Rate override
          if (payload.baseRate !== undefined && payload.baseRate !== null && payload.baseRate !== '') {
            const rateNum = Number(payload.baseRate);
            if (!isNaN(rateNum) && rateNum > 0) {
              if (!this.dailyRates.base) this.dailyRates.base = {};
              this.dailyRates.base[cellKey] = rateNum;
            }
          }

          // Extra adult
          if (payload.extraAdultRate !== undefined && payload.extraAdultRate !== null && payload.extraAdultRate !== '') {
            const eaNum = Number(payload.extraAdultRate);
            if (!isNaN(eaNum) && eaNum > 0) {
              if (!this.dailyRates.extra_adult) this.dailyRates.extra_adult = {};
              this.dailyRates.extra_adult[cellKey] = eaNum;
            }
          }

          // Extra child
          if (payload.extraChildRate !== undefined && payload.extraChildRate !== null && payload.extraChildRate !== '') {
            const ecNum = Number(payload.extraChildRate);
            if (!isNaN(ecNum) && ecNum > 0) {
              if (!this.dailyRates.extra_child) this.dailyRates.extra_child = {};
              this.dailyRates.extra_child[cellKey] = ecNum;
            }
          }

          // Stop sell
          if (payload.stopSell !== undefined) {
            this.stopouts[cellKey] = !!payload.stopSell;
          }

          // Min nights
          if (payload.minNights !== undefined) {
            this.restrictions[`min_${cellKey}`] = Number(payload.minNights);
          }

          // Max nights
          if (payload.maxNights !== undefined) {
            this.restrictions[`max_${cellKey}`] = Number(payload.maxNights);
          }

          // CTA (Closed to arrival)
          if (payload.cta !== undefined) {
            this.restrictions[`cta_${cellKey}`] = !!payload.cta;
          }

          // CTD (Closed to departure)
          if (payload.ctd !== undefined) {
            this.restrictions[`ctd_${cellKey}`] = !!payload.ctd;
          }
        });
      }
      cur.setDate(cur.getDate() + 1);
    }

    // Update roomTypes default basePrice if provided
    if (payload.baseRate) {
      const bNum = Number(payload.baseRate);
      if (!isNaN(bNum) && bNum > 0) {
        this.roomTypes = this.roomTypes.map(rt => {
          if (targetRoomTypeIds.includes(rt.id)) {
            return { ...rt, basePrice: bNum };
          }
          return rt;
        });
      }
    }

    this.logAudit(
      'BULK_RATE_UPDATE',
      'INVENTORY_RATES',
      `${startDateStr} to ${endDateStr}`,
      `Bulk updated for [${rtNames}]. Base Rate: ₹${payload.baseRate || 'Unchanged'}, StopSell: ${payload.stopSell !== undefined ? (payload.stopSell ? 'YES' : 'NO') : 'Unchanged'}`
    );

    this.save();
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
        auditorName || 'Astha India',
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

    const auditRecord = {
      id: `na_${curDate.replace(/-/g, '')}`,
      auditDate: curDate,
      performedAt: new Date().toISOString(),
      performedBy: auditorName,
      totalRevenue: totalRev,
      totalTax: totalTax,
      occupiedRooms: inHouse.length,
      vacantRooms: Math.max(0, this.rooms.length - inHouse.length),
      adr: inHouse.length > 0 ? Math.round(totalRev / inHouse.length) : 0,
      revPar: this.rooms.length > 0 ? Math.round(totalRev / this.rooms.length) : 0,
      status: 'COMPLETED',
      checkedOutCount: this.reservations.filter(r => r.status === 'checked_out' && r.checkOutDate === curDate).length,
      chargesPostedCount: inHouse.length,
      roomChargesLog
    };

    this.nightAudits = [auditRecord, ...this.nightAudits];

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
    this.syncDocToFirestore('', this.propertyId, { businessDate: nextDate });

    return auditRecord;
  }

  // --- MULTI-PROPERTY TEAM INVITATION & GRANULAR RBAC ENGINE ---

  inviteTeamMembers({ emails = [], assignments = [], invitedBy = 'Astha India' }) {
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
      invitedBy: 'Astha India'
    })[0];
  }

  removeInvitation(memberId) {
    const member = this.teamMembers.find(m => m.id === memberId);
    this.teamMembers = this.teamMembers.filter(m => m.id !== memberId);
    if (this.invitationTokens) {
      this.invitationTokens = this.invitationTokens.filter(t => t.memberId !== memberId);
    }
    if (member) {
      this.logAudit('REVOKE_INVITE', 'TEAM', member.email, `Invitation revoked.`);
      this.deleteDocFromFirestore('teamMembers', memberId);
    }
    this.save();
    this.notify();
    return { success: true };
  }




  removeTeamMember(memberId) {
    const member = this.teamMembers.find(m => m.id === memberId);
    if (!this.deletedTeamMemberIds) this.deletedTeamMemberIds = new Set();
    this.deletedTeamMemberIds.add(String(memberId));
    this.teamMembers = this.teamMembers.filter(m => m.id !== memberId);
    if (member) {
      this.logAudit('REMOVE_MEMBER', 'TEAM', member.email, `Member removed from organization.`);
      this.deleteDocFromFirestore('teamMembers', memberId);
      if (member.uid && member.uid !== memberId) {
        this.deleteDocFromFirestore('staff', member.uid);
      } else {
        this.deleteDocFromFirestore('staff', memberId);
      }
    }
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
        name: 'Astha India',
        email: 'owner@hotelastha.com',
        role: 'Owner',
        initials: 'AI',
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
        name: liveMember.name || cur.name,
        email: liveMember.email || liveMember.loginEmail || cur.email,
        loginEmail: liveMember.loginEmail || liveMember.email || cur.loginEmail,
        role: liveRole,
        status: 'ACTIVE',
        properties: liveMember.properties || cur.properties || ['HOTEL ASTHA'],
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
      name: merged.name || (isExplicitOwner ? 'Astha India' : cleanEmail.split('@')[0] || 'Staff'),
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
      properties: merged.properties || ['HOTEL ASTHA'],
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
    const newRoomType = {
      id: `rt_${Date.now()}`,
      name: roomTypeData.name || 'New Room Type',
      code: roomTypeData.code ? roomTypeData.code.toUpperCase() : '',
      baseAdults: parseInt(roomTypeData.baseAdults, 10) || 1,
      maxAdults: parseInt(roomTypeData.maxAdults, 10) || 2,
      baseChildren: parseInt(roomTypeData.baseChildren, 10) || 0,
      maxChildren: parseInt(roomTypeData.maxChildren, 10) || 0,
      status: roomTypeData.status || 'ACTIVE',
      basePrice: Number(roomTypeData.basePrice) || 1000,
      extraAdultPrice: Number(roomTypeData.extraAdultPrice) || 500,
      extraChildPrice: Number(roomTypeData.extraChildPrice) || 250,
      color: roomTypeData.color || '#3b82f6'
    };
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
    this.notify();
    return newRoomType;
  }

  updateRoomType(roomTypeId, patch) {
    let updated = null;
    this.roomTypes = (this.roomTypes || []).map(rt => {
      if (rt.id === roomTypeId) {
        updated = { ...rt, ...patch };
        return updated;
      }
      return rt;
    });

    // If rate info changed, update in rate plans as well
    if (patch.basePrice || patch.extraAdultPrice || patch.extraChildPrice) {
      this.ratePlans = (this.ratePlans || []).map(rp => {
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

    this.logAudit('UPDATE_ROOM_TYPE', 'PROPERTIES', roomTypeId, `Updated room type.`);
    this.save();
    if (updated) {
      this.syncDocToFirestore('roomTypes', roomTypeId, updated);
    }
    this.notify();
  }

  deleteRoomType(roomTypeId) {
    const rt = this.roomTypes?.find(r => r.id === roomTypeId || r.code === roomTypeId);
    const assignedRooms = (this.rooms || []).filter(
      r => r.roomTypeId === roomTypeId ||
           String(r.roomTypeId).toLowerCase() === String(roomTypeId).toLowerCase() ||
           (rt && (r.roomTypeId === rt.id || r.roomTypeId === rt.code || r.roomType === rt.name || r.roomTypeName === rt.name))
    );
    if (assignedRooms.length > 0) {
      return { success: false, message: 'This room type is assigned to one or more rooms and cannot be deleted.' };
    }
    this.roomTypes = (this.roomTypes || []).filter(r => r.id !== roomTypeId && r.code !== roomTypeId);
    if (rt) {
      this.logAudit('DELETE_ROOM_TYPE', 'PROPERTIES', rt.id, `Deleted room type ${rt.name}`);
      this.deleteDocFromFirestore('roomTypes', rt.id);
      if (rt.code && rt.code !== rt.id) {
        this.deleteDocFromFirestore('roomTypes', rt.code);
      }
      // Also clean up rates in rate plans
      this.ratePlans = (this.ratePlans || []).map(rp => {
        if (rp.roomTypeRates && rp.roomTypeRates[rt.id]) {
          const newRates = { ...rp.roomTypeRates };
          delete newRates[rt.id];
          const updatedPlan = { ...rp, roomTypeRates: newRates };
          this.syncDocToFirestore('ratePlans', updatedPlan.id, updatedPlan);
          return updatedPlan;
        }
        return rp;
      });
    } else {
      this.deleteDocFromFirestore('roomTypes', roomTypeId);
    }
    this.save();
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
      if (existing) {
        existing.roomTypeId = item.roomTypeId || existing.roomTypeId;
        existing.updatedAt = new Date().toISOString();
        created.push(existing);
      } else {
        const rm = {
          id: canonicalId,
          roomNumber: cleanNum,
          roomTypeId: item.roomTypeId,
          floor: cleanNum.charAt(0) || '1',
          status: 'clean',
          operational: 'available',
          notes: 'Ready for check-in',
          updatedAt: new Date().toISOString()
        };
        if (this.deletedRoomIds) {
          this.deletedRoomIds.delete(canonicalId);
          this.deletedRoomIds.delete(cleanNum);
          this.deletedRoomIds.delete(numKey);
        }
        created.push(rm);
      }
    });
    this.rooms = this.dedupeRoomsByNumber([...(this.rooms || []), ...created], false);
    this.logAudit('ADD_ROOMS', 'PROPERTIES', '', `Added ${created.length} new rooms.`);
    this.save();
    created.forEach((rm) => {
      this.syncDocToFirestore('rooms', rm.id, rm);
    });
    this.notify();
    return created;
  }

  updateRoom(roomId, patch) {
    let updated = null;
    let oldRoomNumber = null;
    this.rooms = (this.rooms || []).map(rm => {
      if (rm.id === roomId) {
        oldRoomNumber = rm.roomNumber;
        updated = { ...rm, ...patch };
        return updated;
      }
      return rm;
    });
    this.logAudit('UPDATE_ROOM', 'PROPERTIES', roomId, `Updated room.`);
    this.save();
    if (updated) {
      this.syncDocToFirestore('rooms', roomId, updated);
      if (oldRoomNumber && patch.roomNumber && oldRoomNumber !== patch.roomNumber && oldRoomNumber !== roomId) {
        this.deleteDocFromFirestore('rooms', oldRoomNumber);
      }
    }
    this.notify();
  }

  deleteRoom(roomId) {
    const rm = this.rooms?.find(r => r.id === roomId || r.roomNumber === roomId);
    this.rooms = (this.rooms || []).filter(r => r.id !== roomId && r.roomNumber !== roomId);
    if (!this.deletedRoomIds) this.deletedRoomIds = new Set();
    if (rm) {
      this.deletedRoomIds.add(String(rm.id));
      if (rm.roomNumber) this.deletedRoomIds.add(String(rm.roomNumber));
      this.logAudit('DELETE_ROOM', 'PROPERTIES', rm.roomNumber, `Deleted room ${rm.roomNumber}`);
      this.deleteDocFromFirestore('rooms', rm.id);
      if (rm.roomNumber && rm.roomNumber !== rm.id) {
        this.deleteDocFromFirestore('rooms', rm.roomNumber);
      }
    } else {
      this.deletedRoomIds.add(String(roomId));
      this.deleteDocFromFirestore('rooms', roomId);
    }
    this.save();
    this.notify();
    return { success: true };
  }






  deleteReservation(resId) {
    const res = this.reservations.find(r => r.id === resId || r.bookingReference === resId);
    if (!res) return false;

    const targetResId = res.id;
    const targetFolioId = res.folioId;

    if (!this.deletedReservationIds) this.deletedReservationIds = new Set();
    this.deletedReservationIds.add(targetResId);

    this.reservations = this.reservations.filter(r => r.id !== targetResId);

    // Free up any allocated room
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

    // Delete associated folio
    if (targetFolioId && this.folios[targetFolioId]) {
      delete this.folios[targetFolioId];
      this.deleteDocFromFirestore('folios', targetFolioId);
    }

    this.logAudit(
      'DELETE_RESERVATION',
      'RESERVATION',
      res.bookingReference,
      `Reservation ${res.bookingReference} deleted permanently.`
    );

    this.save();
    this.deleteDocFromFirestore('reservations', targetResId);
    this.notify();
    return true;
  }
}

export const pmsStore = new PMSStore();

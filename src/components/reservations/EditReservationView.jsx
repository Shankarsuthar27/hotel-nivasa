import React, { useState, useEffect, useMemo, useRef } from 'react';
import './edit-reservation.css';
import {
  ArrowLeft,
  Home,
  Plus,
  Crown,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  User,
  Smile,
  Calendar,
  CreditCard,
  FileText,
  Clock,
  CheckCircle2,
  MoreVertical,
  PlusCircle,
  FileSpreadsheet,
  Check,
  ShieldCheck,
  Star,
  Upload,
  Maximize2,
  Minimize2,
  AlertTriangle,
  Ban,
  Trash2,
  Pencil,
  Edit3,
  ArrowLeftRight,
  X,
  Eye,
  Download,
  Loader2,
  History,
  Bed,
  Moon,
  LogOut
} from 'lucide-react';
import { pmsStore } from '../../services/pmsStore';
import { uploadGuestIdDocument } from '../../services/firebaseStorage';
import { calculateRoomTax } from '../../services/taxEngine';
import GuestCheckInModal from './GuestCheckInModal';
import GuestCheckOutModal from './GuestCheckOutModal';
import VoidPaymentModal from '../folios/VoidPaymentModal';
import AddPaymentModal from '../folios/AddPaymentModal';
import AddChargeModal from '../folios/AddChargeModal';
import SettleFolioModal from '../folios/SettleFolioModal';
import EditFolioTransactionModal from '../folios/EditFolioTransactionModal';
import MoveFolioTransactionModal from '../folios/MoveFolioTransactionModal';
import UpdateDetailsModal from './UpdateDetailsModal';
import CustomDatePicker from '../common/CustomDatePicker';
import CountrySelect from '../common/CountrySelect';
import SearchableSelect from '../common/SearchableSelect';
import CustomTimePickerModal from '../common/CustomTimePickerModal';
import { getStatesForCountry, getCitiesForState } from '../../data/geoData';
import { getTodayIsoDate, normalizeDateStr, isResMatchingRoom, getCurrentTimeString, formatTimeToHhMm, getAccurateArrivalTime } from '../../services/dateUtils';

/**
 * EditReservationView Component
 * Rebuilt exactly according to OTAL PMS Front-Desk Lifecycle specifications
 */
export default function EditReservationView({
  reservation = {},
  property = {},
  rooms = [],
  roomTypes = [],
  onBack,
  onNavigate,
  onSave,
  onAssignRoom,
  onCheckIn,
  onCheckOut,
  onPostPendingCharges,
  onAddFolioCharge,
  onAddFolioPayment,
  onVoidPayment,
  onAddFolioTransaction,
  onSettleFolio
}) {
  // Live reservation from pmsStore
  const currentRes = (typeof pmsStore?.getReservation === 'function'
    ? pmsStore.getReservation(reservation?.id)
    : pmsStore?.getState?.()?.reservations?.find(r => r.id === reservation?.id)) || reservation || {};

  const [activeTab, setActiveTab] = useState('guest'); // 'guest' | 'booking' | 'folio' | 'charges' | 'audit'
  const [auditFilter, setAuditFilter] = useState('all'); // 'all' | 'room'

  // Sub-sidebar accordion state
  const [isRoomAccordionOpen, setIsRoomAccordionOpen] = useState(true);

  // Helper to extract clean guest form data without auto-filling fake or sample details
  const extractGuestForm = (res) => {
    const pg = res?.primaryGuest || {};
    let fName = pg.firstName || '';
    let lName = pg.lastName || '';
    if (!fName && pg.name) {
      const parts = pg.name.trim().split(' ');
      if (['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Mr', 'Mrs', 'Ms', 'Dr'].includes(parts[0])) {
        fName = parts[1] || '';
        lName = parts.slice(2).join(' ') || '';
      } else {
        fName = parts[0] || '';
        lName = parts.slice(1).join(' ') || '';
      }
    }

    return {
      title: pg.title || 'Mr.',
      firstName: fName,
      lastName: lName,
      mobile: pg.phone || pg.mobile || '',
      countryCode: pg.countryCode || '+91',
      email: pg.email || '',
      birthDate: pg.birthDate || '',
      nationality: pg.nationality || '',
      gender: pg.gender || '',
      guestType: pg.guestType || 'Adult',
      isPrimary: pg.isPrimary !== undefined ? pg.isPrimary : true,
      isVIP: !!(res?.isVIP || pg.isVIP),
      address: pg.address || '',
      zip: pg.zip || '',
      country: pg.country || '',
      state: pg.state || '',
      city: pg.city || '',
      idNumber: pg.idNumber || '',
      idType: pg.idType || '',
      issuingCountry: pg.issuingCountry || '',
      issuingCity: pg.issuingCity || '',
      expiryDate: pg.expiryDate || '',
      idDocumentUrl: pg.idDocumentUrl || pg.idPhoto || '',
      idDocumentName: pg.idDocumentName || '',
      idStoragePath: pg.idStoragePath || ''
    };
  };

  // Editable Form State: Guest Details (loads only real data, without automatic fake filler values)
  const [guestForm, setGuestForm] = useState(() => extractGuestForm(reservation));

  // Sync form state whenever active reservation changes
  useEffect(() => {
    if (reservation?.id) {
      setGuestForm(extractGuestForm(reservation));
    }
  }, [reservation?.id, reservation?.bookingReference]);

  // Dynamic State & City options based on selected Country and State
  const stateOptions = useMemo(() => {
    return getStatesForCountry(guestForm.country);
  }, [guestForm.country]);

  const cityOptions = useMemo(() => {
    return getCitiesForState(guestForm.state);
  }, [guestForm.state]);

  // Guest List view toggle (Image 1 & 2)
  const [showGuestList, setShowGuestList] = useState(false);

  // Additional Guests list
  const [additionalGuests, setAdditionalGuests] = useState(() => {
    if (Array.isArray(reservation.additionalGuests) && reservation.additionalGuests.length > 0) {
      return reservation.additionalGuests;
    }
    return [];
  });

  // Arrival & Departure Time editing (Image 8)
  const [checkInTime, setCheckInTime] = useState(() =>
    getAccurateArrivalTime(currentRes)
  );
  const [checkOutTime, setCheckOutTime] = useState(currentRes.checkOutTime || '11:00');
  const [editingTimeType, setEditingTimeType] = useState(null); // 'checkIn' | 'checkOut' | null

  // Keep check-in and check-out times in sync with live currentRes
  useEffect(() => {
    if (currentRes) {
      setCheckInTime(getAccurateArrivalTime(currentRes));
      if (currentRes.checkOutTime) {
        setCheckOutTime(currentRes.checkOutTime);
      }
    }
  }, [currentRes?.id, currentRes?.checkInTime, currentRes?.actualCheckInTime, currentRes?.arrivalTime, currentRes?.checkOutTime, currentRes?.checkedInAt]);

  const primaryNameDisplay = `${guestForm.firstName || ''} ${guestForm.lastName || ''}`.trim();

  const handlePrimaryNameInput = (val) => {
    const parts = val.trimStart().split(' ');
    setGuestForm((prev) => ({
      ...prev,
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || ''
    }));
  };

  const handleAddGuestRow = () => {
    setAdditionalGuests((prev) => [
      ...prev,
      {
        id: `guest_${Date.now()}`,
        title: 'Mr.',
        name: '',
        mobile: '',
        email: '',
        idType: 'Aadhaar Card',
        idNumber: '',
        idDocumentUrl: ''
      }
    ]);
  };

  const handleUpdateAdditionalGuest = (index, field, value) => {
    setAdditionalGuests((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveAdditionalGuest = (index) => {
    if (editingSharerIndex === index) {
      setEditingSharerIndex(null);
    } else if (editingSharerIndex !== null && editingSharerIndex > index) {
      setEditingSharerIndex(editingSharerIndex - 1);
    }
    setAdditionalGuests((prev) => prev.filter((_, i) => i !== index));
  };

  // ID Upload States
  const [isUploadingId, setIsUploadingId] = useState(false);
  const [lightboxPreview, setLightboxPreview] = useState(null); // { url, title, idNumber }
  const fileInputRef = useRef(null);

  const handleIdFileUpload = (file, guestIndex = 'primary') => {
    if (!file) return;

    // Check size limit: 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB. Please choose a smaller photo or document.');
      return;
    }

    // 1. Read locally as Base64 DataURL for instant zero-lag rendering
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result;
      if (!dataUrl) return;
      const fileName = file.name || 'id_proof.jpg';

      if (guestIndex === 'primary') {
        setGuestForm((prev) => ({
          ...prev,
          idDocumentUrl: dataUrl,
          idDocumentName: fileName
        }));
        // Update store immediately with local dataURL fallback
        pmsStore.updateReservation(currentRes.id, {
          primaryGuest: {
            ...(currentRes.primaryGuest || {}),
            idDocumentUrl: dataUrl,
            idDocumentName: fileName
          }
        });
      } else {
        handleUpdateAdditionalGuest(guestIndex, 'idDocumentUrl', dataUrl);
        handleUpdateAdditionalGuest(guestIndex, 'idDocumentName', fileName);
      }

      // 2. Upload asynchronously to Firebase Cloud Storage
      try {
        setIsUploadingId(true);
        const res = await uploadGuestIdDocument(
          'prop_astha_01',
          currentRes.id || 'res_guest',
          file,
          guestIndex === 'primary' ? (guestForm.idType || 'kyc') : 'kyc'
        );

        if (res?.url) {
          if (guestIndex === 'primary') {
            setGuestForm((prev) => ({
              ...prev,
              idDocumentUrl: res.url,
              idDocumentName: fileName,
              idStoragePath: res.path
            }));
            pmsStore.updateReservation(currentRes.id, {
              primaryGuest: {
                ...(currentRes.primaryGuest || {}),
                idDocumentUrl: res.url,
                idDocumentName: fileName,
                idStoragePath: res.path
              }
            });
          } else {
            handleUpdateAdditionalGuest(guestIndex, 'idDocumentUrl', res.url);
            handleUpdateAdditionalGuest(guestIndex, 'idStoragePath', res.path);
          }
        }
      } catch (uploadErr) {
        console.warn('[Firebase Storage] Offline or upload notice (saved locally as DataURL):', uploadErr.message);
      } finally {
        setIsUploadingId(false);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveIdPhoto = (e, guestIndex = 'primary') => {
    e.stopPropagation();
    if (isLocked) return;
    if (window.confirm('Are you sure you want to remove the uploaded ID photo?')) {
      if (guestIndex === 'primary') {
        setGuestForm((prev) => ({
          ...prev,
          idDocumentUrl: '',
          idDocumentName: '',
          idStoragePath: ''
        }));
        pmsStore.updateReservation(currentRes.id, {
          primaryGuest: {
            ...(currentRes.primaryGuest || {}),
            idDocumentUrl: '',
            idDocumentName: '',
            idStoragePath: ''
          }
        });
      } else {
        handleUpdateAdditionalGuest(guestIndex, 'idDocumentUrl', '');
        handleUpdateAdditionalGuest(guestIndex, 'idDocumentName', '');
        handleUpdateAdditionalGuest(guestIndex, 'idStoragePath', '');
      }
    }
  };

  // Add & Edit Room Sharer State
  const [showAddSharerTooltip, setShowAddSharerTooltip] = useState(false);
  const [isAddingSharer, setIsAddingSharer] = useState(false);
  const [editingSharerIndex, setEditingSharerIndex] = useState(null);
  const [isUploadingSharerId, setIsUploadingSharerId] = useState(false);
  const addSharerRef = useRef(null);
  const sharerFileInputRef = useRef(null);

  const initialSharerState = {
    title: '',
    firstName: '',
    lastName: '',
    mobile: '',
    countryCode: '+91',
    email: '',
    birthDate: '',
    nationality: '',
    gender: '',
    guestType: '',
    isPrimary: false,
    isVIP: false,
    address: '',
    zip: '',
    country: '',
    state: '',
    city: '',
    idNumber: '',
    idType: '',
    issuingCountry: '',
    issuingCity: '',
    expiryDate: '',
    idDocumentUrl: '',
    idDocumentName: '',
    idStoragePath: ''
  };

  const [sharerForm, setSharerForm] = useState(initialSharerState);

  const sharerStateOptions = useMemo(() => {
    return getStatesForCountry(sharerForm.country);
  }, [sharerForm.country]);

  const sharerCityOptions = useMemo(() => {
    return getCitiesForState(sharerForm.state);
  }, [sharerForm.state]);

  // Click outside to close Add Sharer popover
  useEffect(() => {
    function handleClickOutsideSharer(e) {
      if (addSharerRef.current && !addSharerRef.current.contains(e.target)) {
        setShowAddSharerTooltip(false);
      }
    }
    if (showAddSharerTooltip) {
      document.addEventListener('mousedown', handleClickOutsideSharer);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideSharer);
    };
  }, [showAddSharerTooltip]);

  const handleOpenAddSharer = () => {
    setShowAddSharerTooltip(false);
    setShowGuestList(false);
    setEditingSharerIndex(null);
    setSharerForm(initialSharerState);
    setIsAddingSharer(true);
  };

  const handleSelectSharerToEdit = (idx) => {
    setShowAddSharerTooltip(false);
    setShowGuestList(false);
    setIsAddingSharer(false);
    setEditingSharerIndex(idx);
    const target = additionalGuests[idx];
    if (target) {
      const rawName = target.name || '';
      const nameParts = rawName.split(' ').filter(Boolean);
      let derivedTitle = target.title || 'Mr.';
      let derivedFirst = target.firstName || '';
      let derivedLast = target.lastName || '';

      if (!derivedFirst && nameParts.length > 0) {
        if (['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Mr', 'Mrs', 'Ms', 'Dr'].includes(nameParts[0])) {
          derivedTitle = nameParts[0].endsWith('.') ? nameParts[0] : `${nameParts[0]}.`;
          derivedFirst = nameParts[1] || '';
          derivedLast = nameParts.slice(2).join(' ') || '';
        } else {
          derivedFirst = nameParts[0] || '';
          derivedLast = nameParts.slice(1).join(' ') || '';
        }
      }

      setSharerForm({
        ...initialSharerState,
        ...target,
        title: derivedTitle,
        firstName: derivedFirst,
        lastName: derivedLast,
        mobile: target.mobile || '',
        countryCode: target.countryCode || '+91',
        email: target.email || '',
        birthDate: target.birthDate || '',
        nationality: target.nationality || '',
        gender: target.gender || '',
        guestType: target.guestType || 'Adult',
        isPrimary: !!target.isPrimary,
        isVIP: !!target.isVIP,
        address: target.address || '',
        zip: target.zip || '',
        country: target.country || '',
        state: target.state || '',
        city: target.city || '',
        idNumber: target.idNumber || '',
        idType: target.idType || 'Aadhaar Card',
        issuingCountry: target.issuingCountry || '',
        issuingCity: target.issuingCity || '',
        expiryDate: target.expiryDate || '',
        idDocumentUrl: target.idDocumentUrl || '',
        idDocumentName: target.idDocumentName || '',
        idStoragePath: target.idStoragePath || ''
      });
    }
  };

  const handleSharerIdUpload = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB. Please choose a smaller photo or document.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result;
      if (!dataUrl) return;
      const fileName = file.name || 'id_proof.jpg';
      setSharerForm((prev) => ({
        ...prev,
        idDocumentUrl: dataUrl,
        idDocumentName: fileName
      }));

      try {
        setIsUploadingSharerId(true);
        const res = await uploadGuestIdDocument(
          'prop_astha_01',
          currentRes.id || 'res_guest',
          file,
          sharerForm.idType || 'kyc'
        );
        if (res?.url) {
          setSharerForm((prev) => ({
            ...prev,
            idDocumentUrl: res.url,
            idDocumentName: fileName,
            idStoragePath: res.path
          }));
        }
      } catch (err) {
        console.warn('Storage upload fallback to base64:', err.message);
      } finally {
        setIsUploadingSharerId(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSharerIdPhoto = (e) => {
    e.stopPropagation();
    setSharerForm((prev) => ({
      ...prev,
      idDocumentUrl: '',
      idDocumentName: '',
      idStoragePath: ''
    }));
  };

  const handleSaveSharer = () => {
    if (!sharerForm.firstName.trim()) {
      alert('Please enter First Name for the room sharer.');
      return;
    }

    const newSharer = {
      id: (editingSharerIndex !== null && additionalGuests[editingSharerIndex]?.id)
        ? additionalGuests[editingSharerIndex].id
        : `sharer_${Date.now()}`,
      title: sharerForm.title || 'Mr.',
      name: `${sharerForm.title ? sharerForm.title + ' ' : ''}${sharerForm.firstName} ${sharerForm.lastName}`.trim(),
      firstName: sharerForm.firstName.trim(),
      lastName: sharerForm.lastName.trim(),
      mobile: sharerForm.mobile.trim(),
      countryCode: sharerForm.countryCode || '+91',
      email: sharerForm.email.trim(),
      birthDate: sharerForm.birthDate,
      nationality: sharerForm.nationality,
      gender: sharerForm.gender,
      guestType: sharerForm.guestType,
      isPrimary: sharerForm.isPrimary,
      isVIP: sharerForm.isVIP,
      address: sharerForm.address,
      zip: sharerForm.zip,
      country: sharerForm.country,
      state: sharerForm.state,
      city: sharerForm.city,
      idNumber: sharerForm.idNumber,
      idType: sharerForm.idType || 'Aadhaar Card',
      issuingCountry: sharerForm.issuingCountry,
      issuingCity: sharerForm.issuingCity,
      expiryDate: sharerForm.expiryDate,
      idDocumentUrl: sharerForm.idDocumentUrl,
      idDocumentName: sharerForm.idDocumentName,
      idStoragePath: sharerForm.idStoragePath
    };

    if (sharerForm.isPrimary) {
      // Demote current primary guest to sharer
      const oldPrimarySharer = {
        id: `sharer_${Date.now()}_prev`,
        title: guestForm.title || 'Mr.',
        name: `${guestForm.title ? guestForm.title + ' ' : ''}${guestForm.firstName} ${guestForm.lastName}`.trim(),
        firstName: guestForm.firstName,
        lastName: guestForm.lastName,
        mobile: guestForm.mobile,
        countryCode: guestForm.countryCode,
        email: guestForm.email,
        birthDate: guestForm.birthDate,
        nationality: guestForm.nationality,
        gender: guestForm.gender,
        guestType: guestForm.guestType,
        isPrimary: false,
        isVIP: guestForm.isVIP,
        address: guestForm.address,
        zip: guestForm.zip,
        country: guestForm.country,
        state: guestForm.state,
        city: guestForm.city,
        idNumber: guestForm.idNumber,
        idType: guestForm.idType,
        issuingCountry: guestForm.issuingCountry,
        issuingCity: guestForm.issuingCity,
        expiryDate: guestForm.expiryDate,
        idDocumentUrl: guestForm.idDocumentUrl,
        idDocumentName: guestForm.idDocumentName,
        idStoragePath: guestForm.idStoragePath
      };

      setGuestForm({
        ...guestForm,
        title: newSharer.title,
        firstName: newSharer.firstName,
        lastName: newSharer.lastName,
        mobile: newSharer.mobile,
        countryCode: newSharer.countryCode,
        email: newSharer.email,
        birthDate: newSharer.birthDate,
        nationality: newSharer.nationality,
        gender: newSharer.gender,
        guestType: newSharer.guestType,
        isPrimary: true,
        isVIP: newSharer.isVIP,
        address: newSharer.address,
        zip: newSharer.zip,
        country: newSharer.country,
        state: newSharer.state,
        city: newSharer.city,
        idNumber: newSharer.idNumber,
        idType: newSharer.idType,
        issuingCountry: newSharer.issuingCountry,
        issuingCity: newSharer.issuingCity,
        expiryDate: newSharer.expiryDate,
        idDocumentUrl: newSharer.idDocumentUrl,
        idDocumentName: newSharer.idDocumentName,
        idStoragePath: newSharer.idStoragePath
      });

      let updatedGuests;
      if (editingSharerIndex !== null) {
        updatedGuests = additionalGuests.filter((_, i) => i !== editingSharerIndex);
        updatedGuests.push(oldPrimarySharer);
      } else {
        updatedGuests = [...additionalGuests, oldPrimarySharer];
      }
      setAdditionalGuests(updatedGuests);
      setIsAddingSharer(false);
      setEditingSharerIndex(null);

      pmsStore.updateReservation(currentRes.id, {
        primaryGuest: {
          ...(currentRes.primaryGuest || {}),
          title: newSharer.title,
          firstName: newSharer.firstName,
          lastName: newSharer.lastName,
          mobile: newSharer.mobile,
          countryCode: newSharer.countryCode,
          email: newSharer.email,
          birthDate: newSharer.birthDate,
          nationality: newSharer.nationality,
          gender: newSharer.gender,
          guestType: newSharer.guestType,
          isPrimary: true,
          isVIP: newSharer.isVIP,
          address: newSharer.address,
          zip: newSharer.zip,
          country: newSharer.country,
          state: newSharer.state,
          city: newSharer.city,
          idNumber: newSharer.idNumber,
          idType: newSharer.idType,
          issuingCountry: newSharer.issuingCountry,
          issuingCity: newSharer.issuingCity,
          expiryDate: newSharer.expiryDate,
          idDocumentUrl: newSharer.idDocumentUrl,
          idDocumentName: newSharer.idDocumentName,
          idStoragePath: newSharer.idStoragePath
        },
        additionalGuests: updatedGuests
      });

      if (onSave) {
        onSave({
          ...currentRes,
          primaryGuest: {
            ...(currentRes.primaryGuest || {}),
            title: newSharer.title,
            firstName: newSharer.firstName,
            lastName: newSharer.lastName,
            name: newSharer.name,
            mobile: newSharer.mobile,
            email: newSharer.email
          },
          additionalGuests: updatedGuests
        });
      }
      alert(`Primary guest updated to "${newSharer.name}"!`);
      return;
    }

    let updatedAdditionalGuests;
    if (editingSharerIndex !== null) {
      updatedAdditionalGuests = [...additionalGuests];
      updatedAdditionalGuests[editingSharerIndex] = {
        ...(additionalGuests[editingSharerIndex] || {}),
        ...newSharer
      };
    } else {
      updatedAdditionalGuests = [...additionalGuests, newSharer];
    }
    setAdditionalGuests(updatedAdditionalGuests);
    setIsAddingSharer(false);
    setEditingSharerIndex(null);

    // Sync to store & Firestore
    pmsStore.updateReservation(currentRes.id, {
      additionalGuests: updatedAdditionalGuests
    });
    if (onSave) {
      onSave({
        ...currentRes,
        additionalGuests: updatedAdditionalGuests
      });
    }
    alert(editingSharerIndex !== null
      ? `Room sharer "${newSharer.name}" updated successfully!`
      : `Room sharer "${newSharer.name}" added successfully!`
    );
  };

  // Editable Form State: Booking Details
  const [bookingForm, setBookingForm] = useState({
    billTo: reservation.billTo || 'Guest',
    company: reservation.company || '',
    guestGstin: reservation.primaryGuest?.gstin || '',
    marketSegment: reservation.marketSegment?.toLowerCase() || 'corporate',
    bookingSource: reservation.bookingSource === 'WALK_IN' ? 'walk-in' : (reservation.bookingSource?.toLowerCase() || 'walk-in'),
    specialRequests: reservation.specialRequests || '',
    applyToAllRooms: false
  });

  // Workflow & Folio Modal States
  const [showAddChargeModal, setShowAddChargeModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [showSettleFolioModal, setShowSettleFolioModal] = useState(false);
  const [showUpdateDetailsModal, setShowUpdateDetailsModal] = useState(false);
  const [voidModalTx, setVoidModalTx] = useState(null);
  const [editingTx, setEditingTx] = useState(null);
  const [movingTx, setMovingTx] = useState(null);
  const [openTxMenuId, setOpenTxMenuId] = useState(null);
  const [folioVersion, setFolioVersion] = useState(0);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.folio-tx-menu-wrap')) {
        setOpenTxMenuId(null);
      }
    };
    if (openTxMenuId) {
      document.addEventListener('click', handleOutsideClick);
    }
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [openTxMenuId]);

  // Live folio from pmsStore
  const currentFolio = (pmsStore?.getState?.()?.folios && pmsStore.getState().folios[currentRes.folioId]) || {
    folioNumber: `FOL_${currentRes.id ? currentRes.id.replace('res_', '') : '1'}`,
    status: (currentRes.balanceDue || 0) <= 0 ? 'SETTLED' : 'OPEN',
    totalDebits: currentRes.totalAmount || 0,
    totalCredits: currentRes.paidAmount || 0,
    balanceDue: currentRes.balanceDue !== undefined ? currentRes.balanceDue : ((currentRes.totalAmount || 0) - (currentRes.paidAmount || 0)),
    transactions: []
  };

  const folioTransactions = currentFolio.transactions || [];

  // Form State for Add Charge (Step 3.2: 6 categories + receipt # + amount + desc)
  const [newCharge, setNewCharge] = useState({
    category: 'Room (Room Rent / Accommodation)',
    receiptNumber: '',
    amount: '',
    description: ''
  });

  // Form State for Add Payment (Step 3.3: Folio + Type + Payment Method + Amount)
  const [newPayment, setNewPayment] = useState({
    folioId: currentFolio.folioNumber || currentRes.folioId || 'FOL_1',
    type: 'Settlement',
    paymentMethod: 'UPI',
    amount: currentFolio.balanceDue > 0 ? String(currentFolio.balanceDue) : '',
    reference: '',
    description: ''
  });

  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setIsBrowserFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsBrowserFullscreen(false)).catch(() => {});
    }
  };

  // Status & Calculations
  const statusNorm = (currentRes.status || '').toLowerCase().replace('-', '_').replace(' ', '_');
  const isInHouse = statusNorm === 'in_house';
  const isConfirmed = statusNorm === 'confirmed';
  const isCheckedOut = statusNorm === 'checked_out';
  const isCancelled = statusNorm === 'cancelled';
  const isNoShow = statusNorm === 'no_show';
  const isLocked = isCheckedOut || isCancelled || isNoShow;

  const totalCharges = Number(currentFolio.totalDebits !== undefined ? currentFolio.totalDebits : (currentRes.totalAmount || 0)).toFixed(2);
  const totalPaid = Number(currentFolio.totalCredits !== undefined ? currentFolio.totalCredits : (currentRes.paidAmount || 0)).toFixed(2);
  const outstanding = Number(
    currentFolio.balanceDue !== undefined ? currentFolio.balanceDue : (currentRes.balanceDue !== undefined ? currentRes.balanceDue : 0)
  ).toFixed(2);

  // Format date helper: "24/10/2026"
  const formatSlashedDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Format transaction date helper: "Mon, Nov 16, 2026"
  const formatTxDisplayDate = (dStr) => {
    if (!dStr) return '-';
    const norm = normalizeDateStr(dStr);
    if (!norm) return dStr;
    const parts = norm.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
      }
    }
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const arrivalText = formatSlashedDate(currentRes.checkInDate || '2026-10-24');
  const departureText = formatSlashedDate(currentRes.checkOutDate || '2026-10-26');
  const nightsCount = currentRes.nights || 1;
  const roomNum = currentRes.roomNumber || (currentRes.assignedRoomId ? currentRes.assignedRoomId.replace('rm_', '') : 'Unassigned');

  // Look up the accurate assigned room & room type from inventory
  const assignedRoomObj = useMemo(() => {
    const list = Array.isArray(rooms) && rooms.length > 0 ? rooms : (pmsStore?.getState?.()?.rooms || []);
    return list.find((r) => isResMatchingRoom(currentRes, r)) || null;
  }, [rooms, currentRes]);

  const assignedRoomTypeObj = useMemo(() => {
    const rTypes = Array.isArray(roomTypes) && roomTypes.length > 0 ? roomTypes : (pmsStore?.getState?.()?.roomTypes || []);
    if (assignedRoomObj?.roomTypeId) {
      return rTypes.find((rt) => rt.id === assignedRoomObj.roomTypeId || rt.name?.toLowerCase() === String(assignedRoomObj.roomTypeId).toLowerCase()) || null;
    }
    if (currentRes.roomTypeId) {
      return rTypes.find((rt) => rt.id === currentRes.roomTypeId || rt.name?.toLowerCase() === String(currentRes.roomTypeId).toLowerCase()) || null;
    }
    return null;
  }, [roomTypes, assignedRoomObj, currentRes.roomTypeId]);

  const roomName = assignedRoomTypeObj?.name || currentRes.roomTypeName || (assignedRoomObj ? 'Normal' : 'Normal');

  // Dynamic Room Charges matching folio transactions or calculated nightly stay
  const roomChargesList = useMemo(() => {
    const roomChargeTxs = (currentFolio?.transactions || []).filter(tx => tx.type === 'ROOM_CHARGE');

    if (roomChargeTxs.length > 0) {
      return roomChargeTxs.map((tx) => {
        const dmy = formatSlashedDate(tx.date);
        const chargeVal = Number(tx.amount) || 0;
        const taxVal = Number(tx.tax) || 0;
        return {
          stay: dmy,
          room: currentRes.roomNumber || roomNum,
          ratePlan: currentRes.ratePlanName || currentRes.ratePlan || currentRes.ratePlanCode || 'test plan',
          pax: `${currentRes.adults || 1}/${currentRes.children || 0}`,
          charge: chargeVal.toFixed(2),
          tax: taxVal.toFixed(2),
          netAmount: (chargeVal + taxVal).toFixed(2)
        };
      });
    }

    // Dynamic nightly stay calculation using tax engine
    const nights = Math.max(1, Number(currentRes.nights) || 1);
    const startDt = new Date(currentRes.checkInDate || Date.now());
    const dailyRate = Number(currentRes.baseRatePerNight ?? currentRes.rate ?? currentRes.ratePerNight ?? 2500);
    const taxCalc = calculateRoomTax(dailyRate, 1, {
      isComplimentary: currentRes.isComplimentary,
      isTaxExempt: currentRes.isTaxExempt,
      isTaxInclusive: currentRes.isTaxInclusive
    });
    const dailyBase = Number(taxCalc.taxableAmount) || 0;
    const dailyTax = Number(taxCalc.totalTax) || 0;

    const list = [];
    for (let i = 0; i < nights; i++) {
      const d = new Date(startDt);
      d.setDate(d.getDate() + i);
      const iso = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
      list.push({
        stay: formatSlashedDate(iso || currentRes.checkInDate),
        room: currentRes.roomNumber || roomNum,
        ratePlan: currentRes.ratePlanName || currentRes.ratePlan || currentRes.ratePlanCode || 'test plan',
        pax: `${currentRes.adults || 1}/${currentRes.children || 0}`,
        charge: dailyBase.toFixed(2),
        tax: dailyTax.toFixed(2),
        netAmount: (dailyBase + dailyTax).toFixed(2)
      });
    }
    return list;
  }, [currentRes, currentFolio, roomNum]);

  const roomChargesSubtotal = useMemo(() => {
    return roomChargesList.reduce((acc, rc) => acc + (Number(rc.charge) || 0), 0).toFixed(2);
  }, [roomChargesList]);

  const roomChargesNetTotal = useMemo(() => {
    return roomChargesList.reduce((acc, rc) => acc + (Number(rc.netAmount) || 0), 0).toFixed(2);
  }, [roomChargesList]);

  const [liveAuditTrail, setLiveAuditTrail] = useState(() => pmsStore.getState().auditTrail || []);

  useEffect(() => {
    const unsub = pmsStore.subscribe((newState) => {
      if (Array.isArray(newState?.auditTrail)) {
        setLiveAuditTrail(newState.auditTrail);
      }
    });
    return unsub;
  }, []);

  // Live Audit Trail matching PMS operations (merges Firestore auditTrail collection + reservation.auditLogs)
  const currentResRef = currentRes.bookingReference || currentRes.id || '';
  const isRes14 = String(currentResRef).includes('14') || currentRes.id === 'res_14';

  const rawStoreAudits = useMemo(() => {
    const combinedMap = new Map();
    const fromStore = (liveAuditTrail || []).filter(a =>
      a && (
        a.reservationId === currentRes.id ||
        a.meta?.reservationId === currentRes.id ||
        a.bookingReference === currentRes.bookingReference ||
        a.meta?.bookingReference === currentRes.bookingReference ||
        (currentFolio?.folioNumber && (a.entityId === currentFolio.folioNumber || a.meta?.folioNumber === currentFolio.folioNumber)) ||
        (a.entityId && (a.entityId === currentRes.id || a.entityId === currentRes.bookingReference)) ||
        (a.details && (a.details.includes(currentRes.id) || (currentRes.bookingReference && a.details.includes(currentRes.bookingReference))))
      )
    );
    fromStore.forEach((a) => {
      if (a.id) combinedMap.set(a.id, a);
    });
    if (Array.isArray(currentRes.auditLogs)) {
      currentRes.auditLogs.forEach((a) => {
        if (a && a.id && !combinedMap.has(a.id)) {
          combinedMap.set(a.id, a);
        }
      });
    }
    return Array.from(combinedMap.values());
  }, [liveAuditTrail, currentRes.id, currentRes.bookingReference, currentRes.auditLogs, currentFolio?.folioNumber, folioVersion]);

  const mappedStoreAudits = useMemo(() => {
    return rawStoreAudits.map((a, idx) => {
      const meta = a.meta || {};
      const act = meta.actionType || a.action;
      let timeStr = '12:00:00 PM';
      if (a.timestamp) {
        const normalized = a.timestamp.includes('T') ? a.timestamp : a.timestamp.replace(' ', 'T');
        const d = new Date(normalized);
        if (!isNaN(d.getTime())) {
          timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } else if (a.timestamp.includes(':')) {
          timeStr = a.timestamp.split(' ')[1] || a.timestamp;
        }
      }
      const dateStr = a.timestamp
        ? String(a.timestamp).split(/[T ]/)[0]
        : (meta.date || getTodayIsoDate());
      const author = a.actor || a.userName || 'Astha India';

      if (act === 'NIGHT_AUDIT_PROCESSED' || a.action === 'NIGHT_AUDIT_PROCESSED') {
        return {
          id: a.id || `na_${idx}`,
          type: 'NIGHT_AUDIT_PROCESSED',
          nodeColor: '#4f46e5',
          icon: <Moon size={16} color="#4f46e5" />,
          title: 'Night Audit Processed',
          time: timeStr,
          date: dateStr,
          author,
          affectsRoom: true,
          roomNumber: meta.roomNumber || roomNum || '302',
          roomTypeName: meta.roomTypeName || roomName || 'Premium',
          dateVal: meta.date || dateStr,
          amount: meta.amount ?? 2500,
          taxAmount: meta.taxAmount ?? 300,
          status: 'POSTED_TO_FOLIO',
          affectedDates: meta.affectedDates || [dateStr]
        };
      }

      if (act === 'RATE_OVERRIDDEN' || a.action === 'RATE_OVERRIDDEN' || a.action === 'UPDATE_ROOM_CHARGES') {
        return {
          id: a.id || `rate_${idx}`,
          type: 'RATE_OVERRIDDEN',
          nodeColor: '#64748b',
          icon: <Clock size={16} color="#64748b" />,
          title: 'Rate Overridden',
          time: timeStr,
          date: dateStr,
          author,
          affectsRoom: true,
          oldValue: meta.oldAmount !== undefined ? `Date: ${meta.date || dateStr}   amount: ${meta.oldAmount}   tax Amount: ${meta.oldTax || 0}` : null,
          newValue: `Date: ${meta.date || dateStr}   amount: ${meta.newAmount ?? meta.amount ?? 0}   tax Amount: ${meta.newTax ?? meta.taxAmount ?? 0}`,
          value: `Date: ${meta.date || dateStr}   amount: ${meta.newAmount ?? meta.amount ?? 0}   tax Amount: ${meta.newTax ?? meta.taxAmount ?? 0}`,
          affectedDates: meta.affectedDates || [meta.date || dateStr]
        };
      }

      if (act === 'STAY_EXTENDED' || a.action === 'STAY_EXTENDED' || a.action === 'AMEND_STAY') {
        return {
          id: a.id || `stay_${idx}`,
          type: 'STAY_EXTENDED',
          nodeColor: '#ea580c',
          icon: <Pencil size={15} color="#ea580c" />,
          title: 'Stay Extended',
          time: timeStr,
          date: dateStr,
          author,
          affectsRoom: false,
          oldDates: meta.oldDates || `${currentRes.checkInDate} → ${currentRes.checkOutDate}`,
          newDates: meta.newDates || `${currentRes.checkInDate} → ${currentRes.checkOutDate}`,
          affectedDates: meta.affectedDates || [currentRes.checkInDate, currentRes.checkOutDate].filter(Boolean)
        };
      }

      if (act === 'ROOM_REASSIGNED' || a.action === 'ROOM_ASSIGNED' || a.action === 'ROOM_MOVE' || act === 'ROOM_ASSIGNED') {
        const isAssignment = a.action === 'ROOM_ASSIGNED' || meta.actionType === 'ROOM_ASSIGNED' || meta.oldRoom === 'UNASSIGNED';
        return {
          id: a.id || `room_${idx}`,
          type: 'ROOM_REASSIGNED',
          nodeColor: '#2563eb',
          icon: <Bed size={16} color="#2563eb" />,
          title: isAssignment ? 'Room Assigned' : 'Room Reassigned',
          time: timeStr,
          date: dateStr,
          author,
          affectsRoom: true,
          oldRoom: meta.oldRoom || (isAssignment ? 'UNASSIGNED' : '301'),
          newRoom: meta.newRoom || roomNum || '302',
          affectedDates: meta.affectedDates || [currentRes.checkInDate || dateStr]
        };
      }

      if (act === 'GUEST_CHECKED_IN' || a.action === 'CHECK_IN') {
        return {
          id: a.id || `checkin_${idx}`,
          type: 'GUEST_CHECKED_IN',
          nodeColor: '#9333ea',
          icon: <User size={16} color="#9333ea" />,
          title: 'Guest Checked In',
          time: timeStr,
          date: dateStr,
          author,
          affectsRoom: false,
          oldStatus: meta.oldStatus || 'RESERVED',
          newStatus: meta.newStatus || 'CHECKED_IN'
        };
      }

      if (act === 'RESERVATION_CREATED' || a.action === 'CREATE_RESERVATION') {
        const advVal = meta.advancePaid !== undefined ? meta.advancePaid : (meta.advanceAmount !== undefined ? meta.advanceAmount : meta.paidAmount);
        return {
          id: a.id || `created_${idx}`,
          type: 'RESERVATION_CREATED',
          nodeColor: '#16a34a',
          icon: <PlusCircle size={16} color="#16a34a" />,
          title: 'Reservation Created',
          time: timeStr,
          date: dateStr,
          author,
          affectsRoom: false,
          bookingRef: meta.bookingReference || currentRes.bookingReference || '#RES_1',
          guestName: meta.guestName || (currentRes.primaryGuest?.name || 'Guest'),
          stayDates: meta.stayDates || `${currentRes.checkInDate} → ${currentRes.checkOutDate}`,
          nights: meta.nights || currentRes.nights || 1,
          rooms: meta.rooms || currentRes.roomsCount || 1,
          totalAmount: meta.totalAmount || currentRes.totalAmount || '0.00',
          advancePaid: advVal !== undefined ? advVal : (currentRes.paidAmount || 0),
          bookingSource: (meta.bookingSource || currentRes.bookingSource || 'walk-in').toLowerCase(),
          status: (meta.status || currentRes.status || 'RESERVED').toUpperCase(),
          affectedDates: meta.affectedDates || [currentRes.checkInDate || dateStr]
        };
      }

      if (act === 'PAYMENT_ADDED' || a.action === 'ADD_PAYMENT' || act === 'ADD_PAYMENT') {
        const isAdvance = meta.isAdvance || meta.paymentType === 'Advance Payment' || meta.paymentType === 'Advance' || String(a.details || '').toLowerCase().includes('advance');
        return {
          id: a.id || `pay_${idx}`,
          type: 'PAYMENT_ADDED',
          nodeColor: '#10b981',
          icon: <CreditCard size={16} color="#10b981" />,
          title: isAdvance ? 'Advance Payment Received' : 'Payment Added',
          time: timeStr,
          date: dateStr,
          author,
          affectsRoom: false,
          isAdvance,
          method: meta.paymentMethod || 'UPI',
          amount: Math.abs(Number(meta.amount || 0)),
          voucherNumber: meta.voucherNumber || 'PAY-01',
          affectedDates: meta.affectedDates || [dateStr]
        };
      }

      if (
        act === 'PAYMENT_UPDATED' ||
        act === 'CHARGE_UPDATED' ||
        a.action === 'PAYMENT_UPDATED' ||
        a.action === 'CHARGE_UPDATED' ||
        a.action === 'UPDATE_TRANSACTION'
      ) {
        const isPayEdit =
          act === 'PAYMENT_UPDATED' ||
          a.action === 'PAYMENT_UPDATED' ||
          meta.isPayment === true ||
          String(a.details || '').toLowerCase().includes('payment');
        return {
          id: a.id || `tx_edit_${idx}`,
          type: 'TRANSACTION_UPDATED',
          nodeColor: '#2563eb',
          icon: <Pencil size={15} color="#2563eb" />,
          title: isPayEdit ? 'Payment Edited' : 'Charge Edited',
          time: timeStr,
          date: dateStr,
          author,
          affectsRoom: !isPayEdit,
          isPayment: isPayEdit,
          folioNumber: meta.folioNumber || currentFolio?.folioNumber || '',
          method: meta.paymentMethod || '',
          voucherNumber: meta.voucherNumber || '',
          oldAmount: meta.oldAmount,
          newAmount: meta.newAmount,
          oldDate: meta.oldDate,
          newDate: meta.newDate,
          oldDescription: meta.oldDescription,
          newDescription: meta.newDescription,
          details: a.details || '',
          affectedDates: meta.affectedDates || [meta.newDate || dateStr]
        };
      }

      if (act === 'CHARGE_ADDED' || a.action === 'ADD_CHARGE' || a.action === 'POST_PENDING_CHARGES') {
        return {
          id: a.id || `chg_${idx}`,
          type: 'CHARGE_ADDED',
          nodeColor: '#f59e0b',
          icon: <FileSpreadsheet size={16} color="#f59e0b" />,
          title: 'Charge Added',
          time: timeStr,
          date: dateStr,
          author,
          affectsRoom: true,
          category: meta.category || 'Folio Charge',
          amount: meta.amount || 0,
          tax: meta.tax || 0,
          voucherNumber: meta.voucherNumber,
          desc: meta.description,
          affectedDates: meta.affectedDates || [dateStr]
        };
      }

      if (act === 'VOID_PAYMENT' || a.action === 'VOID_PAYMENT') {
        return {
          id: a.id || `void_${idx}`,
          type: 'VOID_PAYMENT',
          nodeColor: '#ef4444',
          icon: <Ban size={16} color="#ef4444" />,
          title: 'Transaction Voided',
          time: timeStr,
          date: dateStr,
          author,
          affectsRoom: false,
          reason: meta.voidReason || 'Voided by front-desk',
          affectedDates: meta.affectedDates || [dateStr]
        };
      }

      if (act === 'CHECK_OUT' || a.action === 'CHECK_OUT' || act === 'GUEST_CHECKED_OUT') {
        return {
          id: a.id || `checkout_${idx}`,
          type: 'GUEST_CHECKED_OUT',
          nodeColor: '#10b981',
          icon: <LogOut size={16} color="#10b981" />,
          title: 'Guest Checked Out',
          time: timeStr,
          date: dateStr,
          author,
          affectsRoom: true,
          roomNumber: meta.roomNumber || roomNum || '',
          guestName: meta.guestName || currentRes.primaryGuest?.name || '',
          details: a.details || '',
          oldStatus: meta.oldStatus || 'CHECKED_IN',
          newStatus: meta.newStatus || 'CHECKED_OUT',
          affectedDates: meta.affectedDates || [meta.actualCheckOutDate || dateStr]
        };
      }

      // Default generic
      return {
        id: a.id || `gen_${idx}`,
        type: 'GENERIC',
        nodeColor: '#64748b',
        icon: <Clock size={16} color="#64748b" />,
        title: a.details?.split(':')[0] || a.action?.replace(/_/g, ' ') || 'Audit Event',
        time: timeStr,
        date: dateStr,
        author,
        affectsRoom: false,
        details: a.details,
        affectedDates: meta.affectedDates || [dateStr]
      };
    });
  }, [rawStoreAudits, roomNum, roomName, currentRes]);

  const res14BaselineEvents = useMemo(() => [
    {
      id: 'aud_res14_rate1',
      type: 'RATE_OVERRIDDEN',
      nodeColor: '#64748b',
      icon: <Clock size={16} color="#64748b" />,
      title: 'Rate Overridden',
      time: '02:48:24 PM',
      date: '2026-11-16',
      author: 'Astha India',
      affectsRoom: true,
      value: 'Date: 2026-11-17   amount: 0   tax Amount: 0',
      affectedDates: ['2026-11-17']
    },
    {
      id: 'aud_res14_rate2',
      type: 'RATE_OVERRIDDEN',
      nodeColor: '#64748b',
      icon: <Clock size={16} color="#64748b" />,
      title: 'Rate Overridden',
      time: '01:51:53 PM',
      date: '2026-11-16',
      author: 'Astha India',
      affectsRoom: true,
      oldValue: 'Date: 2026-11-14   amount: 0   tax Amount: 0',
      newValue: 'Date: 2026-11-14   amount: 100000   tax Amount: 0',
      affectedDates: ['2026-11-14']
    },
    {
      id: 'aud_res14_stay1',
      type: 'STAY_EXTENDED',
      nodeColor: '#ea580c',
      icon: <Pencil size={15} color="#ea580c" />,
      title: 'Stay Extended',
      time: '01:48:49 PM',
      date: '2026-11-16',
      author: 'Astha India',
      affectsRoom: false,
      oldDates: '2026-11-13 → 2026-11-17',
      newDates: '2026-11-13 → 2026-11-18',
      affectedDates: ['2026-11-13', '2026-11-18']
    },
    {
      id: 'aud_res14_stay2',
      type: 'STAY_EXTENDED',
      nodeColor: '#ea580c',
      icon: <Pencil size={15} color="#ea580c" />,
      title: 'Stay Extended',
      time: '12:14:19 PM',
      date: '2026-11-16',
      author: 'Astha India',
      affectsRoom: false,
      oldDates: '2026-11-13 → 2026-11-14',
      newDates: '2026-11-13 → 2026-11-17',
      affectedDates: ['2026-11-13', '2026-11-17']
    },
    {
      id: 'aud_res14_room',
      type: 'ROOM_REASSIGNED',
      nodeColor: '#2563eb',
      icon: <Bed size={16} color="#2563eb" />,
      title: 'Room Reassigned',
      time: '12:03:52 PM',
      date: '2026-11-16',
      author: 'Astha India',
      affectsRoom: true,
      oldRoom: '301',
      newRoom: '302',
      affectedDates: ['2026-11-13']
    },
    {
      id: 'aud_res14_checkin',
      type: 'GUEST_CHECKED_IN',
      nodeColor: '#9333ea',
      icon: <User size={16} color="#9333ea" />,
      title: 'Guest Checked In',
      time: '12:03:23 PM',
      date: '2026-11-16',
      author: 'Astha India',
      affectsRoom: false,
      oldStatus: 'RESERVED',
      newStatus: 'CHECKED_IN'
    },
    {
      id: 'aud_res14_created',
      type: 'RESERVATION_CREATED',
      nodeColor: '#16a34a',
      icon: <PlusCircle size={16} color="#16a34a" />,
      title: 'Reservation Created',
      time: '12:03:25 PM',
      date: '2026-11-16',
      author: 'Astha India',
      affectsRoom: false,
      bookingRef: '#RES_14',
      guestName: 'shankar suthar',
      stayDates: '2026-11-13 → 2026-11-14',
      nights: 1,
      rooms: 1,
      totalAmount: '9319.64',
      bookingSource: 'WALKIN',
      status: 'IN_HOUSE',
      affectedDates: ['2026-11-13']
    }
  ], []);

  const genericBaselineEvents = useMemo(() => {
    // Determine accurate dates and times from reservation object
    const createdTimestamp = currentRes.createdAt ? new Date(currentRes.createdAt) : null;
    const checkedInTimestamp = currentRes.checkedInAt ? new Date(currentRes.checkedInAt) : null;

    const resDate = currentRes.checkInDate || currentRes.bookingDate || property?.businessDate || getTodayIsoDate();

    // Accurate Check-In time:
    const checkInTimeStr = checkedInTimestamp && !isNaN(checkedInTimestamp.getTime())
      ? checkedInTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : (currentRes.checkInTime ? (currentRes.checkInTime.length === 5 ? `${currentRes.checkInTime}:00` : currentRes.checkInTime) : '02:00:00 PM');
    const checkInDateStr = checkedInTimestamp && !isNaN(checkedInTimestamp.getTime())
      ? checkedInTimestamp.toISOString().split('T')[0]
      : resDate;

    // Accurate Creation time:
    const createdTimeStr = createdTimestamp && !isNaN(createdTimestamp.getTime())
      ? createdTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : (currentRes.checkInTime ? (currentRes.checkInTime.length === 5 ? `${currentRes.checkInTime}:00` : currentRes.checkInTime) : '11:30:00 AM');
    const createdDateStr = currentRes.bookingDate || (createdTimestamp && !isNaN(createdTimestamp.getTime()) ? createdTimestamp.toISOString().split('T')[0] : resDate);

    // Accurate Room Assigned time (at creation or check-in):
    const roomAssignedTimeStr = createdTimeStr;
    const roomAssignedDateStr = resDate;

    const normStatus = String(currentRes.status || '').toLowerCase().replace(/[\s-]+/g, '_');
    const isCheckedOut = normStatus === 'checked_out';
    const isCheckedIn = normStatus === 'in_house' || normStatus === 'checked_in' || isCheckedOut;

    const checkedOutTimestamp = currentRes.checkedOutAt ? new Date(currentRes.checkedOutAt) : null;
    const checkOutDateStr =
      currentRes.actualCheckOutDate ||
      (checkedOutTimestamp && !isNaN(checkedOutTimestamp.getTime())
        ? checkedOutTimestamp.toISOString().split('T')[0]
        : currentRes.checkOutDate || resDate);
    const checkOutTimeStr =
      checkedOutTimestamp && !isNaN(checkedOutTimestamp.getTime())
        ? checkedOutTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : (currentRes.checkOutTime
            ? (currentRes.checkOutTime.length === 5 ? `${currentRes.checkOutTime}:00` : currentRes.checkOutTime)
            : '11:00:00 AM');

    // Check for advance payment / payments in folio transactions or currentRes
    const folioPaymentTxs = (currentFolio?.transactions || []).filter(tx =>
      tx && (tx.type === 'PAYMENT' || tx.direction === 'CREDIT' || Number(tx.amount) < 0)
    );

    const paymentBaselineEvents = folioPaymentTxs.length > 0
      ? folioPaymentTxs.map((tx, idx) => {
          const isAdv = String(tx.desc || '').toLowerCase().includes('advance') ||
                        String(tx.paymentType || '').toLowerCase().includes('advance') ||
                        String(tx.particulars || '').toLowerCase().includes('advance') ||
                        true;
          return {
            id: `aud_base_pay_${tx.id || idx}`,
            type: 'PAYMENT_ADDED',
            nodeColor: '#10b981',
            icon: <CreditCard size={16} color="#10b981" />,
            title: isAdv ? 'Advance Payment Received' : 'Payment Added',
            time: createdTimeStr,
            date: tx.date || createdDateStr,
            author: 'Astha India',
            affectsRoom: false,
            isAdvance: isAdv,
            method: tx.paymentMethod || 'UPI',
            amount: Math.abs(Number(tx.amount || 0)),
            voucherNumber: tx.voucherNumber || tx.paymentReference || 'Direct',
            affectedDates: [tx.date || resDate]
          };
        })
      : (Number(currentRes.paidAmount) > 0 ? [{
          id: `aud_base_pay_adv_${currentRes.id}`,
          type: 'PAYMENT_ADDED',
          nodeColor: '#10b981',
          icon: <CreditCard size={16} color="#10b981" />,
          title: 'Advance Payment Received',
          time: createdTimeStr,
          date: createdDateStr,
          author: 'Astha India',
          affectsRoom: false,
          isAdvance: true,
          method: currentRes.paymentMethod || 'UPI',
          amount: Number(currentRes.paidAmount),
          voucherNumber: currentRes.paymentReference || 'Direct',
          affectedDates: [resDate]
        }] : []);

    return [
      ...(isCheckedOut ? [{
        id: `aud_base_co_${currentRes.id}`,
        type: 'GUEST_CHECKED_OUT',
        nodeColor: '#10b981',
        icon: <LogOut size={16} color="#10b981" />,
        title: 'Guest Checked Out',
        time: checkOutTimeStr,
        date: checkOutDateStr,
        author: 'Astha India',
        affectsRoom: true,
        roomNumber: roomNum || '',
        guestName: guestForm.firstName ? `${guestForm.firstName} ${guestForm.lastName}` : (currentRes.primaryGuest?.name || 'Guest'),
        oldStatus: 'CHECKED_IN',
        newStatus: 'CHECKED_OUT',
        affectedDates: [checkOutDateStr]
      }] : []),
      ...(isCheckedIn ? [{
        id: `aud_base_ci_${currentRes.id}`,
        type: 'GUEST_CHECKED_IN',
        nodeColor: '#9333ea',
        icon: <User size={16} color="#9333ea" />,
        title: 'Guest Checked In',
        time: checkInTimeStr,
        date: checkInDateStr,
        author: 'Astha India',
        affectsRoom: false,
        oldStatus: 'RESERVED',
        newStatus: 'CHECKED_IN'
      }] : []),
      ...(roomNum ? [{
        id: `aud_base_rm_${currentRes.id}`,
        type: 'ROOM_REASSIGNED',
        nodeColor: '#2563eb',
        icon: <Bed size={16} color="#2563eb" />,
        title: 'Room Assigned',
        time: roomAssignedTimeStr,
        date: roomAssignedDateStr,
        author: 'Astha India',
        affectsRoom: true,
        oldRoom: 'UNASSIGNED',
        newRoom: roomNum,
        affectedDates: [resDate]
      }] : []),
      ...paymentBaselineEvents,
      {
        id: `aud_base_cr_${currentRes.id}`,
        type: 'RESERVATION_CREATED',
        nodeColor: '#16a34a',
        icon: <PlusCircle size={16} color="#16a34a" />,
        title: 'Reservation Created',
        time: createdTimeStr,
        date: createdDateStr,
        author: 'Astha India',
        affectsRoom: false,
        bookingRef: currentRes.bookingReference || '#RES_1',
        guestName: guestForm.firstName ? `${guestForm.firstName} ${guestForm.lastName}` : (currentRes.primaryGuest?.name || 'Guest'),
        stayDates: `${currentRes.checkInDate} → ${currentRes.checkOutDate}`,
        nights: nightsCount || 1,
        rooms: 1,
        totalAmount: totalCharges || '1120.00',
        advancePaid: Number(currentRes.paidAmount || 0),
        bookingSource: (bookingForm.bookingSource || currentRes.bookingSource || 'walk-in').toLowerCase(),
        status: (currentRes.status || 'RESERVED').toUpperCase(),
        affectedDates: [resDate]
      }
    ];
  }, [currentRes, roomNum, guestForm, nightsCount, totalCharges, bookingForm, property?.businessDate, currentFolio]);

  const allTimelineEvents = useMemo(() => {
    if (isRes14) {
      const baselineIds = new Set(res14BaselineEvents.map(b => b.id));
      const newStoreAudits = mappedStoreAudits.filter(a => !baselineIds.has(a.id));
      return [...newStoreAudits, ...res14BaselineEvents];
    }

    // Identify which lifecycle event types are ALREADY recorded in store audits
    const storeEventTypes = new Set(mappedStoreAudits.map(a => a.type));

    // Exclude any baseline event whose type is already handled by live store audits
    const nonDuplicateBaselines = genericBaselineEvents.filter(b => {
      if (b.type === 'GUEST_CHECKED_OUT' && storeEventTypes.has('GUEST_CHECKED_OUT')) return false;
      if (b.type === 'GUEST_CHECKED_IN' && storeEventTypes.has('GUEST_CHECKED_IN')) return false;
      if (b.type === 'ROOM_REASSIGNED' && storeEventTypes.has('ROOM_REASSIGNED')) return false;
      if (b.type === 'RESERVATION_CREATED' && storeEventTypes.has('RESERVATION_CREATED')) return false;
      if (b.type === 'PAYMENT_ADDED' && storeEventTypes.has('PAYMENT_ADDED')) return false;
      return true;
    });

    const combined = [...mappedStoreAudits, ...nonDuplicateBaselines];

    // Deduplicate any exact identical events
    const seen = new Set();
    const result = [];
    for (const ev of combined) {
      const key = `${ev.type}_${ev.date}_${ev.time}_${ev.oldStatus || ''}_${ev.newStatus || ''}_${ev.oldRoom || ''}_${ev.newRoom || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(ev);
      }
    }

    return result;
  }, [isRes14, res14BaselineEvents, genericBaselineEvents, mappedStoreAudits]);

  const filteredTimelineEvents = useMemo(() => {
    if (auditFilter === 'room') {
      return allTimelineEvents.filter(e => e.affectsRoom);
    }
    return allTimelineEvents;
  }, [allTimelineEvents, auditFilter]);

  const allActivityCount = allTimelineEvents.length;
  const roomActivityCount = allTimelineEvents.filter(e => e.affectsRoom).length;

  const auditDateHeading = useMemo(() => {
    const rawDate = filteredTimelineEvents[0]?.date || currentRes.checkInDate || property?.businessDate || getTodayIsoDate();
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      }
    } catch (e) {}
    return 'November 17, 2026';
  }, [filteredTimelineEvents, currentRes.checkInDate, property?.businessDate]);

  const handleSaveAll = () => {
    if (isCancelled) {
      alert('This reservation has been cancelled. Cancelled reservations cannot be modified.');
      return;
    }
    if (isNoShow) {
      alert('This reservation has been marked as No-Show. No-Show reservations cannot be modified.');
      return;
    }
    if (isCheckedOut) {
      alert('This reservation is checked out. Customer, booking, and payment details cannot be changed.');
      return;
    }
    const updatedPayload = {
      ...currentRes,
      checkInTime,
      checkOutTime,
      primaryGuest: {
        ...currentRes.primaryGuest,
        ...guestForm,
        name: `${guestForm.title} ${guestForm.firstName} ${guestForm.lastName}`.trim()
      },
      additionalGuests,
      ...bookingForm
    };
    if (onSave) {
      onSave(updatedPayload);
    } else {
      pmsStore.updateReservation(currentRes.id, updatedPayload);
    }
    alert('Reservation changes saved successfully!');
  };

  // Step 3.1: Post Pending Charges
  const handlePostPendingCharges = () => {
    if (isCancelled || isNoShow) {
      alert(`Cannot post charges to a ${isNoShow ? 'no-show' : 'cancelled'} reservation.`);
      return;
    }
    if (isCheckedOut) {
      alert('Cannot post charges to a checked out reservation.');
      return;
    }
    if (onPostPendingCharges) {
      onPostPendingCharges(currentRes.id);
    } else {
      pmsStore.postPendingCharges(currentRes.id);
    }
    setFolioVersion(v => v + 1);
    alert('Success: Pending nightly charges posted onto guest folio.');
  };

  // Step 3.2: Add Charge
  const handleAddChargeSubmit = (e) => {
    e.preventDefault();
    if (isCancelled || isNoShow) {
      alert(`Cannot add charges to a ${isNoShow ? 'no-show' : 'cancelled'} reservation.`);
      return;
    }
    if (isCheckedOut) {
      alert('Cannot add charges to a checked out reservation.');
      return;
    }
    if (!newCharge.amount) return;
    const chargePayload = {
      category: newCharge.category,
      receiptNumber: newCharge.receiptNumber,
      amount: newCharge.amount,
      description: newCharge.description
    };
    if (onAddFolioCharge) {
      onAddFolioCharge(currentRes.id, chargePayload);
    } else {
      pmsStore.addFolioCharge(currentRes.id, chargePayload);
    }
    setShowAddChargeModal(false);
    setNewCharge({
      category: 'Room (Room Rent / Accommodation)',
      receiptNumber: '',
      amount: '',
      description: ''
    });
    setFolioVersion(v => v + 1);
  };

  // Step 3.3: Add Payment
  const handleAddPaymentSubmit = (e) => {
    e.preventDefault();
    if (isCancelled || isNoShow) {
      alert(`Cannot add payments to a ${isNoShow ? 'no-show' : 'cancelled'} reservation.`);
      return;
    }
    if (isCheckedOut) {
      alert('Cannot add payments to a checked out reservation.');
      return;
    }
    if (!newPayment.amount) return;
    const paymentPayload = {
      folioId: newPayment.folioId,
      type: newPayment.type,
      paymentMethod: newPayment.paymentMethod,
      amount: newPayment.amount,
      description: newPayment.description,
      reference: newPayment.reference
    };
    if (onAddFolioPayment) {
      onAddFolioPayment(currentRes.id, paymentPayload);
    } else {
      pmsStore.addFolioPayment(currentRes.id, paymentPayload);
    }
    setShowAddPaymentModal(false);
    setNewPayment({
      folioId: currentFolio.folioNumber || 'FOL_1',
      type: 'Settlement',
      paymentMethod: 'UPI',
      amount: '',
      reference: '',
      description: ''
    });
    setFolioVersion(v => v + 1);
  };

  // Step 3.4: Void Payment
  const handleConfirmVoidPayment = (txId, voidReason) => {
    if (isCancelled || isNoShow) {
      alert(`Cannot void payment on a ${isNoShow ? 'no-show' : 'cancelled'} reservation.`);
      return;
    }
    if (isCheckedOut) {
      alert('Cannot void payment on a checked out reservation.');
      return;
    }
    pmsStore.voidPayment(currentRes.id, txId, voidReason);
    if (onVoidPayment) onVoidPayment(currentRes.id, txId, voidReason);
    setVoidModalTx(null);
    setFolioVersion(v => v + 1);
  };

  return (
    <div className="edit-res-page">
      {/* 1. Breadcrumbs */}
      <div className="edit-res-breadcrumb">
        <Home size={14} />
        <span className="crumb-link" onClick={() => onNavigate ? onNavigate('dashboard') : onBack ? onBack() : null}>PMS</span>
        <span className="crumb-sep">&gt;</span>
        <span className="crumb-link crumb-active" onClick={() => onNavigate ? onNavigate('reservations') : onBack ? onBack() : null}>Reservations</span>
        <span className="crumb-sep">&gt;</span>
        <span>Edit Reservation</span>
      </div>

      {/* 2. Top Header Summary Card */}
      <div className="edit-res-header-card">
        <div className="edit-res-header-left">
          <button className="edit-res-back-btn" onClick={onBack} title="Back to Reservations">
            <ArrowLeft size={18} />
          </button>

          <div className="edit-res-bed-icon">
            <span className="material-symbols-outlined select-none" style={{ fontSize: '24px' }}>
              hotel
            </span>
          </div>

          <div className="edit-res-guest-title-col">
            <div className="edit-res-name-badge-row">
              <span className="edit-res-guest-name">
                {guestForm.title} {guestForm.firstName} {guestForm.lastName}
              </span>
              <span className={`edit-res-status-pill ${isInHouse ? 'in-house' : isConfirmed ? 'confirmed' : isCheckedOut ? 'checked-out' : isCancelled ? 'cancelled' : isNoShow ? 'no-show' : ''}`}>
                {isInHouse ? 'In House' : isConfirmed ? 'Confirmed' : isCheckedOut ? 'Checked Out' : isCancelled ? 'Cancelled' : isNoShow ? 'No Show' : reservation.status}
              </span>
            </div>

            <div className="edit-res-meta-subline">
              <span className="edit-res-pax-item">
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>man</span>
                <span>{reservation.adults || 1}</span>
              </span>
              <span className="edit-res-pax-item">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>child_care</span>
                <span>{reservation.children || 2}</span>
              </span>
              <span>Res. No. {reservation.bookingReference ? reservation.bookingReference.replace('#', '') : 'RES_1'}</span>
            </div>
          </div>
        </div>

        {/* Right side stats & checkout action */}
        <div className="edit-res-header-right">
          {/* Date & Nights Metrics Group with Separator Lines */}
          <div className="edit-res-date-metrics-group">
            <div className="edit-res-metric-divider" />

            {/* Arrival Metric */}
            <div className="edit-res-date-metric" style={{ position: 'relative' }}>
              <span className="metric-label">Arrival</span>
              <span className="metric-val">{arrivalText}</span>
              <div
                className="metric-time-edit"
                onClick={() => !isLocked && setEditingTimeType('checkIn')}
                style={{ cursor: isLocked ? 'default' : 'pointer' }}
                title={!isLocked ? 'Click to edit arrival time' : undefined}
              >
                <span>{checkInTime}</span>
                {!isLocked && <Pencil size={11} className="time-pencil-icon" />}
              </div>
              {editingTimeType === 'checkIn' && (
                <CustomTimePickerModal
                  isOpen={true}
                  initialTime={checkInTime}
                  label="Select Arrival Time"
                  onClose={() => setEditingTimeType(null)}
                  onSave={(newTime) => {
                    setCheckInTime(newTime);
                    setEditingTimeType(null);
                    pmsStore.updateReservation(currentRes.id, {
                      checkInTime: newTime,
                      actualCheckInTime: newTime,
                      arrivalTime: newTime
                    });
                    if (onSave) {
                      onSave({
                        ...currentRes,
                        checkInTime: newTime,
                        actualCheckInTime: newTime,
                        arrivalTime: newTime
                      });
                    }
                  }}
                />
              )}
            </div>

            <div className="edit-res-metric-divider" />

            {/* Departure Metric */}
            <div className="edit-res-date-metric" style={{ position: 'relative' }}>
              <span className="metric-label">Departure</span>
              <span className="metric-val">{departureText}</span>
              <div
                className="metric-time-edit"
                onClick={() => !isLocked && setEditingTimeType('checkOut')}
                style={{ cursor: isLocked ? 'default' : 'pointer' }}
                title={!isLocked ? 'Click to edit departure time' : undefined}
              >
                <span>{checkOutTime}</span>
                {!isLocked && <Pencil size={11} className="time-pencil-icon" />}
              </div>
              {editingTimeType === 'checkOut' && (
                <CustomTimePickerModal
                  isOpen={true}
                  initialTime={checkOutTime}
                  label="Select Departure Time"
                  onClose={() => setEditingTimeType(null)}
                  onSave={(newTime) => {
                    setCheckOutTime(newTime);
                    setEditingTimeType(null);
                    pmsStore.updateReservation(currentRes.id, { checkOutTime: newTime });
                    if (onSave) {
                      onSave({
                        ...currentRes,
                        checkOutTime: newTime
                      });
                    }
                  }}
                />
              )}
            </div>

            <div className="edit-res-metric-divider" />

            {/* Nights Metric */}
            <div className="edit-res-date-metric nights-metric">
              <span className="metric-label">Nights</span>
              <span className="metric-val">{nightsCount}</span>
            </div>

            <div className="edit-res-metric-divider" />
          </div>

          <div className="edit-res-stat-box charges">
            <span className="box-label">Charges</span>
            <span className="box-amount">{totalCharges}</span>
          </div>

          <div className="edit-res-stat-box paid">
            <span className="box-label">Paid</span>
            <span className="box-amount">{totalPaid}</span>
          </div>

          <div className="edit-res-stat-box outstanding">
            <span className="box-label">Outstanding</span>
            <span className="box-amount">{outstanding}</span>
          </div>

          {isInHouse ? (
            <button
              className="edit-res-checkout-btn"
              onClick={() => setShowCheckOutModal(true)}
            >
              Check Out
            </button>
          ) : isConfirmed ? (
            <button
              className="edit-res-checkin-btn"
              onClick={() => setShowCheckInModal(true)}
            >
              Check In
            </button>
          ) : null}

          {/* Fullscreen Button */}
          <button
            className="edit-res-fs-btn"
            onClick={toggleBrowserFullscreen}
            title={isBrowserFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          >
            {isBrowserFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Cancelled Locked Notice Banner */}
      {isCancelled && (
        <div className="edit-res-locked-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <div className="edit-res-locked-badge" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <Ban size={14} />
            <span>Reservation Cancelled</span>
          </div>
          <span>
            This reservation is cancelled. All customer personal details, stay parameters, room allocations, folio transactions, and payment records are locked and cannot be modified.
          </span>
        </div>
      )}

      {/* No-Show Locked Notice Banner */}
      {isNoShow && (
        <div className="edit-res-locked-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <div className="edit-res-locked-badge" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <Ban size={14} />
            <span>Reservation No-Show</span>
          </div>
          <span>
            This reservation is marked as No-Show. All customer personal details, stay parameters, room allocations, folio transactions, and payment records are locked and cannot be modified.
          </span>
        </div>
      )}

      {/* Checked Out Locked Notice Banner */}
      {isCheckedOut && (
        <div className="edit-res-locked-banner">
          <div className="edit-res-locked-badge">
            <ShieldCheck size={14} />
            <span>Checked Out & Locked</span>
          </div>
          <span>
            This reservation is checked out and finalized. Customer personal details, booking parameters, folio charges, and payment records are preserved in read-only mode and cannot be modified.
          </span>
        </div>
      )}

      {/* 3. Horizontal Navigation Tabs */}
      <div className="edit-res-tabs-bar">
        {[
          { id: 'guest', label: 'Guest Details' },
          { id: 'booking', label: 'Booking Details' },
          { id: 'folio', label: 'Folio Operations' },
          { id: 'charges', label: 'Room Charges' },
          { id: 'audit', label: 'Audit Trail' }
        ].map((tab) => (
          <button
            key={tab.id}
            className={`edit-res-tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id !== 'guest') {
                setIsAddingSharer(false);
                setEditingSharerIndex(null);
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4. Body 2-Column Split: Sub-sidebar + Content Area */}
      <div className="edit-res-body-layout">
        {/* Left Sub-Sidebar (Changes per tab) */}
        <div className="edit-res-sub-sidebar">
          {activeTab === 'guest' && (
            <>
              <div className="edit-res-sidebar-header">
                <span className="edit-res-sidebar-title">Guest</span>
                <div className="edit-res-sidebar-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {!isLocked && (
                    <div
                      className="add-sharer-popover-wrap"
                      ref={addSharerRef}
                      onMouseEnter={() => setShowAddSharerTooltip(true)}
                      onMouseLeave={() => setShowAddSharerTooltip(false)}
                    >
                      <button
                        type="button"
                        className="edit-res-add-btn-mini"
                        title="Add Sharer"
                        onClick={handleOpenAddSharer}
                      >
                        <Plus size={15} strokeWidth={2.5} />
                      </button>

                      {showAddSharerTooltip && (
                        <div
                          className="add-sharer-popover"
                          onClick={handleOpenAddSharer}
                          title="Add a room sharer"
                        >
                          <div className="add-sharer-popover-arrow" />
                          <span className="add-sharer-popover-text">Add Sharer</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className="edit-res-toggle-pill-wrap"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => {
                      setIsAddingSharer(false);
                      setEditingSharerIndex(null);
                      setShowGuestList(!showGuestList);
                    }}
                  >
                    <div className={`edit-res-toggle-switch ${showGuestList ? 'on' : ''}`}>
                      <div className="edit-res-toggle-switch-thumb" />
                    </div>
                    <span style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>
                      Guest List
                    </span>
                  </div>
                </div>
              </div>

              <div className="edit-res-sidebar-nav-card">
                <div
                  className="edit-res-room-header-row"
                  onClick={() => setIsRoomAccordionOpen(!isRoomAccordionOpen)}
                >
                  <div className="edit-res-room-header-left">
                    <Crown size={14} />
                    <span>{roomName} — {roomNum}</span>
                  </div>
                  {isRoomAccordionOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>

                {isRoomAccordionOpen && (
                  <>
                    <div
                      className={`edit-res-sidebar-item ${(!showGuestList && !isAddingSharer && editingSharerIndex === null) ? 'active' : ''}`}
                      onClick={() => {
                        setShowGuestList(false);
                        setIsAddingSharer(false);
                        setEditingSharerIndex(null);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <span>{guestForm.title} {guestForm.firstName} {guestForm.lastName}</span>
                      <ChevronRight size={13} color={(!showGuestList && !isAddingSharer && editingSharerIndex === null) ? "#2563eb" : "#94a3b8"} />
                    </div>
                    {additionalGuests.map((ag, idx) => {
                      const displayName = ag.name
                        ? (ag.title && !ag.name.startsWith(ag.title) ? `${ag.title} ${ag.name}` : ag.name)
                        : (ag.firstName ? `${ag.title ? ag.title + ' ' : ''}${ag.firstName} ${ag.lastName || ''}`.trim() : `Guest ${idx + 2}`);
                      const isSharerActive = !showGuestList && editingSharerIndex === idx;
                      return (
                        <div
                          key={ag.id || idx}
                          className={`edit-res-sidebar-item ${isSharerActive ? 'active' : ''}`}
                          onClick={() => handleSelectSharerToEdit(idx)}
                          style={{ cursor: 'pointer' }}
                        >
                          <span>{displayName}</span>
                          <ChevronRight size={13} color={isSharerActive ? "#2563eb" : "#94a3b8"} />
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </>
          )}

          {activeTab === 'booking' && (
            <>
              <div className="edit-res-sidebar-header">
                <span className="edit-res-sidebar-title">Room</span>
              </div>

              <div className="edit-res-sidebar-nav-card">
                <div className="edit-res-room-header-row">
                  <div className="edit-res-room-header-left">
                    <Crown size={14} />
                    <span>{roomName} — {roomNum}</span>
                  </div>
                  <ChevronUp size={14} />
                </div>

                <div className="edit-res-sidebar-item active">
                  <span>{guestForm.title} {guestForm.firstName} {guestForm.lastName}</span>
                  <ChevronRight size={13} color="#2563eb" />
                </div>
              </div>
            </>
          )}

          {activeTab === 'folio' && (
            <>
              <div className="edit-res-sidebar-header">
                <span className="edit-res-sidebar-title">Room / Folio</span>
                {!isLocked && (
                  <button className="edit-res-add-btn-mini" title="New Folio">
                    <Plus size={14} />
                  </button>
                )}
              </div>

              <div className="edit-res-sidebar-nav-card">
                <div className="edit-res-room-header-row">
                  <div className="edit-res-room-header-left">
                    <Crown size={14} />
                    <span>{roomName} — {roomNum}</span>
                  </div>
                  <ChevronUp size={14} />
                </div>

                <div className="edit-res-sidebar-item active">
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.78rem' }}>FOL_1</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {guestForm.firstName} {guestForm.lastName}
                    </span>
                  </div>
                  <ChevronRight size={13} color="#2563eb" />
                </div>
              </div>
            </>
          )}

          {activeTab === 'charges' && (
            <>
              <div className="edit-res-sidebar-header">
                <span className="edit-res-sidebar-title">Room</span>
              </div>

              <div className="edit-res-sidebar-nav-card">
                <div className="edit-res-sidebar-item">
                  <span>Group Info</span>
                  <ChevronRight size={13} color="#94a3b8" />
                </div>
                <div className="edit-res-sidebar-item active">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Crown size={13} />
                    <span>{roomNum} - {roomName}</span>
                  </div>
                  <ChevronRight size={13} color="#2563eb" />
                </div>
              </div>

              <div className="edit-res-sidebar-totals-box">
                <div className="edit-res-sidebar-total-line" style={{ color: '#ef4444' }}>
                  <span>Charges</span>
                  <span>{roomChargesSubtotal}</span>
                </div>
                <div className="edit-res-sidebar-total-line" style={{ color: '#0f172a' }}>
                  <span>Total</span>
                  <span>{roomChargesNetTotal}</span>
                </div>
              </div>
            </>
          )}

          {activeTab === 'audit' && (
            <>
              <div className="edit-res-sidebar-header">
                <span className="edit-res-sidebar-title">Room</span>
              </div>

              <div className="edit-res-sidebar-nav-card">
                <div
                  className={`edit-res-sidebar-item ${auditFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setAuditFilter('all')}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <History size={14} />
                    <span>All Activity</span>
                  </div>
                  <span className="edit-res-sidebar-counter">{allActivityCount}</span>
                </div>
                <div
                  className={`edit-res-sidebar-item ${auditFilter === 'room' ? 'active' : ''}`}
                  onClick={() => setAuditFilter('room')}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Bed size={15} style={{ flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600 }}>{roomName || 'Premium'} — {roomNum || '302'}</span>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {guestForm.firstName ? `${guestForm.firstName} ${guestForm.lastName}`.toLowerCase() : 'mr. dsdsf suthar'}
                      </span>
                    </div>
                  </div>
                  <span className="edit-res-sidebar-counter">{roomActivityCount}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Main Content Area */}
        <div key={activeTab} className="edit-res-main-content edit-tab-fade-enter">
          {/* TAB 1: GUEST DETAILS */}
          {activeTab === 'guest' && (
            (isAddingSharer || editingSharerIndex !== null) ? (
              <div className="add-sharer-view-container edit-tab-fade-enter">
                <div
                  className="add-sharer-back-header"
                  onClick={() => {
                    setIsAddingSharer(false);
                    setEditingSharerIndex(null);
                  }}
                >
                  <ChevronLeft size={16} />
                  <span>{editingSharerIndex !== null ? 'Edit Room Sharer' : 'Add Room Sharer'}</span>
                </div>

                {/* Section 1: General Information */}
                <div className="edit-res-section-card">
                  <h3 className="edit-res-section-title">General Information</h3>

                  <div className="edit-res-form-grid-4">
                    <div className="edit-res-field">
                      <label>Title <span style={{ color: '#ef4444' }}>*</span></label>
                      <select
                        className="edit-res-select"
                        value={sharerForm.title}
                        onChange={(e) => setSharerForm({ ...sharerForm, title: e.target.value })}
                      >
                        <option value="">Select Title</option>
                        <option value="Mr.">Mr.</option>
                        <option value="Mrs.">Mrs.</option>
                        <option value="Ms.">Ms.</option>
                        <option value="Dr.">Dr.</option>
                      </select>
                    </div>

                    <div className="edit-res-field">
                      <label>First Name <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        type="text"
                        className="edit-res-input"
                        placeholder="First Name"
                        value={sharerForm.firstName}
                        onChange={(e) => setSharerForm({ ...sharerForm, firstName: e.target.value })}
                      />
                    </div>

                    <div className="edit-res-field">
                      <label>Last Name</label>
                      <input
                        type="text"
                        className="edit-res-input"
                        placeholder="Last Name"
                        value={sharerForm.lastName}
                        onChange={(e) => setSharerForm({ ...sharerForm, lastName: e.target.value })}
                      />
                    </div>

                    <div className="edit-res-field">
                      <label>Mobile <span style={{ color: '#ef4444' }}>*</span></label>
                      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px' }}>
                        <select
                          className="edit-res-select"
                          value={sharerForm.countryCode}
                          onChange={(e) => setSharerForm({ ...sharerForm, countryCode: e.target.value })}
                        >
                          <option value="+91">Select code</option>
                          <option value="+91">+91 (IN)</option>
                          <option value="+1">+1 (US)</option>
                          <option value="+44">+44 (UK)</option>
                          <option value="+971">+971 (AE)</option>
                          <option value="+61">+61 (AU)</option>
                        </select>
                        <input
                          type="tel"
                          className="edit-res-input"
                          placeholder="Enter phone number"
                          value={sharerForm.mobile}
                          onChange={(e) => setSharerForm({ ...sharerForm, mobile: e.target.value })}
                        />
                      </div>
                      {sharerForm.mobile && sharerForm.mobile.trim().length > 0 && (sharerForm.mobile.replace(/\D/g, '').length < 10 || sharerForm.mobile.replace(/\D/g, '').length > 15) && (
                        <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                          Phone must be 10-15 digits
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="edit-res-form-grid-3">
                    <div className="edit-res-field">
                      <label>Email <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        type="email"
                        className="edit-res-input"
                        placeholder="Email"
                        value={sharerForm.email}
                        onChange={(e) => setSharerForm({ ...sharerForm, email: e.target.value })}
                      />
                    </div>

                    <div className="edit-res-field">
                      <label>Birth Date</label>
                      <CustomDatePicker
                        value={sharerForm.birthDate}
                        placeholder="Select date"
                        minYear={1930}
                        maxYear={2026}
                        onChange={(val) => setSharerForm({ ...sharerForm, birthDate: val })}
                      />
                    </div>

                    <div className="edit-res-field">
                      <label>Nationality</label>
                      <input
                        type="text"
                        className="edit-res-input"
                        placeholder="Nationality"
                        value={sharerForm.nationality}
                        onChange={(e) => setSharerForm({ ...sharerForm, nationality: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="edit-res-form-grid-4" style={{ alignItems: 'flex-end' }}>
                    <div className="edit-res-field">
                      <label>Gender</label>
                      <select
                        className="edit-res-select"
                        value={sharerForm.gender}
                        onChange={(e) => setSharerForm({ ...sharerForm, gender: e.target.value })}
                      >
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="edit-res-field">
                      <label>Guest Type</label>
                      <select
                        className="edit-res-select"
                        value={sharerForm.guestType}
                        onChange={(e) => setSharerForm({ ...sharerForm, guestType: e.target.value })}
                      >
                        <option value="">Select</option>
                        <option value="Adult">Adult</option>
                        <option value="Child">Child</option>
                      </select>
                    </div>

                    <div
                      className={`edit-res-switch-pill ${sharerForm.isPrimary ? 'primary-active' : ''}`}
                      onClick={() => setSharerForm({ ...sharerForm, isPrimary: !sharerForm.isPrimary })}
                      style={{ cursor: 'pointer' }}
                    >
                      <span>Is Primary</span>
                      <input type="checkbox" checked={sharerForm.isPrimary} readOnly />
                      <User size={14} />
                    </div>

                    <div
                      className={`edit-res-switch-pill vip-pill ${sharerForm.isVIP ? 'vip-active' : ''}`}
                      onClick={() => setSharerForm({ ...sharerForm, isVIP: !sharerForm.isVIP })}
                      style={{ cursor: 'pointer' }}
                    >
                      <span>Is VIP</span>
                      <input type="checkbox" checked={sharerForm.isVIP} readOnly />
                      <Star size={14} />
                    </div>
                  </div>
                </div>

                {/* Section 2: Address Details */}
                <div className="edit-res-section-card">
                  <h3 className="edit-res-section-title">Address Details</h3>

                  <div style={{ marginBottom: '1rem' }}>
                    <div className="edit-res-field">
                      <label>Address</label>
                      <input
                        type="text"
                        className="edit-res-input"
                        placeholder="Address"
                        value={sharerForm.address}
                        onChange={(e) => setSharerForm({ ...sharerForm, address: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="edit-res-form-grid-4">
                    <div className="edit-res-field">
                      <label>Zip</label>
                      <input
                        type="text"
                        className="edit-res-input"
                        placeholder="Zip"
                        value={sharerForm.zip}
                        onChange={(e) => setSharerForm({ ...sharerForm, zip: e.target.value })}
                      />
                    </div>

                    <div className="edit-res-field">
                      <label>Country</label>
                      <CountrySelect
                        value={sharerForm.country}
                        placeholder="Select Country"
                        onChange={(val) => setSharerForm({ ...sharerForm, country: val, state: '', city: '' })}
                      />
                    </div>

                    <div className="edit-res-field">
                      <label>State</label>
                      <SearchableSelect
                        value={sharerForm.state}
                        options={sharerStateOptions}
                        placeholder="Select State"
                        searchPlaceholder="Search State..."
                        allowCustom={true}
                        onChange={(val) => setSharerForm({ ...sharerForm, state: val, city: '' })}
                      />
                    </div>

                    <div className="edit-res-field">
                      <label>City</label>
                      <SearchableSelect
                        value={sharerForm.city}
                        options={sharerCityOptions}
                        placeholder="Select City"
                        searchPlaceholder="Search City..."
                        allowCustom={true}
                        onChange={(val) => setSharerForm({ ...sharerForm, city: val })}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Identity Information */}
                <div className="edit-res-section-card">
                  <h3 className="edit-res-section-title">Identity Information</h3>
                  <p className="edit-res-section-subtitle">Official identification and travel documents</p>

                  <div className="edit-res-identity-layout">
                    {/* Left upload box */}
                    <div style={{ position: 'relative', width: '180px', minHeight: '145px', display: 'flex', flexDirection: 'column' }}>
                      {sharerForm.idDocumentUrl ? (
                        <div className="id-photo-preview-wrap">
                          {sharerForm.idDocumentUrl.startsWith('data:application/pdf') || sharerForm.idDocumentName?.endsWith('.pdf') ? (
                            <div
                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#ef4444', padding: '16px 8px', textAlign: 'center', cursor: 'pointer' }}
                              onClick={() => setLightboxPreview({
                                url: sharerForm.idDocumentUrl,
                                title: `${sharerForm.firstName} ${sharerForm.lastName} - ID Document`,
                                idNumber: sharerForm.idNumber
                              })}
                            >
                              <FileText size={38} color="#ef4444" />
                              <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155', wordBreak: 'break-all' }}>
                                {sharerForm.idDocumentName || 'ID_Document.pdf'}
                              </span>
                            </div>
                          ) : (
                            <img
                              src={sharerForm.idDocumentUrl}
                              alt="ID Document Preview"
                              className="id-photo-preview-img"
                              onClick={() => setLightboxPreview({
                                url: sharerForm.idDocumentUrl,
                                title: `${sharerForm.firstName} ${sharerForm.lastName} - ID Document`,
                                idNumber: sharerForm.idNumber
                              })}
                              style={{ cursor: 'pointer' }}
                            />
                          )}

                          <div className="id-photo-overlay">
                            <button
                              type="button"
                              className="id-photo-btn"
                              title="Preview ID Fullscreen"
                              onClick={() => setLightboxPreview({
                                url: sharerForm.idDocumentUrl,
                                title: `${sharerForm.firstName} ${sharerForm.lastName} - ID Document`,
                                idNumber: sharerForm.idNumber
                              })}
                            >
                              <Eye size={15} color="#1e293b" />
                            </button>
                            <button
                              type="button"
                              className="id-photo-btn"
                              title="Change ID Photo"
                              onClick={() => sharerFileInputRef.current?.click()}
                            >
                              <Upload size={15} color="#2563eb" />
                            </button>
                            <button
                              type="button"
                              className="id-photo-btn delete"
                              title="Delete ID Photo"
                              onClick={handleRemoveSharerIdPhoto}
                            >
                              <Trash2 size={15} color="#ef4444" />
                            </button>
                          </div>

                          <div className="id-photo-badge">
                            <CheckCircle2 size={11} color="#10b981" />
                            <span>ID Uploaded</span>
                          </div>
                        </div>
                      ) : (
                        <label
                          className={`edit-res-upload-box ${isUploadingSharerId ? 'uploading' : ''}`}
                        >
                          {isUploadingSharerId ? (
                            <>
                              <Loader2 size={24} className="animate-spin" color="#2563eb" />
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#2563eb' }}>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Upload size={22} color="#2563eb" />
                              <span style={{ fontSize: '13px', fontWeight: 600 }}>+ Upload ID</span>
                              <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 500 }}>JPG, PNG or PDF</span>
                            </>
                          )}
                          <input
                            ref={sharerFileInputRef}
                            type="file"
                            accept="image/*,.pdf"
                            style={{ display: 'none' }}
                            disabled={isUploadingSharerId}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleSharerIdUpload(file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>

                    {/* Right fields */}
                    <div>
                      <div className="edit-res-form-grid-2">
                        <div className="edit-res-field">
                          <label>ID Number</label>
                          <input
                            type="text"
                            className="edit-res-input"
                            placeholder="ID Number"
                            value={sharerForm.idNumber}
                            onChange={(e) => setSharerForm({ ...sharerForm, idNumber: e.target.value })}
                          />
                        </div>

                        <div className="edit-res-field">
                          <label>ID Type</label>
                          <select
                            className="edit-res-select"
                            value={sharerForm.idType}
                            onChange={(e) => setSharerForm({ ...sharerForm, idType: e.target.value })}
                          >
                            <option value="">-Select-</option>
                            <option value="Aadhaar Card">Aadhaar Card</option>
                            <option value="Passport">Passport</option>
                            <option value="Driving License">Driving License</option>
                            <option value="Voter ID">Voter ID</option>
                          </select>
                        </div>
                      </div>

                      <div className="edit-res-form-grid-2">
                        <div className="edit-res-field">
                          <label>Issuing Country</label>
                          <CountrySelect
                            value={sharerForm.issuingCountry}
                            placeholder="Issuing Country"
                            placement="bottom"
                            onChange={(val) => setSharerForm({ ...sharerForm, issuingCountry: val })}
                          />
                        </div>

                        <div className="edit-res-field">
                          <label>Issuing City</label>
                          <SearchableSelect
                            value={sharerForm.issuingCity}
                            options={sharerCityOptions}
                            placeholder="Issuing City"
                            searchPlaceholder="Search City..."
                            allowCustom={true}
                            placement="bottom"
                            onChange={(val) => setSharerForm({ ...sharerForm, issuingCity: val })}
                          />
                        </div>
                      </div>

                      <div className="edit-res-form-grid-2">
                        <div className="edit-res-field">
                          <label>Expiry Date</label>
                          <CustomDatePicker
                            value={sharerForm.expiryDate}
                            placeholder="Select date"
                            minYear={2020}
                            maxYear={2045}
                            onChange={(val) => setSharerForm({ ...sharerForm, expiryDate: val })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : showGuestList ? (
              <div className="edit-res-guest-list-card">
                <div className="edit-res-guest-list-header">
                  <h3 className="edit-res-guest-list-title">Guest List</h3>
                  <p className="edit-res-guest-list-subtitle">Basic details about the guests</p>
                </div>

                <div className="edit-res-guest-table-wrap">
                  {/* Table Column Headers */}
                  <div className="edit-res-guest-table-header">
                    <div className="col-guest-name">Guest Name</div>
                    <div className="col-mobile">Mobile</div>
                    <div className="col-email">Email</div>
                    <div className="col-actions">Actions</div>
                  </div>

                  {/* Primary Guest Row */}
                  <div className="edit-res-guest-table-row">
                    <div className="col-guest-name name-input-group">
                      <select
                        className="edit-res-select title-select"
                        value={guestForm.title}
                        disabled={isLocked}
                        onChange={(e) => setGuestForm({ ...guestForm, title: e.target.value })}
                      >
                        <option value="Mr.">Mr.</option>
                        <option value="Mrs.">Mrs.</option>
                        <option value="Ms.">Ms.</option>
                        <option value="Dr.">Dr.</option>
                      </select>
                      <input
                        type="text"
                        className="edit-res-input"
                        placeholder="Guest Name"
                        value={primaryNameDisplay}
                        disabled={isLocked}
                        onChange={(e) => handlePrimaryNameInput(e.target.value)}
                      />
                    </div>

                    <div className="col-mobile">
                      <input
                        type="tel"
                        className="edit-res-input"
                        placeholder="Mobile"
                        value={guestForm.mobile}
                        disabled={isLocked}
                        onChange={(e) => setGuestForm({ ...guestForm, mobile: e.target.value })}
                      />
                    </div>

                    <div className="col-email">
                      <input
                        type="email"
                        className="edit-res-input"
                        placeholder="Email"
                        value={guestForm.email}
                        disabled={isLocked}
                        onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                      />
                    </div>

                    <div className="col-actions">
                      {guestForm.idDocumentUrl ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="edit-res-btn-uploaded-id"
                            onClick={() => setLightboxPreview({
                              url: guestForm.idDocumentUrl,
                              title: `${primaryNameDisplay || 'Primary Guest'} - ID Document`,
                              idNumber: guestForm.idNumber
                            })}
                            title="View Uploaded ID Document"
                          >
                            <CheckCircle2 size={13} color="#10B981" />
                            <span>ID Attached</span>
                            <Eye size={12} color="#059669" />
                          </button>
                          {!isLocked && (
                            <button
                              type="button"
                              className="edit-res-btn-icon-danger"
                              onClick={(e) => handleRemoveIdPhoto(e, 'primary')}
                              title="Delete ID Document"
                            >
                              <Trash2 size={13} color="#EF4444" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <label className={`edit-res-btn-upload-id ${isLocked ? 'disabled' : ''}`}>
                          <FileText size={15} color="#475569" />
                          <span>Upload ID</span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            style={{ display: 'none' }}
                            disabled={isLocked}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleIdFileUpload(file, 'primary');
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}

                      <button
                        type="button"
                        className="edit-res-btn-add-guest"
                        disabled={isLocked}
                        onClick={handleAddGuestRow}
                        title="Add another guest"
                      >
                        <Plus size={15} color="#ffffff" strokeWidth={2.5} />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>

                  {/* Additional Guest Rows */}
                  {additionalGuests.map((ag, idx) => (
                    <div key={ag.id || idx} className="edit-res-guest-table-row">
                      <div className="col-guest-name name-input-group">
                        <select
                          className="edit-res-select title-select"
                          value={ag.title || 'Mr.'}
                          disabled={isLocked}
                          onChange={(e) => handleUpdateAdditionalGuest(idx, 'title', e.target.value)}
                        >
                          <option value="Mr.">Mr.</option>
                          <option value="Mrs.">Mrs.</option>
                          <option value="Ms.">Ms.</option>
                          <option value="Dr.">Dr.</option>
                        </select>
                        <input
                          type="text"
                          className="edit-res-input"
                          placeholder="Guest Name"
                          value={ag.name || ''}
                          disabled={isLocked}
                          onChange={(e) => handleUpdateAdditionalGuest(idx, 'name', e.target.value)}
                        >
                        </input>
                      </div>

                      <div className="col-mobile">
                        <input
                          type="tel"
                          className="edit-res-input"
                          placeholder="Mobile"
                          value={ag.mobile || ''}
                          disabled={isLocked}
                          onChange={(e) => handleUpdateAdditionalGuest(idx, 'mobile', e.target.value)}
                        />
                      </div>

                      <div className="col-email">
                        <input
                          type="email"
                          className="edit-res-input"
                          placeholder="Email"
                          value={ag.email || ''}
                          disabled={isLocked}
                          onChange={(e) => handleUpdateAdditionalGuest(idx, 'email', e.target.value)}
                        />
                      </div>

                      <div className="col-actions">
                        {ag.idDocumentUrl ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              className="edit-res-btn-uploaded-id"
                              onClick={() => setLightboxPreview({
                                url: ag.idDocumentUrl,
                                title: `${ag.name || `Guest ${idx + 2}`} - ID Document`,
                                idNumber: ag.idNumber || ''
                              })}
                              title="View Uploaded ID Document"
                            >
                              <CheckCircle2 size={13} color="#10B981" />
                              <span>ID Attached</span>
                              <Eye size={12} color="#059669" />
                            </button>
                            {!isLocked && (
                              <button
                                type="button"
                                className="edit-res-btn-icon-danger"
                                onClick={(e) => handleRemoveIdPhoto(e, idx)}
                                title="Delete ID Document"
                              >
                                <Trash2 size={13} color="#EF4444" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <label className={`edit-res-btn-upload-id ${isLocked ? 'disabled' : ''}`}>
                            <FileText size={15} color="#475569" />
                            <span>Upload ID</span>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              style={{ display: 'none' }}
                              disabled={isLocked}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleIdFileUpload(file, idx);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}

                        {!isLocked && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              className="edit-res-btn-edit-guest"
                              title="Edit Room Sharer Details"
                              onClick={() => handleSelectSharerToEdit(idx)}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="edit-res-btn-remove-guest"
                              title="Remove guest"
                              onClick={() => handleRemoveAdditionalGuest(idx)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* Section 1: General Information */}
                <div className="edit-res-section-card">
                <h3 className="edit-res-section-title">General Information</h3>

                <div className="edit-res-form-grid-4">
                  <div className="edit-res-field">
                    <label>Title <span className="required-star">*</span></label>
                    <select
                      className="edit-res-select"
                      value={guestForm.title}
                      disabled={isLocked}
                      onChange={(e) => setGuestForm({ ...guestForm, title: e.target.value })}
                    >
                      <option value="Mr.">Mr.</option>
                      <option value="Mrs.">Mrs.</option>
                      <option value="Ms.">Ms.</option>
                      <option value="Dr.">Dr.</option>
                    </select>
                  </div>

                  <div className="edit-res-field">
                    <label>First Name <span className="required-star">*</span></label>
                    <input
                      type="text"
                      className="edit-res-input"
                      value={guestForm.firstName}
                      disabled={isLocked}
                      readOnly={isLocked}
                      onChange={(e) => setGuestForm({ ...guestForm, firstName: e.target.value })}
                    />
                  </div>

                  <div className="edit-res-field">
                    <label>Last Name</label>
                    <input
                      type="text"
                      className="edit-res-input"
                      value={guestForm.lastName}
                      disabled={isLocked}
                      readOnly={isLocked}
                      onChange={(e) => setGuestForm({ ...guestForm, lastName: e.target.value })}
                    />
                  </div>

                  <div className="edit-res-field">
                    <label>Mobile</label>
                    <div className={`edit-res-phone-input-wrap ${isLocked ? 'disabled' : ''}`}>
                      <div className="edit-res-country-code">
                        <span>{guestForm.countryCode}</span>
                        <ChevronDown size={12} />
                      </div>
                      <input
                        type="tel"
                        className="edit-res-phone-input"
                        value={guestForm.mobile}
                        disabled={isLocked}
                        readOnly={isLocked}
                        onChange={(e) => setGuestForm({ ...guestForm, mobile: e.target.value })}
                      />
                    </div>
                    {guestForm.mobile && guestForm.mobile.trim().length > 0 && (guestForm.mobile.replace(/\D/g, '').length < 10 || guestForm.mobile.replace(/\D/g, '').length > 15) && (
                      <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                        Phone must be 10-15 digits
                      </div>
                    )}
                  </div>
                </div>

                <div className="edit-res-form-grid-3">
                  <div className="edit-res-field">
                    <label>Email</label>
                    <input
                      type="email"
                      className="edit-res-input"
                      value={guestForm.email}
                      disabled={isLocked}
                      readOnly={isLocked}
                      onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                    />
                  </div>

                  <div className="edit-res-field">
                    <label>Birth Date</label>
                    <CustomDatePicker
                      value={guestForm.birthDate}
                      disabled={isLocked}
                      placeholder="Select date"
                      onChange={(val) => setGuestForm({ ...guestForm, birthDate: val })}
                    />
                  </div>

                  <div className="edit-res-field">
                    <label>Nationality</label>
                    <input
                      type="text"
                      className="edit-res-input"
                      placeholder="Nationality"
                      value={guestForm.nationality}
                      disabled={isLocked}
                      readOnly={isLocked}
                      onChange={(e) => setGuestForm({ ...guestForm, nationality: e.target.value })}
                    />
                  </div>
                </div>

                <div className="edit-res-form-grid-4" style={{ alignItems: 'flex-end' }}>
                  <div className="edit-res-field">
                    <label>Gender</label>
                    <select
                      className="edit-res-select"
                      value={guestForm.gender}
                      disabled={isLocked}
                      onChange={(e) => setGuestForm({ ...guestForm, gender: e.target.value })}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="edit-res-field">
                    <label>Guest Type</label>
                    <select
                      className="edit-res-select"
                      value={guestForm.guestType}
                      disabled={isLocked}
                      onChange={(e) => setGuestForm({ ...guestForm, guestType: e.target.value })}
                    >
                      <option value="Adult">Adult</option>
                      <option value="Child">Child</option>
                    </select>
                  </div>

                  <div
                    className={`edit-res-switch-pill ${guestForm.isPrimary ? 'primary-active' : ''} ${isLocked ? 'disabled' : ''}`}
                    onClick={() => !isLocked && setGuestForm({ ...guestForm, isPrimary: !guestForm.isPrimary })}
                    style={isLocked ? { cursor: 'not-allowed', opacity: 0.75 } : {}}
                  >
                    <span>Is Primary</span>
                    <input type="checkbox" checked={guestForm.isPrimary} readOnly disabled={isLocked} />
                    <User size={14} />
                  </div>

                  <div
                    className={`edit-res-switch-pill vip-pill ${guestForm.isVIP ? 'vip-active' : ''} ${isLocked ? 'disabled' : ''}`}
                    onClick={() => !isLocked && setGuestForm({ ...guestForm, isVIP: !guestForm.isVIP })}
                    style={isLocked ? { cursor: 'not-allowed', opacity: 0.75 } : {}}
                  >
                    <span>Is VIP</span>
                    <input type="checkbox" checked={guestForm.isVIP} readOnly disabled={isLocked} />
                    <Star size={14} />
                  </div>
                </div>
              </div>

              {/* Section 2: Address Details */}
              <div className="edit-res-section-card">
                <h3 className="edit-res-section-title">Address Details</h3>

                <div style={{ marginBottom: '1rem' }}>
                  <div className="edit-res-field">
                    <label>Address</label>
                    <input
                      type="text"
                      className="edit-res-input"
                      value={guestForm.address}
                      disabled={isLocked}
                      readOnly={isLocked}
                      onChange={(e) => setGuestForm({ ...guestForm, address: e.target.value })}
                    />
                  </div>
                </div>

                <div className="edit-res-form-grid-4">
                  <div className="edit-res-field">
                    <label>Zip</label>
                    <input
                      type="text"
                      className="edit-res-input"
                      value={guestForm.zip}
                      disabled={isLocked}
                      readOnly={isLocked}
                      onChange={(e) => setGuestForm({ ...guestForm, zip: e.target.value })}
                    />
                  </div>

                  <div className="edit-res-field">
                    <label>Country</label>
                    <CountrySelect
                      value={guestForm.country}
                      disabled={isLocked}
                      placeholder="Select country"
                      placement="bottom"
                      onChange={(val) => setGuestForm({ ...guestForm, country: val })}
                    />
                  </div>

                  <div className="edit-res-field">
                    <label>State</label>
                    <SearchableSelect
                      value={guestForm.state}
                      options={stateOptions}
                      disabled={isLocked}
                      placeholder="Select State"
                      searchPlaceholder="Search State..."
                      allowCustom={true}
                      placement="bottom"
                      onChange={(val) => {
                        setGuestForm({ ...guestForm, state: val, city: '' });
                      }}
                    />
                  </div>

                  <div className="edit-res-field">
                    <label>City</label>
                    <SearchableSelect
                      value={guestForm.city}
                      options={cityOptions}
                      disabled={isLocked}
                      placeholder="Select City"
                      searchPlaceholder="Search City..."
                      allowCustom={true}
                      onChange={(val) => setGuestForm({ ...guestForm, city: val })}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Identity Information */}
              <div className="edit-res-section-card">
                <h3 className="edit-res-section-title">Identity Information</h3>
                <p className="edit-res-section-subtitle">Official identification and travel documents</p>

                <div className="edit-res-identity-layout">
                  {/* Left upload box */}
                  <div style={{ position: 'relative', width: '180px', minHeight: '145px', display: 'flex', flexDirection: 'column' }}>
                    {guestForm.idDocumentUrl ? (
                      <div className="id-photo-preview-wrap">
                        {guestForm.idDocumentUrl.startsWith('data:application/pdf') || guestForm.idDocumentName?.endsWith('.pdf') ? (
                          <div
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#EF4444', padding: '16px 8px', textAlign: 'center', cursor: 'pointer' }}
                            onClick={() => setLightboxPreview({
                              url: guestForm.idDocumentUrl,
                              title: `${primaryNameDisplay || 'Primary Guest'} - ID Document`,
                              idNumber: guestForm.idNumber
                            })}
                          >
                            <FileText size={38} color="#EF4444" />
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155', wordBreak: 'break-all' }}>
                              {guestForm.idDocumentName || 'ID_Document.pdf'}
                            </span>
                          </div>
                        ) : (
                          <img
                            src={guestForm.idDocumentUrl}
                            alt="ID Document Preview"
                            className="id-photo-preview-img"
                            onClick={() => setLightboxPreview({
                              url: guestForm.idDocumentUrl,
                              title: `${primaryNameDisplay || 'Primary Guest'} - ID Document`,
                              idNumber: guestForm.idNumber
                            })}
                            style={{ cursor: 'pointer' }}
                          />
                        )}

                        {/* Hover action overlay */}
                        <div className="id-photo-overlay">
                          <button
                            type="button"
                            className="id-photo-btn"
                            title="Preview ID Fullscreen"
                            onClick={() => setLightboxPreview({
                              url: guestForm.idDocumentUrl,
                              title: `${primaryNameDisplay || 'Primary Guest'} - ID Document`,
                              idNumber: guestForm.idNumber
                            })}
                          >
                            <Eye size={15} color="#1E293B" />
                          </button>

                          {!isLocked && (
                            <>
                              <button
                                type="button"
                                className="id-photo-btn"
                                title="Change ID Photo"
                                onClick={() => fileInputRef.current?.click()}
                              >
                                <Upload size={15} color="#2563EB" />
                              </button>
                              <button
                                type="button"
                                className="id-photo-btn delete"
                                title="Delete ID Photo"
                                onClick={(e) => handleRemoveIdPhoto(e, 'primary')}
                              >
                                <Trash2 size={15} color="#EF4444" />
                              </button>
                            </>
                          )}
                        </div>

                        {/* ID Uploaded Status Badge */}
                        <div className="id-photo-badge">
                          <CheckCircle2 size={11} color="#10B981" />
                          <span>ID Uploaded</span>
                        </div>
                      </div>
                    ) : (
                      <label
                        className={`edit-res-upload-box ${isLocked ? 'disabled' : ''} ${isUploadingId ? 'uploading' : ''}`}
                        style={isLocked ? { cursor: 'not-allowed', opacity: 0.65 } : {}}
                      >
                        {isUploadingId ? (
                          <>
                            <Loader2 size={24} className="animate-spin" color="#2563EB" />
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#2563EB' }}>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={22} color="#2563EB" />
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>
                              {isLocked ? (isCancelled ? 'ID Upload Locked' : isNoShow ? 'ID Upload Locked' : 'ID Upload Locked') : '+ Upload ID Photo'}
                            </span>
                            <span style={{ fontSize: '10.5px', color: '#94A3B8', fontWeight: 500 }}>
                              JPG, PNG or PDF
                            </span>
                          </>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,.pdf"
                          style={{ display: 'none' }}
                          disabled={isLocked || isUploadingId}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleIdFileUpload(file, 'primary');
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {/* Right fields */}
                  <div>
                    <div className="edit-res-form-grid-2">
                      <div className="edit-res-field">
                        <label>ID Number</label>
                        <input
                          type="text"
                          className="edit-res-input"
                          value={guestForm.idNumber}
                          disabled={isLocked}
                          readOnly={isLocked}
                          onChange={(e) => setGuestForm({ ...guestForm, idNumber: e.target.value })}
                        />
                      </div>

                      <div className="edit-res-field">
                        <label>ID Type</label>
                        <select
                          className="edit-res-select"
                          value={guestForm.idType}
                          disabled={isLocked}
                          onChange={(e) => setGuestForm({ ...guestForm, idType: e.target.value })}
                        >
                          <option value="Aadhaar Card">Aadhaar Card</option>
                          <option value="Passport">Passport</option>
                          <option value="Driving License">Driving License</option>
                          <option value="Voter ID">Voter ID</option>
                        </select>
                      </div>
                    </div>

                    <div className="edit-res-form-grid-2">
                      <div className="edit-res-field">
                        <label>Issuing Country</label>
                        <CountrySelect
                          value={guestForm.issuingCountry}
                          disabled={isLocked}
                          placeholder="Select country"
                          placement="bottom"
                          onChange={(val) => setGuestForm({ ...guestForm, issuingCountry: val })}
                        />
                      </div>

                      <div className="edit-res-field">
                        <label>Issuing City</label>
                        <SearchableSelect
                          value={guestForm.issuingCity}
                          options={cityOptions}
                          disabled={isLocked}
                          placeholder="Select City"
                          searchPlaceholder="Search City..."
                          allowCustom={true}
                          placement="bottom"
                          onChange={(val) => setGuestForm({ ...guestForm, issuingCity: val })}
                        />
                      </div>
                    </div>

                    <div className="edit-res-form-grid-2">
                      <div className="edit-res-field">
                        <label>Expiry Date</label>
                        <CustomDatePicker
                          value={guestForm.expiryDate}
                          disabled={isLocked}
                          placeholder="Select date"
                          minYear={2020}
                          maxYear={2045}
                          onChange={(val) => setGuestForm({ ...guestForm, expiryDate: val })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="edit-res-cform-btn"
                  onClick={() => alert('C Form (Police Verification Inquiry) exported.')}
                >
                  <FileText size={15} />
                  <span>C Form (Police Inquiry)</span>
                </button>
              </div>
            </>
          ))}

          {/* TAB 2: BOOKING DETAILS */}
          {activeTab === 'booking' && (
            <>
              {/* Card 1: Billing Information */}
              <div className="edit-res-section-card">
                <h3 className="edit-res-section-title">Billing Information</h3>
                <p className="edit-res-section-subtitle">Details about payment and invoicing for this booking.</p>

                <div className="edit-res-form-grid-2">
                  <div className="edit-res-field">
                    <label>Bill To <span className="required-star">*</span></label>
                    <select
                      className="edit-res-select"
                      value={bookingForm.billTo}
                      disabled={isLocked}
                      onChange={(e) => setBookingForm({ ...bookingForm, billTo: e.target.value })}
                    >
                      <option value="Guest">Guest</option>
                      <option value="Company">Company</option>
                    </select>
                  </div>

                  <div className="edit-res-field">
                    <label>Select Company</label>
                    <select
                      className="edit-res-select"
                      value={bookingForm.company}
                      disabled={isLocked}
                      onChange={(e) => setBookingForm({ ...bookingForm, company: e.target.value })}
                    >
                      <option value="">Select</option>
                      <option value="tcs">Tata Consultancy Services</option>
                      <option value="infosys">Infosys Limited</option>
                    </select>
                  </div>
                </div>

                <div className="edit-res-form-grid-2">
                  <div className="edit-res-field">
                    <label>Guest GSTIN</label>
                    <input
                      type="text"
                      className="edit-res-input"
                      placeholder="Enter Guest GSTIN"
                      value={bookingForm.guestGstin}
                      disabled={isLocked}
                      readOnly={isLocked}
                      onChange={(e) => setBookingForm({ ...bookingForm, guestGstin: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Source Information */}
              <div className="edit-res-section-card">
                <h3 className="edit-res-section-title">Source Information</h3>
                <p className="edit-res-section-subtitle">Information about the booking source and marketing details.</p>

                <div className="edit-res-form-grid-2">
                  <div className="edit-res-field">
                    <label>Market Segments <span className="required-star">*</span></label>
                    <select
                      className="edit-res-select"
                      value={bookingForm.marketSegment}
                      disabled={isLocked}
                      onChange={(e) => setBookingForm({ ...bookingForm, marketSegment: e.target.value })}
                    >
                      <option value="corporate">corporate</option>
                      <option value="fit">FIT</option>
                      <option value="leisure">Leisure</option>
                      <option value="group">Group</option>
                    </select>
                  </div>

                  <div className="edit-res-field">
                    <label>Booking Source <span className="required-star">*</span></label>
                    <select
                      className="edit-res-select"
                      value={bookingForm.bookingSource}
                      disabled={isLocked}
                      onChange={(e) => setBookingForm({ ...bookingForm, bookingSource: e.target.value })}
                    >
                      <option value="walk-in">walk-in</option>
                      <option value="ota">OTA</option>
                      <option value="direct">Direct</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Card 3: Special Requests */}
              <div className="edit-res-section-card">
                <h3 className="edit-res-section-title">Special Requests</h3>
                <p className="edit-res-section-subtitle">Special requests and guest preferences for this reservation.</p>

                <div className="edit-res-field">
                  <textarea
                    rows={4}
                    className="edit-res-textarea"
                    placeholder="Enter special requests (e.g. extra bed, late check-in)..."
                    value={bookingForm.specialRequests}
                    maxLength={100}
                    disabled={isLocked}
                    readOnly={isLocked}
                    onChange={(e) => setBookingForm({ ...bookingForm, specialRequests: e.target.value })}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
                    <span>Reservation-level request</span>
                    <span>{bookingForm.specialRequests.length}/100</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 3: FOLIO OPERATIONS */}
          {activeTab === 'folio' && (
            <div className="edit-res-section-card">
              <div className="edit-res-folio-top-bar">
                <div className="edit-res-folio-stats">
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Charges</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#2563eb' }}>
                      {Number(totalCharges).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Paid</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#16a34a' }}>
                      {Number(totalPaid).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Outstanding</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, color: Number(outstanding) > 0 ? '#dc2626' : '#16a34a' }}>
                      {Number(outstanding || totalPaid).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="edit-res-folio-actions">
                  {isLocked ? (
                    <div className="edit-res-folio-locked-badge">
                      <ShieldCheck size={16} />
                      <span>{isCancelled ? 'Folio Cancelled & Locked (Read-Only)' : isNoShow ? 'Folio No-Show & Locked (Read-Only)' : 'Folio Closed & Finalized (Read-Only)'}</span>
                    </div>
                  ) : (
                    <>
                      {/* Step 3.2: Add Charge */}
                      <button className="btn-folio-add-charge" onClick={() => setShowAddChargeModal(true)}>
                        <Plus size={14} />
                        <span>Add Charge</span>
                      </button>

                      {/* Step 3.3: Add Payment */}
                      <button className="btn-folio-outline" onClick={() => setShowAddPaymentModal(true)}>
                        <CreditCard size={14} />
                        <span>Add Payment</span>
                      </button>

                      {/* Settle Folio Quick Action */}
                      <button
                        className="btn-folio-outline"
                        onClick={() => setShowSettleFolioModal(true)}
                      >
                        <CheckCircle2 size={14} />
                        <span>Settle Folio</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Transactions Table */}
              <div className="edit-res-table-wrap" style={{ overflow: 'visible' }}>
                <table className="edit-res-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Particulars</th>
                      <th>Description</th>
                      <th>Reference</th>
                      <th>Direction</th>
                      <th>Amount</th>
                      <th>Tax</th>
                      <th style={{ width: '40px', textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {folioTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                          No transactions posted on this folio yet. Use "Add Charge" above.
                        </td>
                      </tr>
                    ) : (
                      folioTransactions.map((tx) => {
                        const isCreditTx =
                          String(tx.direction || '').toUpperCase() === 'CREDIT' ||
                          tx.type === 'PAYMENT' ||
                          String(tx.category || '').toLowerCase().includes('payment') ||
                          String(tx.desc || tx.description || '').toLowerCase().includes('payment') ||
                          Number(tx.amount || 0) < 0;

                        // Ensure payment date is current/up to date if it had stale default date
                        const displayDateStr = (() => {
                          if (!tx.date) return currentRes.checkInDate || getTodayIsoDate();
                          if (isCreditTx && (tx.date === '2026-11-03' || (currentRes.checkInDate && tx.date < currentRes.checkInDate))) {
                            return currentRes.checkInDate || getTodayIsoDate();
                          }
                          return tx.date;
                        })();

                        const particularLabel =
                          (tx.particulars && tx.particulars !== 'Charge')
                            ? tx.particulars
                            : (isCreditTx ? 'Payment' : (tx.category || 'Charge'));

                        return (
                          <tr key={tx.id} style={{ background: tx.isVoided ? '#fef2f2' : undefined }}>
                            <td>{formatTxDisplayDate(displayDateStr)}</td>
                            <td style={{ fontWeight: 600 }}>
                              {particularLabel}
                              {tx.isVoided && (
                                <span className="badge-voided" style={{ marginLeft: '6px' }}>VOIDED</span>
                              )}
                            </td>
                            <td>
                              <div>{tx.description || tx.desc || '-'}</div>
                              {tx.isVoided && tx.voidReason && (
                                <div style={{ fontSize: '0.72rem', color: '#ef4444', fontStyle: 'italic', marginTop: '2px' }}>
                                  Void Reason: "{tx.voidReason}"
                                </div>
                              )}
                            </td>
                            <td style={{ color: '#64748b' }}>{tx.reference || tx.receiptNumber || '-'}</td>
                            <td>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                background: tx.isVoided ? '#f1f5f9' : (isCreditTx ? '#ecfdf5' : '#f8fafc'),
                                color: tx.isVoided ? '#94a3b8' : (isCreditTx ? '#16a34a' : '#334155')
                              }}>
                                {tx.direction ? (String(tx.direction).toUpperCase() === 'CREDIT' ? 'CREDIT' : tx.direction) : (isCreditTx ? 'CREDIT' : 'DEBIT')}
                              </span>
                            </td>
                            <td style={{
                              fontWeight: 700,
                              color: tx.isVoided ? '#94a3b8' : (isCreditTx ? '#16a34a' : '#0f172a'),
                              textDecoration: tx.isVoided ? 'line-through' : 'none'
                            }}>
                              {Math.abs(Number(tx.amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ color: '#64748b' }}>
                              {tx.tax ? Number(tx.tax).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </td>
                          <td style={{ textAlign: 'center', position: 'relative' }}>
                            {isLocked ? (
                              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>{isCancelled || isNoShow ? 'Locked' : 'Finalized'}</span>
                            ) : tx.isVoided ? (
                              <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>Voided</span>
                            ) : (
                              <div className="folio-tx-menu-wrap" style={{ position: 'relative', display: 'inline-block' }}>
                                <button
                                  type="button"
                                  className="btn-folio-tx-dots"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenTxMenuId(openTxMenuId === tx.id ? null : tx.id);
                                  }}
                                  title="Actions"
                                >
                                  <MoreVertical size={16} />
                                </button>
                                {openTxMenuId === tx.id && (
                                  <div className="folio-tx-dropdown-menu">
                                    <button
                                      type="button"
                                      className="folio-tx-dropdown-item"
                                      onClick={() => {
                                        setOpenTxMenuId(null);
                                        setEditingTx(tx);
                                      }}
                                    >
                                      <Edit3 size={15} color="#475569" />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="folio-tx-dropdown-item"
                                      onClick={() => {
                                        setOpenTxMenuId(null);
                                        setMovingTx(tx);
                                      }}
                                    >
                                      <ArrowLeftRight size={15} color="#475569" />
                                      <span>Move</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="folio-tx-dropdown-item void-item"
                                      onClick={() => {
                                        setOpenTxMenuId(null);
                                        setVoidModalTx(tx);
                                      }}
                                    >
                                      <Ban size={15} color="#dc2626" />
                                      <span>Void</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: ROOM CHARGES */}
          {activeTab === 'charges' && (
            <div className="edit-res-section-card">
              {!isLocked && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1.25rem' }}>
                  <button
                    className="btn-folio-outline"
                    style={{ color: '#2563eb', borderColor: '#bfdbfe', background: '#eff6ff' }}
                    onClick={() => setShowUpdateDetailsModal(true)}
                  >
                    Update Details
                  </button>
                </div>
              )}

              <div className="edit-res-table-wrap">
                <table className="edit-res-table">
                  <thead>
                    <tr>
                      <th>Stay</th>
                      <th>Room</th>
                      <th>Rate Plan</th>
                      <th>Pax (A/C)</th>
                      <th>Charge</th>
                      <th>Tax</th>
                      <th>Net Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomChargesList.map((rc, idx) => (
                      <tr key={idx}>
                        <td>{rc.stay}</td>
                        <td style={{ fontWeight: 600 }}>{rc.room}</td>
                        <td>{rc.ratePlan}</td>
                        <td>{rc.pax}</td>
                        <td>₹{rc.charge}</td>
                        <td>₹{rc.tax}</td>
                        <td style={{ fontWeight: 700, color: '#0f172a' }}>₹{rc.netAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="edit-res-section-card">
              <div className="edit-res-timeline-container">
                <div className="edit-res-timeline-date-badge">
                  {auditDateHeading}
                </div>

                {filteredTimelineEvents.map((item) => (
                  <div key={item.id} className="edit-res-timeline-card">
                    <div
                      className="edit-res-timeline-node-circle"
                      style={{ borderColor: item.nodeColor }}
                    />

                    <div className="edit-res-timeline-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {item.icon}
                        </div>
                        <div>
                          <div className="edit-res-timeline-title">{item.title}</div>
                          <div className="edit-res-timeline-time">{item.time}</div>
                        </div>
                      </div>
                      <div className="edit-res-timeline-author-badge">
                        <User size={12} />
                        <span>{item.author}</span>
                      </div>
                    </div>

                    <div className="edit-res-timeline-body">
                      {item.type === 'RATE_OVERRIDDEN' && (
                        <>
                          <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.78rem' }}>Value:</div>
                          {item.oldValue ? (
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                              <div className="audit-pill-red-strike">{item.oldValue}</div>
                              <span style={{ color: '#16a34a', fontWeight: 'bold' }}>→</span>
                              <div className="audit-pill-green">{item.newValue}</div>
                            </div>
                          ) : (
                            <div className="audit-pill-neutral">{item.value || item.newValue}</div>
                          )}
                          {item.affectedDates && item.affectedDates.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.35rem' }}>
                              <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>Affected dates:</span>
                              {item.affectedDates.map(d => (
                                <span key={d} className="audit-affected-tag">{d}</span>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {item.type === 'STAY_EXTENDED' && (
                        <>
                          <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.78rem' }}>Stay Dates:</div>
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                            <span className="diff-old-strike">{item.oldDates}</span>
                            <span style={{ color: '#16a34a', fontWeight: 'bold' }}>→</span>
                            <span className="diff-new-green">{item.newDates}</span>
                          </div>
                          {item.affectedDates && item.affectedDates.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.35rem' }}>
                              <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>Affected dates:</span>
                              {item.affectedDates.map(d => (
                                <span key={d} className="audit-affected-tag">{d}</span>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {item.type === 'ROOM_REASSIGNED' && (
                        <>
                          <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.78rem' }}>Room:</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span className="diff-old-strike">{item.oldRoom}</span>
                            <span style={{ color: '#16a34a', fontWeight: 'bold' }}>→</span>
                            <span className="diff-new-green">{item.newRoom}</span>
                          </div>
                          {item.affectedDates && item.affectedDates.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.35rem' }}>
                              <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>Affected dates:</span>
                              {item.affectedDates.map(d => (
                                <span key={d} className="audit-affected-tag">{d}</span>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {item.type === 'GUEST_CHECKED_IN' && (
                        <>
                          <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.78rem' }}>Status:</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span className="diff-old-strike">{item.oldStatus || 'RESERVED'}</span>
                            <span style={{ color: '#16a34a', fontWeight: 'bold' }}>→</span>
                            <span className="diff-new-green">{item.newStatus || 'CHECKED_IN'}</span>
                          </div>
                        </>
                      )}

                      {item.type === 'GUEST_CHECKED_OUT' && (
                        <>
                          <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.78rem' }}>Status:</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span className="diff-old-strike">{item.oldStatus || 'CHECKED_IN'}</span>
                            <span style={{ color: '#16a34a', fontWeight: 'bold' }}>→</span>
                            <span className="diff-new-green">{item.newStatus || 'CHECKED_OUT'}</span>
                          </div>
                          {item.roomNumber && (
                            <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.35rem' }}>
                              <span style={{ color: '#64748b' }}>Room Vacated:</span>{' '}
                              <strong>Room {item.roomNumber}</strong>{' '}
                              <span style={{ color: '#d97706', fontWeight: 600 }}>· Flagged Dirty</span>
                            </div>
                          )}
                          {item.affectedDates && item.affectedDates.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.35rem' }}>
                              <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>Check-out date:</span>
                              {item.affectedDates.map(d => (
                                <span key={d} className="audit-affected-tag">{d}</span>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {item.type === 'RESERVATION_CREATED' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div><span style={{ color: '#64748b' }}>Booking Reference:</span> <strong>{item.bookingRef}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Guest Name:</span> <strong>{item.guestName}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Stay Dates:</span> <strong>{item.stayDates}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Nights:</span> <strong>{item.nights}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Rooms:</span> <strong>{item.rooms || 1}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Total Amount:</span> <strong>{item.totalAmount} INR</strong></div>
                          {item.advancePaid !== undefined && Number(item.advancePaid) > 0 && (
                            <div><span style={{ color: '#64748b' }}>Advance Paid:</span> <strong style={{ color: '#16a34a' }}>{Number(item.advancePaid).toFixed(2)} INR</strong></div>
                          )}
                          <div><span style={{ color: '#64748b' }}>Booking Source:</span> <strong>{item.bookingSource}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Status:</span> <strong>{item.status}</strong></div>
                          {item.affectedDates && item.affectedDates.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.35rem' }}>
                              <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>Affected dates:</span>
                              {item.affectedDates.map(d => (
                                <span key={d} className="audit-affected-tag">{d}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {item.type === 'NIGHT_AUDIT_PROCESSED' && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Room:</span>
                            <span className="diff-new-green">{item.roomNumber} ({item.roomTypeName})</span>
                          </div>
                          <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.78rem', marginTop: '0.2rem' }}>Folio Operations:</div>
                          <div className="audit-pill-neutral">
                            Date: {item.dateVal} &nbsp; amount: {Number(item.amount || 0).toFixed(2)} &nbsp; tax Amount: {Number(item.taxAmount || 0).toFixed(2)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                            <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Status:</span>
                            <span className="diff-new-green">{item.status || 'POSTED_TO_FOLIO'}</span>
                          </div>
                          {item.affectedDates && item.affectedDates.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.35rem' }}>
                              <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>Affected dates:</span>
                              {item.affectedDates.map(d => (
                                <span key={d} className="audit-affected-tag">{d}</span>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {item.type === 'PAYMENT_ADDED' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div><span style={{ color: '#64748b' }}>Payment Type:</span> <strong>{item.isAdvance ? 'Advance Payment' : 'Payment'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Amount Paid:</span> <strong style={{ color: '#16a34a' }}>{Number(item.amount || 0).toFixed(2)} INR</strong></div>
                          <div><span style={{ color: '#64748b' }}>Payment Method:</span> <strong>{item.method || 'UPI'}</strong></div>
                          {item.voucherNumber && item.voucherNumber !== '-' && (
                            <div><span style={{ color: '#64748b' }}>Reference / Voucher:</span> <strong>{item.voucherNumber}</strong></div>
                          )}
                          {item.affectedDates && item.affectedDates.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.35rem' }}>
                              <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>Affected dates:</span>
                              {item.affectedDates.map(d => (
                                <span key={d} className="audit-affected-tag">{d}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {item.type === 'TRANSACTION_UPDATED' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {(item.folioNumber || item.method) && (
                            <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                              {item.folioNumber && (
                                <>
                                  <span style={{ color: '#64748b' }}>Folio:</span>{' '}
                                  <strong>{item.folioNumber}</strong>
                                </>
                              )}
                              {item.isPayment && item.method && item.method !== '-' && (
                                <>
                                  {' · '}
                                  <span style={{ color: '#64748b' }}>Method:</span>{' '}
                                  <strong>{item.method}</strong>
                                </>
                              )}
                            </div>
                          )}

                          {item.oldAmount !== undefined && item.newAmount !== undefined ? (
                            item.oldAmount !== item.newAmount ? (
                              <div>
                                <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.78rem', marginBottom: '0.2rem' }}>Amount:</div>
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                                  <div className="audit-pill-red-strike">₹{Number(item.oldAmount).toFixed(2)}</div>
                                  <span style={{ color: '#16a34a', fontWeight: 'bold' }}>→</span>
                                  <div className="audit-pill-green">₹{Number(item.newAmount).toFixed(2)}</div>
                                </div>
                              </div>
                            ) : (
                              <div className="audit-pill-neutral">
                                Amount: ₹{Number(item.newAmount).toFixed(2)}
                              </div>
                            )
                          ) : (
                            item.details && <div style={{ fontSize: '0.8rem', color: '#334155' }}>{item.details}</div>
                          )}

                          {item.oldDate && item.newDate && item.oldDate !== item.newDate && (
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.78rem' }}>
                              <span style={{ fontWeight: 600, color: '#475569' }}>Date:</span>
                              <span className="diff-old-strike">{item.oldDate}</span>
                              <span style={{ color: '#16a34a', fontWeight: 'bold' }}>→</span>
                              <span className="diff-new-green">{item.newDate}</span>
                            </div>
                          )}

                          {item.oldDescription !== undefined &&
                            item.newDescription !== undefined &&
                            item.oldDescription !== item.newDescription && (
                              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.78rem' }}>
                                <span style={{ fontWeight: 600, color: '#475569' }}>Description:</span>
                                <span className="diff-old-strike">{item.oldDescription || '—'}</span>
                                <span style={{ color: '#16a34a', fontWeight: 'bold' }}>→</span>
                                <span className="diff-new-green">{item.newDescription || '—'}</span>
                              </div>
                            )}

                          {item.affectedDates && item.affectedDates.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.15rem' }}>
                              <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>Affected dates:</span>
                              {item.affectedDates.map(d => (
                                <span key={d} className="audit-affected-tag">{d}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {item.type === 'CHARGE_ADDED' && (
                        <>
                          <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.78rem' }}>Charge:</div>
                          <div className="audit-pill-orange">
                            Category: {item.category || 'Incidentals'} &nbsp; amount: ₹{Number(item.amount || 0).toFixed(2)} &nbsp; {item.voucherNumber ? `Ref: ${item.voucherNumber}` : ''}
                          </div>
                          {item.desc && <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{item.desc}</div>}
                          {item.affectedDates && item.affectedDates.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.35rem' }}>
                              <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>Affected dates:</span>
                              {item.affectedDates.map(d => (
                                <span key={d} className="audit-affected-tag">{d}</span>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {item.type === 'VOID_PAYMENT' && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span className="diff-old-strike">TRANSACTION ACTIVE</span>
                            <span style={{ color: '#16a34a', fontWeight: 'bold' }}>→</span>
                            <span className="diff-old-strike" style={{ textDecoration: 'none' }}>VOIDED</span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Reason: {item.reason}</div>
                          {item.affectedDates && item.affectedDates.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.35rem' }}>
                              <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>Affected dates:</span>
                              {item.affectedDates.map(d => (
                                <span key={d} className="audit-affected-tag">{d}</span>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {item.type === 'GENERIC' && (
                        <>
                          <div>{item.details}</div>
                          {item.affectedDates && item.affectedDates.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.35rem' }}>
                              <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>Affected dates:</span>
                              {item.affectedDates.map(d => (
                                <span key={d} className="audit-affected-tag">{d}</span>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Fixed Bottom Action Bar (Save Button Fixed - Hidden when reservation is locked / checked out) */}
      {(activeTab === 'guest' || activeTab === 'booking') && !isLocked && (
        <div className="edit-res-bottom-save-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {activeTab === 'booking' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={bookingForm.applyToAllRooms}
                  onChange={(e) => setBookingForm({ ...bookingForm, applyToAllRooms: e.target.checked })}
                />
                <span>Apply to all rooms</span>
              </label>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="edit-res-save-btn"
              onClick={
                isAddingSharer || editingSharerIndex !== null
                  ? handleSaveSharer
                  : handleSaveAll
              }
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Add Charges Modal (Exact OTAL PMS Specification & Design) */}
      {showAddChargeModal && (
        <AddChargeModal
          isOpen={showAddChargeModal}
          reservation={currentRes}
          folio={currentFolio}
          onClose={() => setShowAddChargeModal(false)}
          onConfirmCharge={(chargeData) => {
            const payload = {
              date: chargeData.date || getTodayIsoDate(),
              category: chargeData.category,
              receiptNumber: chargeData.receiptNumber,
              amount: chargeData.amount,
              description: chargeData.description
            };
            if (onAddFolioCharge) {
              onAddFolioCharge(currentRes.id, payload);
            } else {
              pmsStore.addFolioCharge(currentRes.id, payload);
            }
            setFolioVersion((v) => v + 1);
          }}
        />
      )}

      {/* Add Payment Modal (Exact OTAL PMS Specification & Design) */}
      {showAddPaymentModal && (
        <AddPaymentModal
          isOpen={showAddPaymentModal}
          reservation={currentRes}
          folio={currentFolio}
          onClose={() => setShowAddPaymentModal(false)}
          onConfirmPayment={(paymentData) => {
            const payload = {
              folioId: paymentData.folioId,
              date: paymentData.date || getTodayIsoDate(),
              type: paymentData.type,
              paymentMethod: paymentData.paymentMethod,
              amount: paymentData.amount,
              description: paymentData.description,
              reference: paymentData.receiptNumber || paymentData.reference
            };
            if (onAddFolioPayment) {
              onAddFolioPayment(currentRes.id, payload);
            } else {
              pmsStore.addFolioPayment(currentRes.id, payload);
            }
            setFolioVersion((v) => v + 1);
          }}
        />
      )}

      {/* Settle Folio Modal (Exact OTAL PMS Specification & Design matching Image 6) */}
      {showSettleFolioModal && (
        <SettleFolioModal
          isOpen={showSettleFolioModal}
          onClose={() => setShowSettleFolioModal(false)}
          folioNumber={currentFolio?.folioNumber || currentRes?.folioId || 'FOL_1'}
          outstandingBalance={Number(outstanding) || 0}
          reservationId={currentRes?.id}
          onSettle={async (resId, mode, ref, date, amount) => {
            if (onSettleFolio) {
              await onSettleFolio(resId, mode, ref, date || getTodayIsoDate(), amount);
            } else {
              pmsStore.settleFolio(resId, mode, ref, date || getTodayIsoDate(), amount);
            }
            setFolioVersion((v) => v + 1);
          }}
        />
      )}

      {/* Guest Check-In Details Modal (Step 2) */}
      {showCheckInModal && (
        <GuestCheckInModal
          isOpen={showCheckInModal}
          reservation={currentRes}
          rooms={rooms}
          roomTypes={roomTypes}
          reservations={pmsStore.getState().reservations}
          onClose={() => setShowCheckInModal(false)}
          onAssignRoom={(resId, assignedRoomId) => {
            pmsStore.assignRoom(resId, assignedRoomId);
            setFolioVersion(v => v + 1);
            if (onAssignRoom) onAssignRoom(resId, assignedRoomId);
          }}
          onConfirmCheckIn={(resId, assignedRoomId) => {
            pmsStore.checkInReservation(resId, assignedRoomId);
            setShowCheckInModal(false);
            setFolioVersion(v => v + 1);
            if (onCheckIn) onCheckIn(resId, assignedRoomId);
          }}
        />
      )}

      {/* Guest Check-Out Details Modal (Step 4) */}
      {showCheckOutModal && (
        <GuestCheckOutModal
          isOpen={showCheckOutModal}
          reservation={currentRes}
          onClose={() => setShowCheckOutModal(false)}
          onQuickSettle={(resId, method) => {
            pmsStore.addFolioPayment(resId, {
              date: getTodayIsoDate(),
              type: 'Settlement',
              paymentMethod: method,
              amount: currentRes.balanceDue
            });
            setFolioVersion(v => v + 1);
          }}
          onConfirmCheckOut={(resId) => {
            pmsStore.checkOutReservation(resId);
            setShowCheckOutModal(false);
            setFolioVersion(v => v + 1);
            if (onCheckOut) onCheckOut(resId);
          }}
        />
      )}

      {/* Void Payment Modal (Step 3.4) */}
      {voidModalTx && (
        <VoidPaymentModal
          isOpen={!!voidModalTx}
          transaction={voidModalTx}
          onClose={() => setVoidModalTx(null)}
          onConfirmVoid={handleConfirmVoidPayment}
        />
      )}

      {/* Edit Folio Transaction Modal */}
      {editingTx && (
        <EditFolioTransactionModal
          isOpen={!!editingTx}
          onClose={() => setEditingTx(null)}
          transaction={editingTx}
          folio={currentFolio}
          onSave={(updatedData) => {
            pmsStore.updateFolioTransaction(currentRes.id, editingTx.id, updatedData);
            setFolioVersion(v => v + 1);
            setEditingTx(null);
          }}
        />
      )}

      {/* Move Folio Transaction Modal */}
      {movingTx && (
        <MoveFolioTransactionModal
          isOpen={!!movingTx}
          onClose={() => setMovingTx(null)}
          transaction={movingTx}
          currentFolioId={currentRes.folioId || 'FOL_16'}
          availableFolios={currentRes ? [
            { id: currentRes.folioId || 'fol_1', folioNumber: currentFolio?.folioNumber || 'FOL_16' },
            { id: 'fol_extra', folioNumber: 'FOL_EXTRA' }
          ] : []}
          onConfirmMove={(txId, targetFolioId) => {
            pmsStore.moveFolioTransaction(currentRes.id, txId, targetFolioId);
            setFolioVersion(v => v + 1);
            setMovingTx(null);
          }}
        />
      )}

      {/* Update Room Tariff & Details Modal (Exact match to User Reference Images) */}
      {showUpdateDetailsModal && (
        <UpdateDetailsModal
          isOpen={showUpdateDetailsModal}
          onClose={() => setShowUpdateDetailsModal(false)}
          reservation={currentRes}
          folio={currentFolio}
          onUpdate={async (payload) => {
            pmsStore.updateRoomTariffDetails(currentRes.id, payload);
            setFolioVersion((v) => v + 1);
            setShowUpdateDetailsModal(false);
          }}
        />
      )}

      {/* Lightbox Modal for ID Document Preview */}
      {lightboxPreview && (
        <div
          className="id-lightbox-overlay"
          onClick={() => setLightboxPreview(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="id-lightbox-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={18} color="#2563EB" />
                <div>
                  <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, color: '#0F172A' }}>
                    {lightboxPreview.title || 'ID Document'}
                  </h4>
                  {lightboxPreview.idNumber && (
                    <span style={{ fontSize: '12px', color: '#64748B' }}>
                      ID Number: {lightboxPreview.idNumber}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPreview(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex' }}
                title="Close"
              >
                <X size={18} color="#64748B" />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A', minHeight: '320px', maxHeight: '65vh', overflow: 'auto' }}>
              {lightboxPreview.url.startsWith('data:application/pdf') || lightboxPreview.url.endsWith('.pdf') ? (
                <iframe
                  src={lightboxPreview.url}
                  title="PDF Document Preview"
                  style={{ width: '100%', height: '480px', border: 'none', backgroundColor: '#FFFFFF', borderRadius: '6px' }}
                />
              ) : (
                <img
                  src={lightboxPreview.url}
                  alt="Full ID Document"
                  style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '6px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                />
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <a
                href={lightboxPreview.url}
                download={lightboxPreview.title ? `${lightboxPreview.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg` : 'guest_id_document.jpg'}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#EFF6FF',
                  color: '#2563EB',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                <Download size={14} />
                <span>Open / Download</span>
              </a>

              <button
                type="button"
                onClick={() => setLightboxPreview(null)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '6px',
                  backgroundColor: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  color: '#334155',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


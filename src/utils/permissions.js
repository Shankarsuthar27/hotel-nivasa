// Central Role-Based Access Control (RBAC) Permission Utilities
// Aligned with FULL_PERMISSIONS_TEMPLATE in src/data/rolePresets.js

/**
 * Checks whether a user possesses a given dot-notated permission path.
 * - Owners and users with `permissions.allowAll === true` always pass.
 * - Suspended/Inactive users are always denied.
 */
export function hasPermission(user, permissionPath) {
  if (!user) return false;

  const status = String(user.status || 'ACTIVE').toUpperCase();
  if (status === 'SUSPENDED' || status === 'INACTIVE') return false;

  if (user.role === 'Owner') return true;
  if (!permissionPath) return true;

  const perms = user.permissions;
  if (!perms) return false;
  if (perms.allowAll === true) return true;

  const paths = Array.isArray(permissionPath) ? permissionPath : [permissionPath];

  return paths.some((path) => {
    const keys = String(path).split('.');
    let curr = perms;
    for (const key of keys) {
      if (curr === undefined || curr === null) return false;
      curr = curr[key];
    }
    return curr === true;
  });
}

/**
 * Route-to-Permission mapping for every main PMS section
 */
export const ROUTE_PERMISSIONS = {
  dashboard: 'dashboard.viewDashboard',
  reservations: 'reservations.view',
  calendar: 'dashboard.viewCalendar',
  rates: 'ratesInventory.view',
  housekeeping: ['advanced.roomInventory.view', 'advanced.roomInventory.changeRoomStatus'],
  cleaninghistory: ['advanced.roomInventory.view', 'advanced.roomInventory.changeRoomStatus'],
  nightaudit: 'reservations.nightAudit',
  reports: 'reports.accessReports',
  guests: 'advanced.guestDatabase.view',
  settings: 'advanced.settings.view',
  myteam: ['team.viewTeam', 'team.memberManagement'],
  permissions: 'team.permissionManagement',
  properties: [
    'advanced.roomInventory.view',
    'taxesAddons.manageTaxes',
    'advanced.mealOptions.view'
  ]
};

/**
 * Checks whether a user can access a given route tab
 */
export function canAccessRoute(user, tabId) {
  if (!user) return false;
  if (user.role === 'Owner' || user.permissions?.allowAll === true) return true;
  const required = ROUTE_PERMISSIONS[tabId];
  if (!required) return true;
  return hasPermission(user, required);
}

/**
 * Returns the first route tab the user is permitted to open (used on staff login / redirect)
 */
export function getFirstAllowedTab(user) {
  const orderedTabs = [
    'dashboard',
    'reservations',
    'calendar',
    'housekeeping',
    'cleaninghistory',
    'reports',
    'guests',
    'rates',
    'nightaudit',
    'properties',
    'myteam',
    'permissions',
    'settings'
  ];

  for (const tab of orderedTabs) {
    if (canAccessRoute(user, tab)) {
      return tab;
    }
  }
  return 'dashboard';
}

/**
 * Produces human-readable badges of granted high-level permissions for modals & summaries
 */
export function summarizeGrantedPermissions(permissions) {
  if (!permissions) return [];
  if (permissions.allowAll) return ['Full Administrative Access'];

  const labels = [];
  if (permissions.dashboard?.viewDashboard) labels.push('Dashboard');
  if (permissions.dashboard?.viewCalendar) labels.push('Calendar View');
  if (permissions.reservations?.view) labels.push('View Reservations');
  if (permissions.reservations?.create) labels.push('Create Reservation');
  if (permissions.reservations?.actions?.checkIn) labels.push('Check-In');
  if (permissions.reservations?.actions?.checkOut) labels.push('Check-Out');
  if (permissions.reservations?.actions?.cancel) labels.push('Cancel Booking');
  if (permissions.reservations?.actions?.delete) labels.push('Delete Reservation');
  if (permissions.reservations?.nightAudit) labels.push('Night Audit');
  if (permissions.ratesInventory?.view) labels.push('View Rates');
  if (permissions.ratesInventory?.actions?.editRates) labels.push('Edit Rates');
  if (permissions.reports?.accessReports) labels.push('View Reports');
  if (permissions.advanced?.guestDatabase?.view) labels.push('Guests');
  if (permissions.advanced?.roomInventory?.view) labels.push('Rooms & Housekeeping');
  if (permissions.taxesAddons?.manageTaxes) labels.push('Tax & Services');
  if (permissions.team?.viewTeam || permissions.team?.memberManagement) labels.push('My Team');
  if (permissions.team?.permissionManagement) labels.push('Manage Permissions');
  if (permissions.advanced?.settings?.view) labels.push('Settings');
  return labels;
}

/**
 * Creates a clean empty (all-false) permissions object for building custom staff profiles
 */
export function createEmptyPermissions() {
  return {
    allowAll: false,
    reservations: {
      view: false,
      create: false,
      actions: {
        checkIn: false,
        checkOut: false,
        assignRoom: false,
        roomMove: false,
        amendStay: false,
        noShow: false,
        cancel: false,
        delete: false,
        posVoucher: false,
        estimateInvoice: false
      },
      nightAudit: false
    },
    dashboard: {
      viewDashboard: false,
      viewCalendar: false
    },
    ratesInventory: {
      view: false,
      actions: {
        editRates: false,
        stopSell: false,
        cta: false,
        ctd: false,
        minMaxNights: false
      }
    },
    taxesAddons: {
      manageTaxes: false,
      taxActions: { createTax: false, editTax: false, deleteTax: false, exemptTax: false },
      manageServices: false,
      serviceActions: { createService: false, editService: false, deleteService: false }
    },
    reports: {
      accessReports: false,
      reportActions: {
        managerReport: false,
        folioList: false,
        nightAudit: false,
        reservationReport: false,
        guestDetails: false
      }
    },
    team: {
      viewTeam: false,
      memberManagement: false,
      permissionManagement: false
    },
    advanced: {
      guestDatabase: { all: false, view: false, piiInfo: false },
      settings: { all: false, view: false, overbooking: false, scheduleNightAudit: false, generateApiKey: false },
      roomInventory: { all: false, view: false, create: false, edit: false, delete: false, changeRoomStatus: false },
      mealOptions: { all: false, view: false, create: false, edit: false, delete: false },
      corporateAccounts: { all: false, view: false, create: false, edit: false, delete: false, viewArLedger: false }
    }
  };
}


import React from 'react';
import { hasPermission } from '../../utils/permissions';

/**
 * Declarative RBAC guard for conditionally rendering UI actions or sections.
 * Usage:
 *   <Can user={currentUser} permission="reservations.create">
 *     <button>Create Reservation</button>
 *   </Can>
 */
export default function Can({ user, permission, fallback = null, children }) {
  if (hasPermission(user, permission)) {
    return <>{children}</>;
  }
  return fallback;
}


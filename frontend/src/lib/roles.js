/** DB stores manager; the UI label is Team Leader. */
export function displayRole(role) {
  if (role === 'manager') return 'Team Leader';
  if (role === 'admin') return 'Admin';
  if (role === 'member') return 'Employee';
  return 'Employee';
}

export function navVisibleForRole(itemRoles, role) {
  const resolved = role || 'member';
  return itemRoles.includes(resolved);
}

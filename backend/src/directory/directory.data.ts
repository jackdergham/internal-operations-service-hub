import type { Actor } from './directory.types.js';

/**
 * Mock org chart. Stands in for the real external dependency described in
 * architecture.md ("Org chart / reporting-line data" / "Identity provider / SSO").
 * Ids employee-1, employee-2, manager-1 and manager-2 are kept stable because
 * routing.service.ts's seed data and the e2e tests already reference them.
 */
export const orgChart: Actor[] = [
  {
    employeeId: 'employee-1',
    name: 'Alice Nassar',
    department: 'IT',
    managerId: 'manager-1',
    roles: ['requester'],
  },
  {
    employeeId: 'employee-2',
    name: 'Karim Fares',
    department: 'HR',
    managerId: 'manager-2',
    roles: ['requester'],
  },
  {
    employeeId: 'manager-1',
    name: 'Rania Haddad',
    department: 'IT',
    managerId: 'depthead-it',
    roles: ['requester', 'approver'],
  },
  {
    employeeId: 'manager-2',
    name: 'Sami Abou Jaoude',
    department: 'HR',
    managerId: 'depthead-hr',
    roles: ['requester', 'approver'],
  },
  {
    employeeId: 'depthead-it',
    name: 'Tony Merhej',
    department: 'IT',
    managerId: null,
    roles: ['requester', 'approver'],
  },
  {
    employeeId: 'depthead-hr',
    name: 'Layla Khoury',
    department: 'HR',
    managerId: null,
    roles: ['requester', 'approver'],
  },
  {
    employeeId: 'fulfiller-it-1',
    name: 'Marc Abi Saab',
    department: 'IT',
    managerId: 'manager-1',
    roles: ['fulfiller'],
  },
  {
    employeeId: 'fulfiller-hr-1',
    name: 'Nadine Chami',
    department: 'HR',
    managerId: 'manager-2',
    roles: ['fulfiller'],
  },
  {
    employeeId: 'admin-1',
    name: 'Fadi Zeidan',
    department: 'Operations',
    managerId: null,
    roles: ['admin'],
  },
];

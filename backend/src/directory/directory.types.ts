export type Role = 'requester' | 'approver' | 'fulfiller' | 'admin';

export interface Actor {
  employeeId: string;
  name: string;
  department: string;
  managerId: string | null;
  roles: Role[];
}

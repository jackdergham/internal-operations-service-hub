export type Role = 'requester' | 'approver' | 'fulfiller' | 'admin'

export type Actor = {
  employeeId: string
  name: string
  department: string
  managerId: string | null
  roles: Role[]
}

export async function listActors(apiBaseUrl: string): Promise<Actor[]> {
  const response = await fetch(`${apiBaseUrl}/directory/actors`)
  if (!response.ok) throw new Error('Directory could not be loaded')
  return response.json() as Promise<Actor[]>
}

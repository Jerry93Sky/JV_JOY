export enum Role {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  USER = 'USER',
  GUEST = 'GUEST',
}

export interface User {
  id: string
  login: string
  lastName: string
  firstName: string
  middleName?: string
  role: Role
  createdAt: string
}

export type UserPublic = Omit<User, 'createdAt'>

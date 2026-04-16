export type OrganizationRow = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
};

export type RoleRow = {
  id: string;
  organization_id: string;
  name: string;
  responsibilities: string | null;
};

export type PersonRoleRow = {
  id: string;
  person_id: string;
  role_id: string;
  start_date: string | null;
  end_date: string | null;
};

export type PersonRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
};


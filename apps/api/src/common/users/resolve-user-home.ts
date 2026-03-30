export type UserHome =
  | 'consumer'
  | 'merchant'
  | 'service_provider'
  | 'representative'
  | 'factory';

type RoleLike = {
  role?: string | null;
};

type ResolveUserHomeInput = {
  consumer?: unknown | null;
  merchant?: unknown | null;
  serviceProvider?: unknown | null;
  representative?: unknown | null;
  factory?: unknown | null;
  roles?: RoleLike[] | null;
};

function normalizeRole(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function resolveUserHome(input: ResolveUserHomeInput): UserHome {
  if (input.serviceProvider) return 'service_provider';
  if (input.merchant) return 'merchant';
  if (input.factory) return 'factory';
  if (input.representative) return 'representative';
  if (input.consumer) return 'consumer';

  const roles = Array.isArray(input.roles) ? input.roles : [];
  const roleSet = new Set(roles.map((item) => normalizeRole(item?.role)));

  if (roleSet.has('service_provider')) return 'service_provider';
  if (roleSet.has('merchant')) return 'merchant';
  if (roleSet.has('factory')) return 'factory';
  if (roleSet.has('representative')) return 'representative';
  if (roleSet.has('consumer')) return 'consumer';

  return 'consumer';
}

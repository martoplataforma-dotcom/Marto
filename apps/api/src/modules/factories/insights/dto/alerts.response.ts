export type AlertItem = {
  id: string;
  type: 'DEFECT_SPIKE_PRODUCT' | 'DEFECT_SPIKE_REGION';
  title: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string; // ISO
  meta: Record<string, unknown>;
};

export type AlertsResponse = {
  items: AlertItem[];
};

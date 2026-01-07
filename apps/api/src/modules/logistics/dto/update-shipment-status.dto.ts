export const SHIPMENT_STATUS = [
  'CREATED',
  'QUOTED',
  'CONFIRMED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUS)[number];

export const INCIDENT_TYPE = [
  'DELAY',
  'DAMAGE',
  'LOSS',
  'INVALID_ADDRESS',
  'OTHER',
] as const;

export type IncidentType = (typeof INCIDENT_TYPE)[number];

export type UpdateShipmentStatusDto = {
  status: ShipmentStatus;
  description?: string;
  incidentType?: IncidentType;
  incidentDescription?: string;
};

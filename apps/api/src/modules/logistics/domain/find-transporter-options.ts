import { PrismaClient, ShippingClass, TransporterType } from '@prisma/client';

type FindTransporterOptionsInput = {
  prisma: PrismaClient;
  originZipCode: string;
  destinationZipCode: string;
  shippingClass: ShippingClass;
  weightKg: number;
};

function normalizeZipCode(value: string): string {
  return value.replace(/\D/g, '').padStart(8, '0').slice(0, 8);
}

function mapTransporterTypeLabel(type: TransporterType): string {
  switch (type) {
    case 'CARRIER':
      return 'Transportadora';
    case 'LOCAL_COURIER':
      return 'Entrega local';
    case 'STORE_PICKUP':
      return 'Retirada';
    default:
      return type;
  }
}

export async function findTransporterOptions({
  prisma,
  originZipCode,
  destinationZipCode,
  shippingClass,
  weightKg,
}: FindTransporterOptionsInput) {
  const origin = normalizeZipCode(originZipCode);
  const destination = normalizeZipCode(destinationZipCode);

  const rows = await prisma.transporterRateTable.findMany({
    where: {
      active: true,
      shippingClass,
      originCepStart: { lte: origin },
      originCepEnd: { gte: origin },
      destinationCepStart: { lte: destination },
      destinationCepEnd: { gte: destination },
      weightMinKg: { lte: weightKg },
      weightMaxKg: { gte: weightKg },
      transporter: {
        active: true,
      },
    },
    include: {
      transporter: true,
    },
    orderBy: [{ priceCents: 'asc' }, { daysMin: 'asc' }],
  });

  return rows.map((row) => ({
    transporterId: row.transporterId,
    transporterName: row.transporter.name,
    transporterType: row.transporter.type,
    transporterTypeLabel: mapTransporterTypeLabel(row.transporter.type),
    priceCents: row.priceCents,
    daysMin: row.daysMin,
    daysMax: row.daysMax,
    shippingClass: row.shippingClass,
  }));
}

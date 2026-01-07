import { Injectable } from '@nestjs/common';
import { SummaryKpiResponse } from './dto/summary.response';
import { DefectsTimeSeriesResponse } from './dto/timeseries.response';
import { TopDefectsResponse } from './dto/top-defects.response';
import { AlertsResponse } from './dto/alerts.response';

@Injectable()
export class FactoryInsightsService {
  // MOCK: na etapa 2.2 isso será substituído por queries reais (Prisma)
  getSummary(): SummaryKpiResponse {
    const soldItems: number = 1280;
    const defectsReported: number = 37;
    const serviceRequests: number = 94;

    const defectRatePct: number =
      soldItems === 0
        ? 0
        : Number(((defectsReported / soldItems) * 100).toFixed(2));

    return {
      soldItems,
      serviceRequests,
      defectsReported,
      defectRatePct,
    };
  }

  getDefectsTimeSeries(): DefectsTimeSeriesResponse {
    return {
      granularity: 'day',
      points: [
        { bucket: '2025-12-17', defects: 3 },
        { bucket: '2025-12-18', defects: 6 },
        { bucket: '2025-12-19', defects: 4 },
        { bucket: '2025-12-20', defects: 5 },
        { bucket: '2025-12-21', defects: 2 },
        { bucket: '2025-12-22', defects: 9 },
        { bucket: '2025-12-23', defects: 8 },
      ],
    };
  }

  getTopDefects(): TopDefectsResponse {
    return {
      items: [
        {
          productId: 'prod_1',
          productName: 'Cadeira X',
          defects: 12,
          soldItems: 220,
          defectRatePct: 5.45,
        },
        {
          productId: 'prod_2',
          productName: 'Mesa Y',
          defects: 9,
          soldItems: 180,
          defectRatePct: 5.0,
        },
        {
          productId: 'prod_3',
          productName: 'Armário Z',
          defects: 7,
          soldItems: 310,
          defectRatePct: 2.26,
        },
        {
          productId: 'prod_4',
          productName: 'Sofá K',
          defects: 5,
          soldItems: 140,
          defectRatePct: 3.57,
        },
        {
          productId: 'prod_5',
          productName: 'Cômoda W',
          defects: 4,
          soldItems: 90,
          defectRatePct: 4.44,
        },
      ],
    };
  }

  getAlerts(): AlertsResponse {
    return {
      items: [
        {
          id: 'al_1',
          type: 'DEFECT_SPIKE_PRODUCT',
          title: 'Pico de defeitos: Cadeira X',
          severity: 'HIGH',
          createdAt: new Date().toISOString(),
          meta: {
            productId: 'prod_1',
            windowDays: 7,
            defects: 12,
            threshold: 10,
          },
        },
        {
          id: 'al_2',
          type: 'DEFECT_SPIKE_REGION',
          title: 'Pico de defeitos: Região SP',
          severity: 'MEDIUM',
          createdAt: new Date().toISOString(),
          meta: {
            region: 'SP',
            windowDays: 7,
            defects: 18,
            threshold: 15,
          },
        },
      ],
    };
  }
}

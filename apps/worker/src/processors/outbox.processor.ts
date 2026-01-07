import { prisma } from '../prisma';
import { enqueueNotifyJob } from '../jobs/notify.job';

const BATCH_SIZE = 10;
const INTERVAL_MS = 3000; // a cada 3s

export function startOutboxWorker() {
  // eslint-disable-next-line no-console
  console.log('📦 Outbox poller iniciado');

  setInterval(async () => {
    const events = await prisma.outboxEvent.findMany({
      where: {
        status: 'PENDING',
        availableAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    for (const event of events) {
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { status: 'PROCESSING' },
      });

      try {
      

        await enqueueNotifyJob({
          type: event.type,
          to: 'system',
          message: `Evento ${event.type} processado`,
        });

        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: 'SENT',
            processedAt: new Date(),
          },
        });
      } catch (err: any) {
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: 'FAILED',
            attempts: { increment: 1 },
            lastError: String(err?.message ?? err),
          },
        });
      }
    }
  }, INTERVAL_MS);
}

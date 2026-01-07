import { Worker } from 'bullmq';
import { redisConnection } from '../redis.connection';

export function startNotifyWorker() {
  const worker = new Worker(
    'marto-app',
    async (job) => {
      if (job.name !== 'notify') return;

      // eslint-disable-next-line no-console
      console.log('📣 NOTIFY:', job.data);
    },
    { connection: redisConnection },
  );

  worker.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error('❌ Job failed', job?.id, err);
  });

  return worker;
}

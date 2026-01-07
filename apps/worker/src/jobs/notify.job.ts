import { appQueue } from '../queues/app.queue';

export async function enqueueNotifyJob(payload: { type: string; to: string; message: string }) {
  await appQueue.add('notify', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: 1000,
  });
}

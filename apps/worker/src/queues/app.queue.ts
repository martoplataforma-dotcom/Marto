import { Queue } from 'bullmq';
import { redisConnection } from '../redis.connection';

export const appQueue = new Queue('marto-app', {
  connection: redisConnection,
});

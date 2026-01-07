import { ConnectionOptions } from 'bullmq';

const host = process.env.REDIS_HOST ?? '127.0.0.1';
const port = Number(process.env.REDIS_PORT ?? '6379');

export const redisConnection: ConnectionOptions = {
  host,
  port,
};

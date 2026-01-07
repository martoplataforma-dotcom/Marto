import { runAnalyticsProductDailySnapshot } from '../jobs/analytics-product-daily.job';

async function main() {
  const today = new Date();
  const res = await runAnalyticsProductDailySnapshot(today);
  // eslint-disable-next-line no-console
  console.log(res);
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

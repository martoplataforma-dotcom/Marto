export type TimePoint = {
  bucket: string; // ex: "2025-12-01" ou "2025-W49" ou "2025-12"
  defects: number;
};

export type DefectsTimeSeriesResponse = {
  granularity: 'day' | 'week' | 'month';
  points: TimePoint[];
};

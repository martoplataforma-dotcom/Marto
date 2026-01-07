export type TopDefectItem = {
  productId: string;
  productName: string;
  defects: number;
  soldItems: number;
  defectRatePct: number;
};

export type TopDefectsResponse = {
  items: TopDefectItem[];
};

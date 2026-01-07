export type SummaryKpiResponse = {
  soldItems: number; // quantidade vendida (itens)
  serviceRequests: number; // serviços acionados
  defectsReported: number; // defeitos reportados (via review/checklist — vamos fechar na 2.2)
  defectRatePct: number; // % defeito (0..100)
};

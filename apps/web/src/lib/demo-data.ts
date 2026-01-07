export type DemoItem = {
  id: string;
  kind: 'product' | 'service';
  title: string;
  subtitle: string;
  priceLabel: string;
  sellerLabel: string;
  statusLabel: string;
};

export const DEMO_ITEMS: DemoItem[] = [
  {
    id: 'p1',
    kind: 'product',
    title: 'Torneira Monocomando Inox',
    subtitle: 'Acabamento premium • Cozinha/Banheiro',
    priceLabel: 'R$ 289,90',
    sellerLabel: 'Casa Nova Materiais',
    statusLabel: 'Em estoque',
  },
  {
    id: 's1',
    kind: 'service',
    title: 'Instalação de torneira',
    subtitle: 'Agendamento rápido • Garantia de serviço',
    priceLabel: 'R$ 120,00',
    sellerLabel: 'João – Instalações Elétricas',
    statusLabel: 'Disponível em 2 dias',
  },
];

export function getDemoItem(id: string) {
  return DEMO_ITEMS.find((x) => x.id === id) ?? null;
}

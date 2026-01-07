import Link from 'next/link';
import { Card } from '@/components/marto/Card';
import { Button } from '@/components/marto/Button';
import { PageHeader } from '@/components/marto/PageHeader';
import { Alert } from '@/components/marto/Alert';

export default function DemoDone() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <Card className="p-8">
        <PageHeader
          title="Ciclo concluído"
          description="Esse é o ciclo central do Marto: simples, rastreável e com feedback no final."
        />

        <Alert variant="success" title="Tudo certo">
          O ciclo foi concluído com sucesso. Nenhuma ação adicional é necessária.
        </Alert>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/demo">
            <Button>Confirmar (demo)</Button>
          </Link>

          <Link href="/demo/catalog">
            <Button variant="secondary">Cancelar</Button>
          </Link>
        </div>

        <div className="mt-8 rounded-xl bg-zinc-50 p-4 text-sm text-[var(--marto-muted)]">
          Próximo passo: conectar esse fluxo a dados reais, mantendo a mesma experiência.
        </div>
      </Card>
    </main>
  );
}

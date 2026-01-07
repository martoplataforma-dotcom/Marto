import Link from 'next/link';

export default function DemoHome() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <div className="text-sm text-zinc-500">Marto • Demo</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
          Produto → Serviço → Acompanhamento → Avaliação
        </h1>
        <p className="mt-3 text-zinc-600">
          O Marto conecta produtos, serviços e dados em um único ecossistema — com um ciclo fechado e simples.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:opacity-90"
            href="/demo/catalog"
          >
            Ver como funciona
          </Link>

          <Link
            className="inline-flex items-center justify-center rounded-xl border px-5 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            href="/demo/catalog?mode=quick"
          >
            Demo em 5 minutos
          </Link>
        </div>

        <div className="mt-8 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700">
          <div className="font-medium text-zinc-900">Personas na demo</div>
          <ul className="mt-2 list-disc pl-5">
            <li>Cliente: Lucas Ferreira</li>
            <li>Lojista: Casa Nova Materiais</li>
            <li>Prestador: João – Instalações Elétricas</li>
            <li>Fábrica: Indústria Vale Forte</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

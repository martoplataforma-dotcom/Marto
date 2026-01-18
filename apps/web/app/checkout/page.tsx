'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function CheckoutPage() {
  const params = useSearchParams();

  const productId = params.get('productId') ?? '';
  const qty = params.get('qty') ?? '1';

  // ✅ agora pegamos do catálogo
  const merchantId = params.get('merchantId') ?? '';
  const unitPrice = params.get('unitPrice') ?? '';

  const href = `/checkout/pay?productId=${encodeURIComponent(
    productId,
  )}&merchantId=${encodeURIComponent(merchantId)}&unitPrice=${encodeURIComponent(
    unitPrice,
  )}&qty=${encodeURIComponent(qty)}`;

  const canContinue = Boolean(productId && merchantId && unitPrice);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* fundo Marto */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-white">Checkout</h1>
          <p className="mt-1 text-sm text-white/75">
            Confirme sua compra para continuar.
          </p>
        </header>

        <section className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-white/70">productId</span>
              <span className="break-all text-white/90">
                {productId || '—'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/70">merchantId</span>
              <span className="break-all text-white/90">
                {merchantId || '—'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/70">unitPrice</span>
              <span className="break-all text-white/90">
                {unitPrice || '—'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/70">quantidade</span>
              <span className="text-white/90">{qty}</span>
            </div>
          </div>

          {!canContinue ? (
            <div className="mt-4 rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/85">
              Faltam dados para seguir. Abra pelo catálogo:{' '}
              <span className="font-semibold text-white/90">/catalog</span>.
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/catalog"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Voltar
            </Link>

            <Link
              href={href}
              aria-disabled={!canContinue}
              className={`rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black hover:opacity-90 ${
                !canContinue ? 'pointer-events-none opacity-60' : ''
              }`}
            >
              Pagar (mock)
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

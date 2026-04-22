'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function onlyDigits(v: string) {
  return String(v ?? '').replace(/\D/g, '');
}

function cepMask(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function readLocalCep() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('marto:last_cep') ?? '';
}

function saveLocalCep(cep: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('marto:last_cep', cep);
}

function moneyFromCents(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

type PaymentMethod = 'PIX' | 'CARD';

export default function CheckoutPage() {
  const params = useSearchParams();

  const productId = params.get('productId') ?? '';
  const merchantId = params.get('merchantId') ?? '';
  const unitPriceStr = params.get('unitPrice') ?? '';
  const qtyStr = params.get('qty') ?? '1';
  const destinationZipCodeFromQuery = params.get('destinationZipCode') ?? '';

  const qty = Math.max(1, parseInt(qtyStr, 10) || 1);
  const unitPriceCents = Math.max(0, parseInt(unitPriceStr, 10) || 0);

  const [destinationZipCode, setDestinationZipCode] = useState(() =>
    cepMask(destinationZipCodeFromQuery || readLocalCep()),
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');

  const subtotalCents = unitPriceCents * qty;

  const canContinue = Boolean(
    productId &&
      merchantId &&
      unitPriceCents > 0 &&
      qty > 0 &&
      onlyDigits(destinationZipCode).length === 8,
  );

  const continueHref = useMemo(() => {
    return (
      `/checkout/pay?productId=${encodeURIComponent(productId)}` +
      `&merchantId=${encodeURIComponent(merchantId)}` +
      `&unitPrice=${encodeURIComponent(String(unitPriceCents))}` +
      `&qty=${encodeURIComponent(String(qty))}` +
      `&destinationZipCode=${encodeURIComponent(destinationZipCode)}`
    );
  }, [destinationZipCode, merchantId, productId, qty, unitPriceCents]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_15%_10%,rgba(255,255,255,0.10),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_85%_20%,rgba(255,255,255,0.06),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_40%_95%,rgba(255,255,255,0.05),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:60px_60px]" />
      </div>

      <div className="relative mx-auto max-w-6xl p-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              Marto Checkout
            </div>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              Revise sua compra antes de seguir
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              Origem clara, logística alinhada e decisão pronta para o pagamento.
            </p>
          </div>

          <Link
            href="/catalog"
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
          >
            Voltar
          </Link>
        </header>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[28px] border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                Entrega no Marto
              </div>

              <div className="mt-4 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-white/62">
                    CEP de destino
                  </span>
                  <input
                    value={destinationZipCode}
                    onChange={(e) => {
                      const next = cepMask(e.target.value);
                      setDestinationZipCode(next);
                      if (onlyDigits(next).length === 8) saveLocalCep(next);
                    }}
                    className="rounded-xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
                    placeholder="00000-000"
                    inputMode="numeric"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/80">
                    pesquisa por CEP
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/80">
                    origem local + ecossistema
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/80">
                    frete definido na próxima etapa
                  </span>
                </div>

                {onlyDigits(destinationZipCode).length !== 8 ? (
                  <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-3 text-sm text-amber-100">
                    Informe um CEP válido para continuar.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                Forma de pagamento
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('PIX')}
                  className={
                    paymentMethod === 'PIX'
                      ? 'rounded-2xl border border-white/30 bg-white/10 px-4 py-3 text-left text-sm font-semibold text-white'
                      : 'rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-left text-sm font-semibold text-white/80'
                  }
                >
                  Pix
                  <div className="mt-1 text-xs font-normal text-white/60">
                    disponível agora
                  </div>
                </button>

                <button
                  type="button"
                  disabled
                  className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left text-sm font-semibold text-white/45 disabled:cursor-not-allowed"
                >
                  Cartão
                  <div className="mt-1 text-xs font-normal text-white/40">
                    em breve
                  </div>
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                Leitura desta compra
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/35 p-4">
                  <div className="text-xs font-semibold text-white/60">Origem</div>
                  <div className="mt-2 text-sm font-semibold text-white/88">
                    peça ativa no ecossistema
                  </div>
                  <div className="mt-1 text-xs leading-5 text-white/58">
                    A próxima etapa usa CEP e frete para fechar a logística real.
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/35 p-4">
                  <div className="text-xs font-semibold text-white/60">Continuidade</div>
                  <div className="mt-2 text-sm font-semibold text-white/88">
                    compra pronta para virar serviço e dado
                  </div>
                  <div className="mt-1 text-xs leading-5 text-white/58">
                    O fluxo do Marto existe para ligar compra, entrega, serviço,
                    prova social e inteligência.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-[28px] border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="text-sm font-semibold text-white/85">
              Resumo da compra
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4 text-white/80">
                <span>Preço unitário</span>
                <span>{moneyFromCents(unitPriceCents)}</span>
              </div>

              <div className="flex items-center justify-between gap-4 text-white/80">
                <span>Quantidade</span>
                <span>{qty}</span>
              </div>

              <div className="flex items-center justify-between gap-4 text-white/80">
                <span>CEP de destino</span>
                <span>{destinationZipCode || '—'}</span>
              </div>

              <div className="flex items-center justify-between gap-4 text-white/80">
                <span>Pagamento</span>
                <span>{paymentMethod === 'PIX' ? 'Pix' : 'Cartão'}</span>
              </div>

              <div className="h-px bg-white/10" />

              <div className="flex items-center justify-between gap-4 text-white">
                <span className="font-medium">Subtotal</span>
                <span className="text-base font-semibold">
                  {moneyFromCents(subtotalCents)}
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                Dados técnicos
              </div>

              <div className="mt-3 space-y-2 text-xs text-white/65">
                <div className="flex items-start justify-between gap-3">
                  <span>productId</span>
                  <span className="max-w-[60%] break-all text-right text-white/80">
                    {productId || '—'}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <span>merchantId</span>
                  <span className="max-w-[60%] break-all text-right text-white/80">
                    {merchantId || '—'}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <span>unitPrice</span>
                  <span className="text-white/80">{unitPriceCents}</span>
                </div>
              </div>
            </div>

            {!canContinue ? (
              <div className="mt-5 rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/85">
                Falta um CEP válido para seguir.
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
                href={continueHref}
                aria-disabled={!canContinue}
                className={`rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black hover:opacity-90 ${
                  !canContinue ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                Continuar para frete e pagamento
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

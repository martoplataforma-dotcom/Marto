'use client';

import { FallbackSections } from './fallback';

type Home =
  | 'consumer'
  | 'merchant'
  | 'service_provider'
  | 'representative'
  | 'factory';

type MeResponse = {
  home?: Home;
  profile?: { handle?: string | null };
};

export function FactorySections({
  me,
  primaryHref,
}: {
  me: MeResponse;
  primaryHref: string;
}) {
  return <FallbackSections me={me} primaryHref={primaryHref} />;
}

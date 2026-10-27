import type { ExternalOrderIngestionService } from '../../orders/external-order-ingestion.service';
import type {
  MercadoLivreOrderAdapter,
  MercadoLivreOrderAdapterInput,
} from './mercado-livre-order.adapter';

type MercadoLivreOrderAdapterPort = Pick<MercadoLivreOrderAdapter, 'normalize'>;

type ExternalOrderIngestionPort = Pick<ExternalOrderIngestionService, 'ingest'>;

export class MercadoLivreSyncService {
  constructor(
    private readonly adapter: MercadoLivreOrderAdapterPort,
    private readonly ingestion: ExternalOrderIngestionPort,
  ) {}

  async syncOrder(input: MercadoLivreOrderAdapterInput) {
    const normalized = this.adapter.normalize(input);

    return await this.ingestion.ingest(normalized);
  }
}

import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class InsightsQueryDto {
  /**
   * Período no formato YYYY-MM-DD (simples e compatível com filtros no painel)
   */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  /**
   * Filtros dimensionais (opcionais)
   */
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  region?: string; // ex: "SP", "RJ" ou "São Paulo" (vamos padronizar depois)

  /**
   * Granularidade do gráfico de série temporal
   */
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  granularity?: 'day' | 'week' | 'month';
}

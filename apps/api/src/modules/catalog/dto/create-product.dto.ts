import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductDto {
  name!: string;
  price!: number;
  description?: string;

  @IsOptional()
  @IsBoolean()
  requiresShipping?: boolean;

  @IsOptional()
  @IsString()
  productType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  weightGrams?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  lengthCm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  widthCm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  heightCm?: number;

  @IsOptional()
  @IsBoolean()
  allowCorreios?: boolean;

  @IsOptional()
  @IsBoolean()
  allowTransportadora?: boolean;

  @IsOptional()
  @IsBoolean()
  allowLocalDelivery?: boolean;

  @IsOptional()
  @IsBoolean()
  allowPickup?: boolean;
}

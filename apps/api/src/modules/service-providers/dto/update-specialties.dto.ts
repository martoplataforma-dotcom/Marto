import { IsArray, IsString, ArrayMaxSize } from 'class-validator';

export class UpdateSpecialtiesDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  specialties!: string[];
}

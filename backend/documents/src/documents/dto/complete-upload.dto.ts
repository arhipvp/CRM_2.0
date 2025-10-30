import { IsInt, IsNotEmpty, IsPositive, IsString, Matches, MaxLength } from 'class-validator';

export class CompleteUploadDto {
  @IsInt()
  @IsPositive()
  fileSize!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Matches(/^[a-f0-9]+$/i, {
    message: 'checksum must be a hexadecimal string',
  })
  checksum!: string;
}

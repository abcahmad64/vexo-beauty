import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const trimRequiredString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ReplyCustomerSupportTicketDto {
  @IsString()
  @Transform(trimRequiredString)
  @MinLength(1)
  @MaxLength(5000)
  message!: string;
}

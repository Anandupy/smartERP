import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class AssignRolePermissionsDto {
  @ApiProperty({
    description: 'Array of Permission UUIDs to assign to role',
    example: ['019183ab-1234-7111-a111-111111111111'],
  })
  @IsArray()
  @IsUUID('7', { each: true })
  permissionIds!: string[];
}

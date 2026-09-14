import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckSavedJobParamDto {
  @ApiProperty({
    description: 'Mã định danh công việc (UUID)',
    example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  })
  @IsUUID(4, { message: 'Mã công việc phải là định dạng UUID hợp lệ' })
  jobId: string;
}

export class SavedJobCheckDto {
  @ApiProperty({
    description: 'Trạng thái đã lưu công việc của ứng viên',
    example: true,
  })
  isSaved: boolean;
}

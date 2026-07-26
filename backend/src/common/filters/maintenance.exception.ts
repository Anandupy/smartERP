import { HttpException, HttpStatus } from '@nestjs/common';

export class MaintenanceException extends HttpException {
  constructor(
    public readonly maintenanceData: any,
    status: number = HttpStatus.SERVICE_UNAVAILABLE,
  ) {
    super('System is under maintenance', status);
  }
}

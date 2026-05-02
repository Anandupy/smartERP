import { Global, Module } from '@nestjs/common';
import { PasswordService } from './password.service';
import { BcryptPasswordService } from './bcrypt-password.service';

@Global()
@Module({
  providers: [
    {
      provide: PasswordService,
      useClass: BcryptPasswordService,
    },
  ],
  exports: [PasswordService],
})
export class SecurityModule {}

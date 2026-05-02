import { Injectable } from '@nestjs/common';
import { PasswordService } from './password.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class BcryptPasswordService implements PasswordService {
  private readonly saltRounds = 12;

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

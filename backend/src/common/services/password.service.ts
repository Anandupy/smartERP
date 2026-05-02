export abstract class PasswordService {
  abstract hash(password: string): Promise<string>;
  abstract compare(password: string, hash: string): Promise<boolean>;
}

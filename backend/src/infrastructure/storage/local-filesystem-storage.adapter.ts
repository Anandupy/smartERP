import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize, resolve, sep } from 'node:path';
import { StoragePort } from './storage-port';

/**
 * The development storage provider — a local filesystem tree.
 *
 * **This is a development adapter, not a deployment recommendation.** A real
 * deployment needs an S3-compatible provider (the spec's own recommendation
 * is MinIO on-premise, DQ2) for durability and multi-instance access, which
 * this repository has no credentials to provision or test against. Cloud
 * adapters are `DEFERRED`; this fulfils the fallback the phase brief itself
 * names: "implement the storage port and a minimal local development
 * adapter instead, and document the provider as deferred."
 *
 * `key` is trusted to already be a safe, generated, slash-separated relative
 * path — `DocumentService` never derives one from user input. This adapter
 * still refuses to resolve outside its root as a second layer of defence,
 * because the day that assumption is wrong is the day this check matters.
 */
@Injectable()
export class LocalFilesystemStorageAdapter
  extends StoragePort
  implements OnModuleInit
{
  readonly providerName = 'local';
  private readonly logger = new Logger(LocalFilesystemStorageAdapter.name);
  private root!: string;

  constructor(private readonly config: ConfigService) {
    super();
  }

  onModuleInit(): void {
    const configured = this.config.get<string>('DOCUMENT_STORAGE_LOCAL_ROOT');
    this.root = resolve(
      configured || join(process.cwd(), 'storage', 'documents'),
    );
    this.logger.warn(
      `Document storage provider is "local" (${this.root}). This is a development adapter — ` +
        'it is not durable across environments and is not a deployment target. See ' +
        'docs/planning/document-management-specification.md §Storage.',
    );
  }

  async upload(key: string, data: Buffer): Promise<void> {
    const path = this.resolveWithinRoot(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async download(key: string): Promise<Buffer> {
    return readFile(this.resolveWithinRoot(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveWithinRoot(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolveWithinRoot(key));
      return true;
    } catch {
      return false;
    }
  }

  private resolveWithinRoot(key: string): string {
    if (isAbsolute(key) || key.includes('..')) {
      throw new Error(`Refusing an unsafe storage key: ${key}`);
    }
    const path = normalize(join(this.root, key));
    if (path !== this.root && !path.startsWith(this.root + sep)) {
      throw new Error(`Storage key resolves outside the storage root: ${key}`);
    }
    return path;
  }
}

import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StoragePort } from './storage-port';
import { LocalFilesystemStorageAdapter } from './local-filesystem-storage.adapter';

/**
 * The only place a storage provider is chosen.
 *
 * `DOCUMENT_STORAGE_PROVIDER` selects the adapter; everything above this
 * module depends on `StoragePort` and never on a concrete class. Today only
 * `local` (the default) is wired — S3-compatible adapters (`s3`, `r2`,
 * `gcs`, `supabase`, ...) are `DEFERRED`, not stubbed, because a stub that
 * silently accepts uploads it cannot durably store is worse than a
 * deployment that fails to boot naming exactly what is missing.
 */
@Global()
@Module({
  providers: [
    LocalFilesystemStorageAdapter,
    {
      provide: StoragePort,
      inject: [ConfigService, LocalFilesystemStorageAdapter],
      useFactory: (
        config: ConfigService,
        local: LocalFilesystemStorageAdapter,
      ) => {
        const provider =
          config.get<string>('DOCUMENT_STORAGE_PROVIDER') || 'local';
        if (provider === 'local') return local;
        throw new Error(
          `DOCUMENT_STORAGE_PROVIDER="${provider}" has no adapter in this deployment. ` +
            'Only "local" (development) is implemented; cloud providers are deferred — ' +
            'see docs/planning/document-management-specification.md §Storage.',
        );
      },
    },
  ],
  exports: [StoragePort],
})
export class StorageModule {}

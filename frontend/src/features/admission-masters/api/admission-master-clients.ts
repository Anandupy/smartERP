import type { AdmissionMasterType } from "../config/admission-master-registry";
import {
  createAdmissionMasterService,
  type AdmissionMasterService,
} from "./admission-master.service";
import { createAdmissionMasterKeys } from "./admission-master.keys";
import type { FeatureQueryKeys } from "@/core/query";

export interface AdmissionMasterClient {
  service: AdmissionMasterService;
  keys: FeatureQueryKeys;
}

/**
 * One `{ service, keys }` pair per resource, built lazily on first use and
 * cached after that.
 *
 * Hooks index into this rather than calling `createAdmissionMasterService` /
 * `createAdmissionMasterKeys` on every render — the factories are cheap, but
 * there is no reason to re-run them, and this keeps every hook's query key
 * for a given resource referentially identical across renders. Built lazily
 * (not eagerly for all 10 at module load) so importing anything from this
 * feature's barrel does not unconditionally construct all 10 resources'
 * clients up front.
 */
const CLIENTS = new Map<AdmissionMasterType, AdmissionMasterClient>();

export function admissionMasterClient(
  type: AdmissionMasterType,
): AdmissionMasterClient {
  const existing = CLIENTS.get(type);
  if (existing) return existing;

  const client: AdmissionMasterClient = {
    service: createAdmissionMasterService(type),
    keys: createAdmissionMasterKeys(type),
  };
  CLIENTS.set(type, client);
  return client;
}

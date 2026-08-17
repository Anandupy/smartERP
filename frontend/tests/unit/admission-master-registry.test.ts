import { describe, expect, it } from "vitest";

import { ROUTES } from "@/constants";
import {
  ADMISSION_MASTER_REGISTRY,
  ADMISSION_MASTER_TYPES,
  admissionMasterConfig,
  isAdmissionMasterType,
} from "@/features/admission-masters";

/**
 * The registry is the one place the 10 admission masters differ. These specs
 * guard the facts every screen and route depends on: the resource segments
 * are exactly what `backend/postman/erp.postman_collection.json` documents,
 * every entry has real labels, and the route helpers round-trip.
 */
describe("Admission master registry", () => {
  const EXPECTED_RESOURCES = [
    "admission-sources",
    "categories",
    "castes",
    "religions",
    "genders",
    "languages",
    "blood-groups",
    "disabilities",
    "relation-types",
    "quotas",
  ];

  it("lists exactly the 10 documented resources", () => {
    expect([...ADMISSION_MASTER_TYPES].sort()).toEqual(
      [...EXPECTED_RESOURCES].sort(),
    );
  });

  it.each(ADMISSION_MASTER_TYPES)("%s has a complete config entry", (type) => {
    const config = admissionMasterConfig(type);

    expect(config.type).toBe(type);
    expect(config.resource).toBe(type);
    expect(config.singularLabel.length).toBeGreaterThan(0);
    expect(config.pluralLabel.length).toBeGreaterThan(0);
    expect(config.description.length).toBeGreaterThan(0);
    expect(config.emptyStateDescription.length).toBeGreaterThan(0);
  });

  it.each(ADMISSION_MASTER_TYPES)(
    "%s round-trips through the route helpers",
    (type) => {
      expect(ROUTES.app.admissionMasters.list(type)).toBe(
        `/app/admissions/masters/${type}`,
      );
      expect(ROUTES.app.admissionMasters.create(type)).toBe(
        `/app/admissions/masters/${type}/new`,
      );
      expect(ROUTES.app.admissionMasters.detail(type, "abc")).toBe(
        `/app/admissions/masters/${type}/abc`,
      );
      expect(ROUTES.app.admissionMasters.edit(type, "abc")).toBe(
        `/app/admissions/masters/${type}/abc/edit`,
      );
    },
  );

  it("rejects a resource that is not registered", () => {
    expect(isAdmissionMasterType("not-a-master")).toBe(false);
    expect(isAdmissionMasterType("blood-groups")).toBe(true);
  });

  it("keys the registry by its own type", () => {
    for (const [key, config] of Object.entries(ADMISSION_MASTER_REGISTRY)) {
      expect(config.type).toBe(key);
    }
  });
});

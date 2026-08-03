import { describe, expect, it } from "vitest";

// The module under test, not the feature barrel — see the note in
// `audit-analytics.test.ts`.
import {
  toGeneralFormValues,
  toGeneralUpdateRequest,
  toInitRequest,
  toMaintenanceFormValues,
  toMaintenanceUpdateRequest,
} from "@/features/system-settings/mappers/system-settings.mapper";

import { systemSettingsDto } from "@tests/fixtures/system-settings";

describe("system settings mapper", () => {
  it("seeds the general form from the record", () => {
    const settings = systemSettingsDto({ version: "2.4.0" });

    expect(toGeneralFormValues(settings)).toEqual({
      productName: "CampusFlow ERP",
      productCode: "CF-ERP",
      version: "2.4.0",
      environment: "DEV",
    });
  });

  it("presents a missing maintenance message as an empty textarea", () => {
    const settings = systemSettingsDto({ maintenanceMessage: null });

    expect(toMaintenanceFormValues(settings).maintenanceMessage).toBe("");
  });

  it("sends a complete body from the general form, preserving untouched fields", () => {
    // The screens split one record; the endpoint documents no partial update,
    // so editing identity must not blank out the support fields.
    const settings = systemSettingsDto({
      supportEmail: "help@campus.edu",
      supportPhone: "555",
      maintenanceMode: true,
      maintenanceMessage: "Back soon",
    });

    const body = toGeneralUpdateRequest(settings, {
      productName: "Renamed",
      productCode: "CF-2",
      version: "3.0.0",
      environment: "PROD",
    });

    expect(body).toEqual({
      productName: "Renamed",
      productCode: "CF-2",
      version: "3.0.0",
      environment: "PROD",
      maintenanceMode: true,
      maintenanceMessage: "Back soon",
      supportEmail: "help@campus.edu",
      supportPhone: "555",
    });
  });

  it("sends a complete body from the maintenance form too", () => {
    const settings = systemSettingsDto({ productName: "Kept" });

    const body = toMaintenanceUpdateRequest(settings, {
      maintenanceMode: true,
      maintenanceMessage: "Upgrading",
      supportEmail: "help@campus.edu",
      supportPhone: "555",
    });

    expect(body.productName).toBe("Kept");
    expect(body.maintenanceMode).toBe(true);
    expect(body.maintenanceMessage).toBe("Upgrading");
  });

  it("clears an optional message as null rather than storing an empty string", () => {
    const settings = systemSettingsDto({ maintenanceMessage: "Old notice" });

    const body = toMaintenanceUpdateRequest(settings, {
      maintenanceMode: false,
      maintenanceMessage: "   ",
      supportEmail: "help@campus.edu",
      supportPhone: "555",
    });

    expect(body.maintenanceMessage).toBeNull();
  });

  it("trims values it does send", () => {
    const body = toInitRequest({
      productName: "  CampusFlow  ",
      productCode: "CF",
      version: "1.0.0",
      environment: "STAGING",
      maintenanceMode: false,
      maintenanceMessage: "  Notice  ",
      supportEmail: "help@campus.edu",
      supportPhone: "555",
    });

    expect(body.maintenanceMessage).toBe("Notice");
    expect(body.environment).toBe("STAGING");
  });
});

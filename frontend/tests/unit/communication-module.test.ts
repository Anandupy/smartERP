import { describe, expect, it } from "vitest";

import {
  categoryLabel,
  channelLabel,
  communicationSettingsFormSchema,
  countActiveDeliveryLogFilters,
  deliveryLogFilterDefaults,
  deliveryStatusTone,
  fromVariablesText,
  sendNotificationFormDefaults,
  sendNotificationFormSchema,
  templateFormDefaults,
  templateFormSchema,
  templateScopeLevel,
  templateStatusTone,
  toDeliveryLogQuery,
  toSettingsFormValues,
  toSettingsRequest,
  toTemplateFormValues,
  toTemplateRequest,
  toVariablesText,
} from "@/features/communication";

import {
  communicationSettingsDto,
  publishedTemplateDto,
  templateDto,
} from "@tests/fixtures/communication";

describe("template mapper", () => {
  const baseValues = templateFormDefaults({
    code: "PASSWORD_RESET",
    name: "Reset",
  });

  it("sends exactly the thirteen documented request fields", () => {
    const body = toTemplateRequest(baseValues, {
      version: 1,
      organizationId: "org-1",
      branchId: "branch-1",
    });

    expect(Object.keys(body).sort()).toEqual(
      [
        "branchId",
        "bodyHtml",
        "bodyText",
        "category",
        "channel",
        "code",
        "description",
        "language",
        "name",
        "organizationId",
        "status",
        "subject",
        "variables",
        "version",
      ].sort(),
    );
  });

  it("sends blank optionals as null", () => {
    const body = toTemplateRequest(baseValues, {
      version: 1,
      organizationId: null,
      branchId: null,
    });

    expect(body.description).toBeNull();
    expect(body.subject).toBeNull();
    expect(body.bodyHtml).toBeNull();
    expect(body.bodyText).toBeNull();
    expect(body.organizationId).toBeNull();
    expect(body.branchId).toBeNull();
  });

  it("splits the comma-separated variables text into an array", () => {
    expect(fromVariablesText("userName, resetLink,  minutes ,")).toEqual([
      "userName",
      "resetLink",
      "minutes",
    ]);
  });

  it("reads an array of variable names back as text", () => {
    expect(toVariablesText(["userName", "resetLink"])).toBe(
      "userName, resetLink",
    );
  });

  it("reads an object's keys back as text when variables is a record", () => {
    expect(toVariablesText({ userName: "sample", resetLink: "sample" })).toBe(
      "userName, resetLink",
    );
  });

  it("reads a null/absent variables field as empty text", () => {
    expect(toVariablesText(null)).toBe("");
    expect(toVariablesText(undefined)).toBe("");
  });

  it("round-trips a loaded template back into form values", () => {
    const values = toTemplateFormValues(templateDto());
    expect(values.code).toBe("PASSWORD_RESET");
    expect(values.channel).toBe("EMAIL");
    expect(values.variablesText).toBe("userName, resetLink, minutes");
  });

  it("uses the loaded version and scope on edit, not the workspace's", () => {
    const body = toTemplateRequest(
      toTemplateFormValues(templateDto({ version: 3 })),
      {
        version: 3,
        organizationId: "org-9",
        branchId: null,
      },
    );
    expect(body.version).toBe(3);
    expect(body.organizationId).toBe("org-9");
    expect(body.branchId).toBeNull();
  });

  describe("templateScopeLevel — the three documented scope levels", () => {
    it("reports branch-specific when both ids are set", () => {
      expect(
        templateScopeLevel(
          templateDto({ organizationId: "org-1", branchId: "branch-1" }),
        ),
      ).toBe("branch");
    });

    it("reports organization-wide when only organizationId is set", () => {
      expect(
        templateScopeLevel(
          templateDto({ organizationId: "org-1", branchId: null }),
        ),
      ).toBe("organization");
    });

    it("reports the global default when both are null", () => {
      expect(
        templateScopeLevel(
          templateDto({ organizationId: null, branchId: null }),
        ),
      ).toBe("global");
    });
  });
});

describe("template schema", () => {
  const valid = templateFormDefaults({ code: "PASSWORD_RESET", name: "Reset" });

  it("accepts the documented sample", () => {
    expect(templateFormSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a code and a name", () => {
    expect(templateFormSchema.safeParse({ ...valid, code: "" }).success).toBe(
      false,
    );
    expect(templateFormSchema.safeParse({ ...valid, name: "" }).success).toBe(
      false,
    );
  });

  it("requires channel and category to be one of the documented values", () => {
    expect(
      templateFormSchema.safeParse({ ...valid, channel: "FAX" }).success,
    ).toBe(false);
    expect(
      templateFormSchema.safeParse({ ...valid, category: "NOPE" }).success,
    ).toBe(false);
  });

  it("allows blank body fields, since no channel requires them structurally", () => {
    expect(
      templateFormSchema.safeParse({
        ...valid,
        subject: "",
        bodyHtml: "",
        bodyText: "",
      }).success,
    ).toBe(true);
  });
});

describe("channel and status presentation", () => {
  it("shows a known channel's friendly label", () => {
    expect(channelLabel("EMAIL")).toBe("Email");
    expect(channelLabel("WHATSAPP")).toBe("WhatsApp");
  });

  it("falls back to the raw value for an unrecognized channel", () => {
    expect(channelLabel("VOICE")).toBe("VOICE");
  });

  it("falls back to a neutral tone for status values it does not recognize", () => {
    expect(templateStatusTone("UNKNOWN")).toBe("neutral");
    expect(deliveryStatusTone("UNKNOWN")).toBe("neutral");
  });

  it("tones the nine documented delivery states as specified", () => {
    expect(deliveryStatusTone("SENT")).toBe("success");
    expect(deliveryStatusTone("DELIVERED")).toBe("success");
    expect(deliveryStatusTone("FAILED")).toBe("danger");
    expect(deliveryStatusTone("BOUNCED")).toBe("danger");
    expect(deliveryStatusTone("PENDING")).toBe("neutral");
    expect(deliveryStatusTone("OPENED")).toBe("info");
    expect(deliveryStatusTone("CLICKED")).toBe("info");
  });

  it("shows a known category's friendly label", () => {
    expect(categoryLabel("ADMISSIONS")).toBe("Admissions");
  });
});

describe("settings mapper", () => {
  it("defaults an unreported boolean to true, matching the documented default", () => {
    const values = toSettingsFormValues(
      communicationSettingsDto({ emailEnabled: undefined }),
    );
    expect(values.emailEnabled).toBe(true);
  });

  it("rebuilds the complete twelve-field body from form values", () => {
    const body = toSettingsRequest(
      toSettingsFormValues(communicationSettingsDto()),
    );
    expect(Object.keys(body).sort()).toEqual(
      [
        "analyticsEnabled",
        "defaultEmailProvider",
        "defaultPushProvider",
        "defaultSmsProvider",
        "defaultWhatsappProvider",
        "emailEnabled",
        "otpEnabled",
        "pushEnabled",
        "retryEnabled",
        "smsEnabled",
        "trackingEnabled",
        "whatsappEnabled",
      ].sort(),
    );
  });
});

describe("communication settings schema", () => {
  it("accepts the documented sample", () => {
    const values = toSettingsFormValues(communicationSettingsDto());
    expect(communicationSettingsFormSchema.safeParse(values).success).toBe(
      true,
    );
  });

  it("rejects an empty provider selection", () => {
    const values = toSettingsFormValues(communicationSettingsDto());
    expect(
      communicationSettingsFormSchema.safeParse({
        ...values,
        defaultEmailProvider: "",
      }).success,
    ).toBe(false);
  });
});

describe("send notification schema", () => {
  const valid = {
    ...sendNotificationFormDefaults(),
    userId: "user-1",
    title: "Hi",
    content: "Hello",
  };

  it("accepts the documented sample", () => {
    expect(sendNotificationFormSchema.safeParse(valid).success).toBe(true);
  });

  it("requires userId, title and content", () => {
    expect(
      sendNotificationFormSchema.safeParse({ ...valid, userId: "" }).success,
    ).toBe(false);
    expect(
      sendNotificationFormSchema.safeParse({ ...valid, title: "" }).success,
    ).toBe(false);
    expect(
      sendNotificationFormSchema.safeParse({ ...valid, content: "" }).success,
    ).toBe(false);
  });

  it("requires metadata text to be a JSON object when present", () => {
    expect(
      sendNotificationFormSchema.safeParse({
        ...valid,
        metadataText: '{"a":1}',
      }).success,
    ).toBe(true);
    expect(
      sendNotificationFormSchema.safeParse({ ...valid, metadataText: "[1]" })
        .success,
    ).toBe(false);
    expect(
      sendNotificationFormSchema.safeParse({ ...valid, metadataText: "" })
        .success,
    ).toBe(true);
  });
});

describe("delivery log query — the documented ten parameters", () => {
  const scope = { organizationId: "org-1", branchId: "branch-1" };

  it("translates ANY and blank text to absent parameters", () => {
    const query = toDeliveryLogQuery(deliveryLogFilterDefaults(), scope);
    expect(query.channel).toBeUndefined();
    expect(query.status).toBeUndefined();
    expect(query.provider).toBeUndefined();
    expect(query.recipient).toBeUndefined();
    expect(query.startDate).toBeUndefined();
  });

  it("always carries the active organization and branch", () => {
    const query = toDeliveryLogQuery(deliveryLogFilterDefaults(), scope);
    expect(query.organizationId).toBe("org-1");
    expect(query.branchId).toBe("branch-1");
  });

  it("resolves a date preset to an ISO startDate", () => {
    const query = toDeliveryLogQuery(
      { ...deliveryLogFilterDefaults(), datePreset: "7D" },
      scope,
    );
    expect(query.startDate).toBeDefined();
    expect(() => new Date(query.startDate as string)).not.toThrow();
  });

  it("counts active filters, ignoring ALL and ANY", () => {
    expect(countActiveDeliveryLogFilters(deliveryLogFilterDefaults())).toBe(0);
    expect(
      countActiveDeliveryLogFilters({
        ...deliveryLogFilterDefaults(),
        recipient: "student@example.com",
        channel: "EMAIL",
      }),
    ).toBe(2);
  });
});

describe("published template fixture sanity", () => {
  it("has no HTML body, matching an SMS-only channel", () => {
    expect(publishedTemplateDto().bodyHtml).toBeNull();
  });
});

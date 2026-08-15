import { z } from "zod";

import { nonEmptyString } from "@/schemas";

import { NOTIFICATION_CATEGORIES } from "../types/template.dto";
import { NOTIFICATION_PRIORITIES } from "../types/notification.dto";

/**
 * Form schema for Send Notification — the single-recipient in-app write
 * documented at `POST /communication/notifications`. Every field maps
 * directly to one of the ten documented request fields except `metadataText`,
 * this form's JSON-text stand-in for the wire's free-form `metadata` object —
 * the same convention Academic Unit uses for its own `metadata` field, since
 * neither endpoint documents any keys to build a structured editor around.
 */
export const sendNotificationFormSchema = z.object({
  userId: nonEmptyString,
  title: nonEmptyString,
  content: nonEmptyString,
  category: z.enum(NOTIFICATION_CATEGORIES, { message: "Choose a category" }),
  priority: z.enum(NOTIFICATION_PRIORITIES, { message: "Choose a priority" }),
  actionUrl: z.string().trim(),
  isPinned: z.boolean(),
  metadataText: z.string().refine((value) => {
    if (value.trim().length === 0) return true;
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
    } catch {
      return false;
    }
  }, "Enter a JSON object, or leave blank"),
});

export type SendNotificationFormValues = z.infer<
  typeof sendNotificationFormSchema
>;

export function sendNotificationFormDefaults(): SendNotificationFormValues {
  return {
    userId: "",
    title: "",
    content: "",
    category: "SYSTEM",
    priority: "NORMAL",
    actionUrl: "",
    isPinned: false,
    metadataText: "",
  };
}

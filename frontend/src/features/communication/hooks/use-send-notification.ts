"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { communicationService } from "../api/communication.service";
import type {
  CreateNotificationRequest,
  InAppNotificationDto,
} from "../types/notification.dto";

/**
 * Send a single-recipient in-app notification —
 * `POST /communication/notifications`.
 *
 * No query invalidation: this module ships no notification-inbox screen (see
 * the module doc), so there is no cached list here for the write to affect.
 */
export function useSendNotification() {
  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: CreateNotificationRequest) =>
      communicationService.notifications.create(body),
    onSuccess: (notification: InAppNotificationDto, body) => {
      toast.success(`Notification sent to ${notification?.userId ?? body.userId}`);
    },
  });
}

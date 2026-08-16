"use client";

import { Laptop } from "@/assets/icons";

import { PendingScreen } from "../pending-screen";

/**
 * Trusted Devices.
 *
 * A trusted device is a persisted trust relationship, distinct from an
 * active session — neither a Prisma model nor a controller for one exists in
 * the backend, so no session is treated as a "trusted device" to fill the
 * gap.
 */
export function TrustedDevicesScreen() {
  return (
    <PendingScreen
      icon={Laptop}
      title="Trusted Devices"
      description="Devices you've marked as recognized, skipping extra verification."
      emptyTitle="Trusted device management is not available"
      emptyDescription="Marking a device as trusted, or removing one, isn't supported yet."
      missing="the backend has no trusted-device model or endpoints — enrolling,
      listing or revoking a trusted device is not possible. Active Sessions
      lists every device currently signed in, which is a related but
      different concept."
    />
  );
}

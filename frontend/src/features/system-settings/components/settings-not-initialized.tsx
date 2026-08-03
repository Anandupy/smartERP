"use client";

import { useState } from "react";

import { Settings } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/shared/components/feedback";

import { InitializeSettingsDialog } from "./initialize-settings-dialog";

/**
 * What the Settings area shows before the installation has any settings.
 *
 * `POST /system-settings/init` is documented as running once, ever, so this is
 * a real state with a real action rather than an error — treating a `404` here
 * as a failure would leave the only person who can fix it staring at "Not
 * found".
 */
export function SettingsNotInitialized() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <EmptyState
        icon={Settings}
        title="System settings are not initialized"
        description="This installation has no global configuration yet. Initialization can be performed once, and establishes the product identity, environment and support channels."
        action={
          <Button type="button" onClick={() => setIsOpen(true)}>
            Initialize system settings
          </Button>
        }
      />
      <InitializeSettingsDialog open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}

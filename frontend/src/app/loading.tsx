import { LoadingState } from "@/shared/components/feedback";

/** Root route loading UI, shown during navigation/Suspense at the app root. */
export default function Loading() {
  return <LoadingState className="flex-1" />;
}

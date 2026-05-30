// Legacy route preserved for compatibility — onboarding is now a popup on the
// app shell, so this route just redirects home and the modal appears there.
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/onboarding")({
  component: () => <Navigate to="/" />,
});

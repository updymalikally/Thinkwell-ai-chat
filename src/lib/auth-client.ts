import { createAuthClient } from "better-auth/react";

// Better Auth runs on this app's /api/auth route. Let the client use the
// current app origin instead of sending sign-in requests to the AI provider.
export const authClient = createAuthClient();

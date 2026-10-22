import { headers } from "next/headers";
import ChatApp from "@/components/chat-app";
import SignIn from "@/components/sign-in";
import SetupRequired from "@/components/setup-required";

export default async function Home() {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) return <SetupRequired />;
  const { auth } = await import("@/lib/auth");
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? <ChatApp userName={session.user.name} userEmail={session.user.email} /> : <SignIn />;
}

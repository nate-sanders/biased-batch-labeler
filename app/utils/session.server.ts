import { createCookieSessionStorage, redirect } from "@remix-run/node";
import { supabase } from "./supabase.server";
import type { User } from "~/types";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set");
}

const storage = createCookieSessionStorage({
  cookie: {
    name: "BB_session",
    secure: process.env.NODE_ENV === "production",
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
  },
});

export async function createUserSession(
  accessToken: string,
  refreshToken: string,
  redirectTo: string
) {
  const session = await storage.getSession();
  session.set("accessToken", accessToken);
  session.set("refreshToken", refreshToken);
  
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await storage.commitSession(session),
    },
  });
}

export async function requireUser(request: Request) {
  const user = await getUser(request);
  if (!user) {
    throw redirect("/login");
  }
  return user;
}

export async function getUser(request: Request): Promise<User | null> {
  const session = await getUserSession(request);
  const accessToken = session.get("accessToken");
  
  if (!accessToken) return null;

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  return {
    id: user.id,
    email: user.email!,
    createdAt: new Date(user.created_at!),
    updatedAt: new Date(user.last_sign_in_at || user.created_at!),
  };
}

export async function logout(request: Request) {
  const session = await getUserSession(request);
  await supabase.auth.signOut();
  
  return redirect("/login", {
    headers: {
      "Set-Cookie": await storage.destroySession(session),
    },
  });
}

function getUserSession(request: Request) {
  return storage.getSession(request.headers.get("Cookie"));
}

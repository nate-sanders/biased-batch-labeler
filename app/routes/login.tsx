import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useSearchParams } from "@remix-run/react";
import { verifyLogin } from "~/models/user.server";
import { createUserSession, getUser } from "~/utils/session.server";
import { validateEmail } from "~/utils/validators";
import { supabase } from "~/utils/supabase.server"; // Updated import path

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (user) return redirect("/dashboard");
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTo = formData.get("redirectTo") || "/dashboard";

  if (!validateEmail(email)) {
    return json(
      { errors: { email: "Email is invalid" } },
      { status: 400 }
    );
  }

  if (typeof password !== "string" || password.length < 8) {
    return json(
      { errors: { password: "Password is invalid" } },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.toString(),
    password: password.toString(),
  });

  if (error || !data.session) {
    return json(
      { errors: { email: "Invalid email or password" } },
      { status: 400 }
    );
  }

  return createUserSession(
    data.session.access_token,
    data.session.refresh_token,
    redirectTo.toString()
  );
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const actionData = useActionData<typeof action>();

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 px-4">
        <div>
          <h1 className="text-center text-3xl font-bold">BIASED BATCH</h1>
          <h2 className="mt-6 text-center text-2xl">Sign in to your account</h2>
        </div>

        <Form method="post" className="mt-8 space-y-6">
          <input
            type="hidden"
            name="redirectTo"
            value={searchParams.get("redirectTo") ?? undefined}
          />
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 block w-full rounded border px-3 py-2"
              />
              {actionData?.errors?.email && (
                <div className="text-red-600">{actionData.errors.email}</div>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 block w-full rounded border px-3 py-2"
              />
              {actionData?.errors?.password && (
                <div className="text-red-600">{actionData.errors.password}</div>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Sign in
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}

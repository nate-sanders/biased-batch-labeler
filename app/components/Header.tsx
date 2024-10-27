import { Form, Link, useLoaderData } from "@remix-run/react";
import type { loader } from "~/routes/dashboard/_layout";

export function Header() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/dashboard" className="text-xl font-bold">
                BIASED BATCH
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            <span className="text-sm text-gray-700 mr-4">{user.email}</span>
            <Form action="/logout" method="post">
              <button
                type="submit"
                className="text-sm text-gray-700 hover:text-gray-900"
              >
                Sign out
              </button>
            </Form>
          </div>
        </div>
      </div>
    </header>
  );
}

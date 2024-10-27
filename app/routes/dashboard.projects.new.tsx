import { type ReactNode } from "react";
import { Form } from "@remix-run/react";

export default function NewProject(): ReactNode {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Create New Project</h2>
      <Form method="post" className="max-w-md">
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Project Name
            </label>
            <input
              type="text"
              name="name"
              id="name"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Project
          </button>
        </div>
      </Form>
    </div>
  );
}

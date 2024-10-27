import { type ReactNode } from "react";

export default function DashboardIndex(): ReactNode {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Welcome to Biased Batch</h2>
      <p>Select a project from the sidebar to get started.</p>
    </div>
  );
}

import { type ReactNode } from "react";
import { Outlet } from "@remix-run/react";

export default function ProjectLayout(): ReactNode {
  // This layout will render the visualization by default
  return (
    <div className="h-full">
      <Outlet />
    </div>
  );
}

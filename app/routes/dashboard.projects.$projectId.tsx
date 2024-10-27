import { type ReactNode } from "react";
import { Outlet } from "@remix-run/react";

export default function ProjectLayout(): ReactNode {
  return <Outlet />;
}

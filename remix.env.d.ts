/// <reference types="@remix-run/dev" />
/// <reference types="@remix-run/node" />
/// <reference types="vite/client" />

import type { LinksFunction, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SUPABASE_URL: string;
      SUPABASE_ANON_KEY: string;
      SESSION_SECRET: string;
    }
  }
}

declare module "@remix-run/node" {
  export interface AppLoadContext {
    // Add any custom context properties here
  }
  export { LinksFunction, LoaderFunctionArgs, ActionFunctionArgs };
}

declare module "*.css" {
  const content: string;
  export default content;
}

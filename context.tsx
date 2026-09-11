import { createContext, useContext } from "react";
import type { Actor, Command, Data } from "./types";
export interface Workspace {
  actor: Actor;
  data: Data;
  busy: boolean;
  run: (command: Command) => Promise<boolean>;
  notify: (message: string) => void;
  route: string;
  navigate: (path: string) => void;
}
export const WorkspaceContext = createContext<Workspace | null>(null);
export function useWorkspace() {
  const c = useContext(WorkspaceContext);
  if (!c) throw Error("Workspace missing");
  return c;
}

import type { Middleware } from "../types";

export class RadixNode {
  children: Record<string, RadixNode> = {};
  paramNode: RadixNode | null = null;
  paramName: string | null = null;
  wildcardNode: RadixNode | null = null;
  handlers: Record<string, Middleware[]> = {};
}

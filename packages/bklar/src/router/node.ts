import type { Middleware, WSHandlers } from "../types";

export class RadixNode {
  children: Record<string, RadixNode> = {};
  paramNode: RadixNode | null = null;
  paramName: string | null = null;
  wildcardNode: RadixNode | null = null;
  handlers: Record<string, Middleware[]> = {};
  wsHandlers: Record<string, WSHandlers> = {};
}


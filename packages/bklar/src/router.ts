import { RadixNode } from "./router/node";
import type { Middleware, RouteOptions } from "./types";

export interface MatchResult {
  handlers: Middleware[];
  params: Record<string, string>;
}

export interface RouteInfo {
  method: string;
  path: string;
  options: RouteOptions<any>;
}

export class Router {
  root: RadixNode = new RadixNode();
  private routes: RouteInfo[] = [];

  add(method: string, path: string, middlewares: Middleware[], options: RouteOptions<any> = {}) {
    this.routes.push({ method, path, options });
    
    const segments = path.split("/").filter(Boolean);
    let currentNode = this.root;

    for (const segment of segments) {
      if (segment === "*") {
        if (!currentNode.wildcardNode) {
          currentNode.wildcardNode = new RadixNode();
        }
        currentNode = currentNode.wildcardNode;
        // Wildcard is terminal for this router implementation
        break;
      } else if (segment.startsWith(":")) {
        const paramName = segment.slice(1);
        if (!currentNode.paramNode) {
          currentNode.paramNode = new RadixNode();
          currentNode.paramNode.paramName = paramName;
        }
        if (currentNode.paramNode.paramName !== paramName) {
          throw new Error(
            `Parameter name collision at ${path}: ${currentNode.paramNode.paramName} vs ${paramName}`
          );
        }
        currentNode = currentNode.paramNode;
      } else {
        if (!currentNode.children[segment]) {
          currentNode.children[segment] = new RadixNode();
        }
        currentNode = currentNode.children[segment];
      }
    }

    // Initialize array if not exists
    if (!currentNode.handlers[method]) {
        currentNode.handlers[method] = [];
    }
    // Store the stack
    currentNode.handlers[method] = middlewares;
  }

  find(method: string, path: string): MatchResult | null {
    const segments = path.split("/").filter(Boolean);
    const params: Record<string, string> = {};

    const node = this._search(this.root, segments, 0, params);

    if (!node || !node.handlers[method]) {
      // Check for generic handlers or return null
      return null;
    }

    return {
      handlers: node.handlers[method],
      params,
    };
  }

  private _search(
    node: RadixNode,
    segments: string[],
    idx: number,
    params: Record<string, string>
  ): RadixNode | null {
    if (idx === segments.length) {
      return node;
    }

    const segment = segments[idx];

    // 1. Static match
    if (node.children[segment]) {
      const res = this._search(node.children[segment], segments, idx + 1, params);
      if (res) return res;
    }

    // 2. Param match
    if (node.paramNode) {
      if (node.paramNode.paramName) {
        params[node.paramNode.paramName] = segment;
      }
      const res = this._search(node.paramNode, segments, idx + 1, params);
      if (res) return res;
      // Backtrack
      if (node.paramNode.paramName) {
        delete params[node.paramNode.paramName];
      }
    }

    // 3. Wildcard match
    if (node.wildcardNode) {
      return node.wildcardNode;
    }

    return null;
  }

  getRoutes(): RouteInfo[] {
    return this.routes;
  }
}

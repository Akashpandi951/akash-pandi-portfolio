/**
 * src/mcp/server.ts
 * Dedicated Portfolio Automation MCP Server using Official @modelcontextprotocol/sdk
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export declare function createMcpServer(): McpServer;
export declare function startStdioMcpServer(): Promise<void>;

/**
 * src/mcp/server.ts
 * Dedicated Portfolio Automation MCP Server using Official @modelcontextprotocol/sdk
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { EnquiryService } from '../services/enquiry.service';
import { getQueueHealth, retryFailedJobs } from '../queue';
import { logger } from '../config';

export function createMcpServer() {
  const server = new McpServer({
    name: 'akash-portfolio-automation-mcp',
    version: '2.0.0'
  });

  // 1. Tool: retrieve_enquiries
  server.tool(
    'retrieve_enquiries',
    'Retrieve paginated visitor enquiries, hiring requests, and project messages with optional filters.',
    {
      status: z.enum(['ALL', 'NEW', 'IN_REVIEW', 'READ', 'REPLIED', 'ARCHIVED']).optional().describe('Filter by status'),
      category: z.enum(['ALL', 'HIRING', 'PROJECT', 'COLLABORATION', 'GENERAL']).optional().describe('Filter by category'),
      priority: z.enum(['ALL', 'LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().describe('Filter by priority'),
      page: z.number().int().positive().optional().describe('Page number (default 1)'),
      limit: z.number().int().positive().max(100).optional().describe('Records per page (max 100, default 20)')
    },
    async (args) => {
      try {
        const result = await EnquiryService.getEnquiries({
          status: args.status,
          category: args.category,
          priority: args.priority,
          page: args.page,
          limit: args.limit
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error retrieving enquiries: ${err.message}` }],
          isError: true
        };
      }
    }
  );

  // 2. Tool: search_requests
  server.tool(
    'search_requests',
    'Full-text search enquiries across visitor names, email addresses, and message contents.',
    {
      query: z.string().min(1).describe('Search term or keyword'),
      limit: z.number().int().positive().max(50).optional().describe('Max search results to return')
    },
    async (args) => {
      try {
        const result = await EnquiryService.getEnquiries({
          search: args.query,
          limit: args.limit || 20
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error searching requests: ${err.message}` }],
          isError: true
        };
      }
    }
  );

  // 3. Tool: view_request_details
  server.tool(
    'view_request_details',
    'View complete metadata, notification delivery history, and immutable audit logs for a single enquiry.',
    {
      id: z.string().min(1).describe('Unique Enquiry UUID or ID')
    },
    async (args) => {
      try {
        const details = await EnquiryService.getEnquiryById(args.id);
        if (!details) {
          return {
            content: [{ type: 'text', text: `Enquiry with ID "${args.id}" was not found.` }],
            isError: true
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(details, null, 2)
            }
          ]
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error viewing request details: ${err.message}` }],
          isError: true
        };
      }
    }
  );

  // 4. Tool: update_request_status
  server.tool(
    'update_request_status',
    'Transition enquiry status (NEW, IN_REVIEW, READ, REPLIED, ARCHIVED) and adjust priority level.',
    {
      id: z.string().min(1).describe('Unique Enquiry ID'),
      status: z.enum(['NEW', 'IN_REVIEW', 'READ', 'REPLIED', 'ARCHIVED']).optional().describe('Target status state'),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().describe('Target priority level'),
      actorEmail: z.string().optional().describe('Admin email initiating the action')
    },
    async (args) => {
      try {
        let updated: any = null;
        if (args.status) {
          updated = await EnquiryService.updateStatus(args.id, args.status, args.actorEmail || 'mcp-agent@portfolio.internal');
        }
        if (args.priority) {
          updated = await EnquiryService.updatePriority(args.id, args.priority, args.actorEmail || 'mcp-agent@portfolio.internal');
        }
        if (!updated) {
          return {
            content: [{ type: 'text', text: `Enquiry with ID "${args.id}" not found or no changes made.` }],
            isError: true
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Enquiry updated successfully', data: updated }, null, 2)
            }
          ]
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error updating status: ${err.message}` }],
          isError: true
        };
      }
    }
  );

  // 5. Tool: view_analytics
  server.tool(
    'view_analytics',
    'Retrieve high-level portfolio enquiry metrics, category distribution, priority breakdown, and response rates.',
    {},
    async () => {
      try {
        const stats = await EnquiryService.getAnalytics();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stats, null, 2)
            }
          ]
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error fetching analytics: ${err.message}` }],
          isError: true
        };
      }
    }
  );

  // 6. Tool: monitor_queue_health
  server.tool(
    'monitor_queue_health',
    'Inspect BullMQ background processing queue telemetry: active, waiting, completed, delayed, and failed notification jobs.',
    {},
    async () => {
      try {
        const health = await getQueueHealth();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(health, null, 2)
            }
          ]
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error monitoring queue: ${err.message}` }],
          isError: true
        };
      }
    }
  );

  // 7. Tool: retry_failed_jobs
  server.tool(
    'retry_failed_jobs',
    'Retry failed asynchronous notification jobs in the Dead Letter Queue (DLQ).',
    {},
    async () => {
      try {
        const count = await retryFailedJobs();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: `Re-queued ${count} failed notification jobs for processing.` }, null, 2)
            }
          ]
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error retrying jobs: ${err.message}` }],
          isError: true
        };
      }
    }
  );

  // 8. Tool: export_enquiry_data
  server.tool(
    'export_enquiry_data',
    'Export portfolio enquiry database records in authorized JSON or CSV format.',
    {
      format: z.enum(['json', 'csv']).default('json').describe('Target export format')
    },
    async (args) => {
      try {
        const result = await EnquiryService.exportData(args.format);
        return {
          content: [
            {
              type: 'text',
              text: result.data
            }
          ]
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error exporting data: ${err.message}` }],
          isError: true
        };
      }
    }
  );

  return server;
}

// Stdio CLI Runner
export async function startStdioMcpServer() {
  const mcpServer = createMcpServer();
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  logger.info('[MCP] Portfolio Automation MCP Server running on stdio transport.');
}

if (require.main === module) {
  startStdioMcpServer().catch((err) => {
    console.error('Fatal MCP Server error:', err);
    process.exit(1);
  });
}

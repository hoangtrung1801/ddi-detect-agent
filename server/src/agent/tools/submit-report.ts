import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { InteractionReport } from '../../schemas/report.ts';
import { ReportDraftSchema } from '../../schemas/report.ts';
import type { RunContext } from '../context.ts';
import { buildReport } from '../guard.ts';

export function makeSubmitReportTool(ctx: RunContext): AgentTool<typeof ReportDraftSchema, InteractionReport> {
  return {
    name: 'submit_report',
    label: 'Submit report',
    description:
      'Submit the final Vietnamese report. Provide a title, one entry per drug pair with a Vietnamese explanation (and a severity for pairs with status INTERACTION), and recommendations. ' +
      'Statuses, database conditions and overall risk are filled in by the system.',
    parameters: ReportDraftSchema,
    execute: async (_id, params) => {
      const report = await buildReport(params, ctx);
      ctx.report = report;
      return {
        content: [{ type: 'text', text: 'Report accepted.' }],
        details: report,
        terminate: true,
      };
    },
  };
}

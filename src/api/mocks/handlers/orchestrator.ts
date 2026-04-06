import { http, HttpResponse } from 'msw';
import { API_URLS } from '../../../lib/config';

const BASE = API_URLS.ORCHESTRATOR;

export const orchestratorHandlers = [
  http.post(`${BASE}/agent`, async ({ request }) => {
    const body = await request.json() as { message: string };
    const message = body.message || '';

    const isUrl = /https?:\/\//.test(message);
    const isPlan = /plan|week|schedule/i.test(message);
    const isRebalance = /miss|skip|rebalance/i.test(message);

    const intent = isUrl ? 'import_workout' : isPlan ? 'plan_week' : isRebalance ? 'rebalance' : 'advice';

    return HttpResponse.json({
      response: isUrl
        ? 'Imported workout from video. Ready to structure and push to your device.'
        : isPlan
        ? 'Generated 5 sessions for this week: Mon Upper Body, Tue Easy Run, Wed Lower Body, Thu Tempo Run, Fri Recovery.'
        : isRebalance
        ? "I'd like to rebalance your week:\n- Move Thursday strength to Friday\n- Add recovery session Wednesday\n\nApprove, edit, or reject?"
        : 'Your freshness score is 72/100. Adherence rate is 85%. You have 4 sessions this week.',
      intent,
      confidence: 0.9,
      thread_id: `demo-thread-${Date.now()}`,
      trace_id: `demo-trace-${Date.now()}`,
      tool_results: [],
      matched_rules: [`demo:${intent}`],
      approval_status: isRebalance ? 'pending' : 'none',
      proposed_actions: isRebalance ? [{ action_id: 'demo-1', tool: 'planner', impact: 'high' }] : [],
    });
  }),

  http.post(`${BASE}/agent/:threadId/approve`, () => {
    return HttpResponse.json({
      response: 'Changes applied. Your week has been rebalanced.',
      intent: 'rebalance', confidence: 0.9,
      thread_id: 'demo', trace_id: 'demo',
      tool_results: [{ tool: 'planner', status: 'success', action_id: 'demo-1' }],
      matched_rules: [], approval_status: 'approved', proposed_actions: [],
    });
  }),

  http.post(`${BASE}/agent/:threadId/reject`, () => {
    return HttpResponse.json({
      response: 'No changes were made.',
      intent: 'rebalance', confidence: 0.9,
      thread_id: 'demo', trace_id: 'demo',
      tool_results: [], matched_rules: [],
      approval_status: 'rejected', proposed_actions: [],
    });
  }),

  http.get(`${BASE}/agent/:threadId/status`, () => {
    return HttpResponse.json({
      thread_id: 'demo', status: 'completed',
      approval_required: false, proposed_actions: [], response: '',
    });
  }),

  http.get(`${BASE}/health`, () => {
    return HttpResponse.json({ status: 'ok', service: 'orchestrator-api', version: '0.2.0' });
  }),
];

import { useState } from 'react';
import { cn } from '../../../components/ui/utils';
import type { PipelineStep } from '../store/runTypes';

interface StepDetailProps {
  step: PipelineStep | null;
}

type Tab = 'request' | 'response' | 'schema' | 'audit';

function JsonView({ data }: { data: unknown }) {
  return (
    <pre className="text-xs font-mono bg-muted/50 rounded p-3 overflow-auto max-h-64 whitespace-pre-wrap break-words">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function StepDetail({ step }: StepDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>('response');

  if (!step) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4">
        Select a step to see details
      </div>
    );
  }

  const tabs: Tab[] = ['request', 'response', 'schema', 'audit'];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b">
        <div className="text-sm font-medium">{step.label}</div>
        <div className="text-xs text-muted-foreground">{step.service}</div>
        {step.request && (
          <div className="text-xs text-muted-foreground font-mono mt-1">
            {step.request.method} {step.request.url}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b px-4">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors capitalize',
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'request' && (
          <div className="space-y-2">
            {step.request ? (
              <>
                <div className="text-xs font-medium text-muted-foreground">Body</div>
                <JsonView data={step.request.body} />
              </>
            ) : (
              <div className="text-xs text-muted-foreground">No request data</div>
            )}
          </div>
        )}

        {activeTab === 'response' && (
          <div className="space-y-2">
            {step.response ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={cn(
                      'text-xs font-mono px-1.5 py-0.5 rounded',
                      step.response.status < 400
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700',
                    )}
                  >
                    {step.response.status}
                  </span>
                </div>
                <JsonView data={step.response.body} />
              </>
            ) : (
              <div className="text-xs text-muted-foreground">No response yet</div>
            )}
          </div>
        )}

        {activeTab === 'schema' && (
          <div className="space-y-2">
            {step.schemaValidation ? (
              <>
                <div
                  className={cn(
                    'text-sm font-medium',
                    step.schemaValidation.passed ? 'text-green-600' : 'text-red-600',
                  )}
                >
                  {step.schemaValidation.passed ? '✓ Schema valid' : '✗ Schema invalid'}
                </div>
                {step.schemaValidation.errors?.map((err, i) => (
                  <div key={i} className="text-xs border rounded p-2 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
                    <span className="font-mono text-red-700 dark:text-red-400">{err.path}</span>
                    <span className="text-muted-foreground ml-2">{err.message}</span>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-xs text-muted-foreground">No schema validation result</div>
            )}
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">API Output (raw)</div>
              <JsonView data={step.apiOutput} />
            </div>
            {step.edited && (
              <div>
                <div className="text-xs font-medium text-orange-600 mb-1">
                  Effective Output (edited{step.editedAt ? ` at ${new Date(step.editedAt).toLocaleTimeString()}` : ''})
                </div>
                <JsonView data={step.effectiveOutput} />
              </div>
            )}
            {!step.edited && (
              <div className="text-xs text-muted-foreground">Step was not edited — effective output matches API output.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

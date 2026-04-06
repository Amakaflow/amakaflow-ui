import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Check, X, Loader2 } from 'lucide-react';

interface OrchestratorApprovalModalProps {
  open: boolean;
  proposalText: string;
  proposedActions: Record<string, unknown>[];
  threadId: string;
  onApprove: (threadId: string) => Promise<void>;
  onReject: (threadId: string) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

export function OrchestratorApprovalModal({
  open,
  proposalText,
  proposedActions,
  threadId,
  onApprove,
  onReject,
  onClose,
  loading = false,
}: OrchestratorApprovalModalProps) {
  if (!open) return null;

  const titleId = 'orchestrator-approval-title';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle id={titleId} className="text-lg">Review Proposed Changes</CardTitle>
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              Awaiting Approval
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="whitespace-pre-wrap text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
            {proposalText}
          </div>

          {proposedActions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Proposed Actions:</p>
              {proposedActions.map((action, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className="text-xs">
                    {String(action.tool || 'action')}
                  </Badge>
                  <span className="text-muted-foreground">
                    {String(action.impact || 'low')} impact
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => onApprove(threadId)}
              disabled={loading}
              className="flex-1"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Approve
            </Button>
            <Button
              variant="outline"
              onClick={() => onReject(threadId)}
              disabled={loading}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              Reject
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

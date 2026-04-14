import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { useOrchestrator } from '../hooks/useOrchestrator';
import { OrchestratorApprovalModal } from './OrchestratorApprovalModal';

export function OrchestratorChat() {
  const [input, setInput] = useState('');
  const { send, approve, reject, loading, error, lastResponse, isApprovalPending } = useOrchestrator();
  const [showApproval, setShowApproval] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const message = input.trim();
    setInput('');
    const result = await send(message);
    if (result?.approval_status === 'pending') {
      setShowApproval(true);
    }
  };

  const handleApprove = async (threadId: string) => {
    const result = await approve(threadId);
    if (result) setShowApproval(false);  // Only close on success
  };

  const handleReject = async (threadId: string) => {
    const result = await reject(threadId);
    if (result) setShowApproval(false);  // Only close on success
  };

  return (
    <div className="space-y-3">
      {/* Response display */}
      {lastResponse && !isApprovalPending && (
        <Card className="bg-muted/30">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm whitespace-pre-wrap">{lastResponse.response}</div>
            </div>
            {lastResponse.intent && (
              <div className="mt-2 flex gap-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  {lastResponse.intent}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {Math.round(lastResponse.confidence * 100)}% confident
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
          placeholder="Ask the AI coach, paste a URL, or type a command..."
          disabled={loading}
          className="flex-1"
        />
        <Button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          size="icon"
          aria-label={loading ? 'Sending message' : 'Send message'}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>

      {/* Approval modal */}
      <OrchestratorApprovalModal
        open={showApproval}
        proposalText={lastResponse?.response || ''}
        proposedActions={lastResponse?.proposed_actions || []}
        threadId={lastResponse?.thread_id || ''}
        onApprove={handleApprove}
        onReject={handleReject}
        onClose={() => setShowApproval(false)}
        loading={loading}
      />
    </div>
  );
}

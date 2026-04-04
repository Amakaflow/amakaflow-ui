import { ShieldCheck, Lock, Trash2 } from 'lucide-react';

export function PrivacyFooter() {
  return (
    <div className="rounded-xl border bg-muted/20 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Data protection badge */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="font-medium">Data Protection</span>
        </div>

        {/* Compliance statements */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="w-3.5 h-3.5 flex-shrink-0" />
          <span>GDPR-aware practices&nbsp;&bull;&nbsp;Encrypted in transit&nbsp;&bull;&nbsp;No data selling</span>
        </div>

        {/* Privacy policy link */}
        <a
          href="https://amakaflow.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Privacy policy
        </a>

        {/* Data deletion request */}
        <a
          href="mailto:support@amakaflow.com?subject=Data%20Deletion%20Request"
          className="flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Request data deletion
        </a>
      </div>
    </div>
  );
}

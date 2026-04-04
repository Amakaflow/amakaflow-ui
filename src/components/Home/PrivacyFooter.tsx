import { ShieldCheck } from 'lucide-react';

export function PrivacyFooter() {
  return (
    <div className="rounded-xl border bg-muted/20 px-4 py-4 flex gap-3 items-start">
      <ShieldCheck className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
      <p className="text-xs text-muted-foreground leading-relaxed">
        Your data is processed securely. Workout content is analyzed using AI (Anthropic Claude). We do not sell your data.
        You can request deletion of your data.{' '}
        <a
          href="https://amakaflow.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          See our privacy policy for details
        </a>
      </p>
    </div>
  );
}

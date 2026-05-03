import { AuditClient } from '@/components/AuditClient';
import { LogoutButton } from '@/components/LogoutButton';

export default function AuditPage() {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-background via-background to-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">AEO Diagnostic</div>
            <div className="text-[11px] text-muted-foreground -mt-0.5">
              LLM brand-visibility audit
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <AuditClient />
      </div>
    </main>
  );
}

import { PasswordForm } from '@/components/PasswordForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function Home() {
  return (
    <main className="min-h-dvh grid place-items-center p-4 bg-gradient-to-br from-background via-background to-muted/40">
      <div className="w-full max-w-[380px] space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">AEO Diagnostic</h1>
          <p className="text-sm text-muted-foreground">LLM brand-visibility audit</p>
        </div>
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sign in</CardTitle>
            <CardDescription className="text-xs">
              Enter the shared password to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

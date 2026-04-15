import { TooltipProvider } from "@/components/ui/tooltip";
import { AppTopbar } from "@/components/app-topbar";
import { NavProgress } from "@/components/nav-progress";
import { CommandPalette } from "@/components/command-palette";
import { PipelineProvider } from "@/context/pipeline-context";
import { GenerationProvider } from "@/context/generation-context";
import { AuditProvider } from "@/context/audit-context";
import { ViralScriptProvider } from "@/context/viral-script-context";
import { ClientDataProvider } from "@/context/client-data-context";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <TooltipProvider>
      <PipelineProvider>
        <GenerationProvider>
          <AuditProvider>
            <ViralScriptProvider>
              <ClientDataProvider>
                <div className="min-h-screen bg-warm-white">
                  <NavProgress />
                  <AppTopbar />
                  <CommandPalette />
                  <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
                </div>
              </ClientDataProvider>
            </ViralScriptProvider>
          </AuditProvider>
        </GenerationProvider>
      </PipelineProvider>
    </TooltipProvider>
  );
}

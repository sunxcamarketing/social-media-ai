import { TooltipProvider } from "@/components/ui/tooltip";
import { AppTopbar } from "@/components/app-topbar";
import { AppSidebar } from "@/components/app-sidebar";
import { NavProgress } from "@/components/nav-progress";
import { CommandPalette } from "@/components/command-palette";
import { MobileNavProvider } from "@/components/mobile-nav-context";
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
                <MobileNavProvider>
                  <div className="min-h-screen bg-warm-white flex">
                    <NavProgress />
                    <CommandPalette />
                    <AppSidebar />
                    <div className="flex-1 min-w-0 flex flex-col">
                      <AppTopbar />
                      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 md:px-8 py-6 md:py-8">{children}</main>
                    </div>
                  </div>
                </MobileNavProvider>
              </ClientDataProvider>
            </ViralScriptProvider>
          </AuditProvider>
        </GenerationProvider>
      </PipelineProvider>
    </TooltipProvider>
  );
}

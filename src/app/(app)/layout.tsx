import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TopBar } from "@/components/top-bar";
import { PipelineProvider } from "@/context/pipeline-context";
import { GenerationProvider } from "@/context/generation-context";
import { AuditProvider } from "@/context/audit-context";

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
            <SidebarProvider>
              <AppSidebar />
              <main className="flex-1 overflow-auto min-h-screen">
                <TopBar />
                <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
              </main>
            </SidebarProvider>
          </AuditProvider>
        </GenerationProvider>
      </PipelineProvider>
    </TooltipProvider>
  );
}

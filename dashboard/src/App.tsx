import { useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { AppSidebar } from "@/components/app-sidebar";
import { ModeToggle } from "@/components/theme";
import { useRoute, type Route } from "@/lib/router";
import { CONFIG } from "@/lib/metrics";
import { OverviewPage } from "@/pages/overview";
import { ApplicationsPage } from "@/pages/applications";
import { InsightsPage } from "@/pages/insights";
import { EvalOverviewPage } from "@/pages/eval-overview";
import { EvalReviewPage } from "@/pages/eval-review";
import { EvalChecksPage } from "@/pages/eval-checks";
import { EvalStoriesPage } from "@/pages/eval-stories";
import { EvalGuidePage } from "@/pages/eval-guide";

const TITLES: Record<Route["page"], [string, string]> = {
  overview: ["Job search", "Overview"],
  applications: ["Job search", "Applications"],
  insights: ["Job search", "Insights"],
  "eval-overview": ["Evaluations", "Summary"],
  "eval-review": ["Evaluations", "Review queue"],
  "eval-checks": ["Evaluations", "Checks"],
  "eval-stories": ["Evaluations", "Stories"],
  "eval-guide": ["Evaluations", "Rubric"],
};

function Page({ route }: { route: Route }) {
  switch (route.page) {
    case "overview": return <OverviewPage />;
    case "applications": return <ApplicationsPage />;
    case "insights": return <InsightsPage />;
    case "eval-overview": return <EvalOverviewPage />;
    case "eval-review": return <EvalReviewPage id={route.id} />;
    case "eval-checks": return <EvalChecksPage />;
    case "eval-stories": return <EvalStoriesPage />;
    case "eval-guide": return <EvalGuidePage />;
  }
}

export default function App() {
  const route = useRoute();
  const [section, title] = TITLES[route.page];
  useEffect(() => {
    document.title = `${title} · ${CONFIG.title}${CONFIG.demo ? " (demo)" : ""}`;
  }, [title]);
  return (
    <SidebarProvider>
      <AppSidebar route={route} />
      <SidebarInset className="min-w-0">
        <header className="bg-background/80 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur md:rounded-t-xl md:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <Breadcrumb className="min-w-0 flex-1">
            <BreadcrumbList>
              <BreadcrumbItem className="hidden sm:block">
                <BreadcrumbLink href={route.page.startsWith("eval") ? "#/evaluations" : "#/overview"}>{section}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="truncate">{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <ModeToggle />
        </header>
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4 md:p-6">
          <Page route={route} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { useEffect } from "react";
import { BookOpenText, Briefcase, ChartColumnBig, ClipboardCheck, LayoutDashboard, Library, ListChecks, ShieldAlert, Sparkles, type LucideIcon } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { href, type Route } from "@/lib/router";
import { APPLICATIONS, CONFIG, GENERATED_AT } from "@/lib/metrics";
import { RECORDS, humanScores, latestByRecord, useScores } from "@/lib/evals";

type Item = { title: string; route: Route; icon: LucideIcon; badge?: number | string };

function builtOn() {
  try {
    return new Date(GENERATED_AT).toLocaleString(CONFIG.locale, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return GENERATED_AT;
  }
}

export function AppSidebar({ route }: { route: Route }) {
  const { data } = useScores();
  const scored = latestByRecord(humanScores(data)).size;
  const failing = RECORDS.filter((r) => r.checks && !r.checks.ok).length;
  const toFinish = APPLICATIONS.filter((c) => c.status === "to_finish").length;
  const { setOpenMobile } = useSidebar();
  // Any navigation (link, back button, deep link) closes the phone drawer.
  useEffect(() => setOpenMobile(false), [route, setOpenMobile]);

  const job: Item[] = [
    { title: "Overview", route: { page: "overview" }, icon: LayoutDashboard },
    { title: "Applications", route: { page: "applications" }, icon: Briefcase, badge: toFinish || undefined },
    { title: "Insights", route: { page: "insights" }, icon: ChartColumnBig },
  ];
  const evals: Item[] = [
    { title: "Summary", route: { page: "eval-overview" }, icon: Sparkles },
    { title: "Review queue", route: { page: "eval-review" }, icon: ClipboardCheck, badge: RECORDS.length - scored || undefined },
    { title: "Checks", route: { page: "eval-checks" }, icon: ShieldAlert, badge: failing || undefined },
    { title: "Stories", route: { page: "eval-stories" }, icon: Library },
    { title: "Rubric", route: { page: "eval-guide" }, icon: BookOpenText },
  ];

  const group = (label: string, items: Item[]) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((it) => (
          <SidebarMenuItem key={it.title}>
            <SidebarMenuButton asChild isActive={route.page === it.route.page} tooltip={it.title}>
              <a href={href(it.route)} onClick={() => setOpenMobile(false)}>
                <it.icon />
                <span>{it.title}</span>
              </a>
            </SidebarMenuButton>
            {it.badge != null && <SidebarMenuBadge className="tabular">{it.badge}</SidebarMenuBadge>}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#/overview">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <ListChecks className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Job Scout</span>
                  <span className="text-muted-foreground truncate text-xs">{CONFIG.title}</span>
                </div>
                {CONFIG.demo && <Badge variant="secondary" className="shrink-0">Demo data</Badge>}
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {group("Job search", job)}
        {group("Evaluations", evals)}
      </SidebarContent>
      <SidebarFooter>
        <p className="text-muted-foreground px-2 pb-1 text-xs group-data-[collapsible=icon]:hidden">
          Data built {builtOn()}
          {CONFIG.demo && (
            <>
              <br />
              Fictional demo from <code>dashboard/demo/</code>
            </>
          )}
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

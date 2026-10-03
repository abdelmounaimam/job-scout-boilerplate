import { useEffect, useState } from "react";

/** Hash routing: the dashboard is a static bundle behind HTTP Basic auth, so a
 *  hash keeps deep links (#/evaluations/review/<id>) working without any server
 *  rewrite, and the phone's back button walks the history. */
export type Route =
  | { page: "overview" }
  | { page: "applications" }
  | { page: "insights" }
  | { page: "eval-overview" }
  | { page: "eval-review"; id?: string }
  | { page: "eval-checks" }
  | { page: "eval-stories" }
  | { page: "eval-guide" };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const [a, b, c] = parts;
  if (a === "applications") return { page: "applications" };
  if (a === "insights") return { page: "insights" };
  // Old link from the previous dashboard (#evaluations) lands on the evaluation overview.
  if (a === "evaluations") {
    if (b === "review") return { page: "eval-review", id: c };
    if (b === "checks") return { page: "eval-checks" };
    if (b === "stories") return { page: "eval-stories" };
    if (b === "guide") return { page: "eval-guide" };
    return { page: "eval-overview" };
  }
  return { page: "overview" };
}

export function href(r: Route): string {
  switch (r.page) {
    case "overview": return "#/overview";
    case "applications": return "#/applications";
    case "insights": return "#/insights";
    case "eval-overview": return "#/evaluations";
    case "eval-review": return r.id ? `#/evaluations/review/${encodeURIComponent(r.id)}` : "#/evaluations/review";
    case "eval-checks": return "#/evaluations/checks";
    case "eval-stories": return "#/evaluations/stories";
    case "eval-guide": return "#/evaluations/guide";
  }
}

export const navigate = (r: Route) => { window.location.hash = href(r); };

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => { setRoute(parse(window.location.hash)); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

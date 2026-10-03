import { Bot, Cpu, RefreshCw, UserCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AXES } from "@/lib/evals";

const LAYERS = [
  { icon: Cpu, title: "1. Deterministic checks", body: "evals/check.mjs runs on every text before you see it, and blocks it on failure: no dash punctuation, posting language, length limit, no written form of your current salary, the real notice period, every claim and number traced to the story catalogue, at least one posting line quoted. Every input comes from WRITING and CANDIDATE in profile/profile.mjs." },
  { icon: UserCheck, title: "2. Your scores", body: "Six axes from 1 to 5, a comment and an optional rewrite. Your rewrites become reference examples, your low scores become written rules." },
  { icon: Bot, title: "3. Calibrated judge (later)", body: "Same rubric, blind, written with rater = judge. Trusted only on the axes where it agrees with you on texts it never saw, and never on truth: only you know what you did." },
];

const LOOP = [
  "The agent writes a draft, records it with its stories, claims and angle, and runs the checks.",
  "You approve or edit it; what actually went out is stored next to the draft.",
  "You score it here whenever you want. tools/pull-scores.sh copies the scores into evals/scores.jsonl.",
  "Low scores become rules in applications/answers-bank.md, CLAUDE.md or the known don'ts of profile/stories.md; 5/5 texts and rewrites become examples reread before writing.",
];

export function EvalGuidePage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rubric</h1>
        <p className="text-muted-foreground text-sm">How a free-form text is judged, and how the scores flow back into the next texts.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {AXES.map((a, i) => (
          <Card key={a.key}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="tabular">{i + 1}</Badge>
                <CardTitle>{a.name}</CardTitle>
              </div>
              <CardDescription>{a.hint}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {LAYERS.map((l) => (
          <Card key={l.title}>
            <CardHeader>
              <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg"><l.icon className="size-4" /></span>
              <CardTitle className="pt-1">{l.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm leading-relaxed">{l.body}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><RefreshCw className="size-4" /> The loop</CardTitle>
          <CardDescription>Outcomes (interview, rejection) stay a secondary signal: n is small and rejections rarely give a reason.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3">
            {LOOP.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </>
  );
}

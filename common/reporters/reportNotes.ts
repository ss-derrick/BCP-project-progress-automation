// Builds the "Human Action Required" and "Open Gaps / Limitations" tables of
// the Test Execution Report AUTOMATICALLY, on every run, from:
//   1. what happened in the run (skips, environment problems, failures)
//   2. what each test declares it does NOT cover (testCase({ gaps, manual }))
//   3. hand-written items in report-notes/ (kept, listed first)
// Rules below were written from exploring both portals (18-19 Nov 2026).

export interface HumanAction {
  id: string;
  module: string;
  title: string;
  reason: string;
  recommended_handling: string;
}

export interface Gap {
  id: string;
  status: string;
  description: string;
  impact: string;
}

export interface RunResult { id: string; status: string; notes?: string }
export interface LibraryEntry { id: string; title: string; module?: string }
export interface Declared {
  id: string;
  gaps: { description: string; impact: string }[];
  manual: { title: string; reason: string; handling: string }[];
}

// Skips that only mean "not this portal's scenario": nothing to do
const NOT_APPLICABLE = /^(Not verified on |Applicable for .+ only)|is not a host of/;

// Skip reason -> what a person should do
const SKIP_RULES: { match: RegExp; handling: (m: RegExpMatchArray) => string }[] = [
  {
    match: /Archive data can only be viewed between (\d{1,2}:\d{2}) and (\d{1,2}:\d{2})/,
    handling: (m) => `Re-run this test between ${m[1]} and ${m[2]} (the archive is closed outside that window), or check it by hand then.`
  },
  {
    match: /^No credit settlement on/,
    handling: () => 'Re-run after at least one credit settlement exists for today on this environment.'
  },
  {
    match: /No existing MID recorded/,
    handling: () => 'Add a MID that already exists on this environment to common/testdata/existingMids.ts, then re-run.'
  }
];

// Failure message -> environment problem a person must fix (not a product defect)
const ENV_FAILURES: { match: RegExp; reason: string; handling: string }[] = [
  {
    match: /net::ERR_|ECONNREFUSED|ECONNRESET|ETIMEDOUT/,
    reason: 'The portal could not be reached',
    handling: 'Check the portal server / VPN is up, then re-run.'
  },
  {
    match: /logged out|error=concurrent|Auto Logged Out/i,
    reason: 'The session was logged out: the same account was used elsewhere during the run',
    handling: 'Make sure nobody else uses this account during the run (one session per user), then re-run.'
  },
  {
    match: /HUMAN ACTION REQUIRED/,
    reason: 'No login account for this environment',
    handling: 'Fill in the USERNAME / PASSWORD of this environment in .env, then re-run.'
  }
];

export function buildNotes(
  library: LibraryEntry[],
  results: RunResult[],
  declared: Declared[],
  manualActions: HumanAction[] = [],
  manualGaps: Gap[] = []
): { humanActions: HumanAction[]; gaps: Gap[] } {
  const info = new Map(library.map((e) => [e.id, e]));
  const humanActions: HumanAction[] = [...manualActions];
  const gaps: Gap[] = [...manualGaps];
  const seen = new Set<string>();
  const once = (key: string) => (seen.has(key) ? false : (seen.add(key), true));

  // 1. what happened in this run
  for (const r of results) {
    const t = info.get(r.id);
    const base = { id: r.id, module: t?.module ?? '', title: t?.title ?? r.id };
    const notes = (r.notes ?? '').trim();

    if (r.status === 'skipped') {
      if (NOT_APPLICABLE.test(notes)) continue;
      const rule = SKIP_RULES.map((s) => ({ s, m: notes.match(s.match) })).find((x) => x.m);
      humanActions.push({
        ...base,
        reason: `Skipped: ${notes || 'no reason given'}`,
        recommended_handling: rule ? rule.s.handling(rule.m!) : 'Check why it was skipped; test it by hand or fix the test data, then re-run.'
      });
    } else if (r.status === 'blocked-env') {
      humanActions.push({ ...base, reason: `Blocked by the environment: ${notes}`, recommended_handling: 'Check network / firewall access to the portal, then re-run.' });
    } else if (r.status === 'not-run') {
      humanActions.push({ ...base, reason: notes || 'Not run', recommended_handling: 'Re-run the test.' });
    } else if (r.status === 'fail') {
      const env = ENV_FAILURES.find((e) => e.match.test(notes));
      if (env) {
        humanActions.push({ ...base, reason: `${env.reason}: ${notes}`, recommended_handling: env.handling });
      } else {
        gaps.push({
          id: `GAP-${r.id}`,
          status: 'Open',
          description: `${base.title} failed: ${notes || 'see the report'}`,
          impact: 'Not verified on this run. Investigate: product defect or test issue. Closes when the test passes again.'
        });
      }
    }
  }

  // 2. what the tests declare they don't cover (same text once only)
  for (const d of declared) {
    const t = info.get(d.id);
    for (const m of d.manual) {
      if (!once(`m:${m.title}`)) continue;
      humanActions.push({ id: d.id, module: t?.module ?? '', title: m.title, reason: m.reason, recommended_handling: m.handling });
    }
    d.gaps.forEach((g) => {
      if (!once(`g:${g.description}`)) return;
      gaps.push({ id: `GAP-${d.id}`, status: 'Known limitation', description: g.description, impact: g.impact });
    });
  }

  // number duplicate gap ids: GAP-TC-CS-001, GAP-TC-CS-001-2, ...
  const count = new Map<string, number>();
  for (const g of gaps) {
    const n = (count.get(g.id) ?? 0) + 1;
    count.set(g.id, n);
    if (n > 1) g.id = `${g.id}-${n}`;
  }

  return { humanActions, gaps };
}

// robots.txt, read the way the search engines read it.
//
// The rule that applies to a path is the longest matching one (Allow wins a
// tie), a group is chosen by the closest User-agent line (ours, else `*`),
// several groups for the same agent add up, `*` and `$` in a pattern mean
// what they mean in Google's grammar. A shop that says nothing allows
// everything; a shop whose robots.txt cannot be fetched because its server
// is down is not read at all this pass — silence and failure are different.

import { JobError } from './errors.ts';
import type { Fetcher, Robots } from './types.ts';

export interface RobotsGroup {
  agents: string[];
  allow: string[];
  disallow: string[];
  crawlDelay: number | null;
}

export function parseRobots(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], allow: [], disallow: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === 'allow') current.allow.push(value);
    else if (field === 'disallow') current.disallow.push(value);
    else if (field === 'crawl-delay') {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds > 0) current.crawlDelay = seconds;
    }
  }
  return groups;
}

interface Rule {
  allow: boolean;
  pattern: string;
  regex: RegExp;
}

function toRegex(pattern: string): RegExp {
  const escaped = pattern
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  const anchored = escaped.endsWith('$') ? escaped.slice(0, -1) + '$' : escaped;
  return new RegExp('^' + anchored);
}

export function rulesFor(groups: RobotsGroup[], agentToken: string): { rules: Rule[]; crawlDelay: number | null } {
  const token = agentToken.toLowerCase();
  const ours = groups.filter((g) => g.agents.some((a) => a !== '*' && (token.includes(a) || a.includes(token))));
  const chosen = ours.length > 0 ? ours : groups.filter((g) => g.agents.includes('*'));
  const rules: Rule[] = [];
  let crawlDelay: number | null = null;
  for (const group of chosen) {
    for (const pattern of group.allow) if (pattern) rules.push({ allow: true, pattern, regex: toRegex(pattern) });
    for (const pattern of group.disallow) if (pattern) rules.push({ allow: false, pattern, regex: toRegex(pattern) });
    if (group.crawlDelay !== null) crawlDelay = Math.max(crawlDelay ?? 0, group.crawlDelay);
  }
  return { rules, crawlDelay };
}

export function isAllowed(rules: Rule[], path: string): boolean {
  let best: Rule | null = null;
  for (const rule of rules) {
    if (!rule.regex.test(path)) continue;
    if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}

export function robotsFrom(text: string, agentToken: string): Robots {
  const { rules, crawlDelay } = rulesFor(parseRobots(text), agentToken);
  return {
    allows: (path) => isAllowed(rules, path.startsWith('/') ? path : '/' + path),
    crawlDelayMs: crawlDelay === null ? null : Math.min(crawlDelay, 60) * 1000,
  };
}

export async function loadRobots(fetcher: Fetcher, baseUrl: string, agentToken: string): Promise<Robots> {
  const url = new URL('/robots.txt', baseUrl).toString();
  const result = await fetcher.get(url, { accept: 'text/plain, */*;q=0.5' });
  if (result.status >= 500) throw new JobError('robots_unavailable');
  if (!result.ok) return robotsFrom('', agentToken);
  return robotsFrom(result.text, agentToken);
}

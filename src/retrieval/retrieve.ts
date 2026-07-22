import { createHash } from 'node:crypto';
import { resolve4, resolve6 } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export interface RetrievedSource {
  url: string;
  title: string;
  publisher: string;
  text: string;
  contentHash: string;
  retrievedAt: string;
}

const privateIpv4 = /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
const privateIpv6 = /^(::1$|fc|fd|fe8|fe9|fea|feb)/i;

const trustedIndependentHosts = [
  'outdoorgearlab.com', 'www.outdoorgearlab.com',
  'rei.com', 'www.rei.com',
  'reddit.com', 'www.reddit.com',
  'trailspace.com', 'www.trailspace.com',
  'switchbacktravel.com', 'www.switchbacktravel.com',
  'runnersworld.com', 'www.runnersworld.com',
  'runrepeat.com', 'www.runrepeat.com',
  't3.com', 'www.t3.com',
  'theguardian.com', 'www.theguardian.com',
  'gearjunkie.com', 'www.gearjunkie.com',
  'outdoorx4.com', 'www.outdoorx4.com',
  'roadtrailrun.com', 'www.roadtrailrun.com',
  'cyclingweekly.com', 'www.cyclingweekly.com',
  'sectionhiker.com', 'www.sectionhiker.com',
  'cleverhiker.com', 'www.cleverhiker.com',
  'outdoorguru.com', 'www.outdoorguru.com',
  'outdoorlife.com', 'www.outdoorlife.com',
  'treelinereview.com', 'www.treelinereview.com',
  'bikepacking.com', 'www.bikepacking.com'
];

function allowedHosts(): Set<string> {
  const hosts = new Set(trustedIndependentHosts);
  for (const host of (process.env.SOURCE_HOST_ALLOWLIST ?? '').split(',')) {
    if (host.trim()) hosts.add(host.trim().toLowerCase());
  }
  return hosts;
}

export function validateSourceUrl(rawUrl: string, manufacturerUrl?: string | null): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') throw new Error('Only HTTPS sources are allowed');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || privateIpv4.test(host) || isIP(host) !== 0) throw new Error('IP and private-network sources are not allowed');
  const allowlist = allowedHosts();
  if (manufacturerUrl) allowlist.add(new URL(manufacturerUrl).hostname.toLowerCase());
  if (!allowlist.has(host)) throw new Error(`Source host is not allowlisted: ${host}`);
  url.username = '';
  url.password = '';
  url.hash = '';
  return url;
}

export async function retrieveSource(rawUrl: string, manufacturerUrl?: string | null): Promise<RetrievedSource> {
  const url = validateSourceUrl(rawUrl, manufacturerUrl);
  const addresses = [...await resolve4(url.hostname).catch(() => []), ...await resolve6(url.hostname).catch(() => [])];
  if (!addresses.length) throw new Error('Source hostname could not be resolved');
  if (addresses.some((address) => privateIpv4.test(address) || privateIpv6.test(address))) {
    throw new Error('Source hostname resolves to a private network');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'error',
      headers: { 'User-Agent': 'TrailGenic-Gear-Intelligence/2.0 (+https://www.trailgenic.com)' }
    });
    if (!response.ok) throw new Error(`Source retrieval failed (${response.status})`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) throw new Error(`Unsupported source content type: ${contentType}`);
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > 2_000_000) throw new Error('Source exceeds the 2 MB retrieval limit');
    const html = await response.text();
    if (html.length > 2_000_000) throw new Error('Source exceeds the 2 MB retrieval limit');
    const dom = new JSDOM(html, { url: url.toString() });
    const article = new Readability(dom.window.document).parse();
    const text = (article?.textContent ?? dom.window.document.body?.textContent ?? '')
      .replace(/\s+/g, ' ').trim().slice(0, 40_000);
    if (text.length < 200) throw new Error('Source did not contain enough readable text');
    return {
      url: url.toString(),
      title: (article?.title ?? dom.window.document.title ?? url.hostname).slice(0, 500),
      publisher: url.hostname.replace(/^www\./, ''),
      text,
      contentHash: createHash('sha256').update(text).digest('hex'),
      retrievedAt: new Date().toISOString()
    };
  } finally {
    clearTimeout(timeout);
  }
}

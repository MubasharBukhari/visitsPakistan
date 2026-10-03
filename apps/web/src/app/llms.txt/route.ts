import { absoluteUrl } from '../../lib/destination-seo';
export function GET() {
  return new Response(
    `# VisitsPakistan

> Discover Pakistan through canonical geographic knowledge and published, sourced editorial content.

Travel information is verified per entity and editorial revision. Check each destination's sources and verification date; missing facts are unavailable.

## Destinations

- [Destination directory](${absoluteUrl('/destinations/')}): Browse published destinations and geographic filters.
- [Things to do](${absoluteUrl('/things-to-do/')}): Browse published attractions and independent experience concepts.
- [Published travel sitemap](${absoluteUrl('/sitemap.xml')}): Canonical URLs for public destinations, attractions and experience concepts.
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
}

import type { MetadataRoute } from 'next';
import { absoluteUrl } from '../lib/destination-seo';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/health/', '/ready/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}

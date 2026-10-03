import type { ReactNode } from 'react';
import PublicDiscoveryLayout from '../../components/public-discovery-layout';
export default function Layout({ children }: { children: ReactNode }) {
  return <PublicDiscoveryLayout>{children}</PublicDiscoveryLayout>;
}

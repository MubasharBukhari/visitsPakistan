'use client';
import Link, { useLinkStatus } from 'next/link';
import type { ReactNode } from 'react';
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span className="destination-link-pending" role="status">
      Loading destination…
    </span>
  ) : null;
}
export function DestinationLink({
  href,
  children,
  className,
  ariaLabel,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Link href={href} className={className} aria-label={ariaLabel}>
      {children}
      <Pending />
    </Link>
  );
}

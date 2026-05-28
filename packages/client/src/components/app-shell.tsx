import type { ReactNode } from 'react';
import PartyMap from '../features/party-map/party-map';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <>
      {children}
      <PartyMap />
    </>
  );
}

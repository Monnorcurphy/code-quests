import type { ReactNode } from 'react';
import PartyMap from '../features/party-map/party-map';
import SceneMoodIndicator from '../audio/visual-cues/scene-mood-indicator';
import PauseBellFlash from '../audio/visual-cues/pause-bell-flash';
import StingerToast from '../audio/visual-cues/stinger-toast';
import AriaAnnouncer from '../audio/visual-cues/aria-announcer';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <>
      {children}
      <PartyMap />
      <SceneMoodIndicator />
      <PauseBellFlash />
      <StingerToast />
      <AriaAnnouncer />
    </>
  );
}

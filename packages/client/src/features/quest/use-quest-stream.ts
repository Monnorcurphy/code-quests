import { useEffect, useState } from 'react';
import { connectQuestSocket } from '../../lib/quest-socket';
import { useQuestStore } from '../../stores/quest-store';
import { sceneRouter } from '../../game/scene-router';
import type { ConnectionStatus } from '../../lib/quest-socket';

export type { ConnectionStatus };

export interface QuestStreamResult {
  status: ConnectionStatus;
  parseError: string | null;
}

export function useQuestStream(questId: string): QuestStreamResult {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    const handle = connectQuestSocket(questId, {
      onConnectionChange: setStatus,
      onParseError: (msg) => setParseError(msg),
      onEvent: (event) => {
        const store = useQuestStore.getState();
        store.appendEvent(questId, event);

        if (event.type === 'scene_change') {
          store.setCurrentScene(questId, event.to);
          sceneRouter.goToScene(event.to);
        }

        if (event.type === 'status_change') {
          store.setStatus(questId, event.to);
        }
      },
    });

    return () => handle.close();
  }, [questId]);

  return { status, parseError };
}

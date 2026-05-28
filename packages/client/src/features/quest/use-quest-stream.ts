import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectQuestSocket } from '../../lib/quest-socket';
import { useQuestStore } from '../../stores/quest-store';
import { useEncounterStore } from '../../stores/encounter-store';
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
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  useEffect(() => {
    setParseError(null);
    const handle = connectQuestSocket(questId, {
      onConnectionChange: setStatus,
      onParseError: (msg) => setParseError(msg),
      onEvent: (event) => {
        setParseError(null);
        const store = useQuestStore.getState();
        store.appendEvent(questId, event);
        useEncounterStore.getState().handleAgentEvent(questId, event);

        if (event.type === 'scene_change') {
          store.setCurrentScene(questId, event.to);
          sceneRouter.goToScene(event.to);
        }

        if (event.type === 'status_change') {
          store.setStatus(questId, event.to);
        }

        if (event.type === 'completed') {
          store.setStatus(questId, 'complete');
          void queryClientRef.current.invalidateQueries({ queryKey: ['quest', questId] });
        }

        if (event.type === 'failed') {
          store.setStatus(questId, 'failed');
          void queryClientRef.current.invalidateQueries({ queryKey: ['quest', questId] });
        }
      },
    });

    return () => handle.close();
  }, [questId]);

  return { status, parseError };
}

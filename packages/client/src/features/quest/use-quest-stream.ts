import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectQuestSocket } from '../../lib/quest-socket';
import { useQuestStore } from '../../stores/quest-store';
import { useEncounterStore } from '../../stores/encounter-store';
import { sceneRouter } from '../../game/scene-router';
import { api } from '../../lib/api';
import type { ConnectionStatus } from '../../lib/quest-socket';

export type { ConnectionStatus };

export interface QuestStreamResult {
  status: ConnectionStatus;
  parseError: string | null;
}

export async function rehydrateEncounterOnReconnect(questId: string): Promise<void> {
  try {
    const encounters = await api.monsters.listQuestEncounters(questId);
    if (encounters.length === 0) return;

    const latest = encounters[encounters.length - 1];
    const storeEncounter = useEncounterStore.getState().byQuest[questId];
    const isResolved = latest.resolvedAt != null;

    if (!isResolved) {
      // Server has an active encounter the client doesn't know about — synthesize monster_appeared
      if (
        (!storeEncounter || storeEncounter.encounterId !== latest.id) &&
        latest.monsterName !== undefined &&
        latest.monsterTypeId !== undefined &&
        latest.spritePath !== undefined &&
        latest.difficulty !== undefined
      ) {
        useEncounterStore.getState().handleAgentEvent(questId, {
          type: 'monster_appeared',
          timestamp: latest.appearedAt,
          encounterId: latest.id,
          monsterId: latest.monsterId,
          monsterName: latest.monsterName,
          monsterTypeId: latest.monsterTypeId,
          spritePath: latest.spritePath,
          difficulty: latest.difficulty as 1 | 2 | 3 | 4 | 5,
        });
      }
    } else if (
      storeEncounter?.outcome === 'pending' &&
      storeEncounter.encounterId === latest.id
    ) {
      // Server resolved an encounter the client still has as pending
      useEncounterStore.getState().handleAgentEvent(questId, {
        type: 'monster_resolved',
        timestamp: new Date().toISOString(),
        encounterId: latest.id,
        outcome: latest.outcome,
      });
    }
  } catch {
    // Best-effort — API errors during reconnect are silently ignored
  }
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
      onConnectionChange: (s) => {
        setStatus(s);
        if (s === 'connected') {
          void rehydrateEncounterOnReconnect(questId);
        }
      },
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

        if (event.type === 'monster_appeared') {
          void queryClientRef.current.invalidateQueries({ queryKey: ['monsters'] });
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

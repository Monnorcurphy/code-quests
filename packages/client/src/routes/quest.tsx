import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import HUDOverlay from '../features/quest/hud-overlay';
import ChatDock from '../features/quest/chat-dock';
import { useQuestStream } from '../features/quest/use-quest-stream';
import { sceneRouter } from '../game/scene-router';
import { useQuestStore } from '../stores/quest-store';
import { api, ApiError } from '../lib/api';
import type { SceneKey } from '../game/scene-registry';
import type { QuestSceneKey } from '@code-quests/shared';

const PhaserMount = lazy(() => import('../game/phaser-mount'));

function EmptyState({ is404 }: { is404: boolean }) {
  const navigate = useNavigate();
  return (
    <main
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
      }}
      aria-live="polite"
    >
      <p className="text-gray-700">
        {is404
          ? 'Quest not found — return to town'
          : 'Could not load quest. Make sure the server is running.'}
      </p>
      <button
        onClick={() => navigate('/town/town-square')}
        className="text-gray-700"
        style={{
          padding: '8px 16px',
          border: '1px solid currentColor',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Return to Town
      </button>
    </main>
  );
}

export default function QuestRoute() {
  const { questId } = useParams<{ questId: string }>();
  const queryClient = useQueryClient();

  const [advanceError, setAdvanceError] = useState<string | null>(null);

  const {
    data: quest,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['quest', questId],
    queryFn: () => api.quests.get(questId!),
    enabled: !!questId,
  });

  const { status: connectionStatus, parseError } = useQuestStream(questId ?? '');

  const advanceMutation = useMutation({
    mutationFn: ({ expectedFrom }: { expectedFrom: QuestSceneKey; toScene: QuestSceneKey }) =>
      api.quests.advanceScene(questId!, expectedFrom),
    onSuccess: (_data, variables) => {
      sceneRouter.goToScene(variables.toScene);
      void queryClient.invalidateQueries({ queryKey: ['quest', questId] });
      setAdvanceError(null);
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : 'Failed to advance scene';
      setAdvanceError(msg);
    },
  });

  const handleSceneAdvance = useCallback(
    ({ fromScene, toScene }: { fromScene: QuestSceneKey; toScene: QuestSceneKey }) => {
      setAdvanceError(null);
      advanceMutation.mutate({ expectedFrom: fromScene, toScene });
    },
    [advanceMutation.mutate],
  );

  useEffect(() => {
    return sceneRouter.onSceneAdvance(handleSceneAdvance);
  }, [handleSceneAdvance]);

  useEffect(() => {
    if (!quest || !questId) return;
    const store = useQuestStore.getState();
    store.setStatus(questId, quest.status);
    if (quest.inputRequest) {
      store.setInputRequest(questId, quest.inputRequest);
    } else {
      store.clearInputRequest(questId);
    }
    if (quest.userBlocker) {
      store.setUserBlocker(questId, quest.userBlocker);
    } else {
      store.clearUserBlocker(questId);
    }
  }, [quest, questId]);

  if (isLoading) {
    return (
      <main
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p aria-live="polite" className="text-gray-700">
          Loading quest…
        </p>
      </main>
    );
  }

  const is404 = error instanceof ApiError && error.status === 404;
  if (isError || !quest) {
    return <EmptyState is404={is404} />;
  }

  return (
    <main style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <HUDOverlay
        quest={quest}
        questId={questId!}
        advanceLoading={advanceMutation.isPending}
        advanceError={advanceError}
        connectionStatus={connectionStatus}
        parseError={parseError}
      />
      <Suspense fallback={null}>
        <PhaserMount initialScene={quest.currentScene as SceneKey} questId={questId} />
      </Suspense>
      <ChatDock questId={questId!} modelId={quest.modelId} />
    </main>
  );
}

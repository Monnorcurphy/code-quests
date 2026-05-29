import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import BestiaryEmptyState from './empty-state';
import MonsterDetail from './monster-detail';
import { DifficultyStars } from './difficulty-stars';
import CoinMonsterTypeModal from './coin-monster-type-modal';
import type { Monster, MonsterType, MonsterScope } from '@code-quests/shared';

type SortCol = 'name' | 'type' | 'difficulty' | 'encounters' | 'defeats' | 'escapes' | 'lastSeen';
type SortDir = 'asc' | 'desc';

function sortKey(m: Monster, col: SortCol, types: MonsterType[]): string | number {
  switch (col) {
    case 'name': return m.name.toLowerCase();
    case 'type': return (types.find((t) => t.id === m.typeId)?.name ?? m.typeId).toLowerCase();
    case 'difficulty': return m.calibratedDifficulty;
    case 'encounters': return m.encounters;
    case 'defeats': return m.defeats;
    case 'escapes': return m.escapes;
    case 'lastSeen': return m.lastSeenAt;
  }
}

function SortHeader({
  col, current, dir, onSort, children,
}: {
  col: SortCol; current: SortCol; dir: SortDir;
  onSort: (col: SortCol) => void; children: React.ReactNode;
}) {
  const isActive = col === current;
  const ariaSort = isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th scope="col" aria-sort={ariaSort}>
      <button
        type="button"
        className={`bestiary-sort-btn${isActive ? ' bestiary-sort-btn--active' : ''}`}
        onClick={() => onSort(col)}
      >
        {children}
        {isActive && <span aria-hidden="true">{dir === 'asc' ? ' ↑' : ' ↓'}</span>}
      </button>
    </th>
  );
}

function SkeletonCell() {
  return <td className="bestiary-cell"><span className="bestiary-skeleton-cell" aria-hidden="true" /></td>;
}

function SkeletonTable() {
  return (
    <table className="bestiary-table" aria-label="Monster bestiary">
      <thead>
        <tr>
          <th scope="col"><span className="sr-only">Sprite</span></th>
          <th scope="col">Name</th>
          <th scope="col">Type</th>
          <th scope="col">Difficulty</th>
          <th scope="col">Enc.</th>
          <th scope="col">Def.</th>
          <th scope="col">Esc.</th>
          <th scope="col">Last Seen</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 3 }).map((_, i) => (
          <tr key={i} className="bestiary-row bestiary-row--skeleton" aria-hidden="true">
            <SkeletonCell />
            <SkeletonCell />
            <SkeletonCell />
            <SkeletonCell />
            <SkeletonCell />
            <SkeletonCell />
            <SkeletonCell />
            <SkeletonCell />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MonsterRow({
  monster, types, onSelect,
}: {
  monster: Monster; types: MonsterType[]; onSelect: () => void;
}) {
  const monsterType = types.find((t) => t.id === monster.typeId);
  const lastSeen = new Date(monster.lastSeenAt).toLocaleDateString();

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  }

  return (
    <tr
      className="bestiary-row"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      aria-label={`${monster.name} — view details`}
    >
      <td className="bestiary-cell bestiary-cell--sprite">
        {monsterType?.spritePath
          ? <img src={monsterType.spritePath} alt="" className="bestiary-sprite" />
          : <span className="bestiary-sprite-placeholder" aria-hidden="true">?</span>
        }
      </td>
      <td className="bestiary-cell bestiary-cell--name">{monster.name}</td>
      <td className="bestiary-cell">{monsterType?.name ?? monster.typeId}</td>
      <td className="bestiary-cell"><DifficultyStars value={monster.calibratedDifficulty} /></td>
      <td className="bestiary-cell bestiary-cell--num">{monster.encounters}</td>
      <td className="bestiary-cell bestiary-cell--num">{monster.defeats}</td>
      <td className="bestiary-cell bestiary-cell--num">{monster.escapes}</td>
      <td className="bestiary-cell">{lastSeen}</td>
    </tr>
  );
}

interface BestiaryProps {
  initialTypeFilter?: string | null;
}

export default function Bestiary({ initialTypeFilter }: BestiaryProps = {}) {
  const [sortCol, setSortCol] = useState<SortCol>('lastSeen');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeScope, setActiveScope] = useState<MonsterScope>('project');
  const [showCoinModal, setShowCoinModal] = useState(false);
  const coinButtonRef = useRef<HTMLButtonElement>(null);

  const {
    data: monsters,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['monsters', activeScope],
    queryFn: () => api.monsters.list({ scope: activeScope }),
  });

  const { data: types = [] } = useQuery({
    queryKey: ['monster-types'],
    queryFn: () => api.monsters.listTypes(),
  });

  const sortedMonsters = useMemo(() => {
    if (!monsters) return [];
    const filtered = initialTypeFilter
      ? monsters.filter((m) => m.typeId === initialTypeFilter)
      : monsters;
    return [...filtered].sort((a, b) => {
      const av = sortKey(a, sortCol, types);
      const bv = sortKey(b, sortCol, types);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [monsters, sortCol, sortDir, types, initialTypeFilter]);

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  if (selectedId && monsters) {
    const monster = monsters.find((m) => m.id === selectedId);
    if (monster) {
      return (
        <MonsterDetail
          monster={monster}
          monsterType={types.find((t) => t.id === monster.typeId)}
          onBack={() => setSelectedId(null)}
        />
      );
    }
  }

  const emptyLabel = activeScope === 'guild' ? 'No guild Nemeses yet.' : undefined;

  return (
    <>
    <div className="bestiary">
      {initialTypeFilter && (
        <p className="bestiary-type-filter-banner" role="status">
          Filtered by type: <strong>{types.find((t) => t.id === initialTypeFilter)?.name ?? initialTypeFilter}</strong>
        </p>
      )}
      <div className="bestiary-header">
        <div
          role="tablist"
          aria-label="Monster scope"
          className="bestiary-scope-tabs"
        >
        <button
          type="button"
          role="tab"
          aria-selected={activeScope === 'project'}
          className={`bestiary-scope-tab${activeScope === 'project' ? ' bestiary-scope-tab--active' : ''}`}
          onClick={() => { setActiveScope('project'); setSelectedId(null); }}
        >
          Mine (Project)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeScope === 'guild'}
          className={`bestiary-scope-tab${activeScope === 'guild' ? ' bestiary-scope-tab--active' : ''}`}
          onClick={() => { setActiveScope('guild'); setSelectedId(null); }}
        >
          Nemeses (Guild)
        </button>
        </div>
        <button
          ref={coinButtonRef}
          type="button"
          className="btn-secondary bestiary-coin-btn"
          onClick={() => setShowCoinModal(true)}
        >
          + Coin New Type
        </button>
      </div>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isLoading ? 'Loading bestiary…' : ''}
      </div>

      {isLoading && <SkeletonTable />}

      {isError && (
        <div role="alert" className="bestiary-error">
          <p>Could not load bestiary. Make sure the server is running.</p>
          <button type="button" className="btn-secondary" onClick={() => { void refetch(); }}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && monsters?.length === 0 && (
        emptyLabel
          ? (
            <div className="bestiary-empty" role="status">
              <p className="bestiary-empty-message">{emptyLabel}</p>
              <p className="bestiary-empty-hint">
                Open a monster from the &quot;Mine&quot; tab and click &quot;Mark as Nemesis&quot; to promote it.
              </p>
            </div>
          )
          : <BestiaryEmptyState />
      )}

      {!isLoading && !isError && monsters && monsters.length > 0 && (
        <div className="bestiary-table-wrap">
          <table className="bestiary-table" aria-label="Monster bestiary">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Sprite</span></th>
                <SortHeader col="name" current={sortCol} dir={sortDir} onSort={handleSort}>Name</SortHeader>
                <SortHeader col="type" current={sortCol} dir={sortDir} onSort={handleSort}>Type</SortHeader>
                <SortHeader col="difficulty" current={sortCol} dir={sortDir} onSort={handleSort}>Difficulty</SortHeader>
                <SortHeader col="encounters" current={sortCol} dir={sortDir} onSort={handleSort}>Enc.</SortHeader>
                <SortHeader col="defeats" current={sortCol} dir={sortDir} onSort={handleSort}>Def.</SortHeader>
                <SortHeader col="escapes" current={sortCol} dir={sortDir} onSort={handleSort}>Esc.</SortHeader>
                <SortHeader col="lastSeen" current={sortCol} dir={sortDir} onSort={handleSort}>Last Seen</SortHeader>
              </tr>
            </thead>
            <tbody>
              {sortedMonsters.map((m) => (
                <MonsterRow
                  key={m.id}
                  monster={m}
                  types={types}
                  onSelect={() => setSelectedId(m.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {showCoinModal && (
      <CoinMonsterTypeModal
        onClose={() => setShowCoinModal(false)}
        onSuccess={() => { /* queries invalidated inside modal */ }}
        triggerRef={coinButtonRef}
      />
    )}
    </>
  );
}

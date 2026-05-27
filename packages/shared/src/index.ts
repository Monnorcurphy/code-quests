export type QuestStatus = 'idle' | 'active' | 'complete' | 'failed';

export interface Quest {
  id: string;
  name: string;
  status: QuestStatus;
}

export interface Adventurer {
  id: string;
  name: string;
  level: number;
}

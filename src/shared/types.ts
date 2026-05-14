export interface Profile {
  name: string;
  email: string;
  picture: string;
  givenName: string;
}

export interface DashboardState {
  profile: Profile | null;
  completedTiles: string[];
  llmProvider: 'builtin';        // only option in v1
  defaults: {
    taskListId: string;
    taskListName: string;
    eventDurationMins: 30 | 60 | 90;
    timezone: string;
  };
  aiStatus: 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unknown';
}

export interface TaskList {
  id: string;
  title: string;
}

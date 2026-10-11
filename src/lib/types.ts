export type Lang = "en" | "he";

/** A task as held on the client: no body, just whether it has one. */
export type Task = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  done: boolean;
  doneAt: string | null;
  sortOrder: number;
  labelIds: string[];
  hasBody: boolean;
  isSample: boolean;
};

export type Label = {
  id: string;
  name: string;
  color: string;
  owner: string | null;
  startDate: string | null;
  endDate: string | null;
  isSample: boolean;
};

export type Settings = {
  language: Lang;
  showCompleted: boolean;
  seeded: boolean;
};

export type Attachment = {
  id: string;
  taskId: string;
  fileName: string;
  contentType: string;
  size: number;
  url: string;
};

export type InitialData = {
  tasks: Task[];
  labels: Label[];
  settings: Settings;
};

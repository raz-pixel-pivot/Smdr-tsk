export type Lang = "en" | "he";

/** What the current user may do with a task. */
export type Access = "owner" | "edit" | "view";
export type ShareRole = "view" | "edit";
export type Share = { email: string; role: ShareRole };

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
  access: Access;
  /** For tasks shared with me: the owner's email. */
  sharedBy: string | null;
  /** For my own tasks: who they're shared with. */
  sharedWith: Share[];
  /** My Google Calendar event for this task, if any. */
  calendarLink: string | null;
};

export type Label = {
  id: string;
  name: string;
  color: string;
  owner: string | null;
  ownerEmail: string | null;
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
  /** In-app address (requires access to the task). */
  url: string;
  /** Anyone-with-the-link address, when shared publicly. */
  publicUrl: string | null;
};

export type InitialData = {
  tasks: Task[];
  labels: Label[];
  settings: Settings;
};

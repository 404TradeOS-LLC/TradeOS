export interface AIQuestion {
  id?: string;
  text: string;
}

export interface AIAnswer {
  id?: string;
  text: string;
  timestamp?: string | null;
}

export interface AISuggestion {
  id?: string;
  text: string;
}

export interface AIConversationItem {
  id?: string;
  role: "assistant" | "user";
  title: string;
  text: string;
  meta?: string;
}


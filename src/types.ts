
export interface ProcessedData {
  dataTable: string;
  notifications: string[];
}

export interface FaultCode {
  errorCode: string;
  productLine?: string; // 'washing_machine', etc.
  sptoms?: string[];
  fix: string;
  successCount: number;
  lastVerified: string; // ISO Date
}

export interface KnowledgeItem {
  id: string; // Drive File ID or Exa ID
  title: string;
  url?: string; // If external (Exa)
  source: 'drive' | 'web';
  content?: string; // Text content if extracted? Or just base64 for Gemini
}

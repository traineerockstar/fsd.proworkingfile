
export interface ProcessedData {
  dataTable: string;
  notifications: string[];
}

export interface FaultCodeEntry {
  code: string;           // E.g. "E04"
  description: string;    // "Drain Timeout"
  solution: string;       // "Check filter..."
  productLine?: string;   // "WashingMachine-X"
  verified: boolean;      // Automated vs Manual
  source: 'manual' | 'ai_learned' | 'bulletin';
  timestamp: string;      // ISO Date
}

export interface KnowledgeDocument {
  id: string; // Drive File ID
  name: string;
  mimeType: string;
  webViewLink?: string;
  tags?: string[];
}

export interface KnowledgeItem {
  id: string; // Drive File ID or Exa ID
  title: string;
  url?: string; // If external (Exa)
  source: 'drive' | 'web';
  content?: string; // Text content if extracted? Or just base64 for Gemini
}


import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

import type { ProcessedData } from '../types';
import { searchKnowledgeBase } from './googleDriveService';
import { searchWeb } from './webSearchService';
import { knowledgeService } from './knowledgeService';
import { searchFaultCode, searchManual } from './localKnowledge';
import { findLearnedSolution } from './learningService';
import { getDriveFolderStructure } from './driveConfig';
import { embedText } from './embeddingService';
import { search as vectorSearch } from './vectorStore';
import { expandQuery, extractFaultCodes } from './queryService';
import { trackAgentSelected, trackQueryProcessed, trackSourceFound, trackError } from './analyticsService';



// --- ZOD SCHEMAS ---

const AssetSchema = z.object({
  asset_name: z.string().default("Unknown Asset"),
  serial_number: z.string().nullable().optional(),
  product_id: z.string().nullable().optional(),
  product_category: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  product_line: z.string().nullable().optional(),
});

const WorkOrderSchema = z.object({
  subject: z.string().default("Service Call"),
  description: z.string().default(""),
  status: z.string().optional(),
});

const ServiceAppointmentSchema = z.object({
  service_appointment_id: z.string().default(() => `SA-${Math.floor(Math.random() * 10000)}`),
  customer_name: z.string().default("Unknown Customer"),
  address: z.string().default("Unknown Address"),
  original_time_slot: z.string().default(""),
  work_order: WorkOrderSchema.optional().default({ subject: "Service Call", description: "" }),
  asset: AssetSchema.optional().default({ asset_name: "Unknown Asset" }),
});

const ScheduleZodSchema = z.object({
  schedule_date: z.string().optional().default(() => new Date().toISOString().split('T')[0]),
  service_appointments: z.array(ServiceAppointmentSchema).default([]),
});

const JobSheetZodSchema = z.object({
  detectedProduct: z.string().nullable().optional(),
  partsUsed: z.array(z.string()).default([]),
  engineerNotes: z.string().optional().default(""),
  serialNumber: z.string().nullable().optional(),
  modelNumber: z.string().nullable().optional(),
  productionYear: z.string().nullable().optional(),
  derivedProductType: z.string().nullable().optional(),
});

const LAYOUT_ANALYSIS_LOGIC = `
1. VISUAL EXTRACTION LOGIC (The New Rules):
* Layout Analysis: Explicitly look for "Vertical Stacking". Define the KEY as the "Gray, muted label" and the VALUE as the "White, prominent text" immediately below it.
* Grouping: Establish a strict hierarchy. The "Schedule" screen is the PARENT list. "Work Order" and "Asset" screens are CHILDREN that must be nested inside their specific appointment object.
* Date Recognition: You MUST extract the date from the "Schedule" screen header (e.g., "Mon, 18 Dec") and convert it to YYYY-MM-DD format in the root of the JSON.

2. THE SCHEMA:
Enforce the exact JSON structure provided in the schema configuration. Do not hallucinate fields.
`;

const createMasterPrompt = (): string => {
  return `
### ROLE AND OBJECTIVE ###
You are 'Oscar', an expert layout analysis AI. Your goal is to extract data from field service screenshots using strict layout analysis rules.

${LAYOUT_ANALYSIS_LOGIC}

### INSTRUCTIONS ###
1. Analyze the provided images.
2. Apply the Layout Analysis rules to identify the Schedule, Work Orders, and Assets.
3. Group the data according to the "Grouping" rules.
4. Extract values based on the "Vertical Stacking" and "Visual Cues".
5. Handle edge cases (missing screens, empty fields) as defined.
6. Output a JSON object strictly adhering to the provided schema.
`;
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    schedule_date: {
      type: Type.STRING,
      format: "date",
      description: "EXTRACT FROM HEADER (e.g., 'Mon, 18 Dec' -> '2023-12-18'). The date of the scheduled appointments."
    },
    service_appointments: {
      type: Type.ARRAY,
      description: "A list of all service appointments for the day.",
      items: {
        type: Type.OBJECT,
        properties: {
          service_appointment_id: {
            type: Type.STRING,
            description: "The unique identifier for the service appointment, e.g., 'SA-12315468'."
          },
          customer_name: {
            type: Type.STRING,
            description: "The full name of the customer."
          },
          address: {
            type: Type.STRING,
            description: "The full service address for the appointment."
          },
          original_time_slot: {
            type: Type.STRING,
            description: "The original time slot shown in the schedule view, e.g., '08:55 - 09:55'."
          },
          work_order: {
            type: Type.OBJECT,
            properties: {
              subject: {
                type: Type.STRING,
                description: "The primary subject or title of the work order."
              },
              description: {
                type: Type.STRING,
                description: "The detailed description of the fault or issue."
              },
              status: {
                type: Type.STRING,
                description: "The current status of the work order.",
                enum: ["In Progress"]
              },
              type: {
                type: Type.STRING,
                description: "The type of service call.",
                enum: ["IN WARRANTY REPAIRS", "10 YEAR FREE PARTS - INVOICE"]
              },
              work_type_id: {
                type: Type.STRING,
                description: "The category of the work type.",
                enum: ["Tumble Dryer - Standard", "Laundry - Standard", "Built in Repair - Standard"]
              }
            }
          },
          asset: {
            type: Type.OBJECT,
            properties: {
              asset_name: {
                type: Type.STRING,
                description: "The name or model number of the asset."
              },
              serial_number: {
                type: Type.STRING,
                nullable: true,
                description: "The complete, unique serial number of the appliance."
              },
              product_id: {
                type: Type.STRING,
                nullable: true,
                description: "The product identifier, often matching the asset name."
              },
              product_category: {
                type: Type.STRING, // Handling mixed type simply as string for stability or nullable
                nullable: true,
                description: "The category of the appliance. Can be ambiguous (e.g., '11')."
              },
              division: {
                type: Type.STRING,
                nullable: true,
                description: "The business division for the product.",
                enum: ["Washing"]
              },
              product_line: {
                type: Type.STRING,
                nullable: true,
                description: "The specific product line.",
                enum: ["TUMBLE DRYER FS", "WASHING MACHINE FS", "WASHING MACHINE BI"]
              },
              brand: {
                type: Type.STRING,
                nullable: true,
                description: "The brand of the appliance.",
                enum: ["HOOVER", "CANDY"]
              },
              purchase_date: {
                type: Type.STRING,
                nullable: true,
                format: "date",
                description: "The date the appliance was purchased, e.g., '2024-08-21'."
              }
            }
          }
        },
        required: ["service_appointment_id", "address", "work_order", "asset"]
      }
    }
  },
  required: ['schedule_date', 'service_appointments'],
};

// @ts-ignore
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

// DEBUG: Diagnose API Key
if (!API_KEY) {
  console.error("GEMINI_API_KEY not found in environment variables.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY || '' });

import { SERIAL_KNOWLEDGE_BASE } from './serialService';

const KNOWLEDGE_BASE_LEGACY = `
### KNOWLEDGE BASE (Legacy for Sheet Analysis) ###
System Identification Logic:
- If the Brand Name is 'Haier', use System B.
- If the first digit of the serial number is '3', use System A.
${SERIAL_KNOWLEDGE_BASE}
`;


const createJobSheetPrompt = (): string => {
  return `
### ROLE ###
You are an expert field service data entry assistant.

### TASK ###
Analyze the image of a handwritten or printed job sheet.

### OUTPUT ###
Return a pure JSON object (no markdown) with the following fields:
- detectedProduct: string (The brand and model, e.g. "Worcester Bosch 4000")
- partsUsed: array of strings (e.g. ["Heat Exchanger Seal", "Ignition Electrode"])
- engineerNotes: string (summarize the handwritten notes)
- serialNumber: string (if visible)
- modelNumber: string (if visible)
- productionYear: string (Derived from Serial Number using the Knowledge Base below)
- derivedProductType: string (Derived from Serial Number using the Knowledge Base below, if applicable)

If a field is not found or cannot be derived, return null or empty array.

${KNOWLEDGE_BASE_LEGACY}
`;
};

const jobSheetSchema = {
  type: Type.OBJECT,
  properties: {
    detectedProduct: { type: Type.STRING },
    partsUsed: { type: Type.ARRAY, items: { type: Type.STRING } },
    engineerNotes: { type: Type.STRING },
    serialNumber: { type: Type.STRING },
    modelNumber: { type: Type.STRING },
    productionYear: { type: Type.STRING, description: "Calculated from serial number via Knowledge Base rules" },
    derivedProductType: { type: Type.STRING, description: "Decoded from serial number via Knowledge Base rules" },
  },
  required: ['detectedProduct', 'partsUsed', 'engineerNotes'],
};


export async function processFieldDataFromImages(
  base64Images: string[]
): Promise<ProcessedData> {
  const imageParts = base64Images.map(img => ({
    inlineData: {
      mimeType: 'image/png',
      data: img,
    },
  }));

  const masterPrompt = createMasterPrompt();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: masterPrompt }, ...imageParts] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    });

    const rawJson = response.text;
    if (!rawJson) throw new Error("No text returned from Gemini");

    const parsed = JSON.parse(rawJson);

    // Validate with Zod
    console.log("Validating Schedule Data...");
    const validated = ScheduleZodSchema.parse(parsed);
    return validated as any; // Cast back to compatible type for now, or update interfaces later
  } catch (error) {
    console.error("Gemini API Error (Schedule):", error);
    if (error instanceof z.ZodError) {
      console.error("Validation Failed:", error.issues);
      throw new Error("AI returned invalid schedule data.");
    }
    throw new Error("Failed to process schedule images.");
  }
}

export async function analyzeJobSheet(base64Image: string): Promise<any> {
  const imagePart = {
    inlineData: {
      mimeType: 'image/png',
      data: base64Image
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: createJobSheetPrompt() }, imagePart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: jobSheetSchema,
      },
    });

    const rawJson = response.text;
    if (!rawJson) throw new Error("No text returned from Gemini");

    const parsed = JSON.parse(rawJson);
    return JobSheetZodSchema.parse(parsed);

  } catch (error) {
    console.error("Gemini API Error (Job Sheet):", error);
    if (error instanceof z.ZodError) {
      throw new Error("AI returned invalid job sheet data.");
    }
    throw new Error("Failed to analyze job sheet.");
  }
}

// DOC CLASSIFICATION for Smart Ingestion
const classificationSchema = {
  type: Type.OBJECT,
  properties: {
    docType: {
      type: Type.STRING,
      enum: ["JOB_SHEET", "SCHEDULE", "MANUAL", "PART_LIST", "UNKNOWN"],
      description: "The type of document in the image."
    },
    confidence: { type: Type.NUMBER },
    summary: { type: Type.STRING }
  },
  required: ["docType", "confidence"]
};

export async function classifyDocument(base64Image: string): Promise<{ docType: string, summary?: string }> {
  const imagePart = {
    inlineData: {
      mimeType: 'image/png',
      data: base64Image
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', // Use fast vision model if available, fallback to 1.5-flash
      contents: {
        parts: [
          { text: "Classify this document. Is it a Field Service Job Sheet (form with handwriting), a Daily Schedule app screenshot, a Technical Manual page, or a Spare Parts List?" },
          imagePart
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: classificationSchema,
      },
    });

    const json = JSON.parse(response.text || '{}');
    return json;
  } catch (e) {
    console.error("Classification Error", e);
    return { docType: "UNKNOWN" };
  }
}

// --- MULTI-AGENT SYSTEM ---

type AgentType = 'DISPATCHER' | 'ENGINEER' | 'SOURCER';

interface OscarResponse {
  text: string;
  sources?: { type: 'drive' | 'web'; name: string; link: string }[];
  agentType?: AgentType;
  isDiagnostic?: boolean; // Flag to show "Did this work?" buttons
}

interface RAGContext {
  referenceMaterial: string;
  sourcesFound: { type: 'drive' | 'web'; name: string; link: string }[];
}

/**
 * SHARED RAG ENGINE
 * Builds context from Vector Store, Google Drive (Manuals/PDFs), and Learned Solutions.
 * Used by both the Chat Agent and the Job Fault Analyzer.
 */
export async function buildRAGContext(
  query: string,
  jobContext: any,
  accessToken: string
): Promise<RAGContext> {
  let referenceMaterial = "";
  let sourcesFound: { type: 'drive' | 'web'; name: string; link: string }[] = [];

  try {
    // 1. SEMANTIC SEARCH using vector store (if embeddings available)
    try {
      const expandedQuery = expandQuery(query);
      console.log("Oscar RAG: Semantic search with expanded query:", expandedQuery);

      const queryEmbedding = await embedText(expandedQuery);
      if (queryEmbedding.length > 0) {
        // Broad search
        const semanticResults = await vectorSearch(queryEmbedding, 5);
        if (semanticResults.length > 0) {
          referenceMaterial += "\n\n### SEMANTIC SEARCH RESULTS ###";
          for (const result of semanticResults) {
            referenceMaterial += `\n\n--- [Score: ${result.score.toFixed(2)}] ${result.source}${result.pageNumber ? ` (p.${result.pageNumber})` : ''} ---\n${result.content}\n--- END ---`;
            sourcesFound.push({ type: 'drive', name: `${result.source} (semantic)`, link: '#' });
            trackSourceFound('drive', result.source);
          }
        }
      }
    } catch (embeddingError) {
      console.warn("Semantic search unavailable, falling back to keyword search", embeddingError);
    }

    // 2. LEARNED SOLUTIONS (Prioritize Verified Fixes)
    // Check both message/query and job context for fault codes
    const faultSource = (query || '') + " " + (jobContext.engineerNotes || jobContext.faultDescription || '');
    const allFaultCodes = [
      ...extractFaultCodes(query),
      ...extractFaultCodes(faultSource)
    ];

    for (const code of [...new Set(allFaultCodes)]) {
      console.log(`Oscar: Checking Learned Solutions for Fault ${code}...`);
      const learned = findLearnedSolution(code, jobContext.detectedProduct || jobContext.modelNumber);
      if (learned.length > 0) {
        const topSolution = learned[0];
        // Special Header to guide LLM
        referenceMaterial = `\n\n### 🌟 PROVEN FIELD FIX (Confidence: ${topSolution.confidence}) ###\nFault: ${topSolution.faultCode}\nModel: ${topSolution.model}\nDiagnosis: ${topSolution.diagnosis}\nFix: ${topSolution.fix}\nSuccess Rate: ${topSolution.successCount} verified repairs.\nParts Used: ${topSolution.partsUsed.join(', ')}\n### END PROVEN FIX ###\n\n` + referenceMaterial;

        trackSourceFound('learned', code);
      }
    }

    // 3. KEYWORD SEARCH via Google Drive (Manuals, PDFs)
    if (accessToken && accessToken !== "mock-token") {
      const { searchAllKnowledgeFolders } = await import('./googleDriveService');

      console.log("Oscar RAG: Keyword searching all knowledge folders for:", query);
      const allDocs = await searchAllKnowledgeFolders(accessToken, query);

      if (allDocs.length > 0) {
        referenceMaterial += "\n\n### DRIVE KEYWORD SEARCH RESULTS ###";
        for (const doc of allDocs) {
          referenceMaterial += `\n\n--- SOURCE: ${doc.source} (from ${doc.folder}) ---\n${doc.content}\n--- END SOURCE ---`;
          sourcesFound.push({ type: 'drive', name: `${doc.source} (${doc.folder})`, link: '#' });
          trackSourceFound('drive', doc.folder);
        }
      }

      // Manual Specific Lookup
      if (jobContext.modelNumber || jobContext.detectedProduct) {
        const manual = await knowledgeService.findManual(accessToken, jobContext.modelNumber || jobContext.detectedProduct);
        if (manual) {
          referenceMaterial += `\n\n### FOUND MANUAL: ${manual.title} ###\nURI: ${manual.url || 'Internal Drive'}`;
        }
      }
    }
  } catch (err) {
    console.error("Error building RAG context:", err);
  }

  return { referenceMaterial, sourcesFound };
}


// DISPATCHER: Lightweight LLM call to route the query
async function dispatcherAgent(message: string): Promise<'CHAT' | 'PARTS_LOOKUP' | 'DIAGNOSTIC'> {
  const dispatcherPrompt = `
You are a router. Classify the user's message into ONE of these categories:
- PARTS_LOOKUP: If the user is asking for a specific part number, price, or availability.
- DIAGNOSTIC: If the user is asking about a fault code, error, symptom, or asking "why is X happening?".
- CHAT: Anything else (greetings, general questions, how-to, etc).

Respond with ONLY the category name, nothing else.
`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: message }] }],
      config: {
        systemInstruction: { parts: [{ text: dispatcherPrompt }] },
      }
    });
    const result = (response.text || 'CHAT').trim().toUpperCase();
    if (['PARTS_LOOKUP', 'DIAGNOSTIC', 'CHAT'].includes(result)) {
      return result as 'CHAT' | 'PARTS_LOOKUP' | 'DIAGNOSTIC';
    }
    return 'CHAT';
  } catch (e) {
    console.warn("Dispatcher failed, defaulting to CHAT", e);
    return 'CHAT';
  }
}

// SOURCER AGENT: Returns strict JSON output for parts
async function sourcerAgent(message: string, referenceMaterial: string): Promise<string> {
  const sourcerPrompt = `
You are a Parts Sourcer. You have access to the following reference material:
${referenceMaterial}

Your task: Find the specific part the user is asking about.
If found, return a JSON object: {"partName": "...", "partNumber": "...", "price": "...", "found": true}
If NOT found, return: {"found": false, "suggestion": "A short suggestion of where to look or ask."}

IMPORTANT: Return ONLY the JSON object, no explanation or markdown.
`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: message }] }],
      config: {
        systemInstruction: { parts: [{ text: sourcerPrompt }] },
        responseMimeType: 'application/json',
      }
    });
    const jsonResult = response.text || '{"found": false}';
    // Format for user display
    const parsed = JSON.parse(jsonResult);
    if (parsed.found) {
      return `✅ **Part Found**\n- **Name**: ${parsed.partName}\n- **Part Number**: \`${parsed.partNumber}\`\n- **Price**: ${parsed.price || 'N/A'}`;
    } else {
      return `❌ Part not found in the knowledge base.\n\n💡 **Suggestion**: ${parsed.suggestion || 'Check the OEM parts catalog.'}`;
    }
  } catch (e) {
    console.error("Sourcer Agent Error", e);
    return "I couldn't find that part. Please check the parts manual.";
  }
}

// ENGINEER AGENT (Main Chat Logic)
async function engineerAgent(
  message: string,
  history: { role: string; parts: { text: string }[] }[],
  jobContext: any,
  referenceMaterial: string,
  isDiagnostic: boolean
): Promise<string> {
  const driveStructure = getDriveFolderStructure();

  const systemPrompt = `
You are Oscar, an expert Field Service Engineer Assistant.

CONTEXT:
Current Job: ${jobContext.detectedProduct || jobContext.modelNumber || "Generic Unit"}
Fault: ${jobContext.engineerNotes || jobContext.faultDescription || "None"}
Serial: ${jobContext.serialNumber || "Unknown"}

${driveStructure}

${SERIAL_KNOWLEDGE_BASE}

${referenceMaterial}

INSTRUCTIONS:
1. Use the Reference Material above if relevant.
2. If the user asks about a part, check if it's in the reference material (manuals/BOMs).
3. If citing a "LEARNED SOLUTION" or "PROVEN FIELD FIX", mention the Confidence Level and Success Count prominently.
4. ${isDiagnostic ? 'Provide a clear diagnosis and fix. The user will be asked if this worked afterwards.' : 'Be helpful and concise.'}
5. You have access to files in Google Drive. Manuals are stored in the MANUALS folder. If a user asks where something is stored, refer to the Drive structure.
`;

  const contents = [
    ...history.map(h => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: h.parts
    })),
    { role: 'user', parts: [{ text: message }] }
  ];

  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: contents,
    config: {
      systemInstruction: { parts: [{ text: systemPrompt }] },
    }
  });

  return response.text || "I couldn't process that request.";
}


export async function chatWithOscar(
  message: string,
  history: { role: string; parts: { text: string }[] }[],
  jobContext: any,
  accessToken: string
): Promise<OscarResponse> {
  const startTime = Date.now();

  try {
    // 1. DISPATCHER: Route the message
    console.log("🤖 Oscar: Dispatching query...");
    const dispatchStart = Date.now();
    const intent = await dispatcherAgent(message);
    trackAgentSelected(intent, message, Date.now() - dispatchStart);
    console.log(`   -> Intent: ${intent}`);

    // 2. SHARED RAG CONTEXT BUILDER
    const { referenceMaterial, sourcesFound } = await buildRAGContext(message, jobContext, accessToken);

    // 2c. CONVERSATION SUMMARIZATION (if history is long)
    let workingHistory = history;
    if (history.length > 10) {
      console.log(`Oscar: Summarizing long conversation (${history.length} turns)...`);
      // Keep last 4 turns, summarize the rest
      const oldHistory = history.slice(0, -4);
      const recentHistory = history.slice(-4);

      const summaryText = oldHistory.map(h => `${h.role}: ${h.parts[0]?.text?.substring(0, 100)}`).join('\n');
      workingHistory = [
        { role: 'user', parts: [{ text: `[Previous conversation summary: ${summaryText.substring(0, 500)}...]` }] },
        ...recentHistory
      ];
    }

    // 3. ROUTE TO AGENT
    let responseText = "";
    let agentType: AgentType = 'ENGINEER';
    const isDiagnostic = intent === 'DIAGNOSTIC';

    if (intent === 'PARTS_LOOKUP') {
      agentType = 'SOURCER';
      responseText = await sourcerAgent(message, referenceMaterial);
    } else {
      agentType = 'ENGINEER';
      responseText = await engineerAgent(message, workingHistory, jobContext, referenceMaterial, isDiagnostic);
    }

    // Track successful query
    trackQueryProcessed(message, agentType, sourcesFound.length, responseText.length, Date.now() - startTime);

    return {
      text: responseText,
      sources: sourcesFound.length > 0 ? sourcesFound : [],
      agentType: agentType,
      isDiagnostic: isDiagnostic
    };

  } catch (error) {
    console.error("Oscar Chat Error:", error);
    trackError('chat_error', error instanceof Error ? error.message : 'Unknown error');
    return { text: "I'm having trouble connecting to my knowledge base right now. Please try again." };
  }
}

// --- AUTOMATED FAULT ANALYSIS (PHASE 1) ---

const FaultAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    fault: { type: Type.STRING, description: "Short summary of the fault code or symptom" },
    cause: { type: Type.STRING, description: "Technical root cause found in manuals/PDFs" },
    solution: { type: Type.STRING, description: "Step-by-step fix or action plan" },
    confidence: { type: Type.NUMBER, description: "Confidence score 0-100 based on source quality" }
  },
  required: ["fault", "cause", "solution", "confidence"]
};

export async function generateFaultDiagnosis(
  job: any,
  accessToken: string
): Promise<{ fault: string; cause: string; solution: string; confidence: number } | null> {

  if (!job.engineerNotes && !job.faultDescription) return null;

  const query = `${job.engineerNotes} ${job.faultDescription}`;
  console.log("🔍 Oscar: Auto-Analyzing Fault >", query);

  // Reuse the Shared RAG Brain
  const { referenceMaterial } = await buildRAGContext(query, job, accessToken);

  if (!referenceMaterial) {
    console.log("No context found for auto-analysis.");
    return null; // Don't hallucinate if we know nothing
  }

  const prompt = `
    You are an AI Diagnostic System. Analyze the fault based on the provided technical context.
    
    CONTEXT:
    Product: ${job.detectedProduct}
    Notes: ${query}

    REFERENCE MATERIAL:
    ${referenceMaterial}

    INSTRUCTIONS:
    1. Identify the likely Fault Code or Issue.
    2. Determine the Root Cause from the evidence.
    3. Outline the key Solution steps.
    4. Rate validity (Confidence). If "PROVEN FIELD FIX" is present, Confidence = 100.
    
    Output strictly in JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: FaultAnalysisSchema,
      }
    });

    const result = JSON.parse(response.text || '{}');
    return result;

  } catch (e) {
    console.error("Auto-Diagnosis Failed:", e);
    return null;
  }
}




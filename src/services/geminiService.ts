
import { GoogleGenAI, Type } from "@google/genai";

import type { ProcessedData } from '../types';
import { searchKnowledgeBase } from './googleDriveService';
import { searchWeb } from './webSearchService';
import { knowledgeService } from './knowledgeService';
import { searchFaultCode, searchManual } from './localKnowledge';
import { findLearnedSolution } from './learningService';


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

const KNOWLEDGE_BASE_LEGACY = `
### KNOWLEDGE BASE (Legacy for Sheet Analysis) ###
System Identification Logic:
- If the Brand Name is 'Haier', use System B.
- If the first digit of the serial number is '3', use System A.
System A: Data Rules for Hoover / Candy
- Identifier: Full serial number is a continuous string of digits, beginning with '3'.
- Serial Number Structure: Digits 1-8: Product Code. Digits 9-12: Date of Manufacture Code (YYWW).
- Date of Manufacture: Production Year = (Digits 9-10) + 2000.
System B: Data Rules for Haier Brand
- Identifier: Brand Name is 'Haier'.
- Date of Manufacture (from Serial): A=2010, B=2011, ..., H=2017.
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

    return JSON.parse(rawJson); // Return raw JSON matching new schema, type casting removed for now
  } catch (error) {
    console.error("Gemini API Error (Schedule):", error);
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
    return JSON.parse(rawJson);
  } catch (error) {
    console.error("Gemini API Error (Job Sheet):", error);
    throw new Error("Failed to analyze job sheet.");
  }
}

export async function chatWithOscar(
  message: string,
  history: { role: string; parts: { text: string }[] }[],
  jobContext: any,
  accessToken: string
): Promise<{ text: string; sources?: { type: 'drive' | 'web'; name: string; link: string }[] }> {
  try {
    // 1. RAG: Search Knowledge Base
    let referenceMaterial = "";
    if (accessToken && accessToken !== "mock-token") {
      console.log("Oscar RAG: Searching Knowledge Base for:", message);
      const docs = await searchKnowledgeBase(accessToken, message);
      if (docs.length > 0) {
        referenceMaterial = "\n\n### REFERENCE MATERIAL (FROM KNOWLEDGE BASE) ###\n" + docs.join("\n\n");
      }


      // 1b. Knowledge Service (Manuals)
      if (jobContext.modelNumber || jobContext.detectedProduct) {
        const manual = await knowledgeService.findManual(accessToken, jobContext.modelNumber || jobContext.detectedProduct);
        if (manual) {
          referenceMaterial += `\n\n### FOUND MANUAL: ${manual.title} ###\nURI: ${manual.url || 'Internal Drive'}`;
        }
      }

      // 1c. Learned Solutions (localStorage)
      if (jobContext.engineerNotes) {
        // Simple extraction: Look for "E" or "F" followed by digits (e.g., E24, F05)
        const codeMatch = jobContext.engineerNotes.match(/([E|F][0-9]+)/i);
        if (codeMatch) {
          const code = codeMatch[0].toUpperCase();
          console.log(`Oscar: Detected Fault Code ${code}, checking Learned Solutions...`);
          const learned = findLearnedSolution(code, jobContext.detectedProduct || jobContext.modelNumber);
          if (learned.length > 0) {
            const topSolution = learned[0];
            referenceMaterial += `\n\n### 🌟 LEARNED SOLUTION FOR FAULT ${code} (${topSolution.confidence} confidence) ###\nFix: ${topSolution.fix}\nSuccess Rate: ${topSolution.successCount} verified repairs.\nLast Used: ${topSolution.lastUsed}\nParts: ${topSolution.partsUsed.join(', ')}`;
          }
        }
      }
    }

    // 2. Construct System Prompt
    const systemPrompt = `
You are Oscar, an expert Field Service Engineer Assistant.
Your goal is to assist the engineer with technical questions, inventory checks, and diagnostics.

CONTEXT:
Current Job: ${jobContext.detectedProduct || jobContext.modelNumber || "Generic Unit"}
Fault: ${jobContext.engineerNotes || "None"}
Serial: ${jobContext.serialNumber || "Unknown"}

${referenceMaterial}

INSTRUCTIONS:
1. Use the Reference Material above if relevant.
2. If the user asks about a part, check if it's in the reference material (manuals/BOMs).
3. Be concise and professional.
`;

    // 3. Call Gemini (Using @google/genai SDK stateless pattern)
    // Convert history to compatible format if needed (Role: 'user' | 'model')
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

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return {
      text: text,
      sources: (accessToken && referenceMaterial) ? [{ type: 'drive', name: 'Knowledge Base', link: '#' }] : []
    };

  } catch (error) {
    console.error("Oscar Chat Error:", error);
    return { text: "I'm having trouble connecting to my knowledge base right now. Please try again." };
  }
}



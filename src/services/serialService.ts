/**
 * Serial Number Service
 * Handles decoding of appliance serial numbers for age, manufacturing location, and platform.
 * Specializes in Hoover, Candy, and Haier brands.
 */

export interface SerialInfo {
    brand?: 'HOOVER' | 'CANDY' | 'HAIER';
    productionYear: number | null;
    productionWeek: number | null;
    productCode?: string;
    factoryCode?: string;
    rawSerial: string;
    isValid: boolean;
}

/**
 * Decodes a Hoover/Candy serial number (System A)
 * Format: 31001234 1620 (16 digits typically, sometimes fewer)
 * Structure: 
 * - Digits 1-8: Product/Model Code
 * - Digits 9-12: Date Code (YYWW)
 * - Digits 13-16: Sequence/Factory
 */
export function decodeHooverCandySerial(serial: string): SerialInfo {
    const cleanSerial = serial.replace(/[^0-9]/g, '');

    // Basic validation: Must start with 3 and have at least 12 digits for date code
    if (!cleanSerial.startsWith('3') || cleanSerial.length < 12) {
        return { rawSerial: serial, productionYear: null, productionWeek: null, isValid: false };
    }

    const productCode = cleanSerial.substring(0, 8);
    const dateCode = cleanSerial.substring(8, 12); // YYWW

    const yearStr = dateCode.substring(0, 2);
    const weekStr = dateCode.substring(2, 4);

    const year = parseInt(yearStr, 10) + 2000;
    const week = parseInt(weekStr, 10);

    return {
        brand: 'HOOVER', // Or Candy, they share the format
        productionYear: year,
        productionWeek: week,
        productCode: productCode,
        rawSerial: serial,
        isValid: true
    };
}

/**
 * Decodes a Haier serial number (System B)
 * Date code letters: A=2010, B=2011, etc.
 * This is a simplified implementation based on the legacy logic.
 */
export function decodeHaierSerial(serial: string): SerialInfo {
    // Haier decoding can be complex. Implementing based on "Legacy Knowledge Base":
    // Date of Manufacture (from Serial): A=2010, B=2011, ..., H=2017.
    // We'll need to look for this pattern. For now, we'll placeholder this 
    // to match the exact logic extracted from ingestionService.

    // TODO: Implement full Haier regex parsing if pattern is known.
    // Currently the legacy prompt just says "A=2010...", it doesn't specify POSITION.

    return {
        brand: 'HAIER',
        productionYear: null,
        productionWeek: null,
        rawSerial: serial,
        isValid: false
    };
}

/**
 * Auto-detect and decode
 */
export function decodeSerial(serial: string, brandHint?: string): SerialInfo {
    const clean = serial.trim().toUpperCase();

    // Strategy 1: Hoover/Candy (Starts with 3, 16 digits)
    if (clean.startsWith('3') && clean.replace(/[^0-9]/g, '').length >= 12) {
        return decodeHooverCandySerial(clean);
    }

    // Strategy 2: Haier (Brand hint)
    if (brandHint?.toUpperCase().includes('HAIER')) {
        return decodeHaierSerial(clean);
    }

    return { rawSerial: serial, productionYear: null, productionWeek: null, isValid: false };
}

/**
 * Text description of the serial rules for the LLM
 */
export const SERIAL_KNOWLEDGE_BASE = `
### SERIAL NUMBER DECODING RULES ###
1. **Hoover / Candy (Group)**
   - **Format:** 16 digits, always starts with '3'.
   - **Structure:** [Product Code: 8 digits] [Date Code: 4 digits] [Sequence: 4 digits]
   - **Date Code:** Digits 9-10 = Year (add 2000), Digits 11-12 = Week.
   - **Example:** 31000566 **1220** 1234 -> Year 2012, Week 20.

2. **Haier**
   - Uses letter codes for years (e.g., G=2016, H=2017).
`;

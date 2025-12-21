import { describe, it, expect } from 'vitest';
import { decodeSerial, decodeHooverCandySerial } from '../serialService';

describe('serialService', () => {
    describe('decodeHooverCandySerial', () => {
        it('should decode a valid 16-digit serial correctly', () => {
            // Example: 31000566 1220 1234
            // Year: 2012 (12 + 2000), Week: 20
            const serial = '3100056612201234';
            const result = decodeHooverCandySerial(serial);

            expect(result.isValid).toBe(true);
            expect(result.brand).toBe('HOOVER');
            expect(result.productionYear).toBe(2012);
            expect(result.productionWeek).toBe(20);
            expect(result.productCode).toBe('31000566');
        });

        it('should handle serials with spaces', () => {
            const serial = '31000566 1620 1234';
            const result = decodeHooverCandySerial(serial);

            expect(result.isValid).toBe(true);
            expect(result.productionYear).toBe(2016);
            expect(result.productionWeek).toBe(20);
        });

        it('should return invalid for non-Hoover serials (not starting with 3)', () => {
            const serial = '4100056612201234';
            const result = decodeHooverCandySerial(serial);

            expect(result.isValid).toBe(false);
            expect(result.productionYear).toBeNull();
        });

        it('should return invalid for short serials', () => {
            const serial = '3100';
            const result = decodeHooverCandySerial(serial);

            expect(result.isValid).toBe(false);
        });
    });

    describe('decodeSerial (Auto-detect)', () => {
        it('should auto-detect Hoover serials', () => {
            const serial = '3100123415011234';
            const result = decodeSerial(serial);

            expect(result.brand).toBe('HOOVER');
            expect(result.productionYear).toBe(2015);
            expect(result.productionWeek).toBe(1);
        });

        it('should accept brand hint for Haier', () => {
            const serial = 'AnySerial123';
            const result = decodeSerial(serial, 'HAIER');

            // Current placeholder logic
            expect(result.brand).toBe('HAIER');
        });
    });
});

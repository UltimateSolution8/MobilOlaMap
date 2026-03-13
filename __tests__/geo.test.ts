import { distanceMeters, decodePolyline } from '../src/utils/geo';

describe('distanceMeters', () => {
    it('returns 0 for identical points', () => {
        const p = { lat: 12.9716, lng: 77.5946 };
        expect(distanceMeters(p, p)).toBe(0);
    });

    it('returns correct distance between Bangalore and Mumbai (~845km)', () => {
        const bangalore = { lat: 12.9716, lng: 77.5946 };
        const mumbai = { lat: 19.076, lng: 72.8777 };
        const dist = distanceMeters(bangalore, mumbai);
        expect(dist).toBeGreaterThan(840_000);
        expect(dist).toBeLessThan(850_000);
    });

    it('returns correct distance for short distances (~1.1km)', () => {
        const a = { lat: 12.9716, lng: 77.5946 };
        const b = { lat: 12.9816, lng: 77.5946 }; // ~1.11km due north
        const dist = distanceMeters(a, b);
        expect(dist).toBeGreaterThan(1000);
        expect(dist).toBeLessThan(1200);
    });
});

describe('decodePolyline', () => {
    it('returns empty array for empty string', () => {
        expect(decodePolyline('')).toEqual([]);
    });

    it('decodes a known polyline correctly', () => {
        // "_p~iF~ps|U" decodes to approximately (38.5, -120.2)
        const coords = decodePolyline('_p~iF~ps|U');
        expect(coords.length).toBeGreaterThanOrEqual(1);
        const first = coords[0];
        expect(first.latitude).toBeCloseTo(38.5, 0);
        expect(first.longitude).toBeCloseTo(-120.2, 0);
    });

    it('decodes multi-point polyline', () => {
        // Known polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
        // Points: (38.5, -120.2), (40.7, -120.95), (43.252, -126.453)
        const coords = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
        expect(coords).toHaveLength(3);
        expect(coords[0].latitude).toBeCloseTo(38.5, 0);
        expect(coords[1].latitude).toBeCloseTo(40.7, 0);
        expect(coords[2].latitude).toBeCloseTo(43.252, 0);
    });

    it('all returned coordinates are finite numbers', () => {
        const coords = decodePolyline('_p~iF~ps|U_ulLnnqC');
        coords.forEach((c) => {
            expect(Number.isFinite(c.latitude)).toBe(true);
            expect(Number.isFinite(c.longitude)).toBe(true);
        });
    });
});

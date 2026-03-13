/**
 * Shared geo utilities for distance calculation and polyline decoding.
 * Extracted from BuyerTaskScreen and HelperTaskScreen to eliminate duplication.
 */

/**
 * Haversine formula — distance in meters between two lat/lng points.
 */
export function distanceMeters(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
): number {
    const R = 6371e3;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Decode Google-encoded polyline string into an array of coordinates.
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;
    const coords: { latitude: number; longitude: number }[] = [];

    while (index < len) {
        let b: number;
        let shift = 0;
        let result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
        lng += dlng;

        const latitude = lat / 1e5;
        const longitude = lng / 1e5;
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            coords.push({ latitude, longitude });
        }
    }
    return coords;
}

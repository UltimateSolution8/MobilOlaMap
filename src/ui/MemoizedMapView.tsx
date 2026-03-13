import React, { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { theme } from './theme';

type Coord = { latitude: number; longitude: number };

type MarkerData = {
    key: string;
    coordinate: Coord;
    title?: string;
    ref?: React.RefObject<any>;
};

type Props = {
    initialRegion: {
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
    };
    markers: MarkerData[];
    routeCoords?: Coord[];
    routeColor?: string;
    mapRef?: React.RefObject<MapView | null>;
    onPress?: (evt: { nativeEvent: { coordinate: Coord } }) => void;
    style?: ViewStyle;
    height?: number;
};

/**
 * Memoized MapView wrapper that only re-renders when coordinates/markers actually change.
 * This prevents the expensive MapView from re-rendering when unrelated parent state changes
 * (e.g., text input, socket events, form fields).
 */
export const MemoizedMapView = React.memo(
    function MemoizedMapView({
        initialRegion,
        markers,
        routeCoords,
        routeColor = theme.colors.primary,
        mapRef,
        onPress,
        style,
        height = 220,
    }: Props) {
        const wrapStyle = useMemo(
            () => [styles.mapWrap, { height }, style],
            [height, style],
        );

        return (
            <View style={wrapStyle}>
                <MapView
                    style={styles.map}
                    ref={mapRef}
                    initialRegion={initialRegion}
                    onPress={onPress}
                >
                    {markers.map((m) => (
                        <Marker
                            key={m.key}
                            coordinate={m.coordinate}
                            title={m.title}
                            ref={m.ref}
                        />
                    ))}
                    {routeCoords && routeCoords.length > 1 ? (
                        <Polyline coordinates={routeCoords} strokeColor={routeColor} strokeWidth={4} />
                    ) : null}
                </MapView>
            </View>
        );
    },
    (prev, next) => {
        // Only re-render if markers, route, or region actually changed
        if (prev.markers.length !== next.markers.length) return false;
        for (let i = 0; i < prev.markers.length; i++) {
            const pm = prev.markers[i];
            const nm = next.markers[i];
            if (
                pm.key !== nm.key ||
                pm.coordinate.latitude !== nm.coordinate.latitude ||
                pm.coordinate.longitude !== nm.coordinate.longitude
            ) {
                return false;
            }
        }
        if (prev.routeCoords?.length !== next.routeCoords?.length) return false;
        if (prev.onPress !== next.onPress) return false;
        return true;
    },
);

const styles = StyleSheet.create({
    mapWrap: {
        marginTop: theme.space.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
    },
    map: { flex: 1 },
});

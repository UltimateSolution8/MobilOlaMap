import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type ViewStyle } from 'react-native';

type Props = {
    width?: number | `${number}%`;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
};

/**
 * Lightweight shimmer skeleton placeholder.
 * Uses native-driven Animated opacity loop for zero JS-thread cost.
 */
export const SkeletonPlaceholder = React.memo(function SkeletonPlaceholder({
    width = '100%',
    height = 16,
    borderRadius = 8,
    style,
}: Props) {
    const opacity = useRef(new Animated.Value(0.4)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.4,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [opacity]);

    return (
        <Animated.View
            testID="skeleton-placeholder"
            style={[
                styles.base,
                { width, height, borderRadius, opacity },
                style,
            ]}
        />
    );
});

const styles = StyleSheet.create({
    base: {
        backgroundColor: '#E2E8F0',
    },
});

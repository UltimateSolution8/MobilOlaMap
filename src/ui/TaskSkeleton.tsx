import React from 'react';
import { StyleSheet, View } from 'react-native';

import { SkeletonPlaceholder } from './SkeletonPlaceholder';
import { theme } from './theme';

/**
 * Skeleton placeholder for task detail screens.
 * Shows a map placeholder, text line blocks, and button placeholders.
 */
export const TaskSkeleton = React.memo(function TaskSkeleton() {
    return (
        <View style={styles.container} testID="task-skeleton">
            {/* Map placeholder */}
            <SkeletonPlaceholder height={200} borderRadius={theme.radius.md} />

            {/* Status card skeleton */}
            <View style={styles.card}>
                <SkeletonPlaceholder width="60%" height={20} />
                <SkeletonPlaceholder width="80%" height={14} />
                <SkeletonPlaceholder width="90%" height={14} />
                <SkeletonPlaceholder width="40%" height={12} />

                {/* Stats row */}
                <View style={styles.statsRow}>
                    <SkeletonPlaceholder width={80} height={50} borderRadius={theme.radius.md} />
                    <SkeletonPlaceholder width={80} height={50} borderRadius={theme.radius.md} />
                    <SkeletonPlaceholder width={80} height={50} borderRadius={theme.radius.md} />
                </View>

                {/* Button placeholder */}
                <SkeletonPlaceholder height={44} borderRadius={theme.radius.md} />
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        gap: theme.space.md,
    },
    card: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.card,
        borderRadius: theme.radius.md,
        padding: theme.space.md,
        gap: theme.space.sm,
        ...theme.shadow.card,
    },
    statsRow: {
        flexDirection: 'row',
        gap: theme.space.sm,
        marginTop: theme.space.xs,
    },
});

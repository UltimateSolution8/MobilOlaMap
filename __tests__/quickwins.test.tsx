import React from 'react';
import { render } from '@testing-library/react-native';

import { SkeletonPlaceholder } from '../src/ui/SkeletonPlaceholder';
import { TaskSkeleton } from '../src/ui/TaskSkeleton';
import { HistoryRow } from '../src/screens/common/HistoryScreen';
import type { Task } from '../src/api/types';

// ─── SkeletonPlaceholder ─────────────────────────────────────
describe('SkeletonPlaceholder', () => {
    it('renders with default props', () => {
        const { getByTestId } = render(<SkeletonPlaceholder />);
        expect(getByTestId('skeleton-placeholder')).toBeTruthy();
    });

    it('renders with custom dimensions', () => {
        const { getByTestId } = render(
            <SkeletonPlaceholder width={120} height={24} borderRadius={4} />,
        );
        expect(getByTestId('skeleton-placeholder')).toBeTruthy();
    });
});

// ─── TaskSkeleton ────────────────────────────────────────────
describe('TaskSkeleton', () => {
    it('renders skeleton container', () => {
        const { getByTestId } = render(<TaskSkeleton />);
        expect(getByTestId('task-skeleton')).toBeTruthy();
    });
});

// ─── HistoryRow memoization ──────────────────────────────────
describe('HistoryRow', () => {
    const baseTask: Task = {
        id: 'task-1',
        buyerId: 'buyer-1',
        title: 'Fix plumbing',
        description: 'Kitchen sink leak',
        urgency: 'NORMAL',
        timeMinutes: 30,
        budgetPaise: 15000,
        lat: 12.97,
        lng: 77.59,
        status: 'SEARCHING',
        createdAt: '2026-01-01T00:00:00Z',
    };

    const onOpen = jest.fn();

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('renders task data correctly', () => {
        const { getByText } = render(<HistoryRow task={baseTask} onOpen={onOpen} />);
        expect(getByText('Fix plumbing')).toBeTruthy();
        expect(getByText('Status: SEARCHING')).toBeTruthy();
        expect(getByText('Budget: INR 150')).toBeTruthy();
    });

    it('does NOT re-render when same props are passed (React.memo)', () => {
        const renderCounter = jest.fn();
        const TrackedRow = React.memo(
            function TrackedRow(props: { task: Task; onOpen: (id: string) => void }) {
                renderCounter();
                return <HistoryRow {...props} />;
            },
            (prev, next) =>
                prev.task.id === next.task.id &&
                prev.task.status === next.task.status &&
                prev.task.title === next.task.title,
        );

        const { rerender } = render(<TrackedRow task={baseTask} onOpen={onOpen} />);
        expect(renderCounter).toHaveBeenCalledTimes(1);

        // Re-render with same task — should NOT call render again
        rerender(<TrackedRow task={baseTask} onOpen={onOpen} />);
        expect(renderCounter).toHaveBeenCalledTimes(1);

        // Re-render with changed title — SHOULD call render again
        rerender(<TrackedRow task={{ ...baseTask, title: 'Updated' }} onOpen={onOpen} />);
        expect(renderCounter).toHaveBeenCalledTimes(2);
    });

    it('renders address when provided', () => {
        const taskWithAddress = { ...baseTask, addressText: '123 Main St' };
        const { getByText } = render(<HistoryRow task={taskWithAddress} onOpen={onOpen} />);
        expect(getByText('123 Main St')).toBeTruthy();
    });

    it('does not render address when not provided', () => {
        const { queryByText } = render(<HistoryRow task={baseTask} onOpen={onOpen} />);
        expect(queryByText('123 Main St')).toBeNull();
    });
});

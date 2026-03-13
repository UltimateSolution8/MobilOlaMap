import { enqueueUpload, processQueue, getQueueSize, clearQueue } from '../src/utils/uploadQueue';

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
    setItem: jest.fn((key: string, value: string) => {
        mockStorage[key] = value;
        return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
        delete mockStorage[key];
        return Promise.resolve();
    }),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
});

describe('uploadQueue', () => {
    const baseItem = {
        id: 'upload-1',
        url: 'https://api.example.com/upload',
        file: { uri: 'file:///selfie.jpg', name: 'selfie.jpg', type: 'image/jpeg' },
        formFields: { stage: 'ARRIVAL', lat: '12.97', lng: '77.59' },
        accessToken: 'test-token',
    };

    it('succeeds immediately when upload works', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            text: jest.fn().mockResolvedValue(JSON.stringify({ success: true })),
        });

        const result = await enqueueUpload(baseItem);
        expect(result.success).toBe(true);
        expect(await getQueueSize()).toBe(0);
    });

    it('queues the item when upload fails', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: jest.fn().mockResolvedValue(JSON.stringify({ message: 'Server error' })),
        });

        const result = await enqueueUpload(baseItem);
        expect(result.success).toBe(false);
        expect(await getQueueSize()).toBe(1);
    });

    it('processQueue retries failed uploads', async () => {
        // First call fails (enqueue)
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: jest.fn().mockResolvedValue(JSON.stringify({ message: 'error' })),
        });
        await enqueueUpload(baseItem);

        // Process queue succeeds
        mockFetch.mockResolvedValueOnce({
            ok: true,
            text: jest.fn().mockResolvedValue(JSON.stringify({ success: true })),
        });
        await processQueue();

        expect(await getQueueSize()).toBe(0);
    });

    it('clearQueue empties the queue', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: jest.fn().mockResolvedValue('{}'),
        });
        await enqueueUpload(baseItem);
        expect(await getQueueSize()).toBe(1);

        await clearQueue();
        expect(await getQueueSize()).toBe(0);
    });
});

# Contributing to Superheroo Mobile

## Getting started

```bash
cd apps/mobile
npm install
npx expo start
```

## Development workflow

1. Create a feature branch from `develop`
2. Make changes and add tests
3. Run checks locally:
   ```bash
   npm run typecheck   # TypeScript
   npm test            # Jest unit tests
   ```
4. Open a PR using the template — fill in Performance section

## Code style

- **TypeScript**: strict mode enabled, no `any` unless annotated with rationale
- **Components**: use `React.memo` for list rows and heavy sub-components
- **Maps**: always use `MemoizedMapView` wrapper, never embed MapView inline
- **State**: use `useCallback` and `useMemo` for props passed to children
- **Imports**: group by stdlib → external → internal, separated by blank lines

## Testing

- Unit tests: `__tests__/` directory, use `@testing-library/react-native`
- Test naming: `*.test.ts` / `*.test.tsx`
- Run: `npm test` or `npm run test:coverage`

## Performance guidelines

- Target ≥ 55 FPS during map interactions
- FlatList: always use `keyExtractor`, `initialNumToRender`, `windowSize`, `removeClippedSubviews`
- Never pass inline objects/arrays as props to memoized components
- Use `InteractionManager.runAfterInteractions()` for non-critical work

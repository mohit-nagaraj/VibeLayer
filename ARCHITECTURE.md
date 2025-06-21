# VibeLayer Component Refactoring

## Overview

The main `App.jsx` component has been refactored from a monolithic 1200+ line component into smaller, more manageable pieces following React best practices.

## Changes Made

### 1. Component Separation

- **SearchTab.jsx**: Handles all search-related functionality including local file upload, URL import, and online search
- **LayoutTab.jsx**: Manages screen preview, sticker positioning, screen selection, and layout controls
- **SettingsTab.jsx**: Contains all settings-related UI and controls

### 2. Custom Hooks

- **useStickerManagement.js**: Manages sticker operations (fetch, save, delete, search, import, background removal)
- **useScreenManagement.js**: Handles screen detection, layout management, and screen selection
- **useSettings.js**: Manages settings and layout persistence

### 3. Utility Functions

- **fileUtils.js**: Contains the `toFileUrl` function for file path conversion

### 4. Main App Component

The refactored `App.jsx` is now:

- **Much smaller**: Reduced from 1200+ lines to ~250 lines
- **More focused**: Only handles coordination between components and hooks
- **Easier to maintain**: Clear separation of concerns
- **Better testable**: Each component and hook can be tested independently

## Benefits

### Maintainability

- Each component has a single responsibility
- Easier to locate and fix bugs
- Simpler to add new features

### Reusability

- Components can be reused in other parts of the application
- Hooks can be shared across different components

### Testing

- Individual components can be unit tested
- Hooks can be tested in isolation
- Better test coverage

### Performance

- Components only re-render when their specific props change
- Hooks optimize state updates
- Better memory management

## File Structure

```
src/renderer/src/
├── components/
│   ├── SearchTab.jsx
│   ├── LayoutTab.jsx
│   ├── SettingsTab.jsx
│   └── ui/ (existing UI components)
├── hooks/
│   ├── useStickerManagement.js
│   ├── useScreenManagement.js
│   └── useSettings.js
├── utils/
│   └── fileUtils.js
└── App.jsx (refactored)
```

## Migration Notes

- All existing functionality has been preserved
- No breaking changes to the API
- All event handlers and state management work exactly as before
- Toast notifications and error handling remain intact
- Screen capture and sticker positioning logic is unchanged

## Future Improvements

- Consider adding PropTypes or TypeScript for better type safety
- Add unit tests for each component and hook
- Implement error boundaries for better error handling
- Add loading states and skeleton components for better UX

# Shopping List Today 📝

A simple shopping list app that feels like digital pen and paper. No login required, no backend needed - everything is stored locally on your device.

## Features ✨

- **Quick Adding**: Type items separated by `, ` or `. ` (comma/dot + space), press Enter
- **Smart Duplicates**: Adding an existing item that's checked will uncheck it instead
- **Touch Friendly**: Tap item to check/uncheck, or swipe right ~20% on mobile
- **Auto-growing Input**: Input grows as you type (up to 50vh, or compact 80px when scrolled)
- **Share List**: Share button to send your list via native share or copy to clipboard
- **Archive System** 🗂️:
  - When ALL items are checked → "all done" message appears
  - Start typing to archive current list and begin a new one
  - "Old list is still here" - click to restore archived list
  - Only one archived list stored (like a paper in your pocket)
- **Data Safety**:
  - Items persist in IndexedDB
  - Automatic localStorage backup (restores if IndexedDB gets cleared)
  - Requests persistent storage from browser
- **PWA Ready**: Install on your phone for app-like experience
- **Offline First**: Works without internet connection
- **Dark Mode**: Respects system preference

## Tech Stack 🛠️

- **SvelteKit** - Fast, modern web framework
- **Tailwind CSS** - Utility-first styling
- **IndexedDB** - Primary local storage
- **localStorage** - Backup storage
- **Vercel** - Deployment platform

## Development 🚀

```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Build for production
yarn build

# Preview production build
yarn preview
```

## Deployment 📦

Configured for Vercel with `@sveltejs/adapter-vercel`.

When deploying updates, bump `CACHE_NAME` version in `static/service-worker.js` (e.g., `v3` → `v4`).

## Usage Tips 💡

**Quick list from SMS/message:**
1. Copy list like "Mleko, Chleb, Masło"
2. Paste into input
3. Press Enter - items split by `, ` or `. `

**On mobile:**
- Swipe right on item to check it off
- Tap anywhere on item to toggle

**Privacy:**
- All data stored locally on your device
- No accounts, no servers, no tracking

## License

MIT

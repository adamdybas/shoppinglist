# Shopping List Today 📝

A simple yet powerful shopping list app that feels like digital pen and paper. No login required, no backend needed - everything is stored locally on your device.

## Features ✨

- **Input as Source of Truth**: The textarea is your master list - items never disappear from it
- **Simple Adding**: Type items separated by commas or newlines, then press Enter to add them to the list below
- **Auto-growing Input**: The input grows as you type (up to 50% of screen height)
- **Smart List Management**:
  - New items appear at the top
  - Items persist in IndexedDB (survives page refreshes)
  - No duplicates - same items won't be added twice
  - Checkbox to mark items as done (strike-through styling)
  - Swipe gesture: Swipe 40-60% from left to right to mark items done (mobile)
- **Archive System - "Paper in Pocket"** 🗂️:
  - When ALL items are checked → list automatically archives
  - Shows hint: "Click to restore previous list and add items to it, or type to create a new one"
  - Only ONE archived list stored (like a paper list in your pocket!)
  - Each new completion overwrites the previous archive
  - Click hint to restore and continue adding to old list
  - Start typing to create a fresh list
- **Persistent Input**: Text stays in the textarea - delete manually if you want to edit
- **One-Way Flow**: Deleting from textarea doesn't affect items already in the list
- **No Deletion from List**: Items stay in your list (by design - like pen and paper!)
- **PWA Ready**: Install on your phone for an app-like experience
- **Offline First**: Works without internet connection

## Tech Stack 🛠️

- **SvelteKit** - Fast, modern web framework
- **Tailwind CSS** - Beautiful, responsive design
- **IndexedDB** - Local browser storage
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

This app is configured to deploy on Vercel with the `@sveltejs/adapter-vercel` adapter.

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy!

## Usage Tips 💡

**The Perfect SMS List Flow:**
1. Receive shopping list via SMS (e.g., "Mleko, Jajka, Chleb, Masło")
2. Copy the text
3. Paste into the textarea
4. Paste event automatically adds items OR press Enter to add manually
5. The textarea is your source of truth - text stays there
6. Edit anytime - new items will be added when you press Enter
7. No duplicates - same items won't be added twice

**Other Features:**
- Textarea grows automatically (up to 50% of screen)
- Items separated by commas or newlines
- Deleting from textarea doesn't affect the list
- On mobile, swipe right on an item to mark it done
- All data is stored locally - your list is private and secure
- Install as a PWA for the best mobile experience

## License

MIT

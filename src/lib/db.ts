// IndexedDB utility for shopping list storage

export interface ShoppingItem {
	id: string;
	text: string;
	done: boolean;
	createdAt: number;
}

export interface ArchivedList {
	id: string; // Always 'archived' - only one archived list
	items: ShoppingItem[];
	archivedAt: number;
}

const DB_NAME = 'ShoppingListDB';
const STORE_NAME = 'items';
const ARCHIVE_STORE_NAME = 'archive';
const DB_VERSION = 2;

let dbInstance: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
	if (dbInstance) return dbInstance;

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			dbInstance = request.result;
			resolve(dbInstance);
		};

	request.onupgradeneeded = (event) => {
		const db = (event.target as IDBOpenDBRequest).result;
		
		// Create items store
		if (!db.objectStoreNames.contains(STORE_NAME)) {
			const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
			store.createIndex('createdAt', 'createdAt', { unique: false });
		}
		
		// Create archive store (for the single archived list)
		if (!db.objectStoreNames.contains(ARCHIVE_STORE_NAME)) {
			db.createObjectStore(ARCHIVE_STORE_NAME, { keyPath: 'id' });
		}
	};
	});
}

export async function getAllItems(): Promise<ShoppingItem[]> {
	const db = await initDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.getAll();

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			const items = request.result as ShoppingItem[];
			// Sort by createdAt descending (newest first)
			items.sort((a, b) => b.createdAt - a.createdAt);
			resolve(items);
		};
	});
}

export async function addItem(text: string): Promise<ShoppingItem> {
	const db = await initDB();
	const item: ShoppingItem = {
		id: crypto.randomUUID(),
		text: text.trim(),
		done: false,
		createdAt: Date.now()
	};

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.add(item);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(item);
	});
}

export async function updateItem(id: string, updates: Partial<ShoppingItem>): Promise<void> {
	const db = await initDB();
	return new Promise(async (resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const getRequest = store.get(id);

		getRequest.onsuccess = () => {
			const item = getRequest.result;
			if (item) {
				const updatedItem = { ...item, ...updates };
				const updateRequest = store.put(updatedItem);
				updateRequest.onerror = () => reject(updateRequest.error);
				updateRequest.onsuccess = () => resolve();
			} else {
				reject(new Error('Item not found'));
			}
		};
		getRequest.onerror = () => reject(getRequest.error);
	});
}

export async function toggleItemDone(id: string): Promise<void> {
	const db = await initDB();
	return new Promise(async (resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const getRequest = store.get(id);

		getRequest.onsuccess = () => {
			const item = getRequest.result as ShoppingItem;
			if (item) {
				item.done = !item.done;
				const updateRequest = store.put(item);
				updateRequest.onerror = () => reject(updateRequest.error);
				updateRequest.onsuccess = () => resolve();
			} else {
				reject(new Error('Item not found'));
			}
		};
		getRequest.onerror = () => reject(getRequest.error);
	});
}

export async function archiveCurrentList(items: ShoppingItem[]): Promise<void> {
	const db = await initDB();
	const archive: ArchivedList = {
		id: 'archived',
		items: items,
		archivedAt: Date.now()
	};

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(ARCHIVE_STORE_NAME, 'readwrite');
		const store = transaction.objectStore(ARCHIVE_STORE_NAME);
		const request = store.put(archive);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}

export async function getArchivedList(): Promise<ArchivedList | null> {
	const db = await initDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(ARCHIVE_STORE_NAME, 'readonly');
		const store = transaction.objectStore(ARCHIVE_STORE_NAME);
		const request = store.get('archived');

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result || null);
	});
}

export async function clearAllItems(): Promise<void> {
	const db = await initDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.clear();

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}

// IndexedDB utility for shopping list storage

// Request persistent storage to prevent browser from evicting data
export async function requestPersistentStorage(): Promise<boolean> {
	if (navigator.storage?.persist) {
		return navigator.storage.persist();
	}
	return false;
}

// localStorage backup keys
const BACKUP_KEY = 'shoppinglist_backup';
const BACKUP_ARCHIVE_KEY = 'shoppinglist_archive_backup';

// Save backup to localStorage
function saveBackup(items: ShoppingItem[]): void {
	try {
		localStorage.setItem(BACKUP_KEY, JSON.stringify(items));
	} catch {
		// localStorage might be full or disabled
	}
}

// Save archive backup to localStorage
function saveArchiveBackup(archive: ArchivedList): void {
	try {
		localStorage.setItem(BACKUP_ARCHIVE_KEY, JSON.stringify(archive));
	} catch {
		// localStorage might be full or disabled
	}
}

// Get backup from localStorage
function getBackup(): ShoppingItem[] | null {
	try {
		const data = localStorage.getItem(BACKUP_KEY);
		return data ? JSON.parse(data) : null;
	} catch {
		return null;
	}
}

// Get archive backup from localStorage
function getArchiveBackup(): ArchivedList | null {
	try {
		const data = localStorage.getItem(BACKUP_ARCHIVE_KEY);
		return data ? JSON.parse(data) : null;
	} catch {
		return null;
	}
}

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

	// Request persistent storage on first init
	requestPersistentStorage();

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
		request.onsuccess = async () => {
			let items = request.result as ShoppingItem[];
			
			// If IndexedDB is empty, try to restore from backup
			if (items.length === 0) {
				const backup = getBackup();
				if (backup && backup.length > 0) {
					console.log('Restoring items from localStorage backup');
					// Restore items to IndexedDB
					for (const item of backup) {
						await restoreItem(item);
					}
					items = backup;
				}
			} else {
				// Update backup with current items
				saveBackup(items);
			}
			
			// Sort by createdAt descending (newest first)
			items.sort((a, b) => b.createdAt - a.createdAt);
			resolve(items);
		};
	});
}

// Restore a single item (used for backup restoration)
async function restoreItem(item: ShoppingItem): Promise<void> {
	const db = await initDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.put(item);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
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
		request.onsuccess = async () => {
			// Update backup after adding
			const allItems = await getAllItems();
			saveBackup(allItems);
			resolve(item);
		};
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
				updateRequest.onsuccess = async () => {
					// Update backup after toggle
					const allItems = await getAllItems();
					saveBackup(allItems);
					resolve();
				};
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
		request.onsuccess = () => {
			// Backup archive to localStorage
			saveArchiveBackup(archive);
			resolve();
		};
	});
}

export async function getArchivedList(): Promise<ArchivedList | null> {
	const db = await initDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(ARCHIVE_STORE_NAME, 'readonly');
		const store = transaction.objectStore(ARCHIVE_STORE_NAME);
		const request = store.get('archived');

		request.onerror = () => reject(request.error);
		request.onsuccess = async () => {
			let archive = request.result as ArchivedList | null;
			
			// If IndexedDB archive is empty, try to restore from backup
			if (!archive) {
				const backup = getArchiveBackup();
				if (backup) {
					console.log('Restoring archive from localStorage backup');
					await archiveCurrentList(backup.items);
					archive = backup;
				}
			}
			
			resolve(archive || null);
		};
	});
}

export async function clearAllItems(): Promise<void> {
	const db = await initDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.clear();

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			// Clear the backup too (user intentionally cleared)
			try {
				localStorage.removeItem(BACKUP_KEY);
			} catch {
				// ignore
			}
			resolve();
		};
	});
}

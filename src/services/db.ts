import { db, auth, isFirebaseEnabled } from '../firebase';
// 注意這裡多幫你引入了 getDoc
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, setDoc, getDoc } from 'firebase/firestore';
import { User, MatchRecord, TableRecord, Conversation, Application } from '../App';

// Define generic types for our data
type CollectionName = 'users' | 'records' | 'tables' | 'conversations';

// Local Storage Fallback Implementation
const localDB = {
  getItem: <T>(key: string): T | null => {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  },
  setItem: <T>(key: string, value: T) => {
    localStorage.setItem(key, JSON.stringify(value));
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
  }
};

// Data Service Layer
export const dataService = {
  // User Management
  saveUser: async (user: User) => {
    if (isFirebaseEnabled && db) {
      await setDoc(doc(db, 'users', user.id), user);
    }
    localDB.setItem('currentUser', user);
  },

  getCurrentUser: async (): Promise<User | null> => {
    return localDB.getItem<User>('currentUser');
  },

  // 🀄️ Records Management (麻將戰績) - 真正寫入 Firebase！
  saveRecords: async (records: MatchRecord[]) => {
    if (isFirebaseEnabled && db) {
      // 將整個戰績陣列存入 Firebase (無縫接軌你現在的架構)
      await setDoc(doc(db, 'globalData', 'allRecords'), { data: records });
    }
    localDB.setItem('records', records);
  },

  getRecords: async (): Promise<MatchRecord[]> => {
    if (isFirebaseEnabled && db) {
      try {
        const docRef = doc(db, 'globalData', 'allRecords');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return docSnap.data().data as MatchRecord[];
        }
      } catch (error) {
        console.error("讀取雲端戰績失敗:", error);
      }
    }
    return localDB.getItem<MatchRecord[]>('records') || [];
  },

  // 🀄️ Tables Management (發起牌局) - 真正寫入 Firebase！
  saveTables: async (tables: TableRecord[]) => {
    if (isFirebaseEnabled && db) {
      await setDoc(doc(db, 'globalData', 'allTables'), { data: tables });
    }
    localDB.setItem('tables', tables);
  },

  getTables: async (): Promise<TableRecord[]> => {
    if (isFirebaseEnabled && db) {
      try {
        const docRef = doc(db, 'globalData', 'allTables');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return docSnap.data().data as TableRecord[];
        }
      } catch (error) {
        console.error("讀取雲端牌局失敗:", error);
      }
    }
    return localDB.getItem<TableRecord[]>('tables') || [];
  },

  // Theme Management
  saveTheme: async (theme: any) => {
    localDB.setItem('appTheme', theme);
  },

  getTheme: async (): Promise<any> => {
    return localDB.getItem<any>('appTheme');
  },

  // Conversations Management
  saveConversations: async (conversations: Conversation[]) => {
    localDB.setItem('conversations', conversations);
  },

  getConversations: async (): Promise<Conversation[]> => {
    return localDB.getItem<Conversation[]>('conversations') || [];
  }
};
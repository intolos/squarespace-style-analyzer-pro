// utils/storage.ts
// Handles loading and saving of user-specific data

export interface UserData {
  usageCount: number;
  isPremium: boolean;
  userId: string;
  analyzedDomains: string[];
}

export const StorageManager = {
  // Load user data from Chrome storage
  async loadUserData(): Promise<UserData> {
    const data = await chrome.storage.local.get([
      'usageCount',
      'isPremium',
      'userId',
      'analyzedDomains',
    ]);

    return {
      usageCount: data.usageCount || 0,
      isPremium: data.isPremium || false,
      userId: data.userId || this.generateUserId(),
      analyzedDomains: data.analyzedDomains || [],
    };
  },

  // Save user data to Chrome storage
  async saveUserData(userData: UserData): Promise<void> {
    console.log('💾 Saving user data:', userData);
    await chrome.storage.local.set({
      usageCount: userData.usageCount,
      isPremium: userData.isPremium,
      userId: userData.userId,
      analyzedDomains: userData.analyzedDomains,
    });
    console.log('✅ User data saved successfully');
  },

  // Ensure userId is saved if it was just generated
  async ensureUserId(userId: string): Promise<void> {
    const data = await chrome.storage.local.get(['userId']);
    if (!data.userId) {
      await chrome.storage.local.set({ userId: userId });
    }
  },

  // Generate a unique user ID
  generateUserId(): string {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },
};

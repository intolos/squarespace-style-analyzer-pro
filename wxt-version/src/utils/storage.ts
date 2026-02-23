// utils/storage.ts
// Handles loading and saving of user-specific data

export interface UserData {
  usageCount: number;
  isPremium: boolean;
  userId: string;
  analyzedDomains: string[];
  licenseEmail?: string;
  licenseData?: any;
  premiumPageAnalyses?: number;
  premiumDomainAnalyses?: number;
  premiumModalShown?: boolean;
  reviewModalDismissed?: boolean;
}

export const StorageManager = {
  // Load user data from Chrome storage
  async loadUserData(): Promise<UserData> {
    const data = await chrome.storage.local.get([
      'usageCount',
      'isPremium',
      'userId',
      'analyzedDomains',
      'licenseEmail',
      'licenseData',
      'premiumPageAnalyses',
      'premiumDomainAnalyses',
      'premiumModalShown',
      'reviewModalDismissed',
    ]);

    return {
      usageCount: (data.usageCount as number) || 0,
      isPremium: (data.isPremium as boolean) || false,
      userId: (data.userId as string) || this.generateUserId(),
      analyzedDomains: (data.analyzedDomains as string[]) || [],
      licenseEmail: data.licenseEmail as string | undefined,
      licenseData: data.licenseData,
      premiumPageAnalyses: (data.premiumPageAnalyses as number) || 0,
      premiumDomainAnalyses: (data.premiumDomainAnalyses as number) || 0,
      premiumModalShown: (data.premiumModalShown as boolean) || false,
      reviewModalDismissed: (data.reviewModalDismissed as boolean) || false,
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
      licenseEmail: userData.licenseEmail,
      licenseData: userData.licenseData,
      premiumPageAnalyses: userData.premiumPageAnalyses,
      premiumDomainAnalyses: userData.premiumDomainAnalyses,
      premiumModalShown: userData.premiumModalShown,
      reviewModalDismissed: userData.reviewModalDismissed,
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

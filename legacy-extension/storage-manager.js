// storage-manager.js - User Data and Storage Management
// Handles loading and saving of user-specific data (not results)

const StorageManager = {
  // ============================================
  // USER DATA OPERATIONS
  // ============================================

  // Load user data from Chrome storage
  loadUserData: async function () {
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
  saveUserData: async function (userData) {
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
  ensureUserId: async function (userId) {
    const data = await chrome.storage.local.get(['userId']);
    if (!data.userId) {
      await chrome.storage.local.set({ userId: userId });
    }
  },

  // Generate a unique user ID
  generateUserId: function () {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },
};

// Make globally available
window.StorageManager = StorageManager;

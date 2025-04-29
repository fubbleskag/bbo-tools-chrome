// BBO Tools - Background Script
// Author: fubbleskag

// Define default settings for modules
const DEFAULT_SETTINGS = {
  modules: {
    filters: {
      enabled: true,
      name: "Table Filters",
      description: "Filter and sort tables with custom criteria"
    }
    // Additional modules can be added here later
  }
};

// Initialize settings when extension is installed
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    // Set default settings
    chrome.storage.sync.set({ settings: DEFAULT_SETTINGS }, () => {
      console.log('BBO Tools: Default settings initialized');
    });
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSettings') {
    // Return current settings
    chrome.storage.sync.get('settings', (data) => {
      sendResponse(data.settings || DEFAULT_SETTINGS);
    });
    return true; // Required for asynchronous response
  }
  
  if (message.action === 'saveSettings') {
    // Save updated settings
    chrome.storage.sync.set({ settings: message.settings }, () => {
      sendResponse({ success: true });
      
      // Notify content scripts of updated settings
      chrome.tabs.query({ url: '*://*.bridgebase.com/*' }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { 
            action: 'settingsUpdated', 
            settings: message.settings 
          });
        });
      });
    });
    return true; // Required for asynchronous response
  }
});
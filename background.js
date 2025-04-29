// BBO Tools - Background Script
// Author: fubbleskag

// Define default settings for features
const DEFAULT_SETTINGS = {
  features: {
    tableFilters: {
      enabled: true,
      name: "Table Filters",
      description: "Filter and sort tables with custom criteria"
    }
    // Additional features can be added here later
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
      // If no settings found, use defaults and save them
      if (!data || !data.settings) {
        console.log('BBO Tools: No settings found, using defaults');
        chrome.storage.sync.set({ settings: DEFAULT_SETTINGS }, () => {
          console.log('BBO Tools: Default settings saved');
        });
        sendResponse(DEFAULT_SETTINGS);
      } else {
        // Make sure features object exists
        if (!data.settings.features) {
          data.settings.features = DEFAULT_SETTINGS.features;
          chrome.storage.sync.set({ settings: data.settings }, () => {
            console.log('BBO Tools: Fixed missing features object');
          });
        }
        sendResponse(data.settings);
      }
    });
    return true; // Required for asynchronous response
  }
  
  if (message.action === 'saveSettings') {
    // Get current settings first
    chrome.storage.sync.get('settings', (data) => {
      const currentSettings = data.settings || DEFAULT_SETTINGS;
      
      // Make sure settings and features objects exist
      let updatedSettings = message.settings;
      if (!updatedSettings) {
        updatedSettings = currentSettings;
      }
      
      if (!updatedSettings.features) {
        updatedSettings.features = currentSettings.features || DEFAULT_SETTINGS.features;
      }
      
      // Save updated settings
      chrome.storage.sync.set({ settings: updatedSettings }, () => {
        sendResponse({ success: true });
        
        // Notify content scripts of updated settings
        chrome.tabs.query({ url: '*://*.bridgebase.com/*' }, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { 
              action: 'settingsUpdated', 
              settings: updatedSettings 
            });
          });
        });
      });
    });
    return true; // Required for asynchronous response
  }
});
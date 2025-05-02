// BBO Tools - Background Script
// Author: fubbleskag

// Use browser API with fallback to chrome for maximum compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

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

// Feature detection for storage
const storageAPI = (function() {
  // Try to detect if sync storage is available
  try {
    // Check if sync storage exists
    if (browserAPI.storage && browserAPI.storage.sync) {
      return {
        get: function(keys) {
          return new Promise((resolve, reject) => {
            browserAPI.storage.sync.get(keys, (result) => {
              if (browserAPI.runtime.lastError) {
                console.warn('Error with sync storage, falling back to local', browserAPI.runtime.lastError);
                // Fall back to local storage
                browserAPI.storage.local.get(keys, (localResult) => {
                  if (browserAPI.runtime.lastError) {
                    reject(browserAPI.runtime.lastError);
                  } else {
                    resolve(localResult);
                  }
                });
              } else {
                resolve(result);
              }
            });
          });
        },
        set: function(items) {
          return new Promise((resolve, reject) => {
            browserAPI.storage.sync.set(items, () => {
              if (browserAPI.runtime.lastError) {
                console.warn('Error with sync storage, falling back to local', browserAPI.runtime.lastError);
                // Fall back to local storage
                browserAPI.storage.local.set(items, () => {
                  if (browserAPI.runtime.lastError) {
                    reject(browserAPI.runtime.lastError);
                  } else {
                    resolve({ success: true, storage: 'local' });
                  }
                });
              } else {
                resolve({ success: true, storage: 'sync' });
              }
            });
          });
        }
      };
    }
  } catch (error) {
    console.error('Error detecting storage API', error);
  }
  
  // Fallback to local storage
  return {
    get: function(keys) {
      return new Promise((resolve, reject) => {
        browserAPI.storage.local.get(keys, (result) => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      });
    },
    set: function(items) {
      return new Promise((resolve, reject) => {
        browserAPI.storage.local.set(items, () => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve({ success: true, storage: 'local' });
          }
        });
      });
    }
  };
})();

// Initialize settings when extension is installed
browserAPI.runtime.onInstalled.addListener(({ reason }) => {
  try {
    if (reason === 'install') {
      // Set default settings
      storageAPI.set({ settings: DEFAULT_SETTINGS })
        .then(() => {
          console.log('BBO Tools: Default settings initialized');
        })
        .catch(error => {
          console.error('BBO Tools: Error initializing settings', error);
        });
    }
  } catch (error) {
    console.error('BBO Tools: Error during installation', error);
  }
});

// Function to get settings with validation and error handling
function getSettings() {
  return new Promise((resolve, reject) => {
    try {
      storageAPI.get('settings')
        .then(data => {
          // If no settings found, use defaults
          if (!data || !data.settings) {
            console.log('BBO Tools: No settings found, using defaults');
            return resolve({ ...DEFAULT_SETTINGS });
          }
          
          // Validate settings structure
          if (typeof data.settings !== 'object') {
            console.warn('BBO Tools: Invalid settings format, using defaults');
            return resolve({ ...DEFAULT_SETTINGS });
          }
          
          // Make sure features object exists
          if (!data.settings.features) {
            console.log('BBO Tools: No features found, adding defaults');
            data.settings.features = { ...DEFAULT_SETTINGS.features };
            
            // Save the fixed settings
            storageAPI.set({ settings: data.settings })
              .then(() => {
                console.log('BBO Tools: Fixed missing features object');
              })
              .catch(error => {
                console.warn('BBO Tools: Error saving fixed settings', error);
              });
          }
          
          resolve(data.settings);
        })
        .catch(error => {
          console.error('BBO Tools: Error getting settings', error);
          resolve({ ...DEFAULT_SETTINGS }); // Fall back to defaults
        });
    } catch (error) {
      console.error('BBO Tools: Unexpected error getting settings', error);
      resolve({ ...DEFAULT_SETTINGS }); // Fall back to defaults in case of any error
    }
  });
}

// Function to save settings with validation
function saveSettings(settings) {
  return new Promise((resolve, reject) => {
    try {
      // Validate settings
      if (!settings || typeof settings !== 'object') {
        console.warn('BBO Tools: Invalid settings object, using defaults');
        settings = { ...DEFAULT_SETTINGS };
      }
      
      // Ensure features object exists
      if (!settings.features) {
        settings.features = { ...DEFAULT_SETTINGS.features };
      }
      
      // Save settings
      storageAPI.set({ settings })
        .then(result => {
          resolve(result);
        })
        .catch(error => {
          console.error('BBO Tools: Error saving settings', error);
          reject(error);
        });
    } catch (error) {
      console.error('BBO Tools: Unexpected error saving settings', error);
      reject(error);
    }
  });
}

// Message handling with Promise-based approach
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    // Handle getSettings message
    if (message.action === 'getSettings') {
      getSettings()
        .then(settings => {
          sendResponse(settings);
        })
        .catch(error => {
          console.error('BBO Tools: Error getting settings', error);
          sendResponse({ ...DEFAULT_SETTINGS });
        });
      
      return true; // Keep the message channel open for the async response
    }
    
    // Handle saveSettings message
    if (message.action === 'saveSettings') {
      // Get current settings first
      getSettings()
        .then(currentSettings => {
          // Create updated settings by merging with current settings
          let updatedSettings = message.settings || {};
          
          if (!updatedSettings.features) {
            updatedSettings.features = { ...currentSettings.features };
          }
          
          // Save the updated settings
          return saveSettings(updatedSettings);
        })
        .then(() => {
          sendResponse({ success: true });
          
          // Notify all content scripts about the updated settings
          return notifyTabsAboutSettingsChange(message.settings);
        })
        .catch(error => {
          console.error('BBO Tools: Error in saveSettings flow', error);
          sendResponse({ success: false, error: error.message });
        });
      
      return true; // Keep the message channel open for the async response
    }
  } catch (error) {
    console.error('BBO Tools: Unexpected error in message handler', error);
    sendResponse({ success: false, error: error.message });
    return true;
  }
});

// Helper function to notify all tabs about settings changes
function notifyTabsAboutSettingsChange(settings) {
  return new Promise((resolve, reject) => {
    try {
      browserAPI.tabs.query({ url: '*://*.bridgebase.com/*' })
        .then(tabs => {
          const messagePromises = [];
          
          tabs.forEach(tab => {
            messagePromises.push(
              new Promise((resolveMessage) => {
                browserAPI.tabs.sendMessage(
                  tab.id, 
                  { action: 'settingsUpdated', settings: settings }
                ).then(() => {
                  resolveMessage();
                }).catch(error => {
                  console.warn(`Error sending message to tab ${tab.id}`, error);
                  resolveMessage(); // Resolve anyway to continue with other tabs
                });
              })
            );
          });
          
          // Wait for all messages to be sent (or fail)
          Promise.all(messagePromises)
            .then(() => {
              resolve();
            })
            .catch(error => {
              console.warn('Some errors occurred notifying tabs', error);
              resolve(); // Resolve anyway
            });
        })
        .catch(error => {
          console.error('Error querying tabs', error);
          reject(error);
        });
    } catch (error) {
      console.error('Unexpected error notifying tabs', error);
      reject(error);
    }
  });
}

// Log extension initialization
console.log('BBO Tools: Background script initialized');
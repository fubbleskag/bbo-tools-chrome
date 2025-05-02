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

/**
 * Validates the settings object structure and values
 * @param {Object} settings - The settings object to validate
 * @returns {Object} - Object with validation result and optional fixed settings
 */
function validateSettings(settings) {
  // First, check if settings exists and is an object
  if (!settings || typeof settings !== 'object') {
    console.warn('BBO Tools: Settings is not an object, using defaults');
    return {
      valid: false,
      fixedSettings: { ...DEFAULT_SETTINGS }
    };
  }
  
  // Create a working copy to avoid modifying the original directly
  const validatedSettings = { ...settings };
  let wasFixed = false;
  
  // Ensure features object exists
  if (!validatedSettings.features || typeof validatedSettings.features !== 'object') {
    console.warn('BBO Tools: Features is missing or not an object, adding defaults');
    validatedSettings.features = { ...DEFAULT_SETTINGS.features };
    wasFixed = true;
  }
  
  // Validate each feature
  for (const featureId in validatedSettings.features) {
    const feature = validatedSettings.features[featureId];
    
    // Check if feature is an object
    if (!feature || typeof feature !== 'object') {
      console.warn(`BBO Tools: Feature ${featureId} is invalid, fixing`);
      // If we have a default for this feature, use it, otherwise remove it
      if (DEFAULT_SETTINGS.features[featureId]) {
        validatedSettings.features[featureId] = { ...DEFAULT_SETTINGS.features[featureId] };
      } else {
        delete validatedSettings.features[featureId];
      }
      wasFixed = true;
      continue;
    }
    
    // Validate 'enabled' property
    if (typeof feature.enabled !== 'boolean') {
      console.warn(`BBO Tools: Feature ${featureId} has invalid 'enabled' property, fixing`);
      // If we have a default, use that, otherwise default to true
      if (DEFAULT_SETTINGS.features[featureId]) {
        feature.enabled = DEFAULT_SETTINGS.features[featureId].enabled;
      } else {
        feature.enabled = true; // Default to enabled
      }
      wasFixed = true;
    }
    
    // Validate name and description
    if (!feature.name || typeof feature.name !== 'string') {
      console.warn(`BBO Tools: Feature ${featureId} has invalid 'name' property, fixing`);
      feature.name = DEFAULT_SETTINGS.features[featureId]?.name || featureId;
      wasFixed = true;
    }
    
    if (!feature.description || typeof feature.description !== 'string') {
      console.warn(`BBO Tools: Feature ${featureId} has invalid 'description' property, fixing`);
      feature.description = DEFAULT_SETTINGS.features[featureId]?.description || '';
      wasFixed = true;
    }
  }
  
  // Ensure all default features exist
  for (const defaultFeatureId in DEFAULT_SETTINGS.features) {
    if (!validatedSettings.features[defaultFeatureId]) {
      console.warn(`BBO Tools: Default feature ${defaultFeatureId} is missing, adding it`);
      validatedSettings.features[defaultFeatureId] = { ...DEFAULT_SETTINGS.features[defaultFeatureId] };
      wasFixed = true;
    }
  }
  
  return {
    valid: !wasFixed, // If we had to fix anything, it wasn't valid
    fixedSettings: validatedSettings
  };
}

/**
 * Gets settings with validation and auto-correction
 * @returns {Promise<Object>} - Promise that resolves to the validated settings
 */
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
          
          // Validate the settings
          const validation = validateSettings(data.settings);
          
          // If settings had to be fixed, save the fixed version
          if (!validation.valid) {
            console.log('BBO Tools: Settings were invalid, fixed and saving corrected version');
            
            // Save the fixed settings
            storageAPI.set({ settings: validation.fixedSettings })
              .then(() => {
                console.log('BBO Tools: Fixed settings saved successfully');
              })
              .catch(error => {
                console.warn('BBO Tools: Error saving fixed settings', error);
              });
          }
          
          resolve(validation.fixedSettings);
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

/**
 * Saves settings with validation
 * @param {Object} settings - The settings to save
 * @returns {Promise<Object>} - Promise that resolves when settings are saved
 */
function saveSettings(settings) {
  return new Promise((resolve, reject) => {
    try {
      // Validate settings first
      const validation = validateSettings(settings);
      
      // Always use the validated/fixed settings
      const settingsToSave = validation.fixedSettings;
      
      // If settings were invalid, log a warning
      if (!validation.valid) {
        console.warn('BBO Tools: Invalid settings provided, using fixed version');
      }
      
      // Save settings
      storageAPI.set({ settings: settingsToSave })
        .then(result => {
          resolve({
            ...result,
            validationApplied: !validation.valid // Indicate if validation fixes were applied
          });
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
          sendResponse({
            error: 'Failed to get settings',
            fallbackUsed: true,
            settings: { ...DEFAULT_SETTINGS }
          });
        });
      
      return true; // Keep the message channel open for the async response
    }
    
    // Handle saveSettings message with improved validation
    if (message.action === 'saveSettings') {
      // Validate settings first
      const providedSettings = message.settings || {};
      
      // Call the enhanced saveSettings function that includes validation
      saveSettings(providedSettings)
        .then(result => {
          // Include validation info in response
          sendResponse({
            success: true,
            validationApplied: result.validationApplied || false,
            storage: result.storage
          });
          
          // Notify all content scripts about the updated settings
          return notifyTabsAboutSettingsChange(providedSettings);
        })
        .catch(error => {
          console.error('BBO Tools: Error in saveSettings flow', error);
          sendResponse({
            success: false,
            error: error.message,
            errorCode: 'SAVE_FAILED'
          });
        });
      
      return true; // Keep the message channel open for the async response
    }
  } catch (error) {
    console.error('BBO Tools: Unexpected error in message handler', error);
    sendResponse({
      success: false,
      error: error.message,
      errorCode: 'UNEXPECTED_ERROR'
    });
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
// BBO Tools - Storage Manager
// Provides abstraction for extension storage with validation and fallback support

(function(exports) {
  'use strict';

  // Get dependencies
  const BrowserAPI = window.BBOTools?.modules?.BrowserAPI || 
                    (typeof browser !== 'undefined' ? browser : chrome);

  // Default settings structure
  const DEFAULT_SETTINGS = {
    features: {
      tableFilters: {
        enabled: true,
        name: "Table Filters",
        description: "Filter and sort tables with custom criteria"
      }
    }
  };

  const StorageManager = {
    // Store reference to browser API
    _browserAPI: BrowserAPI,

    // Get settings with validation and fallback
    async get(key = 'settings') {
      try {
        // Try sync storage first
        const result = await this._getFromStorage('sync', key);
        
        if (result[key]) {
          // Validate settings if it's the settings key
          if (key === 'settings') {
            return this._validateSettings(result[key]);
          }
          return result[key];
        }

        // Fallback to local storage
        const localResult = await this._getFromStorage('local', key);
        
        if (localResult[key]) {
          if (key === 'settings') {
            return this._validateSettings(localResult[key]);
          }
          return localResult[key];
        }

        // Return defaults if nothing found
        if (key === 'settings') {
          return { ...DEFAULT_SETTINGS };
        }
        
        return null;
      } catch (error) {
        console.error('StorageManager: Error getting data', error);
        
        // Return defaults for settings key
        if (key === 'settings') {
          return { ...DEFAULT_SETTINGS };
        }
        
        return null;
      }
    },

    // Set data in storage with fallback support
    async set(key, value) {
      try {
        // Validate settings if it's the settings key
        let dataToStore = value;
        if (key === 'settings') {
          dataToStore = this._validateSettings(value);
        }

        // Try sync storage first
        try {
          await this._setInStorage('sync', { [key]: dataToStore });
          return { success: true, storage: 'sync' };
        } catch (syncError) {
          console.warn('StorageManager: Sync storage failed, falling back to local', syncError);
          
          // Fallback to local storage
          await this._setInStorage('local', { [key]: dataToStore });
          return { success: true, storage: 'local' };
        }
      } catch (error) {
        console.error('StorageManager: Error setting data', error);
        throw error;
      }
    },

    // Clear all extension data
    async clear() {
      try {
        await Promise.all([
          this._clearStorage('sync'),
          this._clearStorage('local')
        ]);
        return { success: true };
      } catch (error) {
        console.error('StorageManager: Error clearing data', error);
        throw error;
      }
    },

    // Get storage usage
    async getStorageInfo() {
      try {
        const syncInfo = await this._getStorageInfo('sync');
        const localInfo = await this._getStorageInfo('local');
        
        return {
          sync: syncInfo,
          local: localInfo
        };
      } catch (error) {
        console.error('StorageManager: Error getting storage info', error);
        return null;
      }
    },

    // Private helper methods
    _getFromStorage(storageType, key) {
      return new Promise((resolve, reject) => {
        const storage = this._browserAPI.storage[storageType];
        
        if (!storage) {
          reject(new Error(`Storage type "${storageType}" not available`));
          return;
        }

        storage.get(key, (result) => {
          if (this._browserAPI.runtime.lastError) {
            reject(new Error(this._browserAPI.runtime.lastError.message));
          } else {
            resolve(result);
          }
        });
      });
    },

    _setInStorage(storageType, items) {
      return new Promise((resolve, reject) => {
        const storage = this._browserAPI.storage[storageType];
        
        if (!storage) {
          reject(new Error(`Storage type "${storageType}" not available`));
          return;
        }

        storage.set(items, () => {
          if (this._browserAPI.runtime.lastError) {
            reject(new Error(this._browserAPI.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    },

    _clearStorage(storageType) {
      return new Promise((resolve, reject) => {
        const storage = this._browserAPI.storage[storageType];
        
        if (!storage) {
          reject(new Error(`Storage type "${storageType}" not available`));
          return;
        }

        storage.clear(() => {
          if (this._browserAPI.runtime.lastError) {
            reject(new Error(this._browserAPI.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    },

    _getStorageInfo(storageType) {
      return new Promise((resolve, reject) => {
        const storage = this._browserAPI.storage[storageType];
        
        if (!storage || !storage.getBytesInUse) {
          resolve({ bytesInUse: 0, quota: 0 });
          return;
        }

        storage.getBytesInUse(null, (bytesInUse) => {
          if (this._browserAPI.runtime.lastError) {
            reject(new Error(this._browserAPI.runtime.lastError.message));
          } else {
            resolve({
              bytesInUse: bytesInUse,
              quota: storage.QUOTA_BYTES || 0
            });
          }
        });
      });
    },

    // Validate and fix settings structure
    _validateSettings(settings) {
      // Create a copy to avoid modifying the original
      const validatedSettings = { ...settings };
      let wasFixed = false;

      // Ensure features object exists
      if (!validatedSettings.features || typeof validatedSettings.features !== 'object') {
        validatedSettings.features = { ...DEFAULT_SETTINGS.features };
        wasFixed = true;
      }

      // Validate each feature
      for (const featureId in validatedSettings.features) {
        const feature = validatedSettings.features[featureId];

        // Check if feature is an object
        if (!feature || typeof feature !== 'object') {
          // If we have a default for this feature, use it
          if (DEFAULT_SETTINGS.features[featureId]) {
            validatedSettings.features[featureId] = { ...DEFAULT_SETTINGS.features[featureId] };
          } else {
            // Remove invalid feature
            delete validatedSettings.features[featureId];
          }
          wasFixed = true;
          continue;
        }

        // Validate 'enabled' property
        if (typeof feature.enabled !== 'boolean') {
          if (DEFAULT_SETTINGS.features[featureId]) {
            feature.enabled = DEFAULT_SETTINGS.features[featureId].enabled;
          } else {
            feature.enabled = true; // Default to enabled
          }
          wasFixed = true;
        }

        // Validate 'name' property
        if (!feature.name || typeof feature.name !== 'string') {
          feature.name = DEFAULT_SETTINGS.features[featureId]?.name || featureId;
          wasFixed = true;
        }

        // Validate 'description' property
        if (!feature.description || typeof feature.description !== 'string') {
          feature.description = DEFAULT_SETTINGS.features[featureId]?.description || '';
          wasFixed = true;
        }
      }

      // Ensure all default features exist
      for (const defaultFeatureId in DEFAULT_SETTINGS.features) {
        if (!validatedSettings.features[defaultFeatureId]) {
          validatedSettings.features[defaultFeatureId] = { ...DEFAULT_SETTINGS.features[defaultFeatureId] };
          wasFixed = true;
        }
      }

      if (wasFixed) {
        console.warn('StorageManager: Settings were validated and fixed');
      }

      return validatedSettings;
    }
  };

  // Export for both module systems
  if (typeof window !== 'undefined' && window.BBOTools) {
    window.BBOTools.modules.StorageManager = StorageManager;
    console.log('BBOTools: StorageManager module registered');
  }
  
  // ES module export
  if (typeof exports !== 'undefined') {
    exports.StorageManager = StorageManager;
  }

})(typeof exports !== 'undefined' ? exports : {});
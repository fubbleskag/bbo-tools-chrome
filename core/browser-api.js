// BBO Tools - Browser API Abstraction
// Provides a unified API for browser-specific functionality

(function(exports) {
  'use strict';

  // Detect which browser API to use
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  const BrowserAPI = {
    // Core browser APIs
    runtime: browserAPI.runtime,
    storage: browserAPI.storage,
    tabs: browserAPI.tabs,
    
    // Promise-based wrapper for tabs.sendMessage
    sendMessageToTab(tabId, message) {
      return new Promise((resolve, reject) => {
        browserAPI.tabs.sendMessage(tabId, message)
          .then(resolve)
          .catch(error => {
            // Handle Chrome's callback-style API
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              reject(error);
            }
          });
      });
    },

    // Promise-based wrapper for runtime.sendMessage
    sendMessage(message) {
      return new Promise((resolve, reject) => {
        browserAPI.runtime.sendMessage(message)
          .then(resolve)
          .catch(error => {
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              reject(error);
            }
          });
      });
    },

    // Query tabs with promise support
    queryTabs(queryInfo) {
      return new Promise((resolve, reject) => {
        browserAPI.tabs.query(queryInfo)
          .then(resolve)
          .catch(error => {
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              reject(error);
            }
          });
      });
    },

    // Get extension manifest
    getManifest() {
      return browserAPI.runtime.getManifest();
    },

    // Check if we have a specific permission
    hasPermission(permission) {
      return new Promise((resolve, reject) => {
        if (browserAPI.permissions && browserAPI.permissions.contains) {
          browserAPI.permissions.contains({ permissions: [permission] })
            .then(resolve)
            .catch(reject);
        } else {
          // Fallback for browsers without permissions API
          resolve(false);
        }
      });
    },

    // Add event listener with automatic cleanup
    addListener(eventName, callback) {
      const parts = eventName.split('.');
      let obj = browserAPI;

      for (let i = 0; i < parts.length - 1; i++) {
        obj = obj[parts[i]];
        if (!obj) {
          console.warn(`BrowserAPI: Event ${eventName} not found`);
          return null;
        }
      }

      const event = obj[parts[parts.length - 1]];
      if (!event || !event.addListener) {
        console.warn(`BrowserAPI: Event ${eventName} does not have addListener`);
        return null;
      }

      event.addListener(callback);

      // Return cleanup function
      return function cleanup() {
        if (event && event.removeListener) {
          event.removeListener(callback);
        }
      };
    },

    // Get the current tab
    getCurrentTab() {
      return new Promise((resolve, reject) => {
        browserAPI.tabs.getCurrent()
          .then(resolve)
          .catch(error => {
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              reject(error);
            }
          });
      });
    },

    // Execute script in a tab
    executeScript(tabId, details) {
      return new Promise((resolve, reject) => {
        browserAPI.tabs.executeScript(tabId, details)
          .then(resolve)
          .catch(error => {
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              reject(error);
            }
          });
      });
    }
  };

  // Export for both module systems
  if (typeof window !== 'undefined' && window.BBOTools) {
    window.BBOTools.modules.BrowserAPI = BrowserAPI;
    console.log('BBOTools: BrowserAPI module registered');
  }
  
  // ES module export
  if (typeof exports !== 'undefined') {
    exports.BrowserAPI = BrowserAPI;
  }

})(typeof exports !== 'undefined' ? exports : {});
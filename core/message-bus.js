// BBO Tools - Message Bus
// Provides inter-component communication within the extension

(function(exports) {
  'use strict';

  // Get dependencies
  const BrowserAPI = window.BBOTools?.modules?.BrowserAPI || 
                    (typeof browser !== 'undefined' ? browser : chrome);

  const MessageBus = {
    // Store reference to browser API
    _browserAPI: BrowserAPI,
    
    // Message handlers registry
    _handlers: new Map(),
    
    // Active listeners for cleanup
    _listeners: [],

    // Initialize the message bus
    init() {
      // Remove any existing listeners first
      this.destroy();

      // Set up message listener
      const listener = (message, sender, sendResponse) => {
        // Handle async responses properly
        const handleResponse = this._handleMessage(message, sender);
        
        if (handleResponse instanceof Promise) {
          handleResponse
            .then(response => {
              sendResponse(response);
            })
            .catch(error => {
              console.error('MessageBus: Error handling message', error);
              sendResponse({
                success: false,
                error: error.message || 'Unknown error'
              });
            });
          
          // Keep message channel open for async response
          return true;
        } else {
          // Sync response
          sendResponse(handleResponse);
          return false;
        }
      };

      this._browserAPI.runtime.onMessage.addListener(listener);
      this._listeners.push({
        type: 'runtime.onMessage',
        listener: listener
      });

      console.log('MessageBus: Initialized');
    },

    // Clean up all listeners
    destroy() {
      this._listeners.forEach(({ type, listener }) => {
        const parts = type.split('.');
        let obj = this._browserAPI;
        
        for (let i = 0; i < parts.length - 1; i++) {
          obj = obj[parts[i]];
        }
        
        const event = obj[parts[parts.length - 1]];
        if (event && event.removeListener) {
          event.removeListener(listener);
        }
      });
      
      this._listeners = [];
      this._handlers.clear();
      
      console.log('MessageBus: Destroyed');
    },

    // Register a message handler
    on(action, handler) {
      if (typeof handler !== 'function') {
        throw new Error('Handler must be a function');
      }

      if (!this._handlers.has(action)) {
        this._handlers.set(action, []);
      }

      this._handlers.get(action).push(handler);

      // Return unsubscribe function
      return () => {
        const handlers = this._handlers.get(action);
        if (handlers) {
          const index = handlers.indexOf(handler);
          if (index !== -1) {
            handlers.splice(index, 1);
          }
          if (handlers.length === 0) {
            this._handlers.delete(action);
          }
        }
      };
    },

    // Remove a specific handler or all handlers for an action
    off(action, handler) {
      if (!handler) {
        // Remove all handlers for this action
        this._handlers.delete(action);
        return;
      }

      const handlers = this._handlers.get(action);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
        if (handlers.length === 0) {
          this._handlers.delete(action);
        }
      }
    },

    // Send a message to the background script
    async sendToBackground(action, data = {}) {
      try {
        const message = { action, ...data };
        return await this._browserAPI.runtime.sendMessage(message);
      } catch (error) {
        console.error(`MessageBus: Error sending message to background`, error);
        throw error;
      }
    },

    // Send a message to a specific tab
    async sendToTab(tabId, action, data = {}) {
      try {
        const message = { action, ...data };
        return await this._browserAPI.tabs.sendMessage(tabId, message);
      } catch (error) {
        console.error(`MessageBus: Error sending message to tab ${tabId}`, error);
        throw error;
      }
    },

    // Send a message to all tabs matching a pattern
    async sendToTabs(urlPattern, action, data = {}) {
      try {
        const tabs = await this._browserAPI.tabs.query({ url: urlPattern });
        const message = { action, ...data };
        
        const results = await Promise.allSettled(
          tabs.map(tab => this._browserAPI.tabs.sendMessage(tab.id, message))
        );

        return {
          success: true,
          results: results.map((result, index) => ({
            tabId: tabs[index].id,
            status: result.status,
            value: result.status === 'fulfilled' ? result.value : undefined,
            error: result.status === 'rejected' ? result.reason : undefined
          }))
        };
      } catch (error) {
        console.error('MessageBus: Error sending message to tabs', error);
        throw error;
      }
    },

    // Broadcast a message to all BBO tabs
    async broadcastToBBO(action, data = {}) {
      return this.sendToTabs('*://*.bridgebase.com/*', action, data);
    },

    // Internal message handler
    async _handleMessage(message, sender) {
      const { action } = message;
      
      if (!action) {
        return {
          success: false,
          error: 'No action specified'
        };
      }

      const handlers = this._handlers.get(action);
      
      if (!handlers || handlers.length === 0) {
        console.log(`MessageBus: No handlers for action "${action}"`);
        return {
          success: false,
          error: `No handlers for action "${action}"`
        };
      }

      try {
        // Execute all handlers and collect results
        const results = await Promise.allSettled(
          handlers.map(handler => handler(message, sender))
        );

        // Find the first successful result
        const successfulResult = results.find(
          result => result.status === 'fulfilled' && result.value
        );

        if (successfulResult) {
          return successfulResult.value;
        }

        // If no handler returned a result, return a default response
        return {
          success: true,
          handled: true
        };
      } catch (error) {
        console.error(`MessageBus: Error executing handlers for action "${action}"`, error);
        return {
          success: false,
          error: error.message || 'Unknown error'
        };
      }
    },

    // Helper method to create a request-response pattern
    async request(target, action, data = {}, timeout = 5000) {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Request timeout for action "${action}"`));
        }, timeout);

        const handler = async () => {
          try {
            let response;
            
            if (target === 'background') {
              response = await this.sendToBackground(action, data);
            } else if (typeof target === 'number') {
              response = await this.sendToTab(target, action, data);
            } else {
              throw new Error('Invalid target specified');
            }

            clearTimeout(timeoutId);
            resolve(response);
          } catch (error) {
            clearTimeout(timeoutId);
            reject(error);
          }
        };

        handler();
      });
    }
  };

  // Export for both module systems
  if (typeof window !== 'undefined' && window.BBOTools) {
    window.BBOTools.modules.MessageBus = MessageBus;
    console.log('BBOTools: MessageBus module registered');
  }
  
  // ES module export
  if (typeof exports !== 'undefined') {
    exports.MessageBus = MessageBus;
  }

})(typeof exports !== 'undefined' ? exports : {});
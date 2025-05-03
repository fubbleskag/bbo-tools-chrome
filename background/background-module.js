// BBO Tools - Modular Background Script
// Author: fubbleskag

// Import core modules using the compatibility layer
(function() {
  'use strict';

  // Import dependencies
  const BrowserAPI = window.BBOTools?.modules?.BrowserAPI || 
                    (typeof browser !== 'undefined' ? browser : chrome);
  const StorageManager = window.BBOTools?.modules?.StorageManager;
  const MessageBus = window.BBOTools?.modules?.MessageBus;
  const Logger = window.BBOTools?.modules?.Logger;

  // Initialize logger for background context
  Logger.init({
    level: 'INFO',
    prefix: 'BBOTools:BG'
  });

  // Background module
  const BackgroundModule = {
    // Initialize the background script
    async init() {
      Logger.info('Initializing background module');

      try {
        // Initialize MessageBus
        MessageBus.init();

        // Set up message handlers
        this.setupMessageHandlers();

        // Set up installation and startup handlers
        this.setupInstallationHandler();

        // Initialize features from settings
        await this.initializeFeaturesFromSettings();

        Logger.info('Background module initialized successfully');
      } catch (error) {
        Logger.error('Error initializing background module', error);
      }
    },

    // Set up message handlers
    setupMessageHandlers() {
      // Handle getSettings message
      MessageBus.on('getSettings', async (message, sender) => {
        Logger.debug('Handling getSettings request');
        
        try {
          const settings = await StorageManager.get('settings');
          return settings;
        } catch (error) {
          Logger.error('Error getting settings', error);
          return {
            error: 'Failed to get settings',
            fallbackUsed: true,
            settings: { 
              features: {
                tableFilters: {
                  enabled: true,
                  name: "Table Filters",
                  description: "Filter and sort tables with custom criteria"
                }
              }
            }
          };
        }
      });

      // Handle saveSettings message
      MessageBus.on('saveSettings', async (message, sender) => {
        Logger.debug('Handling saveSettings request');
        
        try {
          const { settings } = message;
          
          if (!settings) {
            throw new Error('No settings provided');
          }

          const result = await StorageManager.set('settings', settings);
          
          // Notify all content scripts about the updated settings
          await this.notifyTabsAboutSettingsChange(settings);

          return {
            success: true,
            storage: result.storage
          };
        } catch (error) {
          Logger.error('Error saving settings', error);
          return {
            success: false,
            error: error.message,
            errorCode: 'SAVE_FAILED'
          };
        }
      });

      Logger.info('Message handlers set up');
    },

    // Set up installation handler
    setupInstallationHandler() {
      BrowserAPI.runtime.onInstalled.addListener(async ({ reason }) => {
        Logger.info(`Extension ${reason}`);
        
        if (reason === 'install') {
          try {
            // Set default settings
            const defaultSettings = {
              features: {
                tableFilters: {
                  enabled: true,
                  name: "Table Filters",
                  description: "Filter and sort tables with custom criteria"
                }
              }
            };

            await StorageManager.set('settings', defaultSettings);
            Logger.info('Default settings initialized');
          } catch (error) {
            Logger.error('Error initializing settings', error);
          }
        }
      });
    },

    // Initialize features based on stored settings
    async initializeFeaturesFromSettings() {
      try {
        const settings = await StorageManager.get('settings');
        
        // In the future, we'll initialize features here based on settings
        Logger.info('Features initialized from settings', settings);
      } catch (error) {
        Logger.error('Error initializing features from settings', error);
      }
    },

    // Notify all tabs about settings changes
    async notifyTabsAboutSettingsChange(settings) {
      try {
        const result = await MessageBus.broadcastToBBO('settingsUpdated', { settings });
        
        Logger.info('Notified tabs about settings change', result);
      } catch (error) {
        Logger.error('Error notifying tabs about settings change', error);
        // Don't throw - continue even if notification fails
      }
    },

    // Clean up resources
    destroy() {
      MessageBus.destroy();
      Logger.info('Background module destroyed');
    }
  };

  // Initialize the background module
  BackgroundModule.init();

  // Export for debugging and testing
  window.BBOTools = window.BBOTools || {};
  window.BBOTools.BackgroundModule = BackgroundModule;

})();
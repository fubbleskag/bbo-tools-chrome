// BBO Tools - Background Adapter
// This temporary file helps transition from the old background.js to the new modular structure
// It can be used to gradually migrate functionality while keeping the extension working

(function() {
  'use strict';

  console.log('BBO Tools: Background adapter loading');

  // Check if the new modular background is loaded
  if (window.BBOTools && window.BBOTools.BackgroundModule) {
    console.log('BBO Tools: Modular background already loaded');
    return;
  }

  // If the modular background isn't loaded, provide fallback functionality
  console.warn('BBO Tools: Falling back to adapter mode');

  // Original DEFAULT_SETTINGS for fallback
  const DEFAULT_SETTINGS = {
    features: {
      tableFilters: {
        enabled: true,
        name: "Table Filters",
        description: "Filter and sort tables with custom criteria"
      }
    }
  };

  // Minimal fallback message handling
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('BBO Tools: Adapter handling message', message.action);

    if (message.action === 'getSettings') {
      // Simple fallback - just return default settings
      sendResponse({ ...DEFAULT_SETTINGS });
      return true;
    }

    if (message.action === 'saveSettings') {
      // Simple fallback - acknowledge the save
      sendResponse({ success: true, storage: 'adapter' });
      return true;
    }

    // Unknown message
    sendResponse({ success: false, error: 'Unknown action' });
    return true;
  });

  console.log('BBO Tools: Background adapter initialized');
})();
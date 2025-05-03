// BBO Tools - Background Script Loader
// Author: fubbleskag
// This loader handles compatibility between Chrome MV3 (service workers) and Firefox (background pages)

// Use browser API with fallback to chrome for maximum compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Check if we're in a service worker context (Chrome MV3)
const isServiceWorker = typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope;

if (isServiceWorker) {
  console.log('BBO Tools: Running as service worker (Chrome MV3)');
  
  // For Chrome service workers, import core modules using importScripts
  self.importScripts(
    '../compatibility.js',
    '../core/browser-api.js',
    '../core/storage-manager.js',
    '../core/message-bus.js',
    '../core/logger.js',
    './background-module.js'
  );
} else {
  console.log('BBO Tools: Running as background page (Firefox)');
  
  // For Firefox, the scripts are loaded via manifest.json's background.scripts
  // So we just need to check that they're loaded
  if (typeof window.BBOTools === 'undefined') {
    console.error('BBO Tools: Core modules not loaded properly');
  }
}

// Keep the service worker alive (Chrome only)
if (isServiceWorker) {
  chrome.runtime.onConnect.addListener(function(port) {
    if (port.name === "keepalive") {
      port.onDisconnect.addListener(function() {
        // Re-establish connection to keep service worker alive
        chrome.runtime.connect({ name: "keepalive" });
      });
    }
  });
}
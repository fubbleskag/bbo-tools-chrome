// BBO Tools - Background Entry Point
// Author: fubbleskag
// This file serves as the entry point for the background script
// It loads the necessary modules and initializes the background functionality

// Check if this is Chrome MV3 (service worker)
const isServiceWorker = typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope;

if (isServiceWorker) {
  // Chrome MV3: Use importScripts
  try {
    importScripts(
      '../compatibility.js',
      '../core/browser-api.js',
      '../core/storage-manager.js',
      '../core/message-bus.js',
      '../core/logger.js',
      './background-module.js'
    );
    console.log('BBO Tools: Background modules loaded successfully (service worker)');
  } catch (error) {
    console.error('BBO Tools: Error loading background modules (service worker)', error);
  }
} else {
  // Firefox: Scripts are loaded via manifest, just initialize
  console.log('BBO Tools: Initializing background (background page)');
  
  // We need to ensure the modules are loaded before initializing
  // This is handled by the manifest's script loading order
}
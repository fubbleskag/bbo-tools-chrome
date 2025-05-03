// BBO Tools - Compatibility Layer
// This file provides a namespace-based module system for environments where ES modules aren't supported

(function(global) {
  'use strict';
  
  console.log('BBO Tools: Compatibility layer starting initialization');
  console.log('BBO Tools: Global object type:', typeof global);

  // Create the main namespace
  global.BBOTools = global.BBOTools || {};
  global.BBOTools.modules = global.BBOTools.modules || {};
  
  // Module loader function
  global.BBOTools.require = function(moduleName) {
    if (!global.BBOTools.modules[moduleName]) {
      console.warn(`BBO Tools: Module "${moduleName}" not found`);
      return null;
    }
    return global.BBOTools.modules[moduleName];
  };

  // Module registration function
  global.BBOTools.register = function(moduleName, module) {
    if (global.BBOTools.modules[moduleName]) {
      console.warn(`BBO Tools: Module "${moduleName}" is already registered`);
    }
    global.BBOTools.modules[moduleName] = module;
    return module;
  };

  // Utility function to check if running in content script context
  global.BBOTools.isContentScript = function() {
    return typeof window !== 'undefined' && 
           window.location && 
           !window.browser && 
           !window.chrome.runtime.getManifest;
  };

  // Utility function to check if running in background context
  global.BBOTools.isBackground = function() {
    return typeof window === 'undefined' || 
           (window.browser && window.browser.runtime && window.browser.runtime.getManifest);
  };

  // Utility function to check if running in popup context
  global.BBOTools.isPopup = function() {
    return typeof window !== 'undefined' && 
           window.location && 
           window.location.href.includes('popup.html');
  };

  // Version info
  global.BBOTools.version = '1.0.0';
  
  console.log('BBO Tools: Compatibility layer loaded');
  console.log('BBOTools object created:', global.BBOTools);
  
  // Debug: Check if we're in the right context
  if (typeof window !== 'undefined') {
    console.log('BBO Tools: Running in window context');
    console.log('window.BBO Tools:', window.BBOTools);
  } else {
    console.log('BBO Tools: Not running in window context');
  }

})(typeof window !== 'undefined' ? window : global);
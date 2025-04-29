// BBO Tools - Module Loader
// Author: fubbleskag

// Initialize the module system
(() => {
  console.log('BBO Tools: Module loader initialized');
  
  // Store loaded modules and their status
  const loadedModules = {};
  
  // Function to load a module dynamically
  function loadModule(moduleName, enabled) {
    if (loadedModules[moduleName]) {
      // Module already loaded, toggle its state
      if (enabled) {
        loadedModules[moduleName].enable();
      } else {
        loadedModules[moduleName].disable();
      }
      return;
    }
    
    // Module not loaded yet, load it if enabled
    if (enabled) {
      console.log(`BBO Tools: Loading module "${moduleName}"`);
      
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(`modules/${moduleName}.js`);
      script.id = `bbo-tools-module-${moduleName}`;
      script.onload = () => {
        console.log(`BBO Tools: Module "${moduleName}" loaded`);
        
        // Check if module properly registered itself
        if (window.BBOTools && window.BBOTools[moduleName]) {
          loadedModules[moduleName] = window.BBOTools[moduleName];
          loadedModules[moduleName].enable();
        } else {
          console.error(`BBO Tools: Module "${moduleName}" failed to register`);
        }
      };
      document.head.appendChild(script);
    }
  }
  
  // Set up global BBOTools namespace if it doesn't exist
  if (!window.BBOTools) {
    window.BBOTools = {
      registerModule: (name, module) => {
        window.BBOTools[name] = module;
        console.log(`BBO Tools: Module "${name}" registered`);
      }
    };
  }
  
  // Load settings and initialize modules
  chrome.storage.sync.get('settings', (data) => {
    const settings = data.settings || {};
    
    if (settings.modules) {
      // Load each enabled module
      Object.keys(settings.modules).forEach(moduleName => {
        const moduleSettings = settings.modules[moduleName];
        loadModule(moduleName, moduleSettings.enabled);
      });
    }
  });
  
  // Listen for settings updates
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'settingsUpdated' && message.settings && message.settings.modules) {
      Object.keys(message.settings.modules).forEach(moduleName => {
        const moduleSettings = message.settings.modules[moduleName];
        loadModule(moduleName, moduleSettings.enabled);
      });
    }
  });
})();
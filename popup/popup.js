// BBO Tools - Popup Script
// Author: fubbleskag

document.addEventListener('DOMContentLoaded', () => {
  const moduleList = document.getElementById('moduleList');
  let settings = null;
  
  // Function to create module toggle UI
  function createModuleToggle(id, name, description, enabled) {
    const moduleItem = document.createElement('div');
    moduleItem.className = 'module-item';
    
    const moduleHeader = document.createElement('div');
    moduleHeader.className = 'module-header';
    
    const moduleName = document.createElement('div');
    moduleName.className = 'module-name';
    moduleName.textContent = name;
    
    const moduleToggle = document.createElement('label');
    moduleToggle.className = 'module-toggle';
    
    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.checked = enabled;
    toggleInput.dataset.moduleId = id;
    
    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'slider';
    
    moduleToggle.appendChild(toggleInput);
    moduleToggle.appendChild(toggleSlider);
    
    moduleHeader.appendChild(moduleName);
    moduleHeader.appendChild(moduleToggle);
    
    const moduleDescription = document.createElement('div');
    moduleDescription.className = 'module-description';
    moduleDescription.textContent = description;
    
    moduleItem.appendChild(moduleHeader);
    moduleItem.appendChild(moduleDescription);
    
    // Add event listener to toggle
    toggleInput.addEventListener('change', (event) => {
      const checked = event.target.checked;
      const moduleId = event.target.dataset.moduleId;
      
      // Update settings
      settings.modules[moduleId].enabled = checked;
      
      // Save settings
      chrome.runtime.sendMessage(
        { action: 'saveSettings', settings: settings },
        (response) => {
          console.log('Settings saved:', response);
        }
      );
    });
    
    return moduleItem;
  }
  
  // Load settings and create UI
  chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
    settings = response;
    
    // Clear module list
    moduleList.innerHTML = '';
    
    // Create toggles for each module
    if (settings && settings.modules) {
      Object.keys(settings.modules).forEach(moduleId => {
        const module = settings.modules[moduleId];
        const moduleToggle = createModuleToggle(
          moduleId,
          module.name,
          module.description,
          module.enabled
        );
        moduleList.appendChild(moduleToggle);
      });
    }
  });
});
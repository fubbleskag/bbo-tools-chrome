// BBO Tools - Popup Script
// Author: fubbleskag

document.addEventListener('DOMContentLoaded', () => {
  const featureList = document.getElementById('featureList');
  let settings = null;
  
  // Function to create feature toggle UI
  function createFeatureToggle(id, name, description, enabled) {
    const featureItem = document.createElement('div');
    featureItem.className = 'feature-item';
    
    const featureHeader = document.createElement('div');
    featureHeader.className = 'feature-header';
    
    const featureName = document.createElement('div');
    featureName.className = 'feature-name';
    featureName.textContent = name;
    
    const featureToggle = document.createElement('label');
    featureToggle.className = 'feature-toggle';
    
    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.checked = enabled;
    toggleInput.dataset.featureId = id;
    
    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'slider';
    
    featureToggle.appendChild(toggleInput);
    featureToggle.appendChild(toggleSlider);
    
    featureHeader.appendChild(featureName);
    featureHeader.appendChild(featureToggle);
    
    const featureDescription = document.createElement('div');
    featureDescription.className = 'feature-description';
    featureDescription.textContent = description;
    
    featureItem.appendChild(featureHeader);
    featureItem.appendChild(featureDescription);
    
    // Add event listener to toggle
    toggleInput.addEventListener('change', (event) => {
      const checked = event.target.checked;
      const featureId = event.target.dataset.featureId;
      
      // Update settings
      settings.features[featureId].enabled = checked;
      
      // Save settings
      chrome.runtime.sendMessage(
        { action: 'saveSettings', settings: settings },
        (response) => {
          console.log('Settings saved:', response);
        }
      );
    });
    
    return featureItem;
  }
  
  // Load settings and create UI
  chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
    settings = response;
    
    // Clear feature list
    featureList.innerHTML = '';
    
    // Create toggles for each feature
    if (settings && settings.features) {
      Object.keys(settings.features).forEach(featureId => {
        const feature = settings.features[featureId];
        const featureToggle = createFeatureToggle(
          featureId,
          feature.name,
          feature.description,
          feature.enabled
        );
        featureList.appendChild(featureToggle);
      });
    }
  });
});
// BBO Tools - Popup Script
// Author: fubbleskag

// Use browser API with fallback to chrome for maximum compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', () => {
  const featureList = document.getElementById('featureList');
  let settings = null;
  
  // Show loading indicator
  function showLoading() {
    featureList.innerHTML = '<div class="loading">Loading settings...</div>';
  }
  
  // Show error message
  function showError(message) {
    featureList.innerHTML = `<div class="error">Error: ${message || 'Could not load settings'}</div>`;
  }
  
  // Function to create feature toggle UI with improved accessibility
  function createFeatureToggle(id, name, description, enabled) {
    try {
      const featureItem = document.createElement('div');
      featureItem.className = 'feature-item';
      featureItem.setAttribute('role', 'group');
      featureItem.setAttribute('aria-labelledby', `feature-name-${id}`);
      
      const featureHeader = document.createElement('div');
      featureHeader.className = 'feature-header';
      
      const featureName = document.createElement('div');
      featureName.className = 'feature-name';
      featureName.id = `feature-name-${id}`;
      featureName.textContent = name;
      
      const featureToggle = document.createElement('label');
      featureToggle.className = 'feature-toggle';
      featureToggle.setAttribute('for', id);
      featureToggle.setAttribute('aria-label', `Toggle ${name}`);
      
      const toggleInput = document.createElement('input');
      toggleInput.type = 'checkbox';
      toggleInput.id = id;
      toggleInput.checked = !!enabled; // Convert to boolean
      toggleInput.dataset.featureId = id;
      toggleInput.setAttribute('aria-labelledby', `feature-name-${id}`);
      toggleInput.setAttribute('aria-describedby', `feature-desc-${id}`);
      
      const toggleSlider = document.createElement('span');
      toggleSlider.className = 'slider';
      toggleSlider.setAttribute('role', 'presentation');
      
      featureToggle.appendChild(toggleInput);
      featureToggle.appendChild(toggleSlider);
      
      featureHeader.appendChild(featureName);
      featureHeader.appendChild(featureToggle);
      
      const featureDescription = document.createElement('div');
      featureDescription.className = 'feature-description';
      featureDescription.id = `feature-desc-${id}`;
      featureDescription.textContent = description;
      
      featureItem.appendChild(featureHeader);
      featureItem.appendChild(featureDescription);
      
      toggleInput.addEventListener('change', (event) => {
        try {
          const checked = event.target.checked;
          const featureId = event.target.dataset.featureId;
          
          // Show feedback to user
          const feedbackSpan = document.createElement('span');
          feedbackSpan.className = 'save-feedback';
          feedbackSpan.textContent = 'Saving...';
          
          // Add feedback next to toggle
          featureToggle.appendChild(feedbackSpan);
          
          // Disable toggle while saving
          toggleInput.disabled = true;
          
          // Update settings with validation in mind
          if (!settings) {
            settings = { features: {} };
          }
          
          if (!settings.features) {
            settings.features = {};
          }
          
          if (!settings.features[featureId]) {
            settings.features[featureId] = {
              enabled: checked,
              name: featureId,
              description: ''
            };
          } else {
            settings.features[featureId].enabled = checked;
          }
          
          // Save settings using the Promise-based approach
          browserAPI.runtime.sendMessage({ action: 'saveSettings', settings: settings })
            .then(response => {
              if (response && response.success) {
                // Check if validation was applied
                if (response.validationApplied) {
                  feedbackSpan.textContent = 'Saved (validated)';
                  feedbackSpan.classList.add('feedback-validated');
                  
                  // Refresh UI with validated settings
                  setTimeout(() => {
                    location.reload();
                  }, 1500);
                } else {
                  feedbackSpan.textContent = 'Saved!';
                  feedbackSpan.classList.add('feedback-saved');
                  
                  // Remove feedback message after a delay
                  setTimeout(() => {
                    try {
                      if (feedbackSpan.parentNode) {
                        feedbackSpan.parentNode.removeChild(feedbackSpan);
                      }
                    } catch (error) {
                      console.warn('Error removing feedback span', error);
                    }
                  }, 2000);
                }
              } else {
                throw new Error(response?.error || 'Unknown error');
              }
            })
            .catch(error => {
              console.error('Error saving settings:', error);
              feedbackSpan.textContent = 'Error saving!';
              feedbackSpan.classList.add('feedback-error');
              
              // Revert the checkbox state
              toggleInput.checked = !checked;
              
              // Remove feedback message after a delay
              setTimeout(() => {
                try {
                  if (feedbackSpan.parentNode) {
                    feedbackSpan.parentNode.removeChild(feedbackSpan);
                  }
                } catch (error) {
                  console.warn('Error removing feedback span', error);
                }
              }, 3000);
            })
            .finally(() => {
              // Re-enable toggle
              toggleInput.disabled = false;
            });
        } catch (error) {
          console.error('Error handling toggle change:', error);
          // Handle UI error feedback
          const errorFeedback = document.createElement('div');
          errorFeedback.className = 'error-feedback';
          errorFeedback.textContent = 'An error occurred. Please try again.';
          
          featureItem.appendChild(errorFeedback);
          
          setTimeout(() => {
            try {
              if (errorFeedback.parentNode) {
                errorFeedback.parentNode.removeChild(errorFeedback);
              }
            } catch (error) {
              console.warn('Error removing error feedback', error);
            }
          }, 3000);
        }
      });
      
      return featureItem;
    } catch (error) {
      console.error('Error creating feature toggle:', error);
      const errorItem = document.createElement('div');
      errorItem.className = 'error-item';
      errorItem.textContent = `Error creating ${name} toggle`;
      return errorItem;
    }
  }
  
  // Show loading indicator
  showLoading();
  
  // Inside DOMContentLoaded event listener in popup.js
  browserAPI.runtime.sendMessage({ action: 'getSettings' })
    .then(response => {
      if (!response) {
        throw new Error('No response from background script');
      }
      
      settings = response;
      
      // Clear feature list
      featureList.innerHTML = '';
      
      // Create toggles for each feature
      if (settings && settings.features) {
        const features = Object.keys(settings.features);
        
        if (features.length === 0) {
          const noFeatures = document.createElement('div');
          noFeatures.className = 'no-features';
          noFeatures.textContent = 'No features available.';
          featureList.appendChild(noFeatures);
        } else {
          features.forEach(featureId => {
            const feature = settings.features[featureId];
            if (feature) {
              const featureToggle = createFeatureToggle(
                featureId,
                feature.name || featureId,
                feature.description || '',
                feature.enabled
              );
              featureList.appendChild(featureToggle);
            }
          });
        }
      } else {
        throw new Error('Invalid settings format');
      }
    })
    .catch(error => {
      console.error('Error getting settings:', error);
      showError(error.message);
      
      // Try to recover with a reload button
      const reloadButton = document.createElement('button');
      reloadButton.className = 'reload-button';
      reloadButton.textContent = 'Retry';
      
      reloadButton.addEventListener('click', () => {
        location.reload();
      });
      
      featureList.appendChild(reloadButton);
    });
  
  // Add version information from manifest
  try {
    const versionSpan = document.querySelector('.version');
    if (versionSpan) {
      browserAPI.runtime.getManifest().then(manifest => {
        versionSpan.textContent = `v${manifest.version}`;
      }).catch(error => {
        console.warn('Error getting manifest version', error);
        // Fallback to package.json version if available
        fetch('../package.json')
          .then(response => response.json())
          .then(data => {
            versionSpan.textContent = `v${data.version || '1.0.0'}`;
          })
          .catch(err => {
            console.warn('Error getting package.json version', err);
            versionSpan.textContent = 'v1.0.0'; // Default fallback
          });
      });
    }
  } catch (error) {
    console.warn('Error setting version', error);
  }
  
  // Add keyboard accessibility
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      window.close();
    }
  });
});
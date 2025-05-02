// BBO Tools - Main Content Script
// Author: fubbleskag

(() => {
  // Use browser API with fallback to chrome for maximum compatibility
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  
  console.log('BBO Tools: Initialized');
  
  // Extension state
  const state = {
    tableFilters: {
      enabled: false,
      observer: null,
      checkboxes: {},
      sortSelect: null,
      controlsDiv: null,
      isCollapsed: false, // Track collapsed state
      filterContent: null, // Reference to content that can be collapsed
      filterButton: null, // Reference to filter button in button bar
      lastUrl: null, // Track the last URL to detect navigation changes
      navigationObserver: null, // Observer to watch for navigation changes
      filterCount: 0, // Track number of active filters
      navigationTimeout: null, // For debouncing navigation events
      initialized: false, // Track if we've already initialized in this session
      
      // Simple initialization lock to prevent overlapping initializations
      initializationLock: false,
      // Minimum time between initializations in milliseconds
      initializationCooldown: 500,
      // Timestamp of the last initialization
      lastInitializationTime: 0
    }
  };
  
  // Configuration
  const config = {
    tableFilters: {
      containerSelector: 'table-list-screen table-list div.listClass',
      contentSelector: 'table-list-screen div.contentClass',
      buttonBarSelector: 'table-list-screen div.buttonBarClass' // Added selector for the button bar
    }
  };
  
  // Utility function for debouncing
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  // Debounced navigation handler for consistent reinitializing after navigation
  function createDebouncedNavigationHandler() {
    return debounce((containerSelector, contentSelector, buttonBarSelector) => {
      try {
        // Check if it's too soon to reinitialize
        const now = Date.now();
        const timeSinceLastInit = now - state.tableFilters.lastInitializationTime;
        
        if (timeSinceLastInit < state.tableFilters.initializationCooldown) {
          console.log(`BBO Tools: Skipping reinitialization - too soon (${timeSinceLastInit}ms)`);
          return;
        }
        
        // Use the lock to prevent overlapping initializations
        if (state.tableFilters.initializationLock) {
          console.log('BBO Tools: Initialization already in progress, skipping');
          return;
        }
        
        // Perform full cleanup before reinitialization
        cleanupTableFilters();
        
        // Set the lock and update the timestamp
        state.tableFilters.initializationLock = true;
        state.tableFilters.lastInitializationTime = now;
        
        console.log('BBO Tools: Starting reinitialization');
        
        const result = setupTableFilteringAndSorting(
          containerSelector, 
          contentSelector,
          buttonBarSelector
        );
        
        if (result) {
          state.tableFilters.observer = result.observer;
          state.tableFilters.checkboxes = result.checkboxes;
          state.tableFilters.sortSelect = result.sortSelect;
          state.tableFilters.controlsDiv = result.controlsDiv;
          state.tableFilters.filterContent = result.filterContent;
          state.tableFilters.filterButton = result.filterButton;
          console.log('BBO Tools: Reinitialization completed successfully');
        } else {
          console.warn('BBO Tools: Reinitialization failed to return a result');
        }
        
        // Release the lock
        state.tableFilters.initializationLock = false;
      } catch (error) {
        console.error('BBO Tools: Error reinitializing after navigation', error);
        // Make sure to release the lock in case of error
        state.tableFilters.initializationLock = false;
      }
    }, 1000);
  }

  // Initialize the debounced handler
  const debouncedNavigationHandler = createDebouncedNavigationHandler();
  
  // Promise-based wrapper for storage operations
  function getSettings() {
    return new Promise((resolve, reject) => {
      try {
        browserAPI.storage.sync.get('settings', (data) => {
          if (browserAPI.runtime.lastError) {
            console.warn('Error getting sync settings:', browserAPI.runtime.lastError);
            // Try local storage as fallback
            browserAPI.storage.local.get('settings', (localData) => {
              if (browserAPI.runtime.lastError) {
                reject(browserAPI.runtime.lastError);
                return;
              }
              
              const settings = localData.settings || { features: {} };
              
              // Basic validation
              if (!settings.features || typeof settings.features !== 'object') {
                console.warn('BBO Tools: Features object invalid, fixing locally');
                settings.features = {
                  tableFilters: {
                    enabled: true,
                    name: "Table Filters",
                    description: "Filter and sort tables with custom criteria"
                  }
                };
              }
              
              resolve(settings);
            });
            return;
          }
          
          const settings = data.settings || { features: {} };
          
          // Basic validation
          if (!settings.features || typeof settings.features !== 'object') {
            console.warn('BBO Tools: Features object invalid, fixing locally');
            settings.features = {
              tableFilters: {
                enabled: true,
                name: "Table Filters",
                description: "Filter and sort tables with custom criteria"
              }
            };
          }
          
          resolve(settings);
        });
      } catch (error) {
        console.error('Error in getSettings:', error);
        reject(error);
      }
    });
  }

  // Save settings with fallback to local storage if sync fails
  function saveSettings(settings) {
    return new Promise((resolve, reject) => {
      try {
        browserAPI.storage.sync.set({ settings }, () => {
          if (browserAPI.runtime.lastError) {
            console.warn('Error saving to sync storage:', browserAPI.runtime.lastError);
            // Try local storage as fallback
            browserAPI.storage.local.set({ settings }, () => {
              if (browserAPI.runtime.lastError) {
                reject(browserAPI.runtime.lastError);
                return;
              }
              resolve({ success: true, storage: 'local' });
            });
            return;
          }
          resolve({ success: true, storage: 'sync' });
        });
      } catch (error) {
        console.error('Error in saveSettings:', error);
        reject(error);
      }
    });
  }
  
  // Initialize the extension based on saved settings
  function initialize() {
    getSettings()
      .then(settings => {
        try {
          // Check if settings has been properly validated
          // Properly validated settings will always have a features object
          if (!settings.features) {
            console.warn('BBO Tools: Invalid settings received, requesting reload from background');
            
            // Request valid settings from background script
            return browserAPI.runtime.sendMessage({ action: 'getSettings' })
              .then(validSettings => {
                console.log('BBO Tools: Received valid settings from background');
                return validSettings;
              })
              .catch(error => {
                console.error('BBO Tools: Failed to get valid settings', error);
                // Use a default as fallback
                return { 
                  features: {
                    tableFilters: {
                      enabled: true,
                      name: "Table Filters",
                      description: "Filter and sort tables with custom criteria"
                    }
                  }
                };
              });
          }
          
          return settings;
        } catch (error) {
          console.error('BBO Tools: Error validating settings', error);
          // Use default settings as fallback
          return { 
            features: {
              tableFilters: {
                enabled: true,
                name: "Table Filters",
                description: "Filter and sort tables with custom criteria"
              }
            }
          };
        }
      })
      .then(settings => {
        // Now we can safely check if tableFilters is enabled
        if (settings.features?.tableFilters?.enabled) {
          enableTableFilters();
        }
      })
      .catch(error => {
        console.error('BBO Tools: Error initializing settings', error);
        // Try to continue with default settings as a last resort
        enableTableFilters();
      });
  }
  
  // Enable the table filters feature
  function enableTableFilters() {
    if (state.tableFilters.enabled) return;
    
    console.log('BBO Tools: Enabling Table Filters');
    state.tableFilters.enabled = true;
    
    // Set the initialization lock and timestamp
    state.tableFilters.initializationLock = true;
    state.tableFilters.lastInitializationTime = Date.now();
    
    console.log('BBO Tools: Initial setup starting');
    
    // Give the page a moment to fully load
    setTimeout(() => {
      try {
        // Initialize the filters
        const result = setupTableFilteringAndSorting(
          config.tableFilters.containerSelector, 
          config.tableFilters.contentSelector,
          config.tableFilters.buttonBarSelector
        );
        
        if (result) {
          state.tableFilters.observer = result.observer;
          state.tableFilters.checkboxes = result.checkboxes;
          state.tableFilters.sortSelect = result.sortSelect;
          state.tableFilters.controlsDiv = result.controlsDiv;
          state.tableFilters.filterContent = result.filterContent;
          state.tableFilters.filterButton = result.filterButton;
          console.log('BBO Tools: Initial setup completed successfully');
        } else {
          console.warn('BBO Tools: Initial setup failed to return a result');
        }
        
        // Set up navigation detection
        setupNavigationDetection();
        
        // Release the lock
        state.tableFilters.initializationLock = false;
      } catch (error) {
        console.error('BBO Tools: Error setting up filters', error);
        // Make sure to release the lock in case of error
        state.tableFilters.initializationLock = false;
      }
    }, 1000);
  }
  
  // Helper function to clean up just the filter buttons
  function cleanupFilterButtons() {
    console.log('BBO Tools: Cleaning up filter buttons');
    
    try {
      // Remove the filter button from state if it exists
      if (state.tableFilters.filterButton && state.tableFilters.filterButton.parentNode) {
        state.tableFilters.filterButton.parentNode.removeChild(state.tableFilters.filterButton);
        state.tableFilters.filterButton = null;
      }
      
      // Also find and remove any other filter buttons that might be present
      const buttonBars = document.querySelectorAll(config.tableFilters.buttonBarSelector);
      buttonBars.forEach(buttonBar => {
        if (!buttonBar) return;
        
        const buttons = buttonBar.querySelectorAll('button');
        buttons.forEach(button => {
          const buttonText = button.textContent || '';
          if (buttonText.includes('Filters (')) {
            console.log('BBO Tools: Removing orphaned filter button');
            button.parentNode.removeChild(button);
          }
        });
      });
    } catch (error) {
      console.error('BBO Tools: Error cleaning up filter buttons', error);
    }
  }
  
  // Clean up table filters before reinitializing
  function cleanupTableFilters() {
    console.log('BBO Tools: Running full cleanup');
    
    try {
      // Disconnect the observer
      if (state.tableFilters.observer) {
        state.tableFilters.observer.disconnect();
        state.tableFilters.observer = null;
      }
      
      // Remove the controls
      if (state.tableFilters.controlsDiv && state.tableFilters.controlsDiv.parentNode) {
        state.tableFilters.controlsDiv.parentNode.removeChild(state.tableFilters.controlsDiv);
        state.tableFilters.controlsDiv = null;
      }
      
      // Clean up filter buttons
      cleanupFilterButtons();
      
      // Reset the container styles
      const containerElement = document.querySelector(config.tableFilters.containerSelector);
      if (containerElement) {
        containerElement.style.display = '';
        containerElement.style.flexDirection = '';
        
        // Reset items
        const items = containerElement.querySelectorAll('table-list-item');
        items.forEach(item => {
          item.style.display = '';
          item.style.order = '';
        });
      }
      
      // Also remove any floating panels that might be orphaned
      const possiblePanels = document.querySelectorAll('div[style*="z-index: 1000"]');
      possiblePanels.forEach(panel => {
        // Check if this might be our filter panel
        if (panel.textContent && panel.textContent.includes('Table Filters')) {
          if (panel.parentNode) {
            panel.parentNode.removeChild(panel);
          }
        }
      });
      
      // Reset state tracking objects
      state.tableFilters.checkboxes = {};
      state.tableFilters.sortSelect = null;
      state.tableFilters.filterCount = 0;
    } catch (error) {
      console.error('BBO Tools: Error during cleanup', error);
    }
  }
  
  // Disable the table filters feature
  function disableTableFilters() {
    if (!state.tableFilters.enabled) return;
    
    console.log('BBO Tools: Disabling Table Filters');
    state.tableFilters.enabled = false;
    
    try {
      // Clean up
      cleanupTableFilters();
      
      // Stop the navigation detection
      if (state.tableFilters.navigationInterval) {
        clearInterval(state.tableFilters.navigationInterval);
        state.tableFilters.navigationInterval = null;
      }
      
      if (state.tableFilters.navigationObserver) {
        state.tableFilters.navigationObserver.disconnect();
        state.tableFilters.navigationObserver = null;
      }
    } catch (error) {
      console.error('BBO Tools: Error disabling filters', error);
    }
  }
  
  // Set up detection for navigation between clubs
  function setupNavigationDetection() {
    try {
      // Store the current URL
      state.tableFilters.lastUrl = window.location.href;
      
      // Set up an interval to check for URL changes
      if (!state.tableFilters.navigationInterval) {
        state.tableFilters.navigationInterval = setInterval(() => {
          const currentUrl = window.location.href;
          
          // If URL has changed, the user likely navigated to a different club
          if (currentUrl !== state.tableFilters.lastUrl) {
            console.log('BBO Tools: Navigation detected, reinitializing filters');
            state.tableFilters.lastUrl = currentUrl;
            
            // Perform immediate cleanup
            cleanupTableFilters();
            
            // Reset state to avoid duplicates
            state.tableFilters.filterButton = null;
            state.tableFilters.controlsDiv = null;
            
            // Use the debounced navigation handler
            debouncedNavigationHandler(
              config.tableFilters.containerSelector, 
              config.tableFilters.contentSelector,
              config.tableFilters.buttonBarSelector
            );
          }
        }, 1000); // Check every second
      }
      
      // Also set up a MutationObserver to watch for changes to the DOM that might indicate navigation
      if (!state.tableFilters.navigationObserver) {
        state.tableFilters.navigationObserver = new MutationObserver((mutations) => {
          // Don't process mutations if an initialization is already in progress
          if (state.tableFilters.initializationLock) {
            console.log('BBO Tools: Initialization in progress, skipping mutation processing');
            return;
          }
          
          // Detect if a table-list-screen was added or removed
          const relevantMutation = mutations.some(mutation => {
            return Array.from(mutation.addedNodes).some(node => {
              return node.nodeName && node.nodeName.toLowerCase() === 'table-list-screen';
            }) || Array.from(mutation.removedNodes).some(node => {
              return node.nodeName && node.nodeName.toLowerCase() === 'table-list-screen';
            });
          });
          
          if (relevantMutation) {
            console.log('BBO Tools: Table list screen changed, reinitializing filters');
            
            // Check if it's too soon to reinitialize
            const now = Date.now();
            const timeSinceLastInit = now - state.tableFilters.lastInitializationTime;
            
            if (timeSinceLastInit < state.tableFilters.initializationCooldown) {
              console.log(`BBO Tools: Skipping reinitialization - too soon (${timeSinceLastInit}ms)`);
              return;
            }
            
            // Perform immediate cleanup
            cleanupTableFilters();
            
            // Reset state to avoid duplicates
            state.tableFilters.filterButton = null;
            state.tableFilters.controlsDiv = null;
            
            // Use the debounced navigation handler
            debouncedNavigationHandler(
              config.tableFilters.containerSelector, 
              config.tableFilters.contentSelector,
              config.tableFilters.buttonBarSelector
            );
          }
        });
        
        // Start observing the document body for club navigation changes
        state.tableFilters.navigationObserver.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    } catch (error) {
      console.error('BBO Tools: Error setting up navigation detection', error);
    }
  }
  
  // Function to add filtering checkboxes and a sorting dropdown
  function setupTableFilteringAndSorting(containerSelector, contentSelector, buttonBarSelector) {
    try {
      // Check if initialization is locked
      if (state.tableFilters.initializationLock && 
          state.tableFilters.initializationLock !== true) { // Protect against reentrant calls
        console.log('BBO Tools: Setup already in progress, aborting');
        return null;
      }
      
      // First, clean up any existing buttons to prevent duplicates
      cleanupFilterButtons();
      
      // Check if elements exist, if not set up an observer to wait for them
      let containerElement = document.querySelector(containerSelector);
      let contentElement = document.querySelector(contentSelector);
      let buttonBarElement = document.querySelector(buttonBarSelector);
      
      // If elements don't exist yet, set up a mutation observer to wait for them
      if (!containerElement || !contentElement || !buttonBarElement) {
        console.log('BBO Tools: Target elements not found, setting up observer to wait for them');
        
        // Clean up any existing UI elements that might have been left behind
        cleanupTableFilters();
        
        // Create a new MutationObserver to watch for when these elements appear
        const bodyObserver = new MutationObserver((mutations) => {
          // Check if lock is still active
          if (!state.tableFilters.initializationLock) {
            console.log('BBO Tools: Observer found elements but initialization is no longer active, aborting');
            bodyObserver.disconnect();
            return;
          }
          
          containerElement = document.querySelector(containerSelector);
          contentElement = document.querySelector(contentSelector);
          buttonBarElement = document.querySelector(buttonBarSelector);
          
          // If all elements exist, we can proceed with the setup
          if (containerElement && contentElement && buttonBarElement) {
            console.log('BBO Tools: Target elements found, initializing filters');
            bodyObserver.disconnect(); // Stop observing once we have our elements
            
            // Clean up again right before initializing to make doubly sure
            cleanupFilterButtons();
            
            try {
              const result = initializeFiltersAndSorting(containerElement, contentElement, buttonBarElement);
              
              // Only update state if initialization is still active
              if (state.tableFilters.initializationLock && result) {
                state.tableFilters.observer = result.observer;
                state.tableFilters.checkboxes = result.checkboxes;
                state.tableFilters.sortSelect = result.sortSelect;
                state.tableFilters.controlsDiv = result.controlsDiv;
                state.tableFilters.filterContent = result.filterContent;
                state.tableFilters.filterButton = result.filterButton;
              } else {
                console.log('BBO Tools: Initialization is no longer active, discarding results');
                // Clean up the newly created elements if they aren't being used
                if (result && result.controlsDiv && result.controlsDiv.parentNode) {
                  result.controlsDiv.parentNode.removeChild(result.controlsDiv);
                }
                if (result && result.filterButton && result.filterButton.parentNode) {
                  result.filterButton.parentNode.removeChild(result.filterButton);
                }
                if (result && result.observer) {
                  result.observer.disconnect();
                }
              }
            } catch (error) {
              console.error('BBO Tools: Error initializing filters from observer', error);
            }
          }
        });
        
        // Start observing the document body for changes
        bodyObserver.observe(document.body, {
          childList: true,
          subtree: true
        });
        
        console.log('BBO Tools: Observer started to wait for elements');
        return null; // Exit the function and let the observer handle it when elements appear
      }
      
      // If we reach here, all elements exist, so proceed with setup
      return initializeFiltersAndSorting(containerElement, contentElement, buttonBarElement);
    } catch (error) {
      console.error('BBO Tools: Error in setupTableFilteringAndSorting', error);
      return null;
    }
  }
  
  // Main initialization function that does the actual work once elements exist
  function initializeFiltersAndSorting(containerElement, contentElement, buttonBarElement) {
    try {
      console.log('BBO Tools: Initializing filters and sorting UI');
      
      // Create filter button with ARIA attributes for accessibility
      const filterButton = document.createElement('button');
      filterButton.className = 'mat-focus-indicator mat-raised-button mat-button-base mat-primary';
      filterButton.style.height = '41px';
      filterButton.style.marginLeft = '8px';
      filterButton.setAttribute('data-bbo-tools-filter-button', 'true');
      filterButton.setAttribute('aria-label', 'Toggle filter panel');
      filterButton.setAttribute('aria-haspopup', 'true');
      
      // Create the span for the button text
      const buttonTextSpan = document.createElement('span');
      buttonTextSpan.className = 'mat-button-wrapper';
      buttonTextSpan.textContent = 'Filters (0)';
      filterButton.appendChild(buttonTextSpan);
      
      // Create additional spans required for material button styling
      const rippleSpan = document.createElement('span');
      rippleSpan.className = 'mat-ripple mat-button-ripple';
      filterButton.appendChild(rippleSpan);
      
      const overlaySpan = document.createElement('span');
      overlaySpan.className = 'mat-button-focus-overlay';
      filterButton.appendChild(overlaySpan);
      
      // Append the button to the button bar, aligning it to the right
      buttonBarElement.appendChild(filterButton);
      filterButton.style.float = 'right';
      
      // Create controls container (initially hidden)
      const controlsDiv = document.createElement('div');
      controlsDiv.className = 'bbo-tools-controls';
      controlsDiv.style.display = 'none'; // Start hidden
      controlsDiv.style.position = 'absolute';
      controlsDiv.style.bottom = '10px';
      controlsDiv.style.right = '20px';
      controlsDiv.style.zIndex = '1000';
      controlsDiv.style.backgroundColor = 'white';
      controlsDiv.style.padding = '15px';
      controlsDiv.style.borderRadius = '5px';
      controlsDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
      controlsDiv.style.maxWidth = '300px';
      controlsDiv.style.width = '280px';
      controlsDiv.setAttribute('role', 'dialog');
      controlsDiv.setAttribute('aria-labelledby', 'filter-panel-title');
      
      // Create header
      const headerDiv = document.createElement('div');
      headerDiv.style.display = 'flex';
      headerDiv.style.justifyContent = 'space-between';
      headerDiv.style.alignItems = 'center';
      headerDiv.style.marginBottom = '12px';
      headerDiv.style.borderBottom = '1px solid #ddd';
      headerDiv.style.paddingBottom = '8px';
      
      // Create header title
      const headerTitle = document.createElement('div');
      headerTitle.id = 'filter-panel-title'; // For ARIA labelledby
      headerTitle.style.fontWeight = 'bold';
      headerTitle.style.fontSize = '16px';
      headerTitle.textContent = 'Table Filters';
      headerDiv.appendChild(headerTitle);
      
      // Create close button with ARIA attributes
      const closeButton = document.createElement('button');
      closeButton.textContent = '×'; // Using textContent instead of innerHTML
      closeButton.style.backgroundColor = 'transparent';
      closeButton.style.border = 'none';
      closeButton.style.cursor = 'pointer';
      closeButton.style.fontSize = '20px';
      closeButton.style.lineHeight = '1';
      closeButton.style.padding = '0 5px';
      closeButton.title = 'Close filter panel';
      closeButton.setAttribute('aria-label', 'Close filter panel');
      headerDiv.appendChild(closeButton);
      
      controlsDiv.appendChild(headerDiv);
      
      // Create a container for the filterable content
      const filterContent = document.createElement('div');
      controlsDiv.appendChild(filterContent);
      
      // Create filter section
      const filterSection = document.createElement('div');
      filterSection.style.marginBottom = '15px';
      
      // Add a centralized event handler for checkbox and label clicks
      filterSection.addEventListener('click', (event) => {
        // Handle checkbox clicks
        if (event.target.type === 'checkbox') {
          // Direct checkbox click - call applyFiltersAndSort directly (not debounced)
          console.log(`BBO Tools: Checkbox ${event.target.id} clicked directly, checked: ${event.target.checked}`);
          applyFiltersAndSort(true); // true = force update
          return;
        }
        
        // Handle label clicks - these are tricky because they toggle the checkbox via browser behavior
        if (event.target.tagName.toLowerCase() === 'label') {
          const checkboxId = event.target.htmlFor;
          if (checkboxId && checkboxes[checkboxId]) {
            // The browser will toggle the checkbox automatically, but we need to run our handler
            console.log(`BBO Tools: Label for ${checkboxId} clicked, will update after browser toggles checkbox`);
            
            // Use setTimeout to run after the browser has toggled the checkbox
            setTimeout(() => {
              console.log(`BBO Tools: Processing label click for ${checkboxId}, checkbox is now ${checkboxes[checkboxId].checked}`);
              applyFiltersAndSort(true); // true = force update
            }, 0);
          }
        }
      });
      
      // Define filters - grouped by category
      const filters = [
        // Scoring filters group
        { id: 'filterIMP', label: 'IMPs', 
          group: 'scoring',
          check: (element) => {
            const descElement = element.querySelector('span.descClass');
            return descElement && descElement.textContent.startsWith('IMPs');
          }
        },
        { id: 'filterMP', label: 'Matchpoints', 
          group: 'scoring',
          check: (element) => {
            const descElement = element.querySelector('span.descClass');
            return descElement && descElement.textContent.startsWith('Matchpoints');
          }
        },
        { id: 'filterTP', label: 'Total points', 
          group: 'scoring',
          check: (element) => {
            const descElement = element.querySelector('span.descClass');
            return descElement && descElement.textContent.startsWith('Total points');
          }
        },
        { id: 'filterBidding', label: 'Bidding', 
          group: 'scoring',
          check: (element) => {
            const descElement = element.querySelector('span.descClass');
            return descElement && descElement.textContent.includes('Bidding');
          }
        },
        { id: 'filterTeaching', label: 'Teaching', 
          group: 'scoring',
          check: (element) => {
            const descElement = element.querySelector('span.descClass');
            return descElement && descElement.textContent.includes('Teaching');
          }
        },
        // Other filters
        { id: 'filterRobots', label: 'Robots', 
          group: 'other',
          check: (element) => {
            const nameTags = element.querySelectorAll('name-tag');
            return Array.from(nameTags).some(tag => tag.textContent.includes('Robot'));
          }
        },
        { id: 'filterPermission', label: 'Permission required', 
          iconSrc: 'assets/table_icons/permission.png',
          group: 'other',
          check: (element) => {
            const badgeImages = element.querySelectorAll('div.badgeContainer img');
            return Array.from(badgeImages).some(img => {
              const src = img.getAttribute('src') || '';
              return src.includes('permission');
            });
          }
        },
        { id: 'filterKibitz', label: 'Kibitzing not allowed', 
          iconSrc: 'assets/table_icons/disallowed.png',
          group: 'other',
          check: (element) => {
            const badgeImages = element.querySelectorAll('div.badgeContainer img');
            return Array.from(badgeImages).some(img => {
              const src = img.getAttribute('src') || '';
              return src.includes('disallowed');
            });
          }
        }
      ];
      
      // Group filters by category
      const filtersByGroup = {
        'scoring': filters.filter(f => f.group === 'scoring'),
        'other': filters.filter(f => f.group === 'other')
      };
      
      // Create filter groups with labels
      const filterGroups = {};
      const groupLabels = {
        'scoring': 'Scoring',
        'other': 'Other'
      };
      
      // Create checkboxes for each filter
      const checkboxes = {};
      
      for (const groupKey in filtersByGroup) {
        // Create group span container
        const groupSpan = document.createElement('div');
        groupSpan.style.margin = '10px 0';
        groupSpan.style.display = 'block';
        groupSpan.style.backgroundColor = '#f5f5f5';
        groupSpan.style.padding = '10px';
        groupSpan.style.borderRadius = '4px';
        groupSpan.style.border = '1px solid #ddd';
        groupSpan.setAttribute('data-filter-group', groupKey);
        
        // Create group label
        const groupLabelSpan = document.createElement('div');
        groupLabelSpan.style.fontWeight = 'bold';
        groupLabelSpan.style.marginBottom = '8px';
        groupLabelSpan.style.paddingBottom = '5px';
        groupLabelSpan.style.borderBottom = '1px solid #ddd';
        groupLabelSpan.textContent = groupLabels[groupKey];
        groupLabelSpan.setAttribute('role', 'heading');
        groupLabelSpan.setAttribute('aria-level', '2');
        groupSpan.appendChild(groupLabelSpan);
        
        // Add checkboxes for this group
        filtersByGroup[groupKey].forEach(filter => {
          const checkboxContainer = document.createElement('div');
          checkboxContainer.style.margin = '6px 0';
          checkboxContainer.style.display = 'flex';
          checkboxContainer.style.alignItems = 'center';
          
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.id = filter.id;
          checkbox.style.marginRight = '8px';
          checkbox.style.cursor = 'pointer';
          checkbox.checked = true; // Pre-check all boxes
          checkbox.setAttribute('aria-label', `Filter by ${filter.label}`);
          
          // Store checkbox in our state
          checkboxes[filter.id] = checkbox;
          
          // Create label
          const label = document.createElement('label');
          label.htmlFor = filter.id;
          label.style.cursor = 'pointer';
          label.style.userSelect = 'none';
          
          // If filter has an icon, create an image instead of text
          if (filter.iconSrc) {
            const icon = document.createElement('img');
            icon.src = filter.iconSrc;
            icon.alt = filter.label;
            icon.style.height = '16px';
            icon.style.width = '16px';
            icon.style.verticalAlign = 'middle';
            icon.style.marginRight = '5px';
            label.appendChild(icon);
            
            // If there's also a label text, add it after the icon
            if (filter.label) {
              const labelText = document.createTextNode(filter.label);
              label.appendChild(labelText);
            }
          } else {
            label.textContent = filter.label;
          }
          
          checkboxContainer.appendChild(checkbox);
          checkboxContainer.appendChild(label);
          groupSpan.appendChild(checkboxContainer);
        });
        
        filterGroups[groupKey] = groupSpan;
        filterSection.appendChild(groupSpan);
      }
      
      // Create sort section
      const sortSection = document.createElement('div');
      sortSection.style.margin = '15px 0 5px 0';
      
      const sortLabel = document.createElement('div');
      sortLabel.textContent = 'Sort by:';
      sortLabel.style.fontWeight = 'bold';
      sortLabel.style.marginBottom = '8px';
      sortSection.appendChild(sortLabel);
      
      // Create sort dropdown
      const sortSelect = document.createElement('select');
      sortSelect.id = 'tableSortSelect';
      sortSelect.style.width = '100%';
      sortSelect.style.padding = '5px';
      sortSelect.style.borderRadius = '4px';
      sortSelect.style.border = '1px solid #ccc';
      sortSelect.setAttribute('aria-label', 'Sort tables by');
      
      // Define sort options
      const sortOptions = [
        { value: 'host', text: 'Host (default)' },
        { value: 'openSeats', text: 'Open Seats' },
        { value: 'kibitzers', text: 'Kibitzers' },
        { value: 'scoring', text: 'Scoring' }
      ];
      
      // Add options to dropdown
      sortOptions.forEach(option => {
        const optElement = document.createElement('option');
        optElement.value = option.value;
        optElement.textContent = option.text;
        sortSelect.appendChild(optElement);
      });
      
      sortSection.appendChild(sortSelect);
      
      // Add sections to filter content
      filterContent.appendChild(filterSection);
      filterContent.appendChild(sortSection);
      
      // Add the controls to the content area
      contentElement.appendChild(controlsDiv);
      
      // Make sure the content element has the correct positioning context
      if (getComputedStyle(contentElement).position === 'static') {
        contentElement.style.position = 'relative';
      }
      
      // Add event listener to sort dropdown with a direct handler for immediate response
      sortSelect.addEventListener('change', () => {
        console.log(`BBO Tools: Sort changed to ${sortSelect.value}`);
        applyFiltersAndSort(true); // true = force update
      });
      
      // Define debounced version of applyFiltersAndSort for observer changes
      const debouncedApplyFiltersAndSort = debounce((forceUpdate = false) => {
        applyFiltersAndSort(forceUpdate);
      }, 150);
      
      // Add filter button click event to toggle filter panel with debouncing
      filterButton.addEventListener('click', debounce(() => {
        const isHidden = controlsDiv.style.display === 'none';
        controlsDiv.style.display = isHidden ? 'block' : 'none';
        filterButton.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      }, 50));
      
      // Add close button event with debouncing
      closeButton.addEventListener('click', debounce(() => {
        controlsDiv.style.display = 'none';
        filterButton.setAttribute('aria-expanded', 'false');
      }, 50));
      
      // Helper functions for sorting
      function getOpenSeatsCount(element) {
        const nameTags = element.querySelectorAll('name-tag');
        return Array.from(nameTags).filter(tag => tag.textContent.includes('Sit!')).length;
      }
      
      function getKibitzersCount(element) {
        const nameTags = element.querySelectorAll('name-tag');
        for (const tag of nameTags) {
          if (tag.textContent.includes('Join')) {
            const match = tag.textContent.match(/Join\s*\((\d+)\)/);
            if (match) return parseInt(match[1], 10);
            return 0; // "Join" with no number
          }
        }
        return 0; // No "Join" found
      }
      
      function getScoringType(element) {
        const descElement = element.querySelector('span.descClass');
        return descElement ? descElement.textContent.trim() : '';
      }
      
      function getHostName(element) {
        const firstNameTag = element.querySelector('name-tag');
        return firstNameTag ? firstNameTag.textContent.trim() : '';
      }
      
      // Function to get sorted indices of table items
      function getSortedIndices(items) {
        const sortMethod = sortSelect.value;
        const itemsArray = Array.from(items);
        
        return itemsArray.map((item, index) => ({ item, index }))
          .sort((a, b) => {
            switch (sortMethod) {
              case 'openSeats':
                return getOpenSeatsCount(b.item) - getOpenSeatsCount(a.item); // Descending
              case 'kibitzers':
                return getKibitzersCount(b.item) - getKibitzersCount(a.item); // Descending
              case 'scoring':
                return getScoringType(a.item).localeCompare(getScoringType(b.item)); // Ascending
              case 'host':
              default:
                return getHostName(a.item).localeCompare(getHostName(b.item)); // Ascending
            }
          })
          .map(x => x.index);
      }
      
      // Function to apply filtering and sorting to the table
      function applyFiltersAndSort(forceUpdate = false) {
        try {
          if (forceUpdate) {
            console.log('BBO Tools: Force updating filters and sort');
          }
          
          // Get all table items
          const tableItems = containerElement.querySelectorAll('table-list-item');
          if (!tableItems || tableItems.length === 0) {
            console.log('BBO Tools: No table items found to filter');
            return;
          }
          
          const items = Array.from(tableItems);
          let removalCount = 0;
          
          // Apply filters
          items.forEach(item => {
            let shouldHide = false;
            
            // Check each filter
            filters.forEach(filter => {
              const checkbox = checkboxes[filter.id];
              // If checkbox is unchecked AND item matches the filter condition, hide the item
              if (checkbox && !checkbox.checked && filter.check(item)) {
                shouldHide = true;
              }
            });
            
            // Apply visibility
            if (shouldHide) {
              item.style.display = 'none';
              removalCount++;
            } else {
              item.style.display = '';
            }
          });
          
          // Update filter count in button text
          state.tableFilters.filterCount = removalCount;
          if (buttonTextSpan) {
            buttonTextSpan.textContent = `Filters (${removalCount})`;
          }
          
          // Change button color if filters are active
          if (filterButton) {
            if (removalCount > 0) {
              filterButton.style.backgroundColor = '#1a854c'; // Green color for active filters
            } else {
              filterButton.style.backgroundColor = ''; // Default color when no filters active
            }
          }
          
          // Apply sorting to visible items
          const visibleItems = items.filter(item => item.style.display !== 'none');
          const sortedIndices = getSortedIndices(visibleItems);
          
          // Reorder items
          sortedIndices.forEach((originalIndex, newIndex) => {
            if (originalIndex < visibleItems.length) {
              const item = visibleItems[originalIndex];
              // Set order using CSS order property
              item.style.order = newIndex;
            }
          });
          
          // Make sure container allows for flexbox ordering
          if (containerElement) {
            containerElement.style.display = 'flex';
            containerElement.style.flexDirection = 'column';
          }
        } catch (error) {
          console.error('BBO Tools: Error applying filters and sorting', error);
        }
      }
      
      // Create a new MutationObserver instance with debouncing
      const observer = new MutationObserver((mutations) => {
        try {
          // Use debounced version for mutation observer to prevent too many updates
          debouncedApplyFiltersAndSort();
        } catch (error) {
          console.error('BBO Tools: Error in mutation observer', error);
        }
      });
      
      // Configuration for the observer
      const config = {
        childList: true,
        subtree: true
      };
      
      // Start observing the target element
      observer.observe(containerElement, config);
      
      // Set initial ARIA state
      filterButton.setAttribute('aria-expanded', 'false');
      
      // Initial application of filters and sort
      applyFiltersAndSort();
      
      console.log('BBO Tools: Filters initialized successfully');
      
      return {
        observer: observer,
        checkboxes: checkboxes,
        sortSelect: sortSelect,
        controlsDiv: controlsDiv,
        filterContent: filterContent,
        filterButton: filterButton
      };
    } catch (error) {
      console.error('BBO Tools: Error in initializeFiltersAndSorting', error);
      // Make sure to release the lock in case of error
      state.tableFilters.initializationLock = false;
      return null;
    }
  }
  
  // Listen for setting changes from popup
  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'settingsUpdated' && message.settings) {
      try {
        // Make sure features exists
        if (!message.settings.features) {
          message.settings.features = {};
        }
        
        // Handle table filters feature
        if (message.settings.features.tableFilters) {
          if (message.settings.features.tableFilters.enabled) {
            enableTableFilters();
          } else {
            disableTableFilters();
          }
        }
        
        // Send a response to confirm receipt
        sendResponse({ success: true });
      } catch (error) {
        console.error('BBO Tools: Error handling settings update', error);
        sendResponse({ success: false, error: error.message });
      }
    }
    
    return true; // Keep the message channel open for async response
  });
  
  // Add keyboard support for accessibility
  document.addEventListener('keydown', (event) => {
    // ESC key closes the filter panel
    if (event.key === 'Escape' && state.tableFilters.controlsDiv && 
        state.tableFilters.controlsDiv.style.display === 'block') {
      state.tableFilters.controlsDiv.style.display = 'none';
      if (state.tableFilters.filterButton) {
        state.tableFilters.filterButton.setAttribute('aria-expanded', 'false');
      }
    }
  });
  
  // Initialize the extension
  initialize();
})();
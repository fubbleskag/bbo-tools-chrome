// BBO Tools - Main Content Script
// Author: fubbleskag

(() => {
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
      initialized: false // Track if we've already initialized in this session
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
  
  // Initialize the extension based on saved settings
  function initialize() {
    chrome.storage.sync.get('settings', (data) => {
      // Check if data.settings exists, if not, use default settings
      const settings = data.settings || { features: {} };
      
      // Ensure features object exists 
      if (!settings.features) {
        settings.features = {};
      }
      
      // Ensure tableFilters exists in features
      if (!settings.features.tableFilters) {
        settings.features.tableFilters = {
          enabled: true, // Default to enabled
          name: "Table Filters",
          description: "Filter and sort tables with custom criteria"
        };
        
        // Save these default settings
        chrome.storage.sync.set({ settings: settings }, () => {
          console.log('BBO Tools: Default settings created and saved');
        });
      }
      
      // Now we can safely check if tableFilters is enabled
      if (settings.features.tableFilters && settings.features.tableFilters.enabled) {
        enableTableFilters();
      }
    });
  }
  
  // Enable the table filters feature
  function enableTableFilters() {
    if (state.tableFilters.enabled) return;
    
    console.log('BBO Tools: Enabling Table Filters');
    state.tableFilters.enabled = true;
    
    // Give the page a moment to fully load
    setTimeout(() => {
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
      }
      
      // Set up navigation detection
      setupNavigationDetection();
    }, 1000);
  }
  
  // Helper function to clean up just the filter buttons
  function cleanupFilterButtons() {
    console.log('BBO Tools: Cleaning up filter buttons');
    
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
  }
  
  // Clean up table filters before reinitializing
  function cleanupTableFilters() {
    console.log('BBO Tools: Running full cleanup');
    
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
  }
  
  // Disable the table filters feature
  function disableTableFilters() {
    if (!state.tableFilters.enabled) return;
    
    console.log('BBO Tools: Disabling Table Filters');
    state.tableFilters.enabled = false;
    
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
  }
  
  // Set up detection for navigation between clubs
  function setupNavigationDetection() {
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
          
          // Create a debounced version of cleanup and reinitialization
          clearTimeout(state.tableFilters.navigationTimeout);
          
          // Perform immediate cleanup
          cleanupTableFilters();
          
          // Reset state to avoid duplicates
          state.tableFilters.filterButton = null;
          state.tableFilters.controlsDiv = null;
          
          // Reinitialize filters after a short delay to allow the new page to load
          state.tableFilters.navigationTimeout = setTimeout(() => {
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
            }
          }, 1000);
        }
      }, 1000); // Check every second
    }
    
    // Also set up a MutationObserver to watch for changes to the DOM that might indicate navigation
    if (!state.tableFilters.navigationObserver) {
      state.tableFilters.navigationObserver = new MutationObserver((mutations) => {
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
          
          // Create a debounced version of cleanup and reinitialization
          clearTimeout(state.tableFilters.navigationTimeout);
          
          // Perform immediate cleanup
          cleanupTableFilters();
          
          // Reset state to avoid duplicates
          state.tableFilters.filterButton = null;
          state.tableFilters.controlsDiv = null;
          
          // Reinitialize filters after a short delay
          state.tableFilters.navigationTimeout = setTimeout(() => {
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
            }
          }, 1000);
        }
      });
      
      // Start observing the document body for club navigation changes
      state.tableFilters.navigationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }
  
  // Function to add filtering checkboxes and a sorting dropdown
  function setupTableFilteringAndSorting(containerSelector, contentSelector, buttonBarSelector) {
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
        containerElement = document.querySelector(containerSelector);
        contentElement = document.querySelector(contentSelector);
        buttonBarElement = document.querySelector(buttonBarSelector);
        
        // If all elements exist, we can proceed with the setup
        if (containerElement && contentElement && buttonBarElement) {
          console.log('BBO Tools: Target elements found, initializing filters');
          bodyObserver.disconnect(); // Stop observing once we have our elements
          
          // Clean up again right before initializing to make doubly sure
          cleanupFilterButtons();
          
          const result = initializeFiltersAndSorting(containerElement, contentElement, buttonBarElement); // Call the main setup function
          
          // Update our state references
          if (result) {
            state.tableFilters.observer = result.observer;
            state.tableFilters.checkboxes = result.checkboxes;
            state.tableFilters.sortSelect = result.sortSelect;
            state.tableFilters.controlsDiv = result.controlsDiv;
            state.tableFilters.filterContent = result.filterContent;
            state.tableFilters.filterButton = result.filterButton;
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
  }
  
  // Main initialization function that does the actual work once elements exist
  function initializeFiltersAndSorting(containerElement, contentElement, buttonBarElement) {
    console.log('BBO Tools: Initializing filters and sorting UI');
    
    // Clean up any existing buttons first to make absolutely sure we don't get duplicates
    cleanupFilterButtons();
    
    // Create filter button for the button bar
    const filterButton = document.createElement('button');
    filterButton.className = 'mat-focus-indicator mat-raised-button mat-button-base mat-primary';
    filterButton.style.height = '41px';
    filterButton.style.marginLeft = '8px';
    filterButton.setAttribute('data-bbo-tools-filter-button', 'true'); // Add a data attribute for easier identification
    
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
    controlsDiv.style.display = 'none'; // Start hidden
    controlsDiv.style.position = 'absolute';
    controlsDiv.style.bottom = '10px'; // Position below the header
    controlsDiv.style.right = '20px';
    controlsDiv.style.zIndex = '1000';
    controlsDiv.style.backgroundColor = 'white';
    controlsDiv.style.padding = '15px';
    controlsDiv.style.borderRadius = '5px';
    controlsDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
    controlsDiv.style.maxWidth = '300px';
    controlsDiv.style.width = '280px';
    
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
    headerTitle.style.fontWeight = 'bold';
    headerTitle.style.fontSize = '16px';
    headerTitle.textContent = 'Table Filters';
    headerDiv.appendChild(headerTitle);
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;'; // × character
    closeButton.style.backgroundColor = 'transparent';
    closeButton.style.border = 'none';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '20px';
    closeButton.style.lineHeight = '1';
    closeButton.style.padding = '0 5px';
    closeButton.title = 'Close filter panel';
    headerDiv.appendChild(closeButton);
    
    controlsDiv.appendChild(headerDiv);
    
    // Create a container for the filterable content
    const filterContent = document.createElement('div');
    controlsDiv.appendChild(filterContent);
    
    // Create filter section
    const filterSection = document.createElement('div');
    filterSection.style.marginBottom = '15px';
    
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
      
      // Create group label
      const groupLabelSpan = document.createElement('div');
      groupLabelSpan.style.fontWeight = 'bold';
      groupLabelSpan.style.marginBottom = '8px';
      groupLabelSpan.style.paddingBottom = '5px';
      groupLabelSpan.style.borderBottom = '1px solid #ddd';
      groupLabelSpan.textContent = groupLabels[groupKey];
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
          icon.alt = filter.id;
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
        
        // Add event listener
        checkbox.addEventListener('change', applyFiltersAndSort);
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
    
    // Add filter button click event to toggle filter panel
    filterButton.addEventListener('click', () => {
      if (controlsDiv.style.display === 'none') {
        controlsDiv.style.display = 'block';
      } else {
        controlsDiv.style.display = 'none';
      }
    });
    
    // Add close button event
    closeButton.addEventListener('click', () => {
      controlsDiv.style.display = 'none';
    });
    
    // Add event listener to sort dropdown
    sortSelect.addEventListener('change', applyFiltersAndSort);
    
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
    function applyFiltersAndSort() {
      // Get all table items
      const tableItems = containerElement.querySelectorAll('table-list-item');
      const items = Array.from(tableItems);
      let removalCount = 0;
      
      // Apply filters
      items.forEach(item => {
        let shouldHide = false;
        
        // Check each filter
        filters.forEach(filter => {
          const checkbox = checkboxes[filter.id];
          // If checkbox is unchecked AND item matches the filter condition, hide the item
          if (!checkbox.checked && filter.check(item)) {
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
      buttonTextSpan.textContent = `Filters (${removalCount})`;
      
      // Change button color if filters are active
      if (removalCount > 0) {
        filterButton.style.backgroundColor = '#1a854c'; // Green color for active filters
      } else {
        filterButton.style.backgroundColor = ''; // Default color when no filters active
      }
      
      // Apply sorting to visible items
      const visibleItems = items.filter(item => item.style.display !== 'none');
      const sortedIndices = getSortedIndices(visibleItems);
      
      // Reorder items
      sortedIndices.forEach((originalIndex, newIndex) => {
        const item = visibleItems[originalIndex];
        // Set order using CSS order property
        item.style.order = newIndex;
      });
      
      // Make sure container allows for flexbox ordering
      containerElement.style.display = 'flex';
      containerElement.style.flexDirection = 'column';
    }
    
    // Create a new MutationObserver instance
    const observer = new MutationObserver((mutations) => {
      // Use a debounce mechanism to wait for changes to settle
      clearTimeout(observer.timeout);
      
      observer.timeout = setTimeout(() => {
        applyFiltersAndSort();
      }, 100); // 100ms debounce period
    });
    
    // Configuration for the observer
    const config = {
      childList: true,
      subtree: true
    };
    
    // Start observing the target element
    observer.observe(containerElement, config);
    
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
  }
  
  // Listen for setting changes from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'settingsUpdated' && message.settings) {
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
    }
    
    return true; // Keep the message channel open for async response
  });
  
  // Initialize the extension
  initialize();
})();
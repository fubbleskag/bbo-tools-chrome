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
      controlsDiv: null
    }
  };
  
  // Configuration
  const config = {
    tableFilters: {
      containerSelector: 'table-list-screen table-list div.listClass',
      contentSelector: 'table-list-screen div.contentClass'
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
        config.tableFilters.contentSelector
      );
      
      if (result) {
        state.tableFilters.observer = result.observer;
        state.tableFilters.checkboxes = result.checkboxes;
        state.tableFilters.sortSelect = result.sortSelect;
        state.tableFilters.controlsDiv = result.controlsDiv;
      }
    }, 1000);
  }
  
  // Disable the table filters feature
  function disableTableFilters() {
    if (!state.tableFilters.enabled) return;
    
    console.log('BBO Tools: Disabling Table Filters');
    state.tableFilters.enabled = false;
    
    // Clean up
    if (state.tableFilters.observer) {
      state.tableFilters.observer.disconnect();
      state.tableFilters.observer = null;
    }
    
    if (state.tableFilters.controlsDiv && state.tableFilters.controlsDiv.parentNode) {
      state.tableFilters.controlsDiv.parentNode.removeChild(state.tableFilters.controlsDiv);
      state.tableFilters.controlsDiv = null;
    }
    
    // Reset any styles we've changed
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
  }
  
  // Function to add filtering checkboxes and a sorting dropdown
  function setupTableFilteringAndSorting(containerSelector, contentSelector) {
    // Check if elements exist, if not set up an observer to wait for them
    let containerElement = document.querySelector(containerSelector);
    let contentElement = document.querySelector(contentSelector);
    
    // If elements don't exist yet, set up a mutation observer to wait for them
    if (!containerElement || !contentElement) {
      console.log('BBO Tools: Target elements not found, setting up observer to wait for them');
      
      // Create a new MutationObserver to watch for when these elements appear
      const bodyObserver = new MutationObserver((mutations) => {
        containerElement = document.querySelector(containerSelector);
        contentElement = document.querySelector(contentSelector);
        
        // If both elements exist, we can proceed with the setup
        if (containerElement && contentElement) {
          console.log('BBO Tools: Target elements found, initializing filters');
          bodyObserver.disconnect(); // Stop observing once we have our elements
          const result = initializeFiltersAndSorting(containerElement, contentElement); // Call the main setup function
          
          // Update our state references
          if (result) {
            state.tableFilters.observer = result.observer;
            state.tableFilters.checkboxes = result.checkboxes;
            state.tableFilters.sortSelect = result.sortSelect;
            state.tableFilters.controlsDiv = result.controlsDiv;
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
    
    // If we reach here, both elements exist, so proceed with setup
    return initializeFiltersAndSorting(containerElement, contentElement);
  }
  
  // Main initialization function that does the actual work once elements exist
  function initializeFiltersAndSorting(containerElement, contentElement) {
    console.log('BBO Tools: Initializing filters and sorting UI');
    
    // Create controls container
    const controlsDiv = document.createElement('div');
    controlsDiv.style.display = 'inline-block';
    // Position at bottom right with high z-index
    controlsDiv.style.position = 'absolute';
    controlsDiv.style.bottom = '20px';
    controlsDiv.style.right = '20px';
    controlsDiv.style.zIndex = '1000';
    controlsDiv.style.backgroundColor = 'white';
    controlsDiv.style.padding = '10px';
    controlsDiv.style.borderRadius = '5px';
    controlsDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    // Width is now determined by content
    
    // Create filter section
    const filterSection = document.createElement('div');
    filterSection.style.marginBottom = '10px';
    
    // Define filters - grouped by category
    const filters = [
      // Scoring filters group
      { id: 'filterIMP', label: 'IMP', 
        group: 'scoring',
        check: (element) => {
          const descElement = element.querySelector('span.descClass');
          return descElement && descElement.textContent.startsWith('IMPs');
        }
      },
      { id: 'filterMP', label: 'MP', 
        group: 'scoring',
        check: (element) => {
          const descElement = element.querySelector('span.descClass');
          return descElement && descElement.textContent.startsWith('Matchpoints');
        }
      },
      { id: 'filterTP', label: 'TP', 
        group: 'scoring',
        check: (element) => {
          const descElement = element.querySelector('span.descClass');
          return descElement && descElement.textContent.startsWith('Total points');
        }
      },
      // Other filters
      { id: 'filterRobots', label: 'GiB', 
        group: 'other',
        check: (element) => {
          const nameTags = element.querySelectorAll('name-tag');
          return Array.from(nameTags).some(tag => tag.textContent.includes('Robot'));
        }
      },
      { id: 'filterPermission', label: '', 
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
      { id: 'filterKibitz', label: '', 
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
      const groupSpan = document.createElement('span');
      groupSpan.style.margin = '10px 0';
      groupSpan.style.display = 'block';
      groupSpan.style.backgroundColor = '#f5f5f5';
      groupSpan.style.padding = '3px 8px';
      groupSpan.style.borderRadius = '4px';
      groupSpan.style.border = '1px solid #ddd';
      
      // Create group label
      const groupLabelSpan = document.createElement('span');
      groupLabelSpan.style.fontWeight = 'bold';
      groupLabelSpan.style.width = '70px';
      groupLabelSpan.style.display = 'inline-block';
      groupLabelSpan.textContent = groupLabels[groupKey];
      groupSpan.appendChild(groupLabelSpan);
      
      // Add checkboxes for this group
      filtersByGroup[groupKey].forEach(filter => {
        const checkboxContainer = document.createElement('span');
        checkboxContainer.style.marginRight = '10px';
        checkboxContainer.style.display = 'inline-block';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = filter.id;
        checkbox.style.marginRight = '3px';
        checkbox.style.border = '1px solid #999';
        checkbox.style.outline = '1px solid #ddd';
        checkbox.checked = true; // Pre-check all boxes
        checkboxes[filter.id] = checkbox;
        
        // Create label
        const label = document.createElement('label');
        label.htmlFor = filter.id;
        
        // If filter has an icon, create an image instead of text
        if (filter.iconSrc) {
          const icon = document.createElement('img');
          icon.src = filter.iconSrc;
          icon.alt = filter.id;
          icon.style.height = '16px';
          icon.style.width = '16px';
          icon.style.verticalAlign = 'middle';
          label.appendChild(icon);
        } else {
          label.textContent = filter.label;
          label.style.verticalAlign = 'middle';
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
    
    const sortLabel = document.createElement('span');
    sortLabel.textContent = 'Sort by: ';
    sortLabel.style.fontWeight = 'bold';
    sortSection.appendChild(sortLabel);
    
    // Create sort dropdown
    const sortSelect = document.createElement('select');
    sortSelect.id = 'tableSortSelect';
    sortSelect.style.marginLeft = '5px';
    
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
    
    // Add event listener to sort dropdown
    sortSelect.addEventListener('change', applyFiltersAndSort);
    
    // Add sections to controls
    controlsDiv.appendChild(filterSection);
    controlsDiv.appendChild(sortSection);
    
    // Create a badge for the hidden count - always visible
    const hiddenBadge = document.createElement('div');
    hiddenBadge.id = 'filterCounterBadge';
    hiddenBadge.style.position = 'absolute';
    hiddenBadge.style.bottom = '10px';
    hiddenBadge.style.right = '10px';
    hiddenBadge.style.backgroundColor = '#e0e0e0';
    hiddenBadge.style.color = '#333';
    hiddenBadge.style.borderRadius = '50%';
    hiddenBadge.style.width = '24px';
    hiddenBadge.style.height = '24px';
    hiddenBadge.style.display = 'flex';
    hiddenBadge.style.alignItems = 'center';
    hiddenBadge.style.justifyContent = 'center';
    hiddenBadge.style.fontSize = '12px';
    hiddenBadge.style.fontWeight = 'bold';
    hiddenBadge.textContent = '0'; // Initialize with 0
    controlsDiv.appendChild(hiddenBadge);
    
    // Add the controls to the content area
    contentElement.appendChild(controlsDiv);
    
    // Make sure the content element has the correct positioning context
    if (getComputedStyle(contentElement).position === 'static') {
      contentElement.style.position = 'relative';
    }
    
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
      
      // Update counter - always show the count
      hiddenBadge.textContent = removalCount.toString();
      
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
      controlsDiv: controlsDiv
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
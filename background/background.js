// 🔧 DEBUG MODE - Set to false for production
const DEBUG_BACKGROUND = false;
const debugLog = (...args) => DEBUG_BACKGROUND && console.log('[Background]', ...args);
const debugWarn = (...args) => DEBUG_BACKGROUND && console.warn('[Background]', ...args);
const debugError = (...args) => console.error('[Background]', ...args); // Errors always show

// Default settings configuration
const DEFAULT_SETTINGS = {
    contextualIcons: true,
    globalPlayer: true,
    voice: '',
    speed: 1.0,
    pitch: 1.0,
    geminiApiKey: ''
};

// i18n helper for background script
const t = (key, substitutions) => {
    try {
        return chrome.i18n.getMessage(key, substitutions) || key;
    } catch (error) {
        console.error(`i18n error for key ${key}:`, error);
        return key;
    }
};

// Service worker initialization
chrome.runtime.onInstalled.addListener((details) => {    
    if (details.reason === 'install') {
        // First installation
        initializeExtension();
    } else if (details.reason === 'update') {
        // Update
        handleExtensionUpdate(details);
    }
});

// Initialize extension
async function initializeExtension() {
    try {
        // Set default configuration
        await chrome.storage.sync.set(DEFAULT_SETTINGS);        
    } catch (error) {
        console.error('Error initializing extension:', error);
    }
}

// Handle extension update
async function handleExtensionUpdate(details) {    
    try {
        // Get existing settings
        const currentSettings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
        // Merge with new default settings
        const updatedSettings = { ...DEFAULT_SETTINGS, ...currentSettings };
        // Save updated settings
        await chrome.storage.sync.set(updatedSettings);        
    } catch (error) {
        console.error('Error updating settings:', error);
    }
}

// Message listener from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {    
    switch (message.type) {
        case 'GET_SETTINGS':
            handleGetSettings(sendResponse);
            return true; // Keep channel open for async response
            
        case 'UPDATE_SETTINGS':
            handleUpdateSettings(message.settings, sendResponse);
            return true;
            
        case 'TOGGLE_EXTENSION':
            handleToggleExtension(sender.tab, sendResponse);
            return true;
            
        case 'OPEN_SETTINGS':
            handleOpenSettings(sendResponse);
            return true;
            
        case 'GET_TAB_INFO':
            handleGetTabInfo(sender.tab, sendResponse);
            return true;
            
        default:
    }
});

// Get current settings
async function handleGetSettings(sendResponse) {
    try {
        const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
        sendResponse({ success: true, settings });
    } catch (error) {
        console.error(t('errorLoadingSettings') + ':', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Update settings
async function handleUpdateSettings(newSettings, sendResponse) {
    try {
        await chrome.storage.sync.set(newSettings);
        
        // Notify all active tabs
        const tabs = await chrome.tabs.query({});
        const notifications = tabs.map(tab => 
            chrome.tabs.sendMessage(tab.id, {
                type: 'SETTINGS_UPDATED',
                settings: newSettings
            }).catch(() => {
                // Ignore errors if tab doesn't have content script
            })
        );
        
        await Promise.allSettled(notifications);
        
        sendResponse({ success: true });        
    } catch (error) {
        console.error(t('errorUpdatingSettings') + ':', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Toggle extension
async function handleToggleExtension(tab, sendResponse) {
    try {
        const settings = await chrome.storage.sync.get(['contextualIcons']);
        const newState = !settings.contextualIcons;
        
        await chrome.storage.sync.set({ contextualIcons: newState });
        
        // Notify specific tab
        await chrome.tabs.sendMessage(tab.id, {
            type: 'EXTENSION_TOGGLED',
            enabled: newState
        });
        
        sendResponse({ success: true, enabled: newState });        
    } catch (error) {
        console.error(t('errorTogglingExtension') + ':', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Open settings
async function handleOpenSettings(sendResponse) {
    try {
        // Open extension popup
        await chrome.action.openPopup();
        sendResponse({ success: true });
    } catch (error) {
        console.error('Error opening settings:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Get tab information
async function handleGetTabInfo(tab, sendResponse) {
    try {
        const tabInfo = {
            id: tab.id,
            url: tab.url,
            title: tab.title,
            favicon: tab.favIconUrl
        };
        
        sendResponse({ success: true, tabInfo });
    } catch (error) {
        console.error('Error getting tab info:', error);
        sendResponse({ success: false, error: error.message });
    }
}
// Handle extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
    try {
        // Toggle contextual icons state
        const settings = await chrome.storage.sync.get(['contextualIcons']);
        const newState = !settings.contextualIcons;
        
        await chrome.storage.sync.set({ contextualIcons: newState });
        
        // Notify tab
        await chrome.tabs.sendMessage(tab.id, {
            type: 'EXTENSION_TOGGLED',
            enabled: newState
        });
        
    } catch (error) {
        console.error('Error handling icon click:', error);
    }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {    
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!activeTab) return;
        
        switch (command) {
            case 'toggle-extension':
                // Toggle complete extension
                const settings = await chrome.storage.sync.get(['contextualIcons']);
                const newState = !settings.contextualIcons;
                await chrome.storage.sync.set({ contextualIcons: newState });
                
                await chrome.tabs.sendMessage(activeTab.id, {
                    type: 'EXTENSION_TOGGLED',
                    enabled: newState
                });
                break;
                
            case 'toggle-audio-player':
                // Toggle audio player
                await chrome.tabs.sendMessage(activeTab.id, {
                    type: 'TOGGLE_AUDIO_PLAYER'
                });
                break;
        }
        
    } catch (error) {
        console.error('Error handling keyboard command:', error);
    }
});

// Utility function to clean old data
async function cleanupOldData() {
    try {
        // Clean data from old versions if needed
        const allData = await chrome.storage.sync.get();
        const validKeys = Object.keys(DEFAULT_SETTINGS);
        
        for (const key of Object.keys(allData)) {
            if (!validKeys.includes(key)) {
                await chrome.storage.sync.remove(key);
            }
        }
    } catch (error) {
        console.error('Error cleaning old data:', error);
    }
}

// Run cleanup on startup
chrome.runtime.onStartup.addListener(() => {
    cleanupOldData();
});

// Daily usage tracking function
async function incrementDailyUsage() {
    try {
        const today = new Date().toDateString();
        const result = await chrome.storage.local.get(['dailyUsage', 'lastUsageDate']);
        
        let dailyUsage = result.dailyUsage || 0;
        const lastUsageDate = result.lastUsageDate;
        
        // Reset counter if it's a new day
        if (lastUsageDate !== today) {
            dailyUsage = 0;
        }
        
        dailyUsage++;
        
        await chrome.storage.local.set({
            dailyUsage: dailyUsage,
            lastUsageDate: today
        });
    } catch (error) {
        console.error('Error incrementing daily usage:', error);
    }
}

// Expose function for content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'INCREMENT_DAILY_USAGE') {
        incrementDailyUsage();
        sendResponse({ success: true });
    }
});
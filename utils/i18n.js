/**
 * Internationalization (i18n) utilities for Speed Reader IA Extension
 * Provides easy access to Chrome's i18n API with fallback support
 */

class I18nManager {
    constructor() {
        this.cache = new Map();
        this.fallbackLocale = 'en';
        this.currentLocale = chrome.i18n.getUILanguage();
    }

    /**
     * Get translated message with optional substitutions
     * @param {string} key - Message key from messages.json
     * @param {string|string[]} substitutions - Optional substitutions
     * @returns {string} Translated message
     */
    getMessage(key, substitutions = null) {
        // Check cache first
        const cacheKey = `${key}_${JSON.stringify(substitutions)}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        let message;
        try {
            message = chrome.i18n.getMessage(key, substitutions);
            
            // If no message found, try without substitutions
            if (!message && substitutions) {
                message = chrome.i18n.getMessage(key);
            }
            
            // If still no message, return key as fallback
            if (!message) {
                message = key;
            }
        } catch (error) {
            console.error(`Error getting i18n message for key ${key}:`, error);
            message = key;
        }

        // Cache the result
        this.cache.set(cacheKey, message);
        return message;
    }

    /**
     * Get current locale
     * @returns {string} Current locale code
     */
    getCurrentLocale() {
        return this.currentLocale;
    }

    /**
     * Check if current locale is RTL
     * @returns {boolean} True if RTL
     */
    isRTL() {
        const rtlLocales = ['ar', 'he', 'fa', 'ur'];
        return rtlLocales.includes(this.currentLocale.split('-')[0]);
    }

    /**
     * Get text direction for CSS
     * @returns {string} 'rtl' or 'ltr'
     */
    getTextDirection() {
        return this.isRTL() ? 'rtl' : 'ltr';
    }

    /**
     * Translate all elements with data-i18n attribute
     * @param {Element} container - Container to search in (default: document)
     */
    translatePage(container = document) {
        const elements = container.querySelectorAll('[data-i18n]');
        
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const attribute = element.getAttribute('data-i18n-attr') || 'textContent';
            
            const translation = this.getMessage(key);
            
            if (attribute === 'textContent') {
                element.textContent = translation;
            } else if (attribute === 'innerHTML') {
                element.innerHTML = translation;
            } else {
                element.setAttribute(attribute, translation);
            }
        });
    }

    /**
     * Helper to create translated element
     * @param {string} tag - HTML tag name
     * @param {string} key - Translation key
     * @param {object} attributes - Additional attributes
     * @returns {Element} Created element with translation
     */
    createElement(tag, key, attributes = {}) {
        const element = document.createElement(tag);
        element.textContent = this.getMessage(key);
        
        Object.keys(attributes).forEach(attr => {
            element.setAttribute(attr, attributes[attr]);
        });
        
        return element;
    }

    /**
     * Update specific element with translation
     * @param {Element} element - Element to update
     * @param {string} key - Translation key
     * @param {string} attribute - Attribute to update (default: textContent)
     */
    updateElement(element, key, attribute = 'textContent') {
        const translation = this.getMessage(key);
        
        if (attribute === 'textContent') {
            element.textContent = translation;
        } else if (attribute === 'innerHTML') {
            element.innerHTML = translation;
        } else {
            element.setAttribute(attribute, translation);
        }
    }

    /**
     * Clear translation cache (useful for testing)
     */
    clearCache() {
        this.cache.clear();
    }
}

// Create global instance
const i18n = new I18nManager();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = I18nManager;
}

// Global helper functions for convenience
window.t = (key, substitutions) => i18n.getMessage(key, substitutions);
window.translatePage = (container) => i18n.translatePage(container);
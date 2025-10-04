// Consultation History Management for Speed Reader IA

// Initialize i18n system
document.addEventListener('DOMContentLoaded', function() {
    // Apply browser language-based translations
    applyBrowserLanguageTranslations();
    
    if (typeof translatePage === 'function') {
        translatePage();
    }
});

// Get translation helper function with browser language fallback
const t = (key, substitutions = null) => {
    const browserTranslation = getBrowserLanguageTranslation(key);
    if (browserTranslation) return browserTranslation;
    return chrome.i18n.getMessage(key, substitutions) || key;
};

// Browser language translation system
function getBrowserLanguageTranslation(key) {
    const isSpanish = navigator.language.startsWith('es');
    
    // English translations
    const englishTranslations = {
        'optionsPageTitle': 'Speed Reader IA Options',
        'advancedSettings': 'Advanced Settings',
        'consultationHistory': 'Consultation History',
        'exportImport': 'Export/Import',
        'imageConsultations': 'Image Consultations',
        'codeConsultations': 'Code Consultations',
        'imageAnalysis': 'Image Analysis',
        'codeAnalysis': 'Code Analysis',
        'yourQuery': 'Your Query',
        'geminiResponse': 'Gemini Response',
        'analyzedCode': 'Analyzed Code',
        'analyzedImage': 'Analyzed Image',
        'selectedCode': 'Selected Code',
        'viewPage': 'View Page',
        'clearAllHistory': 'Clear All History',
        'copy': 'Copy',
        'settingsSaved': 'Settings saved successfully',
        'settingsError': 'Error saving settings',
        'confirmDeleteAll': 'Are you sure you want to delete all history?',
        'historyCleared': 'History cleared successfully',
        'deleteHistoryError': 'Error deleting history',
        'maxHistoryItems': 'Maximum number of consultations in history',
        'autoCleanup': 'Automatically delete old consultations',
        'saveImageAnalysis': 'Save image analysis to history',
        'saveCodeAnalysis': 'Save code analysis to history',
        'saveConfiguration': 'Save Configuration',
        'never': 'Never',
        'after7Days': 'After 7 days',
        'after30Days': 'After 30 days',
        'after90Days': 'After 90 days',
        'noImageConsultations': 'No image consultations',
        'noCodeConsultations': 'No code consultations',
        'historyConfiguration': 'History Configuration',
        'exportConsultation': 'Export Consultation',
        'settingsReloading': 'Settings saved, reloading...',
        'maxHistoryHelp': 'Maximum number of consultations to keep in history (10-1000)',
        'autoCleanupHelp': 'Automatically delete consultations after the specified time',
        'lessThanHour': 'less than an hour ago',
        'hour': 'hour',
        'hours': 'hours',
        'day': 'day',
        'days': 'days',
        'ago': 'ago',
        'unknownDomain': 'Unknown domain',
        'clear': 'Clear',
        'export': 'Export',
        'welcomeToHistory': 'Welcome to History'
    };
    
    if (!isSpanish) {
        return englishTranslations[key] || null;
    }
    
    const spanishTranslations = {
        'optionsPageTitle': 'Opciones de Speed Reader IA',
        'advancedSettings': 'Configuración Avanzada',
        'consultationHistory': 'Historial de Consultas',
        'exportImport': 'Exportar/Importar',
        'imageConsultations': 'Consultas de Imágenes',
        'codeConsultations': 'Consultas de Código',
        'imageAnalysis': 'Análisis de Imagen',
        'codeAnalysis': 'Análisis de Código',
        'yourQuery': 'Tu Consulta',
        'geminiResponse': 'Respuesta de Gemini',
        'analyzedCode': 'Código Analizado',
        'analyzedImage': 'Imagen Analizada',
        'selectedCode': 'Código Seleccionado',
        'viewPage': 'Ver Página',
        'clearAllHistory': 'Limpiar Todo el Historial',
        'copy': 'Copiar',
        'settingsSaved': 'Configuración guardada exitosamente',
        'settingsError': 'Error al guardar la configuración',
        'confirmDeleteAll': '¿Estás seguro de que quieres eliminar todo el historial?',
        'historyCleared': 'Historial limpiado exitosamente',
        'deleteHistoryError': 'Error al eliminar el historial',
        'maxHistoryItems': 'Número máximo de consultas en el historial',
        'autoCleanup': 'Eliminar automáticamente consultas antiguas',
        'saveImageAnalysis': 'Guardar análisis de imágenes en el historial',
        'saveCodeAnalysis': 'Guardar análisis de código en el historial',
        'saveConfiguration': 'Guardar Configuración',
        'never': 'Nunca',
        'after7Days': 'Después de 7 días',
        'after30Days': 'Después de 30 días',
        'after90Days': 'Después de 90 días',
        'noImageConsultations': 'No hay consultas de imágenes',
        'noCodeConsultations': 'No hay consultas de código',
        'historyConfiguration': 'Configuración del Historial',
        'exportConsultation': 'Exportar Consulta',
        'settingsReloading': 'Configuración guardada, recargando...',
        'maxHistoryHelp': 'Máximo número de consultas a mantener en el historial (10-1000)',
        'autoCleanupHelp': 'Eliminar automáticamente consultas después del tiempo especificado',
        'lessThanHour': 'hace menos de una hora',
        'hour': 'hora',
        'hours': 'horas',
        'day': 'día',
        'days': 'días',
        'ago': 'hace',
        'unknownDomain': 'Dominio desconocido',
        'clear': 'Limpiar',
        'export': 'Exportar',
        'welcomeToHistory': 'Bienvenido al Historial'
    };
    
    return spanishTranslations[key] || null;
}

function applyBrowserLanguageTranslations() {
    const isSpanish = navigator.language.startsWith('es');
    
    // Apply translations to elements with data-i18n attributes (only for Spanish)
    if (isSpanish) {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = getBrowserLanguageTranslation(key);
            if (translation) {
                // Check if it's for a specific attribute (like title)
                const attrName = element.getAttribute('data-i18n-attr');
                if (attrName) {
                    element.setAttribute(attrName, translation);
                } else {
                    element.textContent = translation;
                }
            }
        });
    }
    
    // Always hardcode tooltip for clear all history button based on browser language
    const clearAllHistoryBtn = document.getElementById('clearAllHistory');
    if (clearAllHistoryBtn) {
        const tooltipText = isSpanish ? 'Limpiar Todo el Historial' : 'Clear All History';
        clearAllHistoryBtn.title = tooltipText;
    }
}

// Función para mostrar notificaciones
function showNotification(message) {
    // Eliminar notificación existente si existe
    const existingNotification = document.getElementById('selection-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Crear nueva notificación
    const notification = document.createElement('div');
    notification.id = 'selection-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(31, 41, 55, 0.9);
        color: rgba(156, 163, 175, 1);
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        z-index: 10000;
        backdrop-filter: blur(8px);
        border: 1px solid rgba(75, 85, 99, 0.3);
        transition: all 0.3s ease;
        animation: slideInFromRight 0.3s ease-out;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);

    // Eliminar la notificación después de 3 segundos
    setTimeout(() => {
        if (notification && notification.parentNode) {
            notification.style.animation = 'slideOutToRight 0.3s ease-in';
            setTimeout(() => {
                if (notification && notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 3000);
}

// Add CSS for notification animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInFromRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutToRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Utility function to get relative time
function getRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
        return t('lessThanHour');
    } else if (hours < 24) {
        const word = hours === 1 ? t('hour') : t('hours');
        return t('timeAgoHours').replace('{0}', hours).replace('{1}', word);
    } else {
        const days = Math.floor(hours / 24);
        const word = days === 1 ? t('day') : t('days');
        return t('timeAgoDays').replace('{0}', days).replace('{1}', word);
    }
}

// Storage utility class
class HistoryStorage {
    static async save(key, data) {
        try {
            await chrome.storage.local.set({ [key]: data });
            return true;
        } catch (error) {
            console.error('Error saving to storage:', error);
            return false;
        }
    }

    static async load(key) {
        try {
            const result = await chrome.storage.local.get(key);
            return result[key] || null;
        } catch (error) {
            console.error('Error loading from storage:', error);
            return null;
        }
    }

    static async remove(key) {
        try {
            await chrome.storage.local.remove(key);
            return true;
        } catch (error) {
            console.error('Error removing from storage:', error);
            return false;
        }
    }

    static async clear() {
        try {
            await chrome.storage.local.clear();
            return true;
        } catch (error) {
            console.error('Error clearing storage:', error);
            return false;
        }
    }

    // Methods for saving consultations
    static async saveImageQuery(imageData, query, response) {
        try {
            const settings = await this.getSettings();
            if (!settings.saveImages) {
                return;
            }

            const historyItem = {
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toISOString(),
                type: 'image',
                query: query,
                response: response,
                imageData: imageData, // Base64 or URL
                url: window.location?.href || 'unknown'
            };

            await this.addToHistory('historyImages', historyItem, settings.maxHistoryItems);
        } catch (error) {
            console.error('Error saving image query:', error);
        }
    }

    static async saveCodeQuery(code, query, response) {
        try {
            const settings = await this.getSettings();
            if (!settings.saveCode) {
                return;
            }

            const historyItem = {
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toISOString(),
                type: 'code',
                code: code,
                query: query,
                response: response,
                url: window.location?.href || 'unknown'
            };

            await this.addToHistory('historyCode', historyItem, settings.maxHistoryItems);
        } catch (error) {
            console.error('Error saving code query:', error);
        }
    }

    static async getSettings() {
        try {
            const result = await chrome.storage.sync.get('historySettings');
            return result.historySettings || {
                maxHistoryItems: 100,
                autoCleanup: 90,
                saveImages: true,
                saveCode: true,
                uiLanguage: 'en'
            };
        } catch (error) {
            console.error('Error getting settings:', error);
            return {
                maxHistoryItems: 100,
                autoCleanup: 90,
                saveImages: true,
                saveCode: true,
                uiLanguage: 'en'
            };
        }
    }

    static async addToHistory(storageKey, newItem, maxItems) {
        try {
            const result = await chrome.storage.local.get(storageKey);
            const history = result[storageKey] || [];
            
            history.unshift(newItem); // Add to beginning
            
            // Trim to max items
            if (history.length > maxItems) {
                history.splice(maxItems);
            }
            
            await chrome.storage.local.set({ [storageKey]: history });
        } catch (error) {
            console.error('Error adding to history:', error);
        }
    }
}

// Settings management
class SettingsManager {
    constructor() {
        this.defaultSettings = {
            maxHistoryItems: 100,
            autoCleanup: 'never',
            saveImageAnalysis: true,
            saveCodeAnalysis: true,
            interfaceLanguage: 'en'
        };
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.bindEvents();
        this.updateUI();
    }

    async loadSettings() {
        this.settings = await HistoryStorage.load('extensionSettings') || this.defaultSettings;
    }

    async saveSettings() {
        const success = await HistoryStorage.save('extensionSettings', this.settings);
        if (success) {
            showNotification(t('settingsReloading'));
            setTimeout(() => location.reload(), 1000);
        } else {
            showNotification(t('settingsError'));
        }
    }

    bindEvents() {
        const saveBtn = document.getElementById('save-settings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }

        // Bind individual setting controls
        const maxItems = document.getElementById('max-history-items');
        if (maxItems) {
            maxItems.addEventListener('change', (e) => {
                this.settings.maxHistoryItems = parseInt(e.target.value);
            });
        }
    }
}

// Función para mostrar notificaciones
function showNotification(message) {
    // Eliminar notificación existente si existe
    const existingNotification = document.getElementById('selection-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Crear nueva notificación
    const notification = document.createElement('div');
    notification.id = 'selection-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(31, 41, 55, 0.9);
        color: rgba(156, 163, 175, 1);
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        z-index: 10000;
        backdrop-filter: blur(8px);
        border: 1px solid rgba(75, 85, 99, 0.3);
        transition: all 0.3s ease;
        animation: slideInFromRight 0.3s ease-out;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);

    // Eliminar la notificación después de 3 segundos
    setTimeout(() => {
        if (notification && notification.parentNode) {
            notification.style.animation = 'slideOutToRight 0.3s ease-in';
            setTimeout(() => {
                if (notification && notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 3000);
}

class HistoryManager {
    constructor() {
        this.historyKeys = {
            images: 'historyImages',
            code: 'historyCode'
        };
        this.settingsKey = 'historySettings';
        this.defaultSettings = {
            maxHistoryItems: 100,
            autoCleanup: 90,
            saveImages: true,
            saveCode: true,
            uiLanguage: 'en' // Interface language
        };
        // Don't call init() here - we'll call it manually in DOMContentLoaded
    }

    async init() {
        this.setupTabs();
        this.setupEventListeners();
        await this.loadSettings();
        this.applyLanguage();

        await this.loadAllHistory();
        this.runAutoCleanup();
    }

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        if (tabButtons.length === 0) {
            console.error('No tab buttons found! Check if DOM is ready.');
            return;
        }

        tabButtons.forEach((button, index) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                const targetTab = button.dataset.tab;
                // Remove active class from all tabs and contents
                tabButtons.forEach(btn => {
                    btn.classList.remove('active');
                });
                tabContents.forEach(content => {
                    content.classList.remove('active');
                });

                // Add active class to clicked tab and corresponding content
                button.classList.add('active');                
                const targetContent = document.getElementById(targetTab);
                if (targetContent) {
                    targetContent.classList.add('active');
                } else {
                    console.error('Target content not found:', targetTab);
                    console.error('Available content IDs:', Array.from(tabContents).map(c => c.id));
                }
            });
        });
    }

    setupEventListeners() {
        // History management buttons
        document.getElementById('clearImageHistory').addEventListener('click', () => {
            this.clearHistory('images');
        });

        document.getElementById('clearCodeHistory').addEventListener('click', () => {
            this.clearHistory('code');
        });

        document.getElementById('clearAllHistory').addEventListener('click', () => {
            this.clearAllHistory();
        });

        // Hardcode tooltip for clear all history button based on browser language
        const clearAllHistoryBtn = document.getElementById('clearAllHistory');
        if (clearAllHistoryBtn) {
            const isSpanish = navigator.language.startsWith('es');
            const tooltipText = isSpanish ? 'Limpiar Todo el Historial' : 'Clear All History';
            clearAllHistoryBtn.title = tooltipText;            
            // Also set it on a timer to ensure it's not overridden
            setTimeout(() => {
                if (clearAllHistoryBtn.title !== tooltipText) {
                    clearAllHistoryBtn.title = tooltipText;
                }
            }, 100);
        }

        // Export buttons
        document.getElementById('exportImageHistory').addEventListener('click', () => {
            this.exportHistory('images');
        });

        document.getElementById('exportCodeHistory').addEventListener('click', () => {
            this.exportHistory('code');
        });



        document.getElementById('exportJSON').addEventListener('click', () => {
            this.exportAllHistory('json');
        });

        document.getElementById('exportCSV').addEventListener('click', () => {
            this.exportAllHistory('csv');
        });

        // Import functionality
        document.getElementById('selectImportFile').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });

        document.getElementById('importFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('importData').disabled = false;
                document.getElementById('importData').textContent = `Importar ${file.name}`;
            }
        });

        document.getElementById('importData').addEventListener('click', () => {
            this.importHistory();
        });

        // Settings
        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
        });



        // Language is now fixed to 'en' - no need for language change listener

        // Category toggle buttons
        document.querySelectorAll('.category-header[data-toggle]').forEach(header => {
            header.addEventListener('click', (e) => {
                const category = e.currentTarget.dataset.toggle;
                toggleCategory(category);
            });
        });

        // Context menu items
        document.querySelectorAll('.context-menu-item[data-action]').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                if (action === 'delete') {
                    deleteSelectedChat();
                } else if (action === 'export') {
                    exportSelectedChat();
                }
            });
        });


    }

    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get(this.settingsKey);
            this.settings = result[this.settingsKey] || this.defaultSettings;

            document.getElementById('maxHistoryItems').value = this.settings.maxHistoryItems;
            document.getElementById('autoCleanup').value = this.settings.autoCleanup;
            document.getElementById('saveImages').checked = this.settings.saveImages;
            document.getElementById('saveCode').checked = this.settings.saveCode;
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveSettings() {
        try {
            const settings = {
                maxHistoryItems: parseInt(document.getElementById('maxHistoryItems').value),
                autoCleanup: parseInt(document.getElementById('autoCleanup').value),
                saveImages: document.getElementById('saveImages').checked,
                saveCode: document.getElementById('saveCode').checked,
                uiLanguage: 'en' // Fixed to English
            };
            await chrome.storage.sync.set({ [this.settingsKey]: settings });
            this.settings = settings;
            
            // Show success message in browser language
            this.showStatus(getBrowserLanguageTranslation('settingsSaved') || 'Settings saved successfully', 'success');

            // Apply new limits to existing history
            await this.applyHistoryLimits(settings.maxHistoryItems);
            
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showStatus(getBrowserLanguageTranslation('settingsError') || 'Error saving settings', 'error');
        }
    }

    async loadAllHistory() {        
        try {
            await this.loadHistory('images');            
            await this.loadHistory('code');            
            // Expandir categorías que tienen contenido por defecto
            setTimeout(() => {
                document.querySelectorAll('.chat-category').forEach(category => {
                    const content = category.querySelector('.category-content');
                    const hasItems = content && !content.querySelector('.empty-state');
                    if (hasItems) {
                        const categoryType = category.dataset.category;
                        if (typeof toggleCategory === 'function') {
                            toggleCategory(categoryType);
                        } else {
                            console.error('❌ toggleCategory function not found');
                        }
                    }
                });
            }, 100);
            
        } catch (error) {
            console.error('Error loading all history:', error);
        }
    }

    async loadHistory(type) {        
        try {
            const result = await chrome.storage.local.get(this.historyKeys[type]);
            
            const history = result[this.historyKeys[type]] || [];
            this.displayHistory(type, history);
            this.updateCount(type, history.length);
        } catch (error) {
            console.error(`[OPTIONS DEBUG] Error loading ${type} history:`, error);
        }
    }

    displayHistory(type, history) {        
        // Mapear los tipos a los IDs correctos de los contenedores HTML
        const containerMapping = {
            'images': 'imageChats',
            'code': 'codeChats'
        };
        
        const containerName = containerMapping[type];
        const container = document.getElementById(containerName);        
        if (!container) {
            console.error(`[OPTIONS DEBUG] Container ${containerName} not found!`);
            return;
        }
        
        if (history.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>${t('noConsultationsFor')} ${type === 'images' ? t('images') : 
                        type === 'code' ? t('code') : t('text')}</p>
                </div>
            `;
            return;
        }        
        // Expandir la categoría si tiene items
        const category = container.closest('.chat-category');
        if (category) {
            category.classList.add('expanded');
        }
        
        // Generar HTML para los items de chat estilo Gemini
        const itemsHTML = history
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .map(item => this.createChatItem(type, item))
            .join('');
        
        container.innerHTML = itemsHTML;
        
        // Agregar event listeners a los chat items
        container.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.chat-menu-btn')) {
                    const type = item.dataset.type;
                    const id = item.dataset.id;
                    selectChat(type, id);
                }
            });
        });

        // Agregar event listeners a los botones de menú
        container.querySelectorAll('.chat-menu-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const type = btn.dataset.type;
                const id = btn.dataset.id;
                showChatMenu(e, type, id);
            });
        });
        
        // Animación de entrada para los items de chat
        setTimeout(() => {
            container.querySelectorAll('.chat-item').forEach((item, index) => {
                item.style.opacity = '0';
                item.style.transform = 'translateY(10px)';
                setTimeout(() => {
                    item.style.transition = 'all 0.3s ease';
                    item.style.opacity = '1';
                    item.style.transform = 'translateY(0)';
                }, index * 50);
            });
        }, 50);

        // Add event listeners to delete buttons
        container.querySelectorAll('.delete-item').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemId = e.target.dataset.itemId;
                this.deleteHistoryItem(type, itemId);
            });
        });

        // Add event listeners to view buttons
        container.querySelectorAll('.view-item').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemId = e.target.dataset.itemId;
                this.viewHistoryItem(type, itemId, history);
            });
        });

        // El scroll ahora se maneja a nivel del contenedor de categorías
    }

    createHistoryItemHTML(type, item) {
        const locale = navigator.language.startsWith('es') ? 'es-ES' : 'en-US';
        const date = new Date(item.timestamp).toLocaleString(locale);
        const typeLabel = type === 'images' ? t('image') : 
                         type === 'code' ? t('code') : t('text');
        
        return `
            <div class="history-item">
                <div class="history-content">
                    <div class="history-date">${date}</div>
                    <div class="history-type ${type}">${typeLabel}</div>
                    <div class="history-query">${this.truncateText(item.query || item.prompt || 'Sin consulta', 100)}</div>
                    <div class="history-response">${this.truncateText(item.response || 'Sin respuesta', 150)}</div>
                </div>
                <div class="history-actions">
                    <button class="btn btn-secondary view-item" data-item-id="${item.id}">Ver</button>
                    <button class="btn btn-danger delete-item" data-item-id="${item.id}">Eliminar</button>
                </div>
            </div>
        `;
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    updateCount(type, count) {
        // Los IDs de los contadores en el HTML
        const countElementName = type === 'images' ? 'imageCount' : `${type}Count`;
        const countElement = document.getElementById(countElementName);
        
        if (countElement) {
            countElement.textContent = count.toString();
        }
    }

    async clearHistory(type) {
        const lang = this.settings.uiLanguage || 'en';
        const typeLabel = type === 'images' ? t('imageConsultations') :
                         type === 'code' ? t('codeConsultations') : '';
        
        if (confirm(`${t('deleteConfirm')} ${typeLabel}?`)) {
            try {
                await chrome.storage.local.remove(this.historyKeys[type]);
                await this.loadHistory(type);
                this.showStatus(`${typeLabel} ${t('historyDeleted')}`, 'success');
            } catch (error) {
                console.error(`Error clearing ${type} history:`, error);
                this.showStatus(`${t('historyDeleteError')} ${typeLabel}`, 'error');
            }
        }
    }

    async clearAllHistory() {
        const lang = this.settings.uiLanguage || 'en';
        if (confirm(t('confirmDeleteAll'))) {
            try {
                await chrome.storage.local.remove(Object.values(this.historyKeys));
                await this.loadAllHistory();
                this.showWelcomeScreen();
                this.showStatus(t('historyCleared'), 'success');
            } catch (error) {
                console.error('Error clearing all history:', error);
                this.showStatus(t('deleteHistoryError'), 'error');
            }
        }
    }

    showWelcomeScreen() {
        // Ocultar el contenido de chat actual
        document.getElementById('chatContent').style.display = 'none';
        // Mostrar la pantalla de bienvenida
        document.querySelector('.chat-welcome').style.display = 'flex';
    }

    applyLanguage() {
        const lang = this.settings.uiLanguage || 'en';
        
        // Apply browser language translations first
        applyBrowserLanguageTranslations();
        
        // Actualizar pestañas
        const historyTab = document.querySelector('[data-tab="history"]');
        const settingsTab = document.querySelector('[data-tab="settings"]');
        const exportTab = document.querySelector('[data-tab="export"]');
        
        if (historyTab) historyTab.textContent = t('consultationHistory');
        if (settingsTab) settingsTab.textContent = t('advancedSettings');
        if (exportTab) exportTab.textContent = t('exportImport');
        
        // Actualizar títulos del historial
        const sidebarTitle = document.querySelector('.sidebar-header h3');
        if (sidebarTitle) sidebarTitle.textContent = t('consultationHistory');
        
        // Actualizar títulos de categorías
        const categoryTitles = document.querySelectorAll('.category-title');
        if (categoryTitles.length >= 2) {
            categoryTitles[0].textContent = t('imageConsultations');
            categoryTitles[1].textContent = t('codeConsultations');
        }
        
        // Actualizar estados vacíos
        const emptyStates = document.querySelectorAll('.empty-state p');
        if (emptyStates.length >= 2) {
            emptyStates[0].textContent = t('noImageConsultations');
            emptyStates[1].textContent = t('noCodeConsultations');
        }
        
        // Actualizar configuración
        const maxItemsLabel = document.querySelector('label[for="maxHistoryItems"]');
        const autoCleanupLabel = document.querySelector('label[for="autoCleanup"]');
        const saveImagesLabel = document.querySelector('label[for="saveImages"]');
        const saveCodeLabel = document.querySelector('label[for="saveCode"]');
        const saveBtn = document.getElementById('saveSettings');
        
        if (maxItemsLabel) maxItemsLabel.textContent = t('maxHistoryItems');
        if (autoCleanupLabel) autoCleanupLabel.textContent = t('autoCleanup');
        if (saveImagesLabel) saveImagesLabel.textContent = t('saveImageAnalysis');
        if (saveCodeLabel) saveCodeLabel.textContent = t('saveCodeAnalysis');
        if (saveBtn) saveBtn.textContent = t('saveConfiguration');
        
        // Actualizar textos de ayuda
        const maxHistoryHelp = document.getElementById('maxHistoryHelp');
        const autoCleanupHelpText = document.getElementById('autoCleanupHelp');
        
        if (maxHistoryHelp) maxHistoryHelp.textContent = t('maxHistoryHelp');
        if (autoCleanupHelpText) autoCleanupHelpText.textContent = t('autoCleanupHelp');
        
        // Actualizar opciones del dropdown de auto-limpieza
        const autoCleanupSelect = document.getElementById('autoCleanup');
        if (autoCleanupSelect) {
            const options = autoCleanupSelect.querySelectorAll('option');
            if (options.length >= 4) {
                options[0].textContent = t('never');
                options[1].textContent = t('after7Days');
                options[2].textContent = t('after30Days');
                options[3].textContent = t('after90Days');
            }
        }
        
        // Actualizar otros elementos
        const historyConfigH2 = document.querySelector('#settings h2:first-of-type');
        const exportImageBtn = document.getElementById('exportImageHistory');
        const exportCodeBtn = document.getElementById('exportCodeHistory');  
        const exportQuerySpan = document.querySelector('.query-export span');
        
        if (historyConfigH2) historyConfigH2.textContent = t('historyConfiguration');
        if (exportImageBtn) exportImageBtn.textContent = t('exportConsultation');
        if (exportCodeBtn) exportCodeBtn.textContent = t('exportConsultation');
        if (exportQuerySpan) exportQuerySpan.textContent = t('exportConsultation');
        
        // Actualizar tooltip de exportar consulta
        const exportQueryItem = document.getElementById('exportQueryItem');
        if (exportQueryItem) exportQueryItem.title = t('exportConsultation');
        
        // Actualizar títulos de exportar/importar
        const exportDataTitle = document.getElementById('exportDataTitle');
        const importDataTitle = document.getElementById('importDataTitle');
        
        if (exportDataTitle) exportDataTitle.textContent = t('exportData');
        if (importDataTitle) importDataTitle.textContent = t('importData');
        
        // Actualizar elementos por ID (funcionan sin importar si la sección está visible)
        const exportDesc = document.getElementById('exportDesc');
        const importDesc = document.getElementById('importDesc');
        const exportJSONBtn = document.getElementById('exportJSON');
        const exportCSVBtn = document.getElementById('exportCSV');
        const selectFileBtn = document.getElementById('selectImportFile');
        const importBtn = document.getElementById('importData');
        
        if (exportDesc) exportDesc.textContent = t('exportDesc');
        if (importDesc) importDesc.textContent = t('importDesc');
        if (exportJSONBtn) exportJSONBtn.textContent = t('exportAsJSON');
        if (exportCSVBtn) exportCSVBtn.textContent = t('exportAsCSV');
        if (selectFileBtn) selectFileBtn.textContent = t('selectFile');
        if (importBtn) importBtn.textContent = t('importData');
        
        // Actualizar pantalla de bienvenida
        const welcomeContent = document.querySelector('.welcome-content');
        if (welcomeContent) {
            const welcomeTitle = welcomeContent.querySelector('h3');
            const welcomeDesc = welcomeContent.querySelector('p');
            
            if (welcomeTitle) welcomeTitle.textContent = t('welcomeToHistory');
            if (welcomeDesc) welcomeDesc.textContent = t('selectConsultationDesc');
            
            // Actualizar estadísticas
            const statItems = welcomeContent.querySelectorAll('.stat-item span:not(.stat-number):not(.stat-icon)');
            if (statItems.length >= 2) {
                statItems[0].textContent = t('imagesAnalyzed');
                statItems[1].textContent = t('codeReviewed');
            }
        }
        
        // Actualizar menú contextual
        const contextMenuItems = document.querySelectorAll('.context-menu-item span:not(.menu-icon)');
        if (contextMenuItems.length >= 2) {
            contextMenuItems[0].textContent = t('deleteConsultation');
            contextMenuItems[1].textContent = t('exportConsultation');
        }
    }

    getRelativeTime(diffHours, diffDays) {
        if (diffHours < 1) {
            return t('lessThanHour');
        } else if (diffHours < 24) {
            const hourWord = diffHours > 1 ? t('hours') : t('hour');
            return t('timeAgoHours').replace('{0}', diffHours.toString()).replace('{1}', hourWord);
        } else {
            const dayWord = diffDays > 1 ? t('days') : t('day');
            return t('timeAgoDays').replace('{0}', diffDays.toString()).replace('{1}', dayWord);
        }
    }

    async deleteHistoryItem(type, itemId) {
        const lang = this.settings.uiLanguage || 'en';
        try {
            const result = await chrome.storage.local.get(this.historyKeys[type]);
            const history = result[this.historyKeys[type]] || [];
            const updatedHistory = history.filter(item => item.id !== itemId);
            
            await chrome.storage.local.set({ [this.historyKeys[type]]: updatedHistory });
            await this.loadHistory(type);
            this.showStatus(t('itemDeleted'), 'success');
        } catch (error) {
            console.error('Error deleting history item:', error);
            this.showStatus(t('itemDeleteError'), 'error');
        }
    }

    viewHistoryItem(type, itemId, history) {
        const item = history.find(h => h.id === itemId);
        if (!item) return;

        // Create modal to show full details
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
            background: rgba(0,0,0,0.7); z-index: 10000; 
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white; border-radius: 10px; padding: 25px; 
            max-width: 800px; max-height: 80vh; overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;

        const locale = navigator.language.startsWith('es') ? 'es-ES' : 'en-US';
        const date = new Date(item.timestamp).toLocaleString(locale);
        const typeLabel = type === 'images' ? t('imageConsultation') :
                         type === 'code' ? t('codeConsultation') : t('textConsultation');

        content.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3>${typeLabel}</h3>
                <button id="closeModal" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <p style="color: #666; margin-bottom: 15px;"><strong>Fecha:</strong> ${date}</p>
            <div style="margin-bottom: 20px;">
                <h4>Consulta:</h4>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-top: 8px;">
                    ${item.query || item.prompt || 'Sin consulta'}
                </div>
            </div>
            <div>
                <h4>Respuesta:</h4>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-top: 8px; white-space: pre-wrap;">
                    ${item.response || 'Sin respuesta'}
                </div>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Close modal events
        document.getElementById('closeModal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    async exportHistory(type) {
        const lang = this.settings.uiLanguage || 'en';
        try {
            const result = await chrome.storage.local.get(this.historyKeys[type]);
            const history = result[this.historyKeys[type]] || [];
            
            if (history.length === 0) {
                this.showStatus(`${t('noHistoryToExport')} ${type}`, 'error');
                return;
            }

            const dataStr = JSON.stringify(history, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            this.downloadFile(blob, `historial_${type}_${new Date().toISOString().split('T')[0]}.json`);
            
            this.showStatus(`${t('consultationHistory')} ${type} ${t('historyExported')}`, 'success');
        } catch (error) {
            console.error('Error exporting history:', error);
            this.showStatus(t('exportError'), 'error');
        }
    }

    async exportAllHistory(format) {
        try {
            const allData = {};
            for (const [key, storageKey] of Object.entries(this.historyKeys)) {
                const result = await chrome.storage.local.get(storageKey);
                allData[key] = result[storageKey] || [];
            }

            let content, filename, mimeType;

            if (format === 'json') {
                content = JSON.stringify(allData, null, 2);
                filename = `historial_completo_${new Date().toISOString().split('T')[0]}.json`;
                mimeType = 'application/json';
            } else if (format === 'csv') {
                content = this.convertToCSV(allData);
                filename = `historial_completo_${new Date().toISOString().split('T')[0]}.csv`;
                mimeType = 'text/csv';
            }

            const blob = new Blob([content], { type: mimeType });
            this.downloadFile(blob, filename);
            
            const lang = this.settings.uiLanguage || 'en';
            this.showStatus(`${t('historyExportedAs', lang)} ${format.toUpperCase()}`, 'success');
        } catch (error) {
            console.error('Error exporting all history:', error);
            const lang = this.settings.uiLanguage || 'en';
            this.showStatus(t('exportError', lang), 'error');
        }
    }

    convertToCSV(allData) {
        const rows = [];
        rows.push(['Tipo', 'Fecha', 'Consulta', 'Respuesta']);

        for (const [type, history] of Object.entries(allData)) {
            history.forEach(item => {
                const locale = navigator.language.startsWith('es') ? 'es-ES' : 'en-US';
                const date = new Date(item.timestamp).toLocaleString(locale);
                const query = (item.query || item.prompt || '').replace(/"/g, '""');
                const response = (item.response || '').replace(/"/g, '""');
                rows.push([type, date, `"${query}"`, `"${response}"`]);
            });
        }

        return rows.map(row => row.join(',')).join('\n');
    }

    async importHistory() {
        const fileInput = document.getElementById('importFile');
        const file = fileInput.files[0];
        
        const lang = this.settings.uiLanguage || 'en';
        
        if (!file) {
            this.showStatus(t('selectFileToImport', lang), 'error');
            return;
        }

        try {
            const text = await file.text();
            let data;

            if (file.name.endsWith('.json')) {
                data = JSON.parse(text);
            } else {
                this.showStatus(t('unsupportedFileFormat', lang), 'error');
                return;
            }

            // Validate and import data
            let importCount = 0;
            for (const [type, history] of Object.entries(data)) {
                if (this.historyKeys[type] && Array.isArray(history)) {
                    const existingResult = await chrome.storage.local.get(this.historyKeys[type]);
                    const existingHistory = existingResult[this.historyKeys[type]] || [];
                    
                    // Add unique ID to imported items if missing
                    history.forEach(item => {
                        if (!item.id) {
                            item.id = 'imported_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                        }
                    });

                    const combinedHistory = [...existingHistory, ...history];
                    await chrome.storage.local.set({ [this.historyKeys[type]]: combinedHistory });
                    importCount += history.length;
                }
            }

            await this.loadAllHistory();
            this.showStatus(`${importCount} ${t('itemsImported', lang)}`, 'success');
            
            // Reset file input
            fileInput.value = '';
            document.getElementById('importData').disabled = true;
            document.getElementById('importData').textContent = t('importFile', lang);
        } catch (error) {
            console.error('Error importing history:', error);
            this.showStatus(t('importError', lang), 'error');
        }
    }

    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async applyHistoryLimits(maxItems) {
        for (const [type, storageKey] of Object.entries(this.historyKeys)) {
            try {
                const result = await chrome.storage.local.get(storageKey);
                const history = result[storageKey] || [];
                
                if (history.length > maxItems) {
                    // Keep most recent items
                    const sortedHistory = history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    const trimmedHistory = sortedHistory.slice(0, maxItems);
                    await chrome.storage.local.set({ [storageKey]: trimmedHistory });
                }
            } catch (error) {
                console.error(`Error applying limits to ${type} history:`, error);
            }
        }
        await this.loadAllHistory();
    }

    // Actualizar estadísticas en la pantalla de bienvenida
    updateStats() {
        Promise.all([
            chrome.storage.local.get('historyImages'),
            chrome.storage.local.get('historyCode')
        ]).then(([images, code]) => {
            const imageCount = (images.historyImages || []).length;
            const codeCount = (code.historyCode || []).length;
            
            const totalImagesEl = document.getElementById('totalImages');
            const totalCodeEl = document.getElementById('totalCode');
            
            if (totalImagesEl) totalImagesEl.textContent = imageCount;
            if (totalCodeEl) totalCodeEl.textContent = codeCount;
        });
    }

    // Función para generar datos de prueba (temporal)
    generateTestData() {        
        const sampleImageData = [
            {
                id: 'img_' + Date.now() + '_1',
                type: 'images',
                timestamp: new Date().toISOString(),
                query: '¿Qué puedes ver en esta imagen?',
                response: 'Puedo ver una hermosa puesta de sol sobre las montañas.',
                domain: 'example.com',
                imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJ...'
            },
            {
                id: 'img_' + Date.now() + '_2',
                type: 'images',
                timestamp: new Date(Date.now() - 86400000).toISOString(),
                query: 'Analiza los colores de esta imagen',
                response: 'Los colores predominantes son azul y naranja, creando un contraste cálido.',
                domain: 'test.com',
                imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJ...'
            }
        ];

        const sampleCodeData = [
            {
                id: 'code_' + Date.now() + '_1',
                type: 'code',
                timestamp: new Date().toISOString(),
                query: 'Explica este código JavaScript',
                response: 'Este código define una función asíncrona que maneja peticiones HTTP.',
                domain: 'github.com',
                code: 'async function fetchData() {\n  const response = await fetch("/api/data");\n  return response.json();\n}',
                language: 'javascript'
            }
        ];

        // Simular chrome.storage.local para testing si no existe
        if (typeof chrome === 'undefined') {
            window.chrome = {
                storage: {
                    local: {
                        data: {},
                        set: function(items) {
                            Object.assign(this.data, items);
                            return Promise.resolve();
                        },
                        get: function(keys) {
                            const result = {};
                            if (Array.isArray(keys)) {
                                keys.forEach(key => {
                                    if (this.data[key]) result[key] = this.data[key];
                                });
                            } else if (typeof keys === 'string') {
                                if (this.data[keys]) result[keys] = this.data[keys];
                            } else if (typeof keys === 'object') {
                                Object.keys(keys).forEach(key => {
                                    result[key] = this.data[key] || keys[key];
                                });
                            }
                            return Promise.resolve(result);
                        }
                    }
                }
            };
        }

        chrome.storage.local.set({
            'historyImages': sampleImageData,
            'historyCode': sampleCodeData,
            'historyText': []
        }).then(() => {
            this.loadAllHistory();
        });
    }

    async runAutoCleanup() {
        try {
            const result = await chrome.storage.sync.get(this.settingsKey);
            const settings = result[this.settingsKey] || this.defaultSettings;
            
            if (settings.autoCleanup === 'never') return;

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(settings.autoCleanup));

            for (const [type, storageKey] of Object.entries(this.historyKeys)) {
                const historyResult = await chrome.storage.local.get(storageKey);
                const history = historyResult[storageKey] || [];
                
                const filteredHistory = history.filter(item => 
                    new Date(item.timestamp) > cutoffDate
                );

                if (filteredHistory.length < history.length) {
                    await chrome.storage.local.set({ [storageKey]: filteredHistory });
                }
            }
        } catch (error) {
            console.error('Error running auto cleanup:', error);
        }
    }

    showStatus(message, type) {
        // Find or create status container
        let statusContainer = document.getElementById('globalStatus');
        if (!statusContainer) {
            statusContainer = document.createElement('div');
            statusContainer.id = 'globalStatus';
            statusContainer.style.cssText = `
                position: fixed; bottom: 20px; right: 20px; z-index: 10000;
                padding: 16px 20px; border-radius: 12px; font-weight: 500;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 14px;
                background: rgba(35, 35, 40, 0.95);
                border: 1px solid rgba(100, 200, 255, 0.3);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(10px);
                animation: slideInUp 0.3s ease;
                transition: all 0.3s ease;
            `;
            document.body.appendChild(statusContainer);
        }

        statusContainer.textContent = message;
        statusContainer.className = `status-message ${type}`;
        
        // Set color based on type
        if (type === 'success') {
            statusContainer.style.color = 'rgba(156, 163, 175, 1)';
            statusContainer.style.borderColor = 'rgba(100, 200, 255, 0.3)';
        } else if (type === 'error') {
            statusContainer.style.color = 'rgba(255, 140, 140, 0.9)';
            statusContainer.style.borderColor = 'rgba(255, 140, 140, 0.3)';
        } else {
            statusContainer.style.color = 'rgba(156, 163, 175, 1)';
            statusContainer.style.borderColor = 'rgba(100, 200, 255, 0.3)';
        }

        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (statusContainer.parentNode) {
                statusContainer.parentNode.removeChild(statusContainer);
            }
        }, 3000);
    }

    // Crear item de chat individual para la nueva interfaz
    createChatItem(type, item) {
        // Obtener idioma actual
        const lang = this.settings.uiLanguage || 'en';
        
        const date = new Date(item.timestamp);
        
        // Calcular tiempo relativo
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        const relativeTime = getRelativeTimeGlobal(diffHours, diffDays, lang);
        
        // Mapear idiomas a locales
        const localeMap = {
            'es': 'es-ES',
            'en': 'en-US', 
            'fr': 'fr-FR',
            'de': 'de-DE',
            'pt': 'pt-BR',
            'it': 'it-IT'
        };
        
        const locale = localeMap[lang] || 'en-US';
        
        const timeString = date.toLocaleTimeString(locale, { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        const dateString = date.toLocaleDateString(locale, { 
            day: '2-digit', 
            month: '2-digit',
            year: 'numeric'
        });
        
        // Crear preview del query (primeras palabras)
        const queryPreview = item.query.length > 50 
            ? item.query.substring(0, 50) + '...' 
            : item.query;
            
        return `
            <div class="chat-item" 
                 data-type="${type}" 
                 data-id="${item.id}">
                <div class="chat-content">
                    <div class="chat-preview">${queryPreview}</div>
                    <div class="chat-meta">
                        <span class="chat-timestamp">${relativeTime}</span>
                        <span class="chat-date">${dateString}</span>
                    </div>
                </div>
                <div class="chat-actions">
                    <div class="chat-menu-btn" data-type="${type}" data-id="${item.id}">
                        <img src="../icons/menu-vertical.svg" alt="Opciones" width="16" height="16" class="menu-dots">
                    </div>
                </div>
            </div>
        `;
    }


}

// Variable global para el chat seleccionado
let selectedChat = null;

// Función global para alternar categorías
function toggleCategory(category) {
    const categoryElement = document.querySelector(`[data-category="${category}"]`);
    if (!categoryElement) return;
    
    const isExpanded = categoryElement.classList.contains('expanded');
    const categoryContent = categoryElement.querySelector('.category-content');
    const toggleIcon = categoryElement.querySelector('.toggle-icon');
    
    if (isExpanded) {
        // Colapsar
        categoryElement.classList.remove('expanded');
        // Forzar recálculo de altura antes de colapsar
        categoryContent.style.maxHeight = categoryContent.scrollHeight + 'px';
        // Forzar reflow
        categoryContent.offsetHeight;
        // Ahora colapsar
        categoryContent.style.maxHeight = '0';
        categoryContent.style.overflow = 'hidden';
        if (toggleIcon) {
            toggleIcon.style.transform = 'rotate(0deg)';
        }
    } else {
        // Expandir
        categoryElement.classList.add('expanded');
        // Calcular altura real del contenido para la animación
        const scrollHeight = categoryContent.scrollHeight;
        categoryContent.style.overflow = 'hidden'; // Inicialmente oculto para la animación
        categoryContent.style.maxHeight = scrollHeight + 'px';
        if (toggleIcon) {
            toggleIcon.style.transform = 'rotate(180deg)';
        }
        
        // Después de la animación, permitir crecimiento dinámico
        setTimeout(() => {
            if (categoryElement.classList.contains('expanded')) {
                categoryContent.style.maxHeight = 'none';
                categoryContent.style.overflow = 'visible';
            }
        }, 350);
    }
}

// Función global para seleccionar un chat
function selectChat(type, itemId) {
    // Remover selección anterior
    document.querySelectorAll('.chat-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Seleccionar el nuevo item
    const chatItem = document.querySelector(`[data-type="${type}"][data-id="${itemId}"]`);
    if (chatItem) {
        chatItem.classList.add('selected');
        
        // Expandir la categoría si no está expandida
        const category = document.querySelector(`[data-category="${type}"]`);
        if (category && !category.classList.contains('expanded')) {
            toggleCategory(type);
        }
        
        // Scroll al elemento seleccionado si es necesario
        chatItem.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest' 
        });
    }
    
    // Guardar selección actual
    selectedChat = { type, itemId };
    
    // Mostrar contenido del chat
    showChatContent(type, itemId);
}

// Función auxiliar para tiempo relativo
function getRelativeTimeGlobal(diffHours, diffDays, lang) {
    // Use browser language if Spanish
    const isSpanish = navigator.language.startsWith('es');
    const effectiveLang = isSpanish ? 'es' : lang;
    if (diffHours < 1) {
        return t('lessThanHour', effectiveLang);
    } else if (diffHours < 24) {
        const hourWord = diffHours > 1 ? t('hours', effectiveLang) : t('hour', effectiveLang);
        if (effectiveLang === 'en') {
            return `${diffHours} ${hourWord} ago`;
        } else if (effectiveLang === 'fr') {
            return `${t('ago', effectiveLang)} ${diffHours} ${hourWord}`;
        } else if (effectiveLang === 'de') {
            return `${t('ago', effectiveLang)} ${diffHours} ${hourWord}`;
        } else if (effectiveLang === 'pt') {
            return `${t('ago', effectiveLang)} ${diffHours} ${hourWord}`;
        } else if (effectiveLang === 'it') {
            return `${diffHours} ${hourWord} ${t('ago', effectiveLang)}`;
        } else {
            // Español por defecto
            return `${t('ago', effectiveLang)} ${diffHours} ${hourWord}`;
        }
    } else {
        const dayWord = diffDays > 1 ? t('days', effectiveLang) : t('day', effectiveLang);
        if (effectiveLang === 'en') {
            return `${diffDays} ${dayWord} ago`;
        } else if (effectiveLang === 'fr') {
            return `${t('ago', effectiveLang)} ${diffDays} ${dayWord}`;
        } else if (effectiveLang === 'de') {
            return `${t('ago', effectiveLang)} ${diffDays} ${dayWord}`;
        } else if (effectiveLang === 'pt') {
            return `${t('ago', effectiveLang)} ${diffDays} ${dayWord}`;
        } else if (effectiveLang === 'it') {
            return `${diffDays} ${dayWord} ${t('ago', effectiveLang)}`;
        } else {
            // Español por defecto
            return `${t('ago', effectiveLang)} ${diffDays} ${dayWord}`;
        }
    }
}

// Función para mostrar el contenido del chat seleccionado
async function showChatContent(type, itemId) {
    try {
        const historyKeys = {
            images: 'historyImages',
            code: 'historyCode'
        };
        
        const result = await chrome.storage.local.get(historyKeys[type]);
        const history = result[historyKeys[type]] || [];
        const item = history.find(h => h.id === itemId);
        
        if (!item) {
            console.error('Chat item not found:', itemId);
            return;
        }
        
        // Ocultar pantalla de bienvenida y mostrar contenido
        document.querySelector('.chat-welcome').style.display = 'none';
        document.getElementById('chatContent').style.display = 'block';
        
        // Obtener idioma actual basado en el navegador
        const lang = navigator.language.startsWith('es') ? 'es' : 'en';
        
        // Mapear idiomas a locales
        const localeMap = {
            'es': 'es-ES',
            'en': 'en-US', 
            'fr': 'fr-FR',
            'de': 'de-DE',
            'pt': 'pt-BR',
            'it': 'it-IT'
        };
        
        const locale = localeMap[lang] || 'en-US';
        
        // Formatear fecha y hora según el idioma
        const date = new Date(item.timestamp);
        const fullDate = date.toLocaleDateString(locale, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const time = date.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Calcular tiempo relativo
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        
        let relativeTime = getRelativeTimeGlobal(diffHours, diffDays, lang);
        
        // Generar HTML del contenido
        const typeLabels = {
            images: t('imageAnalysis', lang),
            code: t('codeAnalysis', lang)
        };
        
        const typeIcons = {
            images: '<img src="../icons/image.svg" alt="Imagen" width="20" height="20" class="type-icon">',
            code: '<img src="../icons/code.svg" alt="Código" width="20" height="20" class="type-icon">'
        };
        
        let additionalContent = '';
        if (type === 'code' && item.code) {
            additionalContent = `
                <div class="code-section">
                    <div class="section-header">
                        <img src="../icons/code.svg" alt="Código" width="16" height="16" class="section-icon">
                        <h3>${t('analyzedCode', lang)}</h3>
                        <span class="code-language">${item.language || 'Desconocido'}</span>
                    </div>
                    <div class="code-block">
                        <pre><code>${item.code}</code></pre>
                    </div>
                </div>
            `;
        } else if (type === 'text' && item.text) {
            additionalContent = `
                <div class="text-section">
                    <div class="section-header">
                        <img src="../icons/text.svg" alt="Texto" width="16" height="16" class="section-icon">
                        <h3>${t('analyzedText', lang)}</h3>
                    </div>
                    <div class="analyzed-text">${item.text}</div>
                </div>
            `;
        }
        
        document.getElementById('chatContent').innerHTML = `
            <div class="chat-detail-header">
                <div class="chat-detail-title">
                    <div class="title-content">
                        <h2>${typeLabels[type]}</h2>
                    </div>
                    <div class="chat-actions-menu">
                        <button class="action-btn copy-btn" data-item-id="${itemId}" data-type="${type}" title="Copiar respuesta">
                            <img src="../icons/copy.svg" alt="Copiar" width="16" height="16">
                        </button>
                    </div>
                </div>
                
                <div class="chat-detail-meta">
                    <div class="meta-primary">
                        <span class="time">${time}</span>
                        <span class="date">${fullDate}</span>
                    </div>
                    <div class="meta-secondary">
                        <span class="relative-time">${relativeTime}</span>
                        <span class="domain">${item.domain || t('unknownDomain', lang)}</span>
                        ${item.url ? `<span class="url-info">
                            <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="url-link" title="${item.url}">
                                ${t('viewPage', lang)}
                            </a>
                        </span>` : ''}
                    </div>
                    ${item.url ? `<div class="meta-url">
                        <span class="full-url" title="${item.url}">${item.url}</span>
                    </div>` : ''}
                </div>
            </div>

            <div class="chat-detail-content">
                <div class="query-section">
                    <div class="section-header">
                        <img src="../icons/open-eye.svg" alt="Usuario" width="16" height="16" class="section-icon">
                        <h3>${t('yourQuery', lang)}</h3>
                    </div>
                    <div class="query-text">${item.query}</div>
                </div>

                ${additionalContent}

                <div class="response-section">
                    <div class="section-header">
                        <img src="../icons/describe.svg" alt="IA" width="16" height="16" class="section-icon">
                        <h3>${t('geminiResponse', lang)}</h3>
                    </div>
                    <div class="response-text">${item.response}</div>
                </div>
            </div>
        `;

        // Agregar event listener para el botón de copiar
        const copyBtn = document.querySelector('.copy-btn');

        if (copyBtn) {
            copyBtn.addEventListener('click', async (e) => {
                const itemId = e.currentTarget.dataset.itemId;
                const type = e.currentTarget.dataset.type;
                await copyQueryToClipboard(itemId, type);
            });
        }
        
    } catch (error) {
        console.error('Error showing chat content:', error);
    }
}

// Función para mostrar menú de chat (3 puntos)
function showChatMenu(event, type, itemId) {
    event.preventDefault();
    event.stopPropagation();
    
    selectedChat = { type, itemId };
    
    const contextMenu = document.getElementById('contextMenu');
    contextMenu.style.display = 'block';
    
    // Posicionar el menú cerca del botón de 3 puntos
    const rect = event.target.getBoundingClientRect();
    let left = rect.left - 120; // A la izquierda del botón
    let top = rect.bottom + 5;
    
    // Ajustar si se sale de la pantalla
    if (left < 10) {
        left = rect.right + 10; // A la derecha si no hay espacio a la izquierda
    }
    
    if (top + 120 > window.innerHeight) {
        top = rect.top - 120; // Arriba si no hay espacio abajo
    }
    
    contextMenu.style.left = left + 'px';
    contextMenu.style.top = top + 'px';
    
    // Animar entrada
    contextMenu.style.opacity = '0';
    contextMenu.style.transform = 'scale(0.95)';
    setTimeout(() => {
        contextMenu.style.opacity = '1';
        contextMenu.style.transform = 'scale(1)';
    }, 10);
    
    // Ocultar menú al hacer clic fuera
    setTimeout(() => {
        document.addEventListener('click', hideContextMenu, { once: true });
    }, 0);
}

// Función para mostrar menú contextual (clic derecho)
function showContextMenu(event, type, itemId) {
    event.preventDefault();
    event.stopPropagation();
    
    selectedChat = { type, itemId };
    
    const contextMenu = document.getElementById('contextMenu');
    contextMenu.style.display = 'block';
    contextMenu.style.left = event.pageX + 'px';
    contextMenu.style.top = event.pageY + 'px';
    
    // Ocultar menú al hacer clic fuera
    setTimeout(() => {
        document.addEventListener('click', hideContextMenu, { once: true });
    }, 0);
}

// Función para ocultar menú contextual
function hideContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    contextMenu.style.opacity = '0';
    contextMenu.style.transform = 'scale(0.95)';
    setTimeout(() => {
        contextMenu.style.display = 'none';
    }, 150);
}

// Función para eliminar chat seleccionado
async function deleteSelectedChat() {
    if (!selectedChat) return;
    
    const lang = navigator.language.startsWith('es') ? 'es' : 'en';
    if (confirm(t('deleteConfirm', lang))) {
        const historyManager = window.historyManagerInstance;
        if (historyManager) {
            await historyManager.deleteHistoryItem(selectedChat.type, selectedChat.itemId);
            
            // Volver a la pantalla de bienvenida
            document.querySelector('.chat-welcome').style.display = 'flex';
            document.getElementById('chatContent').style.display = 'none';
            
            // Actualizar estadísticas
            historyManager.updateStats();
        }
    }
    
    hideContextMenu();
}

// Función para exportar chat seleccionado
async function exportSelectedChat() {
    if (!selectedChat) return;
    
    try {
        const historyKeys = {
            images: 'historyImages',
            code: 'historyCode'
        };
        
        const result = await chrome.storage.local.get(historyKeys[selectedChat.type]);
        const history = result[historyKeys[selectedChat.type]] || [];
        const item = history.find(h => h.id === selectedChat.itemId);
        
        if (!item) {
            console.error('Consulta no encontrada para exportar');
            hideContextMenu();
            return;
        }
        
        // Crear objeto de exportación
        const exportData = {
            id: item.id,
            type: selectedChat.type,
            timestamp: item.timestamp,
            query: item.query,
            response: item.response,
            exportDate: new Date().toISOString()
        };
        
        // Si es código, incluir información adicional
        if (selectedChat.type === 'code' && item.code) {
            exportData.code = item.code;
            exportData.language = item.language;
        }
        
        // Si es imagen, incluir URL de imagen
        if (selectedChat.type === 'images' && item.imageUrl) {
            exportData.imageUrl = item.imageUrl;
        }
        
        // Crear archivo JSON
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Crear nombre de archivo
        const date = new Date(item.timestamp);
        const dateStr = date.toISOString().slice(0, 10);
        const timeStr = date.toTimeString().slice(0, 5).replace(':', '');
        const filename = `consulta_${selectedChat.type}_${dateStr}_${timeStr}.json`;
        
        // Descargar archivo
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Mostrar notificación de éxito
        const lang = navigator.language.startsWith('es') ? 'es' : 'en';
        showNotification(t('queryExported', lang) || 'Query exported successfully');
        
    } catch (error) {
        console.error('Error exporting query:', error);
        const lang = navigator.language.startsWith('es') ? 'es' : 'en';
        showNotification(t('exportError', lang) || 'Error exporting query');
    }
    
    hideContextMenu();
}

// Función para copiar consulta al portapapeles
async function copyQueryToClipboard(itemId, type) {
    try {
        const historyKeys = {
            images: 'historyImages',
            code: 'historyCode', 
            text: 'historyText'
        };
        
        const result = await chrome.storage.local.get(historyKeys[type]);
        const history = result[historyKeys[type]] || [];
        const item = history.find(h => h.id === itemId);
        
        if (item && item.response) {
            await navigator.clipboard.writeText(item.response);
            
            // Mostrar notificación
            const lang = navigator.language.startsWith('es') ? 'es' : 'en';
            showNotification(t('responseCopied', lang));
            
            // Mostrar feedback visual en el botón
            const button = document.querySelector(`.copy-btn[data-item-id="${itemId}"]`);
            if (button) {
                const originalContent = button.innerHTML;
                button.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                `;
                button.style.color = '#4ade80';
                
                setTimeout(() => {
                    button.innerHTML = originalContent;
                    button.style.color = '';
                }, 2000);
            }
        }
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        // Fallback para navegadores que no soportan clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = item?.response || '';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
}



// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const historyManager = new HistoryManager();
        window.historyManagerInstance = historyManager; // Para acceso global
        // Wait for initialization to complete
        await historyManager.init();        
        // Actualizar estadísticas iniciales
        setTimeout(() => {
            historyManager.updateStats();
        }, 500);
        
        // Ensure tooltip is set correctly after all initialization
        setTimeout(() => {
            const clearAllHistoryBtn = document.getElementById('clearAllHistory');
            if (clearAllHistoryBtn) {
                const isSpanish = navigator.language.startsWith('es');
                const tooltipText = isSpanish ? 'Limpiar Todo el Historial' : 'Clear All History';
                clearAllHistoryBtn.title = tooltipText;
            }
        }, 1000);
    } catch (error) {
        console.error('Error initializing HistoryManager:', error);
    }
});



// Make HistoryStorage available globally for content scripts
window.HistoryStorage = HistoryStorage;

// Global i18n function 't' provided by utils/i18n.js

// Variables globales
let extensionSettings = {
    contextualIcons: true,
    globalPlayer: true,
    voice: '',
    speed: 1.0,
    pitch: 1.0,
    geminiApiKey: ''
};

let isExtensionActive = false;
let audioPlayerInstance = null;
let selectionContextualInstance = null;

// Inicialización
(function() {
    'use strict';
    
    // Cargar configuración y inicializar
    loadSettingsAndInit();
})();

// Cargar configuración e inicializar extensión
async function loadSettingsAndInit() {
    try {
        // Cargar configuración desde storage
        const result = await chrome.storage.sync.get(extensionSettings);
        extensionSettings = { ...extensionSettings, ...result };        
        // Inicializar extensión
        initializeExtension();
        
        // Configurar observer para páginas dinámicas
        setupPageObserver();
        
    } catch (error) {
        console.error(t('errorLoadingConfiguration'), error);
        // Inicializar con configuración por defecto
        initializeExtension();
        setupPageObserver();
    }
}

// Observer para detectar cambios en páginas SPA
function setupPageObserver() {
    const observer = new MutationObserver((mutations) => {
        let shouldReinit = false;
        
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (let node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Verificar si hay contenido significativo
                        const hasText = node.textContent && node.textContent.trim().length > 100;
                        const hasStructure = node.querySelector && (
                            node.querySelector('p, article, section, main, div') ||
                            node.tagName === 'P' ||
                            node.tagName === 'ARTICLE' ||
                            node.tagName === 'SECTION' ||
                            node.tagName === 'MAIN'
                        );
                        
                        if (hasText || hasStructure) {
                            shouldReinit = true;
                            break;
                        }
                    }
                }
            }
        });
        
        if (shouldReinit) {
            // Solo verificar reproductor si no existe
            const existingPlayer = document.querySelector('.audio-player-global');
            if (!existingPlayer && extensionSettings.globalPlayer) {
                initAudioPlayer();
            }
        }
    });
    
    // Observar cambios en el body
    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

// Inicializar extensión
function initializeExtension() {
    if (isExtensionActive) {
        return;
    }
    // Inicializar reproductor global PRIMERO para máxima compatibilidad
    if (extensionSettings.globalPlayer) {
        initAudioPlayer();
    }
    
    // Luego inicializar sistema de selección contextual
    if (extensionSettings.contextualIcons) {
        initSelectionContextual();
    }
    
    // Configurar listeners
    setupMessageListeners();
    
    isExtensionActive = true;
}

// Inicializar reproductor de audio global
async function initAudioPlayer() {
    try {
        if (audioPlayerInstance) {
            return;
        }
        

        
        if (typeof window.AudioPlayer === 'undefined') {
            console.error(' AudioPlayer no está definido');
            // Intentar cargar con retry
            setTimeout(() => {
                if (typeof window.AudioPlayer !== 'undefined') {
                    initAudioPlayer();
                }
            }, 1000);
            return;
        }
        
        audioPlayerInstance = new window.AudioPlayer(extensionSettings);
        await audioPlayerInstance.init();
        
        // Exponer la instancia globalmente para acceso desde otros módulos
        window.audioPlayerInstance = audioPlayerInstance;
                
    } catch (error) {
        console.error(t('errorInitializingPlayer'), error);
        
        // Retry después de 2 segundos
        setTimeout(() => {
            audioPlayerInstance = null;
            initAudioPlayer();
        }, 2000);
    }
}

// Inicializar sistema de selección contextual
function initSelectionContextual() {
    try {        
        if (selectionContextualInstance) {
            destroySelectionContextual();
        }
        
        if (typeof window.SelectionContextual === 'undefined') {
            console.error(t('selectionContextualNotDefined'));
            // Intentar cargar con retry
            setTimeout(() => {
                if (typeof window.SelectionContextual !== 'undefined') {
                    initSelectionContextual();
                }
            }, 1000);
            return;
        }
        
        // Crear nueva instancia con configuración actual
        selectionContextualInstance = new window.SelectionContextual(extensionSettings);
        
        // Exportar instancia globalmente para acceso desde otros archivos
        window.selectionContextual = selectionContextualInstance;        
    } catch (error) {
        console.error(t('errorInitializingSelection'), error);
        // Limpiar instancia fallida
        selectionContextualInstance = null;
        window.selectionContextual = null;
        
        // Retry después de 2 segundos
        setTimeout(() => {
            initSelectionContextual();
        }, 2000);
    }
}

// Inicializar modo lectura

// Configurar listeners de mensajes
function setupMessageListeners() {
    // Listener para mensajes del popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {        
        switch (request.action || request.type) {
            case 'updateSettings':
            case 'SETTINGS_UPDATED':
                updateSettings(request.settings);
                sendResponse({ success: true });
                break;
                
            case 'getStatus':
                sendResponse({
                    isActive: isExtensionActive,
                    settings: extensionSettings
                });
                break;
                

                
            case 'toggleGlobalPlayer':
                toggleGlobalPlayer();
                sendResponse({ success: true });
                break;
                
            case 'toggleContextualIcons':
                toggleContextualIcons();
                sendResponse({ success: true });
                break;
                

                
            case 'TOGGLE_AUDIO_PLAYER':
                toggleGlobalPlayer();
                sendResponse({ success: true });
                break;
                
            default:
                sendResponse({ success: false, error: 'Acción no reconocida' });
        }
        
        return true; // Mantener el canal abierto para respuesta asíncrona
    });
}

// Actualizar configuración
function updateSettings(newSettings) {    
    const oldSettings = { ...extensionSettings };
    extensionSettings = { ...extensionSettings, ...newSettings };    
    // Guardar en storage
    chrome.storage.sync.set(extensionSettings);
    
    // Actualizar instancias existentes
    if (audioPlayerInstance && audioPlayerInstance.updateSettings) {
        audioPlayerInstance.updateSettings(extensionSettings);
    }
    
    if (selectionContextualInstance && selectionContextualInstance.updateSettings) {
        selectionContextualInstance.updateSettings(extensionSettings);
    }

    
    // Reinicializar si es necesario
    if (oldSettings.globalPlayer !== extensionSettings.globalPlayer) {
        if (extensionSettings.globalPlayer) {
            initAudioPlayer();
        } else {
            destroyAudioPlayer();
        }
    }
    
    if (oldSettings.contextualIcons !== extensionSettings.contextualIcons) {
        if (extensionSettings.contextualIcons) {
            initSelectionContextual();
        } else {
            destroySelectionContextual();
        }
    }
}

// Toggle funciones


function toggleGlobalPlayer() {
    extensionSettings.globalPlayer = !extensionSettings.globalPlayer;
    chrome.storage.sync.set({ globalPlayer: extensionSettings.globalPlayer });
    
    if (extensionSettings.globalPlayer) {
        initAudioPlayer();
    } else {
        destroyAudioPlayer();
    }
}

function toggleContextualIcons() {
    extensionSettings.contextualIcons = !extensionSettings.contextualIcons;
    chrome.storage.sync.set({ contextualIcons: extensionSettings.contextualIcons });
    
    if (extensionSettings.contextualIcons) {
        initSelectionContextual();
    } else {
        destroySelectionContextual();
    }
}

// Destroy funciones
function destroyAudioPlayer() {
    if (audioPlayerInstance && audioPlayerInstance.destroy) {
        audioPlayerInstance.destroy();
        audioPlayerInstance = null;
    }
}

function destroySelectionContextual() {
    try {
        if (selectionContextualInstance) {            
            if (selectionContextualInstance.destroy) {
                selectionContextualInstance.destroy();
            }
            
            selectionContextualInstance = null;
            window.selectionContextual = null;
        }
    } catch (error) {
        console.error('[Content] Error destruyendo sistema de selección:', error);
        selectionContextualInstance = null;
        window.selectionContextual = null;
    }
}



// Función utilitaria para detectar idioma de código
function detectCodeLanguage(element) {
    const className = element.className || '';
    const dataLanguage = element.getAttribute('data-language') || '';
    
    // Patrones para detectar lenguajes comunes
    const languagePatterns = {
        'javascript': /\b(javascript|js)\b/i,
        'python': /\bpython\b/i,
        'html': /\bhtml\b/i,
        'css': /\bcss\b/i,
        'json': /\bjson\b/i,
        'sql': /\bsql\b/i,
        'bash': /\b(bash|shell|sh)\b/i,
        'java': /\bjava\b/i,
        'cpp': /\b(cpp|c\+\+)\b/i,
        'c': /\bc\b/i,
        'php': /\bphp\b/i,
        'ruby': /\bruby\b/i,
        'go': /\bgo\b/i,
        'rust': /\brust\b/i,
        'typescript': /\b(typescript|ts)\b/i
    };
    
    // Verificar data-language primero
    if (dataLanguage) {
        for (const [language, pattern] of Object.entries(languagePatterns)) {
            if (pattern.test(dataLanguage)) {
                return language;
            }
        }
    }
    
    // Luego verificar className
    for (const [language, pattern] of Object.entries(languagePatterns)) {
        if (pattern.test(className)) {
            return language;
        }
    }
    
    return 'unknown';
}

// Función utilitaria para crear elementos con clases
function createElement(tag, className = '', textContent = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
}

// Función utilitaria para obtener configuración de TTS
function getTTSConfig() {
    return {
        voice: extensionSettings.voice,
        rate: extensionSettings.speed,
        pitch: extensionSettings.pitch,
        volume: 1.0,
        lang: 'es-ES'
    };
}

// Función utilitaria para hablar texto
function speakText(text, config = {}) {
    // Cancelar cualquier síntesis anterior
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    try {
        // Verificar si AudioPlayer está disponible
        if (typeof window.AudioPlayer !== 'undefined' && window.AudioPlayer.applyGlobalVoiceConfig) {
            // Usar la configuración centralizada del reproductor global
            window.AudioPlayer.applyGlobalVoiceConfig(utterance);
        } else {            
            // Configuración de respaldo usando getTTSConfig
            const ttsConfig = { ...getTTSConfig(), ...config };
            
            // Configurar voz si está especificada
            if (ttsConfig.voice) {
                const voices = speechSynthesis.getVoices();
                const selectedVoice = voices.find(voice => voice.name === ttsConfig.voice);
                if (selectedVoice) {
                    utterance.voice = selectedVoice;
                }
            }
            
            utterance.rate = ttsConfig.rate;
            utterance.pitch = ttsConfig.pitch;
            utterance.volume = ttsConfig.volume;
            utterance.lang = ttsConfig.lang;
        }
        
    } catch (error) {
        console.error('[DEBUG] Error aplicando configuración global para speakText (content.js):', error);
        
        // Valores por defecto de emergencia
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.lang = 'es-ES';
    }
    
    return new Promise((resolve, reject) => {
        utterance.onend = () => resolve();
        utterance.onerror = (error) => reject(error);
        
        speechSynthesis.speak(utterance);
    });
}

// Función para detener toda la reproducción de audio/voz
function stopAllAudioPlayback() {    
    // Detener síntesis de voz del navegador
    if (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.paused)) {
        window.speechSynthesis.cancel();
    }
    
    // Detener cualquier reproducción activa en la instancia de selección contextual
    if (selectionContextualInstance && selectionContextualInstance.isReading) {
        selectionContextualInstance.stopReading();
    }
    
    // Detener reproductor de audio global si existe
    if (audioPlayerInstance && audioPlayerInstance.isPlaying) {
        audioPlayerInstance.stop();
    }
}

// Detener la voz cuando se recarga o sale de la página
window.addEventListener('beforeunload', stopAllAudioPlayback);
window.addEventListener('unload', stopAllAudioPlayback);

// También detener cuando la página pierde el foco (por si acaso)
window.addEventListener('pagehide', stopAllAudioPlayback);

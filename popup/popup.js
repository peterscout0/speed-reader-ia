// 🔧 DEBUG MODE - Set to false for production
const DEBUG_POPUP = false;
const debugLog = (...args) => DEBUG_POPUP && console.log('[Popup]', ...args);
const debugWarn = (...args) => DEBUG_POPUP && console.warn('[Popup]', ...args);
const debugError = (...args) => console.error('[Popup]', ...args); // Errors always show

// Helper function for i18n
const t = (key, substitutions = null) => {
    try {
        return chrome.i18n.getMessage(key, substitutions) || key;
    } catch (error) {
        debugWarn('i18n key not found:', key);
        return key;
    }
};

// Default settings configuration
const DEFAULT_SETTINGS = {
    contextualIcons: true,
    globalPlayer: true,
    geminiApiKey: '', // Always starts empty - each user must enter their own
    preferredModel: 'models/gemini-2.5-flash' // Updated model available in 2025
};

let currentSettings = { ...DEFAULT_SETTINGS };

// Funciones de cifrado básico para API key (seguridad adicional)
function simpleEncrypt(text) {
    if (!text) return '';
    // Cifrado simple XOR + Base64 (mejor que texto plano)
    const key = 'SpeedReaderIA2025';
    let encrypted = '';
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        encrypted += String.fromCharCode(charCode);
    }
    return btoa(encrypted);
}

function simpleDecrypt(encryptedText) {
    if (!encryptedText) return '';
    try {
        const key = 'SpeedReaderIA2025';
        const encrypted = atob(encryptedText);
        let decrypted = '';
        for (let i = 0; i < encrypted.length; i++) {
            const charCode = encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            decrypted += String.fromCharCode(charCode);
        }
        return decrypted;
    } catch {
        return encryptedText; // Fallback if not encrypted
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize i18n translations
    if (typeof translatePage === 'function') {
        translatePage();
    }
    
    await loadSettings();
    setupEventListeners();
    updateUI();
});

async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
        currentSettings = { ...DEFAULT_SETTINGS, ...result };
        
        // Descifrar API key si existe
        if (currentSettings.geminiApiKey) {
            const decryptedApiKey = simpleDecrypt(currentSettings.geminiApiKey);
            // Mantener cifrada en currentSettings pero mostrar descifrada en UI
            if (document.getElementById('geminiApiKey')) {
                document.getElementById('geminiApiKey').value = decryptedApiKey;
            }
        }
    } catch (error) {
        console.error(t('errorLoadingConfig') + ':', error);
        showStatus(t('errorLoadingConfig'), 'error');
    }
}
function setupEventListeners() {
    const contextualIconsToggle = document.getElementById('contextualIcons');
    const globalPlayerToggle = document.getElementById('globalPlayer');
    
    if (contextualIconsToggle) {
        contextualIconsToggle.addEventListener('change', (e) => {
            updateSettings();
        });
    }
    
    if (globalPlayerToggle) {
        globalPlayerToggle.addEventListener('change', (e) => {
            updateSettings();
        });
    }
    
    // Configurar manejadores de API key
    setupApiKeyHandlers();
    
    const saveButton = document.getElementById('saveSettings');
    if (saveButton) {
        saveButton.addEventListener('click', saveSettings);
    }
}
function updateUI() {
    document.getElementById('contextualIcons').checked = currentSettings.contextualIcons;
    document.getElementById('globalPlayer').checked = currentSettings.globalPlayer;
    
    // API Key - mostrar versión desencriptada
    const apiKeyInput = document.getElementById('geminiApiKey');
    if (apiKeyInput) {
        const decryptedApiKey = currentSettings.geminiApiKey ? simpleDecrypt(currentSettings.geminiApiKey) : '';
        apiKeyInput.value = decryptedApiKey;
    }
}

async function updateSettings() {
    const contextualIconsElement = document.getElementById('contextualIcons');
    const globalPlayerElement = document.getElementById('globalPlayer');
    
    // Guardar estados anteriores para comparación
    const oldContextualIcons = currentSettings.contextualIcons;
    const oldGlobalPlayer = currentSettings.globalPlayer;
    
    if (contextualIconsElement) {
        currentSettings.contextualIcons = contextualIconsElement.checked;
    }
    
    if (globalPlayerElement) {
        currentSettings.globalPlayer = globalPlayerElement.checked;
    }
    
    const geminiApiKeyInput = document.getElementById('geminiApiKey');
    if (geminiApiKeyInput) {
        // Encriptar la API key antes de guardar
        const apiKey = geminiApiKeyInput.value.trim();
        currentSettings.geminiApiKey = apiKey ? simpleEncrypt(apiKey) : '';
    }    
    try {
        // Save to storage immediately
        await chrome.storage.sync.set(currentSettings);
        
        // Send to content script after saving
        await sendSettingsToContentScript();
        
        // Check if changes require reload
        const needsReload = (oldContextualIcons !== currentSettings.contextualIcons) || 
                           (oldGlobalPlayer !== currentSettings.globalPlayer);
        
        if (needsReload) {
            showReloadNotification();
        }
    } catch (error) {
        console.error('[Popup] Error updating settings:', error);
    }
}

async function saveSettings() {
    try {
        await chrome.storage.sync.set(currentSettings);
        
        const tabs = await chrome.tabs.query({});
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                type: 'SETTINGS_UPDATED',
                settings: currentSettings
            }).catch(() => {
                // Ignorar errores si el tab no tiene content script
            });
        });
        
        // Siempre mostrar notificación de recarga al guardar configuración manualmente
        showReloadNotification();
        
    } catch (error) {
        console.error(t('errorSavingConfig') + ':', error);
        showStatus(t('errorSavingConfig'), 'error');
    }
}
async function sendSettingsToContentScript() {
    try {
        // Enviar a todas las pestañas, no solo la activa
        const tabs = await chrome.tabs.query({});
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                type: 'SETTINGS_UPDATED',
                settings: currentSettings
            }).catch(() => {
                // Ignorar errores si el tab no tiene content script
            });
        });
    } catch (error) {
        console.error(t('errorSendingConfig') + ':', error);
    }
}
function showStatus(message, type = 'info') {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
    setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'status';
    }, 3000);
}

function showReloadNotification() {
    const statusElement = document.getElementById('statusMessage');
    
    // Crear contenido con botón de recarga
    statusElement.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px; align-items: center;">
            <span style="color: #60aaff; font-weight: 600;">${t('changesApplied')}</span>
            <span style="font-size: 12px; opacity: 0.8;">${t('reloadPageDescription')}</span>
            <button id="reloadPageBtn" style="
                background: linear-gradient(135deg, rgba(96, 170, 255, 0.9) 0%, rgba(60, 130, 255, 1) 100%);
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                transition: all 0.2s ease;
                box-shadow: 0 2px 6px rgba(96, 170, 255, 0.3);
            ">${t('reloadPage')}</button>
        </div>
    `;
    
    statusElement.className = 'status reload-notification';
    
    // Agregar event listener al botón de recarga
    const reloadBtn = document.getElementById('reloadPageBtn');
    if (reloadBtn) {
        reloadBtn.addEventListener('click', async () => {
            try {
                // Recargar la pestaña activa
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    await chrome.tabs.reload(tab.id);
                    // Cerrar el popup después de recargar
                    window.close();
                }
            } catch (error) {
                console.error('Error recargando página:', error);
                showStatus('Error recargando la página', 'error');
            }
        });
        
        // Efecto hover para el botón
        reloadBtn.addEventListener('mouseenter', () => {
            reloadBtn.style.background = 'linear-gradient(135deg, rgba(110, 180, 255, 1) 0%, rgba(70, 140, 255, 1) 100%)';
            reloadBtn.style.transform = 'translateY(-1px)';
            reloadBtn.style.boxShadow = '0 4px 8px rgba(96, 170, 255, 0.4)';
        });
        
        reloadBtn.addEventListener('mouseleave', () => {
            reloadBtn.style.background = 'linear-gradient(135deg, rgba(96, 170, 255, 0.9) 0%, rgba(60, 130, 255, 1) 100%)';
            reloadBtn.style.transform = 'translateY(0)';
            reloadBtn.style.boxShadow = '0 2px 6px rgba(96, 170, 255, 0.3)';
        });
    }
    
    // No auto-ocultar esta notificación - dejar que persista hasta que el usuario actúe
}

function testVoice() {
    speechSynthesis.cancel();
    
    const testText = "Hola, esta es una prueba de la voz seleccionada para el Speed Reader IA.";
    const availableVoices = speechSynthesis.getVoices().filter(voice => 
        voice.lang.startsWith('es') || voice.lang.startsWith('en')
    );
    
    if (availableVoices.length === 0) {
        showStatus('No hay voces disponibles para la prueba', 'error');
        return;
    }
    
    const utterance = new SpeechSynthesisUtterance(testText);
    if (currentSettings.voice) {
        const selectedVoice = availableVoices.find(voice => voice.name === currentSettings.voice);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        } else {
            console.warn('Voz seleccionada no encontrada, usando voz por defecto');
        }
    }
    utterance.rate = currentSettings.speed;
    utterance.pitch = currentSettings.pitch;
    utterance.volume = 1.0;
    
    utterance.onstart = () => {
        showStatus('Reproduciendo prueba de voz...', 'info');
    };
    
    utterance.onend = () => {
        showStatus('Prueba de voz completada', 'success');
    };
    
    utterance.onerror = (event) => {
        console.error('Error en prueba de voz:', event);
        showStatus('Error reproduciendo prueba de voz', 'error');
    };
    
    try {
        speechSynthesis.speak(utterance);
    } catch (error) {
        console.error('Error starting voice test:', error);
        showStatus(t('errorStartingVoiceTest'), 'error');
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const voiceSelect = document.getElementById('voiceSelect');
    const testButton = document.createElement('button');
    testButton.textContent = t('testVoice');
    testButton.className = 'test-voice-btn';
    testButton.type = 'button';
    testButton.style.cssText = `
        background: linear-gradient(145deg, #60aaff, #4a90e2);
        color: white;
        border: none;
        padding: 10px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        margin-top: 10px;
        width: 100%;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(96, 170, 255, 0.3);
    `;

    testButton.addEventListener('mouseenter', () => {
        testButton.style.background = 'linear-gradient(145deg, #4a90e2, #60aaff)';
        testButton.style.transform = 'translateY(-1px)';
        testButton.style.boxShadow = '0 4px 12px rgba(96, 170, 255, 0.4)';
    });
    
    testButton.addEventListener('mouseleave', () => {
        testButton.style.background = 'linear-gradient(145deg, #60aaff, #4a90e2)';
        testButton.style.transform = 'translateY(0)';
        testButton.style.boxShadow = '0 2px 8px rgba(96, 170, 255, 0.3)';
    });

    testButton.addEventListener('click', testVoice);
    voiceSelect.parentNode.appendChild(testButton);
});

function setupApiKeyHandlers() {
    const apiKeyInput = document.getElementById('geminiApiKey');
    const toggleButton = document.getElementById('toggleApiKey');
    const testButton = document.getElementById('testApiKey');
    const statusDiv = document.getElementById('apiKeyStatus');
    
    if (!apiKeyInput || !toggleButton || !testButton || !statusDiv) {
        console.warn('Elementos de API key no encontrados:', {
            apiKeyInput: !!apiKeyInput,
            toggleButton: !!toggleButton, 
            testButton: !!testButton,
            statusDiv: !!statusDiv
        });
        return;
    }
    
    // NUEVA: Asegurar que el campo siempre muestre la versión desencriptada
    if (currentSettings.geminiApiKey) {
        const decryptedApiKey = simpleDecrypt(currentSettings.geminiApiKey);
        if (decryptedApiKey && decryptedApiKey.startsWith('AIzaSy')) {
            apiKeyInput.value = decryptedApiKey;
        }
    }
    
    // Toggle mostrar/ocultar API key
    toggleButton.addEventListener('click', () => {
        const icon = toggleButton.querySelector('.button-icon');        
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            if (icon) icon.src = '../icons/open-eye.svg';
            toggleButton.title = t('hideApiKey');
        } else {
            apiKeyInput.type = 'password';
            if (icon) icon.src = '../icons/hidden-eye.svg';
            toggleButton.title = t('showApiKey');
        }
    });
    
    // Backup event listener para asegurar funcionalidad
    toggleButton.onclick = function(e) {
        e.preventDefault();
        const icon = toggleButton.querySelector('.button-icon');
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            if (icon) icon.src = '../icons/open-eye.svg';
            toggleButton.title = t('hideApiKey');
        } else {
            apiKeyInput.type = 'password';
            if (icon) icon.src = '../icons/hidden-eye.svg';
            toggleButton.title = t('showApiKey');
        }
    };
    
    // Guardar API key cuando cambie
    apiKeyInput.addEventListener('input', () => {
        const apiKey = apiKeyInput.value.trim();
        
        // Solo cifrar si la clave parece válida (formato API key de Google)
        // Evitar cifrar claves ya cifradas
        let encryptedApiKey = '';
        if (apiKey) {
            if (apiKey.startsWith('AIzaSy')) {
                // Es una API key válida, cifrarla
                encryptedApiKey = simpleEncrypt(apiKey);
            } else {
                // Podría ser una clave ya cifrada o inválida, no re-cifrar
                // Intentar desencriptar para verificar
                try {
                    const decrypted = simpleDecrypt(apiKey);
                    if (decrypted && decrypted.startsWith('AIzaSy')) {
                        // Era una clave cifrada válida, mantenerla
                        encryptedApiKey = apiKey;
                    } else {
                        // No es una clave válida, pero guardarla cifrada por si acaso
                        encryptedApiKey = simpleEncrypt(apiKey);
                    }
                } catch (error) {
                    // Error al desencriptar, asumir que es texto plano y cifrar
                    encryptedApiKey = simpleEncrypt(apiKey);
                }
            }
        }
        currentSettings.geminiApiKey = encryptedApiKey;
        
        // Guardar inmediatamente
        chrome.storage.sync.set(currentSettings);
        
        // Limpiar estado anterior
        statusDiv.className = 'api-key-status';
        statusDiv.style.display = 'none';
        
        // Validación básica de formato
        if (apiKey && !apiKey.startsWith('AIzaSy')) {
            showApiKeyStatus('warning', t('invalidApiKeyFormat'));
        }
    });
    
    // Probar API key
    testButton.addEventListener('click', async () => {
        // Obtener la API key del campo y asegurar que sea la versión desencriptada
        let apiKey = apiKeyInput.value.trim();
        
        // Si no hay valor en el campo, intentar obtener de la configuración guardada
        if (!apiKey && currentSettings.geminiApiKey) {
            apiKey = simpleDecrypt(currentSettings.geminiApiKey);
        }
        
        if (!apiKey) {
            showApiKeyStatus('error', t('enterApiKeyToTest'));
            return;
        }
        
        // Si la API key parece estar encriptada (no empieza con AIzaSy), intentar desencriptarla
        if (!apiKey.startsWith('AIzaSy')) {
            try {
                const decryptedKey = simpleDecrypt(apiKey);
                if (decryptedKey && decryptedKey.startsWith('AIzaSy')) {
                    apiKey = decryptedKey;
                    // Actualizar el campo con la versión correcta
                    apiKeyInput.value = apiKey;
                } else {
                    showApiKeyStatus('error', t('invalidApiKeyFormat'));
                    return;
                }
            } catch (error) {
                showApiKeyStatus('error', t('invalidApiKeyFormat'));
                return;
            }
        }
        
        showApiKeyStatus('loading', t('testingConnection'));
        testButton.disabled = true;
        
        try {
            const result = await comprehensiveApiKeyTest(apiKey);
            
            if (result.success) {
                // Guardar el mejor modelo encontrado en la configuración
                if (result.bestModel) {
                    currentSettings.preferredModel = result.bestModel;
                    chrome.storage.sync.set(currentSettings);
                }
                
                const modelName = result.bestModel ? result.bestModel.replace('models/', '') : 'modelo detectado';
                const modelCount = result.availableModels ? result.availableModels.length : 0;
                
                let statusMessage = t('apiKeyValid').replace('{0}', modelName);
                
                if (result.method === 'complete') {
                    statusMessage += `. ${t('aiFunctionsActivated')}`;
                } else if (result.method === 'models-only') {
                    statusMessage += `. ${t('modelsAvailable').replace('{0}', modelCount)}`;
                }
                
                showApiKeyStatus('success', statusMessage);
                
                // Log adicional para debugging                
            } else {
                const errorMsg = result.error || t('apiKeyInvalidOrNoPermissions');
                showApiKeyStatus('error', errorMsg);
            }
        } catch (error) {
            console.error('Error probando API key:', error);
            
            // Mostrar mensaje específico basado en el error
            let errorMessage = t('unknownError');
            
            if (error.message.includes('conexión')) {
                errorMessage = error.message;
            } else if (error.message.includes('CORS')) {
                errorMessage = error.message;
            } else if (error.message.includes('API_KEY_INVALID') || error.message.includes('inválida')) {
                errorMessage = t('invalidApiKeyCheckStudio');
            } else if (error.message.includes('PERMISSION_DENIED') || error.message.includes('denegados')) {
                errorMessage = error.message;
            } else if (error.message.includes('HTTP 4')) {
                errorMessage = t('authenticationError');
            } else {
                errorMessage = error.message;
            }
            
            showApiKeyStatus('error', errorMessage);
        } finally {
            testButton.disabled = false;
        }
    });
}

function showApiKeyStatus(type, message) {
    const statusDiv = document.getElementById('apiKeyStatus');
    if (statusDiv) {
        statusDiv.className = `api-key-status ${type}`;
        statusDiv.textContent = message;
        statusDiv.style.display = 'block';
        
        // Auto-hide after 5 seconds except if it's success
        if (type !== 'success') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }
    }
}

async function testGeminiApiKey(apiKey, modelName = 'models/gemini-2.5-flash') {
    try {        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: "Hello, respond with one word: OK"
                    }]
                }]
            })
        });
                
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            
            try {
                const errorJson = JSON.parse(errorText);
                console.error('API Error Details:', errorJson);
                
                if (errorJson.error) {
                    throw new Error(errorJson.error.message || `HTTP ${response.status}: ${errorJson.error.status || response.statusText}`);
                }
            } catch (parseError) {
                console.error('Could not parse error response:', parseError);
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }
            
            return false;
        }
        
        const responseData = await response.json();        
        if (responseData.candidates && responseData.candidates.length > 0) {
            return true;
        } else {
            console.warn('Valid API key but no response');
            return false;
        }
        
    } catch (error) {
        console.error('Error testing API key:', error);
        
        // Verificar tipos específicos de errores
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Error de conexión. Verifica tu internet o permisos de la extensión.');
        } else if (error.message.includes('CORS')) {
            throw new Error('Error de CORS. La API puede no estar disponible desde extensiones.');
        } else if (error.message.includes('API_KEY_INVALID')) {
            throw new Error('API key inválida. Verifica que sea correcta en Google AI Studio.');
        } else if (error.message.includes('PERMISSION_DENIED')) {
            throw new Error('Permisos denegados. Verifica la configuración de tu API key.');
        }
        
        throw error;
    }
}

// Función mejorada para probar la API key usando el endpoint de modelos
async function testGeminiApiKeyAlternative(apiKey) {
    try {        
        // Probar listar modelos disponibles
        const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
            
        if (!modelsResponse.ok) {
            const errorText = await modelsResponse.text();
            console.error('Models API Error:', errorText);
            
            // Manejar errores específicos
            if (modelsResponse.status === 401) {
                throw new Error('API key inválida o sin autenticación');
            } else if (modelsResponse.status === 403) {
                throw new Error('API key sin permisos o región no soportada');
            } else if (modelsResponse.status === 400) {
                throw new Error('Solicitud inválida a la API');
            }
            
            return false;
        }
        
        const modelsData = await modelsResponse.json();        
        // Filtrar solo modelos que soporten generateContent
        const generateModels = modelsData.models?.filter(model => 
            model.supportedGenerationMethods?.includes('generateContent') ||
            model.name?.includes('gemini')
        ) || [];
        
        if (generateModels.length > 0) {
            return { success: true, models: generateModels };
        }
        
        console.warn('API key válida pero sin modelos de generación');
        return { success: false, models: [] };
        
    } catch (error) {
        console.error('Error in alternative test:', error);
        throw error;
    }
}

// Función para obtener modelos disponibles
async function getAvailableModels(apiKey) {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();        
        // Filtrar solo modelos que soporten generateContent
        const generateModels = data.models?.filter(model => 
            model.supportedGenerationMethods?.includes('generateContent')
        ) || [];        
        return generateModels;
    } catch (error) {
        console.error('Error obteniendo modelos:', error);
        return [];
    }
}

// Función para encontrar el mejor modelo disponible
async function findBestAvailableModel(apiKey) {
    const models = await getAvailableModels(apiKey);
    
    // Orden de preferencia de modelos (actualizados a 2025)
    const preferredModels = [
        'models/gemini-2.5-flash',
        'models/gemini-2.5-pro',
        'models/gemini-2.0-flash',
        'models/gemini-flash-latest'
    ];
    
    for (const preferred of preferredModels) {
        if (models.find(model => model.name === preferred)) {
            return preferred;
        }
    }
    
    // Si no encuentra ninguno preferido, usar el primero disponible
    if (models.length > 0) {
        const fallback = models[0].name;
        return fallback;
    }
    
    throw new Error('No se encontraron modelos compatibles');
}

// Función híbrida que prueba ambos métodos
async function comprehensiveApiKeyTest(apiKey) {    
    // Paso 1: Verificar disponibilidad de modelos
    try {
        const modelTest = await testGeminiApiKeyAlternative(apiKey);
        
        if (!modelTest.success) {
            return { success: false, method: 'models', error: 'No hay modelos disponibles' };
        }        
        // Paso 2: Encontrar el mejor modelo disponible
        const bestModel = await findBestAvailableModel(apiKey);        
        // Paso 3: Probar generación de contenido con el mejor modelo
        try {
            const generateTest = await testGeminiApiKey(apiKey, bestModel);
            
            if (generateTest) {
                return { 
                    success: true, 
                    method: 'complete', 
                    bestModel: bestModel,
                    availableModels: modelTest.models
                };
            }
        } catch (generateError) {
            console.warn('Generación falló, pero modelos están disponibles:', generateError.message);
            
            // Si la generación falla pero los modelos están disponibles, es un éxito parcial
            return { 
                success: true, 
                method: 'models-only', 
                bestModel: bestModel,
                availableModels: modelTest.models,
                warning: generateError.message
            };
        }
        
        return { 
            success: true, 
            method: 'models-only', 
            bestModel: bestModel,
            availableModels: modelTest.models
        };
        
    } catch (error) {
        console.error('Prueba comprensiva falló:', error.message);
        throw error;
    }
}

// Funciones para la barra de progreso de uso diario
async function updateUsageTracker() {
    try {
        const today = new Date().toDateString();
        const result = await chrome.storage.local.get(['dailyUsage', 'lastUsageDate']);
        
        let dailyUsage = result.dailyUsage || 0;
        const lastUsageDate = result.lastUsageDate;
        
        // Reset counter if it's a new day
        if (lastUsageDate !== today) {
            dailyUsage = 0;
        }

        // Update UI
        const usageCount = document.getElementById('usageCount');
        const progressBar = document.getElementById('usageProgress');
        const usagePercentage = document.getElementById('usagePercentage');
        
        if (usageCount && progressBar && usagePercentage) {
            usageCount.textContent = dailyUsage;
            
            // Show progress bar based on reasonable daily usage estimation
            const reasonableDaily = 50; // Most users don't make 50+ queries per day
            const percentage = Math.min((dailyUsage / reasonableDaily) * 100, 100);
            
            progressBar.style.width = `${percentage}%`;
            usagePercentage.textContent = t('today');
            
            // Update progress bar color and show warnings based on usage
            if (dailyUsage < 20) {
                progressBar.style.background = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
            } else if (dailyUsage < 40) {
                progressBar.style.background = 'linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%)';
            } else {
                progressBar.style.background = 'linear-gradient(135deg, #ff7675 0%, #fd79a8 100%)';
                // Show warning for heavy usage
                const warningDiv = document.querySelector('.usage-warning');
                if (!warningDiv && dailyUsage >= 40) {
                    const warning = document.createElement('div');
                    warning.className = 'usage-warning';
                    warning.innerHTML = '<small style="color: #ff7675;">Alto uso detectado. Verifica tus límites en Google AI Studio.</small>';
                    document.querySelector('.usage-tracker').appendChild(warning);
                }
            }
        }
    } catch (error) {
        console.error('Error updating usage tracker:', error);
    }
}

// Llamar a updateUsageTracker cuando se carga el popup
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    setupEventListeners();
    updateUI();
    await updateUsageTracker(); // Agregar esta línea
});

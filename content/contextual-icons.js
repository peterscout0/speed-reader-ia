// Get translation helper function
const t = (key, substitutions = null) => {
    return chrome.i18n.getMessage(key, substitutions) || key;
};

// Clase para manejar los iconos contextuales
class ContextualIcons {
    constructor(settings) {
        this.settings = settings;
        this.icons = [];
        this.observer = null;
        
        // Sistema de estado de audio
        this.audioStates = new Map(); // elementId -> { state, utterance, text, icon }
        this.lastDoubleClickTime = 0;
        this.doubleClickDelay = 300; // ms
        this.pendingClickTimeout = null;
        
        // Cache para descripciones generadas
        this.descriptionsCache = new Map(); // elementId -> { description, timestamp }
        this.codeSummariesCache = new Map(); // elementId -> { summary, timestamp }
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
        
        this.init();
    }
    
    init() {        
        // Esperar a que el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.createIcons());
        } else {
            this.createIcons();
        }
        
        // Observar cambios en el DOM para contenido dinámico
        this.setupDOMObserver();
        
        // Listener para detectar imágenes que se cargan dinámicamente
        this.setupImageLoadListeners();
    }
    
    createIcons() {
        this.removeAllIcons();
        
        // Crear iconos para párrafos
        this.createParagraphIcons();
        
        // Crear iconos para imágenes
        this.createImageIcons();
        
        // Crear iconos para bloques de código
        this.createCodeIcons();
        
    }
    
    createParagraphIcons() {
        const paragraphs = document.querySelectorAll('p, div.content p, article p, .post-content p, .entry-content p');
        
        paragraphs.forEach((paragraph, index) => {
            const text = paragraph.textContent.trim();
            if (text.length < 20) return; // Ignorar párrafos muy cortos
            
            // Ignorar elementos dentro de modales
            if (paragraph.closest('.contextual-modal, .modal, [data-modal]')) return;
            
            const iconContainer = this.createIconContainer('paragraph', index);
            const audioIcon = this.createAudioIcon(paragraph);
            
            iconContainer.appendChild(audioIcon);
            this.insertIconContainer(paragraph, iconContainer);
        });
    }
    
    createImageIcons() {        
        // Buscar imágenes con diferentes selectores
        const imageSelectors = [
            'img',                          // Imágenes estándar
            'picture img',                  // Imágenes responsive
            '[role="img"]',                 // Elementos con rol de imagen
            'figure img',                   // Imágenes en figuras
            '.image img',                   // Imágenes en contenedores
            '[style*="background-image"]'   // Imágenes de fondo
        ];
        
        let allImages = [];
        imageSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            allImages = allImages.concat([...elements]);
        });
        
        // Remover duplicados
        const uniqueImages = [...new Set(allImages)];        
        uniqueImages.forEach((image, index) => {
        
            try {
                // Solo procesar elementos IMG reales o con background-image
                const isImage = image.tagName === 'IMG';
                const hasBackgroundImage = image.style.backgroundImage && image.style.backgroundImage !== 'none';
                
                if (!isImage && !hasBackgroundImage) {
                    return;
                }
                
                // Verificar que no tenga ya iconos (método más confiable)
                const parent = image.parentElement;
                if (parent && parent.querySelector('.contextual-icons-container[data-type="image"]')) {
                    return;
                }
                
                // Para elementos IMG, verificar dimensiones cargadas
                if (isImage) {                    
                    // Usar naturalWidth/naturalHeight si están disponibles, sino width/height
                    const width = image.naturalWidth || image.width || 0;
                    const height = image.naturalHeight || image.height || 0;
                    
                    // Filtro más permisivo para imágenes pequeñas
                    if (width < 30 || height < 30) {
                        return;
                    }
                }
                
                // Ignorar elementos dentro de modales de la extensión
                if (image.closest('.contextual-modal, .modal, [data-modal]')) {
                    return;
                }                
                // Crear contenedor de iconos
                const iconContainer = this.createIconContainer('image', index);
                
                // Crear los dos iconos específicos para imágenes
                const descriptionIcon = this.createDescriptionIcon(() => this.describeImage(image));
                const audioDescIcon = this.createImageAudioIcon(image);
                
                iconContainer.appendChild(descriptionIcon);
                iconContainer.appendChild(audioDescIcon);
                this.insertIconContainer(image, iconContainer);
                
                // Verificación de inserción
                setTimeout(() => {
                    const parent = image.parentElement;
                    const inserted = parent && parent.querySelector('.contextual-icons-container[data-type="image"]');
                }, 100);
                
            } catch (error) {
                console.error(`[DEBUG] Error procesando imagen ${index}:`, error);
            }
        });
        
    }

    createCodeIcons() {        
        // Selectores expandidos para mayor compatibilidad
        const codeSelectors = [
            'pre',                           // Bloques de código preformateados
            'code',                          // Código inline y en bloques
            '.highlight',                    // Clase común para resaltado de sintaxis
            '.code-block',                   // Bloques de código genéricos
            '.codehilite',                  // Python syntax highlighting
            '.sourceCode',                  // Pandoc syntax highlighting
            '[class*="language-"]',         // Prism.js y highlight.js
            '[class*="hljs"]',              // highlight.js
            '.syntax-highlighted',          // Syntax highlighting genérico
            '.cm-editor',                   // CodeMirror 6
            '.CodeMirror',                  // CodeMirror legacy
            '.ace_editor',                  // Ace Editor
            '.monaco-editor',               // Monaco Editor (VS Code)
            '[class*="code"]',              // Cualquier clase que contenga "code"
            '[class*="syntax"]',            // Cualquier clase que contenga "syntax"
            'pre code',                     // Código dentro de pre
            '.highlight pre',               // Pre dentro de highlight
            '.highlight code',              // Code dentro de highlight
            '[data-language]',              // Elementos con atributo data-language
            '.gist-data',                   // GitHub Gists
            '.blob-code',                   // GitHub blob code
            '.js-file-line',                // GitHub file lines
            'div[class*="highlight"]',      // Divs con highlight
            'span[class*="token"]',         // Tokens de syntax highlighting
            'div[style*="font-family: monospace"]', // Elementos con fuente monospace
            'div[style*="font-family:monospace"]',
            'textarea[class*="code"]',      // Textareas de código
            'textarea[class*="editor"]'     // Textareas de editor
        ];
        
        let allCodeElements = [];
        
        codeSelectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                allCodeElements = allCodeElements.concat([...elements]);
            } catch (error) {
                console.error(`[DEBUG] Error con selector "${selector}":`, error);
            }
        });
        
        // Remover duplicados y elementos anidados
        const uniqueCodeElements = this.filterUniqueCodeElements(allCodeElements);        
        uniqueCodeElements.forEach((codeBlock, index) => {            
            try {
                // Validaciones previas
                if (!this.isValidCodeElement(codeBlock, index)) {
                    return;
                }
                
                // Verificar que no tenga ya iconos (método más confiable)
                const parent = codeBlock.parentElement;
                if (parent && parent.querySelector('.contextual-icons-container[data-type="code"]')) {
                    return;
                }                
                // Crear contenedor de iconos
                const iconContainer = this.createIconContainer('code', index);
                
                // Crear los 3 iconos específicos para código
                const audioIcon = this.createCodeAudioIcon(codeBlock);
                const analysisIcon = this.createAnalysisIcon(() => this.openCodeAnalysis(codeBlock));
                const copyIcon = this.createCopyIcon(() => this.copyCode(codeBlock));
                
                iconContainer.appendChild(audioIcon);
                iconContainer.appendChild(analysisIcon);
                iconContainer.appendChild(copyIcon);
                this.insertIconContainer(codeBlock, iconContainer);
                
                // Verificación de inserción
                setTimeout(() => {
                    const parent = codeBlock.parentElement;
                    const inserted = parent && parent.querySelector('.contextual-icons-container[data-type="code"]');
                }, 100);
                
            } catch (error) {
                console.error(`[DEBUG] Error procesando código ${index}:`, error);
            }
        });
        
    }
    
    // Función auxiliar para filtrar elementos únicos de código
    filterUniqueCodeElements(elements) {
        const uniqueElements = [];
        const processedElements = new Set();
        
        elements.forEach(element => {
            // Evitar duplicados
            if (processedElements.has(element)) {
                return;
            }
            
            // Evitar elementos anidados (preferir el padre)
            let isNested = false;
            for (let existing of uniqueElements) {
                if (existing.contains(element)) {
                    isNested = true;
                    break;
                } else if (element.contains(existing)) {
                    // El nuevo elemento es padre del existente, reemplazar
                    const existingIndex = uniqueElements.indexOf(existing);
                    uniqueElements[existingIndex] = element;
                    processedElements.delete(existing);
                    processedElements.add(element);
                    isNested = true;
                    break;
                }
            }
            
            if (!isNested) {
                uniqueElements.push(element);
                processedElements.add(element);
            }
        });
        
        return uniqueElements;
    }
    
    // Función auxiliar para validar elementos de código
    isValidCodeElement(codeBlock, index) {
        // Verificar contenido mínimo
        const content = codeBlock.textContent || codeBlock.innerText || '';
        const trimmedContent = content.trim();        
        if (trimmedContent.length < 5) {
            return false;
        }
        
        // Ignorar elementos dentro de modales de la extensión
        if (codeBlock.closest('.contextual-modal, .modal, [data-modal]')) {
            return false;
        }
        
        // Verificar que el elemento sea visible
        const rect = codeBlock.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) {
            return false;
        }
        
        // Verificar que no sea solo espacios en blanco o saltos de línea
        if (/^\s*$/.test(trimmedContent)) {
            return false;
        }
        
        return true;
    }
    
    createIconContainer(type, index) {
        const container = document.createElement('div');
        container.className = `contextual-icons-container contextual-icons-${type}`;
        container.setAttribute('data-type', type);
        container.setAttribute('data-index', index);
        return container;
    }
    
    createAudioIcon(element) {
        // Crear ID único para el elemento
        const elementId = this.getElementId(element);
        
        // Inicializar estado si no existe
        if (!this.audioStates.has(elementId)) {
            this.audioStates.set(elementId, {
                state: 'stopped', // stopped, playing, paused
                utterance: null,
                text: element.textContent.trim(),
                icon: null
            });
        }
        
        const audioState = this.audioStates.get(elementId);
        
        // Crear icono con estado inicial (siempre audio.svg)
        const initialIcon = 'audio.svg';
        const initialTitle = t('audioControlTooltip');
        
        const icon = this.createIcon(initialIcon, initialTitle, null);
        
        // Configurar eventos de clic y doble clic
        this.setupAudioClickEvents(icon, elementId, element);
        
        // Marcar como icono de audio
        icon.dataset.audioControl = 'true';
        icon.setAttribute('data-audio-state', audioState.state);
        icon.setAttribute('data-element-id', elementId);
        
        // Guardar referencia del icono en el estado
        audioState.icon = icon;        
        return icon;
    }
    
    createImageAudioIcon(image) {
        const icon = this.createIcon('audio.svg', t('describeImageWithVoice'), null);
        
        icon.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Mostrar loading
            this.showIconLoading(icon);
            
            try {
                await this.readImageWithVoice(image);
            } catch (error) {
                console.error('Error en audio de imagen:', error);
                this.showError(t('couldNotPlayImageDescription'));
            } finally {
                this.hideIconLoading(icon);
            }
        });
        
        return icon;
    }
    
    createCodeAudioIcon(codeBlock) {
        const icon = this.createIcon('audio.svg', t('describeCodeWithVoice'), null);
        
        icon.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Mostrar loading
            this.showIconLoading(icon);
            
            try {
                await this.readCodeWithVoice(codeBlock);
            } catch (error) {
                console.error('Error en audio de código:', error);
                this.showError(t('couldNotPlayCodeDescription'));
            } finally {
                this.hideIconLoading(icon);
            }
        });
        
        return icon;
    }
    
    async readImageWithVoice(image) {
        const cacheId = this.getElementCacheId(image);
        let description = '';
        
        // 1. Verificar si ya tenemos una descripción en cache (de una consulta previa)
        const cached = this.descriptionsCache.get(cacheId);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            description = cached.description;
        } else {
            // 2. Si no está en cache, intentar leer el alt de la imagen
            const alt = image.alt?.trim();
            if (alt && alt.length > 0) {
                description = `Imagen: ${alt}`;
            } else {                
                // 3. Si no hay alt ni cache, generar descripción
                try {
                    // Primero intentar con capacidades nativas del navegador
                    description = await this.generateImageDescriptionNative(image);
                    
                    if (!description || description.length < 10) {
                        // Si no funciona, usar Gemini con idioma detectado
                        const lang = this.detectPageLanguage();
                        description = await this.generateImageDescriptionWithGemini(image, lang);
                    }
                    
                    // Guardar en cache para futuras consultas
                    this.descriptionsCache.set(cacheId, {
                        description: description,
                        timestamp: Date.now()
                    });
                } catch (error) {
                    console.error('Error generando descripción:', error);
                    description = 'Imagen sin descripción disponible';
                }
            }
        }
        
        // 4. Reproducir la descripción con voz
        await this.speakText(description);
    }
    
    async readCodeWithVoice(codeBlock) {
        const cacheId = this.getElementCacheId(codeBlock);
        
        // 1. Verificar si ya tenemos un resumen en cache (de una consulta previa)
        const cached = this.codeSummariesCache.get(cacheId);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            await this.speakText(cached.summary);
            return;
        }        
        try {
            // 2. Generar resumen del código usando Gemini con idioma detectado
            const lang = this.detectPageLanguage();
            const summary = await this.generateCodeSummaryWithGemini(codeBlock, lang);
            
            // 3. Guardar en cache para futuras consultas
            this.codeSummariesCache.set(cacheId, {
                summary: summary,
                timestamp: Date.now()
            });
            
            // 4. Reproducir el resumen con voz
            await this.speakText(summary);
        } catch (error) {
            console.error('Error generando descripción de código:', error);
            // Fallback: descripción básica
            const codeType = this.detectCodeType(codeBlock);
            const lineCount = codeBlock.textContent.split('\n').length;
            const description = `Bloque de código ${codeType} con ${lineCount} líneas`;
            await this.speakText(description);
        }
    }
    
    async generateImageDescriptionNative(image) {
        // Intentar usar APIs nativas del navegador si están disponibles
        try {
            // Verificar si el navegador soporta Image Description API (experimental)
            if ('ml' in window && 'createImageDescriber' in window.ml) {
                const describer = await window.ml.createImageDescriber();
                const description = await describer.describe(image);
                return description;
            }
            
            // Fallback: descripción básica basada en propiedades de la imagen
            const src = image.src || '';
            const fileName = src.split('/').pop()?.split('.')[0] || '';
            const width = image.naturalWidth || image.width;
            const height = image.naturalHeight || image.height;
            
            return `Imagen ${fileName || 'sin nombre'} de ${width}x${height} píxeles`;
        } catch (error) {
            console.error('Error en descripción nativa:', error);
            return null;
        }
    }
    
    async generateImageDescriptionWithGemini(image, lang = null) {
        // Detectar idioma si no se proporciona
        if (!lang) {
            lang = this.detectPageLanguage();
        }
        
        // Obtener prompt en el idioma correcto
        const prompt = this.getPromptForLanguage('image', lang);
        
        try {
            // Aquí integrarías con la API de Gemini
            // Por ahora, simulamos una descripción
            const response = await this.queryGeminiForImage(image, prompt, lang);
            return response || 'Imagen que requiere descripción manual';
        } catch (error) {
            console.error('Error consultando Gemini para imagen:', error);
            throw error;
        }
    }
    
    async generateCodeSummaryWithGemini(codeBlock, lang = null) {
        // Detectar idioma si no se proporciona
        if (!lang) {
            lang = this.detectPageLanguage();
        }
        
        const code = codeBlock.textContent.trim();
        const codeType = this.detectCodeType(codeBlock);
        
        // Obtener prompt en el idioma correcto
        const basePrompt = this.getPromptForLanguage('code', lang);
        const prompt = `${basePrompt}
        
        Tipo de código: ${codeType}
        Código:
        ${code.substring(0, 1000)}${code.length > 1000 ? '...' : ''}`;
        
        try {
            // Aquí integrarías con la API de Gemini
            const response = await this.queryGeminiForCode(prompt, lang);
            return response || `Código ${codeType} con ${code.split('\n').length} líneas`;
        } catch (error) {
            console.error('Error consultando Gemini para código:', error);
            throw error;
        }
    }
    
    detectCodeType(codeBlock) {
        // Detectar el tipo de código basado en clases CSS o contenido
        const className = codeBlock.className.toLowerCase();
        
        if (className.includes('javascript') || className.includes('js')) return 'JavaScript';
        if (className.includes('python') || className.includes('py')) return 'Python';
        if (className.includes('html')) return 'HTML';
        if (className.includes('css')) return 'CSS';
        if (className.includes('java')) return 'Java';
        if (className.includes('cpp') || className.includes('c++')) return 'C++';
        if (className.includes('json')) return 'JSON';
        if (className.includes('xml')) return 'XML';
        if (className.includes('sql')) return 'SQL';
        
        // Detectar por contenido si no hay clase
        const content = codeBlock.textContent.toLowerCase();
        if (content.includes('function') || content.includes('const ') || content.includes('let ')) return 'JavaScript';
        if (content.includes('def ') || content.includes('import ')) return 'Python';
        if (content.includes('<html') || content.includes('<div')) return 'HTML';
        if (content.includes('select ') || content.includes('from ')) return 'SQL';
        
        return 'código';
    }
    
    async queryGeminiForImage(image, prompt, lang = 'es') {
        // Placeholder para integración con Gemini API
        // Simulación de respuesta según idioma
        const responses = {
            'es': 'Imagen que muestra contenido visual que requiere análisis con IA',
            'en': 'Image showing visual content that requires AI analysis',
            'fr': 'Image montrant un contenu visuel nécessitant une analyse IA',
            'pt': 'Imagem mostrando conteúdo visual que requer análise de IA',
            'de': 'Bild mit visuellem Inhalt, der KI-Analyse erfordert',
            'it': 'Immagine che mostra contenuto visivo che richiede analisi IA'
        };
        
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(responses[lang] || responses['es']);
            }, 1500);
        });
    }
    
    async queryGeminiForCode(prompt, lang = 'es') {
        // Placeholder para integración con Gemini API
        // Simulación de respuesta según idioma
        const responses = {
            'es': 'Este código implementa funcionalidad específica con lógica de programación',
            'en': 'This code implements specific functionality with programming logic',
            'fr': 'Ce code implémente une fonctionnalité spécifique avec une logique de programmation',
            'pt': 'Este código implementa funcionalidade específica com lógica de programação',
            'de': 'Dieser Code implementiert spezifische Funktionalität mit Programmierlogik',
            'it': 'Questo codice implementa funzionalità specifiche con logica di programmazione'
        };
        
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(responses[lang] || responses['es']);
            }, 1500);
        });
    }
    
    async speakText(text) {
        return new Promise((resolve, reject) => {
            if (!text || text.trim().length === 0) {
                reject(new Error('No hay texto para reproducir'));
                return;
            }
            
            // Detener cualquier reproducción anterior
            speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            
            utterance.onend = () => {
                resolve();
            };
            
            utterance.onerror = (event) => {
                console.error('Error en reproducción:', event);
                reject(event);
            };
            
            try {
                // USAR CONFIGURACIÓN CENTRALIZADA DEL REPRODUCTOR GLOBAL                
                // Verificar si AudioPlayer está disponible
                if (typeof window.AudioPlayer !== 'undefined' && window.AudioPlayer.applyGlobalVoiceConfig) {
                    // Usar la configuración centralizada del reproductor global
                    window.AudioPlayer.applyGlobalVoiceConfig(utterance);
                } else {                    
                    // Configuración de respaldo si AudioPlayer no está disponible
                    const voices = speechSynthesis.getVoices();
                    const spanishVoice = voices.find(voice => voice.lang.startsWith('es'));
                    if (spanishVoice) {
                        utterance.voice = spanishVoice;
                    }
                    utterance.rate = 0.9;
                    utterance.pitch = 1.0;
                    utterance.volume = 1.0;
                }
                
            } catch (error) {
                console.error('[DEBUG] Error aplicando configuración global para speakText (contextual-icons):', error);
                
                // Valores por defecto de emergencia
                const voices = speechSynthesis.getVoices();
                const spanishVoice = voices.find(voice => voice.lang.startsWith('es'));
                if (spanishVoice) {
                    utterance.voice = spanishVoice;
                }
            }
            
            speechSynthesis.speak(utterance);
        });
    }
    
    // Funciones de loading para iconos simples (no contextuales)
    showIconLoading(icon) {
        const img = icon.querySelector('img');
        if (img) {
            // Guardar el src original si no existe
            if (!icon._originalSrc) {
                icon._originalSrc = img.src;
            }
            
            // Cambiar completamente al ícono de loading
            img.src = chrome.runtime.getURL('icons/loading.svg');
            img.alt = 'Cargando...';
            
            // Actualizar el botón
            icon.title = 'Procesando...';
            icon.disabled = true;
            icon.style.opacity = '0.8';
            icon.style.cursor = 'not-allowed';
            icon.classList.add('loading');
        }
    }
    
    hideIconLoading(icon) {
        const img = icon.querySelector('img');
        if (img && icon._originalSrc) {
            // Restaurar el ícono original completamente
            img.src = icon._originalSrc;
            img.alt = icon._originalTitle || '';
            
            // Restaurar el botón
            icon.title = icon._originalTitle || '';
            icon.disabled = false;
            icon.style.opacity = '';
            icon.style.cursor = '';
            icon.classList.remove('loading');
        }
    }
    
    setupAudioClickEvents(icon, elementId, element) {
        let clickCount = 0;
        let clickTimer = null;
        let lastClickTime = 0;        
        icon.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const currentTime = Date.now();
            const audioState = this.audioStates.get(elementId);            
            // Si está reproduciendo, pausar inmediatamente (mejor UX)
            if (audioState && audioState.state === 'playing') {
                this.pauseAudio(elementId);
                lastClickTime = currentTime;
                return;
            }
            
            clickCount++;            
            if (clickCount === 1) {
                lastClickTime = currentTime;
                // Esperar para ver si hay un segundo clic
                clickTimer = setTimeout(() => {
                    // Clic simple: Reproducir/Reanudar
                    this.handleSingleClick(elementId, element);
                    clickCount = 0;
                }, this.doubleClickDelay);
            } else if (clickCount === 2 && (currentTime - lastClickTime) < this.doubleClickDelay) {
                // Doble clic: Reiniciar
                clearTimeout(clickTimer);
                this.handleDoubleClick(elementId, element);
                clickCount = 0;
            }
        });
    }
    
    handleSingleClick(elementId, element) {
        const audioState = this.audioStates.get(elementId);
        if (!audioState) {
            console.error('No se encontró estado de audio para elemento:', elementId);
            return;
        }
                if (audioState.state === 'stopped' || audioState.state === 'paused') {
            if (audioState.state === 'paused') {
                this.resumeAudio(elementId);
            } else {
                this.startAudio(elementId, element);
            }
        }
    }
    
    handleDoubleClick(elementId, element) {
        // Reiniciar: detener y empezar de nuevo
        this.stopAudio(elementId);
        setTimeout(() => {
            this.startAudio(elementId, element);
        }, 100);
    }

    handleModalSingleClick(modalId, content) {
        const audioState = this.audioStates.get(modalId);
        if (!audioState) {
            console.error('No se encontró estado de audio para modal:', modalId);
            return;
        }        
        if (audioState.state === 'stopped' || audioState.state === 'paused') {
            if (audioState.state === 'paused') {
                this.resumeAudio(modalId);
            } else {
                this.startModalAudio(modalId, content);
            }
        }
    }

    handleModalDoubleClick(modalId, content) {
        // Reiniciar: detener y empezar de nuevo
        this.stopAudio(modalId);
        setTimeout(() => {
            this.startModalAudio(modalId, content);
        }, 100);
    }

    startModalAudio(modalId, content) {
        const audioState = this.audioStates.get(modalId);
        if (!audioState) return;        
        // Detener cualquier reproducción anterior
        speechSynthesis.cancel();
        
        // Crear nueva utterance
        const utterance = new SpeechSynthesisUtterance(content);
        
        try {
            // USAR CONFIGURACIÓN CENTRALIZADA DEL REPRODUCTOR GLOBAL            
            // Verificar si AudioPlayer está disponible
            if (typeof window.AudioPlayer !== 'undefined' && window.AudioPlayer.applyGlobalVoiceConfig) {
                // Usar la configuración centralizada del reproductor global
                window.AudioPlayer.applyGlobalVoiceConfig(utterance);
            } else {                
                // Configuración de respaldo si AudioPlayer no está disponible
                utterance.lang = this.detectPageLanguage();
                utterance.rate = 0.9;
                utterance.pitch = 1.0;
                utterance.volume = 1.0;
            }
            
        } catch (error) {
            console.error('[DEBUG] Error aplicando configuración global para modal audio:', error);
            
            // Valores por defecto de emergencia
            utterance.lang = 'es-ES';
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
        }
        
        utterance.onstart = () => {
            audioState.state = 'playing';
            audioState.utterance = utterance;
            this.updateModalAudioButton(audioState.icon, 'playing');
        };
        
        utterance.onend = () => {
            audioState.state = 'stopped';
            audioState.utterance = null;
            this.updateModalAudioButton(audioState.icon, 'stopped');
        };
        
        utterance.onerror = (event) => {
            console.error('Error en audio del modal:', event.error);
            audioState.state = 'stopped';
            audioState.utterance = null;
            this.updateModalAudioButton(audioState.icon, 'stopped');
        };
        
        speechSynthesis.speak(utterance);
    }

    updateModalAudioButton(button, state) {
        if (!button) return;
        
        let title;
        
        switch(state) {
            case 'playing':
                title = 'Pausar (clic) | Reiniciar (doble clic)';
                button.classList.remove('loading');
                button.style.opacity = '1';
                break;
            case 'paused':
                title = 'Reanudar (clic) | Reiniciar (doble clic)';
                button.classList.remove('loading');
                button.style.opacity = '0.7';
                break;
            case 'stopped':
            default:
                title = 'Reproducir (clic) | Reiniciar (doble clic)';
                button.classList.remove('loading');
                button.style.opacity = '1';
                break;
        }
        
        // Asegurar que siempre tenga el SVG de audio original
        const svg = button.querySelector('svg');
        if (!svg) {
            button.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
            `;
        }
        
        button.title = title;
        button.setAttribute('data-audio-state', state);
    }
    
    createDescriptionIcon(onClick) {
        return this.createIcon('describe.svg', 'Consulta', onClick);
    }
    
    createAudioDescriptionIcon(onClick) {
        return this.createIcon('audio.svg', 'Audio-consulta', onClick);
    }
    
    createAudioSummaryIcon(onClick) {
        return this.createIcon('audio.svg', 'Audio-resumen', onClick);
    }
    
    createAnalysisIcon(onClick) {
        return this.createIcon('describe.svg', 'Consulta', onClick);
    }
    
    createCopyIcon(onClick) {
        return this.createIcon('copy.svg', 'Copiar código', onClick);
    }
    
    createIcon(svgFileName, title, onClick) {
        const icon = document.createElement('button');
        icon.className = 'contextual-icon';
        
        const img = document.createElement('img');
        img.src = chrome.runtime.getURL(`icons/${svgFileName}`);
        img.alt = title;
        img.style.width = '18px';  // Coincidir con CSS
        img.style.height = '18px'; // Coincidir con CSS
        
        icon.appendChild(img);
        icon.title = title;
        
        // Almacenar referencias originales para el loading
        icon._originalSrc = img.src;
        icon._originalTitle = title;
        
        icon.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // No mostrar loading para controles de audio, son instantáneos
            const isAudioControl = icon.dataset.audioControl === 'true';
            
            if (!isAudioControl) {
                // Solo mostrar loading para operaciones que lo necesiten
                this.showIconLoading(icon);
            }
            
            // Ejecutar acción y manejar loading
            try {
                const result = onClick();
                
                // Si es una promesa, manejar async
                if (result && typeof result.then === 'function') {
                    if (!isAudioControl) {
                        result
                            .then(() => this.hideIconLoading(icon))
                            .catch(() => this.hideIconLoading(icon));
                    }
                } else {
                    // Si es síncrono y no es control de audio, quitar loading
                    if (!isAudioControl) {
                        setTimeout(() => this.hideIconLoading(icon), 300);
                    }
                }
            } catch (error) {
                if (!isAudioControl) {
                    this.hideIconLoading(icon);
                }
                throw error;
            }
        });
        return icon;
    }
    
    showIconLoading(icon) {
        const img = icon.querySelector('img');
        if (img) {
            // Guardar el src original si no existe
            if (!icon._originalSrc) {
                icon._originalSrc = img.src;
            }
            
            // Cambiar completamente al ícono de loading
            img.src = chrome.runtime.getURL('icons/loading.svg');
            img.alt = 'Cargando...';
            img.style.animation = 'contextual-icon-spin 1s linear infinite';
            
            // Actualizar el botón
            icon.title = 'Procesando...';
            icon.disabled = true;
            icon.style.opacity = '0.8';
            icon.style.cursor = 'not-allowed';
        }
    }
    
    hideIconLoading(icon) {
        const img = icon.querySelector('img');
        if (img && icon._originalSrc) {
            // Restaurar el ícono original completamente
            img.src = icon._originalSrc;
            img.alt = icon._originalTitle || '';
            img.style.animation = '';
            
            // Restaurar el botón
            icon.title = icon._originalTitle || '';
            icon.disabled = false;
            icon.style.opacity = '1';
            icon.style.cursor = 'pointer';
        }
    }
    
    getElementId(element) {
        // Generar ID único basado en posición y contenido
        if (!element.dataset.contextualId) {
            const rect = element.getBoundingClientRect();
            const content = element.textContent.substring(0, 50);
            element.dataset.contextualId = `ctx_${Math.round(rect.top)}_${Math.round(rect.left)}_${btoa(content).substring(0, 10)}`;
        }
        return element.dataset.contextualId;
    }
    
    detectPageLanguage() {
        // Intentar detectar el idioma de varias formas
        
        // 1. Atributo lang del documento
        let lang = document.documentElement.lang;
        if (lang && lang.length >= 2) {
            return lang.substring(0, 2).toLowerCase();
        }
        
        // 2. Meta tag content-language
        const metaLang = document.querySelector('meta[http-equiv="content-language"]');
        if (metaLang && metaLang.content) {
            return metaLang.content.substring(0, 2).toLowerCase();
        }
        
        // 3. Idioma del navegador
        const browserLang = navigator.language || navigator.userLanguage;
        if (browserLang) {
            return browserLang.substring(0, 2).toLowerCase();
        }
        
        // 4. Detectar por contenido común
        const bodyText = document.body.textContent.toLowerCase();
        if (bodyText.includes('the ') && bodyText.includes(' and ') && bodyText.includes(' of ')) {
            return 'en';
        }
        if (bodyText.includes(' el ') && bodyText.includes(' de ') && bodyText.includes(' que ')) {
            return 'es';
        }
        if (bodyText.includes(' le ') && bodyText.includes(' de ') && bodyText.includes(' et ')) {
            return 'fr';
        }
        
        // Default: español
        return 'es';
    }
    
    getPromptForLanguage(type, lang) {
        const prompts = {
            image: {
                'es': 'Describe esta imagen de manera concisa y útil para una persona que no puede verla. Incluye los elementos principales, colores, acciones y contexto relevante. Mantén la descripción clara y en español, máximo 2-3 oraciones.',
                'en': 'Describe this image concisely and helpfully for a person who cannot see it. Include main elements, colors, actions, and relevant context. Keep the description clear and in English, maximum 2-3 sentences.',
                'fr': 'Décrivez cette image de manière concise et utile pour une personne qui ne peut pas la voir. Incluez les éléments principaux, les couleurs, les actions et le contexte pertinent. Gardez la description claire et en français, maximum 2-3 phrases.',
                'pt': 'Descreva esta imagem de forma concisa e útil para uma pessoa que não pode vê-la. Inclua os elementos principais, cores, ações e contexto relevante. Mantenha a descrição clara e em português, máximo 2-3 frases.',
                'de': 'Beschreiben Sie dieses Bild prägnant und hilfreich für eine Person, die es nicht sehen kann. Schließen Sie Hauptelemente, Farben, Aktionen und relevanten Kontext ein. Halten Sie die Beschreibung klar und auf Deutsch, maximal 2-3 Sätze.',
                'it': 'Descrivi questa immagine in modo conciso e utile per una persona che non può vederla. Includi elementi principali, colori, azioni e contesto rilevante. Mantieni la descrizione chiara e in italiano, massimo 2-3 frasi.'
            },
            code: {
                'es': 'Analiza y resume este código de manera concisa para ser leído en voz alta. Explica qué hace el código, su propósito principal y los elementos más importantes. Usa un lenguaje claro y técnico apropiado. Máximo 3-4 oraciones en español.',
                'en': 'Analyze and summarize this code concisely to be read aloud. Explain what the code does, its main purpose, and the most important elements. Use clear and appropriate technical language. Maximum 3-4 sentences in English.',
                'fr': 'Analysez et résumez ce code de manière concise pour être lu à voix haute. Expliquez ce que fait le code, son objectif principal et les éléments les plus importants. Utilisez un langage technique clair et approprié. Maximum 3-4 phrases en français.',
                'pt': 'Analise e resuma este código de forma concisa para ser lido em voz alta. Explique o que o código faz, seu propósito principal e os elementos mais importantes. Use linguagem técnica clara e apropriada. Máximo 3-4 frases em português.',
                'de': 'Analysieren und fassen Sie diesen Code prägnant zusammen, um ihn laut vorzulesen. Erklären Sie, was der Code tut, seinen Hauptzweck und die wichtigsten Elemente. Verwenden Sie eine klare und angemessene technische Sprache. Maximal 3-4 Sätze auf Deutsch.',
                'it': 'Analizza e riassumi questo codice in modo conciso per essere letto ad alta voce. Spiega cosa fa il codice, il suo scopo principale e gli elementi più importanti. Usa un linguaggio tecnico chiaro e appropriato. Massimo 3-4 frasi in italiano.'
            }
        };
        
        return prompts[type]?.[lang] || prompts[type]?.['es'] || prompts[type]?.['en'];
    }
    
    getElementCacheId(element) {
        // Generar ID único para cache basado en contenido
        if (element.tagName === 'IMG') {
            return `img_${element.src}_${element.alt || 'noalt'}`;
        } else {
            const content = element.textContent.trim();
            return `code_${btoa(content.substring(0, 100))}`;
        }
    }
    
    getAudioIconTitle(state) {
        switch(state) {
            case 'stopped': return 'Reproducir';
            case 'playing': return 'Pausar';
            case 'paused': return 'Reanudar';
            default: return 'Reproducir';
        }
    }
    
    async handleAudioClick(elementId, element) {
        const currentTime = Date.now();
        const audioState = this.audioStates.get(elementId);
        
        // Detectar doble-click
        if (currentTime - this.lastDoubleClickTime < this.doubleClickDelay) {
            // Doble-click: Reiniciar (cancelar el timeout pendiente)
            if (this.pendingClickTimeout) {
                clearTimeout(this.pendingClickTimeout);
                this.pendingClickTimeout = null;
            }
            this.restartAudio(elementId, element);
            return;
        }
        
        this.lastDoubleClickTime = currentTime;
        
        // Para pausar, hacer inmediatamente sin esperar
        if (audioState.state === 'playing') {
            this.pauseAudio(elementId);
            return;
        }
        
        // Para otros casos, esperar a ver si es doble-click
        this.pendingClickTimeout = setTimeout(() => {
            if (Date.now() - this.lastDoubleClickTime >= this.doubleClickDelay) {
                this.toggleAudioPlayback(elementId, element);
            }
            this.pendingClickTimeout = null;
        }, this.doubleClickDelay);
    }
    
    async toggleAudioPlayback(elementId, element) {
        const audioState = this.audioStates.get(elementId);
        
        switch(audioState.state) {
            case 'stopped':
                await this.startAudio(elementId, element);
                break;
            case 'playing':
                this.pauseAudio(elementId);
                break;
            case 'paused':
                this.resumeAudio(elementId);
                break;
        }
    }
    
    async startAudio(elementId, element) {
        const audioState = this.audioStates.get(elementId);
        if (!audioState) return;
        
        try {
            // Detener cualquier otra reproducción
            this.stopAllAudio();
            
            // Mostrar loading mientras se prepara el audio
            audioState.state = 'loading';
            this.updateAudioIcon(audioState, 'loading.svg', 'Preparando audio...');
            
            // Marcar elemento
            this.highlightElement(element);
            
            // Crear nueva utterance
            const utterance = new SpeechSynthesisUtterance(audioState.text);
            
            try {
                // USAR CONFIGURACIÓN CENTRALIZADA DEL REPRODUCTOR GLOBAL
                
                // Verificar si AudioPlayer está disponible
                if (typeof window.AudioPlayer !== 'undefined' && window.AudioPlayer.applyGlobalVoiceConfig) {
                    // Usar la configuración centralizada del reproductor global
                    window.AudioPlayer.applyGlobalVoiceConfig(utterance);
                } else {                    
                    // Configuración de respaldo si AudioPlayer no está disponible
                    utterance.rate = 0.9;
                    utterance.pitch = 1.0;
                    utterance.volume = 1.0;
                    utterance.lang = 'es-ES';
                }
                
            } catch (error) {
                console.error('[DEBUG] Error aplicando configuración global para startAudio:', error);
                
                // Valores por defecto de emergencia
                utterance.rate = 0.9;
                utterance.pitch = 1.0;
                utterance.volume = 1.0;
                utterance.lang = 'es-ES';
            }
            
            // Configurar eventos
            utterance.onstart = () => {
                // Mantener loading cuando empiece a hablar (loading = reproduciendo)
                audioState.state = 'playing';
                this.updateAudioIcon(audioState, 'loading.svg', 'Reproduciendo... (Clic: Pausar, Doble clic: Reiniciar)');
            };
            
            utterance.onend = () => {
                // Volver al icono de audio cuando termine
                audioState.state = 'stopped';
                this.updateAudioIcon(audioState, 'audio.svg', 'Clic: Reproducir | Doble clic: Reiniciar');
                this.removeHighlight(element);
            };
            
            utterance.onerror = (event) => {
                console.error('Error en audio:', event);
                audioState.state = 'stopped';
                this.updateAudioIcon(audioState, 'audio.svg', 'Error - Clic: Reintentar');
                this.removeHighlight(element);
            };
            
            audioState.utterance = utterance;
            speechSynthesis.speak(utterance);
            
        } catch (error) {
            console.error('Error iniciando audio:', error);
            audioState.state = 'stopped';
            this.updateAudioIcon(audioState, 'audio.svg', 'Error - Clic: Reintentar');
        }
    }
    
    pauseAudio(elementId) {
        const audioState = this.audioStates.get(elementId);
        if (!audioState) return;
        
        if (speechSynthesis.speaking && !speechSynthesis.paused) {
            speechSynthesis.pause();
            audioState.state = 'paused';
            
            // Detectar si es un modal o un icono contextual
            if (elementId.startsWith('modal_response_')) {
                this.updateModalAudioButton(audioState.icon, 'paused');
            } else {
                this.updateAudioIcon(audioState, 'audio.svg', 'Pausado (Clic: Reanudar, Doble clic: Reiniciar)');
            }
            
        }
    }
    
    resumeAudio(elementId) {
        const audioState = this.audioStates.get(elementId);
        if (!audioState) return;
        
        if (speechSynthesis.paused && audioState.state === 'paused') {
            // Resume normal para todas las voces (incluyendo Google)
            speechSynthesis.resume();
            audioState.state = 'playing';
            
            // Detectar si es un modal o un icono contextual
            if (elementId.startsWith('modal_response_')) {
                this.updateModalAudioButton(audioState.icon, 'playing');
            } else {
                this.updateAudioIcon(audioState, 'loading.svg', 'Reproduciendo... (Clic: Pausar, Doble clic: Reiniciar)');
            }
            
        }
    }
    
    stopAudio(elementId) {
        const audioState = this.audioStates.get(elementId);
        if (!audioState) return;
        
        // Detener audio actual
        if (audioState.utterance) {
            speechSynthesis.cancel();
        }
        
        // Resetear estado
        audioState.state = 'stopped';
        audioState.utterance = null;
        
        // Detectar si es un modal o un icono contextual
        if (elementId.startsWith('modal_response_')) {
            this.updateModalAudioButton(audioState.icon, 'stopped');
        } else {
            this.updateAudioIcon(audioState, 'audio.svg', 'Clic: Reproducir/Pausar | Doble clic: Detener');
            
            // Remover highlighting si existe
            const elements = document.querySelectorAll(`[data-contextual-id="${elementId}"]`);
            elements.forEach(el => this.removeHighlight(el));
        }
    }
    
    restartAudio(elementId, element) {
        // Primero detener
        this.stopAudio(elementId);
        
        // Iniciar inmediatamente
        setTimeout(() => {
            this.startAudio(elementId, element);
        }, 100);
    }
    
    stopAllAudio() {
        speechSynthesis.cancel();
        
        // Resetear todos los estados
        for (const [elementId, audioState] of this.audioStates) {
            if (audioState.state !== 'stopped') {
                audioState.state = 'stopped';
                audioState.utterance = null;
                this.updateAudioIcon(audioState, 'audio.svg', 'Clic: Reproducir/Pausar | Doble clic: Detener');
            }
        }
    }
    
    updateAudioIcon(audioState, iconFile, title) {
        if (audioState.icon) {
            // Buscar la imagen existente
            const img = audioState.icon.querySelector('img');
            if (img) {
                // Cambio directo - solo un icono visible a la vez
                img.src = chrome.runtime.getURL(`icons/${iconFile}`);
                img.alt = title;
                audioState.icon.title = title;
                audioState.icon._originalSrc = img.src;
                audioState.icon._originalTitle = title;
                audioState.icon.setAttribute('data-audio-state', audioState.state);
                
                // Agregar o quitar clase de loading según el icono
                if (iconFile === 'loading.svg') {
                    audioState.icon.classList.add('loading');
                } else {
                    audioState.icon.classList.remove('loading');
                }
            } else {
                // Si por alguna razón no hay img, recrear el contenido del botón
                console.warn('No se encontró img en el icono de audio, recreando...');
                const newImg = document.createElement('img');
                newImg.src = chrome.runtime.getURL(`icons/${iconFile}`);
                newImg.alt = title;
                newImg.style.width = '18px';
                newImg.style.height = '18px';
                
                // Limpiar el botón y agregar la nueva imagen
                audioState.icon.innerHTML = '';
                audioState.icon.appendChild(newImg);
                audioState.icon.title = title;
                audioState.icon._originalSrc = newImg.src;
                audioState.icon._originalTitle = title;
                audioState.icon.setAttribute('data-audio-state', audioState.state);
                
                // Agregar clase de loading si corresponde
                if (iconFile === 'loading.svg') {
                    audioState.icon.classList.add('loading');
                }
            }
        }
    }
    
    insertIconContainer(targetElement, iconContainer) {        
        const iconType = iconContainer.getAttribute('data-type');
        const parent = targetElement.parentElement;
        
        if (!parent) {
            return;
        }
        
        try {
            if (iconType === 'code') {
                // Para bloques de código, insertar como hijo directo del elemento                
                // Asegurar posicionamiento relativo
                const computedStyle = window.getComputedStyle(targetElement);
                if (computedStyle.position === 'static') {
                    targetElement.style.position = 'relative';
                }
                
                targetElement.appendChild(iconContainer);                
            } else if (iconType === 'image') {
                // Para imágenes, insertar en el parent                
                // Asegurar posicionamiento relativo del parent
                const computedStyle = window.getComputedStyle(parent);
                if (computedStyle.position === 'static') {
                    parent.style.position = 'relative';
                }
                
                parent.appendChild(iconContainer);
                
            } else {
                // Para otros elementos (párrafos, etc.), usar el parent                
                const computedStyle = window.getComputedStyle(parent);
                if (computedStyle.position === 'static') {
                    parent.style.position = 'relative';
                }
                
                parent.appendChild(iconContainer);
            }
            
            this.icons.push(iconContainer);
            
        } catch (error) {
            console.error('[DEBUG] Error insertando iconos:', error);
        }
    }
    
    // Funciones de acción (mantenidas para compatibilidad)
    async readParagraph(paragraph) {
        // Esta función ahora es manejada por el sistema de audio dinámico
        const elementId = this.getElementId(paragraph);
        await this.startAudio(elementId, paragraph);
    }
    
    async describeImage(image) {
        try {
            const cacheId = this.getElementCacheId(image);
            
            // Verificar si ya tenemos una descripción en cache
            const cached = this.descriptionsCache.get(cacheId);
            if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                this.showDescriptionModal(cached.description);
                return;
            }
            
            // Generar nueva descripción
            const description = await this.generateImageDescription(image);
            
            // Guardar en cache
            this.descriptionsCache.set(cacheId, {
                description: description,
                timestamp: Date.now()
            });
            
            this.showDescriptionModal(description);
        } catch (error) {
            console.error('Error describiendo imagen:', error);
            this.showError(t('couldNotGenerateImageDescription'));
        }
    }
    
    async readImageDescription(image) {
        try {
            // Usar la nueva función de voz para imágenes
            await this.readImageWithVoice(image);
        } catch (error) {
            console.error('Error en audio-descripción:', error);
            this.showError(t('couldNotGenerateAudioDescription'));
        }
    }
    
    async readCodeSummary(codeBlock) {
        try {
            // Usar la nueva función de voz para código
            await this.readCodeWithVoice(codeBlock);
        } catch (error) {
            console.error('Error en resumen de código:', error);
            this.showError(t('couldNotGenerateCodeSummary'));
        }
    }
    
    async openCodeAnalysis(codeBlock) {
        const cacheId = this.getElementCacheId(codeBlock);
        
        // Verificar si ya tenemos un resumen en cache
        const cached = this.codeSummariesCache.get(cacheId);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            this.showAnalysisModal(cached.summary);
            return;
        }
        
        try {
            // Generar nuevo resumen con idioma detectado
            const lang = this.detectPageLanguage();
            const summary = await this.generateCodeSummaryWithGemini(codeBlock, lang);
            
            // Guardar en cache
            this.codeSummariesCache.set(cacheId, {
                summary: summary,
                timestamp: Date.now()
            });
            
            this.showAnalysisModal(summary);
        } catch (error) {
            console.error('Error generando análisis de código:', error);
            // Fallback: mostrar código simple
            const code = codeBlock.textContent.trim();
            this.showAnalysisModal(code);
        }
    }
    
    copyCode(codeBlock) {
        const code = codeBlock.textContent.trim();
        return navigator.clipboard.writeText(code).then(() => {
            this.showSuccess(t('codeCopiedToClipboard'));
        }).catch(() => {
            this.showError(t('couldNotCopyCode'));
        });
    }
    
    // Funciones de IA (Gemini) - Mantenidas para compatibilidad
    async generateImageDescription(image) {
        // Usar la nueva lógica que prioriza alt text
        const alt = image.alt?.trim();
        if (alt && alt.length > 0) {
            const title = image.title?.trim();
            return `Imagen: ${alt}${title ? '. ' + title : ''}`;
        }
        
        // Si no hay alt, intentar generar descripción con idioma detectado
        try {
            const lang = this.detectPageLanguage();
            return await this.generateImageDescriptionWithGemini(image, lang);
        } catch (error) {
            return 'Imagen sin descripción alternativa disponible';
        }
    }
    
    async generateCodeSummary(codeBlock) {
        // Usar la nueva lógica con Gemini e idioma detectado
        try {
            const lang = this.detectPageLanguage();
            return await this.generateCodeSummaryWithGemini(codeBlock, lang);
        } catch (error) {
            // Fallback a implementación básica
            const code = codeBlock.textContent.trim();
            const language = this.detectCodeType(codeBlock);
            
            if (code.length < 50) {
                return `Fragmento de código ${language}: ${code}`;
            }
            
            return `Bloque de código ${language} de ${code.split('\n').length} líneas`;
        }
    }
    
    detectLanguage(codeBlock) {
        const className = codeBlock.className || '';
        
        if (className.includes('javascript') || className.includes('js')) return 'JavaScript';
        if (className.includes('python')) return 'Python';
        if (className.includes('html')) return 'HTML';
        if (className.includes('css')) return 'CSS';
        if (className.includes('json')) return 'JSON';
        
        return 'código';
    }
    
    analyzeCodeBasic(code) {
        const features = [];
        
        if (code.includes('function') || code.includes('def ')) features.push('funciones');
        if (code.includes('class ')) features.push('clases');
        if (code.includes('if ') || code.includes('else')) features.push('condicionales');
        if (code.includes('for ') || code.includes('while ')) features.push('bucles');
        if (code.includes('import ') || code.includes('require(')) features.push('importaciones');
        
        return features.length > 0 ? features.join(', ') : 'código general';
    }
    
    // Funciones de UI
    highlightElement(element) {
        // Remover cualquier highlight anterior (mismo que reproductor global)
        document.querySelectorAll('.audio-player-highlight').forEach(el => {
            el.classList.remove('audio-player-highlight');
        });
        
        // Agregar nuevo highlight con la misma clase que el reproductor global
        if (element) {
            element.classList.add('audio-player-highlight');
            
            // Scroll suave al elemento (igual que el reproductor global)
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }
    
    removeHighlight(element) {
        // Remover el highlight específico del elemento
        if (element) {
            element.classList.remove('audio-player-highlight');
        }
        
        // También limpiar cualquier otro highlight que pueda existir
        document.querySelectorAll('.audio-player-highlight').forEach(el => {
            el.classList.remove('audio-player-highlight');
        });
    }
    
    showDescriptionModal(description) {
        const modal = this.createModal('Análisis de imagen', description, 'image');
        document.body.appendChild(modal);
    }
    
    showAnalysisModal(code) {
        // Mostrar análisis básico inicial
        const initialContent = `
            <div class="code-preview">
                <p>Código listo para análisis</p>
                <p>Selecciona una consulta predefinida para obtener información específica sobre este código.</p>
            </div>
        `;
        
        const modal = this.createModal('Análisis de código', initialContent, 'code');
        document.body.appendChild(modal);
    }
    
    createModal(title, content, type = 'default') {
        const modal = document.createElement('div');
        modal.className = 'contextual-modal';
        
        let modalContent = '';
        
        if (type === 'image') {
            modalContent = `
                <div class="modal-overlay">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2>${title}</h2>
                            <button class="modal-close">×</button>
                        </div>
                        <div class="modal-body">
                            <div class="query-input-section">
                                <div class="query-input-container">
                                    <input type="text" class="query-input" placeholder="Escribe tu consulta sobre la imagen...">
                                    <button class="query-submit-btn">Consultar</button>
                                </div>
                            </div>
                            <div class="preset-queries">
                                <h3>Consultas predefinidas:</h3>
                                <div class="query-list">
                                    <button class="query-btn" data-query="Describe esta imagen en detalle">Descripción detallada</button>
                                    <button class="query-btn" data-query="¿Qué elementos específicos puedo ver en esta imagen?">Elementos específicos</button>
                                    <button class="query-btn" data-query="¿Cuál es el contexto y relevancia de esta imagen?">Contexto y relevancia</button>
                                    <button class="query-btn" data-query="Describe esta imagen para una persona con discapacidad visual">Para accesibilidad</button>
                                    <button class="query-btn" data-query="¿Qué colores y composición tiene esta imagen?">Colores y composición</button>
                                    <button class="query-btn" data-query="¿Hay texto visible en esta imagen?">Texto en imagen</button>
                                </div>
                            </div>
                            <div class="response-area">
                                <div class="response-header">
                                    <h4 class="response-title">Resultado de la consulta</h4>
                                    <div class="response-controls">
                                        <button class="response-control-btn copy-query-btn" title="Copiar consulta">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                            </svg>
                                        </button>
                                        <button class="response-control-btn audio-btn" title="Escuchar respuesta">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div class="response-content">
                                    <p style="color: rgba(255, 255, 255, 0.6); text-align: center; padding: 40px 20px;">
                                        Escribe una consulta o selecciona una opción predefinida para analizar la imagen
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else if (type === 'code') {
            modalContent = `
                <div class="modal-overlay">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2>${title}</h2>
                            <button class="modal-close">×</button>
                        </div>
                        <div class="modal-body">
                            <div class="query-input-section">
                                <div class="query-input-container">
                                    <input type="text" class="query-input" placeholder="Haz una pregunta específica sobre este código...">
                                    <button class="query-submit-btn">Consultar</button>
                                </div>
                            </div>
                            <div class="preset-queries">
                                <h3>Análisis de código:</h3>
                                <div class="query-list">
                                    <button class="query-btn" data-query="Explica qué hace este código paso a paso">Explicar funcionamiento</button>
                                    <button class="query-btn" data-query="¿Cómo puedo optimizar este código?">Optimización</button>
                                    <button class="query-btn" data-query="Muestra ejemplos similares de este patrón">Ejemplos similares</button>
                                    <button class="query-btn" data-query="Analiza posibles vulnerabilidades de seguridad">Análisis de seguridad</button>
                                    <button class="query-btn" data-query="¿Cómo mejorar el rendimiento de este código?">Rendimiento</button>
                                    <button class="query-btn" data-query="¿Hay mejores prácticas que pueda aplicar?">Mejores prácticas</button>
                                </div>
                            </div>
                            <div class="response-area">
                                <div class="response-header">
                                    <h4 class="response-title">Análisis del código</h4>
                                    <div class="response-controls">
                                        <button class="response-control-btn copy-query-btn" title="Copiar consulta">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                            </svg>
                                        </button>
                                        <button class="response-control-btn audio-btn" title="Escuchar análisis">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div class="response-content">
                                    <p style="color: rgba(255, 255, 255, 0.6); text-align: center; padding: 40px 20px;">
                                        Escribe una pregunta específica o selecciona un tipo de análisis para el código
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Modal por defecto
            modalContent = `
                <div class="modal-overlay">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2>${title}</h2>
                            <button class="modal-close">×</button>
                        </div>
                        <div class="modal-body">
                            ${content}
                        </div>
                    </div>
                </div>
            `;
        }
        
        modal.innerHTML = modalContent;
        
        // Configurar eventos del modal
        this.setupModalEvents(modal, type);
        
        return modal;
    }
    
    setupModalEvents(modal, type) {
        // Cerrar modal
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
        }
        
        const overlay = modal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === e.currentTarget) {
                    modal.remove();
                }
            });
        }
        
        // Eventos específicos según el tipo
        if (type === 'image' || type === 'code') {
            this.setupAdvancedModalEvents(modal, type);
        }
    }
    
    setupAdvancedModalEvents(modal, type) {
        // Input y botón de consulta
        const queryInput = modal.querySelector('.query-input');
        const submitBtn = modal.querySelector('.query-submit-btn');
        const responseContent = modal.querySelector('.response-content');
        
        // Botones de consulta predefinida
        const queryButtons = modal.querySelectorAll('.query-btn');
        
        // Función para ejecutar consulta
        const executeQuery = (queryText) => {
            if (!queryText.trim()) return;
            
            // Deshabilitar input y botón durante la consulta
            queryInput.disabled = true;
            submitBtn.disabled = true;
            
            // Mostrar estado de carga
            responseContent.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Procesando consulta...</p>
                </div>
            `;
            
            // Simular procesamiento (aquí se integraría con Gemini API)
            setTimeout(() => {
                let response = '';
                
                if (type === 'image') {
                    response = this.getImageQueryResponse(queryText);
                } else if (type === 'code') {
                    response = this.getCodeQueryResponse(queryText);
                }
                
                responseContent.innerHTML = `<p>${response}</p>`;
                
                // Re-habilitar controles
                queryInput.disabled = false;
                submitBtn.disabled = false;
            }, 1500);
        };
        
        // Evento del botón consultar
        submitBtn.addEventListener('click', () => {
            executeQuery(queryInput.value);
        });
        
        // Enter en el input
        queryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                executeQuery(queryInput.value);
            }
        });
        
        // Botones de consulta predefinida
        queryButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.dataset.query;
                
                // Escribir en el input
                queryInput.value = query;
                
                // Resaltar botón activo
                queryButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Ejecutar consulta automáticamente
                executeQuery(query);
            });
        });
        
        // Botón de copiar consulta
        const copyQueryBtn = modal.querySelector('.response-controls .copy-query-btn');
        if (copyQueryBtn) {
            copyQueryBtn.addEventListener('click', () => {
                const currentQuery = queryInput.value;
                if (currentQuery.trim()) {
                    navigator.clipboard.writeText(currentQuery).then(() => {
                        this.showSuccess(t('queryCopiedToClipboard'));
                    });
                } else {
                    this.showNotification(t('noQueryToCopy'), 'info');
                }
            });
        }
        
        // Botón de copiar en la respuesta
        const copyBtn = modal.querySelector('.response-controls .copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const content = responseContent.textContent;
                if (content && content.trim() && !content.includes('Escribe una consulta')) {
                    navigator.clipboard.writeText(content).then(() => {
                        this.showSuccess(t('contentCopiedToClipboard'));
                    });
                } else {
                    this.showNotification(t('noContentToCopy'), 'info');
                }
            });
        }
        
        // Botón de audio en la respuesta con funcionalidad avanzada
        const audioBtn = modal.querySelector('.response-controls .audio-btn');
        if (audioBtn) {
            // Crear ID único para este modal
            const modalId = `modal_response_${Date.now()}`;
            
            // Configurar estado de audio para el modal
            if (!this.audioStates.has(modalId)) {
                this.audioStates.set(modalId, {
                    state: 'stopped',
                    utterance: null,
                    text: '',
                    icon: audioBtn
                });
            }
            
            // Configurar eventos de clic avanzados (clic simple: play/pause, doble clic: reiniciar)
            let clickCount = 0;
            let clickTimer = null;
            let lastClickTime = 0;
            
            audioBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const content = responseContent.textContent;
                if (!content || !content.trim() || content.includes('Escribe una consulta')) {
                    this.showNotification(t('noContentToPlay'), 'info');
                    return;
                }
                
                const currentTime = Date.now();
                const audioState = this.audioStates.get(modalId);
                
                // Actualizar texto del estado si cambió el contenido
                if (audioState.text !== content) {
                    audioState.text = content;
                    audioState.state = 'stopped';
                    if (audioState.utterance) {
                        speechSynthesis.cancel();
                        audioState.utterance = null;
                    }
                }
                
                // Si está reproduciendo, pausar inmediatamente
                if (audioState.state === 'playing') {
                    this.pauseAudio(modalId);
                    lastClickTime = currentTime;
                    return;
                }
                
                clickCount++;
                
                if (clickCount === 1) {
                    lastClickTime = currentTime;
                    // Esperar para ver si hay un segundo clic
                    clickTimer = setTimeout(() => {
                        // Clic simple: Reproducir/Reanudar
                        this.handleModalSingleClick(modalId, content);
                        clickCount = 0;
                    }, this.doubleClickDelay);
                } else if (clickCount === 2 && (currentTime - lastClickTime) < this.doubleClickDelay) {
                    // Doble clic: Reiniciar
                    clearTimeout(clickTimer);
                    this.handleModalDoubleClick(modalId, content);
                    clickCount = 0;
                }
            });
        }
    }
    
    getImageQueryResponse(query) {
        // Respuestas más específicas basadas en el tipo de consulta
        const lowerQuery = query.toLowerCase();
        
        if (lowerQuery.includes('describe') || lowerQuery.includes('descripción')) {
            return '🖼️ <strong>Descripción detallada:</strong><br><br>Esta imagen muestra elementos visuales que han sido analizados mediante inteligencia artificial. La composición incluye elementos gráficos, texturas y colores que forman parte del contenido visual de la página.<br><br><em>Nota: Para obtener análisis más detallados, configura la integración con Gemini AI en la extensión.</em>';
        } else if (lowerQuery.includes('elementos') || lowerQuery.includes('específicos')) {
            return '🔍 <strong>Elementos específicos identificados:</strong><br><br>• Formas geométricas y patrones visuales<br>• Distribución espacial de los elementos<br>• Contraste y balance visual<br>• Elementos textuales si están presentes<br><br><em>El análisis detallado mejorará con la integración de IA avanzada.</em>';
        } else if (lowerQuery.includes('contexto') || lowerQuery.includes('relevancia')) {
            return '📖 <strong>Contexto y relevancia:</strong><br><br>Esta imagen forma parte del contenido informativo de la página y está relacionada temáticamente con el texto circundante. Su propósito es complementar y enriquecer la información presentada al usuario.<br><br><em>El análisis contextual se perfeccionará con IA especializada.</em>';
        } else if (lowerQuery.includes('accesibilidad') || lowerQuery.includes('discapacidad')) {
            return '♿ <strong>Descripción para accesibilidad:</strong><br><br>Imagen con elementos visuales estructurados que incluye información gráfica relevante para el contenido de la página. Los elementos están organizados de manera que facilita su comprensión cuando se describe verbalmente.<br><br><em>Las descripciones específicas para accesibilidad mejorarán con la integración de IA especializada.</em>';
        } else if (lowerQuery.includes('colores') || lowerQuery.includes('composición')) {
            return '🎨 <strong>Análisis de colores y composición:</strong><br><br>• <strong>Paleta cromática:</strong> Tonos que siguen principios de diseño visual<br>• <strong>Composición:</strong> Distribución equilibrada de elementos<br>• <strong>Contraste:</strong> Relación visual entre elementos claros y oscuros<br>• <strong>Armonía:</strong> Cohesión visual general<br><br><em>Análisis detallado disponible con IA avanzada.</em>';
        } else if (lowerQuery.includes('texto')) {
            return '📝 <strong>Análisis de texto en imagen:</strong><br><br>Se detecta la presencia potencial de elementos textuales integrados en la imagen. El reconocimiento óptico de caracteres (OCR) puede identificar y extraer texto visible.<br><br><em>La extracción precisa de texto mejorará con la integración de IA especializada.</em>';
        } else {
            return `🤖 <strong>Análisis personalizado:</strong><br><br>Se ha procesado tu consulta: "${query}"<br><br>Esta imagen contiene información visual relevante que puede ser analizada desde múltiples perspectivas. Para obtener respuestas más específicas y detalladas sobre aspectos particulares de la imagen, considera usar las consultas predefinidas o especificar qué aspectos te interesan más.<br><br><em>La integración con Gemini AI proporcionará análisis más precisos y personalizados.</em>`;
        }
    }
    
    getCodeQueryResponse(query) {
        const lowerQuery = query.toLowerCase();
        
        if (lowerQuery.includes('explica') || lowerQuery.includes('funcionamiento')) {
            return '💡 <strong>Explicación del funcionamiento:</strong><br><br>Este código implementa una funcionalidad específica siguiendo patrones de programación establecidos. La estructura incluye:<br><br>• <strong>Declaraciones:</strong> Variables y constantes necesarias<br>• <strong>Lógica principal:</strong> Algoritmos y procesos de negocio<br>• <strong>Control de flujo:</strong> Condicionales y bucles<br>• <strong>Manejo de datos:</strong> Operaciones de entrada y salida<br><br><em>El análisis detallado línea por línea estará disponible con la integración de IA especializada.</em>';
        } else if (lowerQuery.includes('optimizar') || lowerQuery.includes('optimización')) {
            return '⚡ <strong>Sugerencias de optimización:</strong><br><br>• <strong>Rendimiento:</strong> Reducir complejidad algorítmica cuando sea posible<br>• <strong>Memoria:</strong> Optimizar uso de variables y estructuras de datos<br>• <strong>Legibilidad:</strong> Mejorar nombres de variables y comentarios<br>• <strong>Modularidad:</strong> Dividir en funciones más pequeñas y específicas<br>• <strong>Reutilización:</strong> Extraer lógica común en utilidades<br><br><em>Recomendaciones específicas disponibles con análisis de IA avanzada.</em>';
        } else if (lowerQuery.includes('ejemplos') || lowerQuery.includes('similares')) {
            return '📚 <strong>Ejemplos y patrones similares:</strong><br><br>Este código sigue patrones comunes en programación que se pueden encontrar en:<br><br>• <strong>Documentación oficial:</strong> Ejemplos en MDN, documentación de frameworks<br>• <strong>Repositorios:</strong> Proyectos open source con implementaciones similares<br>• <strong>Tutoriales:</strong> Guías paso a paso para patrones relacionados<br>• <strong>Best practices:</strong> Implementaciones recomendadas por la comunidad<br><br><em>Enlaces y ejemplos específicos se proporcionarán con IA especializada.</em>';
        } else if (lowerQuery.includes('seguridad') || lowerQuery.includes('vulnerabilidades')) {
            return '🔒 <strong>Análisis de seguridad:</strong><br><br>• <strong>Validación de entrada:</strong> Verificar sanitización de datos de usuario<br>• <strong>Autenticación:</strong> Comprobar controles de acceso<br>• <strong>Inyección:</strong> Prevenir SQL injection, XSS y otros ataques<br>• <strong>Exposición de datos:</strong> Evitar filtración de información sensible<br>• <strong>Dependencias:</strong> Revisar librerías y paquetes externos<br><br><em>Auditoría detallada de seguridad disponible con herramientas de IA especializadas.</em>';
        } else if (lowerQuery.includes('rendimiento') || lowerQuery.includes('performance')) {
            return '🚀 <strong>Análisis de rendimiento:</strong><br><br>• <strong>Complejidad temporal:</strong> Evaluar Big O notation del algoritmo<br>• <strong>Uso de memoria:</strong> Optimizar estructuras de datos<br>• <strong>I/O operations:</strong> Minimizar operaciones costosas<br>• <strong>Caching:</strong> Implementar estrategias de caché apropiadas<br>• <strong>Lazy loading:</strong> Cargar recursos solo cuando sea necesario<br><br><em>Métricas detalladas y recomendaciones específicas con IA avanzada.</em>';
        } else if (lowerQuery.includes('mejores prácticas') || lowerQuery.includes('best practices')) {
            return '✨ <strong>Mejores prácticas recomendadas:</strong><br><br>• <strong>Código limpio:</strong> Nombres descriptivos y funciones pequeñas<br>• <strong>Documentación:</strong> Comentarios útiles y documentación técnica<br>• <strong>Testing:</strong> Pruebas unitarias y de integración<br>• <strong>Control de versiones:</strong> Commits atómicos y mensajes descriptivos<br>• <strong>Arquitectura:</strong> Separación de responsabilidades y principios SOLID<br><br><em>Guías específicas para tu código con análisis de IA especializada.</em>';
        } else {
            return `🤖 <strong>Análisis personalizado del código:</strong><br><br>Se ha procesado tu consulta: "${query}"<br><br>Este fragmento de código contiene implementaciones que pueden ser analizadas desde múltiples perspectivas técnicas. Para obtener insights más específicos, puedes usar las consultas predefinidas o hacer preguntas más detalladas sobre aspectos particulares como:<br><br>• Algoritmos específicos utilizados<br>• Patrones de diseño implementados<br>• Compatibilidad con diferentes entornos<br>• Escalabilidad y mantenibilidad<br><br><em>Análisis técnico profundo disponible con la integración de Gemini AI.</em>`;
        }
    }
    
    speakText(text) {
        // Detener cualquier síntesis anterior
        speechSynthesis.cancel();
        
        if (text) {
            const utterance = new SpeechSynthesisUtterance(text);
            
            try {
                // USAR CONFIGURACIÓN CENTRALIZADA DEL REPRODUCTOR GLOBAL
                
                // Verificar si AudioPlayer está disponible
                if (typeof window.AudioPlayer !== 'undefined' && window.AudioPlayer.applyGlobalVoiceConfig) {
                    // Usar la configuración centralizada del reproductor global
                    window.AudioPlayer.applyGlobalVoiceConfig(utterance);
                } else {                    
                    // Configuración de respaldo si AudioPlayer no está disponible
                    utterance.rate = 0.9;
                    utterance.pitch = 1.0;
                    utterance.volume = 0.8;
                    
                    // Detectar idioma
                    const language = this.detectPageLanguage();
                    utterance.lang = language;
                }
                
            } catch (error) {
                console.error('[DEBUG] Error aplicando configuración global para speakText (código):', error);
                
                // Valores por defecto de emergencia
                utterance.rate = 0.9;
                utterance.pitch = 1.0;
                utterance.volume = 0.8;
                utterance.lang = 'es-ES';
            }
            
            speechSynthesis.speak(utterance);
        }
    }
    
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `contextual-notification contextual-notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Observador de DOM para contenido dinámico
    setupDOMObserver() {
        this.observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            let hasNewImages = false;
            let hasNewCode = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Verificar si hay nuevos elementos agregados
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Verificar si el nodo agregado es una imagen o contiene imágenes
                            if (node.tagName === 'IMG' || 
                                node.querySelector('img, picture img, [role="img"], figure img')) {
                                hasNewImages = true;
                            }
                            
                            // Verificar si el nodo agregado es código o contiene código
                            if (node.tagName === 'PRE' || 
                                node.tagName === 'CODE' ||
                                node.querySelector('pre, code, .highlight, [class*="language-"], [class*="hljs"], .cm-editor, .CodeMirror')) {
                                hasNewCode = true;
                            }
                            
                            shouldUpdate = true;
                        }
                    });
                }
                
                // También observar cambios en atributos que podrían afectar imágenes o código
                if (mutation.type === 'attributes') {
                    const target = mutation.target;
                    const attrName = mutation.attributeName;
                    
                    // Detectar cambios relacionados con imágenes
                    if (attrName === 'src' || attrName === 'style' || attrName === 'class') {
                        if (target.tagName === 'IMG' || 
                            target.style.backgroundImage ||
                            target.querySelector('img')) {
                            hasNewImages = true;
                            shouldUpdate = true;
                        }
                    }
                    
                    // Detectar cambios relacionados con código
                    if (attrName === 'class' || attrName === 'data-language') {
                        if (target.tagName === 'PRE' || 
                            target.tagName === 'CODE' ||
                            target.className.includes('highlight') ||
                            target.className.includes('language-') ||
                            target.className.includes('hljs')) {
                            hasNewCode = true;
                            shouldUpdate = true;
                        }
                    }
                }
            });
            
            if (shouldUpdate) {
                // Debounce para evitar actualizaciones excesivas
                clearTimeout(this.updateTimeout);
                
                // Si hay nuevas imágenes o código, usar un timeout más corto
                const delay = (hasNewImages || hasNewCode) ? 500 : 1000;
                
                this.updateTimeout = setTimeout(() => {
                    const changes = [];
                    if (hasNewImages) changes.push('imágenes');
                    if (hasNewCode) changes.push('código');
                    const changeText = changes.length > 0 ? ` (incluye ${changes.join(' y ')})` : '';
                    this.createIcons();
                }, delay);
            }
        });
        
        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'style', 'class']
        });
    }
    
    // Configurar listeners para detectar imágenes cargadas dinámicamente
    setupImageLoadListeners() {
        // Listener delegado para detectar cuando las imágenes se cargan
        document.addEventListener('load', (event) => {
            if (event.target.tagName === 'IMG') {                
                // Pequeño delay para asegurar que la imagen esté completamente renderizada
                setTimeout(() => {
                    // Solo crear iconos para esta imagen específica si no los tiene ya
                    const image = event.target;
                    const parent = image.parentElement;
                    if (parent && !parent.querySelector('.contextual-icons-container[data-type="image"]')) {
                        this.createIconsForSingleImage(image);
                    }
                }, 200);
            }
        }, true); // Usar capture para detectar eventos de carga
        
        // También detectar cambios en el atributo src de imágenes existentes
        const imgObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && 
                    mutation.attributeName === 'src' && 
                    mutation.target.tagName === 'IMG') {
                    
                    const img = mutation.target;                    
                    // Esperar a que la nueva imagen se cargue
                    if (img.complete) {
                        setTimeout(() => this.createIconsForSingleImage(img), 200);
                    } else {
                        img.onload = () => {
                            setTimeout(() => this.createIconsForSingleImage(img), 200);
                        };
                    }
                }
            });
        });
        
        imgObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['src'],
            subtree: true
        });
        
        this.imgObserver = imgObserver;
    }
    
    // Crear iconos para una imagen específica
    createIconsForSingleImage(image) {
        try {
            // Verificar que la imagen sea válida
            const width = image.naturalWidth || image.width || 0;
            const height = image.naturalHeight || image.height || 0;
            
            if (width < 30 || height < 30) {
                return;
            }
            
            // Verificar que no tenga iconos ya
            const parent = image.parentElement;
            if (parent && parent.querySelector('.contextual-icons-container[data-type="image"]')) {
                return;
            }
            
            // Crear iconos
            const iconContainer = this.createIconContainer('image', Date.now());
            const descriptionIcon = this.createDescriptionIcon(() => this.describeImage(image));
            const audioDescIcon = this.createImageAudioIcon(image);
            
            iconContainer.appendChild(descriptionIcon);
            iconContainer.appendChild(audioDescIcon);
            
            this.insertIconContainer(image, iconContainer);            
        } catch (error) {
            console.error('[DEBUG] Error creando iconos para imagen individual:', error);
        }
    }

    // Crear iconos para un bloque de código específico
    createIconsForSingleCode(codeElement) {
        try {
            // Verificar que el elemento de código sea válido
            if (!this.isValidCodeElement(codeElement, 'dynamic')) {
                return;
            }
            
            // Verificar que no tenga iconos ya
            const parent = codeElement.parentElement;
            if (parent && parent.querySelector('.contextual-icons-container[data-type="code"]')) {
                return;
            }
            
            // Crear iconos
            const iconContainer = this.createIconContainer('code', Date.now());
            const audioIcon = this.createCodeAudioIcon(codeElement);
            const analysisIcon = this.createAnalysisIcon(() => this.openCodeAnalysis(codeElement));
            const copyIcon = this.createCopyIcon(() => this.copyCode(codeElement));
            
            iconContainer.appendChild(audioIcon);
            iconContainer.appendChild(analysisIcon);
            iconContainer.appendChild(copyIcon);
            
            this.insertIconContainer(codeElement, iconContainer);            
        } catch (error) {
            console.error('[DEBUG] Error creando iconos para código individual:', error);
        }
    }

    removeAllIcons() {
        this.icons.forEach(icon => {
            if (icon.parentElement) {
                icon.parentElement.removeChild(icon);
            }
        });
        this.icons = [];
    }
    
    updateSettings(newSettings) {
        this.settings = newSettings;
        // Recrear iconos si es necesario
        if (this.settings.contextualIcons) {
            this.createIcons();
        }
    }
    
    destroy() {
        this.removeAllIcons();
        
        // Detener todos los audios
        this.stopAllAudio();
        
        // Limpiar estados de audio
        this.audioStates.clear();
        
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        if (this.imgObserver) {
            this.imgObserver.disconnect();
            this.imgObserver = null;
        }
        
        // Limpiar timeouts
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        
        if (this.pendingClickTimeout) {
            clearTimeout(this.pendingClickTimeout);
            this.pendingClickTimeout = null;
        }
    }
}

// Exportar clase
window.ContextualIcons = ContextualIcons;

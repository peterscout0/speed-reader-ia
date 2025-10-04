// Global i18n function 't' provided by utils/i18n.js

// 🔧 DEBUG MODE - Set to false for production
const DEBUG_CONTEXTUAL = false;
const debugLog = (...args) => DEBUG_CONTEXTUAL && console.log('[Contextual]', ...args);
const debugWarn = (...args) => DEBUG_CONTEXTUAL && console.warn('[Contextual]', ...args);
const debugError = (...args) => console.error('[Contextual]', ...args); // Errors always show

// Funciones de descifrado para API key
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
        return encryptedText; // Fallback si no está cifrado
    }
}

class SelectionContextual {
    constructor(settings = {}) {
        this.settings = settings;
        this._currentSelection = null; // Propiedad privada
        this.contextMenu = null;
        this.isMenuVisible = false;
        this.audioStates = new Map();
        
        // Bandera para proteger selección durante análisis IA
        this.isAnalyzingWithAI = false;
        
        // Bandera para deshabilitar temporalmente el menú contextual
        this.temporarilyDisableMenu = false;
        
        // Bandera para prevenir que el click de selección cierre el menú
        this.justOpenedMenu = false;
        
        // Detectar si estamos en un PDF
        this.isPDFViewer = this.detectPDFViewer();
        
        // Propiedades para el sistema de lectura
        this.readingControl = null;
        this.isReading = false;
        this.isPaused = false;
        this.currentUtterance = null;
        this.readingText = '';
        
        // Propiedades para resaltado sincronizado
        this.originalSelection = null; // Referencia al rango de selección original
        this.highlightContainer = null; // Contenedor con el texto dividido en palabras (deprecado)
        this.wordElements = []; // Array de elementos span para cada palabra (deprecado)
        this.currentWordIndex = -1; // Índice de la palabra actual siendo pronunciada
        this.highlightActive = false; // Estado del resaltado
        
        // Propiedades para nuevo sistema de resaltado
        this.highlightedElement = null; // Elemento que tiene el resaltado aplicado
        this.originalElementClasses = null; // Clases originales del elemento
        this.words = []; // Array de palabras del texto
        
        // Propiedades para control de audio de consultas
        this.currentUtterance = null; // SpeechSynthesisUtterance actual
        this.isAudioPlaying = false; // Estado del audio
        this.currentAudioText = ''; // Texto actual siendo reproducido
        this.audioIsPaused = false; // Estado de pausa
        
        // OPTIMIZACIÓN: Debouncing y throttling para eventos frecuentes
        this.selectionChangeTimeout = null;
        this.lastSelectionProcessTime = 0;
        this.minSelectionInterval = 100; // Mínimo tiempo entre procesamientos
        
        // OPTIMIZACIÓN: Cache para análisis de contenido
        this.contentAnalysisCache = new Map();
        this.cacheMaxSize = 50;
        this.cacheMaxAge = 30000; // 30 segundos
        this.audioTextToResume = null; // Texto para reanudar
        this.audioStartTime = 0; // Tiempo de inicio del audio
        this.audioPauseTime = 0; // Tiempo cuando se pausó
        this.audioWords = []; // Array de palabras del texto de audio
        this.audioCurrentWordIndex = 0; // Índice de palabra actual
        
        // Control de consultas en progreso
        this.isConsultationInProgress = false; // Estado de consulta en progreso
        this.currentConsultationController = null; // AbortController para cancelar consultas
        

        
        this.init();
    }
    
    // Getter/Setter para rastrear todos los cambios a currentSelection
    get currentSelection() {
        return this._currentSelection;
    }
    
    set currentSelection(value) {
        const oldValue = this._currentSelection;
        this._currentSelection = value;  
        // Si se está eliminando una selección con imágenes, hacer log especial
        if (oldValue?.hasImages && !value) {
            console.error('[TRACKER]', t('selectionWithImagesDeleted'), {
                oldImages: oldValue.images?.length || 0,
                stack: new Error().stack.split('\n')[2]?.trim()
            });
        }
    }
    
    detectPDFViewer() {
        // TEMPORALMENTE DESHABILITADO - Funcionalidad PDF en desarrollo
        // TODO: Implementar soporte completo para PDFs
        return false;
    }
    

    // Método para redirigir PDF al viewer compatible
    redirectToPDFJS(pdfUrl = window.location.href) {
        
        // Extraer la URL real del PDF del visor de Chrome
        let realPdfUrl = pdfUrl;
        
        // Si estamos en el visor de Chrome, extraer la URL real
        if (pdfUrl.includes('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/')) {
            const urlParams = new URLSearchParams(window.location.search);
            const srcParam = urlParams.get('src');
            if (srcParam) {
                realPdfUrl = decodeURIComponent(srcParam);
            }
        }
        
        const pdfJSViewer = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(realPdfUrl)}`;        
        const isSpanish = navigator.language.startsWith('es');
        const userConfirm = confirm(
            (isSpanish ? 
                'Se detectó que estás visualizando un PDF en el visor nativo de Chrome.\n\nPara usar todas las funciones de la extensión (selección de texto, análisis con IA, etc.), es necesario abrir el PDF en un visor compatible.\n\n¿Deseas abrir el PDF en PDF.js ahora?' :
                'Chrome native PDF viewer detected.\n\nTo use all extension features (text selection, AI analysis, etc.), you need to open the PDF in a compatible viewer.\n\nDo you want to open the PDF in PDF.js now?')
        );
        
        if (userConfirm) {
            window.open(pdfJSViewer, '_blank');
            const message = isSpanish ? 'PDF abierto en visor compatible' : 'PDF opened in compatible viewer';
            this.showNotification(message, 'success');
        } else {
            const message = isSpanish ? 'Funciones limitadas en visor nativo' : 'Limited functions in native viewer';
            this.showNotification(message, 'warning');
        }
    }
    
    recheckForPDF() {
        // TEMPORALMENTE DESHABILITADO - Funcionalidad PDF en desarrollo
        return;
        
        /* DESHABILITADO
        
        if (!this.isPDFViewer && this.detectPDFViewer()) {
            const isSpanish = navigator.language.startsWith('es');
            const message = isSpanish ? 
                'PDF detectado en segunda verificación' : 
                'PDF detected on second verification';
            this.isPDFViewer = true;
            this.setupPDFListeners();
            const notificationMsg = isSpanish ? 
                'PDF detectado - Funciones disponibles' : 
                'PDF detected - Functions available';
            this.showNotification(notificationMsg, 'success');
        }
        */
    }
    
    // Función para forzar detección manual desde consola
    forceEnablePDFMode() {
        // TEMPORALMENTE DESHABILITADO - Funcionalidad PDF en desarrollo
        const isSpanish = navigator.language.startsWith('es');
        const msg = isSpanish 
            ? ' Funcionalidad PDF temporalmente deshabilitada - En desarrollo'
            : ' PDF functionality temporarily disabled - In development';
        this.showNotification(msg, 'warning');
        return false;
        
        /* DESHABILITADO
        this.isPDFViewer = true;
        this.setupPDFListeners();
        this.showNotification(' ' + t('pdfModeActivatedManually'), 'info');
        return true;
        */
    }
    
    init() {
        // NOTA: Funcionalidad PDF temporalmente deshabilitada
        if (this.isPDFViewer) {
            // this.setupPDFListeners(); // DESHABILITADO
        } else {
            // Verificación adicional deshabilitada (PDF feature disabled)
            // setTimeout(() => {
            //     this.recheckForPDF();
            // }, 3000);
        }
        
        this.setupSelectionListeners();
        this.setupGlobalListeners();
        

    }
    
    setupSelectionListeners() {
        // OPTIMIZACIÓN: Debounced handler para selectionchange
        const debouncedSelectionChange = () => {
            // Limpiar timeout previo
            if (this.selectionChangeTimeout) {
                clearTimeout(this.selectionChangeTimeout);
            }
            
            // Crear nuevo timeout con delay reducido para mejor UX
            this.selectionChangeTimeout = setTimeout(() => {
                this.handleSelectionChange();
            }, 50); // Reducido de 150ms a 50ms para respuesta más rápida
        };
        
        // Listener para cambios en la selección (con debouncing)
        document.addEventListener('selectionchange', debouncedSelectionChange);
        
        // Listener para mouseup (final de selección)
        document.addEventListener('mouseup', (event) => {
            // Procesamiento inmediato sin setTimeout para mostrar menú más rápido
            this.handleMouseUp(event);
        });
        
        // OPTIMIZACIÓN: Throttled handler para teclado
        document.addEventListener('keyup', (event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || 
                event.key === 'ArrowUp' || event.key === 'ArrowDown' ||
                event.shiftKey) {
                // Solo procesar si ha pasado suficiente tiempo desde el último procesamiento
                const now = Date.now();
                if (now - this.lastSelectionProcessTime < this.minSelectionInterval) {
                    return;
                }
                this.lastSelectionProcessTime = now;
                
                setTimeout(() => {
                    this.handleSelectionChange();
                }, 50);
            }
        });
    }
    
    setupGlobalListeners() {
        // Cerrar menú al hacer clic fuera
        document.addEventListener('click', (event) => {
            // Ignorar el click que acaba de abrir el menú
            if (this.justOpenedMenu) {
                this.justOpenedMenu = false;
                return;
            }
            
            if (this.isMenuVisible && !event.target.closest('.selection-context-menu')) {
                this.hideContextMenu();
            }
        });
        
        // Cerrar menú al presionar Escape
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isMenuVisible) {
                this.hideContextMenu();
            }
        });
        
        // Cerrar menú al hacer scroll
        document.addEventListener('scroll', () => {
            if (this.isMenuVisible) {
                this.hideContextMenu();
            }
        });
    }
    
    setupPDFListeners() {
        // Listener específico para PDFs - manejo mejorado        
        // Configurar listeners específicos para diferentes tipos de PDF viewers
        this.setupPDFSelectionListeners();
        
        // Esperar a que el PDF se cargue completamente
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializePDFSupport();
            });
        } else {
            // Inicializar inmediatamente pero también con delay para PDFs lentos
            this.initializePDFSupport();
            setTimeout(() => this.initializePDFSupport(), 1000);
            setTimeout(() => this.initializePDFSupport(), 3000);
        }
        
        // Listener para cambios dinámicos en el DOM del PDF
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // PDF cargado dinámicamente
                    setTimeout(() => this.initializePDFSupport(), 500);
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    setupPDFSelectionListeners() {        
        // Listener específico para selecciones en PDFs con mejor timing
        const pdfSelectionHandler = (e) => {
            setTimeout(() => {
                const selection = window.getSelection();
                if (selection && selection.toString().trim()) {
                    this.handlePDFSelection(e);
                }
            }, 150); // Delay mayor para PDFs
        };
        
        // Múltiples eventos para mejor cobertura
        document.addEventListener('mouseup', pdfSelectionHandler);
        document.addEventListener('touchend', pdfSelectionHandler);
        
        // Listener adicional para PDF.js específicamente
        if (window.PDFViewerApplication) {            
            // Esperar a que PDF.js esté completamente cargado
            const checkPDFReady = () => {
                if (window.PDFViewerApplication.initialized) {
                    this.setupPDFJSListeners();
                } else {
                    setTimeout(checkPDFReady, 500);
                }
            };
            checkPDFReady();
        }
    }
    
    setupPDFJSListeners() {        
        // Listener para el contenedor de páginas de PDF.js
        const viewer = document.querySelector('#viewer') || document.querySelector('.pdfViewer');
        if (viewer) {
            viewer.addEventListener('mouseup', (e) => {
                setTimeout(() => {
                    const selection = window.getSelection();
                    if (selection && selection.toString().trim()) {
                        this.handlePDFSelection(e);
                    }
                }, 100);
            });
            
            // Prevenir que el menú se oculte por eventos de PDF.js
            viewer.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        // Listener para cambios de página en PDF.js
        if (window.PDFViewerApplication.eventBus) {
            window.PDFViewerApplication.eventBus.on('pagechanging', () => {
                this.hideContextMenu(); // Ocultar menú al cambiar página
            });
        }
    }
    
    initializePDFSupport() {        
        // Buscar el contenedor del PDF
        const pdfContainer = this.findPDFContainer();
        
        if (pdfContainer) {
            this.setupPDFTextExtraction(pdfContainer);
        } else {
            // Reintentar después de un momento
            setTimeout(() => {
                this.initializePDFSupport();
            }, 1000);
        }
    }
    
    findPDFContainer() {        
        // Buscar diferentes tipos de contenedores PDF
        const selectors = [
            'embed[type="application/pdf"]',
            'object[type="application/pdf"]',
            'iframe[src*=".pdf"]',
            'embed[src*=".pdf"]',
            '#viewer', // Chrome PDF viewer
            '.textLayer', // PDF.js text layer
            '[data-page-number]', // PDF pages
            'body', // Fallback para PDFs que cargan directamente en body
            '#viewerContainer', // Otro viewer común
            '.pdfViewer' // Viewer genérico
        ];
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                return element;
            }
        }
        
        // Si no encontramos contenedor específico, usar body como fallback
        return document.body;
    }
    
    setupPDFTextExtraction(container) {        
        // Si es un PDF.js viewer, buscar capas de texto
        const textLayers = container.querySelectorAll('.textLayer');
        if (textLayers.length > 0) {
            this.setupPDFJSListeners(textLayers);
            return;
        }
        
        // Si es Chrome PDF viewer nativo
        if (container.tagName === 'EMBED' || container.tagName === 'OBJECT') {
            this.setupNativePDFListeners(container);
            return;
        }
        
        // Fallback - intentar extraer texto de cualquier elemento
        this.setupGenericPDFListeners(container);
    }
    
    setupPDFJSListeners(textLayers) {
        textLayers.forEach(layer => {
            layer.addEventListener('mouseup', (event) => {
                setTimeout(() => {
                    this.handlePDFSelection(event);
                }, 100);
            });
        });
    }
    
    setupNativePDFListeners(container) {
        // Para PDFs nativos, el texto se puede seleccionar directamente
        container.addEventListener('mouseup', (event) => {
            setTimeout(() => {
                this.handlePDFSelection(event);
            }, 100);
        });
    }
    
    setupGenericPDFListeners(container) {
        // Configuración genérica para cualquier tipo de PDF
        container.addEventListener('mouseup', (event) => {
            setTimeout(() => {
                this.handlePDFSelection(event);
            }, 100);
        });
    }
    
    handlePDFSelection(event) {        
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            this.hideContextMenu();
            return;
        }
        
        const selectedText = selection.toString().trim();
        if (selectedText.length === 0) {
            this.hideContextMenu();
            return;
        }        
        // Limpiar el texto específicamente para PDFs
        const cleanedText = this.cleanTextForSpeech(selectedText);
        
        // Crear selección específica para PDF con información adicional
        this.currentSelection = {
            text: cleanedText,
            originalText: selectedText,
            range: selection.getRangeAt(0),
            isPDF: true,
            timestamp: Date.now(),
            source: 'pdf-selection'
        };
        
        // Calcular posición del menú con mejor precisión
        let menuX = event.clientX || event.pageX;
        let menuY = event.clientY || event.pageY;
        
        // Si no hay coordenadas del evento, usar la posición de la selección
        if (!menuX || !menuY) {
            const rect = selection.getRangeAt(0).getBoundingClientRect();
            menuX = rect.right;
            menuY = rect.top - 10;
        }
        
        // Prevenir que otros eventos interfieran
        event.stopPropagation();
        
        // Mostrar menú contextual específico para PDF
        this.showPDFContextMenu(menuX, menuY);
    }
    
    showPDFContextMenu(x, y) {        
        // Crear o actualizar menú específico para PDF
        this.createPDFContextMenu();
        
        // Mostrar con delay para asegurar que no se oculte inmediatamente
        setTimeout(() => {
            this.showContextMenu(x, y);
            
            // Prevenir ocultamiento automático por un momento
            this.preventMenuHide = true;
            setTimeout(() => {
                this.preventMenuHide = false;
            }, 500);
        }, 100);
    }
    
    createPDFContextMenu() {        
        if (!this.contextMenu) {
            this.createContextMenu(); // Asegurar que existe el menú base
        }
        
        // Actualizar opciones del menú para PDF
        const menuContent = this.contextMenu.querySelector('.context-menu-options') || 
                           this.contextMenu.querySelector('.context-menu-content') ||
                           this.contextMenu;
        
        if (menuContent) {
            menuContent.innerHTML = `
                <div class="context-option" data-action="read-pdf">
                    <span class="option-icon"></span>
                    <span class="option-text">${t('readPdfText')}</span>
                </div>
                <div class="context-option" data-action="send-to-global">
                    <span class="option-icon"></span>
                    <span class="option-text">${t('sendToGlobalPlayer')}</span>
                </div>
                <div class="context-option" data-action="explain-pdf">
                    <span class="option-icon">IA</span>
                    <span class="option-text">Explicar contenido del PDF</span>
                </div>
                <div class="context-option" data-action="copy">
                    <span class="option-icon"></span>
                    <span class="option-text">Copiar texto</span>
                </div>
            `;
        }
    }
    
    handleSelectionChange() {
        const selection = window.getSelection();
        
        // Ignorar cambios de selección si hay un modal abierto
        if (document.querySelector('.contextual-modal')) {
            return;
        }
        
        // Ignorar cambios de selección si estamos analizando con IA
        if (this.isAnalyzingWithAI) {
            return;
        }
        
        // Si no hay selección o está vacía, ocultar menú
        if (!selection || selection.isCollapsed) {
            // PROTECCIÓN: No limpiar si estamos analizando con IA
            if (this.isAnalyzingWithAI) {
                this.hideContextMenu();
                return;
            }
            
            this.hideContextMenu();
            this.currentSelection = null;
            return;
        }
        
        const selectedText = selection.toString().trim();
        const range = selection.getRangeAt(0);
        
        // MEJORADO: Permitir selecciones sin texto si contienen elementos
        let hasValidContent = false;
        
        // Verificar si hay texto
        if (selectedText.length > 0) {
            hasValidContent = true;
        }
        
        // OPTIMIZACIÓN: Solo clonar fragment si realmente hay posibilidad de contenido multimedia
        // Esto ahorra mucho procesamiento en selecciones de solo texto
        let images = [];
        let mediaElements = [];
        let codeElements = [];
        let hasCodePattern = false;
        
        // OPTIMIZACIÓN: Verificación rápida del ancestro común antes de clonar
        const commonAncestor = range.commonAncestorContainer;
        const ancestorElement = commonAncestor.nodeType === Node.TEXT_NODE 
            ? commonAncestor.parentElement 
            : commonAncestor;
        
        // MEJORADO: Verificar si el ancestro ES una imagen o contiene multimedia
        const isDirectMediaElement = ancestorElement && 
            (ancestorElement.tagName === 'IMG' || 
             ancestorElement.tagName === 'VIDEO' || 
             ancestorElement.tagName === 'AUDIO' ||
             ancestorElement.tagName === 'SVG' ||
             ancestorElement.tagName === 'CANVAS');
        
        // Solo buscar multimedia si el ancestro puede contenerlo o ES multimedia
        const mightHaveMedia = ancestorElement && (
            isDirectMediaElement ||
            ancestorElement.tagName !== 'P' ||
            ancestorElement.querySelector('img, video, audio, svg, canvas, code, pre') !== null
        );
        
        if (mightHaveMedia) {
            const fragment = range.cloneContents();
            images = Array.from(fragment.querySelectorAll('img'));
            
            // Si el fragmento no tiene imgs pero el ancestro ES una imagen, agregarla
            if (images.length === 0 && ancestorElement.tagName === 'IMG') {
                images = [ancestorElement];
            }
            
            mediaElements = Array.from(fragment.querySelectorAll('video, audio, svg, canvas'));
            codeElements = Array.from(fragment.querySelectorAll('code, pre, kbd, samp'));
            
            if (images.length > 0 || mediaElements.length > 0 || codeElements.length > 0) {
                hasValidContent = true;
            }
        }
        
        // OPTIMIZACIÓN: Detección simplificada de código por patrones
        // Solo si no detectamos elementos de código
        if (codeElements.length === 0 && selectedText.length > 10 && selectedText.length < 5000) {
            // Patrones más eficientes - solo los más comunes y rápidos
            const quickCodePatterns = [
                /function\s+\w+\s*\(/,
                /class\s+\w+/,
                /import\s+.*from/,
                /console\.(log|error)/,
                /<\w+[^>]*>/,
                /\bvar\s+\w+\s*=|let\s+\w+\s*=|const\s+\w+\s*=/
            ];
            
            hasCodePattern = quickCodePatterns.some(pattern => pattern.test(selectedText));
            if (hasCodePattern) {
                hasValidContent = true;
            }
        }
        
        // Si no hay contenido válido, ocultar menú
        if (!hasValidContent) {
            this.hideContextMenu();
            this.currentSelection = null;
            return;
        }
        
        this.currentSelection = {
            selection: selection,
            text: selectedText,
            range: range,
            commonAncestor: commonAncestor,
            hasImages: images.length > 0,
            hasMedia: mediaElements.length > 0,
            hasCode: codeElements.length > 0 || hasCodePattern,
            images: images,
            media: mediaElements,
            codeElements: codeElements,
            element: images.length > 0 ? images[0] : null,
            timestamp: Date.now()
        };
    }
    
    handleMouseUp(event) {
        // Ignorar clicks en el menú contextual mismo
        if (event.target.closest('.selection-context-menu')) {
            return;
        }
        
        // Ignorar eventos de mouse si hay un modal abierto
        if (document.querySelector('.contextual-modal')) {
            return;
        }
        
        // Ignorar eventos de mouse si estamos analizando con IA
        if (this.isAnalyzingWithAI) {
            return;
        }
        
        // CRÍTICO: Actualizar selección inmediatamente antes de mostrar menú
        // Esto evita problemas de timing con el debounce
        this.handleSelectionChange();
        
        // MEJORADO: Verificar si hay contenido válido para mostrar menú
        if (!this.currentSelection) {
            return;
        }
        
        // NUEVO: No mostrar menú si ya hay un panel de lectura activo
        if (this.readingControl && (this.isReading || this.isPaused)) {
            return;
        }
        
        // Permitir mostrar menú si hay texto significativo O elementos multimedia/código
        const hasValidText = this.currentSelection.text.length >= 3;
        const hasValidElements = this.currentSelection.hasImages || 
                                this.currentSelection.hasMedia || 
                                this.currentSelection.hasCode;
        
        // Si no hay texto Y no hay elementos válidos, no mostrar menú
        if (!hasValidText && !hasValidElements) {
            return;
        }
        
        // Analizar el tipo de contenido seleccionado
        const contentType = this.analyzeSelectedContent();
        
        // Mostrar menú contextual apropiado
        this.showContextMenu(event, contentType);
    }
    
    analyzeSelectedContent() {
        if (!this.currentSelection) return 'text';
        
        const { range, commonAncestor, text } = this.currentSelection;
        
        // Obtener el elemento contenedor más cercano
        let container = commonAncestor;
        if (container.nodeType === Node.TEXT_NODE) {
            container = container.parentElement;
        }
         
        // OPTIMIZACIÓN: usar el startContainer del range que puede ser más específico
        if (container.tagName === 'BODY' || container.tagName === 'HTML' || container === document) {
            let specificContainer = range.startContainer;
            if (specificContainer.nodeType === Node.TEXT_NODE) {
                specificContainer = specificContainer.parentElement;
            }
            container = specificContainer;
        }
        
        // Analizar el contexto del contenedor
        const analysis = {
            type: 'text',
            confidence: 0,
            context: container,
            features: []
        };
        
        // 1. Detectar si es código
        const codeIndicators = this.detectCodeContext(container, text);
        if (codeIndicators.isCode) {
            analysis.type = 'code';
            analysis.confidence = codeIndicators.confidence;
            analysis.features = codeIndicators.features;
            return analysis;
        }
        
        // 2. Detectar si hay imágenes en la selección
        const imageIndicators = this.detectImageContext(range);
        if (imageIndicators.hasImages) {
            analysis.type = 'image';
            analysis.confidence = imageIndicators.confidence;
            analysis.features = imageIndicators.features;
            return analysis;
        }
        
        // 3. Por defecto es texto
        analysis.type = 'text';
        analysis.confidence = 1.0;
        
        return analysis;
    }
    
    detectCodeContext(container, text) {
        // OPTIMIZACIÓN: Crear clave de caché
        const cacheKey = `code_${container?.tagName}_${text.substring(0, 50)}`;
        const cached = this.contentAnalysisCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp < this.cacheMaxAge)) {
            return cached.result;
        }
        
        const result = {
            isCode: false,
            confidence: 0,
            features: []
        };
        
        // Verificar etiquetas HTML indicativas de código
        const codeElements = ['PRE', 'CODE', 'SAMP', 'KBD', 'VAR', 'TT'];
        
        let currentElement = container;
        
        // Si el contenedor es un nodo de texto, revisar su padre
        if (currentElement.nodeType === Node.TEXT_NODE) {
            currentElement = currentElement.parentElement;
        }
        
        // Verificar el elemento actual
        if (currentElement && codeElements.includes(currentElement.tagName)) {
            result.isCode = true;
            result.confidence = 0.95;
            result.features.push(`tag:${currentElement.tagName}`);
            this.cacheAnalysisResult(cacheKey, result);
            return result;
        }
        
        // OPTIMIZACIÓN: Verificación simplificada de selección
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            let node = range.startContainer;
            
            // Buscar hacia arriba (máximo 5 niveles para mejor performance)
            let depth = 0;
            while (node && depth < 5) {
                if (node.nodeType === Node.ELEMENT_NODE && codeElements.includes(node.tagName)) {
                    result.isCode = true;
                    result.confidence = 0.9;
                    result.features.push(`ancestor:${node.tagName}`);
                    this.cacheAnalysisResult(cacheKey, result);
                    return result;
                }
                node = node.parentNode;
                depth++;
            }
        }
        
        // Verificar clases CSS (solo las más comunes)
        const className = currentElement.className || '';
        const quickCodeClasses = ['highlight', 'code', 'hljs', 'language-'];
        
        for (let cls of quickCodeClasses) {
            if (className.includes(cls)) {
                result.isCode = true;
                result.confidence = 0.85;
                result.features.push(`class:${cls}`);
                this.cacheAnalysisResult(cacheKey, result);
                return result;
            }
        }
        
        // OPTIMIZACIÓN: Análisis de patrones solo si el texto no es muy largo
        if (text.length > 10 && text.length < 2000) {
            // Patrones más eficientes - solo los más determinantes
            const quickPatterns = [
                /function\s+\w+\s*\(/,
                /class\s+\w+/,
                /import\s+.*from/,
                /\bconst\s+\w+\s*=/,
                /console\.(log|error)/,
                /<\w+[^>]*>/
            ];
            
            let patternMatches = 0;
            for (let pattern of quickPatterns) {
                if (pattern.test(text)) {
                    patternMatches++;
                    if (patternMatches >= 2) break; // Early exit
                }
            }
            
            if (patternMatches >= 2) {
                result.isCode = true;
                result.confidence = 0.75;
                result.features.push(`patterns:${patternMatches}`);
            }
        }
        
        this.cacheAnalysisResult(cacheKey, result);
        return result;
    }
    
    // NUEVO: Método para cachear resultados de análisis
    cacheAnalysisResult(key, result) {
        // Limpiar caché si está muy grande
        if (this.contentAnalysisCache.size >= this.cacheMaxSize) {
            const firstKey = this.contentAnalysisCache.keys().next().value;
            this.contentAnalysisCache.delete(firstKey);
        }
        
        this.contentAnalysisCache.set(key, {
            result: result,
            timestamp: Date.now()
        });
    }
    
    detectImageContext(range) {
        const result = {
            hasImages: false,
            confidence: 0,
            features: [],
            images: []
        };
        
        // OPTIMIZACIÓN: Verificación rápida antes de clonar
        const startContainer = range.startContainer;
        const containerElement = startContainer.nodeType === Node.TEXT_NODE 
            ? startContainer.parentElement 
            : startContainer;
        
        // Si el contenedor no puede tener imágenes, salir rápido
        if (!containerElement || containerElement.tagName === 'SCRIPT' || containerElement.tagName === 'STYLE') {
            return result;
        }
        
        // Verificar si hay imágenes dentro del rango seleccionado
        const fragment = range.cloneContents();
        const images = fragment.querySelectorAll('img');
        
        if (images.length > 0) {
            result.hasImages = true;
            result.confidence = 1.0;
            result.features.push(`direct-images:${images.length}`);
            result.images = Array.from(images);
            return result; // Early exit si ya encontramos imágenes
        }
        
        // OPTIMIZACIÓN: Solo buscar imágenes intersectadas si realmente es necesario
        // Limitar a contenedores pequeños para evitar búsquedas masivas
        const allImages = containerElement.querySelectorAll('img');
        
        // Si hay demasiadas imágenes, no procesar (probablemente galería grande)
        if (allImages.length > 20) {
            return result;
        }
        
        for (let img of allImages) {
            if (this.rangesIntersect(range, img)) {
                result.hasImages = true;
                result.confidence = 1.0;
                result.features.push(`intersect-image`);
                result.images.push(img);
            }
        }
        
        return result;
    }
    
    // OPTIMIZADO: Verificación de intersección más eficiente
    rangesIntersect(range, element) {
        try {
            const imgRange = document.createRange();
            imgRange.selectNode(element);
            
            // Comparación simplificada
            return range.compareBoundaryPoints(Range.START_TO_START, imgRange) <= 0 &&
                   range.compareBoundaryPoints(Range.END_TO_START, imgRange) >= 0;
        } catch (e) {
            return false;
        }
    }
    
    showContextMenu(event, contentAnalysis) {
        // No mostrar menú si está temporalmente deshabilitado
        if (this.temporarilyDisableMenu) {
            return;
        }
        
        // No mostrar menú si hay un modal abierto
        if (document.querySelector('.contextual-modal')) {
            return;
        }
        
        // No mostrar menú si estamos analizando con IA
        if (this.isAnalyzingWithAI) {
            return;
        }
        
        this.hideContextMenu(); // Limpiar menú anterior
        
        const menu = this.createContextMenu(contentAnalysis);
        document.body.appendChild(menu);
        
        // Posicionar menú cerca del cursor
        const x = event.clientX;
        const y = event.clientY;
        this.positionMenu(menu, x, y);
        
        this.contextMenu = menu;
        this.isMenuVisible = true;
        
        // Marcar que acabamos de abrir el menú para evitar que el evento click lo cierre
        this.justOpenedMenu = true;
        
        // Animación de entrada
        setTimeout(() => {
            menu.classList.add('visible');
        }, 10);
    }
    
    createContextMenu(contentAnalysis) {
        const menu = document.createElement('div');
        menu.className = 'selection-context-menu';
        
        const { type } = contentAnalysis;
        
        // Crear opciones según el tipo de contenido
        let options = [];
        
        switch (type) {
            case 'code':
                options = [
                    { 
                        icon: 'audio.svg', 
                        label: t('readCode'), 
                        action: () => this.readCodeAloud() 
                    },
                    { 
                        icon: 'describe.svg', 
                        label: t('analyzeCodeWithAI'), 
                        action: () => this.analyzeCodeWithAI() 
                    },
                    { 
                        icon: 'copy.svg', 
                        label: t('copyCode'), 
                        action: () => this.copyCode() 
                    },
                    { 
                        icon: 'search.svg', 
                        label: t('searchWeb'), 
                        action: () => this.searchInGoogle() 
                    }
                ];
                break;
                
            case 'image':
                const isSpanish = navigator.language.startsWith('es');
                options = [
                    { 
                        icon: 'audio.svg', 
                        label: isSpanish ? 'Describir imagen' : 'Describe Image', 
                        action: () => this.describeImage() 
                    },
                    { 
                        icon: 'describe.svg', 
                        label: isSpanish ? 'Analizar imagen con IA' : 'Analyze image with AI', 
                        action: () => this.analyzeImageWithAI() 
                    },
                    { 
                        icon: 'search.svg', 
                        label: isSpanish ? 'Consultar imagen' : 'Consult image', 
                        action: () => this.searchImageInGoogle() 
                    }
                ];
                break;
                
            default: // text
                if (this.isPDFViewer) {
                    // Opciones específicas para PDFs
                    options = [
                        { 
                            icon: 'audio.svg', 
                            label: t('readPdfAloud'), 
                            action: () => this.readPDFTextAloud() 
                        },
                        { 
                            icon: 'global-player.svg', 
                            label: t('playFromHerePdf'), 
                            action: () => this.sendPDFToGlobalPlayer() 
                        },
                        { 
                            icon: 'describe.svg', 
                            label: t('explainPdfContent'), 
                            action: () => this.explainPDFContent() 
                        },
                        { 
                            icon: 'copy.svg', 
                            label: t('copyPdfText'), 
                            action: () => this.copyText() 
                        },
                        { 
                            icon: 'search.svg', 
                            label: t('searchWeb'), 
                            action: () => this.searchInGoogle() 
                        }
                    ];
                } else {
                    // Opciones para páginas web normales
                    options = [
                        { 
                            icon: 'audio.svg', 
                            label: t('textToSpeech'), 
                            action: () => this.readTextAloud() 
                        },
                        { 
                            icon: 'global-player.svg', 
                            label: t('startReadingFromHere'), 
                            action: () => this.sendToGlobalPlayer() 
                        },
                        { 
                            icon: 'copy.svg', 
                            label: t('copyText'), 
                            action: () => this.copyText() 
                        },
                        { 
                            icon: 'search.svg', 
                            label: t('searchWeb'), 
                            action: () => this.searchInGoogle() 
                        }
                    ];
                }
                break;
        }
        
        // Crear elementos del menú
        options.forEach(option => {
            const button = document.createElement('button');
            button.className = 'context-menu-option';
            
            button.innerHTML = `
                <img src="chrome-extension://${chrome.runtime.id}/icons/${option.icon}" 
                     alt="${option.label}" class="option-icon">
                <span class="option-label">${option.label}</span>
            `;
            
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // CORREGIDO: Ejecutar la acción
                option.action();
                
                // CORREGIDO: Ocultar menú inmediatamente después del clic
                this.hideContextMenu();
            });
            
            menu.appendChild(button);
        });
        
        return menu;
    }
    
    positionMenu(menu, x, y) {
        const rect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Ajustar posición para que no se salga de la ventana
        let left = x + 10;
        let top = y + 10;
        
        if (left + rect.width > viewportWidth) {
            left = x - rect.width - 10;
        }
        
        if (top + rect.height > viewportHeight) {
            top = y - rect.height - 10;
        }
        
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }
    
    hideContextMenu() {
        // No ocultar inmediatamente si hay un flag de prevención (para PDFs)
        if (this.preventMenuHide) {
            return;
        }
        
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
            this.isMenuVisible = false;
        }
        
        // Resetear flag de menú recién abierto
        this.justOpenedMenu = false;
        
        // MODIFICADO: NO limpiar el sistema de lectura aquí
        // El panel de lectura debe mantenerse independiente del menú contextual
        // Solo se limpia cuando termina la lectura o se cancela manualmente
    }
    
    forceHideContextMenu() {        
        // Limpiar cualquier menú contextual existente
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
            this.isMenuVisible = false;
        }
        
        // Buscar y eliminar cualquier menú contextual que pueda existir en el DOM
        const existingMenus = document.querySelectorAll('.contextual-menu, .context-menu, .selection-menu');
        existingMenus.forEach(menu => {
            menu.remove();
        });
    }
    
    // Acciones para texto
    readTextAloud() {
        if (!this.currentSelection) {
            console.error('[DEBUG] No hay selección para leer');
            return;
        }
        
        const text = this.currentSelection.text;        
        // 1. Crear y mostrar el panel de control
        this.createReadingControl();
        
        // 2. Configurar síntesis pero INICIAR automáticamente
        this.initializeTextReadingAndStart(text);
        
        // 3. Deseleccionar texto después de aplicar la opción
        this.clearSelection();
    }
    
    createReadingControl() {        
        // MEJORADO: Solo remover panel anterior si NO hay reproducción activa
        // Esto permite múltiples selecciones simultáneas
        if (!this.isReading && !this.isPaused) {
            this.removeReadingControl();
        } else {
            // Si hay reproducción activa, solo pausar y crear nuevo panel
            this.pauseCurrentReading();
        }
        
        const controlPanel = document.createElement('div');
        controlPanel.className = 'selection-reading-control';
        controlPanel.id = 'selectionReadingControl_' + Date.now(); // ID único
        
        controlPanel.innerHTML = `
            <button class="reading-control-button" id="readingControlBtn" 
                    title="${t('playPauseTooltip')}">
                <img src="chrome-extension://${chrome.runtime.id}/icons/audio.svg" 
                     alt="Control de lectura" class="reading-control-icon">
            </button>
            <div class="reading-control-status" id="readingStatus">Preparando...</div>
            <button class="reading-control-close" id="readingControlClose" title="${t('closeAndStopPlayback')}">
                ×
            </button>
        `;
                
        document.body.appendChild(controlPanel);        
        // Posicionar panel a la derecha de la selección
        this.positionReadingControl(controlPanel);
        
        // Configurar evento del botón
        this.setupReadingControlEvents(controlPanel);
        
        // Mostrar panel con animación
        setTimeout(() => {
            controlPanel.classList.add('visible');
        }, 10);
        
        this.readingControl = controlPanel;
    }
    
    positionReadingControl(panel) {
        if (!this.currentSelection) {
            console.error('[DEBUG] No hay selección para posicionar el panel');
            return;
        }
        
        const range = this.currentSelection.range;
        const rect = range.getBoundingClientRect();        
        // MEJORADO: Posicionar al lado derecho al final del texto/párrafo
        // Buscar el final del párrafo o línea
        const endX = rect.right + window.scrollX + 10;
        const endY = rect.bottom + window.scrollY - 10; // Al final del texto, no en el medio        
        // Verificar que no se salga de la ventana
        const maxX = window.innerWidth + window.scrollX - panel.offsetWidth - 20;
        const maxY = window.innerHeight + window.scrollY - panel.offsetHeight - 20;
        const minX = window.scrollX + 10;
        const minY = window.scrollY + 10;
        
        const finalX = Math.max(minX, Math.min(endX, maxX));
        const finalY = Math.max(minY, Math.min(endY, maxY));        
        panel.style.left = finalX + 'px';
        panel.style.top = finalY + 'px';
    }
    
    setupReadingControlEvents(panel) {
        const button = panel.querySelector('#readingControlBtn');
        const status = panel.querySelector('#readingStatus');
        const closeButton = panel.querySelector('#readingControlClose');
        
        let clickCount = 0;
        let clickTimer = null;
        
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            clickCount++;
            
            // Resetear timer si existe
            if (clickTimer) {
                clearTimeout(clickTimer);
            }
            
            // Esperar 300ms para detectar múltiples clics
            clickTimer = setTimeout(() => {
                this.handleReadingControlClick(clickCount, button, status);
                clickCount = 0;
            }, 300);
        });

        // NUEVO: Evento del botón de cierre
        if (closeButton) {
            closeButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                            
                // Parar reproducción si está activa
                this.stopReading();
                
                // Remover resaltado y panel
                this.removeTextHighlight();
                this.removeReadingControl();
                
                // Limpiar selección
                this.clearSelection();
            });
        } else {
            console.error('[DEBUG] No se encontró el botón de cierre');
        }
    }
    
    handleReadingControlClick(clickCount, button, status) {        
        switch (clickCount) {
            case 1:
                // Un clic: Start/Pause/Resume
                if (this.isReading) {
                    this.pauseReading(button, status);
                } else if (this.isPaused) {
                    this.resumeReading(button, status);
                } else {
                    // Primera vez - iniciar lectura
                    this.startReading(button, status);
                }
                break;
                
            case 2:
                // Dos clics: Reiniciar siempre
                this.restartReading(button, status);
                break;
                
            case 3:
            default:
                // Tres o más clics: También reiniciar
                this.restartReading(button, status);
                break;
        }
    }
    
    initializeTextReading(text) {
        this.readingText = text;
        this.isReading = false;
        this.isPaused = false;
        this.currentUtterance = null;        
        // Configurar síntesis de voz (asíncrono)
        this.setupTextToSpeech().then(() => {
            this.updateReadingStatus('Presiona para iniciar', 'ready');
        }).catch(error => {
            console.error('[DEBUG] Error configurando síntesis:', error);
            this.updateReadingStatus('Error config', 'ready');
        });
    }
    
    // NUEVO: Método que inicializa Y comienza automáticamente
    initializeTextReadingAndStart(text) {
        this.readingText = text;
        this.isReading = false;
        this.isPaused = false;
        this.currentUtterance = null;        
        // Configurar síntesis de voz (async)
        this.setupTextToSpeech().then(() => {
            // Iniciar automáticamente después de configurar
            setTimeout(() => {
                this.startReading();
            }, 200);
        }).catch(error => {
            console.error('[DEBUG] Error configurando síntesis:', error);
            this.updateReadingStatus('Error config', 'ready');
        });
    }
    
    // MÉTODOS PARA RESALTADO SINCRONIZADO DE PALABRAS
    
    setupWordHighlighting() {        
        // Limpiar resaltado previo si existe
        this.cleanupHighlighting();
        
        try {
            // Usar exactamente el mismo método que para leer código
            this.applyTextHighlight();
            
            if (document.getElementById('selectionTextHighlight')) {
                // Dividir el texto en palabras para el resaltado sincronizado
                this.words = this.readingText.split(/\s+/).filter(word => word.trim() !== '');
                this.currentWordIndex = -1;
                this.highlightActive = true;
                return true;
            } else {
                console.warn('[DEBUG] No se pudo aplicar resaltado de código');
                return false;
            }
            
        } catch (error) {
            console.error('[DEBUG] Error usando resaltado de código:', error);
            return false;
        }
    }
    
    updateWordHighlight(wordIndex) {
        if (!this.highlightActive || !this.words || wordIndex >= this.words.length) {
            return;
        }
        
        try {            
            // Actualizar índice
            this.currentWordIndex = wordIndex;
            
            // NO hacer scroll automático para no interrumpir al usuario
            
        } catch (error) {
            console.error('[DEBUG] Error actualizando resaltado:', error);
        }
    }
    
    // Mapear posición de carácter a índice de palabra
    getWordIndexFromCharIndex(charIndex) {
        if (!this.readingText || !this.words) {
            return -1;
        }
        
        try {
            let currentCharIndex = 0;
            
            for (let i = 0; i < this.words.length; i++) {
                const word = this.words[i];
                const wordEnd = currentCharIndex + word.length;
                
                // Si la posición del carácter está dentro de esta palabra
                if (charIndex >= currentCharIndex && charIndex < wordEnd) {
                    return i;
                }
                
                // Añadir espacio entre palabras
                currentCharIndex = wordEnd + 1;
            }
            
            // Si llegamos aquí, devolver la última palabra
            return this.words.length - 1;
            
        } catch (error) {
            console.error('[DEBUG] Error mapeando carácter a palabra:', error);
            return -1;
        }
    }
    
    finishWordHighlighting() {
        if (!this.highlightActive || !this.wordElements) {
            return;
        }
        
        try {            
            // Dar un momento para que el usuario vea que terminó, luego limpiar
            setTimeout(() => {
                this.cleanupHighlighting();
            }, 500);
            
        } catch (error) {
            console.error('[DEBUG] Error finalizando resaltado:', error);
        }
    }
    
    cleanupHighlighting() {
        try {            
            // Usar exactamente el mismo método que para leer código
            this.removeTextHighlight();
            
            // Limpiar referencias específicas del TTS
            this.highlightedElement = null;
            this.originalElementClasses = null;
            this.words = [];
            this.currentWordIndex = -1;
            this.highlightActive = false;
            this.originalSelection = null;
                        
        } catch (error) {
            console.error('[DEBUG] Error limpiando resaltado:', error);
            
            // Fallback: usar el método de limpieza original
            try {
                this.removeTextHighlight();
                this.highlightActive = false;
            } catch (fallbackError) {
                console.error('[DEBUG] Error en fallback de limpieza:', fallbackError);
            }
        }
    }
    
    async setupTextToSpeech() {
        
        // Detener cualquier síntesis anterior
        if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
            window.speechSynthesis.cancel();
        }

        this.currentUtterance = new SpeechSynthesisUtterance(this.readingText);        
        try {
            // USAR CONFIGURACIÓN CENTRALIZADA DEL REPRODUCTOR GLOBAL            
            // Verificar si AudioPlayer está disponible
            if (typeof window.AudioPlayer !== 'undefined' && window.AudioPlayer.applyGlobalVoiceConfig) {
                // Usar la configuración centralizada del reproductor global
                await window.AudioPlayer.applyGlobalVoiceConfig(this.currentUtterance);
            } else {                
                // Configuración de respaldo si AudioPlayer no está disponible
                this.currentUtterance.rate = 0.9;
                this.currentUtterance.pitch = 1.0;
                this.currentUtterance.volume = 1.0;
                
                // Detectar idioma automáticamente para respaldo
                const detectedLang = this.detectTextLanguage(this.readingText);
                this.currentUtterance.lang = detectedLang;                
                // Seleccionar voz apropiada para el idioma detectado
                await this.selectAppropriateVoice(detectedLang);
            }
            
        } catch (error) {
            console.error('[DEBUG] Error aplicando configuración global, usando valores por defecto:', error);
            
            // Valores por defecto de emergencia
            this.currentUtterance.rate = 0.9;
            this.currentUtterance.pitch = 1.0;
            this.currentUtterance.volume = 1.0;
            this.currentUtterance.lang = 'es-ES';
        }
        
        // VERIFICACIÓN FINAL: Proteger idioma de voz seleccionada manualmente
        if (this.currentUtterance._voiceManuallySelected && this.currentUtterance._originalVoiceLang) {
            const protectedLang = this.currentUtterance._originalVoiceLang;
            if (this.currentUtterance.lang !== protectedLang) {
                this.currentUtterance.lang = protectedLang;
            }
        }
        
        // Configurar eventos
        this.setupSpeechEvents();
        return Promise.resolve();
    }

    detectTextLanguage(text) {
        // Detectar idioma basado en patrones de texto
        const cleanText = text.toLowerCase().trim();
        
        // Palabras comunes en diferentes idiomas
        const languagePatterns = {
            'es-ES': [
                'el', 'la', 'de', 'que', 'y', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'del', 'las', 'los', 'una', 'como', 'pero', 'sus', 'está', 'esta', 'han', 'sido', 'más', 'muy', 'también', 'todo', 'todos', 'toda', 'todas', 'hacer', 'puede', 'poder', 'ser', 'estar', 'tener', 'año', 'años', 'día', 'días', 'tiempo', 'mundo', 'país', 'países', 'gobierno', 'persona', 'personas', 'trabajo', 'vida', 'casa', 'donde', 'cuando', 'porque', 'mientras', 'aunque', 'desde', 'hasta', 'hacia', 'entre', 'sobre', 'bajo', 'durante', 'después', 'antes', 'dentro', 'fuera', 'siempre', 'nunca', 'ahora', 'aquí', 'allí', 'así', 'bien', 'mal', 'mejor', 'peor', 'grande', 'pequeño', 'nuevo', 'viejo', 'bueno', 'malo'
            ],
            'en-US': [
                'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us'
            ],
            'fr-FR': [
                'le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir', 'que', 'pour', 'dans', 'ce', 'son', 'une', 'sur', 'avec', 'ne', 'se', 'pas', 'tout', 'plus', 'par', 'grand', 'elle', 'vous', 'ou', 'car', 'nous', 'comme', 'mais', 'si', 'leur', 'je', 'cette', 'même', 'temps', 'où', 'bien', 'ces', 'très', 'faire', 'autre', 'dont', 'ils', 'sans', 'voir', 'aux', 'aussi', 'depuis', 'encore', 'dire', 'là', 'dont', 'selon', 'alors', 'entre', 'après', 'avant', 'jusqu', 'contre', 'sous', 'pendant', 'vers', 'chez'
            ],
            'pt-BR': [
                'o', 'de', 'e', 'do', 'a', 'em', 'para', 'é', 'com', 'um', 'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'à', 'seu', 'sua', 'ou', 'ser', 'quando', 'muito', 'há', 'nos', 'já', 'está', 'eu', 'também', 'só', 'pelo', 'pela', 'até', 'isso', 'ela', 'entre', 'era', 'depois', 'sem', 'mesmo', 'aos', 'ter', 'seus', 'suas', 'numa', 'pelos', 'pelas', 'esse', 'eles', 'estão', 'você', 'tinha', 'foram', 'essa', 'num', 'nem', 'suas', 'meu', 'às', 'minha', 'têm', 'numa', 'pelos', 'pelas'
            ],
            'it-IT': [
                'di', 'a', 'da', 'in', 'del', 'che', 'e', 'la', 'il', 'per', 'una', 'è', 'con', 'non', 'si', 'suo', 'lo', 'le', 'alla', 'dei', 'al', 'dalle', 'delle', 'della', 'dell', 'nella', 'nel', 'dalla', 'dal', 'agli', 'alle', 'negli', 'nelle', 'come', 'più', 'anche', 'tutto', 'tutti', 'questa', 'questo', 'quella', 'quello', 'sono', 'essere', 'avere', 'fare', 'dire', 'andare', 'vedere', 'sapere', 'dare', 'stare', 'volere', 'dovere', 'potere', 'tempo', 'anno', 'giorno', 'casa', 'mondo', 'vita', 'uomo', 'stato', 'parte', 'modo', 'lavoro', 'paese', 'governo', 'persona', 'cosa', 'ora', 'volta', 'posto'
            ],
            'de-DE': [
                'der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im', 'dem', 'nicht', 'ein', 'eine', 'als', 'auch', 'es', 'an', 'werden', 'aus', 'er', 'hat', 'dass', 'sie', 'nach', 'wird', 'bei', 'einer', 'um', 'am', 'sind', 'noch', 'wie', 'einem', 'über', 'einen', 'so', 'zum', 'war', 'haben', 'nur', 'oder', 'aber', 'vor', 'zur', 'bis', 'mehr', 'durch', 'man', 'sein', 'wurde', 'sei', 'in', 'ich', 'du', 'er', 'wir', 'ihr', 'sie', 'mein', 'dein', 'sein', 'unser', 'euer', 'ihr', 'kein', 'alle', 'viel', 'wenig', 'gut', 'schlecht', 'groß', 'klein', 'neu', 'alt'
            ]
        };

        // Contar coincidencias para cada idioma
        const scores = {};
        for (const [lang, words] of Object.entries(languagePatterns)) {
            scores[lang] = 0;
            words.forEach(word => {
                // Buscar palabra completa (con límites de palabra)
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                const matches = cleanText.match(regex);
                if (matches) {
                    scores[lang] += matches.length;
                }
            });
        }

        // Detectar por el idioma de la página como respaldo
        const pageLang = document.documentElement.lang || 
                        document.querySelector('html')?.getAttribute('lang') || 
                        navigator.language || 'es-ES';
        
        // Encontrar el idioma con mayor puntuación
        let bestLang = pageLang;
        let maxScore = 0;
        
        for (const [lang, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                bestLang = lang;
            }
        }

        // Si no hay coincidencias suficientes, usar el idioma de la página
        if (maxScore < 3) {
            // Mapear códigos de idioma comunes
            const langMap = {
                'es': 'es-ES',
                'en': 'en-US', 
                'fr': 'fr-FR',
                'pt': 'pt-BR',
                'it': 'it-IT',
                'de': 'de-DE'
            };
            bestLang = langMap[pageLang.split('-')[0]] || pageLang;
        }

        return bestLang;
    }

    async selectAppropriateVoice(targetLang) {
        // Asegurar que las voces estén cargadas
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) {
            await this.ensureVoicesLoaded();
        }
        
        const availableVoices = window.speechSynthesis.getVoices();        
        // Buscar voz exacta para el idioma
        let selectedVoice = availableVoices.find(voice => 
            voice.lang === targetLang
        );
        
        // Si no encuentra exacta, buscar por código de idioma base
        if (!selectedVoice) {
            const baseLang = targetLang.split('-')[0];
            selectedVoice = availableVoices.find(voice => 
                voice.lang.startsWith(baseLang)
            );
        }
        
        // Respaldos por idioma común
        if (!selectedVoice) {
            const fallbackMap = {
                'es': ['es-ES', 'es-MX', 'es-AR', 'es'],
                'en': ['en-US', 'en-GB', 'en'],
                'fr': ['fr-FR', 'fr-CA', 'fr'],
                'pt': ['pt-BR', 'pt-PT', 'pt'],
                'it': ['it-IT', 'it'],
                'de': ['de-DE', 'de']
            };
            
            const baseLang = targetLang.split('-')[0];
            const fallbacks = fallbackMap[baseLang] || [];
            
            for (const fallback of fallbacks) {
                selectedVoice = availableVoices.find(voice => 
                    voice.lang.startsWith(fallback)
                );
                if (selectedVoice) break;
            }
        }
        
        if (selectedVoice) {
            this.currentUtterance.voice = selectedVoice;
        } else {
            // Intentar asignar al menos la primera voz disponible
            if (availableVoices.length > 0) {
                this.currentUtterance.voice = availableVoices[0];
            }
        }
    }

    async ensureVoicesLoaded() {
        return new Promise((resolve) => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                resolve();
            } else {
                const loadVoices = () => {
                    const newVoices = window.speechSynthesis.getVoices();
                    if (newVoices.length > 0) {
                        window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
                        resolve();
                    }
                };
                
                window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
                
                // Timeout de seguridad
                setTimeout(() => {
                    window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
                    resolve();
                }, 2000);
            }
        });
    }

    setFallbackVoice(voices) {
        if (voices.length > 0) {
            // Buscar voz en español como alternativa
            const spanishVoice = voices.find(voice => 
                voice.lang.includes('es') || voice.lang.includes('ES')
            );
            
            if (spanishVoice) {
                this.currentUtterance.voice = spanishVoice;
            } else {
                // Buscar cualquier voz en inglés como segunda opción
                const englishVoice = voices.find(voice => 
                    voice.lang.includes('en') || voice.lang.includes('EN')
                );
                
                if (englishVoice) {
                    this.currentUtterance.voice = englishVoice;
                } else {
                    this.currentUtterance.voice = voices[0];
                }
            }
        }
    }

    setupSpeechEvents() {
        // Eventos de la síntesis
        this.currentUtterance.onstart = () => {
            this.isReading = true;
            this.isPaused = false;
            this.updateReadingStatus('Reproduciendo', 'reading');
        };
        
        this.currentUtterance.onend = () => {
            this.isReading = false;
            this.isPaused = false;
            this.updateReadingStatus('Finalizado', 'completed');
            
            // Finalizar resaltado de palabras
            this.finishWordHighlighting();
            
            // Remover resaltado y deseleccionar
            this.removeTextHighlight();
            this.clearSelection();
            
            // Ocultar panel después de 1 segundo
            setTimeout(() => {
                this.removeReadingControl();
            }, 1000);
        };
        
        // Evento para sincronización de palabras
        this.currentUtterance.onboundary = (event) => {
            if (event.name === 'word') {
                const wordIndex = this.getWordIndexFromCharIndex(event.charIndex);
                if (wordIndex >= 0) {
                    this.updateWordHighlight(wordIndex);
                }
            }
        };
        
        this.currentUtterance.onerror = (event) => {
            console.error('[DEBUG] Error en síntesis:', event);
            console.error('[DEBUG] Error details:', {
                error: event.error,
                type: event.type,
                timeStamp: event.timeStamp,
                charIndex: event.charIndex,
                name: event.name
            });
            
            this.isReading = false;
            this.isPaused = false;
            
            // Limpiar resaltado de palabras en caso de error
            this.cleanupHighlighting();
            
            // NO cambiar a estado 'error' para evitar el color rojo
            this.updateReadingStatus('Listo', 'ready');
        };
        
        this.currentUtterance.onpause = () => {
            this.isReading = false;
            this.isPaused = true;
            this.updateReadingStatus('Pausado', 'paused');
        };
        
        this.currentUtterance.onresume = () => {
            this.isReading = true;
            this.isPaused = false;
            this.updateReadingStatus('Reproduciendo', 'reading');
        };
    }
    
    startReading(button = null, status = null) {        
        if (!this.currentUtterance) {
            console.error('[DEBUG] No hay utterance para reproducir');
            this.updateReadingStatus('No config', 'ready');
            return;
        }

        // Verificar si las voces están disponibles
        const voices = window.speechSynthesis.getVoices();        
        // Si no hay voces, intentar cargarlas con timeout corto
        if (voices.length === 0) {            
            let voicesLoaded = false;
            
            const loadHandler = () => {
                if (!voicesLoaded) {
                    voicesLoaded = true;
                    this.doStartReading();
                }
            };
            
            window.speechSynthesis.addEventListener('voiceschanged', loadHandler, { once: true });
            
            // Timeout corto - si no se cargan las voces en 500ms, continuar sin ellas
            setTimeout(() => {
                if (!voicesLoaded) {
                    voicesLoaded = true;
                    window.speechSynthesis.removeEventListener('voiceschanged', loadHandler);
                    this.doStartReading();
                }
            }, 500);
            
        } else {
            // Las voces ya están disponibles, iniciar inmediatamente
            this.doStartReading();
        }
    }

    doStartReading() {
        if (this.currentUtterance) {
            // Cancelar cualquier reproducción anterior
            if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
                window.speechSynthesis.cancel();
            }            
            // Actualizar estado a "Iniciando..." brevemente
            this.updateReadingStatus('Iniciando...', 'reading');
            
            // Cambiar a "Reproduciendo" después de un momento corto
            setTimeout(() => {
                if (this.isReading || window.speechSynthesis.speaking) {
                    this.updateReadingStatus('Reproduciendo', 'reading');
                }
            }, 200);
            
            // Iniciar síntesis
            window.speechSynthesis.speak(this.currentUtterance);
        }
    }
    
    pauseReading(button, status) {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
            window.speechSynthesis.pause();
            this.isPaused = true;
            this.isReading = false;
            this.updateReadingStatus('Pausado', 'paused');
        }
    }

    resumeReading(button, status) {        
        // LÓGICA MEJORADA PARA VOCES DE GOOGLE (igual que reproductor global)
        if (window.speechSynthesis.paused) {
            // Si está pausado, siempre intentar resume primero (funciona para todas las voces incluyendo Google)
            window.speechSynthesis.resume();
            this.isPaused = false;
            this.isReading = true;
            this.updateReadingStatus('Reproduciendo', 'reading');
            
            // Verificar después de un momento si el resume funcionó
            setTimeout(() => {
                if (!window.speechSynthesis.speaking && window.speechSynthesis.paused) {
                    // Si el resume falló, reiniciar como último recurso
                    this.isReading = false;
                    this.isPaused = false;
                    window.speechSynthesis.cancel();
                    this.doStartReading();
                }
            }, 200);
        } else if (!window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
            // Solo reiniciar si no hay síntesis activa Y no está pausado
            this.isPaused = false;
            this.isReading = false;
            window.speechSynthesis.cancel();
            this.doStartReading();
        } else {
            // Otros casos: hay speaking pero no paused (estado raro)
            window.speechSynthesis.resume();
            this.isPaused = false;
            this.isReading = true;
            this.updateReadingStatus('Reproduciendo', 'reading');
        }
        
    }    stopReading() {
        
        // Parar síntesis de voz
        if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
            window.speechSynthesis.cancel();
        }
        
        // Resetear estado
        this.isReading = false;
        this.isPaused = false;
        this.currentUtterance = null;
        this.readingText = '';
    }

    pauseCurrentReading() {        
        // Solo pausar si está reproduciendo
        if (this.isReading && window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            this.isPaused = true;
            this.isReading = false;
        }
    }
    
    restartReading(button, status) {        
        // Mostrar estado de reinicio PRIMERO
        this.updateReadingStatus('Reinicio', 'reading');
        
        // Detener síntesis actual
        window.speechSynthesis.cancel();
        
        // Esperar un momento para que se vea el mensaje
        setTimeout(() => {
            // Reinicializar y empezar de nuevo (async)
            this.setupTextToSpeech().then(() => {
                this.startReading(button, status);
            }).catch(error => {
                console.error('[DEBUG] Error reiniciando:', error);
                this.updateReadingStatus('Error', 'ready');
            });
        }, 300);
    }
    
    updateReadingStatus(text, state) {
        // CORREGIDO: Buscar en el panel actual de lectura, no por ID específico
        const currentPanel = this.readingControl || document.querySelector('.selection-reading-control.visible');
        if (!currentPanel) {
            console.warn('[DEBUG] No se encontró panel de control activo');
            return;
        }
        
        const status = currentPanel.querySelector('.reading-control-status');
        const button = currentPanel.querySelector('.reading-control-button');
        
        if (status) {
            status.textContent = text;
        }
        
        if (button) {
            // Remover clases de estado anteriores
            button.classList.remove('ready', 'reading', 'paused', 'completed', 'error');
            
            // Agregar nueva clase de estado
            if (state) {
                button.classList.add(state);
            }
        }
    }
    
    applyTextHighlight() {
        if (!this.currentSelection) {
            console.warn('[DEBUG] No hay selección para resaltar');
            return;
        }
        
        // Remover resaltado previo si existe
        this.removeTextHighlight();
        
        try {
            const range = this.currentSelection.range;            
            // Verificar que el range tenga contenido
            if (range.collapsed) {
                console.warn('[DEBUG] Range está colapsado, no se puede resaltar');
                return;
            }
            
            // MÉTODO MEJORADO: Extraer y envolver
            const contents = range.extractContents();
            const span = document.createElement('span');
            span.className = 'selection-text-highlight reading';
            span.id = 'selectionTextHighlight';
            span.appendChild(contents);
            
            // Insertar el span resaltado
            range.insertNode(span);            
            // Actualizar la selección para mantener el rango
            const selection = window.getSelection();
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            selection.addRange(newRange);
            
        } catch (error) {
            console.warn('[DEBUG] Error al aplicar resaltado, usando método alternativo:', error);
            this.applyAlternativeHighlight();
        }
    }
    
    applyAlternativeHighlight() {
        // Método alternativo si surroundContents falla
        if (!this.currentSelection) return;
        
        const range = this.currentSelection.range;
        const container = range.commonAncestorContainer;
        
        if (container.nodeType === Node.TEXT_NODE) {
            const parent = container.parentElement;
            if (parent) {
                parent.classList.add('selection-text-highlight', 'reading');
                parent.id = 'selectionTextHighlight';
            }
        } else if (container.nodeType === Node.ELEMENT_NODE) {
            container.classList.add('selection-text-highlight', 'reading');
            container.id = 'selectionTextHighlight';
        }
    }
    
    removeTextHighlight() {
        const highlighted = document.getElementById('selectionTextHighlight');
        if (highlighted) {
            if (highlighted.tagName === 'SPAN' && highlighted.className.includes('selection-text-highlight')) {
                // Si es un span que creamos, desenvolverlo
                const parent = highlighted.parentNode;
                while (highlighted.firstChild) {
                    parent.insertBefore(highlighted.firstChild, highlighted);
                }
                parent.removeChild(highlighted);
            } else {
                // Si es un elemento existente, solo remover clases
                highlighted.classList.remove('selection-text-highlight', 'reading');
                highlighted.removeAttribute('id');
            }
        }
    }
    
    removeReadingControl() {
        // CORREGIDO: Buscar todos los paneles de control activos
        const existingPanels = document.querySelectorAll('.selection-reading-control');
        
        existingPanels.forEach(panel => {
            panel.classList.add('hidden');
            setTimeout(() => {
                panel.remove();
            }, 300);
        });
        
        // Limpiar síntesis
        if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
            window.speechSynthesis.cancel();
        }
        
        // Limpiar referencia
        this.readingControl = null;
        
        // Remover resaltado
        this.removeTextHighlight();
        
        // Resetear estado
        this.isReading = false;
        this.isPaused = false;
        this.currentUtterance = null;
        this.readingControl = null;
    }
    
    // Acciones para código
    readCodeAloud() {
        if (!this.currentSelection) return;
        
        const code = this.currentSelection.text;        
        // Procesar el código para hacerlo más legible al leerlo
        const readableCode = this.makeCodeReadable(code);
        
        // Usar el mismo sistema de lectura con panel de control
        this.createReadingControl();
        this.initializeTextReading(readableCode);
        
        // Deseleccionar después de aplicar la opción
        this.clearSelection();
    }
    
    analyzeCode() {
        if (!this.currentSelection) return;
        
        const code = this.currentSelection.text;        
        // Usar el modal existente de análisis de código
        this.showAnalysisModal(code);
        
        // Deseleccionar después de analizar
        this.clearSelection();
    }
    
    copyCode() {
        if (!this.currentSelection) return;
        
        const code = this.currentSelection.text;        
        const isSpanish = navigator.language.startsWith('es');
        
        navigator.clipboard.writeText(code).then(() => {
            this.showNotification(isSpanish ? 'Código copiado al portapapeles' : 'Code copied to clipboard', 'success');
            // Deseleccionar después de copiar
            this.clearSelection();
        }).catch(err => {
            console.error('Error copiando código:', err);
            this.showNotification(isSpanish ? 'Error al copiar código' : 'Error copying code', 'error');
            // Deseleccionar también en caso de error
            this.clearSelection();
        });
    }

    // Nueva función: Copiar texto
    copyText() {
        if (!this.currentSelection) return;
        
        const text = this.currentSelection.text;        
        const isSpanish = navigator.language.startsWith('es');
        
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification(isSpanish ? 'Texto copiado al portapapeles' : 'Text copied to clipboard', 'success');
            // Deseleccionar después de copiar
            this.clearSelection();
        }).catch(err => {
            console.error('Error copiando texto:', err);
            this.showNotification(isSpanish ? 'Error al copiar texto' : 'Error copying text', 'error');
            // Deseleccionar también en caso de error
            this.clearSelection();
        });
    }

    // Nueva función: Copiar imagen (mejorada)
    copyImage() {
        if (!this.currentSelection || !this.currentSelection.element) return;
        
        const img = this.currentSelection.element;        
        // Verificar si la imagen está completamente cargada
        if (!img.complete || img.naturalWidth === 0) {
            const isSpanish = navigator.language.startsWith('es');
            this.showNotification(isSpanish ? 'Esperando a que la imagen se cargue...' : 'Waiting for image to load...', 'info');
            img.onload = () => this.copyImageToClipboard(img);
            img.onerror = () => this.copyImageFallback(img);
            return;
        }
        
        this.copyImageToClipboard(img);
    }
    
    // Función auxiliar para copiar imagen al portapapeles
    copyImageToClipboard(img) {
        try {
            // Crear una imagen temporal para evitar problemas de CORS
            const tempImg = new Image();
            tempImg.crossOrigin = 'anonymous';
            
            tempImg.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Configurar el canvas con las dimensiones de la imagen
                    canvas.width = tempImg.naturalWidth || tempImg.width;
                    canvas.height = tempImg.naturalHeight || tempImg.height;
                    
                    // Dibujar la imagen en el canvas
                    ctx.drawImage(tempImg, 0, 0);
                    
                    // Convertir el canvas a blob y copiarlo
                    canvas.toBlob(blob => {
                        if (blob) {
                            const isSpanish = navigator.language.startsWith('es');
                            navigator.clipboard.write([
                                new ClipboardItem({ 'image/png': blob })
                            ]).then(() => {
                                this.showNotification(isSpanish ? 'Imagen copiada al portapapeles' : 'Image copied to clipboard', 'success');
                                this.clearSelection();
                            }).catch(err => {
                                console.error('Error copiando imagen como blob:', err);
                                this.copyImageFallback(img);
                            });
                        } else {
                            this.copyImageFallback(img);
                        }
                    }, 'image/png');
                    
                } catch (canvasError) {
                    console.error('Error con canvas:', canvasError);
                    this.copyImageFallback(img);
                }
            };
            
            tempImg.onerror = () => {
                console.error('Error cargando imagen temporal');
                this.copyImageFallback(img);
            };
            
            // Cargar la imagen
            tempImg.src = img.src;
            
        } catch (error) {
            console.error('Error procesando imagen para copiar:', error);
            this.copyImageFallback(img);
        }
    }
    
    // Función auxiliar para copiar imagen (fallback)
    copyImageFallback(img) {
        // Fallback: copiar la URL de la imagen
        const isSpanish = navigator.language.startsWith('es');
        navigator.clipboard.writeText(img.src).then(() => {
            this.showNotification(isSpanish ? 'URL de la imagen copiada al portapapeles' : 'Image URL copied to clipboard', 'success');
            this.clearSelection();
        }).catch(err => {
            console.error('Error copiando URL de imagen:', err);
            this.showNotification(isSpanish ? 'Error al copiar la imagen' : 'Error copying image', 'error');
            this.clearSelection();
        });
    }
    
    // Nueva función: Consultar imagen con Google Lens
    searchImageInGoogle() {
        if (!this.currentSelection || !this.currentSelection.element) return;
        
        const img = this.currentSelection.element;        
        // Limpiar selección visual y menú
        this.forceHideContextMenu();
        this.clearVisualSelection();
        
        try {
            // Obtener la URL de la imagen
            let imageUrl = img.src;
            
            // Si es una URL relativa, convertirla a absoluta
            if (imageUrl.startsWith('/') || imageUrl.startsWith('./') || imageUrl.startsWith('../')) {
                imageUrl = new URL(imageUrl, window.location.href).href;
            }
            
            // Codificar la URL para Google Lens
            const encodedImageUrl = encodeURIComponent(imageUrl);
            
            // URL de Google Lens para buscar por imagen
            const googleLensUrl = `https://lens.google.com/uploadbyurl?url=${encodedImageUrl}`;
            
            // Abrir en nueva pestaña
            window.open(googleLensUrl, '_blank', 'noopener,noreferrer');
            
            const isSpanish = navigator.language.startsWith('es');
            this.showNotification(isSpanish ? 'Abriendo imagen en Google Lens...' : 'Opening image in Google Lens...', 'success');
            this.clearSelection();
            
        } catch (error) {
            console.error('Error consultando imagen:', error);
            
            // Fallback: usar Google Images
            try {
                const isSpanish = navigator.language.startsWith('es');
                const imageUrl = new URL(img.src, window.location.href).href;
                const encodedImageUrl = encodeURIComponent(imageUrl);
                const googleImagesUrl = `https://www.google.com/searchbyimage?image_url=${encodedImageUrl}`;
                
                window.open(googleImagesUrl, '_blank', 'noopener,noreferrer');
                this.showNotification(isSpanish ? 'Abriendo búsqueda de imagen en Google...' : 'Opening image search in Google...', 'success');
                this.clearSelection();
                
            } catch (fallbackError) {
                const isSpanish = navigator.language.startsWith('es');
                console.error('Error en fallback de búsqueda de imagen:', fallbackError);
                this.showNotification(isSpanish ? 'Error al consultar la imagen' : 'Error querying image', 'error');
                this.clearSelection();
            }
        }
    }

    // Nueva función: Buscar en web (detecta buscador automáticamente)
    searchInGoogle() {
        if (!this.currentSelection) return;
        
        const searchText = this.currentSelection.text.trim();        
        if (searchText) {
            // Codificar el texto para URL
            const encodedSearch = encodeURIComponent(searchText);
            
            // Detectar el buscador preferido basándose en la URL actual o usar Google como fallback
            const searchUrl = this.getPreferredSearchEngine(encodedSearch);
            
            // Abrir nueva pestaña con la búsqueda (con mejores prácticas de seguridad)
            window.open(searchUrl, '_blank', 'noopener,noreferrer');
            
            const isSpanish = navigator.language.startsWith('es');
            this.showNotification(isSpanish ? 'Abriendo búsqueda en la web...' : 'Opening web search...', 'success');
            // Deseleccionar después de buscar
            this.clearSelection();
        } else {
            const isSpanish = navigator.language.startsWith('es');
            this.showNotification(isSpanish ? 'No hay texto seleccionado para buscar' : 'No text selected to search', 'error');
        }
    }

    // Detectar buscador preferido
    getPreferredSearchEngine(encodedSearch) {
        const currentUrl = window.location.href.toLowerCase();
        
        // Detectar buscador basándose en la URL actual
        if (currentUrl.includes('bing.com')) {
            return `https://www.bing.com/search?q=${encodedSearch}`;
        } else if (currentUrl.includes('duckduckgo.com')) {
            return `https://duckduckgo.com/?q=${encodedSearch}`;
        } else if (currentUrl.includes('yahoo.com')) {
            return `https://search.yahoo.com/search?p=${encodedSearch}`;
        } else if (currentUrl.includes('baidu.com')) {
            return `https://www.baidu.com/s?wd=${encodedSearch}`;
        } else if (currentUrl.includes('yandex.com') || currentUrl.includes('yandex.ru')) {
            return `https://yandex.com/search/?text=${encodedSearch}`;
        } else {
            // Google como fallback (más común)
            return `https://www.google.com/search?q=${encodedSearch}`;
        }
    }

    // Análisis de código con IA
    analyzeCodeWithAI() {
        if (!this.currentSelection) return;
        
        const code = this.currentSelection.text;
        
        // PROTECCIÓN: Marcar que estamos analizando con IA
        this.isAnalyzingWithAI = true;
        
        // Deseleccionar visualmente pero mantener datos internos
        this.forceHideContextMenu();
        this.clearVisualSelection();
        
        // Mostrar notificación de que se está preparando la integración con IA
        this.showNotification(t('preparingCodeAnalysis'), 'info');
        
        // Usar el modal con integración completa
        this.showAnalysisModal(code, 'code-ai');
        
        // NO limpiar currentSelection - se necesita para las consultas
    }

    // Análisis de imagen con IA  
    analyzeImageWithAI() {
        if (!this.currentSelection) return;        
        // PROTEGER la selección durante el análisis de IA
        this.isAnalyzingWithAI = true;        
        // Buscar imágenes en la selección
        const range = this.currentSelection.range;
        const fragment = range.cloneContents();
        const images = fragment.querySelectorAll('img');
        
        if (images.length > 0) {
            const firstImage = images[0];            
            // Mostrar notificación de que se está preparando la integración con IA
            this.showNotification(t('preparingImageAnalysis'), 'info');
            
            // Por ahora usar la función existente con indicación de futura integración
            this.describeImageWithAI(firstImage, 'ai-enhanced');
        } else {
            this.showNotification(t('noImagesFoundInSelection'), 'error');
        }
        
        // NO llamar clearSelection() aquí - lo haremos después del análisis
    }

    // Acciones para imágenes
    describeImage() {
        if (!this.currentSelection) return;
        
        // Limpiar selección visual y menú inmediatamente
        this.forceHideContextMenu();
        this.clearVisualSelection();
        
        // Buscar imágenes en la selección
        const range = this.currentSelection.range;
        const fragment = range.cloneContents();
        const images = fragment.querySelectorAll('img');
        
        if (images.length > 0) {
            const firstImage = images[0];            
            // Usar la lógica existente de descripción de imagen
            this.describeImageWithAI(firstImage);
        }
    }
    
    consultImage() {
        if (!this.currentSelection) return;
        
        // Buscar imágenes en la selección
        const range = this.currentSelection.range;
        const fragment = range.cloneContents();
        const images = fragment.querySelectorAll('img');
        
        if (images.length > 0) {
            const firstImage = images[0];            
            // Usar el modal existente de consulta de imagen
            // (showImageConsultModal ya maneja la deselección visual)
            this.showImageConsultModal(firstImage);
        }
    }

    // Nuevo método para enviar contenido al reproductor global
    sendToGlobalPlayer() {
        if (!this.currentSelection) return;
        
        const selectedText = this.currentSelection.text;        
        // Acceder al reproductor global a través de la instancia global
        const globalPlayer = window.audioPlayerInstance || document.audioPlayerInstance;
        
        if (globalPlayer && globalPlayer.jumpToTextContent) {
            // Obtener la posición de la selección para resaltar
            const range = this.currentSelection.range;
            const startElement = range.startContainer.nodeType === Node.TEXT_NODE 
                ? range.startContainer.parentElement 
                : range.startContainer;
            
            // Usar método específico para saltar a contenido específico
            globalPlayer.jumpToTextContent(selectedText, startElement);
            
            this.showNotification(t('readingStartedFromSelection'), 'success');
        } else {
            console.error('[DEBUG] audioPlayerInstance no disponible, intentando crear...');
            
            // Intentar acceder directamente a la función global
            if (typeof window.initAudioPlayer === 'function') {
                window.initAudioPlayer().then(() => {
                    setTimeout(() => this.sendToGlobalPlayer(), 500);
                });
            } else {
                this.showNotification(t('globalPlayerError'), 'error');
            }
        }
        
        // Deseleccionar después de enviar
        this.clearSelection();
    }
    
    // Método para forzar detección de PDF (para debugging)
    forcePDFDetection() {
        this.isPDFViewer = true;
        this.setupPDFListeners();
        this.showNotification('📄 ' + t('pdfModeActivatedManually'), 'info');
    }
    
    // MÉTODOS ESPECÍFICOS PARA PDFs
    
    readPDFTextAloud() {
        if (!this.currentSelection) {
            console.error('📄 [PDF] No hay selección para leer');
            return;
        }
        
        const text = this.currentSelection.text;        
        // Usar el mismo sistema que readTextAloud pero con limpieza específica para PDF
        this.readTextAloud();
    }
    
    sendPDFToGlobalPlayer() {
        if (!this.currentSelection) return;
        
        const selectedText = this.currentSelection.text;        
        // Usar la misma lógica que sendToGlobalPlayer
        this.sendToGlobalPlayer();
    }
    
    explainPDFContent() {
        if (!this.currentSelection) return;
        
        const selectedText = this.currentSelection.text;        
        // Preparar prompt específico para PDFs
        const pdfPrompt = `Este texto proviene de un documento PDF. Por favor explica su contenido de manera clara y educativa:\n\n"${selectedText}"`;
        
        // Usar el mismo sistema de IA pero con contexto específico para PDF
        this.askGeminiAboutSelection(pdfPrompt);
    }
    readPDFTextAloud() {
        // TEMPORALMENTE DESHABILITADO - Funcionalidad PDF en desarrollo
        const isSpanish = navigator.language.startsWith('es');
        const msg = isSpanish 
            ? ' Funcionalidad PDF en desarrollo'
            : ' PDF feature in development';
        this.showNotification(msg, 'info');
        return;
        
        /* DESHABILITADO
        if (!this.currentSelection) {
            console.error('📄 No hay selección PDF para leer');
            return;
        }
        
        const text = this.currentSelection.text;
        
        // Usar el mismo sistema de control pero con limpieza específica para PDF
        this.createReadingControl();
        
        // Limpiar y leer texto de PDF
        const cleanedText = this.cleanTextForSpeech(text);
        this.initializeTextReadingAndStart(cleanedText);
        
        this.clearSelection();
        this.showNotification('📄 ' + t('readingPdfContent'), 'success');
        */
    }
    
    sendPDFToGlobalPlayer() {
        // TEMPORALMENTE DESHABILITADO - Funcionalidad PDF en desarrollo
        const isSpanish = navigator.language.startsWith('es');
        const msg = isSpanish 
            ? 'Funcionalidad PDF en desarrollo'
            : 'PDF feature in development';
        this.showNotification(msg, 'info');
        return;
        
        /* DESHABILITADO
        if (!this.currentSelection) return;
        
        const selectedText = this.currentSelection.text;
        const cleanedText = this.cleanTextForSpeech(selectedText);
        
        
        const globalPlayer = window.audioPlayerInstance || document.audioPlayerInstance;
        
        if (globalPlayer && globalPlayer.jumpToTextContent) {
            // Para PDFs, crear un contenedor temporal para el texto limpiado
            const tempContainer = document.createElement('div');
            tempContainer.textContent = cleanedText;
            tempContainer.style.display = 'none';
            document.body.appendChild(tempContainer);
            
            globalPlayer.jumpToTextContent(cleanedText, tempContainer);
            
            // Limpiar después de un momento
            setTimeout(() => {
                if (tempContainer.parentNode) {
                    tempContainer.parentNode.removeChild(tempContainer);
                }
            }, 1000);
            
            this.showNotification('📄 ' + t('pdfPlaybackStartedFromSelection'), 'success');
        } else {
            console.error('📄 Reproductor global no disponible para PDF');
            this.showNotification(t('playerNotAvailable'), 'error');
        }
        
        this.clearSelection();
        */
    }
    
    explainPDFContent() {
        // TEMPORALMENTE DESHABILITADO - Funcionalidad PDF en desarrollo
        const isSpanish = navigator.language.startsWith('es');
        const msg = isSpanish 
            ? 'Funcionalidad PDF en desarrollo'
            : 'PDF feature in development';
        this.showNotification(msg, 'info');
        return;
        
        /* DESHABILITADO
        if (!this.currentSelection) return;
        
        const text = this.currentSelection.text;
        const cleanedText = this.cleanTextForSpeech(text);
        
        
        // Crear prompt específico para contenido de PDF
        const pdfPrompt = `Este texto viene de un documento PDF. Por favor, explica de manera clara y concisa el siguiente contenido:\n\n"${cleanedText}"\n\nProporciona un resumen comprensible y destaca los puntos más importantes.`;
        
        // Usar el sistema existente de IA pero con contexto de PDF
        this.processWithAI(pdfPrompt, 'explain')
            .then(explanation => {
                this.showNotification('📄 ' + t('pdfContentExplanationReady'), 'success');
                
                // Reproducir la explicación
                if (explanation) {
                    this.speakText(explanation);
                }
            })
            .catch(error => {
                console.error('📄 Error explicando contenido PDF:', error);
                this.showNotification(t('errorExplainingPdfContent'), 'error');
            });
        
        this.clearSelection();
        */
    }
    
    // Métodos auxiliares (reutilizando lógica existente)
    makeCodeReadable(code) {
        // Simplificar código para lectura en voz alta
        return code
            .replace(/\{/g, ' abre llave ')
            .replace(/\}/g, ' cierra llave ')
            .replace(/\[/g, ' abre corchete ')
            .replace(/\]/g, ' cierra corchete ')
            .replace(/\(/g, ' abre paréntesis ')
            .replace(/\)/g, ' cierra paréntesis ')
            .replace(/;/g, ' punto y coma ')
            .replace(/=/g, ' igual ')
            .replace(/==/g, ' igual igual ')
            .replace(/!=/g, ' no igual ')
            .replace(/</g, ' menor que ')
            .replace(/>/g, ' mayor que ')
            .replace(/\+/g, ' más ')
            .replace(/-/g, ' menos ')
            .replace(/\*/g, ' por ')
            .replace(/\//g, ' dividido ')
            .replace(/\./g, ' punto ');
    }
    
    speakText(text) {
        // Detener cualquier síntesis anterior
        speechSynthesis.cancel();
        
        if (text) {
            // Límite de caracteres para evitar bloqueos (máximo 5000 caracteres)
            const MAX_CHARS = 5000;
            let textToSpeak = text;
            
            if (text.length > MAX_CHARS) {
                const isSpanish = navigator.language.startsWith('es');
                console.warn('[Speech] Text too long, truncating to', MAX_CHARS, 'characters');
                textToSpeak = text.substring(0, MAX_CHARS);
                
                // Notificar al usuario
                const warningMsg = isSpanish ? 
                    `El texto es muy largo (${text.length} caracteres). Se leerán los primeros ${MAX_CHARS} caracteres.` :
                    `Text is too long (${text.length} characters). Reading first ${MAX_CHARS} characters.`;
                this.showNotification(warningMsg, 'warning');
            }
            
            // Limpiar texto para PDFs si es necesario
            const cleanedText = this.cleanTextForSpeech(textToSpeak);            
            const utterance = new SpeechSynthesisUtterance(cleanedText);
            
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
                    
                    // Detectar idioma y seleccionar voz apropiada
                    const detectedLang = this.detectTextLanguage(textToSpeak);
                    utterance.lang = detectedLang;
                    this.selectAppropriateVoice(detectedLang, utterance);
                }
                
            } catch (error) {
                console.error('[DEBUG] Error aplicando configuración global para speakText:', error);
                
                // Valores por defecto de emergencia
                utterance.rate = 0.9;
                utterance.pitch = 1.0;
                utterance.volume = 0.8;
                utterance.lang = 'es-ES';
            }
            
            // Timeout para prevenir bloqueos prolongados
            const speechTimeout = setTimeout(() => {
                if (speechSynthesis.speaking) {
                    console.warn('[Speech] Timeout reached, canceling speech');
                    speechSynthesis.cancel();
                }
            }, 60000); // 60 segundos máximo
            
            utterance.onend = () => {
                clearTimeout(speechTimeout);
            };
            
            utterance.onerror = (error) => {
                clearTimeout(speechTimeout);
                console.error('[Speech] Error:', error);
            };
            
            speechSynthesis.speak(utterance);
        }
    }
    
    cleanTextForSpeech(text) {
        if (!text) return '';
        
        // Límite de seguridad para evitar procesar textos extremadamente largos
        const MAX_LENGTH = 10000;
        let cleanedText = text.length > MAX_LENGTH ? text.substring(0, MAX_LENGTH) : text;
        
        try {
            // Limpieza específica para PDFs
            if (this.isPDFViewer) {                
                // Eliminar caracteres especiales de PDFs
                cleanedText = cleanedText.replace(/[\u00A0\u2000-\u200B\u2028\u2029]/g, ' ');
                
                // Eliminar saltos de línea innecesarios (común en PDFs)
                cleanedText = cleanedText.replace(/\n+/g, ' ');
                
                // Eliminar guiones de división de palabras al final de línea
                cleanedText = cleanedText.replace(/(\w)-\s+(\w)/g, '$1$2');
                
                // Eliminar espacios múltiples
                cleanedText = cleanedText.replace(/\s+/g, ' ');
                
                // Eliminar caracteres de control y caracteres no imprimibles
                cleanedText = cleanedText.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
                
                // Limpiar referencias numéricas sueltas (común en PDFs académicos)
                cleanedText = cleanedText.replace(/\b\d+\b(?=\s|$)/g, '');
                
                // Mejorar puntuación para mejor pronunciación
                cleanedText = cleanedText.replace(/([.!?])\s*([A-Z])/g, '$1 $2');
                
                // Reemplazar múltiples puntos por pausa
                cleanedText = cleanedText.replace(/\.{2,}/g, '. ');
        }
            
            // Limpieza general
            cleanedText = cleanedText.trim();
            
            return cleanedText;
            
        } catch (error) {
            console.error('[CleanText] Error cleaning text:', error);
            // En caso de error, devolver texto original truncado
            return text.length > MAX_LENGTH ? text.substring(0, MAX_LENGTH) : text;
        }
    }
    
    detectPageLanguage() {
        return document.documentElement.lang || 
               document.querySelector('meta[http-equiv="content-language"]')?.content || 
               'es-ES';
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `selection-notification selection-notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
    
    // Integración con modales existentes
    showAnalysisModal(code, analysisType = 'standard') {        
        const isSpanish = navigator.language.startsWith('es');
        let title = t('codeAnalysisTitle');
        let aiIndicator = '';
        
        if (analysisType === 'code-ai') {
            title = isSpanish ? 'Análisis de código con IA' : 'Code Analysis with AI';
            aiIndicator = '';
        }
        
        const modal = this.createModal(title, aiIndicator, 'code');
        
        // Configurar el código en el preview del modal
        const codePreview = modal.querySelector('.consulted-code pre');
        if (codePreview) {
            // Usar el código de la selección actual, si no hay usar el parámetro o código de prueba
            const codeToShow = this.currentSelection?.text || code || this.getSampleCode();
            codePreview.textContent = codeToShow;
        }
        
        document.body.appendChild(modal);
    }
    
    describeImageWithAI(image, analysisType = 'standard') {        
        if (analysisType === 'ai-enhanced') {
            // Mostrar modal especializado para IA
            this.showImageAIModal(image);
            return;
        }
        
        // Usar alt text si está disponible
        const altText = image.alt;
        if (altText && altText.trim().length > 0) {
            const description = `Esta imagen tiene la descripción: ${altText}`;
            this.speakText(description);
            return;
        }
        
        // Si no hay alt text, usar descripción genérica
        const description = "Esta imagen no tiene descripción alternativa. Para obtener una descripción detallada, usa la opción de consulta con IA.";
        this.speakText(description);
    }

    // Modal especializado para análisis de imagen con IA
    showImageAIModal(image) {
        // DESELECCIONAR visualmente la imagen pero mantener datos internos
        this.forceHideContextMenu();
        this.clearVisualSelection();
        
        const isSpanish = navigator.language.startsWith('es');
        const aiIndicator = '<div class="ai-integration-notice"><strong>Próximamente:</strong> Análisis visual avanzado con Gemini AI para descripción detallada, contexto, objetos detectados y análisis técnico.</div>';
        const modal = this.createModal(isSpanish ? 'Análisis de imagen con IA' : 'Image Analysis with AI', aiIndicator, 'image');
        
        // Configurar la imagen en el preview del modal
        const consultedImage = modal.querySelector('.consulted-image img');
        if (consultedImage) {
            consultedImage.src = image.src;
            consultedImage.alt = image.alt || 'Imagen analizada con IA';
        }
        
        document.body.appendChild(modal);
    }
    
    showImageConsultModal(image) {
        // DESELECCIONAR visualmente la imagen pero mantener datos internos
        this.forceHideContextMenu();
        this.clearVisualSelection();
        
        const isSpanish = navigator.language.startsWith('es');
        const modal = this.createModal(isSpanish ? 'Análisis de imagen con IA' : 'Image Analysis with AI', '', 'image');
        
        // Configurar la imagen en el preview del modal
        const consultedImage = modal.querySelector('.consulted-image img');
        if (consultedImage) {
            consultedImage.src = image.src;
            consultedImage.alt = image.alt || 'Imagen consultada';
        }
        
        // Eliminar el contenido por defecto ya que ahora usamos el preview
        const responseContent = modal.querySelector('.response-content');
        if (responseContent) {
            // El contenido ya está configurado en el nuevo diseño
        }
        
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
                                    <textarea class="query-input" placeholder="${t('writeImageQueryPlaceholder')}" rows="3"></textarea>
                                    <button class="query-submit-btn">${t('consult')}</button>
                                </div>
                            </div>
                            <div class="preset-queries">
                                <h3>${t('predefinedQueries')}</h3>
                                <div class="query-list">
                                    <button class="query-btn" data-query="${navigator.language.startsWith('es') ? 'Por favor describe esta imagen en detalle, incluyendo todos los elementos visibles, colores, composición, contexto, y cualquier texto u objetos que puedas identificar.' : 'Please describe this image in detail, including all visible elements, colors, composition, context, and any text or objects you can identify.'}">${navigator.language.startsWith('es') ? 'Describir imagen' : 'Describe Image'}</button>
                                </div>
                            </div>
                            <div class="response-area">
                                <div class="response-header" style="border-bottom: none;">
                                    <h4 class="response-title">${t('consultationResult')}</h4>
                                    <div class="response-controls">
                                        <button class="response-control-btn copy-query-btn" title="${navigator.language.startsWith('es') ? 'Copiar consulta' : 'Copy Query'}">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                            </svg>
                                        </button>
                                        <button class="response-control-btn audio-btn" title="${navigator.language.startsWith('es') ? 'Reproducir audio' : 'Play Audio'}">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div class="response-content">
                                    <div class="consultation-layout">
                                        <div class="image-preview">
                                            <div class="consulted-image">
                                                <img src="" alt="Imagen consultada">
                                            </div>
                                            <div class="image-info">
                                                <h5>${t('imageInQuery')}</h5>
                                                <p>${t('imageBeingAnalyzedByAI')}</p>
                                            </div>
                                        </div>
                                        <div class="consultation-result">
                                            <p data-placeholder="true">${t('writeQueryOrSelectPredefinedForImage')}</p>
                                        </div>
                                    </div>
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
                                    <textarea class="query-input" placeholder="${t('writeCodeQueryPlaceholder')}" rows="3"></textarea>
                                    <button class="query-submit-btn">${t('consult')}</button>
                                </div>
                            </div>
                            <div class="preset-queries">
                                <h3>${t('predefinedQueries')}</h3>
                                <div class="query-list">
                                    <button class="query-btn" data-query="${navigator.language.startsWith('es') ? 'Por favor explica qué hace este código paso a paso, incluyendo su propósito, funcionalidad, y cómo funciona cada parte.' : 'Please explain what this code does step by step, including its purpose, functionality, and how each part works.'}">${t('explainFunctionality')}</button>
                                    <button class="query-btn" data-query="${navigator.language.startsWith('es') ? 'Analiza este código para detectar posibles errores, problemas o mejoras. Proporciona sugerencias específicas para optimización y mejores prácticas.' : 'Analyze this code for potential bugs, issues, or improvements. Provide specific suggestions for optimization and best practices.'}">${t('reviewAndOptimize')}</button>
                                    <button class="query-btn" data-query="${navigator.language.startsWith('es') ? '¿Cuáles son los principales casos de uso y aplicaciones prácticas para este código? Proporciona ejemplos específicos de cómo podría ser utilizado.' : 'What are the main use cases and practical applications for this code? Provide specific examples of how it could be used.'}">${t('useCases')}</button>
                                    <button class="query-btn" data-query="${navigator.language.startsWith('es') ? 'Convierte este código para que sea más legible y agrega comentarios apropiados explicando cada sección. Mantén la misma funcionalidad.' : 'Convert this code to be more readable and add appropriate comments explaining each section. Maintain the same functionality.'}">${t('documentCode')}</button>
                                </div>
                            </div>
                            <div class="response-area">
                                <div class="response-header" style="border-bottom: none;">
                                    <h4 class="response-title">${t('consultationResult')}</h4>
                                    <div class="response-controls">
                                        <button class="response-control-btn copy-query-btn" title="${navigator.language.startsWith('es') ? 'Copiar consulta' : 'Copy Query'}">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                            </svg>
                                        </button>
                                        <button class="response-control-btn audio-btn" title="${navigator.language.startsWith('es') ? 'Reproducir audio' : 'Play Audio'}">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div class="response-content">
                                    <div class="consultation-layout">
                                        <div class="code-preview" style="margin-bottom: 20px;">
                                            <div class="consulted-code" style="width: 100%; max-width: 800px; margin: 0 auto;">
                                                <div style="width: 100%; min-height: 140px; background: #1e1e1e; border-radius: 8px; display: flex; align-items: flex-start; justify-content: flex-start; font-family: 'Courier New', monospace; font-size: 12px; color: #60aaff; overflow: auto; padding: 18px; box-sizing: border-box;">
                                                    <pre style="margin: 0; white-space: pre-wrap; width: 100%; font-size: 12px; line-height: 1.4;"></pre>
                                                </div>
                                            </div>
                                            <div class="code-info" style="text-align: center; margin-top: 10px;">
                                                <h5 style="color: #60aaff; margin: 0 0 5px 0; font-size: 14px; font-weight: 600;">${t('selectedCode')}</h5>
                                                <p style="color: rgba(220, 220, 220, 0.7); margin: 0; font-size: 12px;">${t('makeQueryToAnalyzeCode')}</p>
                                            </div>
                                        </div>
                                        <div class="consultation-result">
                                            <p data-placeholder="true">${t('writeQuestionOrSelectPredefined')}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Modal básico para otros tipos
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
        
        // Event listeners para cerrar modal
        const closeButton = modal.querySelector('.modal-close');
        const overlay = modal.querySelector('.modal-overlay');
        
        closeButton.addEventListener('click', () => {
            this.cleanupModalAndSelection(modal);
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.cleanupModalAndSelection(modal);
            }
        });
        
        // Cerrar modal con Escape
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.cleanupModalAndSelection(modal);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        // Event listeners para botones de consulta
        const queryButtons = modal.querySelectorAll('.query-btn');
        queryButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Verificar si el botón está deshabilitado
                if (button.disabled) {
                    return;
                }
                
                const query = button.getAttribute('data-query');
                if (query) {
                    // Deshabilitar todos los botones predefinidos
                    this.setPresetButtonsState(modal, true);
                    this.handlePredefinedQuery(query, modal);
                }
            });
        });
        
        // Event listener para input personalizado
        const queryInput = modal.querySelector('.query-input');
        const submitButton = modal.querySelector('.query-submit-btn');
        
        if (queryInput && submitButton) {
            submitButton.addEventListener('click', () => {
                // Verificar si ya hay una consulta en proceso
                if (submitButton.disabled) {
                    return;
                }
                
                // VALIDACIÓN TEMPRANA: Verificar API key antes de procesar
                const decryptedApiKey = this.settings.geminiApiKey ? simpleDecrypt(this.settings.geminiApiKey) : '';
                if (!decryptedApiKey || !decryptedApiKey.trim()) {
                    console.warn('Intento de consulta sin API key - botón Consultar');
                    this.showApiKeyRequiredMessage(modal);
                    return;
                }
                
                const query = queryInput.value.trim();
                if (query) {
                    // Deshabilitar botón y cambiar texto
                    this.setQueryButtonState(submitButton, queryInput, true);
                    this.handleCustomQuery(query, modal, submitButton, queryInput);
                    // Limpiar el campo después de enviar la consulta
                    queryInput.value = '';
                }
            });
            
            queryInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); // Evitar salto de línea
                    
                    // Verificar si ya hay una consulta en proceso
                    if (submitButton.disabled) {
                        return;
                    }
                    
                    // VALIDACIÓN TEMPRANA: Verificar API key antes de procesar
                    const decryptedApiKey = this.settings.geminiApiKey ? simpleDecrypt(this.settings.geminiApiKey) : '';
                    if (!decryptedApiKey || !decryptedApiKey.trim()) {
                        console.warn('Intento de consulta sin API key - Enter');
                        this.showApiKeyRequiredMessage(modal);
                        return;
                    }
                    
                    const query = queryInput.value.trim();
                    if (query) {
                        // Deshabilitar botón y cambiar texto
                        this.setQueryButtonState(submitButton, queryInput, true);
                        this.handleCustomQuery(query, modal, submitButton, queryInput);
                        // Limpiar el campo después de enviar la consulta
                        queryInput.value = '';
                    }
                } 
                // Shift+Enter permite salto de línea
            });
        }
        
        // Event listeners para botones de control de respuesta
        const copyButton = modal.querySelector('.copy-query-btn');
        const audioButton = modal.querySelector('.audio-btn');
        
        if (copyButton) {
            copyButton.addEventListener('click', () => {
                this.copyQueryResponse(modal);
            });
        }
        
        if (audioButton) {
            let clickCount = 0;
            let clickTimer = null;
            
            audioButton.addEventListener('click', () => {
                clickCount++;
                
                if (clickCount === 1) {
                    clickTimer = setTimeout(() => {
                        // Un solo clic: play/pause
                        this.toggleAudio(modal, audioButton);
                        clickCount = 0;
                    }, 300);
                } else if (clickCount === 2) {
                    // Doble clic: reiniciar
                    clearTimeout(clickTimer);
                    this.restartAudio(modal, audioButton);
                    clickCount = 0;
                }
            });
        }
        
        return modal;
    }
    
    clearVisualSelection() {        
        try {
            // Limpiar la selección visual en el navegador
            if (window.getSelection) {
                const selection = window.getSelection();
                if (selection && selection.removeAllRanges) {
                    selection.removeAllRanges();                    
                }
            }
            
            // Fallback para navegadores más antiguos
            if (document.selection && document.selection.empty) {
                document.selection.empty();
            }
        } catch (error) {
            console.warn('[DEBUG] Error limpiando selección visual:', error);
        }
        
    }
    
    setQueryButtonState(submitButton, queryInput, isProcessing) {
        if (isProcessing) {
            // Deshabilitar durante procesamiento
            submitButton.disabled = true;
            submitButton.textContent = t('processing');
            submitButton.style.opacity = '0.6';
            submitButton.style.cursor = 'not-allowed';
            
            if (queryInput) {
                queryInput.disabled = true;
                queryInput.style.opacity = '0.6';
                queryInput.placeholder = t('processingQuery');
            }
            

        } else {
            // Rehabilitar después de procesamiento
            submitButton.disabled = false;
            submitButton.textContent = t('consult');
            submitButton.style.opacity = '1';
            submitButton.style.cursor = 'pointer';
            
            if (queryInput) {
                queryInput.disabled = false;
                queryInput.style.opacity = '1';
                queryInput.placeholder = t('writeImageQueryPlaceholder');
            }
            

        }
    }
    
    setPresetButtonsState(modal, isProcessing) {
        const queryButtons = modal.querySelectorAll('.query-btn');
        queryButtons.forEach(button => {
            // Solo aplicar a botones con data-query (predefinidos), no a debug buttons
            if (button.getAttribute('data-query')) {
                if (isProcessing) {
                    button.disabled = true;
                    button.style.opacity = '0.6';
                    button.style.cursor = 'not-allowed';
                    button.style.pointerEvents = 'none';
                } else {
                    button.disabled = false;
                    button.style.opacity = '1';
                    button.style.cursor = 'pointer';
                    button.style.pointerEvents = 'auto';
                }
            }
        });
        
    }
    
    cleanupModalAndSelection(modal) {
        // Si hay una consulta en progreso, bloquear el cierre del modal
        if (this.isConsultationInProgress) {
            this.showConsultationInProgressMessage();
            return;
        }
        
        // Limpiar protección de IA y selección
        if (this.isAnalyzingWithAI) {
            this.isAnalyzingWithAI = false;
        }
        
        // Cancelar cualquier consulta en progreso
        if (this.currentConsultationController) {
            this.currentConsultationController.abort();
            this.currentConsultationController = null;
        }
        
        // El menú contextual se rehabilitará automáticamente cuando se cierre el modal
        // ya que las protecciones se basan en la presencia del modal en el DOM
        
        if (this.currentSelection) {
            this.currentSelection = null;
        }
        
        // Limpiar estado de consulta
        this.isConsultationInProgress = false;
        
        // Remover el modal
        modal.remove();
    }
    
    showConsultationInProgressMessage() {
        // Mostrar una notificación temporal indicando que hay una consulta en progreso
        this.showTemporaryNotification(t('consultationInProgressMessage'), 'warning');
    }
    
    showTemporaryNotification(message, type = 'info') {
        // Remover notificación existente si la hay
        const existingNotification = document.querySelector('.temporary-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        const notification = document.createElement('div');
        notification.className = `temporary-notification ${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'warning' ? '#ff9800' : '#2196F3'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10002;
            transform: translateX(400px);
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        
        document.body.appendChild(notification);
        
        // Animar entrada
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remover después de 3 segundos
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
    
    addModalProcessingIndicator(modal) {
        // Agregar indicador visual de que el modal no se puede cerrar
        const closeButton = modal.querySelector('.modal-close');
        const overlay = modal.querySelector('.modal-overlay');
        
        if (closeButton) {
            closeButton.style.opacity = '0.3';
            closeButton.style.cursor = 'not-allowed';
            closeButton.title = t('cannotCloseWhileProcessing');
        }
        
        // Agregar clase para estilos de procesamiento
        modal.classList.add('processing-consultation');
        
        // Agregar indicador visual en el header
        const modalHeader = modal.querySelector('.modal-header h3');
        if (modalHeader && !modal.querySelector('.processing-indicator')) {
            const indicator = document.createElement('span');
            indicator.className = 'processing-indicator';
            indicator.innerHTML = ' <span style="animation: pulse 2s infinite;">⚡</span>';
            modalHeader.appendChild(indicator);
        }
    }
    
    removeModalProcessingIndicator(modal) {
        // Restaurar botón de cerrar
        const closeButton = modal.querySelector('.modal-close');
        if (closeButton) {
            closeButton.style.opacity = '1';
            closeButton.style.cursor = 'pointer';
            closeButton.title = '';
        }
        
        // Remover clase de procesamiento
        modal.classList.remove('processing-consultation');
        
        // Remover indicador visual
        const indicator = modal.querySelector('.processing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    handlePredefinedQuery(query, modal) {        
        // Verificar si hay API key configurada (descifrar primero)
        const decryptedApiKey = this.settings.geminiApiKey ? simpleDecrypt(this.settings.geminiApiKey) : '';
        if (!decryptedApiKey || !decryptedApiKey.trim()) {
            this.showApiKeyRequiredMessage(modal);
            // Rehabilitar botones si falla
            this.setPresetButtonsState(modal, false);
            return;
        }
        
        // También deshabilitar botón personalizado durante consulta predefinida
        const submitButton = modal.querySelector('.query-submit-btn');
        const queryInput = modal.querySelector('.query-input');
        if (submitButton && queryInput) {
            this.setQueryButtonState(submitButton, queryInput, true);
        }
        
        const responseContent = modal.querySelector('.response-content');
        const consultationResult = modal.querySelector('.consultation-result');
        const isCodeModal = modal.querySelector('.code-preview') !== null;
        
        // Procesar consulta con Gemini API
        this.processGeminiQuery(query, modal, isCodeModal, submitButton, queryInput);
    }
    
    handleCustomQuery(query, modal, submitButton = null, queryInput = null) {        
        if (this.currentSelection) {
            
        } else {
            console.error('[DEBUG] NO HAY CURRENTSELECTION en handleCustomQuery');
        }
        
        // Verificar si hay API key configurada (descifrar primero)
        const decryptedApiKey = this.settings.geminiApiKey ? simpleDecrypt(this.settings.geminiApiKey) : '';
        if (!decryptedApiKey || !decryptedApiKey.trim()) {
            this.showApiKeyRequiredMessage(modal);
            return;
        }
        
        // Detectar el tipo de modal para el guardado correcto en historial  
        const isCodeModal = modal.querySelector('.code-preview') !== null;
        this.processGeminiQuery(query, modal, isCodeModal, submitButton, queryInput);
    }
    
    showApiKeyRequiredMessage(modal) {
        const responseContent = modal.querySelector('.response-content');
        const consultationResult = modal.querySelector('.consultation-result');
        const isCodeModal = modal.querySelector('.code-preview') !== null;
        
        // Hardcoded translations based on browser language
        const isSpanish = navigator.language.startsWith('es');
        
        const apiKeyMessage = `
            <div class="api-key-required">
                <div class="api-key-icon">🔑</div>
                <h3>${isSpanish ? 'API Key Requerida' : 'API Key Required'}</h3>
                <p>${isSpanish ? 'Para utilizar esta función, necesitas configurar tu propia API key de Google Gemini.' : 'To use this feature, you need to configure your own Google Gemini API key.'}</p>
                <div class="api-key-steps">
                    <h4>${isSpanish ? '¿Cómo obtener tu API key?' : 'How to get your API key?'}</h4>
                    <ol>
                        <li>${isSpanish ? 'Ve a Google AI Studio (makersuite.google.com)' : 'Go to Google AI Studio (makersuite.google.com)'}</li>
                        <li>${isSpanish ? 'Inicia sesión con tu cuenta de Google' : 'Sign in with your Google account'}</li>
                        <li>${isSpanish ? 'Haz clic en "Crear API Key"' : 'Click on "Create API Key"'}</li>
                        <li>${isSpanish ? 'Abre la configuración de la extensión' : 'Open the extension settings'}</li>
                        <li>${isSpanish ? 'Pega tu API key en el campo correspondiente' : 'Paste your API key in the appropriate field'}</li>
                    </ol>
                </div>
                <div class="api-key-benefits">
                    <h4>${isSpanish ? 'Beneficios de usar tu propia API key:' : 'Benefits of using your own API key:'}</h4>
                    <ul>
                        <li>${isSpanish ? 'Sin límites compartidos' : 'No shared limits'}</li>
                        <li>${isSpanish ? 'Privacidad total' : 'Complete privacy'}</li>
                        <li>${isSpanish ? 'Respuestas más rápidas' : 'Faster responses'}</li>
                        <li>${isSpanish ? 'Completamente gratis' : 'Completely free'}</li>
                    </ul>
                </div>
            </div>
        `;
        
        if (isCodeModal && consultationResult) {
            consultationResult.innerHTML = apiKeyMessage;
        } else if (responseContent) {
            responseContent.innerHTML = apiKeyMessage;
        }
    }
    
    async processGeminiQuery(query, modal, isCodeModal = false, submitButton = null, queryInput = null) {
        // VALIDACIÓN TEMPRANA: Verificar API key antes de mostrar loading
        const encryptedApiKey = this.settings.geminiApiKey;
        const apiKey = encryptedApiKey ? simpleDecrypt(encryptedApiKey) : '';
        
        if (!apiKey || !apiKey.trim()) {
            console.warn('Intento de procesamiento sin API key');
            this.showApiKeyRequired(modal, isCodeModal);
            return;
        }
        
        // Agregar indicador visual de procesamiento al modal
        this.addModalProcessingIndicator(modal);
        
        const responseContent = modal.querySelector('.response-content');
        const consultationResult = modal.querySelector('.consultation-result');
        
        // Determinar el tipo de análisis para el mensaje de loading
        let loadingMessage = t('processingQueryWithGemini');
        if (this.currentSelection) {
            if (this.currentSelection.hasImages) {
                loadingMessage = t('analyzingImageWithGemini');
            } else if (this.currentSelection.hasCode) {
                loadingMessage = t('analyzingCodeWithGemini');
            } else {
                loadingMessage = t('processingTextWithGemini');
            }
        }
        
        // Mostrar loading con indicador más visible
        const loadingHTML = `
            <div style="text-align: center; padding: 30px; background: rgba(96, 170, 255, 0.05); border-radius: 8px; border: 1px solid rgba(96, 170, 255, 0.2);">
                <div class="loading-spinner" style="display: inline-block; width: 24px; height: 24px; border: 3px solid rgba(100, 200, 255, 0.3); border-radius: 50%; border-top-color: rgba(100, 200, 255, 1); animation: spin 1s ease-in-out infinite; margin-bottom: 15px;"></div>
                <h3 style="color: rgba(96, 170, 255, 0.9); margin: 0 0 10px 0; font-size: 16px;">${t('processingQuery')}</h3>
                <p style="margin: 0; color: rgba(220, 220, 220, 0.7); font-size: 14px;">${loadingMessage}</p>
                <div style="margin-top: 15px; padding: 10px; background: rgba(255, 255, 255, 0.05); border-radius: 6px; font-size: 12px; color: rgba(220, 220, 220, 0.6);">
                    ${t('pleaseWaitDontSendAnother')}
                </div>
            </div>
        `;
        
        if (isCodeModal && consultationResult) {
            consultationResult.innerHTML = loadingHTML;
        } else if (responseContent) {
            responseContent.innerHTML = loadingHTML;


        }
        
        try {
            // Preparar el contexto según el tipo de consulta
            let apiData = null;
            
            if (this.currentSelection) {
                if (this.currentSelection.hasImages && this.currentSelection.images) {
                    // Para imágenes: preparar datos multimodales
                    try {
                        apiData = await this.prepareImageQuery(query, this.currentSelection.images);
                    } catch (imageError) {
                        console.warn('Error preparando consulta multimodal, usando fallback:', imageError.message);
                        // Fallback a consulta contextual
                        const contextualQuery = `Context: The user is asking about an image that is present on the page but couldn't be processed. The user's question is: "${query}"\n\nPlease provide a helpful response explaining that you cannot currently see the image but offer general guidance related to their question.`;
                        apiData = { query: contextualQuery };
                    }
                } else if (this.currentSelection.hasCode) {
                    // Para código: contexto más rico
                    const codeLanguage = this.detectCodeLanguage(this.currentSelection.text);
                    const contextualQuery = `You are an expert code analyst. Analyze the following ${codeLanguage} code:

\`\`\`${codeLanguage}
${this.currentSelection.text}
\`\`\`

User question: ${query}

Please provide a detailed, technical response focusing on code analysis, best practices, and practical insights.`;
                    
                    apiData = { query: contextualQuery };
                } else {
                    // Para texto normal
                    const contextualQuery = `Context: The user has selected the following text: "${this.currentSelection.text}"\n\nQuestion: ${query}`;
                    apiData = { query: contextualQuery };
                }
            } else {
                apiData = { query: query };
            }
            
            let response;
            try {
                response = await this.callGeminiAPI(apiData);
            } catch (apiError) {
                // Si falla la API multimodal, intentar fallback contextual
                if (apiData.multimodal && this.currentSelection) {
                    console.warn('Fallo API multimodal, intentando fallback contextual:', apiError.message);
                    const fallbackQuery = `Context: The user is asking about an image on the page but there was a technical issue processing it. Their question is: "${query}"\n\nPlease provide a helpful response explaining the limitation and offer general guidance.`;
                    response = await this.callGeminiAPI({ query: fallbackQuery });
                } else {
                    throw apiError;
                }
            }
            
            // Determinar el tipo de respuesta para mejor formateo
            const isImageResponse = this.currentSelection && this.currentSelection.hasImages;
            // Para código: usar el parámetro isCodeModal que indica si estamos en modal de análisis de código
            const isCodeResponse = isCodeModal || (this.currentSelection && this.currentSelection.hasCode);
            let responseTypeText, responseIcon;
            
            if (isImageResponse) {
                responseTypeText = t('imageAnalysisByGemini');
                responseIcon = '';
            } else if (isCodeResponse) {
                responseTypeText = t('codeAnalysisByGemini');
                responseIcon = '';
            } else {
                responseTypeText = 'Respuesta de Gemini AI';
                responseIcon = '';
            }
            
            // Mostrar respuesta
            const responseHTML = `
                <div style="color: rgba(220, 220, 220, 0.9); line-height: 1.6; text-align: left; padding: 20px; margin: 0;">
                    <div style="background: rgba(40, 40, 45, 0.3); padding: 15px; border-radius: 8px; border: 1px solid rgba(100, 200, 255, 0.2);">
                        ${this.formatGeminiResponse(response)}
                    </div>
                </div>
            `;
            
            if (isCodeModal && consultationResult) {
                consultationResult.innerHTML = responseHTML;
            } else if (responseContent) {
                responseContent.innerHTML = responseHTML;
            }
            
            // Guardar en historial si la consulta fue exitosa
            this.saveToHistory(query, response, isImageResponse, isCodeResponse);
            
            // Incrementar uso diario después de consulta exitosa
            try {
                await chrome.runtime.sendMessage({ type: 'INCREMENT_DAILY_USAGE' });
            } catch (usageError) {
                console.warn('No se pudo incrementar el contador de uso diario:', usageError);
            }

            
        } catch (error) {
            console.error('Error consultando Gemini:', error);
            
            const isImageError = this.currentSelection && this.currentSelection.hasImages;
            const isCodeError = isCodeModal || (this.currentSelection && this.currentSelection.hasCode);
            let errorTitle, errorIcon;
            
            if (isImageError) {
                errorTitle = t('imageAnalysisError');
                errorIcon = '';
            } else if (isCodeError) {
                errorTitle = t('codeAnalysisError');
                errorIcon = '';
            } else {
                errorTitle = 'Error de Consulta';
                errorIcon = '';
            }
            
            let errorMessage = error.message || t('geminiConnectionError');
            let isQuotaExceeded = false;
            
            // Verificar si es error de tokens/cuota agotados
            if (error.message === 'QUOTA_EXCEEDED') {
                isQuotaExceeded = true;
                errorMessage = t('quotaExceededError');
            }
            
            // Mensajes específicos para errores de imagen
            if (!isQuotaExceeded && isImageError) {
                if (error.message.includes('CORS') || error.message.includes('fetch')) {
                    errorMessage = t('imageAccessError');
                } else if (error.message.includes('not supported')) {
                    errorMessage = t('imageFormatNotSupported');
                } else if (error.message.includes('size') || error.message.includes('large')) {
                    errorMessage = t('imageTooLarge');
                }
            }
            
            // Mensajes específicos para errores de código
            if (!isQuotaExceeded && isCodeError) {
                if (error.message.includes('too long') || error.message.includes('length')) {
                    errorMessage = t('codeTooLong');
                } else if (error.message.includes('invalid') || error.message.includes('format')) {
                    errorMessage = t('codeFormatError');
                }
            }
            
            const errorHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="color: #ff6b6b; font-size: 24px; margin-bottom: 10px;">${errorIcon}</div>
                    <h3 style="color: #ff6b6b; margin: 0 0 10px 0;">${errorTitle}</h3>
                    <p style="color: rgba(220, 220, 220, 0.8); margin: 0 0 15px 0;">
                        ${errorMessage}
                    </p>
                    ${isQuotaExceeded ? `
                    <div style="background: rgba(255, 193, 7, 0.1); padding: 15px; border-radius: 6px; font-size: 13px; color: rgba(255, 193, 7, 0.9); border: 1px solid rgba(255, 193, 7, 0.3);">
                        <div style="margin-bottom: 10px; font-weight: 600;">${t('tokensExhausted')}</div>
                        <div style="text-align: left; color: rgba(220, 220, 220, 0.8);">
                            • ${t('tokensRenewMonthly')}<br>
                            • ${t('checkQuotaAt')} <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: #60aaff;">Google AI Studio</a><br>
                            • ${t('considerUpgradingPlan')}
                        </div>
                    </div>
                    ` : isImageError ? `
                    <div style="background: rgba(255, 107, 107, 0.1); padding: 10px; border-radius: 6px; font-size: 12px; color: rgba(220, 220, 220, 0.7);">
                        ${t('imageTip')}
                    </div>
                    ` : isCodeError ? `
                    <div style="background: rgba(255, 107, 107, 0.1); padding: 10px; border-radius: 6px; font-size: 12px; color: rgba(220, 220, 220, 0.7);">
                        ${t('codeTip')}
                    </div>
                    ` : ''}
                </div>
            `;
            
            if (isCodeModal && consultationResult) {
                consultationResult.innerHTML = errorHTML;
            } else if (responseContent) {
                responseContent.innerHTML = errorHTML;
            }
        } finally {
            // Remover indicador visual de procesamiento del modal
            this.removeModalProcessingIndicator(modal);
            
            // Rehabilitar botones de consulta
            if (submitButton && queryInput) {
                this.setQueryButtonState(submitButton, queryInput, false);
            }
            
            // Rehabilitar botones predefinidos
            this.setPresetButtonsState(modal, false);
            
            // NO limpiar automáticamente - mantener la selección para consultas múltiples
            if (this.isAnalyzingWithAI) {
                // NO desactivar isAnalyzingWithAI aquí para permitir múltiples consultas
                // La limpieza se hará cuando el modal se cierre
            }
        }
    }
    
    async callGeminiAPI(apiData) {
        const encryptedApiKey = this.settings.geminiApiKey;
        const apiKey = encryptedApiKey ? simpleDecrypt(encryptedApiKey) : '';
        
        if (!apiKey || !apiKey.trim()) {
            throw new Error(t('apiKeyNotConfigured'));
        }
        
        // Crear AbortController para esta consulta
        this.currentConsultationController = new AbortController();
        this.isConsultationInProgress = true;
        
        // Determinar si es una consulta multimodal o de texto simple
        const isMultimodal = apiData.multimodal === true;
        
        // Lista de modelos a probar en orden de preferencia (actualizados a 2025)
        const modelsToTry = [
            this.settings.preferredModel || 'models/gemini-2.5-flash',
            'models/gemini-2.5-flash',
            'models/gemini-2.5-pro',
            'models/gemini-2.0-flash',
            'models/gemini-flash-latest'
        ];
        
        // Eliminar duplicados
        const uniqueModels = [...new Set(modelsToTry)];
        
        let lastError = null;
        
        for (const modelName of uniqueModels) {
            try {
                
                // Preparar el contenido según el tipo de consulta
                let requestBody;
                
                if (isMultimodal) {
                    // Para consultas multimodales (con imágenes)                    
                    // Formato correcto para la API REST de Gemini v1beta según ejemplos oficiales
                    requestBody = {
                        contents: [{
                            parts: apiData.parts
                        }]
                    };
                    
                    // Debug: log del request body (sin mostrar los datos base64 completos)
                    const debugBody = {
                        ...requestBody,
                        contents: [{
                            parts: apiData.parts.map(part => {
                                if (part.inline_data) {
                                    return {
                                        inline_data: {
                                            mime_type: part.inline_data.mime_type,
                                            data: `[base64 data - ${part.inline_data.data.length} chars]`
                                        }
                                    };
                                }
                                return part;
                            })
                        }]
                    };                    
                } else {
                    // Para consultas de solo texto, formato simple como ejemplos oficiales
                    requestBody = {
                        contents: [{
                            parts: [{
                                text: apiData.query || apiData
                            }]
                        }]
                    };
                }                
                
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey  // Usar header como en ejemplos oficiales
                },
                body: JSON.stringify(requestBody),
                signal: this.currentConsultationController?.signal
            });
            
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Gemini API Error Response:', errorText);
                
                let errorData = {};
                try {
                    errorData = JSON.parse(errorText);
                } catch (parseError) {
                    console.warn('Could not parse error response as JSON');
                }
                
                // Log más detallado para debugging
                console.error('Debug Error Info:', {
                    status: response.status,
                    statusText: response.statusText,
                    model: modelName,
                    isMultimodal: isMultimodal,
                    errorMessage: errorData.error?.message || 'No error message',
                    errorCode: errorData.error?.code || 'No error code'
                });
                
                // Si es un error de modelo no soportado o contenido, intentar el siguiente modelo
                if (response.status === 400 && errorData.error?.message?.includes('not found')) {
                    console.warn(`Modelo ${modelName} no encontrado, probando siguiente...`);
                    lastError = new Error(`Modelo ${modelName} no disponible`);
                    continue; // Probar siguiente modelo
                }
                
                // Mensajes de error más específicos
                if (response.status === 400) {
                    lastError = new Error('Consulta inválida. Verifica el contenido enviado a la API.');
                } else if (response.status === 401) {
                    throw new Error('API key inválida. Verifica tu clave en la configuración.');
                } else if (response.status === 403) {
                    // Verificar si es error de tokens agotados
                    const errorMessage = errorData.error?.message || '';
                    if (errorMessage.toLowerCase().includes('quota') || 
                        errorMessage.toLowerCase().includes('limit') ||
                        errorMessage.toLowerCase().includes('exceeded') ||
                        errorMessage.toLowerCase().includes('usage')) {
                        throw new Error('QUOTA_EXCEEDED');
                    }
                    throw new Error('Acceso denegado. Verifica los permisos de tu API key.');
                } else if (response.status === 429) {
                    throw new Error('Límite de requests alcanzado. Espera un momento e intenta de nuevo.');
                } else if (response.status === 503) {
                    // Error específico para modelo sobrecargado
                    const errorMessage = errorData.error?.message || '';
                    if (errorMessage.toLowerCase().includes('overloaded') || 
                        errorMessage.toLowerCase().includes('unavailable')) {
                        throw new Error('El modelo de Gemini está temporalmente sobrecargado. Intenta de nuevo en unos minutos.');
                    }
                    throw new Error('Servicio temporalmente no disponible. Intenta de nuevo más tarde.');
                } else {
                    // Verificar si el mensaje contiene "overloaded" independientemente del código de estado
                    const errorMessage = errorData.error?.message || '';
                    if (errorMessage.toLowerCase().includes('overloaded')) {
                        throw new Error('El modelo de Gemini está temporalmente sobrecargado. Intenta de nuevo en unos minutos.');
                    }
                    lastError = new Error(errorData.error?.message || `Error HTTP ${response.status}: ${response.statusText}`);
                }
                
                // Si es multimodal y hay error, intentar siguiente modelo
                if (isMultimodal) {
                    console.warn(`Error multimodal con ${modelName}, probando siguiente modelo...`);
                    continue;
                }
                
                throw lastError;
            }
            
                const data = await response.json();
                
                if (!data.candidates || data.candidates.length === 0) {
                    console.error('No candidates in response:', data);
                    throw new Error('No se recibió respuesta de Gemini AI');
                }
                
                const candidate = data.candidates[0];
                if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
                    console.error('No content in candidate:', candidate);
                    throw new Error('Respuesta de Gemini AI sin contenido');
                }
                
                const responseText = candidate.content.parts[0].text;                
                // Si es multimodal, verificar si la respuesta indica que se procesaron las imágenes
                if (isMultimodal) {
                    const hasImageIndicators = responseText.toLowerCase().includes('image') || 
                                             responseText.toLowerCase().includes('picture') ||
                                             responseText.toLowerCase().includes('photo') ||
                                             responseText.toLowerCase().includes('see') ||
                                             responseText.toLowerCase().includes('show');
                }
                
                // Limpiar estado de consulta al completar exitosamente
                this.isConsultationInProgress = false;
                this.currentConsultationController = null;
                
                return responseText;
                
            } catch (error) {
                console.warn(`Modelo ${modelName} falló:`, error.message);
                lastError = error;
                
                // Si el error es por cancelación, limpiar estado y relanzar
                if (error.name === 'AbortError') {
                    this.isConsultationInProgress = false;
                    this.currentConsultationController = null;
                    throw new Error(t('consultationCanceled') || 'Consulta cancelada');
                }
                
                // Si es un error de modelo específico, intentar el siguiente
                if (error.message.includes('not found') || error.message.includes('not supported')) {
                    continue;
                }
                
                // Si es un error de autenticación o permisos, no intentar otros modelos
                if (error.message.includes('401') || error.message.includes('403') || 
                    error.message.includes('inválida') || error.message.includes('denegado')) {
                    // Limpiar estado antes de lanzar error
                    this.isConsultationInProgress = false;
                    this.currentConsultationController = null;
                    throw error;
                }
                
                // Para otros errores del último modelo, lanzar el error
                if (modelName === uniqueModels[uniqueModels.length - 1]) {
                    // Limpiar estado antes de lanzar error
                    this.isConsultationInProgress = false;
                    this.currentConsultationController = null;
                    throw error;
                }
            }
        }
        
        // Si llegamos aquí, ningún modelo funcionó
        // Limpiar estado antes de lanzar error
        this.isConsultationInProgress = false;
        this.currentConsultationController = null;
        throw lastError || new Error('No se pudo conectar con ningún modelo de Gemini AI');
    }
    

    

    
    detectCodeLanguage(code) {
        // Detectar lenguaje de programación basado en el contenido
        const lowerCode = code.toLowerCase();
        
        // Patrones específicos de lenguajes
        if (lowerCode.includes('function') && lowerCode.includes('const') && lowerCode.includes('=>')) {
            return 'javascript';
        } else if (lowerCode.includes('def ') && lowerCode.includes('import ')) {
            return 'python';
        } else if (lowerCode.includes('public class') || lowerCode.includes('private ') || lowerCode.includes('System.out')) {
            return 'java';
        } else if (lowerCode.includes('#include') || lowerCode.includes('int main')) {
            return 'c++';
        } else if (lowerCode.includes('<?php') || lowerCode.includes('$_')) {
            return 'php';
        } else if (lowerCode.includes('SELECT') || lowerCode.includes('FROM') || lowerCode.includes('WHERE')) {
            return 'sql';
        } else if (lowerCode.includes('<html') || lowerCode.includes('<div') || lowerCode.includes('</')) {
            return 'html';
        } else if (lowerCode.includes('{') && lowerCode.includes(':') && (lowerCode.includes('color') || lowerCode.includes('margin'))) {
            return 'css';
        } else if (lowerCode.includes('fn ') || lowerCode.includes('let mut')) {
            return 'rust';
        } else if (lowerCode.includes('func ') && lowerCode.includes('package ')) {
            return 'go';
        }
        
        return 'code';
    }

    async prepareImageQuery(query, images) {        
        try {
            const imageParts = [];
            
            for (let i = 0; i < Math.min(images.length, 3); i++) { // Máximo 3 imágenes para evitar límites
                const imageElement = images[i];
                let imageUrl;
                
                // Obtener la URL de la imagen según el tipo de elemento
                if (typeof imageElement === 'string') {
                    imageUrl = imageElement;
                } else if (imageElement.src) {
                    imageUrl = imageElement.src;
                } else if (imageElement.currentSrc) {
                    imageUrl = imageElement.currentSrc;
                } else {
                    console.warn(`No se pudo obtener URL de imagen ${i + 1}:`, imageElement);
                    continue;
                }
                
                try {
                    const imageData = await this.getImageAsBase64(imageUrl);
                    if (imageData) {
                        // Formato correcto según la documentación de Google Gemini REST API
                        // Verificar que el base64 no esté vacío y tenga un tamaño razonable
                        if (!imageData.base64 || imageData.base64.length < 100) {
                            throw new Error(`Datos base64 inválidos: longitud ${imageData.base64?.length || 0}`);
                        }
                        
                        // Verificar que no exceda el límite (aproximadamente 20MB total)
                        const sizeInBytes = (imageData.base64.length * 3) / 4;
                        if (sizeInBytes > 15 * 1024 * 1024) { // 15MB por imagen para dejar margen
                            throw new Error(`Imagen demasiado grande: ${Math.round(sizeInBytes / 1024 / 1024 * 100) / 100}MB`);
                        }
                        
                        imageParts.push({
                            inline_data: {  // La API REST usa snake_case, no camelCase
                                mime_type: imageData.mimeType,
                                data: imageData.base64
                            }
                        });
                        
                        // Temporalmente agregar al DOM para verificación (solo para debug)
                        document.body.appendChild(testImg);
                        setTimeout(() => document.body.removeChild(testImg), 5000); // Remover después de 5s
                    }
                } catch (imageError) {
                    console.warn(`No se pudo procesar imagen ${i + 1}:`, imageError.message);
                }

            }
            
            if (imageParts.length === 0) {
                console.warn('No se pudieron procesar las imágenes, usando consulta de texto');
                return { query: `Context: User is asking about an image on the page.\n\nQuestion: ${query}` };
            }
            
            // Crear contenido multimodal - según ejemplos oficiales, texto seguido por imágenes
            const parts = [
                { text: query }, // El prompt primero (según ejemplos oficiales)
                ...imageParts    // Las imágenes después
            ];            
            return {
                multimodal: true,
                parts: parts
            };
            
        } catch (error) {
            console.error('Error preparando consulta de imagen:', error);
            return { query: `Context: User is asking about an image on the page.\n\nQuestion: ${query}` };
        }
    }
    
    async getImageAsBase64(imageUrl) {
        try {
            // Si es una URL de datos, extraer directamente
            if (imageUrl.startsWith('data:')) {
                const [mimeInfo, base64Data] = imageUrl.split(',');
                const mimeType = mimeInfo.split(':')[1].split(';')[0];
                
                // Verificar que sea un tipo de imagen soportado por Gemini
                const supportedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
                if (!supportedTypes.includes(mimeType)) {
                    throw new Error(`Tipo de imagen no soportado por Gemini: ${mimeType}`);
                }
                
                // Limpiar el base64 de posibles saltos de línea o espacios
                const cleanBase64 = base64Data.replace(/\s/g, '');
                return { base64: cleanBase64, mimeType: mimeType };
            }
            
            // Para URLs normales, hacer fetch y convertir
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const blob = await response.blob();
            let mimeType = blob.type || 'image/jpeg';
            
            // Verificar que sea una imagen soportada
            if (!mimeType.startsWith('image/')) {
                throw new Error(`Tipo de archivo no soportado: ${mimeType}`);
            }
            
            // Normalizar tipos MIME para Gemini
            const supportedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
            if (!supportedTypes.includes(mimeType)) {
                // Si no es un tipo exactamente soportado, usar JPEG como fallback
                mimeType = 'image/jpeg';
            }            
            // Convertir a base64
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    let base64 = reader.result.split(',')[1]; // Remover el prefijo data:
                    // Limpiar el base64 de posibles saltos de línea o espacios
                    base64 = base64.replace(/\s/g, '');
                    resolve({ base64: base64, mimeType: mimeType });
                };
                reader.onerror = () => reject(new Error('Error leyendo imagen con FileReader'));
                reader.readAsDataURL(blob);
            });
            
        } catch (error) {
            console.error('Error convirtiendo imagen a base64:', error);
            throw error;
        }
    }
    
    formatGeminiResponse(response) {
        // Formatear la respuesta con markdown básico
        return response
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code style="background: rgba(100, 200, 255, 0.1); padding: 2px 4px; border-radius: 3px;">$1</code>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }
    
    generateSimulatedResponse(query) {
        // Respuestas simuladas hasta integrar con Gemini AI
        const lowerQuery = query.toLowerCase();
        
        if (lowerQuery.includes('describe') || lowerQuery.includes('descripción')) {
            return `<span style="color: rgba(96, 170, 255, 0.9); font-weight: 600;">Descripción de la imagen:</span><br><br>Esta es una imagen que muestra diversos elementos visuales. La composición incluye colores, formas y texturas que crean una presentación visualmente atractiva. Los detalles específicos varían según el contenido particular de la imagen seleccionada.<br><br><span style="color: rgba(200, 200, 200, 0.7); font-size: 12px;">Esta es una respuesta simulada. La funcionalidad completa estará disponible con la integración de IA.</span>`;
        } else if (lowerQuery.includes('código') || lowerQuery.includes('funcionamiento') || lowerQuery.includes('casos de uso')) {
            return `<span style="color: #888; font-weight: 600;">Análisis de código:</span><br><br>El código seleccionado contiene ${this.currentSelection?.text.length || 0} caracteres y presenta una estructura de programación específica.<br><br><span style="color: rgba(200, 200, 200, 0.7); font-size: 12px;">Para obtener un análisis detallado con IA, configura tu API key de Gemini en las opciones de la extensión.</span>`;
        } else {
            return `<span style="color: rgba(96, 170, 255, 0.9); font-weight: 600;">Consulta procesada:</span><br><br>Has realizado la consulta: "${query}"<br><br>El sistema ha procesado tu solicitud correctamente. Esta funcionalidad se conectará con Gemini AI para proporcionar respuestas detalladas y contextuales sobre el contenido seleccionado.<br><br><span style="color: rgba(200, 200, 200, 0.7); font-size: 12px;">Respuesta simulada del sistema de consultas.</span>`;
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showMessage(text, type = 'info') {
        // Remover mensaje anterior si existe
        const existingMessage = document.querySelector('.contextual-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        const message = document.createElement('div');
        message.className = 'contextual-message';
        message.textContent = text;
        message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(40, 40, 45, 0.95);
            color: #ffffff;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(100, 200, 255, 0.3);
            z-index: 999999;
            max-width: 300px;
            opacity: 0;
            transform: translateX(20px);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(message);
        
        // Mostrar con animación
        setTimeout(() => {
            message.style.opacity = '1';
            message.style.transform = 'translateX(0)';
        }, 10);
        
        // Ocultar después de 3 segundos
        setTimeout(() => {
            message.style.opacity = '0';
            message.style.transform = 'translateX(20px)';
            setTimeout(() => {
                if (message.parentNode) {
                    message.remove();
                }
            }, 300);
        }, 3000);
    }
    
    // Método para actualizar configuración
    updateSettings(newSettings) {
        
        if (this.settings) {
            this.settings = { ...this.settings, ...newSettings };
        }
    }

    destroy() {        
        // Limpiar menú contextual
        this.hideContextMenu();
        
        // Limpiar control de lectura
        this.removeReadingControl();
        
        // Limpiar elementos PDF
        this.cleanupPDFElements();
        
        // Remover TODOS los event listeners del documento
        try {
            // Listeners principales del sistema
            document.removeEventListener('selectionchange', this.handleSelectionChange);
            document.removeEventListener('mouseup', this.handleMouseUp);
            document.removeEventListener('keydown', this.handleKeyDown);
            document.removeEventListener('click', this.handleDocumentClick);
            
            // Cualquier otros listeners que pudieran estar activos
            if (this.documentMouseUpHandler) {
                document.removeEventListener('mouseup', this.documentMouseUpHandler);
            }
            
            if (this.documentKeyDownHandler) {
                document.removeEventListener('keydown', this.documentKeyDownHandler);
            }
            
        } catch (error) {
            console.warn('[SelectionContextual] Error removiendo event listeners:', error);
        }
        
        // Limpiar cualquier modal activo
        const activeModals = document.querySelectorAll('.contextual-modal');
        activeModals.forEach(modal => {
            try {
                modal.remove();
            } catch (error) {
                console.warn('Error removiendo modal:', error);
            }
        });
        
        // Limpiar cualquier menú contextual residual
        const contextMenus = document.querySelectorAll('.selection-context-menu');
        contextMenus.forEach(menu => {
            try {
                menu.remove();
            } catch (error) {
                console.warn('Error removiendo menú contextual:', error);
            }
        });
        
        // Limpiar selección actual
        this.currentSelection = null;
        this.contextMenu = null;
        this.isMenuVisible = false;
        
    }
    
    cleanupPDFElements() {        
        // Limpiar observers
        if (this.domObserver) {
            this.domObserver.disconnect();
            this.domObserver = null;
        }
        
        if (this.pdfObservers) {
            this.pdfObservers.forEach(observer => observer.disconnect());
            this.pdfObservers = [];
        }
    }
    
    // Método para limpiar todo el sistema de lectura
    cleanupReading() {
        this.removeReadingControl();
        this.currentSelection = null;
    }
    
    // Método para deseleccionar el contenido
    clearSelection(force = false) {
        // Si la selección contiene imágenes y no es forzada, mantenerla para consultas IA
        if (!force && this.currentSelection && this.currentSelection.hasImages) {
            try {
                const selection = window.getSelection();
                if (selection) {
                    selection.removeAllRanges();
                }
            } catch (error) {
                console.warn('[DEBUG] Error al limpiar selección visual:', error);
            }
            return; // No limpiar this.currentSelection
        }
        
        try {
            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
            }
        } catch (error) {
            console.warn('[DEBUG] Error al limpiar selección:', error);
        }
        this.currentSelection = null;
    }
    
    // Método para copiar el contenido de la respuesta
    copyQueryResponse(modal) {        
        // Buscar el contenido de respuesta en múltiples ubicaciones posibles
        let consultationResult = modal.querySelector('.response-content .consultation-result p') || 
                                modal.querySelector('.consultation-result p') ||
                                modal.querySelector('.response-content') ||
                                modal.querySelector('.consultation-result');        
        if (consultationResult) {
            let textToCopy = '';
                        
            if (consultationResult.classList.contains('response-content')) {
                // Si es el contenedor principal, buscar el contenido de la respuesta de Gemini
                const geminiResponseDiv = consultationResult.querySelector('div[style*="background: rgba(40, 40, 45"]');
                if (geminiResponseDiv) {
                    textToCopy = geminiResponseDiv.textContent.trim();
                } else {
                    textToCopy = consultationResult.textContent.trim();
                }
            } else {
                textToCopy = consultationResult.textContent.trim();
            }
            
            // Si el texto está vacío pero hay innerHTML, extraer el texto limpio
            if (!textToCopy && consultationResult.innerHTML) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = consultationResult.innerHTML;
                textToCopy = tempDiv.textContent.trim();
            }
            
            // Limpiar el texto para copia (mantener contenido principal)
            if (textToCopy.includes('This is a simulated response')) {
                // Para copia, mantener todo el contenido pero limpio
                textToCopy = textToCopy.replace(/\s+/g, ' ').trim();
            }            
            // Verificar si hay contenido válido para copiar
            if (!textToCopy || 
                textToCopy === t('writeQueryOrSelectPredefinedForImage') ||
                textToCopy === t('writeQuestionOrSelectPredefined') ||
                textToCopy === 'Processing query...' ||
                textToCopy.includes('Processing query') ||
                textToCopy.includes('Write a question or select a predefined') ||
                textToCopy.includes('Write a query or select a predefined') ||
                textToCopy.length < 15) { // Asegurar que hay contenido sustancial
                this.showNoContentNotification(modal, 'copy');
                return;
            }
            
            // Usar la API del portapapeles si está disponible
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    this.showCopyFeedback(modal);
                }).catch(err => {
                    console.error('Error copiando al portapapeles:', err);
                    this.fallbackCopyText(textToCopy, modal);
                });
            } else {
                this.fallbackCopyText(textToCopy, modal);
            }
        } else {
            this.showNoContentNotification(modal, 'copy');
        }
    }
    
    // Método de respaldo para copiar texto
    fallbackCopyText(text, modal) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showCopyFeedback(modal);
        } catch (err) {
            console.error('Error en copia de respaldo:', err);
        }
        
        document.body.removeChild(textArea);
    }
    
    // Mostrar feedback de copia exitosa
    showCopyFeedback(modal) {
        const copyButton = modal.querySelector('.copy-query-btn');
        if (copyButton) {
            const originalTitle = copyButton.title;
            copyButton.title = 'Copied!';
            copyButton.style.color = 'rgba(96, 170, 255, 1)';
            
            setTimeout(() => {
                copyButton.title = originalTitle;
                copyButton.style.color = '';
            }, 2000);
        }
    }
    
    // Mostrar notificación cuando no hay contenido para copiar o reproducir
    showNoContentNotification(modal, type) {        
        // Crear notificación
        let notification = modal.querySelector('.no-content-notification');
        if (notification) {
            notification.remove();
        }
        
        notification = document.createElement('div');
        notification.className = 'no-content-notification';
        
        const message = type === 'copy' ? 'No consultation to copy' : 'No consultation to play';
        
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-text">${message}</span>
            </div>
        `;
        
        // Insertar en el body del documento para asegurar que se vea
        document.body.appendChild(notification);
        
        // Animar la entrada
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Remover después de 3 segundos
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification && notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }
    
    // Controlar reproducción de audio (play/pause)
    toggleAudio(modal, audioButton) {
        // Verificar que speechSynthesis esté disponible
        if (!window.speechSynthesis) {
            console.error('[ERROR] speechSynthesis no está disponible');
            this.showNoContentNotification(modal, 'audio');
            return;
        }
        
        // Buscar el contenido de respuesta en múltiples ubicaciones posibles
        let consultationResult = modal.querySelector('.response-content .consultation-result p') || 
                                modal.querySelector('.consultation-result p') ||
                                modal.querySelector('.response-content') ||
                                modal.querySelector('.consultation-result');
        
        if (!consultationResult) {
            this.showNoContentNotification(modal, 'audio');
            return;
        }
        
        let textToSpeak = '';
        
        // Extraer texto usando la MISMA lógica exitosa que copyQueryResponse        
        if (consultationResult.classList.contains('response-content')) {
            // Si es el contenedor principal, buscar el contenido de la respuesta de Gemini
            const geminiResponseDiv = consultationResult.querySelector('div[style*="background: rgba(40, 40, 45"]');
            if (geminiResponseDiv) {
                textToSpeak = geminiResponseDiv.textContent.trim();
            } else {
                textToSpeak = consultationResult.textContent.trim();
            }
        } else {
            textToSpeak = consultationResult.textContent.trim();
        }
        
        // Si el texto está vacío pero hay innerHTML, extraer el texto limpio
        if (!textToSpeak && consultationResult.innerHTML) {
            // Crear un elemento temporal para extraer solo el texto
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = consultationResult.innerHTML;
            textToSpeak = tempDiv.textContent.trim();
        }
        
        // Limpiar el texto adicional para audio (remover texto de metadatos)
        if (textToSpeak.includes('This is a simulated response')) {
            // Extraer solo la parte principal, sin los metadatos
            const lines = textToSpeak.split('\n').filter(line => line.trim());
            const cleanLines = lines.filter(line => 
                !line.includes('This is a simulated response') &&
                !line.includes('Simulated system response') &&
                !line.includes('configure your API key') &&
                line.trim().length > 0
            );
            if (cleanLines.length > 0) {
                textToSpeak = cleanLines.join('. ').replace(/\s+/g, ' ').trim();
            }
        }                
        if (!textToSpeak || textToSpeak.length < 10) {
            this.showNoContentNotification(modal, 'audio');
            return;
        }
        
        // Validaciones más específicas
        const invalidTexts = [
            'Write a query or select a predefined option',
            'Write a question or select a predefined query',
            'Processing query',
            'Image Analysis by Gemini AI',
            'Gemini AI Response'
        ];
        
        // Verificar textos inválidos hardcodeados
        let isInvalidText = false;
        for (const invalidText of invalidTexts) {
            if (textToSpeak.includes(invalidText)) {
                isInvalidText = true;
                break;
            }
        }
        
        // Verificar textos inválidos dinámicos (usando t())
        const dynamicInvalidTexts = [
            t('writeQueryOrSelectPredefinedForImage'),
            t('writeQuestionOrSelectPredefined')
        ];
        
        for (const invalidText of dynamicInvalidTexts) {
            if (textToSpeak === invalidText || textToSpeak.includes(invalidText)) {
                isInvalidText = true;
                break;
            }
        }
        
        if (isInvalidText) {
            this.showNoContentNotification(modal, 'audio');
            return;
        }        
        if (this.isAudioPlaying) {

            this.isAudioPlaying = false;
            this.audioIsPaused = true;
            this.audioTextToResume = textToSpeak; // Guardar el texto para comparación
            
            if (speechSynthesis.speaking && !speechSynthesis.paused) {
                speechSynthesis.pause();
            }
            
            this.updateAudioButton(audioButton, 'play');
        } else if (this.audioIsPaused && this.audioTextToResume === textToSpeak) {
            this.audioIsPaused = false;
            this.isAudioPlaying = true;
            
            // Usar la misma lógica que el reproductor global
            if (speechSynthesis.paused) {
                // Si está pausado, usar resume (funciona para todas las voces incluyendo Google)
                speechSynthesis.resume();
                
                // Verificar después de un momento si el resume funcionó
                setTimeout(() => {
                    if (!speechSynthesis.speaking && speechSynthesis.paused) {
                        // Si el resume falló, reiniciar como último recurso
                        this.startNewAudio(textToSpeak, audioButton);
                    }
                }, 200);
            } else if (!speechSynthesis.speaking && !speechSynthesis.paused) {
                // Solo reiniciar si no hay síntesis activa Y no está pausado
                this.startNewAudio(textToSpeak, audioButton);
                return;
            } else {
                // Otros casos: hay speaking pero no paused (estado raro)
                speechSynthesis.resume();
            }
            
            this.updateAudioButton(audioButton, 'pause');

            
            // Función para configurar y reproducir
            const playAudio = () => {
                
                // USAR CONFIGURACIÓN GLOBAL DE VOZ del AudioPlayer
                if (window.AudioPlayer && typeof window.AudioPlayer.applyGlobalVoiceConfig === 'function') {
                    const voiceApplied = window.AudioPlayer.applyGlobalVoiceConfig(this.currentUtterance, 0.9);
                    
                    if (voiceApplied) {
                    } else {
                        this.currentUtterance.rate = 0.9;
                        this.currentUtterance.pitch = 1.0;
                        this.currentUtterance.volume = 1.0;
                        this.currentUtterance.lang = 'es-ES';
                    }
                } else {
                    this.currentUtterance.rate = 0.9;
                    this.currentUtterance.pitch = 1.0;
                    this.currentUtterance.volume = 1.0;
                    this.currentUtterance.lang = 'es-ES';
                }
                
                this.currentUtterance.onstart = () => {
                    this.isAudioPlaying = true;
                    this.updateAudioButton(audioButton, 'pause');
                };
                
                this.currentUtterance.onend = () => {
                    this.isAudioPlaying = false;
                    this.currentUtterance = null;
                    this.audioIsPaused = false;
                    this.audioTextToResume = null;
                    this.updateAudioButton(audioButton, 'play');
                };
                
                this.currentUtterance.onerror = (error) => {
                    console.error('[ERROR] Error en audio:', error);
                    this.isAudioPlaying = false;
                    this.currentUtterance = null;
                    this.audioIsPaused = false;
                    this.audioTextToResume = null;
                    this.updateAudioButton(audioButton, 'play');
                };
                
                speechSynthesis.speak(this.currentUtterance);
            };
            
            // Si no hay voces cargadas, esperar a que se carguen
            if (speechSynthesis.getVoices().length === 0) {
                speechSynthesis.addEventListener('voiceschanged', playAudio, { once: true });
            } else {
                playAudio();
            }
        } else {
            this.startNewAudio(textToSpeak, audioButton);
        }
    }
    
    // Método auxiliar para iniciar nuevo audio (similar al reproductor global)
    startNewAudio(textToSpeak, audioButton) {        
        // Cancelar cualquier síntesis anterior
        speechSynthesis.cancel();        
        this.audioIsPaused = false;
        this.audioTextToResume = textToSpeak;
        this.currentAudioText = textToSpeak;
        this.currentUtterance = new SpeechSynthesisUtterance(textToSpeak);        
        // Función para configurar y reproducir
        const playAudio = () => {            
            // USAR CONFIGURACIÓN GLOBAL DE VOZ del AudioPlayer
            if (window.AudioPlayer && typeof window.AudioPlayer.applyGlobalVoiceConfig === 'function') {
                const voiceApplied = window.AudioPlayer.applyGlobalVoiceConfig(this.currentUtterance, 0.9);
                
                if (voiceApplied) {
                } else {
                    this.currentUtterance.rate = 0.9;
                    this.currentUtterance.pitch = 1.0;
                    this.currentUtterance.volume = 1.0;
                    this.currentUtterance.lang = 'es-ES';
                }
            } else {
                this.currentUtterance.rate = 0.9;
                this.currentUtterance.pitch = 1.0;
                this.currentUtterance.volume = 1.0;
                this.currentUtterance.lang = 'es-ES';
            }
            
            this.currentUtterance.onstart = () => {
                this.isAudioPlaying = true;
                this.updateAudioButton(audioButton, 'pause');
            };
            
            this.currentUtterance.onend = () => {
                this.isAudioPlaying = false;
                this.currentUtterance = null;
                this.audioIsPaused = false;
                this.audioTextToResume = null;
                this.updateAudioButton(audioButton, 'play');
            };
            
            this.currentUtterance.onerror = (error) => {
                console.error('[ERROR] Error en audio:', error);
                this.isAudioPlaying = false;
                this.currentUtterance = null;
                this.audioIsPaused = false;
                this.audioTextToResume = null;
                this.updateAudioButton(audioButton, 'play');
            };            
            speechSynthesis.speak(this.currentUtterance);
            
        };
        
        // Si no hay voces cargadas, esperar a que se carguen
        if (speechSynthesis.getVoices().length === 0) {
            speechSynthesis.addEventListener('voiceschanged', playAudio, { once: true });
        } else {
            playAudio();
        }
    }
    
    // Reiniciar reproducción de audio (doble clic)
    restartAudio(modal, audioButton) {        
        // Cancelar audio actual
        speechSynthesis.cancel();
        
        // Resetear todos los estados
        this.isAudioPlaying = false;
        this.currentUtterance = null;
        this.audioIsPaused = false;
        this.audioTextToResume = null;
        this.updateAudioButton(audioButton, 'play');
        
        // Iniciar desde el principio después de un breve delay
        setTimeout(() => {
            this.toggleAudio(modal, audioButton);
        }, 150);
    }
    
    // Actualizar el ícono del botón de audio
    updateAudioButton(button, state) {
        const svg = button.querySelector('svg');
        if (svg) {
            if (state === 'pause') {
                // Cambiar a ícono de pausa
                svg.innerHTML = `
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                `;
                button.title = '1 clic: pausar';
            } else {
                // Cambiar a ícono de play
                svg.innerHTML = `
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                `;
                button.title = '1 clic: reproducir • 2 clics: reiniciar';
            }
        }
    }
    
    // FUNCIONES DE HISTORIAL
    
    async saveToHistory(query, response, isImageResponse = false, isCodeResponse = false) {
        try {
            if (isImageResponse && this.currentSelection && this.currentSelection.images) {
                await this.saveImageQuery(this.currentSelection.images[0], query, response);
            } else if (isCodeResponse) {
                // Si hay texto seleccionado, usarlo; si no, usar la consulta como contexto
                const codeText = (this.currentSelection && this.currentSelection.text) ? 
                    this.currentSelection.text : 
                    query; // Usar la consulta cuando no hay texto seleccionado
                await this.saveCodeQuery(codeText, query, response);
            } else if (this.currentSelection) {
                await this.saveTextQuery(this.currentSelection.text, query, response);
            } else {
                console.warn('[DEBUG] No se pudo guardar - no hay currentSelection');
            }
        } catch (error) {
            console.error('Error saving to history:', error);
        }
    }

    async saveImageQuery(imageData, query, response) {
        try {
            const settings = await this.getHistorySettings();
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
                url: window.location.href,
                domain: window.location.hostname
            };
            await this.addToHistory('historyImages', historyItem, settings.maxHistoryItems);
        } catch (error) {
            console.error('Error saving image query:', error);
        }
    }

    async saveCodeQuery(code, query, response) {        try {
            const settings = await this.getHistorySettings();
            if (!settings.saveCode) {
                return;
            }

            const historyItem = {
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toISOString(),
                type: 'code',
                code: code.substring(0, 2000), // Limit code length in history
                language: this.detectCodeLanguage(code),
                query: query,
                response: response,
                url: window.location.href,
                domain: window.location.hostname
            };

            await this.addToHistory('historyCode', historyItem, settings.maxHistoryItems);
        } catch (error) {
            console.error('Error saving code query:', error);
        }
    }

    async saveTextQuery(text, query, response) {
        try {
            const settings = await this.getHistorySettings();
            if (!settings.saveText) {
                return;
            }

            const historyItem = {
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toISOString(),
                type: 'text',
                text: text.substring(0, 1000), // Limit text length in history
                query: query,
                response: response,
                url: window.location.href,
                domain: window.location.hostname
            };

            await this.addToHistory('historyText', historyItem, settings.maxHistoryItems);
        } catch (error) {
            console.error('Error saving text query:', error);
        }
    }

    async getHistorySettings() {
        try {
            const result = await chrome.storage.sync.get('historySettings');
            return result.historySettings || {
                maxHistoryItems: 100,
                autoCleanup: 90,
                saveImages: true,
                saveCode: true,
                saveText: true
            };
        } catch (error) {
            console.error('Error getting history settings:', error);
            return {
                maxHistoryItems: 100,
                autoCleanup: 90,
                saveImages: true,
                saveCode: true,
                saveText: true
            };
        }
    }

    async addToHistory(storageKey, newItem, maxItems) {        
        try {
            const result = await chrome.storage.local.get(storageKey);            
            const history = result[storageKey] || [];
            
            history.unshift(newItem); // Add to beginning (most recent first)
            
            // Trim to max items
            if (history.length > maxItems) {
                const removed = history.splice(maxItems);
            }
            
            await chrome.storage.local.set({ [storageKey]: history });
            
            // Verificar que se guardó correctamente
            const verification = await chrome.storage.local.get(storageKey);            
        } catch (error) {
            console.error('[DEBUG] Error adding to history:', error);
            console.error('[DEBUG] Error details:', error.message, error.stack);
        }
    }
}

// FUNCIÓN DE DEBUG PARA VERIFICAR HISTORIAL EN STORAGE
window.debugHistoryStorage = async () => {
    try {        
        // Verificar todas las claves de historial
        const keys = ['historyImages', 'historyCode', 'historyText'];
        
        for (const key of keys) {
            const result = await chrome.storage.local.get(key);
            const history = result[key] || [];
        }
        
        // También verificar todas las claves en storage
        const allData = await chrome.storage.local.get(null);        
    } catch (error) {
        console.error('Error checking history storage:', error);
    }
};

// FUNCIONES DE DEBUG ESPECÍFICAS PARA PDF
window.debugPDFState = () => {
    const sc = window.selectionContextual;
    if (!sc) {
        return;
    }
};

window.forcePDFMode = () => {
    const sc = window.selectionContextual;
    if (sc) {
        return sc.forceEnablePDFMode();
    } else {
        return false;
    }
};

window.recheckPDF = () => {
    const sc = window.selectionContextual;
    if (sc) {
        sc.recheckForPDF();
    }
};

window.testPDFSelection = () => {
    const sc = window.selectionContextual;
    if (!sc) return;
    
    const selection = window.getSelection();
    if (selection.toString().trim()) {
        sc.handlePDFSelection({ clientX: 100, clientY: 100 });
    }
};

window.diagnosePDF = () => {    
    const analysis = {
        url: window.location.href,
        contentType: document.contentType,
        title: document.title,
        
        // Elementos PDF básicos
        pdfEmbeds: document.querySelectorAll('embed[type="application/pdf"]').length,
        pdfObjects: document.querySelectorAll('object[type="application/pdf"]').length,
        
        // Viewers
        hasViewer: !!document.querySelector('#viewer'),
        hasPDFJS: typeof window.PDFViewerApplication !== 'undefined',
        
        // Estado de la extensión
        isPDFMode: window.selectionContextual ? window.selectionContextual.isPDFViewer : false
    };
    
    console.table(analysis);
    return analysis;
};



window.redirectToPDFJS = (url) => {
    const sc = window.selectionContextual;
    if (sc) {
        sc.redirectToPDFJS(url);
    }
};

// Funciones de debugging para probar la API de Gemini
window.testGeminiModels = async (apiKey) => {
    if (!apiKey) {
        console.error('Proporciona una API key: testGeminiModels("tu-api-key")');
        return;
    }
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error Response:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();        
        if (data.models) {            
            const generateModels = data.models.filter(model => 
                model.supportedGenerationMethods?.includes('generateContent')
            );
            return generateModels;
        } else {
            console.warn('No se encontraron modelos en la respuesta');
            return [];
        }
        
    } catch (error) {
        console.error('Error completo:', error);
        return null;
    }
};

// Función para probar un modelo específico
window.testSpecificModel = async (apiKey, modelName) => {
    if (!apiKey || !modelName) {
        console.error('Uso: testSpecificModel("tu-api-key", "models/gemini-2.5-flash")');
        return;
    }
    try {
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: "Responde con una sola palabra: ÉXITO"
                    }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 10
                }
            })
        });        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error Response:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();        
        if (data.candidates && data.candidates.length > 0) {
            const response_text = data.candidates[0].content.parts[0].text;
            return { success: true, text: response_text };
        }
        
        return { success: false, error: 'Sin candidatos en la respuesta' };
        
    } catch (error) {
        console.error('Error probando modelo:', error);
        return { success: false, error: error.message };
    }
};

// Función de diagnóstico completo
window.fullGeminiDiagnostic = async (apiKey) => {
    if (!apiKey) {
        console.error('Proporciona una API key: fullGeminiDiagnostic("tu-api-key")');
        return;
    }    
    // Paso 1: Listar modelos
    const models = await window.testGeminiModels(apiKey);
    if (!models || models.length === 0) {
        console.error('No se pudieron obtener modelos. Diagnóstico terminado.');
        return;
    }
    
    // Paso 2: Probar modelos principales
    const testModels = [
        'models/gemini-2.5-flash',
        'models/gemini-2.5-pro',
        'models/gemini-2.0-flash'
    ];
        
    const results = {};
    
    for (const modelName of testModels) {
        const result = await window.testSpecificModel(apiKey, modelName);
        results[modelName] = result;
    }
    
    // Resumen
    const workingModels = Object.entries(results).filter(([_, result]) => result.success);
    const failingModels = Object.entries(results).filter(([_, result]) => !result.success);
    if (workingModels.length > 0) {
        const recommendedModel = workingModels[0][0];
    }
    
    return results;
};

window.SelectionContextual = SelectionContextual;

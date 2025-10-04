// Global i18n function 't' provided by utils/i18n.js

// DEBUG MODE - Set to false for production
const DEBUG_AUDIO_PLAYER = false;
const debugLog = (...args) => DEBUG_AUDIO_PLAYER && console.log('[AudioPlayer]', ...args);
const debugWarn = (...args) => DEBUG_AUDIO_PLAYER && console.warn('[AudioPlayer]', ...args);
const debugError = (...args) => console.error('[AudioPlayer]', ...args); // Errors always show

// Clase para el reproductor de audio global
class AudioPlayer {
    constructor(settings) {
        this.settings = settings;
        this.isPlaying = false;
        this.isPaused = false;
        this.currentParagraphIndex = 0;
        this.paragraphs = [];
        this.currentUtterance = null;
        this.playerElement = null;
        this.isDraggingMini = false; // Variable para controlar el estado de drag
        this.selectedVoiceIndex = 0; // Índice de voz seleccionada
        this.pausedAtParagraphIndex = -1; // Párrafo donde se pausó para detectar cambios
        
        // Rastreo de progreso de lectura (para pause/resume con voces de Google)
        this.lastCharIndex = 0; // Último carácter leído (actualizado por onboundary)
        this.pausedCharIndex = undefined; // Índice donde se pausó (para reanudar desde ahí)
        
        // Propiedades para auto-hide/dock
        this.isDocked = false; // Estado de dock lateral
        this.dockThreshold = 1; // Píxeles desde el borde izquierdo para activar dock (prácticamente pegado al borde)
        this.dockTab = null; // Elemento tab/handle para arrastrar cuando está docked
        this.preventAutoDock = false; // Bandera temporal para evitar auto-dock no deseado
        this.isActivelyDragging = false; // Bandera para prevenir dock durante arrastre activo
        this.isRefreshing = false; // Para evitar refreshes múltiples
        this.userManuallyMinimized = false; // Para evitar cambios automáticos de tamaño
        this.observerPaused = false; // Para controlar detección de cambios
        this.angularPollingInterval = null; // Intervalo para Angular docs
        
        // OPTIMIZACIÓN: Carga progresiva
        this.isLoadingContent = false;
        this.contentLoadProgress = 0;
        this.totalContentElements = 0;
        this.loadedContentElements = 0;
        
        this.init();
    }
    
    async init() {        
        // Cargar configuraciones de voz
        await this.loadVoiceSettings();
        
        // Restaurar limpieza (pero mejorada)
        this.cleanupExistingPlayers();
        
        // Asegurar limpieza del estado dock global
        this.isDocked = false;
        this.preventAutoDock = false;
        this.isActivelyDragging = false;
        
        // OPTIMIZACIÓN: Crear reproductor PRIMERO (interfaz inmediata)
        this.createPlayer();
        this.setupEventListeners();
        
        // OPTIMIZACIÓN: Extraer párrafos de forma ASÍNCRONA en segundo plano
        // Esto permite que el reproductor aparezca inmediatamente
        this.extractParagraphsAsync();
        
        // Configurar viewport containment en resize de ventana
        this.setupWindowResizeHandler();
        
        // Configurar detección específica para Angular docs
        this.setupAngularDocsDetection();
    }
    
    // Handler para resize de ventana
    setupWindowResizeHandler() {
        let resizeTimeout;
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (!this.isDocked) {
                    this.forceViewportContainment();
                }
            }, 250); // Debounce de 250ms
        };
        
        window.addEventListener('resize', handleResize);
    }
    
    setupAngularDocsDetection() {
        // Detectar entorno SPA (Single Page Application) universal
        const spaInfo = this.detectSPAEnvironment();
        
        if (!spaInfo.isSPA) {
            this.setupBasicURLDetection();
            return;
        }
        // Sistema simplificado: solo refresh manual y shortcuts
        this.setupManualControls();
            }
    
    initializeHybridDetection(spaInfo) {
        // 1. Variables de estado
        this.lastURL = window.location.href;
        this.lastTitle = document.title;
        this.lastContentSnapshot = this.getSPAContentSnapshot();
        this.lastParagraphCount = this.paragraphs.length;
        this.contentChangesPending = false;
        this.autoDetectionEnabled = true;
        
        // 2. Encontrar contenedor principal
        this.mainContentContainer = this.findMainContentContainer();
        
        // 3. Configurar múltiples estrategias de detección
        this.setupNavigationInterception();
        this.setupMutationObserver();
        this.setupAdaptivePolling(spaInfo);
        this.setupFrameworkSpecificEvents(spaInfo);
        this.setupVisibilityTracking();
        this.setupManualControls();
    }
    
    detectSPAEnvironment() {
        // Detectar diferentes tipos de SPAs
        const indicators = [
            // Angular
            window.location.hostname.includes('angular.io'),
            document.querySelector('app-root'),
            document.querySelector('[ng-version]'),
            
            // React
            document.querySelector('#root'),
            document.querySelector('[data-reactroot]'),
            
            // Vue
            document.querySelector('#app'),
            document.querySelector('[data-v-]'),
            
            // Otros frameworks
            document.querySelector('.docs-content'),
            document.querySelector('.content'),
            document.querySelector('main'),
            
            // Indicadores generales de SPA
            window.history.pushState && window.history.replaceState,
            document.querySelector('[role="main"]'),
            
            // URLs que típicamente usan SPAs
            window.location.pathname.includes('/guide/'),
            window.location.pathname.includes('/docs/'),
            window.location.pathname.includes('/api/'),
            
            // Títulos que cambian dinámicamente
            document.title.toLowerCase().includes('docs'),
            document.title.toLowerCase().includes('guide'),
            
            // Detección de navegación lateral/menús
            document.querySelector('nav ul li'),
            document.querySelector('.sidebar'),
            document.querySelector('.navigation')
        ];
        
        const detectedCount = indicators.filter(Boolean).length;        
        return detectedCount >= 3; // Si al menos 3 indicadores son positivos
    }
    
    findMainContentContainer() {
        // Buscar el contenedor principal donde se actualiza el contenido
        // PRIORIDAD ALTA: Angular Docs específicos
        const angularDocsSelectors = [
            'div.content',  // Angular v17.angular.io específico
            '.docs-content',
            '.guide-content'
        ];
        
        // Verificar primero selectores específicos de Angular Docs
        for (const selector of angularDocsSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                const textLength = element.textContent?.trim().length || 0;
                const hasContent = element.querySelectorAll('h1, h2, h3, p').length > 0;
                
                if (textLength > 100 && hasContent) {
                    return element;
                }
            }
        }
        
        // Selectores generales con prioridad optimizada
        const candidates = [
            // Selectores semánticos principales
            'main',
            '[role="main"]',
            'article',
            
            // Contenedores de contenido específicos
            '.content',
            '.main-content',
            '.page-content',
            '.documentation-content',
            '.article-content',
            '#content',
            '#main-content',
            
            // Selectores más específicos
            'main .content',
            'main section',
            '.container main',
            '.wrapper main',
            
            // Angular Material y frameworks
            '.mat-sidenav-content',
            '[router-outlet]',
            'router-outlet + *',
            'app-root main',
            
            // React específicos
            '#root > div',
            '[data-reactroot] main',
            
            // Vue específicos
            '#app main',
            '#app .content'
        ];
        
        for (const selector of candidates) {
            const element = document.querySelector(selector);
            if (element && this.isValidContentContainer(element)) {
                return element;
            }
        }
        // Fallback: buscar el contenedor con más párrafos
        return this.findContainerWithMostContent();
    }
    
    isValidContentContainer(element) {
        // Validar si es un contenedor de contenido válido
        const textContent = element.textContent?.trim() || '';
        const paragraphs = element.querySelectorAll('p').length;
        const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
        const codeBlocks = element.querySelectorAll('pre, code').length;
        
        // Criterios más permisivos para div.content (Angular Docs)
        if (element.matches && element.matches('div.content')) {
            return textContent.length > 100 && (paragraphs > 1 || headings > 0 || codeBlocks > 0);
        }
        
        // Criterios específicos para contenedores de documentación
        if (element.className && element.className.includes('docs')) {
            return textContent.length > 150 && (paragraphs > 1 || headings > 0);
        }
        
        // Criterios generales
        return textContent.length > 200 && (paragraphs > 2 || headings > 1);
    }
    
    findContainerWithMostContent() {
        const containers = document.querySelectorAll('div, section, article, main');
        let bestContainer = null;
        let maxScore = 0;
        
        containers.forEach(container => {
            const paragraphs = container.querySelectorAll('p').length;
            const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
            const textLength = container.textContent?.trim().length || 0;
            
            const score = paragraphs * 2 + headings * 3 + (textLength > 1000 ? 10 : 0);
            
            if (score > maxScore && textLength > 200) {
                maxScore = score;
                bestContainer = container;
            }
        });
        
        return bestContainer;
    }
    
    setupMainContentObserver() {
        // Observador específico del contenedor principal
        this.mainContentObserver = new MutationObserver((mutations) => {
            if (this.isPlaying || this.observerPaused) return;
            
            let contentChanged = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    const addedNodes = Array.from(mutation.addedNodes);
                    const removedNodes = Array.from(mutation.removedNodes);
                    
                    // Detectar cambios significativos en el contenido
                    const hasSignificantChange = [...addedNodes, ...removedNodes].some(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const text = node.textContent?.trim() || '';
                            // Detectar párrafos nuevos, títulos, o bloques de texto largos
                            return node.matches && node.matches('p, h1, h2, h3, h4, h5, h6, section, article') 
                                   && text.length > 50;
                        }
                        return false;
                    });
                    
                    if (hasSignificantChange) {
                        contentChanged = true;
                    }
                }
            });
            
            if (contentChanged) {
                this.scheduleSPAUpdate();
            }
        });
        
        // Observar solo el contenedor principal
        this.mainContentObserver.observe(this.mainContentContainer, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });
    }
    
    getSPAContentSnapshot() {
        // Usar el contenedor principal detectado o buscar uno adecuado
        let container = this.mainContentContainer;
        
        if (!container) {
            // Buscar el mejor contenedor disponible - Prioridad para Angular Docs
            const candidates = [
                // Angular Docs específicos (v17.angular.io y angular.dev)
                document.querySelector('div.content'),
                document.querySelector('.docs-content'),
                document.querySelector('.guide-content'),
                document.querySelector('[role="main"]'),
                document.querySelector('main'),
                // Contenedores Angular Material y Router
                document.querySelector('.mat-sidenav-content'),
                document.querySelector('[router-outlet]'),
                // Contenedores genéricos de documentación
                document.querySelector('article'),
                document.querySelector('.content'),
                document.querySelector('.main-content'),
                document.querySelector('.page-content'),
                document.querySelector('.documentation'),
                // Contenedores de frameworks
                document.querySelector('#app'),
                document.querySelector('.app-content'),
                // Último recurso
                document.body
            ];
            
            // Buscar contenedor con suficiente contenido textual
            container = candidates.find(c => {
                if (!c) return false;
                const textLength = c.textContent?.length || 0;
                const hasHeaders = c.querySelectorAll('h1, h2, h3, h4').length > 0;
                const hasParagraphs = c.querySelectorAll('p').length > 3;
                
                // Para Angular Docs, ser más permisivo con div.content
                if (c.matches && c.matches('div.content')) {
                    return textLength > 100 && (hasHeaders || hasParagraphs);
                }
                
                return textLength > 200 && hasHeaders && hasParagraphs;
            }) || document.body;
            
            // Actualizar referencia si encontramos algo mejor
            if (container !== document.body && !this.mainContentContainer) {
                this.mainContentContainer = container;
            }
        }
        
        // Crear snapshot detallado del contenido
        const titles = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).slice(0, 5);
        const paragraphs = Array.from(container.querySelectorAll('p')).slice(0, 6);
        const codeBlocks = Array.from(container.querySelectorAll('pre, code')).slice(0, 3);
        
        // Contar elementos estructurales para detectar cambios
        const elementCounts = {
            titles: container.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
            paragraphs: container.querySelectorAll('p').length,
            sections: container.querySelectorAll('section, article, div.section').length,
            codeBlocks: container.querySelectorAll('pre, code').length,
            lists: container.querySelectorAll('ul, ol').length,
            links: container.querySelectorAll('a').length
        };
        
        // Crear muestra de texto representativa
        const textElements = [...titles, ...paragraphs, ...codeBlocks];
        const textSnapshot = textElements
            .map(el => el.textContent?.trim().substring(0, 50))
            .filter(text => text && text.length > 8)
            .slice(0, 8) // Limitar a los primeros 8 elementos más relevantes
            .join('|');
        
        // Crear snapshot estructural más completo
        const structureSnapshot = `${elementCounts.titles}:${elementCounts.paragraphs}:${elementCounts.sections}:${elementCounts.codeBlocks}:${elementCounts.lists}:${elementCounts.links}`;
        
        // Agregar información de contexto adicional
        const contextInfo = {
            url: window.location.pathname,
            title: document.title.substring(0, 50),
            containerTag: container.tagName.toLowerCase(),
            timestamp: Date.now()
        };
        
        const contextSnapshot = `${contextInfo.url}|${contextInfo.title}|${contextInfo.containerTag}`;
        
        return `${textSnapshot}###${structureSnapshot}###${contextSnapshot}`;
    }
    
    // Función auxiliar para crear hash simple del contenido
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convertir a 32bit
        }
        return hash.toString();
    }
    
    setupSPAPolling() {
        // Este método ya está implementado en setupAngularDocsDetection
        // Lo mantenemos aquí por compatibilidad si se llama por separado
        if (this.spaPollingInterval) {
            clearInterval(this.spaPollingInterval);
        }
        
        const spaInfo = this.detectSPAEnvironment();
        if (spaInfo.isSPA) {
            const pollingInterval = spaInfo.frameworks.includes('Angular') ? 1200 : 1500;
            
            this.spaPollingInterval = setInterval(() => {
                if (!this.isPlaying && !this.observerPaused && !this.isRefreshing) {
                    this.checkForSPAContentChange();
                }
            }, pollingInterval);
        }
    }
    
    setupManualControls() {        
        // Agregar controles adicionales al reproductor
        this.addManualControlsToPlayer();
        
        // Configurar indicador visual de cambios pendientes
        this.setupChangeIndicator();
    }
    
    addManualControlsToPlayer() {
        // Este método se llamará después de crear el player
        // Lo implementaremos en el HTML del reproductor
        this.manualControlsAdded = true;
    }
    
    setupChangeIndicator() {
        // Crear indicador visual de cambios pendientes
        this.changeIndicator = document.createElement('div');
        this.changeIndicator.style.cssText = `
            position: fixed !important;
            top: 50% !important;
            right: 10px !important;
            width: 8px !important;
            height: 8px !important;
            background: #ff6b35 !important;
            border-radius: 50% !important;
            z-index: 2147483647 !important;
            opacity: 0 !important;
            transition: opacity 0.3s ease !important;
            box-shadow: 0 0 10px rgba(255, 107, 53, 0.6) !important;
        `;
        document.body.appendChild(this.changeIndicator);
    }
    

    
    async manualRefreshContent() {        
        // Actualizar estado inmediatamente
        const statusElement = this.playerElement?.querySelector('#statusMini');
        if (statusElement) {
            const isSpanish = navigator.language.startsWith('es');
            statusElement.textContent = isSpanish 
                ? 'Actualizando contenido...' 
                : 'Updating content...';
        }
        
        // Forzar refresh independientemente del estado
        const wasPlaying = this.isPlaying;
        const wasPaused = this.isPaused;
        
        // Detener audio si está reproduciéndose
        if (this.currentUtterance) {
            speechSynthesis.cancel();
            this.currentUtterance = null;
        }
        
        // OPTIMIZACIÓN: Mostrar estado de carga
        this.isLoadingContent = true;
        this.updateProgressDisplay(0, '...', true);
        this.disablePlayerButtons(true);
        
        // Limpiar y re-extraer contenido de forma asíncrona
        this.mainContentContainer = this.findMainContentContainer();
        await this.extractParagraphsAsync();
        
        // SIEMPRE resetear al inicio después del refresh
        this.currentParagraphIndex = 0;
        
        // Hacer scroll al inicio de la página
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        
        // Restaurar estado de reproducción pero desde el inicio
        if (wasPlaying) {
            // Si estaba reproduciéndose, mantener el estado de reproducción pero desde el inicio
            this.highlightCurrentParagraph();
            this.updatePlayPauseButtons(true);
            // Iniciar reproducción desde el primer párrafo
            setTimeout(() => {
                this.play();
            }, 500); // Pequeño delay para que termine el scroll
        } else if (wasPaused) {
            // Si estaba pausado, resetear al inicio pero mantener pausado
            this.highlightCurrentParagraph();
            this.updatePlayPauseButtons(false);
            this.isPaused = true;
        } else {
            // Si estaba detenido, simplemente resetear
            this.isPlaying = false;
            this.isPaused = false;
            this.updatePlayPauseButtons(false);
        }
        
        this.updateProgress();
        this.hideChangeIndicator();
        this.updateStatus(t('contentUpdatedRestarted').replace('{0}', this.paragraphs.length));
        
        // Mostrar notificación
        this.showManualRefreshNotification();
    }
    

    
    showManualRefreshNotification() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed !important; top: 80px !important; right: 20px !important;
            background: rgba(30, 30, 35, 0.95) !important; color: rgba(255, 255, 255, 0.9) !important;
            padding: 12px 16px !important; border-radius: 8px !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important; z-index: 2147483645 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            font-size: 13px !important; font-weight: 500 !important;
            transform: translateX(100%) !important; transition: transform 0.3s ease !important;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
            backdrop-filter: blur(10px) !important;
        `;
        notification.innerHTML = `${t('contentUpdated')}<br><span style="font-size: 11px; opacity: 0.7; font-family: inherit !important;">${t('restartedFromBeginning')}</span>`;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.style.transform = 'translateX(0)', 100);
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    showVoiceChangeNotification() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed !important; top: 80px !important; right: 20px !important;
            background: rgba(30, 30, 35, 0.95) !important; color: rgba(255, 255, 255, 0.9) !important;
            padding: 12px 16px !important; border-radius: 8px !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important; z-index: 2147483651 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            font-size: 13px !important; font-weight: 500 !important;
            transform: translateX(100%) !important; transition: transform 0.3s ease !important;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
            backdrop-filter: blur(10px) !important;
        `;
        notification.innerHTML = `${t('voiceConfigSaved')}<br><span style="font-size: 11px; opacity: 0.7; font-family: inherit !important;">${t('newVoiceWillApply')}</span>`;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.style.transform = 'translateX(0)', 100);
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    hideChangeIndicator() {
        if (this.changeIndicator) {
            this.changeIndicator.style.opacity = '0';
            this.contentChangesPending = false;
        }
    }
    
    showChangeIndicator() {
        if (this.changeIndicator) {
            this.changeIndicator.style.opacity = '1';
            this.contentChangesPending = true;
            
            // Auto-hide después de 5 segundos
            setTimeout(() => {
                if (this.changeIndicator) {
                    this.changeIndicator.style.opacity = '0';
                }
            }, 5000);
        }
    }
    
    setupNavigationInterception() {        
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = (...args) => {
            originalPushState.apply(history, args);
            this.scheduleContentCheck('navigation-push', 200);
        };
        
        history.replaceState = (...args) => {
            originalReplaceState.apply(history, args);
            this.scheduleContentCheck('navigation-replace', 200);
        };
        
        window.addEventListener('popstate', () => {
            this.scheduleContentCheck('navigation-pop', 300);
        });
        
        window.addEventListener('hashchange', () => {
            this.scheduleContentCheck('navigation-hash', 100);
        });
    }
    
    setupMutationObserver() {        
        const targetNode = this.mainContentContainer || document.body;
        
        this.mutationObserver = new MutationObserver((mutations) => {
            if (this.isPlaying || this.observerPaused) return;
            
            let significantChange = false;
            let changeType = '';
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    const relevantChanges = [...mutation.addedNodes, ...mutation.removedNodes]
                        .filter(node => {
                            if (node.nodeType !== Node.ELEMENT_NODE) return false;
                            
                            // Detectar elementos de contenido significativo
                            const isContentElement = node.matches && node.matches(
                                'p, h1, h2, h3, h4, h5, h6, section, article, div.content, ' +
                                'pre, code, blockquote, li, ul, ol'
                            );
                            
                            const hasSignificantText = node.textContent && node.textContent.trim().length > 30;
                            
                            return isContentElement && hasSignificantText;
                        });
                    
                    if (relevantChanges.length > 0) {
                        significantChange = true;
                        changeType = 'content-structure';
                        break;
                    }
                }
                
                if (mutation.type === 'characterData') {
                    const text = mutation.target.textContent || '';
                    if (text.trim().length > 20) {
                        significantChange = true;
                        changeType = 'text-content';
                    }
                }
            }
            
            if (significantChange) {
                this.scheduleContentCheck('mutation-' + changeType, 400);
            }
        });
        
        this.mutationObserver.observe(targetNode, {
            childList: true,
            subtree: true,
            characterData: true
        });
        
    }
    
    setupAdaptivePolling(spaInfo) {        
        // Intervalos adaptativos según framework y actividad
        this.pollingIntervals = {
            active: spaInfo.frameworks.includes('Angular') ? 800 : 1000,    // Usuario activo
            passive: 2500,  // Usuario pasivo
            background: 5000 // Página en background
        };
        
        this.currentPollingInterval = this.pollingIntervals.active;
        this.lastUserActivity = Date.now();
        
        // Detectar actividad del usuario
        ['click', 'scroll', 'keydown', 'mousemove'].forEach(event => {
            document.addEventListener(event, () => {
                this.lastUserActivity = Date.now();
            }, { passive: true });
        });
        
        this.startAdaptivePolling();
    }
    
    startAdaptivePolling() {
        if (this.pollingTimer) clearInterval(this.pollingTimer);
        
        this.pollingTimer = setInterval(() => {
            if (!this.autoDetectionEnabled) return;
            
            // Ajustar frecuencia según actividad del usuario
            const timeSinceActivity = Date.now() - this.lastUserActivity;
            let targetInterval;
            
            if (document.hidden) {
                targetInterval = this.pollingIntervals.background;
            } else if (timeSinceActivity < 10000) { // 10 segundos
                targetInterval = this.pollingIntervals.active;
            } else {
                targetInterval = this.pollingIntervals.passive;
            }
            
            // Actualizar intervalo si es necesario
            if (targetInterval !== this.currentPollingInterval) {
                this.currentPollingInterval = targetInterval;
                this.startAdaptivePolling(); // Reiniciar con nuevo intervalo
                return;
            }
            
            if (!this.isPlaying && !this.observerPaused && !this.isRefreshing) {
                this.scheduleContentCheck('adaptive-polling', 0);
            }
        }, this.currentPollingInterval);
    }
    
    setupFrameworkSpecificEvents(spaInfo) {       
        // Angular específico
        if (spaInfo.frameworks.includes('Angular')) {
            // Escuchar eventos de Angular Router
            document.addEventListener('DOMContentLoaded', () => {
                const ngZone = window.ng && window.ng.getContext && window.ng.getContext(document.body);
                if (ngZone) {
                    // Podríamos usar ngZone para detectar cambios, pero es complejo
                }
            });
            
            // Detectar cambios en router-outlet
            const routerOutlet = document.querySelector('router-outlet');
            if (routerOutlet) {
                this.mutationObserver.observe(routerOutlet, {
                    childList: true,
                    subtree: true
                });
            }
        }
        
        // React específico
        if (spaInfo.frameworks.includes('React')) {
            // React DevTools events (si están disponibles)
            if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
            }
        }
        
        // Eventos genéricos de SPA
        window.addEventListener('load', () => this.scheduleContentCheck('page-load', 1000));
        document.addEventListener('DOMContentLoaded', () => this.scheduleContentCheck('dom-ready', 500));
    }
    
    scheduleContentCheck(source, delay = 0) {
        // Evitar múltiples checks programados
        if (this.contentCheckTimer) {
            clearTimeout(this.contentCheckTimer);
        }
        
        this.contentCheckTimer = setTimeout(() => {
            if (this.autoDetectionEnabled) {
                this.checkForSPAContentChange();
            }
        }, delay);
    }
    
    setupBasicURLDetection() {        
        this.lastURL = window.location.href;
        this.lastTitle = document.title;
        
        this.setupNavigationInterception();
        
        // Polling básico para sitios que cambian contenido sin cambiar URL
        setInterval(() => {
            if (!this.isPlaying && document.title !== this.lastTitle) {
                this.lastTitle = document.title;
                this.extractParagraphs();
                this.updateStatus('Contenido actualizado');
            }
        }, 3000);
    }
    
    interceptSPANavigation() {
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = (...args) => {
            originalPushState.apply(history, args);
            setTimeout(() => this.checkForSPAContentChange(), 300);
        };
        
        history.replaceState = (...args) => {
            originalReplaceState.apply(history, args);
            setTimeout(() => this.checkForSPAContentChange(), 300);
        };
        
        window.addEventListener('popstate', () => {
            setTimeout(() => this.checkForSPAContentChange(), 400);
        });
        
        // También escuchar eventos de hash para navegación interna
        window.addEventListener('hashchange', () => {
            setTimeout(() => this.checkForSPAContentChange(), 200);
        });
    }
    
    checkForSPAContentChange() {
        if (this.isPlaying || this.observerPaused || this.isRefreshing) return;
        
        const currentURL = window.location.href;
        const currentTitle = document.title;
        const currentSnapshot = this.getSPAContentSnapshot();
        
        // Re-extraer párrafos para comparar cantidad real
        const tempParagraphs = this.paragraphs.length;
        this.extractParagraphs();
        const currentParagraphCount = this.paragraphs.length;
        
        // Verificar específicamente el contenido de div.content para Angular Docs
        let angularContentChanged = false;
        const angularContentDiv = document.querySelector('div.content');
        if (angularContentDiv) {
            const currentAngularContent = angularContentDiv.textContent?.substring(0, 500) || '';
            if (!this.lastAngularContent) {
                this.lastAngularContent = currentAngularContent;
            }
            angularContentChanged = currentAngularContent !== this.lastAngularContent && currentAngularContent.length > 100;
            
            if (angularContentChanged) {
                this.lastAngularContent = currentAngularContent;
            }
        }
        
        const urlChanged = currentURL !== this.lastURL;
        const titleChanged = currentTitle !== this.lastTitle;
        const contentChanged = currentSnapshot !== this.lastContentSnapshot && currentSnapshot.length > 20;
        const paragraphCountChanged = Math.abs(currentParagraphCount - this.lastParagraphCount) > 1; // Más sensible
        
        if (urlChanged || titleChanged || contentChanged || paragraphCountChanged || angularContentChanged) {    
            // Mostrar indicador visual de cambios pendientes
            this.showChangeIndicator();
            
            // Si no tenemos contenedor principal, intentar encontrarlo de nuevo
            if (!this.mainContentContainer) {
                this.mainContentContainer = this.findMainContentContainer();
            }
            
            this.lastURL = currentURL;
            this.lastTitle = currentTitle;
            this.lastContentSnapshot = currentSnapshot;
            this.lastParagraphCount = currentParagraphCount;
            
            this.scheduleSPAUpdate();
        }
    }
    
    scheduleSPAUpdate() {
        if (this.isRefreshing) return;
            this.isRefreshing = true;
        
        setTimeout(() => {
            if (!this.isPlaying && !this.observerPaused) {
                this.refreshSPAContent();
            }
            this.isRefreshing = false;
        }, 800); // Tiempo optimizado para SPAs
    }
    
    refreshSPAContent() {        
        const wasPlaying = this.isPlaying;
        const wasPaused = this.isPaused;
        const currentIndex = this.currentParagraphIndex;
        
        const previousCount = this.paragraphs.length;
        this.extractParagraphs();
        const newCount = this.paragraphs.length;        
        // Restaurar estado de reproducción
        if (wasPlaying) {
            this.isPlaying = true;
            this.currentParagraphIndex = Math.min(currentIndex, newCount - 1);
            this.highlightCurrentParagraph();
            this.updatePlayPauseButtons(true);
            this.updateStatus(t('continuingPlayback'));
        } else if (wasPaused) {
            this.isPaused = true;
            this.pausedAtParagraphIndex = Math.min(currentIndex, newCount - 1);
            this.currentParagraphIndex = this.pausedAtParagraphIndex;
            this.highlightCurrentParagraph();
            this.updatePlayPauseButtons(false);
            this.updateStatus(t('playbackPaused'));
        } else {
            this.currentParagraphIndex = 0;
            this.pausedAtParagraphIndex = -1;
            this.updatePlayPauseButtons(false);
            this.updateStatus(t('contentUpdatedParagraphs').replace('{0}', newCount));
        }
        
        this.updateProgress();
        
        // Ocultar indicador de cambios pendientes
        this.hideChangeIndicator();
        
        // Mostrar notificación para cambios significativos
        if (Math.abs(newCount - previousCount) > 2) {
            this.showSPANotification(newCount, previousCount);
        }
    }
    
    showSPANotification(newCount, oldCount) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed !important; top: 80px !important; right: 20px !important;
            background: rgba(30, 30, 35, 0.95) !important; color: rgba(255, 255, 255, 0.9) !important;
            padding: 10px 16px !important; border-radius: 8px !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important; z-index: 2147483645 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            font-size: 13px !important; font-weight: 500 !important;
            transform: translateX(100%) !important; transition: transform 0.3s ease !important;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
            backdrop-filter: blur(10px) !important;
        `;
        
        notification.innerHTML = t('contentUpdatedCount').replace('{0}', oldCount).replace('{1}', newCount);
        
        document.body.appendChild(notification);
        setTimeout(() => notification.style.transform = 'translateX(0)', 100);
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 2500);
    }
    
    // Métodos para control de detección
    pauseContentObserver() {
        this.observerPaused = true;
        
        // Pausar polling de Angular si existe
        if (this.angularPollingInterval) {
            clearInterval(this.angularPollingInterval);
            this.angularPollingInterval = null;
        }
    }
    
    resumeContentObserver() {
        this.observerPaused = false;
        
        // Reanudar polling de Angular si estamos en Angular docs
        if (window.location.hostname.includes('angular.io') && !this.angularPollingInterval) {
            this.angularPollingInterval = setInterval(() => {
                if (!this.isPlaying && !this.observerPaused && !this.isRefreshing) {
                    this.checkForAngularContentChange();
                }
            }, 2000);
        }
    }
    
    setupBasicURLDetection() {
        
        let currentURL = window.location.href;
        
        // Solo observar cambios de URL usando pushState/replaceState (SPA navigation)
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(...args) {
            originalPushState.apply(history, args);
            window.dispatchEvent(new Event('urlchange'));
        };
        
        history.replaceState = function(...args) {
            originalReplaceState.apply(history, args);
            window.dispatchEvent(new Event('urlchange'));
        };
        
        // Escuchar eventos de cambio de URL SOLO si no estamos reproduciendo
        window.addEventListener('urlchange', () => {
            const newURL = window.location.href;
            if (newURL !== currentURL && !this.isPlaying && !this.isRefreshing && !this.observerPaused) {
                currentURL = newURL;
                
                // Actualizar contenido después de un delay MUY LARGO
                this.isRefreshing = true;
                setTimeout(() => {
                    if (!this.isPlaying && !this.observerPaused) { // Verificar de nuevo
                        this.refreshContent();
                    }
                    this.isRefreshing = false;
                }, 4000); // 4 segundos de espera
            }
        });
        
        // También escuchar popstate (botón atrás/adelante) - pero MUY restrictivo
        window.addEventListener('popstate', () => {
            if (!this.isPlaying && !this.isRefreshing && !this.isPaused && !this.observerPaused) {
                this.isRefreshing = true;
                setTimeout(() => {
                    if (!this.isPlaying && !this.isPaused && !this.observerPaused) { // Triple verificación
                        this.refreshContent();
                    }
                    this.isRefreshing = false;
                }, 4000);
            }
        });
    }
    
    setupURLObserver() {
        let currentURL = window.location.href;
        
        // Observar cambios de URL usando pushState/replaceState
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(...args) {
            originalPushState.apply(history, args);
            window.dispatchEvent(new Event('urlchange'));
        };
        
        history.replaceState = function(...args) {
            originalReplaceState.apply(history, args);
            window.dispatchEvent(new Event('urlchange'));
        };
        
        // Escuchar eventos de cambio de URL
        window.addEventListener('urlchange', () => {
            const newURL = window.location.href;
            if (newURL !== currentURL) {
                currentURL = newURL;
                
                // Actualizar contenido después de un delay
                setTimeout(() => {
                    this.refreshContent();
                }, 1500); // Dar tiempo para que el contenido se cargue
            }
        });
        
        // También escuchar popstate (botón atrás/adelante) - pero solo si no estamos reproduciendo
        window.addEventListener('popstate', () => {
            if (!this.isPlaying && !this.isRefreshing) {
                setTimeout(() => {
                    this.refreshContent();
                }, isAngularDocs ? 1500 : 2000);
            }
        });
        
    }
    
    async refreshContent() {
        
        // Si estamos reproduciendo, NO interrumpir - solo actualizar en segundo plano
        const wasPlaying = this.isPlaying;
        const wasPaused = this.isPaused;
        const currentIndex = this.currentParagraphIndex;
        
        if (wasPlaying) {
            // NO detener la reproducción, solo actualizar párrafos
        } else {
            // Solo detener si no estaba reproduciendo
            if (this.isPaused) {
                speechSynthesis.cancel();
                this.isPlaying = false;
                this.isPaused = false;
            }
            
            // Limpiar resaltado anterior solo si no estamos reproduciendo
            this.removeHighlight();
        }
        
        // OPTIMIZACIÓN: Mostrar estado de carga
        this.isLoadingContent = true;
        this.updateProgressDisplay(currentIndex, '...', true);
        this.disablePlayerButtons(true);
        
        // Re-extraer párrafos de forma asíncrona
        const previousCount = this.paragraphs.length;
        await this.extractParagraphsAsync();
        const newCount = this.paragraphs.length;        
        // Debug específico para Angular docs
        if (window.location.hostname.includes('angular.io') && newCount === 0) {    
            // Intentar extraer párrafos de forma más agresiva para Angular docs
            const allParagraphs = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
            if (allParagraphs.length > 0) {
                setTimeout(() => {
                    this.extractParagraphs();
                    const retryCount = this.paragraphs.length;
                    if (retryCount > 0) {
                        this.updateProgress();
                        this.updateStatus(t('contentDetected').replace('{0}', retryCount));
                        this.showContentUpdateNotification(retryCount);
                    }
                }, 1000);
            }
        }
        
        // Restaurar estado si estaba reproduciendo
        if (wasPlaying) {
            this.isPlaying = true;
            this.currentParagraphIndex = Math.min(currentIndex, newCount - 1);
            this.highlightCurrentParagraph();
            this.updatePlayPauseButtons(true);
            this.updateStatus(t('continuingPlayback'));
        } else if (wasPaused) {
            this.isPaused = true;
            this.pausedAtParagraphIndex = Math.min(currentIndex, newCount - 1);
            this.currentParagraphIndex = this.pausedAtParagraphIndex;
            this.highlightCurrentParagraph();
            this.updatePlayPauseButtons(false);
            this.updateStatus(t('playbackPaused'));
        } else {
            // Solo resetear si no estaba reproduciendo
            this.currentParagraphIndex = 0;
            this.pausedAtParagraphIndex = -1;
            this.updateStatus(t('contentUpdatedParagraphsAvailable').replace('{0}', newCount));
            this.updatePlayPauseButtons(false);
        }
        
        // Actualizar UI
        this.updateProgress();
        
        // Mostrar notificación solo si hay cambio MUY significativo
        if (Math.abs(newCount - previousCount) > 5) {
            this.showContentUpdateNotification(newCount);
        }
    }
    
    showContentUpdateNotification(paragraphCount) {
        // Crear notificación temporal
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed !important;
            top: 80px !important;
            right: 20px !important;
            background: rgba(31, 41, 55, 0.9) !important;
            color: rgba(156, 163, 175, 1) !important;
            padding: 12px 20px !important;
            border-radius: 8px !important;
            border: 1px solid rgba(100, 200, 255, 0.3) !important;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
            backdrop-filter: blur(10px) !important;
            z-index: 2147483645 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            max-width: 300px !important;
            transform: translateX(100%) !important;
            transition: transform 0.3s ease !important;
        `;
        notification.textContent = t('contentUpdatedNotification').replace('{0}', paragraphCount);
        
        document.body.appendChild(notification);
        
        // Animar entrada
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remover después de 3 segundos
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    // Método para scroll inteligente que compensa headers sticky
    smartScrollToElement(element, options = {}) {
        if (!element) return;
        
        const defaultOptions = {
            behavior: 'smooth',
            block: 'center',
            compensateSticky: true
        };
        
        const finalOptions = { ...defaultOptions, ...options };
        
        if (!finalOptions.compensateSticky) {
            // Scroll normal si no se requiere compensación
            element.scrollIntoView({
                behavior: finalOptions.behavior,
                block: finalOptions.block
            });
            return;
        }
        
        // Detectar y medir headers sticky/fixed
        const stickyOffset = this.calculateStickyOffset();
        
        if (stickyOffset === 0) {
            // No hay headers sticky, usar scroll normal
            element.scrollIntoView({
                behavior: finalOptions.behavior,
                block: finalOptions.block
            });
        } else {
            // Compensar por headers sticky usando scroll manual
            this.scrollWithStickyCompensation(element, stickyOffset, finalOptions);
        }
    }
    
    calculateStickyOffset() {
        let totalOffset = 0;
        
        // Selectors comunes para headers sticky
        const stickySelectors = [
            'header[style*="position: fixed"]',
            'header[style*="position: sticky"]',
            '.header-fixed',
            '.sticky-header',
            '.navbar-fixed',
            '.top-bar',
            '[style*="position: fixed"][style*="top: 0"]',
            '[style*="position: sticky"][style*="top: 0"]',
            // Angular Material específicos
            '.mat-toolbar',
            '.mat-header',
            // Bootstrap específicos
            '.navbar-fixed-top',
            '.fixed-top'
        ];
        
        stickySelectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    const styles = window.getComputedStyle(el);
                    const position = styles.position;
                    const zIndex = parseInt(styles.zIndex) || 0;
                    
                    // Verificar si es realmente sticky/fixed y visible
                    if ((position === 'fixed' || position === 'sticky') && 
                        styles.display !== 'none' && 
                        styles.visibility !== 'hidden' &&
                        zIndex >= 100) {
                        
                        const rect = el.getBoundingClientRect();
                        
                        // Solo contar si está en la parte superior
                        if (rect.top <= 10 && rect.height > 0) {
                            totalOffset = Math.max(totalOffset, rect.bottom);
                        }
                    }
                });
            } catch (e) {
                console.warn('Error al verificar selector sticky:', selector, e);
            }
        });
        
        // Añadir padding adicional si se detectaron headers
        if (totalOffset > 0) {
            totalOffset += 20; // 20px de padding extra
        }
        
        return totalOffset;
    }
    
    scrollWithStickyCompensation(element, stickyOffset, options) {
        const elementRect = element.getBoundingClientRect();
        const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
        
        // Calcular posición target basada en el block option
        let targetPosition;
        
        switch (options.block) {
            case 'start':
                targetPosition = currentScroll + elementRect.top - stickyOffset;
                break;
            case 'end':
                targetPosition = currentScroll + elementRect.bottom - window.innerHeight + stickyOffset;
                break;
            case 'center':
            default:
                const elementCenter = elementRect.top + (elementRect.height / 2);
                const viewportCenter = (window.innerHeight - stickyOffset) / 2;
                targetPosition = currentScroll + elementCenter - viewportCenter - stickyOffset;
                break;
        }
        
        // Asegurar que no se haga scroll más arriba del inicio del documento
        targetPosition = Math.max(0, targetPosition);       
        // Realizar scroll suave
        if (options.behavior === 'smooth') {
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        } else {
            window.scrollTo(0, targetPosition);
        }
    }
    
    cleanupExistingPlayers() {        
        // 🆕 Limpiar dock tabs huérfanos PRIMERO
        const existingDockTabs = document.querySelectorAll('#audioPlayerDockTab');
        existingDockTabs.forEach((tab, index) => {
            tab.remove();
        });
        
        const existingPlayers = document.querySelectorAll('.audio-player-global');
        existingPlayers.forEach((player, index) => {
            player.remove();
        });
        
    }
    
    // 🆕 Método completo de destrucción del reproductor
    destroy() {        
        // Limpiar dock tab si existe
        if (this.dockTab) {
            this.cleanupDockTabListeners();
            if (this.dockTab.parentNode) {
                this.dockTab.parentNode.removeChild(this.dockTab);
            }
            this.dockTab = null;
        }
        
        // Limpiar listeners globales
        if (this.dragHandler) {
            document.removeEventListener('mousemove', this.dragHandler);
        }
        if (this.endDragHandler) {
            document.removeEventListener('mouseup', this.endDragHandler);
        }
        if (this.touchMoveHandler) {
            document.removeEventListener('touchmove', this.touchMoveHandler);
        }
        if (this.touchEndHandler) {
            document.removeEventListener('touchend', this.touchEndHandler);
        }
        
        // Limpiar observers
        if (this.observer) {
            this.observer.disconnect();
        }
        
        // Limpiar intervalos
        if (this.angularPollingInterval) {
            clearInterval(this.angularPollingInterval);
        }
        if (this.spaPollingInterval) {
            clearInterval(this.spaPollingInterval);
        }
        
        // Remover element del DOM
        if (this.playerElement && this.playerElement.parentNode) {
            this.playerElement.parentNode.removeChild(this.playerElement);
        }
        
        // Reset estado
        this.isDocked = false;
        this.isMinimized = false;
    }
    
    // OPTIMIZACIÓN: Extracción asíncrona y progresiva de párrafos
    async extractParagraphsAsync() {
        this.isLoadingContent = true;
        this.contentLoadProgress = 0;
        this.loadedContentElements = 0;
        
        // Actualizar UI inmediatamente - mostrar estado de carga
        this.updateProgressDisplay(0, '...', true);
        this.disablePlayerButtons(true);
        
        try {
            // Usar requestIdleCallback si está disponible, sino setTimeout
            const scheduleWork = window.requestIdleCallback || ((cb) => setTimeout(cb, 0));
            
            await new Promise((resolve) => {
                scheduleWork(() => {
                    try {
                        this.extractParagraphs();
                        resolve();
                    } catch (error) {
                        console.error('Error extrayendo párrafos:', error);
                        resolve();
                    }
                }, { timeout: 2000 });
            });
            
            this.isLoadingContent = false;
            this.updateProgressDisplay(this.currentParagraphIndex, this.paragraphs.length, false);
            this.disablePlayerButtons(false);
            
            // IMPORTANTE: Actualizar la barra visual al estado inicial (1/100 = 1%)
            this.updateProgress();
            
            // Actualizar estado
            const statusElement = this.playerElement?.querySelector('#statusMini');
            if (statusElement) {
                const isSpanish = navigator.language.startsWith('es');
                const msg = isSpanish 
                    ? `Listo - ${this.paragraphs.length} elementos detectados`
                    : `Ready - ${this.paragraphs.length} elements detected`;
                statusElement.textContent = msg;
            }
            
        } catch (error) {
            console.error('Error cargando contenido:', error);
            this.isLoadingContent = false;
            this.updateProgressDisplay(0, 0, false);
            this.disablePlayerButtons(false);
        }
    }
    
    // Deshabilitar/habilitar botones durante carga
    disablePlayerButtons(disabled) {
        const buttons = [
            '#playPauseBtn', '#prevBtn', '#nextBtn', '#restartBtn',
            '#miniPlayPauseBtn', '#miniPrevBtn', '#miniNextBtn', '#miniRestartBtn'
        ];
        
        buttons.forEach(selector => {
            const btn = this.playerElement?.querySelector(selector);
            if (btn) {
                btn.disabled = disabled;
                if (disabled) {
                    btn.style.opacity = '0.5';
                    btn.style.cursor = 'not-allowed';
                } else {
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                }
            }
        });
    }
    
    // Actualizar el display de progreso
    updateProgressDisplay(current, total, isLoading = false) {
        // Actualizar texto de progreso
        const progressCurrent = this.playerElement?.querySelector('.progress-current');
        const progressTotal = this.playerElement?.querySelector('.progress-total');
        const statusElement = this.playerElement?.querySelector('#statusMini');
        
        if (isLoading) {
            const isSpanish = navigator.language.startsWith('es');
            const loadingText = isSpanish ? 'Cargando' : 'Loading';
            const statusText = isSpanish ? 'Procesando contenido...' : 'Processing content...';
            
            if (progressCurrent) {
                progressCurrent.textContent = '0';
                progressCurrent.classList.add('loading');
            }
            if (progressTotal) {
                progressTotal.textContent = loadingText;
                progressTotal.classList.add('loading');
            }
            if (statusElement) {
                statusElement.textContent = statusText;
                statusElement.classList.add('loading');
            }
        } else {
            // CORRECCIÓN: Validar que tengamos contenido válido antes de mostrar
            if (progressCurrent) {
                // Si no hay párrafos aún (total=0), mantener en 0
                progressCurrent.textContent = total > 0 ? (current + 1) : 0;
                progressCurrent.classList.remove('loading');
            }
            if (progressTotal) {
                progressTotal.textContent = total > 0 ? total : 0;
                progressTotal.classList.remove('loading');
            }
            if (statusElement) {
                statusElement.classList.remove('loading');
            }
        }
    }
    
    extractParagraphs() {
        // Detectar si estamos en Angular docs específicamente
        const isAngularDocs = window.location.hostname.includes('angular.io') || 
                             document.querySelector('.docs-content') ||
                             document.querySelector('[class*="angular"]') ||
                             document.title.toLowerCase().includes('angular');
        
        let paragraphSelectors = [];
        
        if (isAngularDocs) {            
            // Verificar si existe div.content (Angular v17)
            const angularContentDiv = document.querySelector('div.content');
            if (angularContentDiv) {
                // Selectores específicos para div.content
                paragraphSelectors = [
                    'div.content p',        // Párrafos específicos en div.content (PRIORIDAD MÁXIMA)
                    'div.content h1', 'div.content h2', 'div.content h3', 'div.content h4', 'div.content h5', 'div.content h6',
                    'div.content li',       // Listas en div.content
                    'div.content blockquote', // Citas en div.content
                    'div.content pre',      // Código en div.content
                    'div.content section p', // Párrafos en secciones dentro de div.content
                    'div.content article p', // Párrafos en artículos dentro de div.content
                    'div.content .section p', // Párrafos en clases section dentro de div.content
                ];
            } else {
                // Selectores prioritarios para otras versiones de Angular docs
                paragraphSelectors = [
                    // Contenido principal de Angular docs
                    'main p',               // Párrafos en main (prioritario)
                    '.docs-content p',      // Contenido de documentación
                    '.content p',           // Contenido general
                    'section p',            // Secciones de contenido
                    'article p',            // Artículos
                    '[role="main"] p',      // Contenido principal ARIA
                    // Títulos en Angular docs
                    'main h1', 'main h2', 'main h3', 'main h4', 'main h5', 'main h6',
                    'section h1', 'section h2', 'section h3', 'section h4', 'section h5', 'section h6',
                    // Listas y elementos específicos de Angular docs
                    'main li',              // Listas en contenido principal
                    'section li',           // Listas en secciones
                    'main blockquote',      // Citas
                    'section blockquote',   // Citas en secciones
                    // Código y ejemplos (importante en docs técnicas)
                    'main pre',             // Bloques de código
                    'section pre',          // Código en secciones
                    // Fallbacks para Angular docs
                    '.guide-content p',     // Contenido de guías
                    '[class*="guide"] p',   // Párrafos en guías
                    '.api-docs p',          // Documentación de API
                    '.reference p'          // Contenido de referencia
                ];
            }
        } else {
            // Selectores generales para otros sitios - MEJORADOS para evitar contenedores grandes
            paragraphSelectors = [
                // PRIORIDAD ALTA: Elementos específicos de texto
                'p',                    // Párrafos estándar
                'article p',            // Párrafos en artículos
                '.post-content p',      // Párrafos en posts
                '.entry-content p',     // Párrafos en entradas
                'main p',               // Párrafos en main
                '[role="main"] p',      // Párrafos en contenido principal
                '.content p',           // Párrafos específicos en contenido
                'section p',            // Párrafos en secciones
                
                // Títulos
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                
                // Listas y otros elementos de contenido
                'li',                   // Elementos de lista
                'blockquote',           // Citas
                'td',                   // Celdas de tabla con contenido
                
                // Sitios específicos
                '.mw-parser-output p',  // Wikipedia específico
                '.vector-body p',       // Wikipedia Vector theme
                '.markdown-body p',     // GitHub markdown
                
                // Se filtrarán después si son contenedores grandes
                'div[class*="text"]:not([class*="content"])', // Divs con texto pero no contenedores grandes
                'span[class*="text"]'   // Spans con texto
            ];
        }
        const elements = document.querySelectorAll(paragraphSelectors.join(', '));         
        this.paragraphs = [];
        
        elements.forEach((element, index) => {
            const text = element.textContent.trim();
            
            // Filtrar elementos no deseados
            if (text.length <= 5) return;
            
            // Excluir elementos sticky/fixed que interfieren con el scroll
            const computedStyle = window.getComputedStyle(element);
            if (computedStyle.position === 'sticky' || computedStyle.position === 'fixed') {
                return;
            }
            
            // Excluir elementos en headers sticky
            const stickyParent = element.closest('[style*="sticky"], [style*="fixed"], .sticky, .fixed, header[class*="sticky"], nav[class*="sticky"]');
            if (stickyParent) {
                return;
            }
            
            // NUEVO: Excluir elementos del propio reproductor de audio
            const audioPlayerParent = element.closest('.audio-player-global, .compact-player, .dock-tab, .audio-dock, .voice-settings-panel, #audioPlayerDockTab, #compactPlayer');
            if (audioPlayerParent) {
                return;
            }
            
            // Excluir por contenido específico del reproductor
            if (text === 'SpeedReader IA' || text.includes('párrafos') || text.match(/^\d+\s*\/\s*\d+$/)) {
                return;
            }
            
            // Excluir navegación común (pero no encabezados h1-h6)
            const navParent = element.closest('nav, .nav, .navigation, .menu, .breadcrumb, header, .header');
            const isHeading = /^h[1-6]$/i.test(element.tagName);
            
            if (navParent && text.length < 100 && !isHeading) { // No excluir encabezados aunque estén en header
                return;
            }
            
            // Detectar y filtrar contenedores grandes que interfieren con la lectura
            if (this.isLargeContainer(element, text)) {
                return;
            }
            
            // Evitar duplicados de texto (conservador)
            if (this.isDuplicateContent(text, element)) {
                return;
            }
            
            // Filtrar elementos que son principalmente navegación/enlaces
            if (this.isNavigationElement(element, text)) {
                return;
            }
            
            this.paragraphs.push({
                index,
                text,
                element,
                isHeading: /^h[1-6]$/i.test(element.tagName)
            });
        });        
        // Si no hay párrafos, crear contenido de fallback
        if (this.paragraphs.length === 0) {
            this.paragraphs.push({
                index: 0,
                text: t('audioPlayerReady'),
                element: null,
                isHeading: false
            });
        }
        
        // OPTIMIZACIÓN: Actualizar display de progreso después de cargar
        if (!this.isLoadingContent) {
            this.updateProgressDisplay(this.currentParagraphIndex, this.paragraphs.length);
        }
    }
    
    // Detectar contenedores grandes que interfieren con la lectura
    isLargeContainer(element, text) {
        // 1. Verificar si es un DIV o SPAN genérico (más propensos a ser contenedores)
        const tagName = element.tagName.toLowerCase();
        const isGenericContainer = ['div', 'span', 'section'].includes(tagName);
        
        if (!isGenericContainer) {
            return false; // p, h1-h6, li, etc. son elementos de contenido específicos
        }
        
        // 2. Verificar si el texto es extremadamente largo (probable contenedor)
        if (text.length > 2000) {
            return true;
        }
        
        // 3. Contar elementos hijos de texto (párrafos, títulos, etc.)
        const childTextElements = element.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
        
        // Si el contenedor tiene muchos elementos hijos de texto, es probablemente un contenedor grande
        if (childTextElements.length > 5) {
            return true;
        }
        
        // 4. Verificar si el elemento contiene otros elementos de contenido estructural
        const structuralChildren = element.querySelectorAll('article, section, div[class*="post"], div[class*="content"], div[class*="article"]');
        
        if (structuralChildren.length > 2) {
            return true;
        }
        
        // 5. Verificar classes típicas de contenedores principales
        const containerClasses = [
            'content-wrapper', 'main-content', 'page-content', 'site-content',
            'container', 'wrapper', 'content-area', 'primary-content'
        ];
        
        const className = element.className.toLowerCase();
        const hasContainerClass = containerClasses.some(cls => className.includes(cls));
        
        if (hasContainerClass && text.length > 500) {
            return true;
        }
        
        // 6. Verificar proporción de texto vs elementos hijos
        const directTextLength = Array.from(element.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent.trim())
            .join('').length;
        
        // Si la mayoría del texto viene de elementos hijos, es un contenedor
        if (directTextLength < text.length * 0.3 && text.length > 300) {
            return true;
        }
        
        return false; // No es un contenedor grande
    }
    
    // Detectar contenido duplicado (conservador)
    isDuplicateContent(text, element) {
        if (!this.paragraphs || this.paragraphs.length === 0) {
            return false;
        }
        
        // EXCLUIR ENCABEZADOS: Los h1-h6 pueden tener títulos similares legítimamente
        if (element && element.tagName && /^h[1-6]$/i.test(element.tagName)) {
            return false;
        }
        
        // Normalizar texto para comparación (quitar espacios extra, convertir a minúsculas)
        const normalizedText = text.toLowerCase().replace(/\s+/g, ' ').trim();
        
        // Verificar si ya existe exactamente el mismo texto
        const exactMatch = this.paragraphs.some(p => 
            p.text.toLowerCase().replace(/\s+/g, ' ').trim() === normalizedText
        );
        
        if (exactMatch) {
            return true;
        }
        
        // Verificar similitud alta (>90%) solo para textos largos
        if (normalizedText.length > 100) {
            const similarMatch = this.paragraphs.some(p => {
                const existingNormalized = p.text.toLowerCase().replace(/\s+/g, ' ').trim();
                const similarity = this.calculateTextSimilarity(normalizedText, existingNormalized);
                return similarity > 0.9; // 90% de similitud
            });
            
            if (similarMatch) {
                return true;
            }
        }
        
        return false;
    }
    
    // Detectar elementos principalmente de navegación/enlaces
    isNavigationElement(element, text) {
        const tagName = element.tagName.toLowerCase();
        
        // Si no es un elemento de lista, no aplicar este filtro
        if (tagName !== 'li') {
            return false;
        }
        
        // Contar enlaces vs texto total
        const links = element.querySelectorAll('a');
        const totalLinks = links.length;
        
        // Si hay muchos enlaces (>3) y poco texto propio, es navegación
        if (totalLinks > 3) {
            const linkText = Array.from(links).map(link => link.textContent.trim()).join(' ');
            const nonLinkText = text.replace(linkText, '').trim();
            
            // Si la mayoría del texto son enlaces, probablemente es navegación
            if (nonLinkText.length < text.length * 0.3) {
                return true;
            }
        }
        
        // Verificar palabras clave típicas de navegación
        const navigationKeywords = [
            'tutorial', 'part 1', 'part 2', 'part 3', 'part 4', 'part 5', 'part 6', 'part 7', 'part 8',
            'installation', 'overview', 'getting started', 'quick start',
            'documentation', 'api reference', 'guide'
        ];
        
        const lowerText = text.toLowerCase();
        const hasNavKeywords = navigationKeywords.some(keyword => lowerText.includes(keyword));
        
        // Si tiene palabras clave de navegación Y muchos enlaces, filtrar
        if (hasNavKeywords && totalLinks > 2) {
            return true;
        }
        
        return false;
    }
    
    // Función auxiliar para calcular similitud de texto
    calculateTextSimilarity(text1, text2) {
        if (text1 === text2) return 1.0;
        if (text1.length === 0 || text2.length === 0) return 0.0;
        
        const longer = text1.length > text2.length ? text1 : text2;
        const shorter = text1.length > text2.length ? text2 : text1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.calculateLevenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }
    
    // Función auxiliar para calcular distancia de Levenshtein (simplificada)
    calculateLevenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }
    
    createPlayer() {        
        // Verificar y remover reproductores existentes de manera segura
        const existingPlayers = document.querySelectorAll('.audio-player-global');
        if (existingPlayers.length > 0) {
            existingPlayers.forEach(player => player.remove());
        }
        
        // Crear el reproductor sticky
        this.playerElement = document.createElement('div');
        this.playerElement.className = 'audio-player-global';
        this.playerElement.innerHTML = this.getPlayerHTML();
        document.body.appendChild(this.playerElement);
        
        // Configurar event listeners de los controles (CRÍTICO - sin esto los botones no funcionan)
        this.setupPlayerControls();
        
        // Monitoreo ligero (sin el agresivo debugging)
        this.startElementMonitoring();
        
    }
    
    getPlayerHTML() {
        // Íconos SVG restaurados
        const prevIconUrl = chrome.runtime.getURL('icons/previous.svg');
        const playIconUrl = chrome.runtime.getURL('icons/play.svg');
        const nextIconUrl = chrome.runtime.getURL('icons/next.svg');
        const restartIconUrl = chrome.runtime.getURL('icons/restart.svg');
        const maximizeIconUrl = chrome.runtime.getURL('icons/maximize.svg');

        return `
            <div class="compact-player" id="compactPlayer">
                <div class="player-drag-area" id="dragArea">
                    <div class="drag-indicator">
                        <div class="drag-dots">⋮⋮</div>
                        <span class="drag-text">SpeedReader IA</span>
                        <button class="refresh-btn-header" id="refreshBtn" title="${t('updatingContent')}">
                            <img src="${chrome.runtime.getURL('icons/refresh.svg')}" alt="${t('updatingContent')}" width="16" height="16">
                        </button>
                        <button class="minimize-btn-header" id="minimizeBtn" title="${t('minimizePlayer')}">➖</button>
                    </div>
                </div>
                
                <!-- Barra de progreso arriba como reproductores estándar -->
                <div class="progress-container-top">
                    <div class="progress-bar" id="progressBar">
                        <div class="progress-fill" id="progressFill" style="width: 0%;"></div>
                        <div class="progress-handle" id="progressHandle" style="left: 0%;"></div>
                    </div>
                    <div class="progress-text">
                        <span class="progress-current loading">0</span> / <span class="progress-total loading">${navigator.language.startsWith('es') ? 'Cargando' : 'Loading'}</span>
                    </div>
                </div>
                
                <div class="player-main">
                    <div class="player-left">
                        <button class="compact-btn restart-btn" id="restartBtn" title="${t('restartFromBeginning')}">
                            <img src="${restartIconUrl}" alt="${t('restartBtn')}" />
                        </button>
                        <button class="compact-btn" id="prevBtn" title="${t('previousParagraph')}">
                            <img src="${prevIconUrl}" alt="${t('previousBtn')}" />
                        </button>
                        <button class="compact-btn play-btn" id="playPauseBtn" title="${t('playPause')}">
                            <img src="${playIconUrl}" alt="${t('playBtn')}" />
                        </button>
                        <button class="compact-btn" id="nextBtn" title="${t('nextParagraph')}">
                            <img src="${nextIconUrl}" alt="${t('nextBtn')}" />
                        </button>
                    </div>
                    
                    <div class="player-right">
                        <select id="speedSelect" class="compact-select" value="1.0">
                            <option value="0.5">0.5x</option>
                            <option value="0.75">0.75x</option>
                            <option value="1.0" selected="selected">1.0x</option>
                            <option value="1.25">1.25x</option>
                            <option value="1.5">1.5x</option>
                            <option value="2.0">2.0x</option>
                        </select>
                        <button class="compact-btn settings-btn" id="settingsBtn" title="${t('voices')}">
                            <img src="chrome-extension://__MSG_@@extension_id__/icons/waveform.svg" alt="${t('voices')}">
                        </button>
                    </div>
                </div>
                
                <div class="player-status-mini loading" id="statusMini">
                    ${navigator.language.startsWith('es') ? 'Procesando contenido...' : 'Processing content...'}
                </div>
                
                <!-- Reproductor minimizado -->
                <div class="mini-drag-container">
                    <div class="mini-drag-area">
                        <span class="mini-drag-icon">⋮⋮</span>
                    </div>
                </div>
                
                <div class="mini-player-container">
                    <div class="mini-progress">
                        <div class="mini-progress-bar" id="miniProgressBar" style="width: 0%;"></div>
                    </div>
                    
                    <div class="mini-controls">
                        <button class="mini-btn" id="miniRestartBtn" title="${t('restartBtn')}">
                            <img src="${restartIconUrl}" alt="${t('restartBtn')}" />
                        </button>
                        <button class="mini-btn" id="miniPrevBtn" title="${t('previousBtn')}">
                            <img src="${prevIconUrl}" alt="${t('previousBtn')}" />
                        </button>
                        <button class="mini-btn play-btn" id="miniPlayPauseBtn" title="${t('playPause')}">
                            <img src="${playIconUrl}" alt="${t('playButton')}" />
                        </button>
                        <button class="mini-btn" id="miniNextBtn" title="${t('nextButton')}">
                            <img src="${nextIconUrl}" alt="${t('nextButton')}" />
                        </button>
                        <button class="mini-btn expand-btn" id="expandBtn" title="${t('expandPlayer')}">
                            <img src="${maximizeIconUrl}" alt="${t('expandPlayer')}" />
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    setupPlayerControls() {
        const playPauseBtn = this.playerElement.querySelector('#playPauseBtn');
        const prevBtn = this.playerElement.querySelector('#prevBtn');
        const nextBtn = this.playerElement.querySelector('#nextBtn');
        const restartBtn = this.playerElement.querySelector('#restartBtn'); // Nuevo botón
        const speedSelect = this.playerElement.querySelector('#speedSelect');
        const settingsBtn = this.playerElement.querySelector('#settingsBtn');
        const minimizeBtn = this.playerElement.querySelector('#minimizeBtn');
        const progressBar = this.playerElement.querySelector('#progressBar');
        
        // Controles del reproductor minimizado
        const miniPlayPauseBtn = this.playerElement.querySelector('#miniPlayPauseBtn');
        const miniPrevBtn = this.playerElement.querySelector('#miniPrevBtn');
        const miniNextBtn = this.playerElement.querySelector('#miniNextBtn');
        const miniRestartBtn = this.playerElement.querySelector('#miniRestartBtn');
        const expandBtn = this.playerElement.querySelector('#expandBtn');
        
        // Eventos del reproductor normal
        playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        prevBtn.addEventListener('click', () => this.previousParagraph());
        nextBtn.addEventListener('click', () => this.nextParagraph());
        
        // Verificar que el botón de reinicio existe antes de agregar el evento
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                this.restartFromBeginning();
            });
        } else {
            console.error('[AudioPlayer] Botón de reinicio no encontrado en el DOM');
        }
        
        speedSelect.addEventListener('change', (e) => this.updateSpeed(e.target.value));
        settingsBtn.addEventListener('click', () => this.openSettings());
        minimizeBtn.addEventListener('click', () => this.minimizePlayer());
        
        // Eventos del reproductor minimizado
        miniPlayPauseBtn.addEventListener('click', () => this.togglePlayPause());
        miniPrevBtn.addEventListener('click', () => this.previousParagraph());
        miniNextBtn.addEventListener('click', () => this.nextParagraph());
        
        // Agregar evento para el botón de reinicio minimizado
        if (miniRestartBtn) {
            miniRestartBtn.addEventListener('click', () => {
                this.restartFromBeginning();
            });
        }
        
        expandBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.expandPlayer();
        });
        
        // Configurar barra de progreso interactiva para reproductor normal
        progressBar.addEventListener('click', (e) => this.handleProgressClick(e));
        
        // Configurar barra de progreso interactiva para reproductor minimizado
        const miniProgress = this.playerElement.querySelector('.mini-progress');
        if (miniProgress) {
            miniProgress.addEventListener('click', (e) => this.handleProgressClick(e));
        }
        
        // Configurar drag & drop
        this.setupDragAndDrop();
        
        // Configurar velocidad inicial de manera forzada
        speedSelect.value = "1.0";
        speedSelect.selectedIndex = 2; // 1.0x es la tercera opción (índice 2)
        
        // Múltiples intentos para asegurar que se establezca
        setTimeout(() => {
            speedSelect.value = "1.0";
            speedSelect.selectedIndex = 2;
        }, 50);
        
        setTimeout(() => {
            speedSelect.value = "1.0";
            speedSelect.selectedIndex = 2;
        }, 200);
        
        setTimeout(() => {
            speedSelect.value = "1.0";
            speedSelect.selectedIndex = 2;
        }, 500);
        
        // Inicializar progreso en 0%
        this.updateProgress();
        
        // Configurar botón de refresh manual en el header
        const refreshBtn = this.playerElement.querySelector('#refreshBtn');
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.manualRefreshContent();
            });
        }
        
        // Mostrar resaltado inicial del párrafo actual
        if (this.paragraphs[this.currentParagraphIndex]) {
            this.highlightCurrentParagraph(this.paragraphs[this.currentParagraphIndex].element);
            this.updateCurrentText(this.paragraphs[this.currentParagraphIndex].text);
            this.updateStatus(t('readyToPlayParagraph').replace('{0}', this.currentParagraphIndex + 1));
        }
}
    
    setupDragAndDrop() {
        const dragArea = this.playerElement.querySelector('#dragArea');
        const container = this.playerElement; // El contenedor principal
        
        if (!dragArea || !container) {
            console.warn('No se encontraron elementos para drag and drop');
            return;
        }
        
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let initialLeft = 0;
        let initialTop = 0;        
        // Función para iniciar el arrastre
        const startDrag = (e) => {
            e.preventDefault();
            
            isDragging = true;
            this.isActivelyDragging = true; // 🆕 Activar bandera de arrastre activo
            startX = e.clientX;
            startY = e.clientY;
            
            // Obtener posición actual del contenedor
            const rect = container.getBoundingClientRect();
            initialLeft = Math.round(rect.left); // Redondear para evitar decimales
            initialTop = Math.round(rect.top);
            
            // Verificar que la posición inicial esté dentro del viewport
            const containerWidth = container.offsetWidth;
            const containerHeight = container.offsetHeight;
            const maxLeft = window.innerWidth - containerWidth;
            const maxTop = window.innerHeight - containerHeight;
            
            // Corregir posición inicial si está fuera del viewport
            initialLeft = Math.max(0, Math.min(initialLeft, maxLeft));
            initialTop = Math.max(0, Math.min(initialTop, maxTop));
            
            // Cambiar estilos durante el arrastre
            container.style.transition = 'none';
            dragArea.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
            
            // Agregar clase visual
            container.classList.add('dragging');
        };
        
        // Función para mover durante el arrastre
        this.dragHandler = (e) => {
            if (!isDragging || this.isDocked) return; // No procesar si está docked
            
            e.preventDefault();
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            const newLeft = initialLeft + deltaX;
            const newTop = initialTop + deltaY;
            
            // Aplicar restricciones del viewport en todos los lados
            const containerWidth = container.offsetWidth;
            const containerHeight = container.offsetHeight;
            const maxLeft = window.innerWidth - containerWidth;
            const maxTop = window.innerHeight - containerHeight;
            
            const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft));
            const constrainedTop = Math.max(0, Math.min(newTop, maxTop));
            
            // 🆕 Verificar proximidad al borde izquierdo para auto-hide (exactamente en el borde)
            if (constrainedLeft <= 2 && !this.isDocked) {
                // Añadir indicador visual con sombra sutil
                const dragArea = container.querySelector('.player-drag-area');
                if (dragArea) {
                    dragArea.style.boxShadow = '0 0 8px rgba(255, 255, 255, 0.25), 0 0 12px rgba(135, 206, 235, 0.2)';
                    dragArea.style.transform = 'scale(1.01)';
                }
                container.style.opacity = '0.95';
                container.style.transform = 'scale(0.99)';
            } else if (constrainedLeft > 2) {
                // Restaurar apariencia original si se aleja del borde
                const dragArea = container.querySelector('.player-drag-area');
                if (dragArea) {
                    dragArea.style.background = 'linear-gradient(135deg, #4fc3f7 0%, #29b6f6 50%, #0288d1 100%)';
                    dragArea.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.2)';
                    dragArea.style.transform = 'none';
                }
                container.style.opacity = '1';
                container.style.transform = 'none';
            }
            
            // Aplicar nueva posición usando left y top en lugar de transform
            container.style.left = constrainedLeft + 'px';
            container.style.top = constrainedTop + 'px';
            container.style.right = 'auto';
            container.style.bottom = 'auto';
            
            // Verificación adicional: asegurar que la posición aplicada esté dentro del viewport
            requestAnimationFrame(() => {
                const finalRect = container.getBoundingClientRect();
                if (finalRect.right > window.innerWidth || finalRect.bottom > window.innerHeight) {
                    console.warn('[Normal] Reproductor fuera del viewport después de aplicar posición:', {
                        rect: { right: finalRect.right, bottom: finalRect.bottom },
                        viewport: { width: window.innerWidth, height: window.innerHeight }
                    });
                }
            });
        };
        
        // Función para terminar el arrastre
        this.endDragHandler = (e) => {
            if (!isDragging || this.isDocked) return; // 🆕 No procesar si está docked
            
            isDragging = false;
            this.isActivelyDragging = false; // 🆕 Desactivar bandera de arrastre activo
            
            // 🆕 Verificar si debe hacer dock al borde izquierdo (muy cerca del borde)
            // Solo verificar dock si el reproductor tiene una posición establecida (se ha movido)
            const hasLeftStyle = container.style.left && container.style.left !== '';
            const currentLeft = hasLeftStyle ? parseInt(container.style.left) : null;
            
            if (hasLeftStyle && currentLeft !== null && currentLeft <= 2 && !this.isDocked && !this.preventAutoDock) {
                this.dockToLeft();
            } else {
                // Restaurar opacidad y efectos visuales si no se hace dock
                container.style.opacity = '1';
                container.style.transform = 'scale(1)';
                // Restaurar apariencia original del drag-area
                const dragArea = container.querySelector('.player-drag-area');
                if (dragArea) {
                    dragArea.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.2)';
                    dragArea.style.transform = 'none';
                }
            }
            
            // Restaurar estilos
            container.style.transition = 'all 0.3s ease';
            dragArea.style.cursor = 'grab';
            document.body.style.userSelect = '';
            container.classList.remove('dragging');
        };
        
        // Event listeners para mouse
        dragArea.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', this.dragHandler);
        document.addEventListener('mouseup', this.endDragHandler);
        
        // Event listeners para touch (móvil)
        dragArea.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            startDrag({
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => e.preventDefault()
            });
        });
        
        this.touchMoveHandler = (e) => {
            if (!isDragging) return;
            const touch = e.touches[0];
            this.dragHandler({
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => e.preventDefault()
            });
        };
        
        this.touchEndHandler = (e) => {
            this.endDragHandler(e);
        };
        
        document.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
        document.addEventListener('touchend', this.touchEndHandler);
        
    }

    // Configurar manejo de resize de ventana
    setupWindowResizeHandler() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            // Debounce del resize para evitar demasiadas llamadas
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.forceViewportContainment();
                
                // También forzar containment del mini player si existe
                if (this.miniPlayer) {
                    this.forceViewportContainment(this.miniPlayer);
                }
            }, 250); // 250ms de debounce
        });
}

    // Función para forzar viewport containment
    forceViewportContainment(targetContainer = null) {
        const container = targetContainer || this.container;
        if (!container || this.isDocked) return;

        // Obtener dimensiones actuales
        const rect = container.getBoundingClientRect();
        const containerWidth = rect.width;
        const containerHeight = rect.height;
        
        // Calcular límites del viewport
        const maxLeft = window.innerWidth - containerWidth;
        const maxTop = window.innerHeight - containerHeight;
        
        // Obtener posición actual
        const currentLeft = rect.left;
        const currentTop = rect.top;
        
        // Calcular nueva posición si está fuera del viewport
        const constrainedLeft = Math.max(0, Math.min(currentLeft, maxLeft));
        const constrainedTop = Math.max(0, Math.min(currentTop, maxTop));
        
        // Solo aplicar si hay cambios necesarios
        if (currentLeft !== constrainedLeft || currentTop !== constrainedTop) {
            // Aplicar posición
            container.style.left = constrainedLeft + 'px';
            container.style.top = constrainedTop + 'px';
            container.style.right = 'auto';
            container.style.bottom = 'auto';
        }
    }

    // Métodos para auto-hide/dock
    dockToLeft() {
        // Prevenir dock si estamos en medio de un arrastre activo
        if (this.isActivelyDragging) {
            return;
        }
        
        const container = this.playerElement;
        if (!container) return;
        
        this.isDocked = true;
        
        // Limpiar TODOS los listeners del reproductor principal para evitar conflictos
        if (this.dragHandler) {
            document.removeEventListener('mousemove', this.dragHandler);
        }
        if (this.endDragHandler) {
            document.removeEventListener('mouseup', this.endDragHandler);
        }
        if (this.touchMoveHandler) {
            document.removeEventListener('touchmove', this.touchMoveHandler);
        }
        if (this.touchEndHandler) {
            document.removeEventListener('touchend', this.touchEndHandler);
        }
        
        // Obtener posición actual Y para mantenerla
        const currentTop = parseInt(container.style.top) || 0;
        
        // Animar el player completamente fuera de la vista con transición suave
        container.style.transition = 'all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1)';
        container.style.left = '-400px'; // Mover completamente fuera de vista
        container.style.opacity = '0.8'; // Fade out sutil
        container.style.transform = 'scale(0.95)'; // Reducir ligeramente durante la animación
        
        // Siempre recrear el tab para asegurar funcionalidad correcta (reproductor normal)
        this.createDockTab();
        
        // Posicionar el tab visible con animación de entrada
        this.dockTab.style.left = '-32px'; // Empezar fuera de vista
        this.dockTab.style.top = currentTop + 'px';
        this.dockTab.style.display = 'block';
        this.dockTab.style.opacity = '0';
        this.dockTab.style.transform = 'scale(0.8)';
        
        // Animar la entrada del tab
        setTimeout(() => {
            this.dockTab.style.left = '0px';
            this.dockTab.style.opacity = '1';
            this.dockTab.style.transform = 'scale(1)';
        }, 100);
        
        // FORZAR configuración de listeners después de mostrar el tab
        setTimeout(() => {
            this.setupDockTabDrag();
            this.debugDockState();
        }, 100);
    }
    
    undockFromLeft() {        
        const container = this.playerElement;
        if (!container || !this.isDocked) return;
        
        this.isDocked = false;
        
        // Prevenir auto-dock inmediato después del undock
        this.preventAutoDock = true;        
        // Restaurar TODOS los listeners del reproductor principal
        if (this.dragHandler) {
            document.addEventListener('mousemove', this.dragHandler);
        }
        if (this.endDragHandler) {
            document.addEventListener('mouseup', this.endDragHandler);
        }
        if (this.touchMoveHandler) {
            document.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
        }
        if (this.touchEndHandler) {
            document.addEventListener('touchend', this.touchEndHandler);
        }        
        // Obtener posición Y del tab para mantener consistencia
        const tabTop = parseInt(this.dockTab.style.top) || 0;
        
        // Animar el player de vuelta a la vista con entrada suave y controlada
        container.style.transition = 'all 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)'; // Transición suave sin rebote
        
        // Empezar desde posición fuera de vista para crear entrada suave
        container.style.left = '-50px';
        container.style.opacity = '0.3';
        container.style.transform = 'scale(0.9)';
        container.style.top = tabTop + 'px';
        
        // Animar hacia la posición final después de un pequeño delay
        setTimeout(() => {
            container.style.left = '20px'; // Posición final al borde izquierdo
            container.style.opacity = '1'; // Restaurar opacidad completa
            container.style.transform = 'scale(1)'; // Restaurar escala normal
            
            // Limpiar efectos visuales de dock proximity
            const dragArea = container.querySelector('.player-drag-area');
            if (dragArea) {
                dragArea.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.2)';
                dragArea.style.transform = 'none';
                dragArea.style.background = 'linear-gradient(135deg, #4fc3f7 0%, #29b6f6 50%, #0288d1 100%)';
            }
        }, 50); // Pequeño delay para crear efecto de entrada gradual
        
        // Ocultar el tab con animación suave
        this.dockTab.style.left = '-32px';
        this.dockTab.style.opacity = '0';
        this.dockTab.style.transform = 'scale(0.8)';
        setTimeout(() => {
            this.dockTab.style.display = 'none';
        }, 400);
        
        // Limpiar listeners del dock tab
        this.cleanupDockTabListeners();
        
        // Forzar viewport containment después del undock
        setTimeout(() => {
            this.forceViewportContainment();
        }, 700); // Después de que termine la animación
        
        // Reactivar auto-dock después de que termine completamente la animación
        setTimeout(() => {
            this.preventAutoDock = false;
        }, 1000); // 1 segundo después del undock para evitar loops
    }
    
    createDockTab() {        
        // Limpiar tab anterior si existe
        if (this.dockTab) {
            this.cleanupDockTabListeners();
            if (this.dockTab.parentNode) {
                this.dockTab.parentNode.removeChild(this.dockTab);
            }
        }
        
        this.dockTab = document.createElement('div');
        this.dockTab.id = 'audioPlayerDockTab';
        this.dockTab.style.cssText = `
            position: fixed !important;
            left: 0px !important;
            top: 100px !important;
            width: 32px !important;
            height: 70px !important;
            background: linear-gradient(135deg, rgba(60, 150, 255, 0.8) 0%, rgba(30, 100, 200, 0.9) 100%) !important;
            border: none !important;
            border-radius: 0 16px 16px 0 !important;
            box-shadow: none !important;
            cursor: grab !important;
            z-index: 2147483647 !important;
            display: none !important;
            transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
            backdrop-filter: blur(10px) !important;
            pointer-events: auto !important;
        `;
        
        // Añadir contenido visual al tab - usar el mismo icono drag que el reproductor
        this.dockTab.innerHTML = `
            <div style="
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                color: rgba(255, 255, 255, 0.7);
                letter-spacing: -2px;
                line-height: 1;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
            ">⋮⋮</div>
        `;
        
        // Añadir hover effects usando los colores de la extensión
        this.dockTab.addEventListener('mouseenter', () => {
            this.dockTab.style.width = '36px';
            this.dockTab.style.transform = 'translateX(2px)';
            this.dockTab.style.background = 'linear-gradient(135deg, rgba(70, 160, 255, 0.9) 0%, rgba(40, 120, 220, 1.0) 100%)';
            this.dockTab.style.boxShadow = `
                3px 3px 8px rgba(100, 180, 255, 0.25),
                2px 2px 6px rgba(135, 206, 235, 0.3),
                inset 1px 1px 3px rgba(255, 255, 255, 0.2),
                inset -1px -1px 2px rgba(0, 100, 200, 0.15)
            `;
        });
        
        this.dockTab.addEventListener('mouseleave', () => {
            this.dockTab.style.width = '32px';
            this.dockTab.style.transform = 'translateX(0px)';
            this.dockTab.style.background = 'linear-gradient(135deg, rgba(60, 150, 255, 0.8) 0%, rgba(30, 100, 200, 0.9) 100%)';
            this.dockTab.style.boxShadow = 'none';
        });
        
        // Añadir al DOM primero
        document.body.appendChild(this.dockTab);
        
        // Configurar drag para el tab después de añadirlo al DOM
        this.setupDockTabDrag();
        
        // Agregar eventos de test para debugging con CAPTURE para evitar interferencias
        this.dockTab.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, true); // CAPTURE = true
        
        this.dockTab.addEventListener('mousedown', (e) => {
        }, true); // CAPTURE = true
    }
    
    setupDockTabDrag() {        
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let initialTop = 0;
        
        const startDrag = (e) => {
            e.preventDefault();
            e.stopPropagation();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = this.dockTab.getBoundingClientRect();
            initialTop = rect.top;
            
            this.dockTab.style.cursor = 'grabbing';
            this.dockTab.style.transition = 'none';
        };
        
        const dragMove = (e) => {
            if (!isDragging) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            // Mover verticalmente con restricciones del viewport
            const newTop = initialTop + deltaY;
            const constrainedTop = Math.max(0, Math.min(newTop, window.innerHeight - 70)); // 70 es la altura del tab
            
            this.dockTab.style.top = constrainedTop + 'px';
            
            // Si se arrastra hacia la derecha lo suficiente, hacer undock
            if (deltaX > 80) {                
                // Detectar si el reproductor está minimizado para usar el método correcto
                const miniPlayer = this.playerElement.querySelector('#compactPlayer');
                if (miniPlayer && miniPlayer.classList.contains('minimized')) {
                    this.undockFromLeftMini();
                } else {
                    this.undockFromLeft();
                }
                
                endDrag();
            }
        };
        
        const endDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            
            this.dockTab.style.cursor = 'grab';
            this.dockTab.style.transition = 'all 0.3s ease';
        };
        
        // Almacenar referencias para poder limpiar listeners
        this.dockTabDragMove = dragMove;
        this.dockTabEndDrag = endDrag;
        
        // Event listeners para mouse con CAPTURE para máxima prioridad
        this.dockTab.addEventListener('mousedown', startDrag, true);
        document.addEventListener('mousemove', this.dockTabDragMove, true);
        document.addEventListener('mouseup', this.dockTabEndDrag, true);
        
        // Event listeners para touch
        this.dockTab.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            startDrag({
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => e.preventDefault(),
                stopPropagation: () => e.stopPropagation()
            });
        });
        
        this.dockTabTouchMove = (e) => {
            if (!isDragging) return;
            const touch = e.touches[0];
            dragMove({
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => e.preventDefault(),
                stopPropagation: () => e.stopPropagation()
            });
        };
        
        document.addEventListener('touchmove', this.dockTabTouchMove, { passive: false, capture: true });
        document.addEventListener('touchend', this.dockTabEndDrag, true);
    }
    
    // Método para limpiar event listeners del dock tab
    cleanupDockTabListeners() {        
        if (this.dockTabDragMove) {
            document.removeEventListener('mousemove', this.dockTabDragMove, true);
            this.dockTabDragMove = null;
        }
        if (this.dockTabEndDrag) {
            document.removeEventListener('mouseup', this.dockTabEndDrag, true);
            document.removeEventListener('touchend', this.dockTabEndDrag, true);
            this.dockTabEndDrag = null;
        }
        if (this.dockTabTouchMove) {
            document.removeEventListener('touchmove', this.dockTabTouchMove, { capture: true });
            this.dockTabTouchMove = null;
        }
    }
    
    // Métodos para auto-hide/dock del reproductor minimizado
    dockToLeftMini() {        
        // Prevenir dock si estamos en medio de un arrastre activo
        if (this.isActivelyDragging) {
            return;
        }
        
        const miniPlayer = this.playerElement.querySelector('#compactPlayer');
        if (!miniPlayer || !miniPlayer.classList.contains('minimized')) return;
        
        this.isDocked = true;
        
        // Limpiar listeners del reproductor minimizado para evitar conflictos
        if (this.cleanupDragListeners) {
            this.cleanupDragListeners();
        }
        
        // Obtener posición actual Y para mantenerla
        const currentTop = parseInt(miniPlayer.style.top) || 0;
        
        // Animar el mini player completamente fuera de la vista con transición suave
        miniPlayer.style.transition = 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)'; // Más rápido y suave
        miniPlayer.style.left = '-200px'; // Mover fuera de vista
        miniPlayer.style.opacity = '0'; // Fade out completo para limpieza
        miniPlayer.style.transform = 'scale(0.9)'; // Reducir durante la animación
        
        // Siempre recrear el tab para asegurar funcionalidad correcta (reproductor mini)
        this.createDockTab();
        
        // Posicionar el tab visible (mismo tab para ambos tipos) con animación de entrada
        this.dockTab.style.left = '-32px'; // Empezar fuera de vista
        this.dockTab.style.top = currentTop + 'px';
        this.dockTab.style.display = 'block';
        this.dockTab.style.opacity = '0';
        this.dockTab.style.transform = 'scale(0.8)';
        
        // Animar la entrada del tab
        setTimeout(() => {
            this.dockTab.style.left = '0px';
            this.dockTab.style.opacity = '1';
            this.dockTab.style.transform = 'scale(1)';
        }, 100);
        
        // Debug del estado después del dock
        setTimeout(() => this.debugDockState(), 600);
    }
    
    undockFromLeftMini() {        
        const miniPlayer = this.playerElement.querySelector('#compactPlayer');
        if (!miniPlayer || !this.isDocked) return;
        
        this.isDocked = false;
        
        // Prevenir auto-dock inmediato después del undock
        this.preventAutoDock = true;        
        // Restaurar listeners del reproductor minimizado
        this.setupMinimizedDrag();        
        // Obtener posición Y del tab para mantener consistencia
        const tabTop = parseInt(this.dockTab.style.top) || 0;
        
        // Configurar estado inicial del mini player (sin transición)
        miniPlayer.style.transition = 'none';
        miniPlayer.style.left = '0px'; // Empezar exactamente en el borde
        miniPlayer.style.right = 'auto';
        miniPlayer.style.top = tabTop + 'px';
        miniPlayer.style.opacity = '0';
        miniPlayer.style.transform = 'scale(0.8) translateX(-10px)';
        
        // Aplicar transición y animar después de que el DOM se actualice
        requestAnimationFrame(() => {
            miniPlayer.style.transition = 'all 0.4s cubic-bezier(0.22, 1, 0.36, 1)'; // Transición más rápida y suave
            miniPlayer.style.left = '20px'; // Posición final
            miniPlayer.style.opacity = '1';
            miniPlayer.style.transform = 'scale(1) translateX(0px)';
            
            // Limpiar efectos visuales de dock proximity
            const dragArea = miniPlayer.querySelector('.mini-drag-area');
            if (dragArea) {
                dragArea.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.2)';
                dragArea.style.transform = 'none';
            }
        });
        
        // Ocultar el tab de forma más rápida y coordinada
        this.dockTab.style.transition = 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)';
        this.dockTab.style.left = '-40px'; // Más lejos para efecto más limpio
        this.dockTab.style.opacity = '0';
        this.dockTab.style.transform = 'scale(0.7)';
        setTimeout(() => {
            this.dockTab.style.display = 'none';
        }, 300); // Tiempo más corto para mejor coordinación
        
        // Limpiar listeners del dock tab
        this.cleanupDockTabListeners();
        
        // Reactivar auto-dock después de que termine completamente la animación
        setTimeout(() => {
            this.preventAutoDock = false;
        }, 800); // Un poco más de tiempo para el reproductor mini
        
    }
    handleProgressClick(e) {
        const progressBar = e.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        
        const targetParagraph = Math.floor(percentage * this.paragraphs.length);
        this.jumpToParagraph(targetParagraph);
    }
    
    jumpToParagraph(index) {
        if (index >= 0 && index < this.paragraphs.length) {
            this.currentParagraphIndex = index;
            this.updateProgress();
            this.highlightCurrentParagraph();
            
            // IMPORTANTE: Verificar isPaused PRIMERO antes que isPlaying
            // Porque cuando está pausado, isPlaying puede ser true también
            if (this.isPaused) {
                // Si está pausado, actualizar posición pero MANTENER pausa
                // Actualizar el índice de pausa para que sepa dónde está
                this.pausedAtParagraphIndex = index;
                this.updateStatus(t('pausedAtParagraphNumber').replace('{0}', this.currentParagraphIndex + 1));
            } else if (this.isPlaying) {
                // Si está reproduciendo activamente, saltar y continuar
                speechSynthesis.cancel();
                this.readCurrentParagraph();
            } else {
                // Si está detenido, solo actualizar visualmente
                this.updateStatus(t('readyToPlayParagraph').replace('{0}', this.currentParagraphIndex + 1));
            }
        }
    }
    
    setupEventListeners() {
        // Escuchar eventos de teclado para controles
        document.addEventListener('keydown', (e) => {
            if (e.altKey) { // Alt + tecla para controles
                switch (e.key) {
                    case ' ': // Alt + Espacio = Play/Pause
                        e.preventDefault();
                        this.togglePlayPause();
                        break;
                    case 'ArrowLeft': // Alt + ← = Anterior
                        e.preventDefault();
                        this.previousParagraph();
                        break;
                    case 'ArrowRight': // Alt + → = Siguiente
                        e.preventDefault();
                        this.nextParagraph();
                        break;
                    case 'Escape': // Alt + Escape = Stop
                        e.preventDefault();
                        this.stop();
                        break;
                }
            }
        });
        
        // Escuchar fin de síntesis para continuar automáticamente
        window.addEventListener('speechSynthesisEnd', () => {
            if (this.isPlaying && !this.isPaused) {
                this.nextParagraph();
            }
        });
    }
    
    async togglePlayPause() {        
        if (this.isPlaying && !this.isPaused) {
            // Está reproduciendo → pausar
            this.pause();
        } else if (this.isPaused) {
            // Está pausado → reanudar
            this.resume();
        } else {
            // Está detenido → empezar
            this.play();
        }
    }
    
    async play() {        
        if (this.paragraphs.length === 0) {
            this.showError('No hay contenido para leer');
            return;
        }        
        // Pausar detección durante reproducción para evitar interrupciones
        this.pauseContentObserver();
        
        this.isPlaying = true;
        this.isPaused = false;
        this.pausedAtParagraphIndex = -1; // Resetear ya que vamos a empezar reproducción normal
        this.updatePlayButton(true);
        this.playerElement.querySelector('#compactPlayer').classList.add('playing');
        
        // Asegurar que el estado de speechSynthesis esté limpio
        if (speechSynthesis.speaking || speechSynthesis.paused) {
            speechSynthesis.cancel();
        }

        await this.readCurrentParagraph();
    }
    
    pause() {
        this.isPaused = true;
        this.pausedAtParagraphIndex = this.currentParagraphIndex; // Guardar párrafo donde se pausó
        
        // Guardar posición actual para fallback de emergencia
        this.pausedCharIndex = this.lastCharIndex || 0;
        
        // Pausar la síntesis de voz
        if (speechSynthesis.speaking && !speechSynthesis.paused) {
            speechSynthesis.pause();
        }
        
        // Actualizar UI
        this.updatePlayButton(false);
        this.updateStatus(t('pausedAtParagraph').replace('{0}', this.currentParagraphIndex + 1));
        this.playerElement.querySelector('#compactPlayer').classList.remove('playing');
        
        // Reanudar detección después de pausar (con mucho más tiempo)
        setTimeout(() => {
            this.resumeContentObserver();
        }, 5000); // Esperar 5 segundos antes de reanudar detección
        
    }
    
    resume() {        
        // Asegurar estados correctos ANTES de cualquier operación
        this.isPaused = false;
        this.isPlaying = true;
        
        // DETECTAR SI SE CAMBIÓ DE PÁRRAFO DURANTE LA PAUSA
        const paragraphChanged = (this.pausedAtParagraphIndex !== -1 && 
                                  this.pausedAtParagraphIndex !== this.currentParagraphIndex);
        
        // Actualizar UI inmediatamente
        this.updatePlayButton(true);
        this.playerElement.querySelector('#compactPlayer').classList.add('playing');
        this.updateStatus(t('playing'));
        
        if (paragraphChanged) {            
            // Si cambió el párrafo, iniciar desde el nuevo párrafo
            speechSynthesis.cancel();
            this.readCurrentParagraph();
        } else if (speechSynthesis.paused) {
            // Si está pausado, siempre intentar resume primero (funciona para todas las voces incluyendo Google)
            speechSynthesis.resume();
            
            // Limpiar índice de pausa ya que resume fue exitoso (o lo verificaremos)
            this.pausedCharIndex = undefined;
            
            // Verificar después de un momento si el resume funcionó
            setTimeout(() => {
                // Solo verificar si NO está hablando Y sigue pausado (el resume falló completamente)
                if (!speechSynthesis.speaking && speechSynthesis.paused) {
                    // Resume falló, reiniciar párrafo actual
                    speechSynthesis.cancel();
                    this.readCurrentParagraph();
                }
            }, 200);
        } else if (!speechSynthesis.speaking && !speechSynthesis.paused) {
            // Solo reiniciar si no hay síntesis activa Y no está pausado
            speechSynthesis.cancel();
            this.readCurrentParagraph();
        } else {
            // Otros casos: hay speaking pero no paused (estado raro)
            speechSynthesis.resume();
            this.pausedCharIndex = undefined;
        }
    }
    
    stop() {        
        this.isPlaying = false;
        this.isPaused = false;
        this.pausedAtParagraphIndex = -1; // Resetear párrafo de pausa
        
        // Limpiar índices de rastreo de progreso
        this.lastCharIndex = 0;
        this.pausedCharIndex = undefined;
        
        speechSynthesis.cancel();
        this.updatePlayButton(false);
        this.updateStatus('Detenido');
        this.clearCurrentText();
        this.playerElement.querySelector('#compactPlayer').classList.remove('playing');
        
        // Limpiar resaltado cuando se detiene
        document.querySelectorAll('.audio-player-highlight').forEach(el => {
            el.classList.remove('audio-player-highlight');
        });
        
        // Reanudar observador después de detener
        setTimeout(() => {
            this.resumeContentObserver();
        }, 1000);
        
        // Reanudar detección después de detener (con delay)
        setTimeout(() => {
            this.resumeContentObserver();
        }, 3000);
    }
    
    async readCurrentParagraph() {
        if (this.currentParagraphIndex >= this.paragraphs.length) {
            this.stop();
            this.updateStatus('Lectura completada');
            return;
        }
        
        // ASEGURAR que isPaused es false cuando estamos leyendo
        // (protección contra inconsistencias de estado)
        if (this.isPlaying) {
            this.isPaused = false;
        }
        
        const paragraph = this.paragraphs[this.currentParagraphIndex];
                
        // significa que está traducido - usar el contenido visible
        let textToRead = paragraph.text;
        if (paragraph.element && paragraph.element.textContent.trim() !== paragraph.text.trim()) {
            textToRead = paragraph.element.textContent.trim();
        }
        
        // Limpiar índices de pausa/reanudación
        this.lastCharIndex = 0;
        this.pausedCharIndex = undefined;
        
        // Actualizar UI
        this.updateProgress();
        this.updateCurrentText(textToRead);
        this.highlightCurrentParagraph(paragraph.element);
        this.updateStatus(t('playing'));
        
        // ASEGURAR QUE EL BOTÓN ESTÉ EN ESTADO DE REPRODUCCIÓN
        this.updatePlayButton(true);
        this.playerElement.querySelector('#compactPlayer').classList.add('playing');
        
        try {
            // Usar función personalizada con configuraciones de voz
            await this.speakTextWithVoiceSettings(textToRead);
        } catch (error) {
            console.error('Error reproduciendo audio:', error);
            this.showError(t('audioPlaybackError'));
        }
    }
    
    async readFromCharIndex(charIndex) {
        if (this.currentParagraphIndex >= this.paragraphs.length) {
            this.stop();
            this.updateStatus('Lectura completada');
            return;
        }
        
        const paragraph = this.paragraphs[this.currentParagraphIndex];
                
        // Obtener el texto completo
        let fullText = paragraph.text;
        if (paragraph.element && paragraph.element.textContent.trim() !== paragraph.text.trim()) {
            fullText = paragraph.element.textContent.trim();
        }
        
        // Extraer solo el texto desde el índice de pausa
        const textToRead = fullText.substring(charIndex).trim();
        
        if (!textToRead) {
            // Si no hay texto restante, ir al siguiente párrafo
            this.nextParagraph();
            return;
        }
        
        // Limpiar índices
        this.lastCharIndex = 0;
        this.pausedCharIndex = undefined;
        
        // Actualizar UI (mantener el texto completo visible, pero leer solo la parte restante)
        this.updateProgress();
        this.updateCurrentText(fullText); // Mostrar texto completo
        this.highlightCurrentParagraph(paragraph.element);
        this.updateStatus(t('playing') + ' (continuando)');
        
        // ASEGURAR QUE EL BOTÓN ESTÉ EN ESTADO DE REPRODUCCIÓN
        this.updatePlayButton(true);
        this.playerElement.querySelector('#compactPlayer').classList.add('playing');
        
        try {
            // Usar función personalizada con configuraciones de voz
            await this.speakTextWithVoiceSettings(textToRead);
        } catch (error) {
            console.error('Error reproduciendo audio:', error);
            this.showError(t('audioPlaybackError'));
        }
    }
    
    speakTextWithVoiceSettings(text) {
        return new Promise((resolve) => {
            speechSynthesis.cancel(); // Cancelar cualquier reproducción anterior
            
            const utterance = new SpeechSynthesisUtterance(text);            
            // USAR LA MISMA LÓGICA QUE FUNCIONES CONTEXTUALES
            // Aplicar configuración global centralizada (igual que las funciones contextuales)
            const voiceApplied = AudioPlayer.applyGlobalVoiceConfig(utterance);
            
            // ...existing code...
        if (voiceApplied) {
            // ...existing code...
        } else {
            utterance.rate = utterance.rate || 0.9;
            utterance.pitch = utterance.pitch || 1.0;
            utterance.volume = utterance.volume || 1.0;
            // Preferir idioma del navegador si está disponible
            utterance.lang = utterance.lang || (navigator.language && navigator.language.startsWith('es') ? 'es-ES' : 'en-US');
        }
            
            // Aplicar configuraciones de audio
            utterance.pitch = this.settings.pitch || 1;
            utterance.volume = this.settings.volume || 1;
            utterance.rate = this.settings.speed || 1;
            
            // RASTREAR PROGRESO CON BOUNDARY (para fallback de emergencia)
            utterance.onboundary = (event) => {
                if (event.name === 'word') {
                    // Guardar el índice del último carácter leído
                    this.lastCharIndex = event.charIndex;
                }
            };
            
            // Eventos
            utterance.onend = () => {
                // Limpiar índice al terminar
                this.lastCharIndex = 0;
                this.pausedCharIndex = undefined;
                
                if (this.isPlaying && !this.isPaused) {
                    setTimeout(() => this.nextParagraph(), 500);
                }
                resolve();
            };
            
            utterance.onerror = (error) => {
                console.error('Error en TTS:', error);
                // Limpiar índices en caso de error
                this.lastCharIndex = 0;
                this.pausedCharIndex = undefined;
                resolve();
            };
            
            // Guardar referencia
            this.currentUtterance = utterance;
        
            
            // PROTECCIÓN ABSOLUTA: SIEMPRE usar idioma de la voz configurada
            const globalConfig = AudioPlayer.getGlobalVoiceConfig();            
            if (globalConfig.voice) {
                // Si hay voz específica configurada, FORZAR su idioma
                utterance.voice = globalConfig.voice;
                utterance.lang = globalConfig.lang;
            } else if (globalConfig.voiceIndex === -1) {
                // Si es voz por defecto del sistema, usar idioma configurado
                utterance.voice = null;
                utterance.lang = globalConfig.lang;
            }
            
            // Reproducir
            speechSynthesis.speak(utterance);
        });
    }
    
    previousParagraph() {
        if (this.currentParagraphIndex > 0) {
            this.currentParagraphIndex--;            
            // Verificar isPaused PRIMERO
            if (this.isPaused) {
                // Si está pausado, solo actualizar la UI (resaltado, progreso, texto)
                this.pausedAtParagraphIndex = this.currentParagraphIndex; // Actualizar posición de pausa
                this.updateProgress();
                this.updateStatus(t('pausedAtParagraphNumber').replace('{0}', this.currentParagraphIndex + 1));
            } else if (this.isPlaying) {
                // Si está reproduciendo, cancelar y empezar nuevo párrafo
                speechSynthesis.cancel();
                this.readCurrentParagraph();
            } else {
                // Si está detenido, solo actualizar UI
                this.updateProgress();
                this.updateStatus(t('readyToPlayParagraphNumber').replace('{0}', this.currentParagraphIndex + 1));
            }
        }
    }
    
    nextParagraph() {
        if (this.currentParagraphIndex < this.paragraphs.length - 1) {
            this.currentParagraphIndex++;            
            // Verificar isPaused PRIMERO
            if (this.isPaused) {
                // Si está pausado, solo actualizar la UI (resaltado, progreso, texto)
                this.pausedAtParagraphIndex = this.currentParagraphIndex; // Actualizar posición de pausa
                this.updateProgress();
                this.updateStatus(t('pausedAtParagraphNumber').replace('{0}', this.currentParagraphIndex + 1));
            } else if (this.isPlaying) {
                // Si está reproduciendo, cancelar y empezar nuevo párrafo
                speechSynthesis.cancel();
                this.readCurrentParagraph();
            } else {
                // Si está detenido, solo actualizar UI
                this.updateProgress();
                this.updateStatus(t('readyToPlayParagraphNumber').replace('{0}', this.currentParagraphIndex + 1));
            }
        } else if (this.isPlaying) {
            // Fin de la lectura
            this.stop();
            this.updateStatus(t('readingCompleted'));
        }
    }

    restartFromBeginningSimple() {        
        // Detener reproducción actual si está activa
        if (this.isPlaying || this.isPaused) {
            speechSynthesis.cancel();
            this.isPlaying = false;
            this.isPaused = false;
        }
        
        // Resetear al primer párrafo
        this.currentParagraphIndex = 0;
        
        // Limpiar resaltado anterior
        this.removeHighlight();
        
        // Hacer scroll al primer párrafo con resaltado
        if (this.paragraphs.length > 0) {
            const firstParagraph = this.paragraphs[0];
            
            // Resaltar el primer párrafo
            this.highlightCurrentParagraph();
            
            // Hacer scroll al primer párrafo
            this.smartScrollToElement(firstParagraph, {
                behavior: 'smooth',
                block: 'center'
            });
            
            // Actualizar UI
            this.updateProgress();
            this.updateStatus(t('restartedParagraphCount').replace('{0}', this.paragraphs.length));
            this.updatePlayPauseButton(false); // Asegurar que muestre botón de play
        } else {
            this.updateStatus(t('noContentToRestart'));
        }
    }

    // Método para cargar y reproducir texto desde selección contextual
    loadAndPlayText(text, options = {}) {        
        // Detener reproducción actual
        if (this.isPlaying || this.isPaused) {
            speechSynthesis.cancel();
            this.isPlaying = false;
            this.isPaused = false;
        }
        
        // Crear párrafo temporal con el texto seleccionado
        const tempParagraph = {
            element: options.sourceElement || document.body,
            text: text,
            isFromSelection: true
        };
        
        // Reemplazar párrafos temporalmente
        this.originalParagraphs = this.paragraphs; // Guardar párrafos originales
        this.paragraphs = [tempParagraph];
        this.currentParagraphIndex = 0;
        
        // Si se proporciona rango y opción de scroll, hacer resaltado y scroll
        if (options.range && options.scrollToElement) {
            this.highlightRange(options.range);
            
            if (options.sourceElement) {
                this.smartScrollToElement(options.sourceElement, {
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }
        
        // Actualizar UI
        this.updateProgress();
        this.updateStatus('Reproduciendo texto seleccionado');
        
        // Iniciar reproducción automáticamente
        this.play();
    }

    // Método mejorado para saltar a contenido específico en la página
    async jumpToTextContent(selectedText, sourceElement) {
        try {
            await this.loadVoiceSettings();
        } catch (voiceError) {
            console.warn('[AudioPlayer] Error recargando configuraciones de voz:', voiceError);
        }
        
        // Detener reproducción actual
        if (this.isPlaying || this.isPaused) {
            speechSynthesis.cancel();
            this.isPlaying = false;
            this.isPaused = false;
        }
        
        // Buscar el párrafo que contiene el texto seleccionado
        let targetParagraphIndex = -1;
        let targetElement = sourceElement;
        
        // Intentar encontrar el párrafo en la lista existente
        for (let i = 0; i < this.paragraphs.length; i++) {
            const paragraph = this.paragraphs[i];
            if (paragraph.text.includes(selectedText.trim()) || 
                paragraph.element === sourceElement ||
                paragraph.element.contains(sourceElement)) {
                targetParagraphIndex = i;
                targetElement = paragraph.element;
                break;
            }
        }
        
        // Si no se encuentra, buscar en el elemento más cercano
        if (targetParagraphIndex === -1) {
            // Buscar hacia arriba en el DOM para encontrar un párrafo válido
            let currentElement = sourceElement;
            while (currentElement && currentElement !== document.body) {
                for (let i = 0; i < this.paragraphs.length; i++) {
                    if (this.paragraphs[i].element === currentElement || 
                        this.paragraphs[i].element.contains(currentElement)) {
                        targetParagraphIndex = i;
                        targetElement = this.paragraphs[i].element;
                        break;
                    }
                }
                if (targetParagraphIndex !== -1) break;
                currentElement = currentElement.parentElement;
            }
        }
        
        // Si aún no se encuentra, usar el primer párrafo
        if (targetParagraphIndex === -1 && this.paragraphs.length > 0) {
            targetParagraphIndex = 0;
            targetElement = this.paragraphs[0].element;
        }
        
        // Actualizar el índice actual
        this.currentParagraphIndex = Math.max(0, targetParagraphIndex);
        
        // Scroll al elemento con animación suave
        if (targetElement) {
            this.smartScrollToElement(targetElement, {
                behavior: 'smooth',
                block: 'center'
            });
            
            // Resaltar el elemento objetivo
            this.highlightCurrentParagraph();
        }
        
        // Actualizar UI inmediatamente
        this.updateProgress();
        this.updateStatus(t('readyToPlayParagraphFromSelection').replace('{0}', this.currentParagraphIndex + 1));
        
        // Iniciar reproducción automáticamente
        setTimeout(() => {
            this.play();
        }, 300); // Pequeña pausa para permitir el scroll  
    }
    
    // Método auxiliar para resaltar un rango específico
    highlightRange(range) {
        // Limpiar resaltado anterior
        this.removeHighlight();
        
        try {
            const span = document.createElement('span');
            span.className = 'audio-player-highlight selection-from-contextual';
            
            // Extraer contenido y envolver
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
        } catch (error) {
            console.warn('[AudioPlayer] Error resaltando rango:', error);
        }
    }

    // Método para reiniciar desde el principio
    async restartFromBeginning() {        
        try {
            // 1. Detener cualquier reproducción activa
            if (this.isPlaying || this.isPaused) {
                speechSynthesis.cancel();
                this.isPlaying = false;
                this.isPaused = false;
            }
            
            try {
                this.removeHighlight();
            } catch (highlightError) {
                console.warn('[AudioPlayer] Error limpiando resaltados:', highlightError);
                // Continuar sin fallar
            }
            
            // 3. Resetear al primer párrafo
            this.currentParagraphIndex = 0;
            this.pausedAtParagraphIndex = -1; // Resetear estado de pausa
            
            // 4. Verificar que tenemos párrafos
            if (this.paragraphs.length === 0) {
                console.warn('[AudioPlayer] No hay párrafos disponibles');
                this.updateStatus(t('noContentToPlayGlobal'));
                return;
            }
            
            // 5. Scroll al primer párrafo
            const firstParagraph = this.paragraphs[0];
            if (firstParagraph && firstParagraph.element) {
                try {
                    this.smartScrollToElement(firstParagraph.element, {
                        behavior: 'smooth',
                        block: 'center'
                    });                    
                    // Fallback: scroll adicional después de un delay
                    setTimeout(() => {
                        const rect = firstParagraph.element.getBoundingClientRect();                        
                        // Si el elemento no está visible, hacer scroll adicional
                        if (rect.top < 0 || rect.bottom > window.innerHeight) {
                            this.smartScrollToElement(firstParagraph.element, {
                                behavior: 'smooth',
                                block: 'center'
                            });
                        }
                    }, 500);
                    
                } catch (scrollError) {
                    console.warn('[AudioPlayer] Error en scroll:', scrollError);
                }
                
                // 6. Resaltar el primer párrafo después de un breve delay
                setTimeout(() => {
                    try {
                        this.highlightCurrentParagraph();
                    } catch (highlightError) {
                        console.warn('[AudioPlayer] Error resaltando párrafo:', highlightError);
                    }
                }, 200);
            } else {
                console.warn('[AudioPlayer] Primer párrafo no tiene elemento válido');
            }
            
            // 7. Actualizar barra de progreso
            try {
                this.updateProgress();
            } catch (progressError) {
                console.warn('[AudioPlayer] Error actualizando progreso:', progressError);
            }
            
            // 8. Actualizar estado
            try {
                this.updateStatus(t('restartedReadyToPlay'));
            } catch (statusError) {
                console.warn('[AudioPlayer] Error actualizando estado:', statusError);
            }
            
            // 9. Recargar configuraciones de voz para respetar la selección
            try {
                await this.loadVoiceSettings();
            } catch (voiceError) {
                console.warn('[AudioPlayer] Error recargando configuraciones de voz:', voiceError);
            }
            
            // 10. Actualizar botones de play/pause
            try {
                this.updatePlayPauseButtons(false); // false = mostrar play
            } catch (buttonError) {
                console.warn('[AudioPlayer] Error actualizando botones:', buttonError);
            }
                        
        } catch (error) {
            console.error('[AudioPlayer] Error durante el reinicio:', error);
            console.error('[AudioPlayer] Stack trace:', error.stack);
            this.updateStatus('Error al reiniciar - Ver consola para detalles');
        }
    }
    
    // Método auxiliar para actualizar botones de play/pause
    updatePlayPauseButtons(isPlaying) {
        const playIcon = chrome.runtime.getURL('icons/play.svg');
        const pauseIcon = chrome.runtime.getURL('icons/pause.svg');
        
        // Botones del reproductor normal
        const playPauseBtn = this.playerElement.querySelector('#playPauseBtn img');
        const miniPlayPauseBtn = this.playerElement.querySelector('#miniPlayPauseBtn img');
        
        if (playPauseBtn) {
            playPauseBtn.src = isPlaying ? pauseIcon : playIcon;
            playPauseBtn.alt = isPlaying ? t('pauseButton') : t('playButton');
        }
        if (miniPlayPauseBtn) {
            miniPlayPauseBtn.src = isPlaying ? pauseIcon : playIcon;
            miniPlayPauseBtn.alt = isPlaying ? t('pauseButton') : t('playButton');
        }
    }

    updateSpeed(speed) {
        this.settings.speed = parseFloat(speed);
        
        // Si está reproduciendo, reiniciar con nueva velocidad
        if (this.isPlaying && !this.isPaused) {
            speechSynthesis.cancel();
            this.readCurrentParagraph();
        }
    }
    
    minimizePlayer() {
        const player = this.playerElement.querySelector('#compactPlayer');
        // VERIFICACIÓN ADICIONAL: Si el reproductor nunca se movió, NO puede estar docked
        const hasBeenMoved = this.playerElement.style.left && this.playerElement.style.left !== '';
        const wasDocked = this.isDocked && hasBeenMoved;
        
        if (wasDocked) {
            // Ocultar el dock tab temporalmente durante la transición
            if (this.dockTab) {
                this.dockTab.style.display = 'none';
            }
        } else {
            if (!hasBeenMoved) {
                // Forzar reset del estado docked por si estaba mal establecido
                this.isDocked = false;
            }
        }
        
        // Agregar clase minimized y cambiar posición
        player.classList.add('minimized');
        
        // Guardar estado minimizado
        this.isMinimized = true;
        
        // Sincronizar botones de play/pause
        this.syncPlayButtons();
        
        // Si estaba docked, reconfigurar para mini
        if (wasDocked) {
            // Mantener estado docked pero reconfigurar para mini
            this.isDocked = true;
            // Reposicionar para mini player docked
            setTimeout(() => {
                this.dockToLeftMini();
            }, 100);
        } else {
            // PREVENCIÓN TOTAL DE DOCK AUTOMÁTICO
            this.preventAutoDock = true;
            this.isActivelyDragging = false; // Reset completo de estados
            
            // Forzar posición de mini player a esquina inferior derecha
            setTimeout(() => {
                const miniPlayer = this.playerElement.querySelector('#compactPlayer');
                if (miniPlayer) {
                    miniPlayer.style.left = 'auto';
                    miniPlayer.style.top = 'auto'; 
                    miniPlayer.style.right = '20px';
                    miniPlayer.style.bottom = '20px';
                }
            }, 50);
            
            // Configurar drag normal para el modo minimizado después de un delay MÁS LARGO
            setTimeout(() => {
                this.setupMinimizedDrag();
            }, 500); // Delay más largo para asegurar posicionamiento
            
            // Reactivar auto-dock después de 2 segundos (tiempo razonable)
            setTimeout(() => {
                this.preventAutoDock = false;
            }, 2000);
        }
        
    }
    
    expandPlayer() {
        // Agregar protección contra expansión accidental durante drag
        if (this.isDraggingMini) {
            return;
        }
        
        console.trace('📍 Stack trace de expandPlayer:'); // Agregar stack trace para debugging
        const player = this.playerElement.querySelector('#compactPlayer');
        const playerContainer = this.playerElement; // Contenedor principal
        
        // Verificar si está docked antes de expandir
        const wasDocked = this.isDocked;
        if (wasDocked) {
            // Ocultar el dock tab temporalmente durante la transición
            if (this.dockTab) {
                this.dockTab.style.display = 'none';
            }
        }
        
        // Restaurar todas las propiedades del contenedor principal también
        if (playerContainer) {
            playerContainer.style.position = '';
            playerContainer.style.left = '';
            playerContainer.style.top = '';
            playerContainer.style.right = '';
            playerContainer.style.bottom = '';
            playerContainer.style.width = '';
            playerContainer.style.height = '';
            playerContainer.style.transform = '';
            playerContainer.style.zIndex = '';
        }
        
        // Restaurar todas las propiedades de posición del reproductor
        player.style.position = '';
        player.style.left = '';
        player.style.top = '';
        player.style.right = '';
        player.style.bottom = '';
        player.style.width = '';
        player.style.height = '';
        player.style.minWidth = '';
        player.style.maxWidth = '';
        player.style.minHeight = '';
        player.style.maxHeight = '';
        player.style.zIndex = '';
        player.style.transition = '';
        
        // Remover clase minimized
        player.classList.remove('minimized');
        
        // Asegurar que el reproductor principal sea visible con un pequeño delay
        setTimeout(() => {
            if (playerContainer) {
                playerContainer.style.display = 'block';
                playerContainer.style.visibility = 'visible';
                playerContainer.style.opacity = '1';                
                // Limpiar efectos visuales de dock proximity al expandir
                const dragArea = playerContainer.querySelector('.player-drag-area');
                if (dragArea) {
                    dragArea.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.2)';
                    dragArea.style.transform = 'none';
                    dragArea.style.background = 'linear-gradient(135deg, #4fc3f7 0%, #29b6f6 50%, #0288d1 100%)';
                }
                
                // Verificar que está visible
                const rect = playerContainer.getBoundingClientRect();
            }
        }, 50);
        
        // Restaurar estado expandido
        this.isMinimized = false;
        
        // Sincronizar botones de play/pause
        this.syncPlayButtons();
        
        // SIEMPRE reestablecer listeners del reproductor normal al expandir
        this.setupDragAndDrop();
        
        if (wasDocked) {
            // Mantener estado docked pero reconfigurar para normal
            this.isDocked = true;
            // Reposicionar para reproductor normal docked
            setTimeout(() => {
                this.dockToLeft();
            }, 100);
        } else {
            // Asegurar que el estado dock esté limpio
            this.isDocked = false;
        }
        
        // Reset de la bandera preventAutoDock al expandir
        this.preventAutoDock = false;
    }
    
    syncPlayButtons() {
        // Sincronizar iconos de play/pause en ambos reproductores
        const mainPlayBtn = this.playerElement.querySelector('#playPauseBtn img');
        const miniPlayBtn = this.playerElement.querySelector('#miniPlayPauseBtn img');
        
        if (mainPlayBtn && miniPlayBtn) {
            miniPlayBtn.src = mainPlayBtn.src;
            miniPlayBtn.alt = mainPlayBtn.alt;
        }
    }
    
    setupMinimizedDrag() {
        // Esperar un momento para que el DOM se actualice
        setTimeout(() => {
            const miniPlayer = this.playerElement.querySelector('#compactPlayer');
            const dragArea = miniPlayer?.querySelector('.mini-drag-area');
            
            if (!dragArea || !miniPlayer || !miniPlayer.classList.contains('minimized')) {
                console.warn('No se pudo configurar drag para reproductor minimizado');
                return;
            }            
        let isDragging = false;
        let isActuallyDragging = false; // Nuevo flag para distinguir drag de click
        let startX, startY; // Posiciones iniciales del mouse
        let initialLeft, initialTop; // Posiciones iniciales del elemento (como reproductor normal)
        const dragThreshold = 5; // Píxeles mínimos para considerar que es un drag
        
        const startDrag = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            isDragging = true;
            isActuallyDragging = false; // Reset del flag
            this.isDraggingMini = true; // Activar protección contra expansión
            this.isActivelyDragging = true; // Activar bandera de arrastre activo
            
            // Usar la misma lógica que el reproductor normal
            startX = e.clientX; // Posición del mouse, no del elemento
            startY = e.clientY;
            
            // Desactivar físicamente el botón expandir durante el drag
            const expandButton = miniPlayer.querySelector('.expand-btn');
            if (expandButton) {
                expandButton.style.pointerEvents = 'none';
                expandButton.style.opacity = '0.5';
            }
            
            // Verificar que el reproductor sigue minimizado
            if (!miniPlayer.classList.contains('minimized')) {
                console.warn('El reproductor ya no está minimizado');
                return;
            }
            
            // Forzar tamaño fijo antes de iniciar el arrastre
            miniPlayer.style.width = '185px';
            miniPlayer.style.height = '70px';
            miniPlayer.style.minWidth = '185px';
            miniPlayer.style.maxWidth = '185px';
            miniPlayer.style.minHeight = '70px';
            miniPlayer.style.maxHeight = '70px';
            
            // Obtener la posición actual del reproductor (igual que reproductor normal)
            const rect = miniPlayer.getBoundingClientRect();
            initialLeft = Math.round(rect.left);
            initialTop = Math.round(rect.top);
            

            
            // Cambiar estilos para el arrastre
            miniPlayer.style.transition = 'none';
            miniPlayer.style.zIndex = '10001';
            
            // Cambiar inmediatamente a posicionamiento desde la izquierda para permitir llegar al borde
            miniPlayer.style.right = 'auto';
            miniPlayer.style.left = initialLeft + 'px';
            
            // Verificar después del cambio
            const newRect = miniPlayer.getBoundingClientRect();
            dragArea.style.cursor = 'grabbing';
            
            // Prevenir selección de texto
            document.body.style.userSelect = 'none';
            document.body.style.webkitUserSelect = 'none';
        };
        
        const drag = (e) => {
            if (!isDragging || this.isDocked) return; // No procesar si está docked
            
            e.preventDefault();
            e.stopPropagation();
            
            // Calcular distancia desde el punto inicial (usar startX/startY como reproductor normal)
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            // Solo activar arrastre real si se supera el umbral
            if (distance > dragThreshold) {
                isActuallyDragging = true;
            }
            
            // Solo mover si realmente se está arrastrando
            if (!isActuallyDragging) return;
            
            // Calcular nueva posición directamente
            const newX = initialLeft + deltaX;
            const newY = initialTop + deltaY;
            
            // Aplicar restricciones del viewport en todos los lados
            const containerWidth = miniPlayer.offsetWidth;
            const containerHeight = miniPlayer.offsetHeight;
            const maxX = window.innerWidth - containerWidth;
            const maxY = window.innerHeight - containerHeight;
            
            const constrainedX = Math.max(0, Math.min(newX, maxX));
            const constrainedY = Math.max(0, Math.min(newY, maxY));
            
            // Debug: mostrar restricciones aplicadas cuando se acerque a los bordes
            if (newX !== constrainedX || newY !== constrainedY) {
            }
            
            // Indicador visual cerca del borde izquierdo (consistente con reproductor normal)
            if (constrainedX <= 5) {
                const dragArea = miniPlayer.querySelector('.mini-drag-area');
                if (dragArea && !this.isDocked) {
                    dragArea.style.boxShadow = '0 0 8px rgba(255, 255, 255, 0.25), 0 0 12px rgba(135, 206, 235, 0.2)';
                    dragArea.style.transform = 'scale(1.01)';
                    miniPlayer.style.opacity = '0.95';
                    miniPlayer.style.transform = 'scale(0.99)';
                }
            } else {
                const dragArea = miniPlayer.querySelector('.mini-drag-area');
                if (dragArea) {
                    dragArea.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.2)';
                    dragArea.style.transform = 'none'; 
                    miniPlayer.style.opacity = '1';
                    miniPlayer.style.transform = 'scale(1)';
                }
            }
            
            // Aplicar nueva posición
            miniPlayer.style.left = constrainedX + 'px';
            miniPlayer.style.top = constrainedY + 'px';
            miniPlayer.style.right = 'auto';
            miniPlayer.style.bottom = 'auto';
            
            // Verificación adicional: asegurar que la posición aplicada esté dentro del viewport
            requestAnimationFrame(() => {
                const finalRect = miniPlayer.getBoundingClientRect();
                if (finalRect.right > window.innerWidth || finalRect.bottom > window.innerHeight) {
                    console.warn(' [Mini] Reproductor fuera del viewport después de aplicar posición:', {
                        rect: { right: finalRect.right, bottom: finalRect.bottom },
                        viewport: { width: window.innerWidth, height: window.innerHeight }
                    });
                }
            });
            
            // Forzar el tamaño fijo durante el arrastre
            miniPlayer.style.width = '185px';
            miniPlayer.style.height = '70px';
            miniPlayer.style.minWidth = '185px';
            miniPlayer.style.maxWidth = '185px';
            miniPlayer.style.minHeight = '70px';
            miniPlayer.style.maxHeight = '70px';
        };
        
        const endDrag = (e) => {
            if (!isDragging || this.isDocked) return; // No procesar si está docked
            
            e.preventDefault();
            e.stopPropagation();
            
            // Resetear flags
            isDragging = false;
            isActuallyDragging = false;
            this.isActivelyDragging = false; // Desactivar bandera de arrastre activo
            
            // Verificar if debe hacer dock al borde izquierdo (reproductor minimizado - muy cerca del borde)
            // Solo verificar dock si el mini player tiene una posición establecida (se ha movido)
            const hasLeftStyle = miniPlayer.style.left && miniPlayer.style.left !== '';
            const currentX = hasLeftStyle ? parseInt(miniPlayer.style.left) : null;
            
            if (hasLeftStyle && currentX !== null && currentX <= 2 && !this.isDocked && !this.preventAutoDock) {
                this.dockToLeftMini();
            } else {
                // Restaurar opacidad y efectos visuales si no se hace dock
                miniPlayer.style.opacity = '1';
                miniPlayer.style.transform = 'scale(1)';
                // Restaurar apariencia original del drag-area
                const dragArea = miniPlayer.querySelector('.mini-drag-area');
                if (dragArea) {
                    dragArea.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.2)';
                    dragArea.style.transform = 'none';
                }
            }
            
            // Desactivar protección después de un breve delay para evitar clics accidentales
            setTimeout(() => {
                this.isDraggingMini = false;                
                // Reactivar el botón expandir
                const expandButton = miniPlayer.querySelector('.expand-btn');
                if (expandButton) {
                    expandButton.style.pointerEvents = 'auto';
                    expandButton.style.opacity = '1';
                }
            }, 300); // 300ms de delay para mayor seguridad
            
            // Restaurar estilos
            miniPlayer.style.transition = 'all 0.3s ease';
            miniPlayer.style.zIndex = '10000';
            dragArea.style.cursor = 'grab';
            
            // Mantener la posición donde el usuario lo dejó (como el reproductor normal)
            // No forzar cambio de posicionamiento - respetar la posición libre del usuario
            
            // Asegurar que el tamaño se mantenga fijo después del arrastre
            miniPlayer.style.width = '185px';
            miniPlayer.style.height = '70px';
            miniPlayer.style.minWidth = '185px';
            miniPlayer.style.maxWidth = '185px';
            miniPlayer.style.minHeight = '70px';
            miniPlayer.style.maxHeight = '70px';
            
            // Restaurar selección de texto
            document.body.style.userSelect = '';
            document.body.style.webkitUserSelect = '';
        };
        
        // Event listeners para mouse
        dragArea.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', endDrag);
        
        // Event listeners para touch (móvil)
        dragArea.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            startDrag({
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => e.preventDefault(),
                stopPropagation: () => e.stopPropagation()
            });
        });
        
        const touchMoveHandler = (e) => {
            if (!isDragging) return;
            const touch = e.touches[0];
            drag({
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => e.preventDefault(),
                stopPropagation: () => e.stopPropagation()
            });
        };
        
        const touchEndHandler = (e) => {
            endDrag({
                preventDefault: () => e.preventDefault(),
                stopPropagation: () => e.stopPropagation()
            });
        };
        
        document.addEventListener('touchmove', touchMoveHandler, { passive: false });
        document.addEventListener('touchend', touchEndHandler);
        
        // Prevenir clics accidentales en el área de arrastre que causen expansión
        dragArea.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation(); // Agregar esta línea para mayor seguridad
        });
        
        // Bloquear cualquier clic en el mini-player que no sea en los botones
        miniPlayer.addEventListener('click', (e) => {
            // Solo permitir clics en botones específicos
            if (!e.target.closest('.mini-btn') && !e.target.closest('button')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        });
        
        // Limpiar listeners anteriores si existen
        this.cleanupDragListeners = () => {
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', endDrag);
            document.removeEventListener('touchmove', touchMoveHandler);
            document.removeEventListener('touchend', touchEndHandler);
        };
        
        }, 100); // Fin del setTimeout
    }
    
    updatePlayButton(isPlaying) {        
        const playBtn = this.playerElement.querySelector('#playPauseBtn');
        const miniPlayBtn = this.playerElement.querySelector('#miniPlayPauseBtn');
        
        // Actualizar botón principal
        const img = playBtn?.querySelector('img');
        if (img) {
            if (isPlaying) {
                img.src = chrome.runtime.getURL('icons/pause.svg');
                img.alt = t('pauseButton');
                playBtn.title = t('pauseButton');
            } else {
                img.src = chrome.runtime.getURL('icons/play.svg');
                img.alt = t('playButton');
                playBtn.title = t('playButton');
            }
        }
        
        // Actualizar botón minimizado
        const miniImg = miniPlayBtn?.querySelector('img');
        if (miniImg) {
            if (isPlaying) {
                miniImg.src = chrome.runtime.getURL('icons/pause.svg');
                miniImg.alt = t('pauseButton');
                miniPlayBtn.title = t('pauseButton');
            } else {
                miniImg.src = chrome.runtime.getURL('icons/play.svg');
                miniImg.alt = t('playButton');
                miniPlayBtn.title = t('playButton');
            }
        }
        
    }
    
    updateStatus(status) {
        const statusElement = this.playerElement.querySelector('#statusMini');
        if (statusElement) statusElement.textContent = status;
    }
    
    updateProgress() {
        const currentElement = this.playerElement.querySelector('.progress-current');
        const totalElement = this.playerElement.querySelector('.progress-total');
        const progressFill = this.playerElement.querySelector('#progressFill');
        const progressHandle = this.playerElement.querySelector('#progressHandle');
        const miniProgressBar = this.playerElement.querySelector('#miniProgressBar');
        const miniProgress = this.playerElement.querySelector('.mini-progress');
        
        if (currentElement) {
            currentElement.textContent = this.currentParagraphIndex + 1;
        }
        
        // Actualizar el total de elementos (para que se vea X / Nuevo_Total)
        if (totalElement) {
            totalElement.textContent = this.paragraphs.length;
        }

        // SIEMPRE actualizar el resaltado del párrafo actual
        if (this.paragraphs[this.currentParagraphIndex]) {
            this.highlightCurrentParagraph(this.paragraphs[this.currentParagraphIndex].element);
            // También actualizar el texto mostrado
            this.updateCurrentText(this.paragraphs[this.currentParagraphIndex].text);
        }
        
        // Actualizar barra de progreso visual (reproductor normal)
        if (progressFill && progressHandle && this.paragraphs.length > 0) {
            const percentage = ((this.currentParagraphIndex + 1) / this.paragraphs.length) * 100;
            progressFill.style.width = `${percentage}%`;
            progressHandle.style.left = `${percentage}%`;
        }
        
        // Actualizar barra de progreso minimizada
        if (miniProgressBar && this.paragraphs.length > 0) {
            const percentage = ((this.currentParagraphIndex + 1) / this.paragraphs.length) * 100;
            miniProgressBar.style.width = `${percentage}%`;
            
            // Actualizar posición del handle en el reproductor minimizado
            if (miniProgress) {
                miniProgress.style.setProperty('--progress-position', `${percentage}%`);
            }
        }
    }
    
    updateCurrentText(text) {
        const textElement = this.playerElement.querySelector('.current-text');
        if (textElement) {
            textElement.textContent = text.length > 200 ? text.substring(0, 200) + '...' : text;
        }
    }
    
    clearCurrentText() {
        const textElement = this.playerElement.querySelector('.current-text');
        if (textElement) {
            textElement.textContent = 'Reproductor detenido';
        }
    }
    
    highlightCurrentParagraph(element) {
        // Remover highlight anterior
        document.querySelectorAll('.audio-player-highlight').forEach(el => {
            el.classList.remove('audio-player-highlight');
        });
        
        // Si no se proporciona elemento, usar el párrafo actual
        if (!element && this.paragraphs[this.currentParagraphIndex]) {
            element = this.paragraphs[this.currentParagraphIndex].element;
        }
        
        // Agregar highlight actual
        if (element) {
            element.classList.add('audio-player-highlight');
            
            // Scroll suave al elemento solo si no es desde reinicio (para evitar scroll doble)
            if (arguments.length > 0) {
                this.smartScrollToElement(element, {
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }
    }

    // Método para remover todos los resaltados
    removeHighlight() {
        try {
            document.querySelectorAll('.audio-player-highlight').forEach(el => {
                el.classList.remove('audio-player-highlight');
            });
            // También remover otros tipos de resaltado si existen
            document.querySelectorAll('.selection-text-highlight').forEach(el => {
                el.classList.remove('selection-text-highlight');
            });
        } catch (error) {
            console.warn('[AudioPlayer] Error removiendo resaltados:', error);
        }
    }
    
    toggleMinimize() {
        this.playerElement.classList.toggle('minimized');
        const minimizeBtn = this.playerElement.querySelector('#minimizeBtn');
        minimizeBtn.textContent = this.playerElement.classList.contains('minimized') ? '➕' : '➖';
        
        // Si se minimiza, resetear posición a la esquina inferior derecha
        if (this.playerElement.classList.contains('minimized')) {
            // PREVENCIÓN TOTAL DE DOCK AUTOMÁTICO AL MINIMIZAR
            this.preventAutoDock = true;
            this.isActivelyDragging = false; // Reset de cualquier estado de drag            
            this.playerElement.style.left = 'auto';
            this.playerElement.style.top = 'auto';
            this.playerElement.style.right = '20px';
            this.playerElement.style.bottom = '20px';
            
            // TIMEOUT MÁS LARGO para asegurar que no hay dock accidental
            setTimeout(() => {
                this.preventAutoDock = false;
            }, 5000); // 5 segundos para estar completamente seguro
        }
        
        // Marcar que el usuario cambió manualmente el tamaño
        this.userManuallyMinimized = this.playerElement.classList.contains('minimized');
        
        // Forzar viewport containment después del cambio de tamaño
        setTimeout(() => {
            this.forceViewportContainment();
        }, 100); // Pequeño delay para que se apliquen los estilos CSS
        
        // Pausar temporalmente la detección cuando el usuario interactúa con el tamaño
        this.pauseContentObserver();
        setTimeout(() => {
            this.resumeContentObserver();
        }, 8000); // 8 segundos de pausa después de cambiar tamaño
    }
    
    openSettings() {
        // Crear panel de configuración de voz
        this.createVoiceSettingsPanel();
    }
    
    createVoiceSettingsPanel() {
        // Eliminar panel existente si existe
        const existingPanel = document.querySelector('.voice-settings-panel');
        if (existingPanel) {
            existingPanel.remove();
            return; // Toggle: si ya existe, lo cerramos
        }
        
        // Obtener voces disponibles
        const voices = speechSynthesis.getVoices();
        
        // Detectar idioma para voz predeterminada
        const userLang = navigator.language || navigator.userLanguage || 'es-ES';
        const defaultVoiceText = userLang.startsWith('es') ? 'Voz predeterminada del sistema' : 'Default system voice';
        
        // Crear panel
        const panel = document.createElement('div');
        panel.className = 'voice-settings-panel';
        panel.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
        panel.innerHTML = `
            <div class="voice-settings-container">
                <div class="voice-settings-header">
                    <h3>${t('voiceConfiguration')}</h3>
                    <button class="voice-close-btn">✕</button>
                </div>
                <div class="voice-settings-content">
                    <div class="voice-setting-group">
                        <label for="voiceSelect">${t('voiceLabel')}</label>
                        <select id="voiceSelect" class="voice-select">
                            <option value="-1" ${this.selectedVoiceIndex === -1 ? 'selected' : ''}>${defaultVoiceText}</option>
                            ${voices.map((voice, index) => 
                                `<option value="${index}" ${index === this.selectedVoiceIndex ? 'selected' : ''}>
                                    ${voice.name} (${voice.lang})
                                </option>`
                            ).join('')}
                        </select>
                    </div>
                    
                    <div class="voice-setting-group">
                        <label for="pitchSlider">${t('pitchLabel')} <span id="pitchValue">${this.settings.pitch || 1}</span></label>
                        <input type="range" id="pitchSlider" min="0.5" max="2" step="0.1" value="${this.settings.pitch || 1}" class="voice-slider">
                    </div>
                    
                    <div class="voice-setting-group">
                        <label for="volumeSlider">${t('volumeLabel')} <span id="volumeValue">${Math.round((this.settings.volume || 1) * 100)}%</span></label>
                        <input type="range" id="volumeSlider" min="0" max="1" step="0.1" value="${this.settings.volume || 1}" class="voice-slider">
                    </div>
                    
                    <div class="voice-setting-group">
                        <button id="testVoiceBtn" class="test-voice-btn">${t('testVoiceButton')}</button>
                    </div>
                </div>
            </div>
        `;
        
        // Agregar al DOM
        document.body.appendChild(panel);        
        // Configurar eventos
        this.setupVoiceSettingsEvents(panel);
        
        // Mostrar con animación
        setTimeout(() => {
            panel.classList.add('show');
        }, 5);
    }
    
    setupVoiceSettingsEvents(panel) {
        const voiceSelect = panel.querySelector('#voiceSelect');
        const pitchSlider = panel.querySelector('#pitchSlider');
        const volumeSlider = panel.querySelector('#volumeSlider');
        const testBtn = panel.querySelector('#testVoiceBtn');
        const closeBtn = panel.querySelector('.voice-close-btn');
        const pitchValue = panel.querySelector('#pitchValue');
        const volumeValue = panel.querySelector('#volumeValue');
        
        // Selección de voz
        voiceSelect.addEventListener('change', (e) => {
            const selectedValue = parseInt(e.target.value);
            
            const oldIndex = this.selectedVoiceIndex;
            this.selectedVoiceIndex = selectedValue === -1 ? -1 : selectedValue;
                        
            // Obtener información de la voz seleccionada para logging
            const voices = speechSynthesis.getVoices();
            if (this.selectedVoiceIndex >= 0 && this.selectedVoiceIndex < voices.length) {
                const selectedVoice = voices[this.selectedVoiceIndex];
            } else if (this.selectedVoiceIndex === -1) {
                }
            
            this.saveVoiceSettings();
            
            // Mostrar notificación de cambio de voz
            this.showVoiceChangeNotification();
        });
        
        // Control de tono
        pitchSlider.addEventListener('input', (e) => {
            const pitch = parseFloat(e.target.value);
            this.settings.pitch = pitch;
            pitchValue.textContent = pitch;
            this.saveVoiceSettings();
        });
        
        // Control de volumen
        volumeSlider.addEventListener('input', (e) => {
            const volume = parseFloat(e.target.value);
            this.settings.volume = volume;
            volumeValue.textContent = Math.round(volume * 100) + '%';
            this.saveVoiceSettings();
        });
        
        // Probar voz
        testBtn.addEventListener('click', () => {
            this.testCurrentVoice();
        });
        
        // Cerrar panel
        closeBtn.addEventListener('click', () => {
            panel.classList.remove('show');
            setTimeout(() => panel.remove(), 300);
        });
        
        // Cerrar al hacer clic fuera
        panel.addEventListener('click', (e) => {
            if (e.target === panel) {
                panel.classList.remove('show');
                setTimeout(() => panel.remove(), 300);
            }
        });
    }
    
    testCurrentVoice() {
        speechSynthesis.cancel(); // Cancelar cualquier reproducción
        
        // Obtener voces disponibles
        const voices = speechSynthesis.getVoices();
        let testText = t('voiceTestText'); // Fallback al texto base
        
        // Si hay una voz seleccionada, usar el texto específico para su idioma
        if (this.selectedVoiceIndex >= 0 && this.selectedVoiceIndex < voices.length) {
            const selectedVoice = voices[this.selectedVoiceIndex];
            if (selectedVoice) {
                testText = this.getTestTextForLanguage(selectedVoice.lang);
            }
        }
        
        const utterance = new SpeechSynthesisUtterance(testText);        
        // PRIORIZAR LA SELECCIÓN MANUAL DEL USUARIO
        let voiceApplied = false;
        
        // 1. Si hay una voz seleccionada manualmente, usarla SIEMPRE
        if (this.selectedVoiceIndex >= 0 && this.selectedVoiceIndex < voices.length) {
            const selectedVoice = voices[this.selectedVoiceIndex];
            if (selectedVoice) {
                utterance.voice = selectedVoice;
                utterance.lang = selectedVoice.lang;
                voiceApplied = true;
            }
        }
        
        // 2. Si no se aplicó voz manual, usar detección automática
        if (!voiceApplied) {
            const detectedLang = this.detectTextLanguage(testText);            
            const selectedVoice = this.selectAppropriateVoice(detectedLang, utterance);
        }
        
        utterance.pitch = this.settings.pitch || 1;
        utterance.volume = this.settings.volume || 1;
        utterance.rate = this.settings.speed || 1;
        
        speechSynthesis.speak(utterance);
    }
    
    saveVoiceSettings() {
        // Guardar configuración en localStorage
        const voiceSettings = {
            selectedVoiceIndex: this.selectedVoiceIndex,
            pitch: this.settings.pitch,
            volume: this.settings.volume,
            speed: this.settings.speed
        };
        
        localStorage.setItem('speedReaderVoiceSettings', JSON.stringify(voiceSettings));
        
        // Verificar inmediatamente que se guardó correctamente
        const verification = localStorage.getItem('speedReaderVoiceSettings');
        if (verification) {
            const parsed = JSON.parse(verification);
        } else {
            console.error('Error: No se pudo verificar el guardado en localStorage');
        }
        
        // Actualizar configuración actual si está reproduciendo
        if (this.isPlaying && !this.isPaused) {
            // La nueva configuración se aplicará en la siguiente frase
        }
    }
    
    reloadVoiceSettings() {
        try {
            const savedSettings = localStorage.getItem('speedReaderVoiceSettings');
            if (savedSettings) {
                const voiceSettings = JSON.parse(savedSettings);                
                // Actualizar configuración del reproductor (usando valores por defecto SOLO si undefined)
                this.selectedVoiceIndex = voiceSettings.selectedVoiceIndex !== undefined ? voiceSettings.selectedVoiceIndex : -1;
                this.settings.pitch = voiceSettings.pitch !== undefined ? voiceSettings.pitch : 1;
                this.settings.volume = voiceSettings.volume !== undefined ? voiceSettings.volume : 1;
                this.settings.speed = voiceSettings.speed !== undefined ? voiceSettings.speed : 1;
                                
                // Si está reproduciendo, detener la síntesis actual para aplicar la nueva configuración
                if (this.isPlaying && !this.isPaused) {
                    speechSynthesis.cancel();
                    // Reanudar con la nueva configuración después de un breve delay
                    setTimeout(() => {
                        this.continueReading();
                    }, 100);
                }
            }
        } catch (error) {
            console.warn('AudioPlayer: Error recargando configuración de voz:', error);
        }
    }
    
    updateModalVoiceUI() {
        // Actualizar la UI del modal si está abierto
        const modal = document.querySelector('.settings-modal');
        if (!modal) return;
        
        const voiceSelect = modal.querySelector('select');
        const pitchSlider = modal.querySelector('input[type="range"]:nth-of-type(1)');
        const volumeSlider = modal.querySelector('input[type="range"]:nth-of-type(2)');
        const pitchValue = modal.querySelector('.slider-value');
        const volumeValue = modal.querySelectorAll('.slider-value')[1];
        
        if (voiceSelect) {
            voiceSelect.value = this.selectedVoiceIndex.toString();
        }
        
        if (pitchSlider) {
            pitchSlider.value = this.settings.pitch.toString();
            if (pitchValue) {
                pitchValue.textContent = this.settings.pitch;
            }
        }
        
        if (volumeSlider) {
            volumeSlider.value = this.settings.volume.toString();
            if (volumeValue) {
                volumeValue.textContent = Math.round(this.settings.volume * 100) + '%';
            }
        }
        
    }
    
    async loadVoiceSettings() {
        try {            
            // Cargar configuración local del reproductor
            const localSaved = localStorage.getItem('speedReaderVoiceSettings');
            let localSettings = null;
            if (localSaved) {
                localSettings = JSON.parse(localSaved);
            }
            
            // Obtener TODAS las voces disponibles (no filtrar)
            const allVoices = speechSynthesis.getVoices();            
            // Determinar configuración inicial basada en prioridades y sincronización
            let initialVoiceIndex = 0;
            let initialPitch = 1;
            let initialVolume = 1;
            let initialSpeed = 1;
            
            // PRIORIDAD 1: Si hay configuración local del reproductor, usarla
            if (localSettings && localSettings.selectedVoiceIndex !== undefined) {
                const savedIndex = localSettings.selectedVoiceIndex;
                
                // Verificar que el índice guardado sea válido
                if (savedIndex >= 0 && savedIndex < allVoices.length) {
                    initialVoiceIndex = savedIndex;
                    const savedVoice = allVoices[savedIndex];
                } 
                // else {
                //     console.warn('[AudioPlayer] Índice guardado', savedIndex, 'fuera de rango. Total voces:', allVoices.length);
                //     // Mantener índice 0 como fallback
                // }
                
                initialPitch = localSettings.pitch !== undefined ? localSettings.pitch : 1;
                initialVolume = localSettings.volume !== undefined ? localSettings.volume : 1;
                // Speed se maneja separadamente
                
            }
            // PRIORIDAD 2: Usar valores por defecto simples (sin detección automática)
            else {
                // Usar la primera voz disponible (o mantener -1 para voz por defecto del sistema)
                initialVoiceIndex = -1; // Voz por defecto del sistema
            }
            
            // Aplicar configuración
            this.selectedVoiceIndex = initialVoiceIndex;
            this.settings.pitch = initialPitch;
            this.settings.volume = initialVolume;
            // Speed se mantiene como está configurado
            
            // VERIFICACIÓN FINAL
            if (allVoices.length > 0 && this.selectedVoiceIndex < allVoices.length) {
                const finalVoice = allVoices[this.selectedVoiceIndex];
            } 
            // else {
            //     console.warn('[AudioPlayer] Problema con selección de voz. Index:', this.selectedVoiceIndex, 'Total:', allVoices.length);
            // }
            
            // Guardar configuración inicial para futura sincronización
            this.saveVoiceSettings();
            
        } catch (e) {
            console.warn('Error cargando configuraciones de voz:', e);
            // Configuración por defecto
            this.selectedVoiceIndex = 0;
            this.settings.pitch = 1;
            this.settings.volume = 1;
        }
    }
    
    showError(message) {
        this.updateStatus(` ${message}`);
        setTimeout(() => {
            this.updateStatus('Listo para leer');
        }, 3000);
    }
    
    updateSettings(newSettings) {
        this.settings = newSettings;
        
        // Actualizar velocidad en el selector
        const speedSelect = this.playerElement.querySelector('#speedSelect');
        if (speedSelect) {
            speedSelect.value = this.settings.speed.toString();
        }
        
        // Si está reproduciendo, aplicar nueva configuración
        if (this.isPlaying && !this.isPaused) {
            speechSynthesis.cancel();
            this.readCurrentParagraph();
        }
    }
    
    // Función para saltar a un párrafo específico
    jumpToParagraph(index) {
        if (index >= 0 && index < this.paragraphs.length) {
            this.currentParagraphIndex = index;
            this.updateProgress();
            
            if (this.isPlaying) {
                speechSynthesis.cancel();
                this.readCurrentParagraph();
            }
        }
    }
    
    // Función para obtener información del reproductor
    getPlayerInfo() {
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentIndex: this.currentParagraphIndex,
            totalParagraphs: this.paragraphs.length,
            currentText: this.paragraphs[this.currentParagraphIndex]?.text || ''
        };
    }
    
    destroy() {
        console.trace('Llamada a destroy()');
        
        // Detener reproducción
        this.stop();
        
        // Remover element del DOM
        if (this.playerElement) {
            // Buscar el elemento en el DOM
            const existingPlayer = document.querySelector('.audio-player-global');
            if (existingPlayer) {
                existingPlayer.remove();
            }
            
            if (this.playerElement.parentElement) {
                this.playerElement.parentElement.removeChild(this.playerElement);
            }
        }
        
        // Limpiar event listeners globales
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
        }
        
        // Remover todos los event listeners de arrastre
        document.removeEventListener('mousemove', this.dragHandler);
        document.removeEventListener('mouseup', this.endDragHandler);
        document.removeEventListener('touchmove', this.touchMoveHandler);
        document.removeEventListener('touchend', this.touchEndHandler);
        
        // Remover highlights
        document.querySelectorAll('.audio-player-highlight').forEach(el => {
            el.classList.remove('audio-player-highlight');
        });
        
        // Limpiar referencias
        this.playerElement = null;
        this.paragraphs = [];
        
        // Limpiar monitoreo
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        if (this.observer) {
            this.observer.disconnect();
        }
    }
    
    // Método para monitoreo ligero del reproductor
    startElementMonitoring() {        
        // Solo una verificación después de 5 segundos
        setTimeout(() => {
            const player = document.querySelector('.audio-player-global');
            if (!player) {
                console.warn(' Reproductor no encontrado después de 5 segundos');
            }
        }, 5000);
    }

    // Detectar idioma de la página actual
    detectPageLanguage() {        
        // MÉTODO 0: Detectar si la página fue traducida por Google Translate
        const isGoogleTranslated = this.detectGoogleTranslate();
        if (isGoogleTranslated) {            
            // Para páginas traducidas, priorizar análisis de contenido
            const pageText = this.extractPageTextSample();
            if (pageText && pageText.length > 50) {
                const detectedFromContent = this.detectTextLanguage(pageText);
                return detectedFromContent;
            }
        }
        
        // MÉTODO 1: Atributo lang del HTML (solo si no está traducida)
        if (!isGoogleTranslated) {
            const htmlLang = document.documentElement.lang || 
                            document.querySelector('html')?.getAttribute('lang');
            if (htmlLang && htmlLang.length >= 2) {
                return this.normalizeLanguageCode(htmlLang);
            }
        }
        
        // MÉTODO 2: Meta tag content-language
        const metaLang = document.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content') ||
                        document.querySelector('meta[name="language"]')?.getAttribute('content');
        if (metaLang && metaLang.length >= 2) {
            return this.normalizeLanguageCode(metaLang);
        }
        
        // MÉTODO 3: Detectar por contenido de la página
        const pageText = this.extractPageTextSample();
        if (pageText && pageText.length > 50) {
            const detectedFromContent = this.detectTextLanguage(pageText);
            return detectedFromContent;
        }
        
        // MÉTODO 4: Idioma del navegador como último recurso
        const browserLang = navigator.language || 'en-US';
        return this.normalizeLanguageCode(browserLang);
    }
    
    // Normalizar códigos de idioma a formato estándar
    normalizeLanguageCode(langCode) {
        if (!langCode) return 'en-US';
        
        const normalized = langCode.toLowerCase().trim();
        
        // Mapeo de códigos comunes
        const langMap = {
            'es': 'es-ES',
            'spanish': 'es-ES',
            'español': 'es-ES',
            'en': 'en-US', 
            'english': 'en-US',
            'inglés': 'en-US',
            'fr': 'fr-FR',
            'french': 'fr-FR',
            'francés': 'fr-FR',
            'pt': 'pt-BR',
            'portuguese': 'pt-BR',
            'português': 'pt-BR',
            'it': 'it-IT',
            'italian': 'it-IT',
            'italiano': 'it-IT',
            'de': 'de-DE',
            'german': 'de-DE',
            'alemán': 'de-DE'
        };
        
        // Si está en el mapeo, usar el valor mapeado
        if (langMap[normalized]) {
            return langMap[normalized];
        }
        
        // Si ya está en formato xx-XX, devolverlo
        if (normalized.match(/^[a-z]{2}-[a-z]{2}$/)) {
            return normalized;
        }
        
        // Si es solo el código del idioma, expandirlo
        if (normalized.match(/^[a-z]{2}$/)) {
            return langMap[normalized] || `${normalized}-${normalized.toUpperCase()}`;
        }
        
        // Fallback
        return 'en-US';
    }

    // Detectar si la página fue traducida por Google Translate
    detectGoogleTranslate() {        
        // Indicadores de Google Translate
        const indicators = [
            // Widget de Google Translate
            '.goog-te-gadget',
            '.goog-te-combo',
            '.goog-te-banner-frame',
            '#google_translate_element',
            '.skiptranslate',
            
            // Elementos con atributos de Google Translate
            '[class*="goog-te"]',
            '[id*="google_translate"]',
            
            // Frame de Google Translate
            'iframe[src*="translate.google"]',
            'iframe[src*="translate.googleapis"]'
        ];
        
        // Verificar si existe algún indicador
        for (const selector of indicators) {
            if (document.querySelector(selector)) {
                return true;
            }
        }
        
        // Verificar si el documento tiene atributos específicos de traducción
        if (document.documentElement.classList.contains('translated-ltr') || 
            document.documentElement.classList.contains('translated-rtl')) {
            return true;
        }
        
        // Verificar si hay elementos con translate="no"
        const notranslateElements = document.querySelectorAll('[translate="no"], .notranslate');
        if (notranslateElements.length > 3) {
            return true;
        }
        
        // Verificar diferencia entre lang del HTML y contenido detectado
        const htmlLang = document.documentElement.lang;
        if (htmlLang && htmlLang.length >= 2) {
            const pageText = this.extractPageTextSample();
            if (pageText && pageText.length > 100) {
                const contentLang = this.detectTextLanguage(pageText);
                const normalizedHtmlLang = this.normalizeLanguageCode(htmlLang);
                
                // Si el idioma del HTML y del contenido son diferentes, probablemente está traducida
                if (normalizedHtmlLang !== contentLang) {
                    return true;
                }
            }
        }
        return false;
    }
    
    // Extraer muestra de texto de la página para detección
    extractPageTextSample() {
        // Buscar en elementos principales de contenido
        const contentSelectors = [
            'main',
            'article', 
            '.content',
            '.post-content',
            '.entry-content',
            'body'
        ];
        
        for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                const text = element.textContent.trim();
                if (text.length > 100) {
                    // Tomar una muestra de 500 caracteres
                    return text.substring(0, 500);
                }
            }
        }
        
        // Si no se encuentra contenido específico, usar todo el body
        return document.body.textContent.trim().substring(0, 500);
    }

    // Detectar idioma del texto automáticamente
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

    // Seleccionar voz apropiada para el idioma detectado
    selectAppropriateVoice(targetLang, utterance) {
        const availableVoices = speechSynthesis.getVoices();        
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
        
        // Si no hay detección automática disponible, usar configuración manual del usuario
        if (!selectedVoice && this.selectedVoiceIndex >= 0 && availableVoices[this.selectedVoiceIndex]) {
            selectedVoice = availableVoices[this.selectedVoiceIndex];
        }
        
        if (selectedVoice) {
            utterance.voice = selectedVoice;
            utterance.lang = targetLang;
        } else {
            // Intentar asignar al menos la primera voz disponible
            if (availableVoices.length > 0) {
                utterance.voice = availableVoices[0];
                utterance.lang = targetLang;
            }
        }
        
        return selectedVoice;
    }
    
    // SISTEMA CENTRALIZADO DE CONFIGURACIÓN DE VOZ
    
    // Obtener configuración de voz global para usar en otras funciones
    static getGlobalVoiceConfig() {        
        const savedSettings = localStorage.getItem('speedReaderVoiceSettings');        
        if (savedSettings) {
            const config = JSON.parse(savedSettings);            
            const voices = speechSynthesis.getVoices();            
            // ACEPTAR CUALQUIER ÍNDICE VÁLIDO (incluyendo -1 para voz por defecto)
            if (config.selectedVoiceIndex !== undefined && config.selectedVoiceIndex !== null) {                
                // Si es -1, usar voz por defecto del sistema
                if (config.selectedVoiceIndex === -1) {
                    return {
                        voiceIndex: -1,
                        voice: null, // Voz por defecto del sistema
                        lang: 'en-US', // Idioma por defecto básico
                        pitch: config.pitch || 1,
                        volume: config.volume || 1,
                        rate: 1
                    };
                }
                // Si es un índice específico válido
                else if (config.selectedVoiceIndex >= 0 && config.selectedVoiceIndex < voices.length) {
                    const selectedVoice = voices[config.selectedVoiceIndex];                    
                    const result = {
                        voiceIndex: config.selectedVoiceIndex,
                        voice: selectedVoice,
                        lang: selectedVoice.lang, // USAR IDIOMA DE LA VOZ SELECCIONADA
                        pitch: config.pitch || 1,
                        volume: config.volume || 1,
                        rate: 1
                    };
                    return result;
                } else {
                    console.warn('[AudioPlayer] DEBUG: Índice fuera de rango:', config.selectedVoiceIndex, 'Total:', voices.length);
                }
            }
        }
        
        // Fallback final si no hay configuración válida
        const voices = speechSynthesis.getVoices();
        const fallback = {
            voiceIndex: 0,
            voice: voices[0] || null,
            lang: voices[0] ? voices[0].lang : 'en-US', // USAR IDIOMA DE LA PRIMERA VOZ
            pitch: 1,
            volume: 1,
            rate: 1
        };
        return fallback;
    }
    
    // Aplicar configuración global a un utterance
    static applyGlobalVoiceConfig(utterance, customRate = null) {        
        const config = AudioPlayer.getGlobalVoiceConfig();        
        if (config.voice) {            
            utterance.voice = config.voice;
            utterance.lang = config.lang; // Usar idioma de la voz configurada
            utterance.pitch = config.pitch;
            utterance.volume = config.volume;
            utterance.rate = customRate || config.rate;
            
            // PROTECCIÓN: Marcar que esta voz fue aplicada manualmente
            utterance._voiceManuallySelected = true;
            utterance._originalVoiceLang = config.lang;            
            return true;
        } else if (config.voiceIndex === -1) {            
            // Para voz por defecto del sistema, solo aplicar configuraciones básicas
            utterance.voice = null; // Usar voz por defecto del sistema
            utterance.lang = config.lang; // Usar idioma configurado
            utterance.pitch = config.pitch;
            utterance.volume = config.volume;
            utterance.rate = customRate || config.rate;
            
            // PROTECCIÓN: Marcar que esta configuración fue aplicada manualmente
            utterance._voiceManuallySelected = true;
            utterance._originalVoiceLang = config.lang;
            
            return true;
        }
        
        console.warn('[AudioPlayer] No se pudo aplicar configuración global de voz');
        return false;
    }
    
    // Método para sincronizar configuración con instancia actual
    syncWithGlobalConfig() {
        const globalConfig = AudioPlayer.getGlobalVoiceConfig();
        
        this.selectedVoiceIndex = globalConfig.voiceIndex;
        this.settings.pitch = globalConfig.pitch;
        this.settings.volume = globalConfig.volume;
        
    }
    
    // Función para obtener texto de prueba específico por idioma
    getTestTextForLanguage(lang) {
        // Mapear códigos de idioma a claves de traducción
        const langMap = {
            'en': 'voiceTestTextEn',
            'en-US': 'voiceTestTextEn',
            'en-GB': 'voiceTestTextEn',
            'en-AU': 'voiceTestTextEn',
            'en-CA': 'voiceTestTextEn',
            'es': 'voiceTestTextEs',
            'es-ES': 'voiceTestTextEs',
            'es-MX': 'voiceTestTextEs',
            'es-AR': 'voiceTestTextEs',
            'fr': 'voiceTestTextFr',
            'fr-FR': 'voiceTestTextFr',
            'fr-CA': 'voiceTestTextFr',
            'de': 'voiceTestTextDe',
            'de-DE': 'voiceTestTextDe',
            'it': 'voiceTestTextIt',
            'it-IT': 'voiceTestTextIt',
            'pt': 'voiceTestTextPt',
            'pt-PT': 'voiceTestTextPt',
            'pt-BR': 'voiceTestTextPt',
            'ru': 'voiceTestTextRu',
            'ru-RU': 'voiceTestTextRu',
            'ja': 'voiceTestTextJa',
            'ja-JP': 'voiceTestTextJa',
            'ko': 'voiceTestTextKo',
            'ko-KR': 'voiceTestTextKo',
            'zh': 'voiceTestTextZh',
            'zh-CN': 'voiceTestTextZh',
            'zh-TW': 'voiceTestTextZh'
        };
        
        // Buscar clave exacta o por prefijo
        const testKey = langMap[lang] || langMap[lang.split('-')[0]];
        
        if (testKey) {
            try {
                return t(testKey);
            } catch (error) {
                console.error('[AudioPlayer] Clave de traducción no encontrada:', testKey, '- usando fallback');
            }
        }
        
        console.error('[AudioPlayer] Idioma no soportado:', lang, '- usando texto por defecto');
        return t('voiceTestText'); // Fallback al texto base
    }
}

// Exportar clase
window.AudioPlayer = AudioPlayer;

(function() {
    'use strict';

    // Constantes
    const STORAGE_KEYS = {
        PROBOOM: 'history-proboom',
        LASTPREDICTOR: 'lastpredictor-history',
        GRAINDEGAIN: 'graindegain-history',
        MAISONVERT: 'maisonvert-history',
        MV_COUNTDOWN: 'mv-countdown'
    };

    // État global
    let currentPage = 'menu';
    let predictions = {
        proboom: [],
        lastpredictor: [],
        graindegain: [],
        maisonvert: []
    };
    let mvCountdown = [];
    let lastUpdate = Date.now();

    // Éléments DOM
    const root = document.getElementById('root');

    // Charger les données du localStorage
    function loadFromStorage() {
        try {
            predictions.proboom = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROBOOM) || '[]');
            predictions.lastpredictor = JSON.parse(localStorage.getItem(STORAGE_KEYS.LASTPREDICTOR) || '[]');
            predictions.graindegain = JSON.parse(localStorage.getItem(STORAGE_KEYS.GRAINDEGAIN) || '[]');
            predictions.maisonvert = JSON.parse(localStorage.getItem(STORAGE_KEYS.MAISONVERT) || '[]');
            mvCountdown = JSON.parse(localStorage.getItem(STORAGE_KEYS.MV_COUNTDOWN) || '[]');
        } catch (e) {
            console.error('Erreur de chargement:', e);
        }
    }

    // Sauvegarder les données
    function saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('Erreur de sauvegarde:', e);
        }
    }

    // Mettre à jour l'état et re-rendre
    function setState(newState) {
        Object.assign(predictions, newState);
        render();
    }

    // Fonctions utilitaires
    function formatTwoDigits(num) {
        return num.toString().padStart(2, '0');
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(e => console.error('Erreur copie:', e));
    }

    function getCharValue(char) {
        const c = char.toLowerCase();
        if (c >= '0' && c <= '9') return parseInt(c, 10);
        return c.charCodeAt(0) - 96; // a=1, b=2, etc.
    }

    // WIN PREDICTOR (ProBoom)
    function calculateProBoom(heure, hex, dec, isProBoom = true) {
        if (!heure.includes(':') || heure.length !== 5 || hex.length !== 2 || dec.length !== 2) return null;
        
        const [h, m] = heure.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return null;
        
        const a = parseInt(hex[0], 16) || 0;
        const b = parseInt(hex[1], 16) || 0;
        const c = parseInt(dec[0], 10);
        const d = parseInt(dec[1], 10);
        
        if (isNaN(a) || isNaN(b) || isNaN(c) || isNaN(d)) return null;
        
        const diff = Math.abs(a - b);
        let minutes = m + (diff > 5 ? diff - 4 : diff);
        
        const totalLetters = a + b;
        let seconds = d + totalLetters;
        seconds -= 20;
        
        if (seconds < 0) {
            seconds += 60;
            minutes -= 1;
        }
        
        seconds += 67;
        
        if (seconds > 59) {
            minutes += Math.floor(seconds / 60);
            seconds = seconds % 60;
        }
        
        if (minutes < 0) {
            // Impossible ici, mais on garde la logique
        }
        
        if (minutes > 59) {
            // minutes %= 60; - on garde pour le calcul final
        }
        
        const baseValue = a * 7 + b * 13 + c * 17 + d * 23 + h * 3 + minutes * 11 + seconds * 5;
        let multiplier;
        
        if (isProBoom) {
            const m1 = 10 + (baseValue % 40);
            const m2 = (baseValue * 7) % 100;
            multiplier = `x${m1}.${m2.toString().padStart(2, '0')}`;
        } else {
            const m1 = 5 + (baseValue % 10);
            const m2 = (baseValue * 13) % 100;
            multiplier = `x${m1}.${m2.toString().padStart(2, '0')}`;
        }
        
        return {
            time: `${formatTwoDigits(h)}:${formatTwoDigits(minutes)}:${formatTwoDigits(seconds)}`,
            multiplier
        };
    }

    // LAST PREDICTOR
    function determineAviatorType(seed) {
        const pattern = seed.split('').map(c => /\d/.test(c) ? 'D' : 'L').join('');
        const tsaraPatterns = ['DDDDLL', 'LDDLLD', 'DDLLDD', 'DDDLLD'];
        const ratsyPatterns = ['LLDDDD', 'DDLLLL', 'LLLLLD', 'LDDDDL', 'LLDDLD'];
        const hotsaraPatterns = ['LDDDDD', 'DLLLLL', 'DDDDDL', 'DDDLDL'];
        
        if (tsaraPatterns.includes(pattern)) return 'tsara';
        if (ratsyPatterns.includes(pattern)) return 'ratsy';
        if (hotsaraPatterns.includes(pattern)) return 'hotsara';
        return '';
    }

    function calculateLastPredictor(heure, seed, game = 'aviator') {
        if (!heure.match(/^\d{2}:\d{2}:\d{2}$/) || seed.length !== 6) return null;
        
        const [h, m, s] = heure.split(':').map(Number);
        if (isNaN(h) || isNaN(m) || isNaN(s)) return null;
        
        const seedValues = seed.split('').map(c => {
            if (/\d/.test(c)) return { type: 'digit', value: parseInt(c, 10) };
            const val = { A:10, B:11, C:12, D:13, E:14, F:15 }[c.toUpperCase()];
            return val !== undefined ? { type: 'letter', value: val } : null;
        });
        
        if (seedValues.some(v => v === null)) return null;
        
        const digits = seedValues.filter(v => v.type === 'digit').reduce((sum, v) => sum + v.value, 0);
        const digitsStr = digits.toString().padStart(2, '0');
        const firstDigit = parseInt(digitsStr[digitsStr.length - 2] || '0', 10);
        const secondDigit = parseInt(digitsStr[digitsStr.length - 1] || '0', 10);
        
        let diff = Math.abs(firstDigit - secondDigit);
        if (diff > 5) diff -= 4;
        
        let minutes = m + diff;
        const letters = seedValues.filter(v => v.type === 'letter').reduce((sum, v) => sum + v.value, 0);
        
        let seconds = s + letters;
        seconds -= 20;
        
        if (seconds < 0) {
            seconds += 60;
            minutes -= 1;
        }
        
        seconds += 67;
        
        if (seconds > 59) {
            minutes += Math.floor(seconds / 60);
            seconds = seconds % 60;
        }
        
        if (seconds > 59) {
            minutes += Math.floor(seconds / 60);
            seconds = seconds % 60;
        }
        
        if (minutes < 0) {
            // minutes += 60;
        }
        
        if (minutes > 59) {
            // minutes %= 60;
        }
        
        const offset = game === 'aviator' ? { minute: 1, second: 10 } :
                      game === 'jetx' ? { minute: 2, second: 0 } :
                      { minute: 1, second: 27 };
        
        seconds += offset.second;
        if (seconds > 59) {
            minutes += Math.floor(seconds / 60);
            seconds = seconds % 60;
        }
        
        minutes += offset.minute;
        if (minutes < 0) {
            // minutes += 60;
        }
        if (minutes > 59) {
            // minutes %= 60;
        }
        
        const baseValue = digits * 7 + letters * 13 + h * 3 + minutes * 11 + seconds * 5;
        const baseMult = 1 + (baseValue % 10);
        const baseDec = (baseValue * 17 + seconds * 3) % 100;
        const base = `x${baseMult}.${baseDec.toString().padStart(2, '0')}`;
        
        let riskMult, riskDec;
        if (game === 'aviator') {
            const type = determineAviatorType(seed);
            const bonus = type === 'hotsara' ? 30 : type === 'tsara' ? 15 : type === 'ratsy' ? 5 : 10;
            const riskBase = 5 + (baseValue + bonus * 7 + seconds * 11) % 96;
            riskDec = (baseValue * 31 + bonus * 13 + minutes * 7) % 100;
            riskMult = `x${riskBase}.${riskDec.toString().padStart(2, '0')}`;
        } else {
            const riskBase = 5 + (baseValue + 20) % 96;
            riskDec = (baseValue * 31 + 13) % 100;
            riskMult = `x${riskBase}.${riskDec.toString().padStart(2, '0')}`;
        }
        
        return {
            time: `${formatTwoDigits(h)}:${formatTwoDigits(minutes)}:${formatTwoDigits(seconds)}`,
            base,
            risk: riskMult,
            type: game === 'aviator' ? determineAviatorType(seed) : ''
        };
    }

    // GRAIN DE GAIN
    function calculateGrainDeGain(heure, seed, grain1, grain2, grain3) {
        if (!heure.includes(':') || heure.length !== 5 || seed.length !== 2 || 
            grain1.length !== 1 || grain2.length !== 1 || grain3.length !== 1) return null;
        
        const [h, m] = heure.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return null;
        
        const a = getCharValue(seed[0]);
        const b = getCharValue(seed[1]);
        const c = getCharValue(grain1);
        const d = getCharValue(grain2);
        const e = getCharValue(grain3);
        
        const base = 145 + (a * 31 + b * 37 + c * 41 + d * 43 + e * 47 + h * 53 + m * 59) % 194;
        let totalSeconds = m * 60 + base;
        totalSeconds -= 20;
        totalSeconds += 67;
        
        let newMinutes = Math.floor(totalSeconds / 60);
        let seconds = totalSeconds % 60;
        
        if (seconds < 0) {
            seconds += 60;
            newMinutes -= 1;
        }
        
        let hours = h + Math.floor(newMinutes / 60);
        newMinutes = newMinutes % 60;
        
        if (newMinutes < 0) {
            hours -= 1;
            newMinutes += 60;
        }
        
        hours = (hours % 24 + 24) % 24;
        
        const multValue = a * 7 + b * 11 + c * 13 + d * 17 + e * 19 + hours * 23 + newMinutes * 29 + seconds * 31;
        const multMain = 3 + (multValue % 12);
        const multDec = (multValue * 17) % 100;
        const multiplier = `x${multMain}.${multDec.toString().padStart(2, '0')}`;
        
        return {
            time: `${formatTwoDigits(hours)}:${formatTwoDigits(newMinutes)}:${formatTwoDigits(seconds)}`,
            multiplier
        };
    }

    // MAISON VERT
    function getVertPercentage(count) {
        const percentages = { 0:89, 1:85, 2:80, 3:40, 4:35, 5:28, 6:22, 7:15, 8:10, 9:6, 10:3 };
        return percentages[count] || 0;
    }

    function calculateVertMultiplier(a, b, c, d) {
        const mult = 50 + (a * 7 + b * 3 + c * 5 + d * 13) % 51;
        const dec = (a + b + c * 2 + d * 7) % 100;
        return `x${mult}.${dec.toString().padStart(2, '0')}`;
    }

    function calculateMaisonVert(heure, vertCount, decimals) {
        if (!heure.match(/^\d{2}:\d{2}:\d{2}$/) || vertCount === '' || decimals.length !== 2) return null;
        
        const [h, m, s] = heure.split(':').map(Number);
        if (isNaN(h) || isNaN(m) || isNaN(s)) return null;
        
        const count = parseInt(vertCount, 10);
        if (isNaN(count) || count < 0 || count > 10) return null;
        
        const a = parseInt(decimals[0], 10);
        const b = parseInt(decimals[1], 10);
        if (isNaN(a) || isNaN(b)) return null;
        
        const percentage = getVertPercentage(count);
        const MIN = 265, MAX = 454;
        const RANGE = MAX - MIN;
        
        function calculatePrediction(offset) {
            const val = a * b;
            const sum = a + b;
            const base = (val * 13 + sum * 7 + a * 31 + b * 17 + offset * 53) % (RANGE + 1);
            const bonus = ((10 - count) * 11 + offset * 19) % 40;
            
            let timeVal = MIN + (base + bonus) % (RANGE + 1);
            if (timeVal > MAX) timeVal = MAX;
            
            const timeSec = (s * 7 + a * 3 + b * 11 + count * 5 + offset * 37) % 60;
            const totalTime = Math.floor(timeVal / 60) * 60 + timeSec;
            
            let finalTime = totalTime;
            if (finalTime < MIN) finalTime += 60;
            if (finalTime > MAX) finalTime -= 60;
            if (finalTime < MIN) finalTime = MIN;
            if (finalTime > MAX) finalTime = MAX;
            
            let newHours = h;
            let newMinutes = m;
            let newSeconds = s + finalTime;
            
            if (newSeconds > 59) {
                newMinutes += Math.floor(newSeconds / 60);
                newSeconds = newSeconds % 60;
            }
            
            if (newMinutes > 59) {
                newHours += Math.floor(newMinutes / 60);
                newMinutes = newMinutes % 60;
            }
            
            newHours = (newHours % 24 + 24) % 24;
            
            return {
                time: `${formatTwoDigits(newHours)}:${formatTwoDigits(newMinutes)}:${formatTwoDigits(newSeconds)}`,
                percentage: `${percentage}%`,
                multiplier: calculateVertMultiplier(a, b, count, offset)
            };
        }
        
        return [calculatePrediction(0), calculatePrediction(1)];
    }

    // Mise à jour du compteur
    function updateCountdown() {
        const now = Date.now();
        if (mvCountdown.length === 0) return;
        
        const validPredictions = mvCountdown.filter(p => new Date(p.targetTime).getTime() > now - 1000);
        if (validPredictions.length !== mvCountdown.length) {
            mvCountdown = validPredictions;
            saveToStorage(STORAGE_KEYS.MV_COUNTDOWN, mvCountdown);
            render();
        }
        lastUpdate = now;
    }

    // Navigation
    function navigate(page) {
        currentPage = page;
        render();
    }

    // Rendu des composants
    function renderMenu() {
        return `
            <div class="menu-container">
                <div class="menu-content">
                    <div class="menu-header">
                        <h1 class="menu-title">BOSS BET</h1>
                        <p class="menu-subtitle">vers l'infini 🎰✈️</p>
                    </div>
                    
                    <div class="menu-card">
                        <p>⚠️ L'aviator est un jeu des émotions, plus tu te concentres du gros multiplicateur, plus tu te l'éloigne.😓</p>
                        <p class="italic">"Aleo mihinana Kely tsy mba resaka fa tsy izay tonga aloha no arabaina fa izay tonga soa"😅🚨</p>
                        <p class="menu-highlight">🎯 B O N N E   C H A N C E 🎈</p>
                    </div>
                    
                    <div class="btn-group">
                        <div class="btn-item">
                            <button onclick="window.app.navigate('/lastpredictor')" class="btn-gold">💜 LAST PREDICTOR 🖤</button>
                            <p class="text-xs text-muted px-2">Prédiction avancée par graine serveur</p>
                        </div>
                        
                        <div class="btn-item">
                            <button onclick="window.app.navigate('/proboom')" class="btn-gold">🖤 WIN PREDICTOR 🧡</button>
                            <p class="text-xs text-muted px-2">Viser x5 quand les violet sont plus nombreux que le bleu (série de 25 tours)</p>
                        </div>
                        
                        <div class="btn-item">
                            <button onclick="window.app.navigate('/graindegain')" class="btn-gold">🛑✅ Grain de Gain — Risque varié 🪄</button>
                            <p class="text-xs text-muted px-2">Combinaison des 3 sections, peut aussi viser le vert 🟩 +50x si t'as le solde pour tenter</p>
                        </div>
                        
                        <div class="btn-item">
                            <button onclick="window.app.navigate('/maisonvert')" class="btn-gold">💚 MAISON VERT AVIATOR 💚</button>
                            <p class="text-xs text-muted px-2">Prédiction du prochain vert +50x Aviator</p>
                        </div>
                        
                        <button onclick="window.app.navigate('/historique')" class="btn-outline">📋 Historique des prédictions</button>
                        <button onclick="window.app.navigate('/guide')" class="btn-outline">📖 Mode d'emploi</button>
                        <button onclick="window.app.navigate('/install')" class="btn-outline">📱 Installer l'application</button>
                    </div>
                </div>
            </div>
        `;
    }

    function renderProBoom() {
        return `
            <div class="page-container">
                <div class="page-content">
                    <div class="page-header">
                        <h1 class="page-title">🖤 WIN PREDICTOR 🧡</h1>
                        <p class="page-subtitle">semi safe x5+</p>
                    </div>
                    
                    <div id="probForm" class="prediction-form">
                        <div class="form-group">
                            <label class="form-label">Heure du tour</label>
                            <input type="text" id="probHeure" class="form-input" placeholder="12:25" inputmode="numeric" maxlength="5">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Hex (2 chiffres)</label>
                            <input type="text" id="probHex" class="form-input" placeholder="24" inputmode="numeric" maxlength="2">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Déc (2 chiffres)</label>
                            <input type="text" id="probDec" class="form-input" placeholder="36" inputmode="numeric" maxlength="2">
                        </div>
                        
                        <div class="form-row">
                            <button id="probPredictBtn" class="btn-gold flex-1">🎯 Prédire</button>
                            <button id="probResetBtn" class="btn-outline">🔄</button>
                        </div>
                    </div>
                    
                    <div id="probResult"></div>
                    
                    <button onclick="window.app.navigate('/')" class="btn-link">← Retour au menu</button>
                </div>
            </div>
        `;
    }

    function renderLastPredictor() {
        return `
            <div class="page-container">
                <div class="page-content">
                    <div class="page-header">
                        <h1 class="page-title">💜 LAST PREDICTOR 🖤</h1>
                        <p class="page-subtitle">Choisissez votre jeu de prédiction</p>
                    </div>
                    
                    <div class="btn-group pt-4">
                        <button onclick="window.app.navigate('/lastpredictor/aviator')" class="btn-gold">🚀 AVIATOR</button>
                        <button onclick="window.app.navigate('/lastpredictor/jetx')" class="btn-gold">🚀 JETX</button>
                        <button onclick="window.app.navigate('/lastpredictor/cosmosx')" class="btn-gold">🚀 COSMOSX</button>
                    </div>
                    
                    <button onclick="window.app.navigate('/')" class="btn-link">← Retour au menu</button>
                </div>
            </div>
        `;
    }

    function renderLastPredictorGame(game) {
        const titles = {
            aviator: { title: '🚀 AVIATOR', label: 'PRÉDICTION AVIATOR', emoji: '🟩' },
            jetx: { title: '🚀 JETX', label: 'PRÉDICTION JETX', emoji: '🟩' },
            cosmosx: { title: '🚀 COSMOSX', label: 'PRÉDICTION COSMOSX', emoji: '🟩' }
        };
        const t = titles[game];
        
        return `
            <div class="page-container">
                <div class="page-content">
                    <div class="page-header">
                        <h1 class="page-title">${t.title}</h1>
                        <p class="page-subtitle">Prédiction avancée par graine serveur</p>
                    </div>
                    
                    <div id="lastForm" class="prediction-form">
                        <div class="form-group">
                            <label class="form-label">Heure de départ</label>
                            <input type="text" id="lastHeure" class="form-input" placeholder="12:00:00" inputmode="numeric" maxlength="8">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Graine de serveur (6 caractères)</label>
                            <input type="text" id="lastSeed" class="form-input" placeholder="16ABF8" maxlength="6" style="text-transform: uppercase">
                        </div>
                        
                        <div class="form-row">
                            <button id="lastPredictBtn" class="btn-gold flex-1">🚀 PREDICTOR 🖤</button>
                            <button id="lastResetBtn" class="btn-outline">🔄</button>
                        </div>
                    </div>
                    
                    <div id="lastResult"></div>
                    
                    <button onclick="window.app.navigate('/lastpredictor')" class="btn-link">← Retour à Last Predictor</button>
                </div>
            </div>
        `;
    }

    function renderGrainDeGain() {
        return `
            <div class="page-container">
                <div class="page-content">
                    <div class="page-header">
                        <h1 class="page-title">GRAIN DE GAIN 🛑✅</h1>
                        <p class="page-subtitle">Contrôle mise</p>
                    </div>
                    
                    <div id="grainForm" class="prediction-form">
                        <div class="form-group">
                            <label class="form-label">Heure du tour</label>
                            <input type="text" id="grainHeure" class="form-input" placeholder="12:25" inputmode="numeric" maxlength="5">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Graine de serveur (2 caractères)</label>
                            <input type="text" id="grainSeed" class="form-input" placeholder="a4" maxlength="2">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">3 premières graines des joueurs</label>
                            <div class="form-row">
                                <input type="text" id="grain1" class="form-input" placeholder="a" maxlength="1">
                                <input type="text" id="grain2" class="form-input" placeholder="2" maxlength="1">
                                <input type="text" id="grain3" class="form-input" placeholder="3" maxlength="1">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <button id="grainPredictBtn" class="btn-gold flex-1">CALCUL GRAIN DE GAIN 🛑🚀</button>
                            <button id="grainResetBtn" class="btn-outline">🔄</button>
                        </div>
                    </div>
                    
                    <div id="grainResult"></div>
                    
                    <button onclick="window.app.navigate('/')" class="btn-link">← Retour au menu</button>
                </div>
            </div>
        `;
    }

    function renderMaisonVert() {
        return `
            <div class="page-container">
                <div class="page-content">
                    <div class="page-header">
                        <h1 class="page-title" style="color: #4ade80;">💚 MAISON VERT AVIATOR 💚</h1>
                        <p class="page-subtitle">Prédiction du prochain vert +50x</p>
                    </div>
                    
                    <div id="vertForm" class="prediction-form" style="border-color: rgba(34, 197, 94, 0.5); box-shadow: 0 0 15px rgba(34, 197, 94, 0.15);">
                        <div class="form-group">
                            <label class="form-label" style="color: #4ade80;">Heure du dernier rose</label>
                            <input type="text" id="vertHeure" class="form-input form-input-green" placeholder="12:00:00" inputmode="numeric" maxlength="8">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label" style="color: #4ade80;">Nombre de vert sur 25 tours</label>
                            <input type="text" id="vertCount" class="form-input form-input-green" placeholder="0 à 10" inputmode="numeric" maxlength="2">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label" style="color: #4ade80;">Premier et dernier nombre décimal</label>
                            <input type="text" id="vertDec" class="form-input form-input-green" placeholder="Ex: 37" inputmode="numeric" maxlength="2">
                        </div>
                        
                        <div class="form-row">
                            <button id="vertPredictBtn" class="btn-green flex-1">✅🟩 Prédiction vert 🟩✅</button>
                            <button id="vertResetBtn" class="btn-green-outline">🔄</button>
                        </div>
                    </div>
                    
                    <div id="vertResult"></div>
                    
                    <button onclick="window.app.navigate('/')" class="btn-link" style="color: #4ade80;">← Retour au menu</button>
                </div>
            </div>
        `;
    }

    function renderGuide() {
        return `
            <div class="page-container">
                <div class="page-content">
                    <h1 class="page-title">📖 Mode d'emploi</h1>
                    
                    <div class="prediction-form">
                        <section class="form-group">
                            <h2 class="form-label" style="font-size: 1.125rem;">💜 LAST PREDICTOR 🖤</h2>
                            <p class="text-sm text-muted">Prédiction avancée basée sur la <span class="font-semibold text-foreground">graine du serveur</span>.</p>
                            <ul class="list-disc pl-5 text-sm text-muted space-y-1" style="margin-top: 0.5rem;">
                                <li><span class="font-semibold text-foreground">Heure de départ</span> : l'heure exacte au format <span class="font-mono text-foreground">HH:MM:SS</span>. Les « : » s'ajoutent automatiquement.</li>
                                <li><span class="font-semibold text-foreground">Graine de serveur</span> : les <span class="text-primary">6 caractères</span> (chiffres et/ou lettres A-F) affichés par le serveur.</li>
                            </ul>
                            <p class="text-sm text-muted mt-2">Appuyez sur <span class="font-semibold text-foreground">🚀 PREDICTOR 🖤</span> pour obtenir la prédiction au format <span class="font-mono text-foreground">HH:MM:SS</span> avec 3 niveaux de multiplicateur :</p>
                            <ul class="list-disc pl-5 text-sm text-muted space-y-1">
                                <li><span class="font-semibold text-foreground">💜 BASE</span> : multiplicateur de x1 à x10.</li>
                                <li><span class="font-semibold text-foreground">💚 RISQUES</span> : multiplicateur de x5 à x100.</li>
                            </ul>
                        </section>
                        
                        <hr style="border-color: hsla(var(--gold), 0.3); margin: 1rem 0;">
                        
                        <section class="form-group">
                            <h2 class="form-label" style="font-size: 1.125rem;">🖤 WIN PREDICTOR 🧡</h2>
                            <p class="text-sm text-muted">Prédiction semi-sécurisée visant un multiplicateur élevé.</p>
                            <ul class="list-disc pl-5 text-sm text-muted space-y-1" style="margin-top: 0.5rem;">
                                <li><span class="font-semibold text-foreground">Heure du tour</span> : l'heure exacte au format <span class="font-mono text-foreground">HH:MM</span>. Les « : » s'ajoutent automatiquement.</li>
                                <li><span class="font-semibold text-foreground">Hex</span> : les <span class="text-primary">2 chiffres hexadécimaux</span> affichés dans le jeu.</li>
                                <li><span class="font-semibold text-foreground">Déc</span> : les <span class="text-primary">2 chiffres décimaux</span> affichés dans le jeu.</li>
                            </ul>
                            <p class="text-sm text-muted mt-2">Appuyez sur <span class="font-semibold text-foreground">🎯 Prédire</span> pour obtenir le résultat au format <span class="font-mono text-foreground">HH:MM:SS</span> et le multiplicateur associé.</p>
                            <p class="text-sm text-muted">📊 Pour le référentiel, basez-vous sur un tour dont le multiplicateur est <span class="text-primary">supérieur à x5</span> (ex : 5.00, 5.14, 10, 6.34).</p>
                        </section>
                        
                        <hr style="border-color: hsla(var(--gold), 0.3); margin: 1rem 0;">
                        
                        <section class="form-group">
                            <h2 class="form-label" style="font-size: 1.125rem;">🛑✅ Grain de Gain</h2>
                            <p class="text-sm text-muted">Outil de <span class="font-semibold text-foreground">contrôle de mise</span> à risque varié.</p>
                            <ul class="list-disc pl-5 text-sm text-muted space-y-1" style="margin-top: 0.5rem;">
                                <li><span class="font-semibold text-foreground">Heure du tour</span> : l'heure exacte au format <span class="font-mono text-foreground">HH:MM</span>.</li>
                                <li><span class="font-semibold text-foreground">Graine de serveur</span> : les <span class="text-primary">2 caractères</span> (chiffre ou lettre) affichés par le serveur.</li>
                                <li><span class="font-semibold text-foreground">3 graines des joueurs</span> : les <span class="text-primary">3 premiers caractères</span> (1 par champ) des graines joueurs.</li>
                            </ul>
                            <p class="text-sm text-muted mt-2">Appuyez sur <span class="font-semibold text-foreground">CALCUL GRAIN DE GAIN 🛑🚀</span> pour obtenir la prédiction et le multiplicateur cible.</p>
                        </section>
                        
                        <hr style="border-color: hsla(var(--gold), 0.3); margin: 1rem 0;">
                        
                        <section class="form-group">
                            <h2 class="form-label" style="font-size: 1.125rem; color: #4ade80;">💚 MAISON VERT AVIATOR 💚</h2>
                            <p class="text-sm text-muted">Prédiction du prochain <span class="font-semibold" style="color: #4ade80;">vert (+50x)</span> sur Aviator.</p>
                            <ul class="list-disc pl-5 text-sm text-muted space-y-1" style="margin-top: 0.5rem;">
                                <li><span class="font-semibold text-foreground">Heure du dernier rose</span> : l'heure exacte au format <span class="font-mono text-foreground">HH:MM:SS</span>.</li>
                                <li><span class="font-semibold text-foreground">Nombre de vert sur 25 tours</span> : un chiffre entre <span style="color: #4ade80;">0 et 10</span>.</li>
                                <li><span class="font-semibold text-foreground">Premier et dernier nombre décimal</span> : les <span style="color: #4ade80;">2 chiffres</span> décimaux affichés.</li>
                            </ul>
                            <p class="text-sm text-muted mt-2">Appuyez sur <span class="font-semibold" style="color: #4ade80;">✅🟩 Prédiction vert 🟩✅</span> pour obtenir <span class="font-semibold text-foreground">2 prédictions</span> avec :</p>
                            <ul class="list-disc pl-5 text-sm text-muted space-y-1">
                                <li><span class="font-semibold text-foreground">💚 Apparition vert</span> : pourcentage de probabilité.</li>
                                <li><span class="font-semibold text-foreground">🎯 Multiplicateur cible</span> : entre x50 et x100.</li>
                            </ul>
                        </section>
                    </div>
                    
                    <button onclick="window.app.navigate('/')" class="btn-link">← Retour au menu</button>
                </div>
            </div>
        `;
    }

    function renderHistorique() {
        const copyIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="14" height="14" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
        const checkIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
        const trashIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>';
        
        const lastPredictorItems = predictions.lastpredictor.map(p => `
            <div class="history-item" data-id="${p.id}">
                <div class="history-info">
                    <p class="history-time">${p.time}</p>
                    <p class="history-details">
                        <span class="text-primary">🤍${p.base}</span>
                        <span class="text-foreground">🖤${p.securite || '??'}</span>
                        <span class="text-destructive">💜${p.risque}</span>
                    </p>
                </div>
                <div class="history-actions">
                    <button class="history-copy-btn" onclick="window.app.copyPrediction('lp-${p.id}', '${p.time} | ${p.base} | ${p.securite || ''} | ${p.risque}')">
                        ${copyIcon}
                    </button>
                    <button class="history-delete-btn" onclick="window.app.deletePrediction('lastpredictor', ${p.id})">
                        ${trashIcon}
                    </button>
                </div>
            </div>
        `).join('');

        const proboomItems = predictions.proboom.map(p => `
            <div class="history-item" data-id="${p.id}">
                <div class="history-info">
                    <p class="history-time">${p.time}</p>
                    <p class="history-details">
                        <span class="text-primary">${p.multiplier}</span>
                    </p>
                </div>
                <div class="history-actions">
                    <button class="history-copy-btn" onclick="window.app.copyPrediction('wp-${p.id}', '${p.time} | ${p.multiplier}')">
                        ${copyIcon}
                    </button>
                    <button class="history-delete-btn" onclick="window.app.deletePrediction('proboom', ${p.id})">
                        ${trashIcon}
                    </button>
                </div>
            </div>
        `).join('');

        const graindegainItems = predictions.graindegain.map(p => `
            <div class="history-item" data-id="${p.id}">
                <div class="history-info">
                    <p class="history-time">${p.time}</p>
                    <p class="history-details">
                        <span class="text-primary">${p.multiplier}</span>
                    </p>
                </div>
                <div class="history-actions">
                    <button class="history-copy-btn" onclick="window.app.copyPrediction('grain-${p.id}', '${p.time} | ${p.multiplier}')">
                        ${copyIcon}
                    </button>
                    <button class="history-delete-btn" onclick="window.app.deletePrediction('graindegain', ${p.id})">
                        ${trashIcon}
                    </button>
                </div>
            </div>
        `).join('');

        const maisonvertItems = predictions.maisonvert.map(p => `
            <div class="history-item history-item-green" data-id="${p.id}">
                <div class="history-info">
                    <p class="history-time">${p.time}</p>
                    <p class="history-details">
                        <span class="text-green-400">${p.percentage || ''}</span>
                        <span class="text-green-400">${p.multiplier}</span>
                    </p>
                </div>
                <div class="history-actions">
                    <button class="history-copy-btn" onclick="window.app.copyPrediction('vert-${p.id}', '${p.time} | ${p.percentage || ''} | ${p.multiplier}')">
                        ${copyIcon}
                    </button>
                    <button class="history-delete-btn" onclick="window.app.deletePrediction('maisonvert', ${p.id})">
                        ${trashIcon}
                    </button>
                </div>
            </div>
        `).join('');

        return `
            <div class="page-container">
                <div class="page-content">
                    <h1 class="page-title">📋 Historique</h1>
                    <p class="page-subtitle">Toutes vos prédictions sauvegardées</p>
                    
                    <div class="prediction-form">
                        <div class="section-header">
                            <h2 class="section-title">💜 Last Predictor 🖤</h2>
                            ${predictions.lastpredictor.length > 0 ? 
                                `<button onclick="window.app.deleteAllPredictions('lastpredictor')" class="delete-all-btn">Tout supprimer</button>` : ''}
                        </div>
                        <div class="history-container">
                            ${predictions.lastpredictor.length === 0 ? 
                                '<p class="text-sm text-muted">Aucun historique</p>' : 
                                lastPredictorItems}
                        </div>
                    </div>
                    
                    <div class="prediction-form">
                        <div class="section-header">
                            <h2 class="section-title">🖤 Win Predictor 🧡</h2>
                            ${predictions.proboom.length > 0 ? 
                                `<button onclick="window.app.deleteAllPredictions('proboom')" class="delete-all-btn">Tout supprimer</button>` : ''}
                        </div>
                        <div class="history-container">
                            ${predictions.proboom.length === 0 ? 
                                '<p class="text-sm text-muted">Aucun historique</p>' : 
                                proboomItems}
                        </div>
                    </div>
                    
                    <div class="prediction-form">
                        <div class="section-header">
                            <h2 class="section-title">🛑✅ Grain de Gain</h2>
                            ${predictions.graindegain.length > 0 ? 
                                `<button onclick="window.app.deleteAllPredictions('graindegain')" class="delete-all-btn">Tout supprimer</button>` : ''}
                        </div>
                        <div class="history-container">
                            ${predictions.graindegain.length === 0 ? 
                                '<p class="text-sm text-muted">Aucun historique</p>' : 
                                graindegainItems}
                        </div>
                    </div>
                    
                    <div class="prediction-form" style="border-color: rgba(34, 197, 94, 0.5);">
                        <div class="section-header">
                            <h2 class="section-title section-title-green">💚 Maison Vert</h2>
                            ${predictions.maisonvert.length > 0 ? 
                                `<button onclick="window.app.deleteAllPredictions('maisonvert')" class="delete-all-btn">Tout supprimer</button>` : ''}
                        </div>
                        <div class="history-container">
                            ${predictions.maisonvert.length === 0 ? 
                                '<p class="text-sm text-muted">Aucun historique</p>' : 
                                maisonvertItems}
                        </div>
                    </div>
                    
                    <button onclick="window.app.navigate('/')" class="btn-link">← Retour au menu</button>
                </div>
            </div>
        `;
    }

    function renderInstall() {
        return `
            <div class="install-container">
                <div class="install-content">
                    <a href="#" onclick="window.app.navigate('/'); return false;" class="back-link">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                        Retour
                    </a>
                    
                    <div class="install-card">
                        <div class="install-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                        </div>
                        
                        <h1 class="install-title">Installer Boss Bet</h1>
                        
                        ${isIos() ? `
                            <p class="install-success">✅ Boss Bet peut être installé sur votre appareil !</p>
                            <div class="prediction-form" style="text-align: left;">
                                <p class="install-instructions">Pour installer sur iPhone/iPad :</p>
                                <ol class="install-list">
                                    <li>
                                        <span class="install-number">1.</span>
                                        Appuyez sur le bouton <strong>Partager</strong> (icône ↑) en bas de Safari
                                    </li>
                                    <li>
                                        <span class="install-number">2.</span>
                                        Faites défiler et appuyez sur <strong>"Sur l'écran d'accueil"</strong>
                                    </li>
                                    <li>
                                        <span class="install-number">3.</span>
                                        Appuyez sur <strong>Ajouter</strong>
                                    </li>
                                </ol>
                            </div>
                        ` : isAndroid() ? `
                            <p class="install-success">✅ Boss Bet peut être installé sur votre appareil !</p>
                            <div class="prediction-form" style="text-align: left;">
                                <p class="install-instructions">Pour installer sur Android :</p>
                                <ol class="install-list">
                                    <li>
                                        <span class="install-number">1.</span>
                                        Ouvrez le menu <strong>⋮</strong> de votre navigateur
                                    </li>
                                    <li>
                                        <span class="install-number">2.</span>
                                        Appuyez sur <strong>"Installer l'application"</strong> ou <strong>"Ajouter à l'écran d'accueil"</strong>
                                    </li>
                                </ol>
                            </div>
                        ` : `
                            <p class="text-muted">Pour installer, utilisez le menu de votre navigateur.</p>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    function render404() {
        return `
            <div class="not-found">
                <div class="not-found-content">
                    <h1 class="not-found-title">404</h1>
                    <p class="not-found-text">Oops! Page non trouvée</p>
                    <a href="#" onclick="window.app.navigate('/'); return false;" class="not-found-link">Retour à l'accueil</a>
                </div>
            </div>
        `;
    }

    function renderCountdown() {
        if (mvCountdown.length === 0) return '';
        
        const now = Date.now();
        const getTimeLeft = (target) => {
            const diff = Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000));
            if (diff === 0) return '🟩 MAINTENANT!';
            const mins = Math.floor(diff / 60);
            const secs = diff % 60;
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };
        
        const firstTime = getTimeLeft(mvCountdown[0].targetTime);
        const count = mvCountdown.length > 1 ? mvCountdown.length - 1 : 0;
        
        return `
            <div class="counter-container">
                <div class="counter-header">
                    <div class="counter-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>Compteur Vert</span>
                    </div>
                    <div>
                        <button onclick="window.app.minimizeCountdown()" class="history-copy-btn" title="Réduire">—</button>
                        <button onclick="window.app.clearCountdown()" class="history-delete-btn" title="Fermer tout">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                </div>
                
                <div class="counter-body">
                    ${mvCountdown.map((p, idx) => {
                        const timeLeft = getTimeLeft(p.targetTime);
                        const isNow = timeLeft === '🟩 MAINTENANT!';
                        return `
                            <div class="counter-item ${isNow ? 'counter-item-active' : 'counter-item-inactive'}">
                                <div class="counter-item-info">
                                    <p>${p.label}</p>
                                    <p>${p.predictionTime}</p>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <span class="counter-time">${timeLeft}</span>
                                    <button onclick="window.app.removeCountdown(${idx})" class="history-delete-btn">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div class="counter-footer">
                    <button onclick="window.app.navigate('/maisonvert')" class="btn-link" style="font-size: 0.625rem; color: #4ade80;">💚 Ouvrir Maison Vert →</button>
                </div>
            </div>
        `;
    }

    function renderCountdownMinimized() {
        if (mvCountdown.length === 0) return '';
        
        const now = Date.now();
        const getTimeLeft = (target) => {
            const diff = Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000));
            if (diff === 0) return 'MAINTENANT';
            const mins = Math.floor(diff / 60);
            const secs = diff % 60;
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };
        
        const firstTime = getTimeLeft(mvCountdown[0].targetTime);
        const count = mvCountdown.length > 1 ? mvCountdown.length - 1 : 0;
        
        return `
            <div class="counter-minimized" onclick="window.app.maximizeCountdown()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span class="counter-minimized-time">${firstTime}</span>
                ${count > 0 ? `<span class="counter-badge">+${count}</span>` : ''}
            </div>
        `;
    }

    // Détection de l'appareil
    function isIos() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent);
    }

    function isAndroid() {
        return /Android/.test(navigator.userAgent);
    }

    // Rendu principal
    function render() {
        let html = '';
        
        // Rendu de la page
        if (currentPage === 'menu') {
            html = renderMenu();
        } else if (currentPage === 'proboom') {
            html = renderProBoom();
        } else if (currentPage === 'lastpredictor') {
            html = renderLastPredictor();
        } else if (currentPage === 'lastpredictor/aviator') {
            html = renderLastPredictorGame('aviator');
        } else if (currentPage === 'lastpredictor/jetx') {
            html = renderLastPredictorGame('jetx');
        } else if (currentPage === 'lastpredictor/cosmosx') {
            html = renderLastPredictorGame('cosmosx');
        } else if (currentPage === 'graindegain') {
            html = renderGrainDeGain();
        } else if (currentPage === 'maisonvert') {
            html = renderMaisonVert();
        } else if (currentPage === 'guide') {
            html = renderGuide();
        } else if (currentPage === 'historique') {
            html = renderHistorique();
        } else if (currentPage === 'install') {
            html = renderInstall();
        } else {
            html = render404();
        }
        
        // Ajouter le compteur
        const countdownState = localStorage.getItem('mv-countdown-minimized') === 'true';
        html += countdownState ? renderCountdownMinimized() : renderCountdown();
        
        root.innerHTML = html;
        
        // Attacher les événements spécifiques
        attachPageEvents();
    }

    // Attacher les événements
    function attachPageEvents() {
        if (currentPage === 'proboom') {
            const heureInput = document.getElementById('probHeure');
            const hexInput = document.getElementById('probHex');
            const decInput = document.getElementById('probDec');
            const predictBtn = document.getElementById('probPredictBtn');
            const resetBtn = document.getElementById('probResetBtn');
            const resultDiv = document.getElementById('probResult');
            
            if (heureInput) {
                heureInput.addEventListener('input', (e) => {
                    let val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    if (val.length > 2) {
                        e.target.value = val.slice(0, 2) + ':' + val.slice(2);
                    } else {
                        e.target.value = val;
                    }
                });
            }
            
            if (predictBtn) {
                predictBtn.addEventListener('click', () => {
                    const heure = heureInput.value;
                    const hex = hexInput.value;
                    const dec = decInput.value;
                    
                    const result = calculateProBoom(heure, hex, dec, true);
                    if (result) {
                        resultDiv.innerHTML = `
                            <div class="result-card">
                                <p class="result-label">Prédiction Win ✅</p>
                                <p class="result-time">${result.time}</p>
                                <div class="result-multiplier-group">
                                    <span class="result-multiplier-label">Multiplicateur :</span>
                                    <span class="result-multiplier-base">${result.multiplier}</span>
                                </div>
                                <button onclick="window.app.copyResult('${result.time} | ${result.multiplier}')" class="btn-icon" style="margin-top: 0.75rem;">
                                    Copier
                                </button>
                            </div>
                        `;
                        
                        const newPrediction = {
                            id: Date.now(),
                            heure,
                            hex,
                            dec,
                            time: result.time,
                            multiplier: result.multiplier
                        };
                        predictions.proboom = [newPrediction, ...predictions.proboom].slice(0, 20);
                        saveToStorage(STORAGE_KEYS.PROBOOM, predictions.proboom);
                    } else {
                        resultDiv.innerHTML = '<p class="text-destructive">Veuillez remplir tous les champs correctement</p>';
                    }
                });
            }
            
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    heureInput.value = '';
                    hexInput.value = '';
                    decInput.value = '';
                    resultDiv.innerHTML = '';
                });
            }
        }
        
        else if (currentPage === 'lastpredictor/aviator' || currentPage === 'lastpredictor/jetx' || currentPage === 'lastpredictor/cosmosx') {
            const game = currentPage.split('/')[1];
            const heureInput = document.getElementById('lastHeure');
            const seedInput = document.getElementById('lastSeed');
            const predictBtn = document.getElementById('lastPredictBtn');
            const resetBtn = document.getElementById('lastResetBtn');
            const resultDiv = document.getElementById('lastResult');
            
            if (heureInput) {
                heureInput.addEventListener('input', (e) => {
                    let val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    if (val.length > 4) {
                        e.target.value = val.slice(0, 2) + ':' + val.slice(2, 4) + ':' + val.slice(4);
                    } else if (val.length > 2) {
                        e.target.value = val.slice(0, 2) + ':' + val.slice(2);
                    } else {
                        e.target.value = val;
                    }
                });
            }
            
            if (predictBtn) {
                predictBtn.addEventListener('click', () => {
                    const heure = heureInput.value;
                    const seed = seedInput.value;
                    
                    const result = calculateLastPredictor(heure, seed, game);
                    if (result) {
                        const typeTag = result.type ? 
                            (result.type === 'tsara' ? '<span class="tag-tsara">🤍 TOUR TSARA</span>' :
                             result.type === 'ratsy' ? '<span class="tag-ratsy">🖤 TOUR RATSY</span>' :
                             result.type === 'hotsara' ? '<span class="tag-hotsara">💚 TOUR HO TSARA</span>' : '') : '';
                        
                        resultDiv.innerHTML = `
                            <div class="result-card">
                                <p class="result-label">🟩 ${game === 'aviator' ? 'PRÉDICTION AVIATOR' : game === 'jetx' ? 'PRÉDICTION JETX' : 'PRÉDICTION COSMOSX'}</p>
                                <p class="result-time">${result.time}</p>
                                <div class="result-multiplier-group">
                                    <span class="result-multiplier-label">💜 BASE :</span>
                                    <span class="result-multiplier-base">${result.base}</span>
                                </div>
                                <div class="result-multiplier-group">
                                    <span class="result-multiplier-label">💚 RISQUES :</span>
                                    <span class="result-multiplier-risk">${result.risk}</span>
                                </div>
                                ${result.type ? `<div class="result-tag">${typeTag}</div>` : ''}
                                <button onclick="window.app.copyResult('${game === 'aviator' ? 'PRÉDICTION AVIATOR' : game === 'jetx' ? 'PRÉDICTION JETX' : 'PRÉDICTION COSMOSX'} ${result.time} | BASE: ${result.base} | RISQUES: ${result.risk}')" class="btn-icon" style="margin-top: 0.75rem;">
                                    Copier
                                </button>
                            </div>
                        `;
                        
                        const newPrediction = {
                            id: Date.now(),
                            heure,
                            seed,
                            time: result.time,
                            base: result.base,
                            risque: result.risk,
                            securite: result.type === 'tsara' ? '15' : result.type === 'hotsara' ? '30' : '10'
                        };
                        predictions.lastpredictor = [newPrediction, ...predictions.lastpredictor].slice(0, 20);
                        saveToStorage(STORAGE_KEYS.LASTPREDICTOR, predictions.lastpredictor);
                    } else {
                        resultDiv.innerHTML = '<p class="text-destructive">Veuillez remplir tous les champs correctement</p>';
                    }
                });
            }
            
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    heureInput.value = '';
                    seedInput.value = '';
                    resultDiv.innerHTML = '';
                });
            }
        }
        
        else if (currentPage === 'graindegain') {
            const heureInput = document.getElementById('grainHeure');
            const seedInput = document.getElementById('grainSeed');
            const grain1Input = document.getElementById('grain1');
            const grain2Input = document.getElementById('grain2');
            const grain3Input = document.getElementById('grain3');
            const predictBtn = document.getElementById('grainPredictBtn');
            const resetBtn = document.getElementById('grainResetBtn');
            const resultDiv = document.getElementById('grainResult');
            
            if (heureInput) {
                heureInput.addEventListener('input', (e) => {
                    let val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    if (val.length > 2) {
                        e.target.value = val.slice(0, 2) + ':' + val.slice(2);
                    } else {
                        e.target.value = val;
                    }
                });
            }
            
            if (predictBtn) {
                predictBtn.addEventListener('click', () => {
                    const heure = heureInput.value;
                    const seed = seedInput.value;
                    const g1 = grain1Input.value;
                    const g2 = grain2Input.value;
                    const g3 = grain3Input.value;
                    
                    const result = calculateGrainDeGain(heure, seed, g1, g2, g3);
                    if (result) {
                        resultDiv.innerHTML = `
                            <div class="result-card">
                                <p class="result-label">Prédiction Grain de Gain ✅</p>
                                <p class="result-time">${result.time}</p>
                                <div class="result-multiplier-group">
                                    <span class="result-multiplier-label">Multiplicateur :</span>
                                    <span class="result-multiplier-base">${result.multiplier}</span>
                                </div>
                                <button onclick="window.app.copyResult('${result.time} | ${result.multiplier}')" class="btn-icon" style="margin-top: 0.75rem;">
                                    Copier
                                </button>
                            </div>
                        `;
                        
                        const newPrediction = {
                            id: Date.now(),
                            heure,
                            seed,
                            g1, g2, g3,
                            time: result.time,
                            multiplier: result.multiplier
                        };
                        predictions.graindegain = [newPrediction, ...predictions.graindegain].slice(0, 20);
                        saveToStorage(STORAGE_KEYS.GRAINDEGAIN, predictions.graindegain);
                    } else {
                        resultDiv.innerHTML = '<p class="text-destructive">Veuillez remplir tous les champs correctement</p>';
                    }
                });
            }
            
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    heureInput.value = '';
                    seedInput.value = '';
                    grain1Input.value = '';
                    grain2Input.value = '';
                    grain3Input.value = '';
                    resultDiv.innerHTML = '';
                });
            }
        }
        
        else if (currentPage === 'maisonvert') {
            const heureInput = document.getElementById('vertHeure');
            const countInput = document.getElementById('vertCount');
            const decInput = document.getElementById('vertDec');
            const predictBtn = document.getElementById('vertPredictBtn');
            const resetBtn = document.getElementById('vertResetBtn');
            const resultDiv = document.getElementById('vertResult');
            
            if (heureInput) {
                heureInput.addEventListener('input', (e) => {
                    let val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    if (val.length > 4) {
                        e.target.value = val.slice(0, 2) + ':' + val.slice(2, 4) + ':' + val.slice(4);
                    } else if (val.length > 2) {
                        e.target.value = val.slice(0, 2) + ':' + val.slice(2);
                    } else {
                        e.target.value = val;
                    }
                });
            }
            
            if (countInput) {
                countInput.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 2);
                });
            }
            
            if (decInput) {
                decInput.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 2);
                });
            }
            
            if (predictBtn) {
                predictBtn.addEventListener('click', () => {
                    const heure = heureInput.value;
                    const count = countInput.value;
                    const dec = decInput.value;
                    
                    const results = calculateMaisonVert(heure, count, dec);
                    if (results) {
                        const predictionsHTML = results.map((r, idx) => `
                            <div class="result-card result-card-green" style="margin-bottom: 1rem;">
                                <p class="result-label" style="color: #4ade80;">🟩 PRÉDICTION VERT ${idx + 1}</p>
                                <p class="result-time" style="color: #4ade80;">${r.time}</p>
                                <div class="result-multiplier-group">
                                    <span class="result-multiplier-label">💚 Apparition vert :</span>
                                    <span class="result-multiplier-base" style="background-color: rgba(34, 197, 94, 0.2); color: #4ade80;">${r.percentage}</span>
                                </div>
                                <div class="result-multiplier-group">
                                    <span class="result-multiplier-label">🎯 Multiplicateur cible :</span>
                                    <span class="result-multiplier-base" style="background-color: rgba(34, 197, 94, 0.2); color: #4ade80;">${r.multiplier}</span>
                                </div>
                                <button onclick="window.app.copyResult('🟩 PRÉDICTION VERT ${idx + 1} : ${r.time} | ${r.percentage} | ${r.multiplier}')" class="btn-icon" style="margin-top: 0.75rem; border-color: rgba(34, 197, 94, 0.5);">
                                    Copier
                                </button>
                            </div>
                        `).join('');
                        
                        resultDiv.innerHTML = predictionsHTML;
                        
                        const now = new Date();
                        const predictionsToSave = results.map((r, idx) => {
                            const [h, m, s] = r.time.split(':').map(Number);
                            const targetTime = new Date(now);
                            targetTime.setHours(h, m, s, 0);
                            if (targetTime.getTime() <= now.getTime()) {
                                targetTime.setDate(targetTime.getDate() + 1);
                            }
                            return {
                                id: Date.now() + idx,
                                label: `🟩 Prédiction Vert ${idx + 1}`,
                                predictionTime: r.time,
                                targetTime: targetTime.toISOString()
                            };
                        });
                        
                        predictions.maisonvert = [
                            ...predictionsToSave.map(p => ({
                                id: p.id,
                                time: p.predictionTime,
                                percentage: results[0].percentage,
                                multiplier: results[0].multiplier
                            })),
                            ...predictions.maisonvert
                        ].slice(0, 50);
                        saveToStorage(STORAGE_KEYS.MAISONVERT, predictions.maisonvert);
                        
                        mvCountdown = [...predictionsToSave, ...mvCountdown].slice(0, 50);
                        saveToStorage(STORAGE_KEYS.MV_COUNTDOWN, mvCountdown);
                        localStorage.removeItem('mv-countdown-minimized');
                        window.dispatchEvent(new Event('mv-countdown-update'));
                    } else {
                        resultDiv.innerHTML = '<p class="text-destructive">Veuillez remplir tous les champs correctement</p>';
                    }
                });
            }
            
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    heureInput.value = '';
                    countInput.value = '';
                    decInput.value = '';
                    resultDiv.innerHTML = '';
                });
            }
        }
    }

    // Actions exposées globalement
    window.app = {
        navigate: function(path) {
            if (path === '/') currentPage = 'menu';
            else if (path === '/proboom') currentPage = 'proboom';
            else if (path === '/lastpredictor') currentPage = 'lastpredictor';
            else if (path === '/lastpredictor/aviator') currentPage = 'lastpredictor/aviator';
            else if (path === '/lastpredictor/jetx') currentPage = 'lastpredictor/jetx';
            else if (path === '/lastpredictor/cosmosx') currentPage = 'lastpredictor/cosmosx';
            else if (path === '/graindegain') currentPage = 'graindegain';
            else if (path === '/maisonvert') currentPage = 'maisonvert';
            else if (path === '/guide') currentPage = 'guide';
            else if (path === '/historique') currentPage = 'historique';
            else if (path === '/install') currentPage = 'install';
            else currentPage = 'menu';
            
            render();
        },
        
        copyResult: function(text) {
            copyToClipboard(text);
        },
        
        copyPrediction: function(id, text) {
            copyToClipboard(text);
            const btn = document.querySelector(`button[onclick*="${id}"]`);
            if (btn) {
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                }, 1500);
            }
        },
        
        deletePrediction: function(type, id) {
            if (confirm('Supprimer cette prédiction ?')) {
                predictions[type] = predictions[type].filter(p => p.id !== id);
                saveToStorage(STORAGE_KEYS[type.toUpperCase()], predictions[type]);
                render();
            }
        },
        
        deleteAllPredictions: function(type) {
            if (confirm('Supprimer tout l\'historique ?')) {
                predictions[type] = [];
                saveToStorage(STORAGE_KEYS[type.toUpperCase()], predictions[type]);
                render();
            }
        },
        
        minimizeCountdown: function() {
            localStorage.setItem('mv-countdown-minimized', 'true');
            render();
        },
        
        maximizeCountdown: function() {
            localStorage.removeItem('mv-countdown-minimized');
            render();
        },
        
        clearCountdown: function() {
            mvCountdown = [];
            saveToStorage(STORAGE_KEYS.MV_COUNTDOWN, mvCountdown);
            render();
        },
        
        removeCountdown: function(index) {
            mvCountdown.splice(index, 1);
            saveToStorage(STORAGE_KEYS.MV_COUNTDOWN, mvCountdown);
            render();
        }
    };

    // Initialisation
    loadFromStorage();
    render();
    
    // Mise à jour périodique du compteur
    setInterval(() => {
        updateCountdown();
    }, 1000);
    
    window.addEventListener('mv-countdown-update', () => {
        loadFromStorage();
        render();
    });
})();

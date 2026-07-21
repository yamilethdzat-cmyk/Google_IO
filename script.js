/**
 * Sistema de Constancias - Google I/O Extended México 2026
 * Lógica del Cliente, Renderizado PDF y Registro Asíncrono en Google Sheets (Apps Script)
 */

// Configuración de la base de datos protegida
const DB_FILENAME = "participantes_io.rar";
const DB_PASSWORD = "GoogleIO";

// Endpoint de Google Apps Script para registro de constancias emitidas
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby07gxcBmfcnaWDwdGym_HT2muHO5-iNIFCNU45JgvPMvGJiIgAAhYgzVHGAlsVOnBE/exec";

// --- Funciones de Desencriptación Auxiliares (SHA-256 + RC4) ---

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return new Uint8Array(hashBuffer);
}

function rc4(key, data) {
    let S = Array.from({length: 256}, (_, i) => i);
    let j = 0;
    
    // KSA (Key-Scheduling Algorithm)
    for (let i = 0; i < 256; i++) {
        j = (j + S[i] + key[i % key.length]) % 256;
        let temp = S[i];
        S[i] = S[j];
        S[j] = temp;
    }
    
    // PRGA (Pseudo-Random Generation Algorithm)
    let i = 0;
    j = 0;
    let out = new Uint8Array(data.length);
    for (let x = 0; x < data.length; x++) {
        i = (i + 1) % 256;
        j = (j + S[i]) % 256;
        let temp = S[i];
        S[i] = S[j];
        S[j] = temp;
        let t = (S[i] + S[j]) % 256;
        out[x] = data[x] ^ S[t];
    }
    return out;
}

function base64ToBytes(base64Str) {
    const binString = atob(base64Str.trim());
    return Uint8Array.from(binString, (m) => m.codePointAt(0));
}

async function decryptData(password, encryptedBase64) {
    const key = await sha256(password);
    const encryptedBytes = base64ToBytes(encryptedBase64);
    const decryptedBytes = rc4(key, encryptedBytes);
    return new TextDecoder().decode(decryptedBytes);
}

/**
 * Normaliza y extrae las columnas de un registro de participante
 */
function parseParticipantRow(row) {
    if (!row || typeof row !== 'object') return null;

    const email = (row.email || row.Email || row.correo || row.Correo || "").toString().trim().toLowerCase();
    const firstName = (row.first_name || row['First Name'] || row.nombre || row.Nombre || row.FIRST_NAME || "").toString().trim();
    const lastName = (row.last_name || row['Last Name'] || row.apellido || row.Apellidos || row.LAST_NAME || "").toString().trim();
    
    const fullName = `${firstName} ${lastName}`.trim() || firstName || lastName || "Participante";

    return {
        email,
        firstName,
        lastName,
        fullName
    };
}

/**
 * Genera un Folio Único para la constancia
 */
function generateFolio(email) {
    const timestampHex = Date.now().toString(36).toUpperCase();
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `IO2026-${timestampHex}-${randomHex}`;
}

/**
 * Envía la petición POST asíncrona (no-cors) a Google Apps Script para registrar la emisión
 */
function sendGoogleSheetLog(folio, nombre, correo) {
    try {
        const payload = JSON.stringify({
            folio: folio,
            nombre: nombre,
            correo: correo
        });

        fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: payload
        }).catch(err => {
            console.warn('Petición Apps Script completada (modo no-cors):', err);
        });
    } catch (e) {
        console.warn('Error al registrar en Google Apps Script:', e);
    }
}

// --- Flujo Principal de la Interfaz ---

document.addEventListener('DOMContentLoaded', () => {
    let participantes = null;
    let isDbLoading = true;
    let dbErrorMsg = null;

    // Elementos DOM
    const form = document.getElementById('constancia-form');
    const emailInput = document.getElementById('email');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');
    
    const alertContainer = document.getElementById('alert-container');
    const alertBox = document.getElementById('alert-box');
    const alertIconWrapper = document.getElementById('alert-icon-wrapper');
    const alertTitle = document.getElementById('alert-title');
    const alertMessage = document.getElementById('alert-message');
    const alertNotice = document.getElementById('alert-notice');
    
    const canvas = document.getElementById('constancia-canvas');
    const ctx = canvas.getContext('2d');

    const icons = {
        error: `
            <div class="p-1.5 bg-red-100 text-red-600 rounded-lg border border-red-200">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
            </div>
        `,
        success: `
            <div class="p-1.5 bg-green-100 text-green-600 rounded-lg border border-green-200">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
            </div>
        `,
        loading: `
            <div class="p-1.5 bg-blue-100 text-blue-600 rounded-lg border border-blue-200">
                <svg class="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        `
    };

    /**
     * Carga y desencripta automáticamente la base de datos protegida participantes_io.rar
     */
    async function initDatabase() {
        try {
            const response = await fetch(`${DB_FILENAME}?t=${Date.now()}`);
            if (!response.ok) {
                throw new Error(`No se pudo cargar el archivo cifrado ${DB_FILENAME}.`);
            }
            const encryptedBase64 = await response.text();
            const decryptedJson = await decryptData(DB_PASSWORD, encryptedBase64);
            const data = JSON.parse(decryptedJson);
            
            if (Array.isArray(data)) {
                participantes = data.map(parseParticipantRow).filter(Boolean);
                isDbLoading = false;
                console.log(`Base de datos ${DB_FILENAME} descifrada exitosamente (${participantes.length} registros).`);
            } else {
                throw new Error('El formato interno de la base de datos no es una lista válida.');
            }
        } catch (err) {
            console.error(`Error al inicializar ${DB_FILENAME}:`, err);
            dbErrorMsg = `Error al cargar o descifrar la base de datos protegida (${DB_FILENAME}).`;
            isDbLoading = false;
        }
    }

    initDatabase();

    function showAlert(type, title, message) {
        alertBox.className = "flex items-start gap-3.5 p-4 rounded-xl border transition-all duration-300 ";
        
        if (type === 'error') {
            alertBox.classList.add('bg-red-50/90', 'border-red-200', 'text-red-900');
            alertIconWrapper.innerHTML = icons.error;
        } else if (type === 'success') {
            alertBox.classList.add('bg-emerald-50/90', 'border-emerald-200', 'text-emerald-900');
            alertIconWrapper.innerHTML = icons.success;
        } else if (type === 'loading') {
            alertBox.classList.add('bg-blue-50/90', 'border-blue-200', 'text-blue-900');
            alertIconWrapper.innerHTML = icons.loading;
        }

        alertTitle.textContent = title;
        alertMessage.textContent = message;
        
        if (type === 'success') {
            alertNotice.classList.remove('hidden');
        } else {
            alertNotice.classList.add('hidden');
        }
        
        alertContainer.classList.remove('hidden');
    }

    function hideAlert() {
        alertContainer.classList.add('hidden');
    }

    /**
     * Administra el estado de carga del botón para evitar clics dobles y mostrar "Procesando..."
     */
    function setLoading(isLoading) {
        if (isLoading) {
            submitBtn.disabled = true;
            emailInput.disabled = true;
            btnSpinner.classList.remove('hidden');
            btnText.textContent = 'Procesando...';
        } else {
            submitBtn.disabled = false;
            emailInput.disabled = false;
            btnSpinner.classList.add('hidden');
            btnText.textContent = 'Obtener Constancia';
        }
    }

    // --- Buscador y Generador de Constancia ---

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();
        
        const emailValue = emailInput.value.trim().toLowerCase();
        
        if (!emailValue) {
            showAlert('error', 'Campo Requerido', 'Por favor ingresa tu correo electrónico de registro.');
            return;
        }

        if (isDbLoading) {
            setLoading(true);
            showAlert('loading', 'Cargando Base de Datos', 'Inicializando la base de datos protegida de asistencia, por favor espera un momento...');
            setTimeout(() => {
                setLoading(false);
                form.dispatchEvent(new Event('submit'));
            }, 800);
            return;
        }

        if (dbErrorMsg) {
            showAlert('error', 'Error del Sistema', dbErrorMsg);
            return;
        }

        if (!participantes || participantes.length === 0) {
            showAlert('error', 'Error de Datos', 'La base de datos de participantes no está disponible o está vacía.');
            return;
        }

        setLoading(true);
        showAlert('loading', 'Buscando Registro', 'Validando tu correo en la base de datos descifrada...');

        try {
            // Buscar coincidencia exacta del correo en participantes_io.rar
            const participanteEncontrado = participantes.find(p => p.email === emailValue);
            
            if (!participanteEncontrado) {
                showAlert('error', 'Registro No Encontrado', 'El correo ingresado no se encuentra registrado en el evento Google I/O Extended México 2026. Verifica tu ortografía e intenta de nuevo.');
                setLoading(false);
                return;
            }

            const nombreCompleto = participanteEncontrado.fullName;
            const correoParticipante = participanteEncontrado.email;
            const folioConstancia = generateFolio(correoParticipante);

            showAlert('loading', 'Generando Certificado', `Registro verificado para ${nombreCompleto}. Generando PDF y guardando folio ${folioConstancia}...`);
            
            // 1. Enviar petición POST a Google Apps Script en segundo plano (asíncrono no bloqueante)
            sendGoogleSheetLog(folioConstancia, nombreCompleto, correoParticipante);

            // 2. Cargar la plantilla base y renderizar en Canvas
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = `CONSTANCIA_PARTICIPACION_GENERAL_052926.png?t=${Date.now()}`;

            img.onload = async () => {
                try {
                    canvas.width = img.naturalWidth || img.width || 1999;
                    canvas.height = img.naturalHeight || img.height || 1550;
                    
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    const nameAreaX = canvas.width / 2;
                    // Y=677 -> centrado entre 'a:' (Y≈603) y la linea separadora (Y≈747) del nuevo diseño
                    const nameAreaY = 677;
                    const clearWidth = 1200;
                    const clearHeight = 110; // Altura suficiente para cubrir el espacio entre 'a:' y la linea
                    
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(nameAreaX - (clearWidth / 2), nameAreaY - (clearHeight / 2), clearWidth, clearHeight);
                    
                    try {
                        await document.fonts.load('bold 64px Montserrat');
                    } catch (fontError) {
                        console.warn('Usando fuente de respaldo del sistema.', fontError);
                    }
                    
                    ctx.fillStyle = '#1A1A1A';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    let fontSize = 64;
                    ctx.font = `bold ${fontSize}px "Montserrat", "Google Sans", "Arial", sans-serif`;
                    
                    const maxTextWidth = 1200;
                    let textWidth = ctx.measureText(nombreCompleto).width;
                    while (textWidth > maxTextWidth && fontSize > 32) {
                        fontSize -= 2;
                        ctx.font = `bold ${fontSize}px "Montserrat", "Google Sans", "Arial", sans-serif`;
                        textWidth = ctx.measureText(nombreCompleto).width;
                    }
                    
                    // Estampar Nombre y Apellido
                    ctx.fillText(nombreCompleto, nameAreaX, nameAreaY);
                    
                    const { jsPDF } = window.jspdf;
                    
                    const pdf = new jsPDF({
                        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
                        unit: 'px',
                        format: [canvas.width, canvas.height]
                    });
                    
                    const imgData = canvas.toDataURL('image/png');
                    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                    
                    const sanitizedName = nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_');
                    pdf.save(`Constancia_IO_Extended_2026_${sanitizedName}.pdf`);
                    
                    showAlert('success', '¡Descarga Iniciada!', `Constancia generada exitosamente para ${nombreCompleto}. (Folio: ${folioConstancia})`);
                    setLoading(false);
                } catch (canvasError) {
                    console.error('Error al procesar Canvas o jsPDF:', canvasError);
                    showAlert('error', 'Error de Procesamiento', 'Ocurrió un error al renderizar la constancia. Contacta al soporte del evento.');
                    setLoading(false);
                }
            };

            img.onerror = () => {
                showAlert('error', 'Error de Imagen', 'No se pudo cargar la plantilla base de la constancia (constancia_base.png).');
                setLoading(false);
            };

        } catch (searchError) {
            console.error('Error en búsqueda:', searchError);
            showAlert('error', 'Error General', 'Ocurrió un error inesperado al validar tus datos.');
            setLoading(false);
        }
    });
});

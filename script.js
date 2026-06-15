/**
 * Sistema de Constancias - Build With AI (BWAI)
 * Lógica del Cliente y Renderizado de Certificados en PDF con Desencriptación Interna
 */

// Clave de encriptación interna para protección del archivo participantes.enc
const DB_PASSWORD = "GDG_BWAI_2026";

// --- Funciones de Desencriptación Auxiliares (SHA-256 + RC4) ---

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return new Uint8Array(hashBuffer);
}

function rc4(key, data) {
    let S = Array.from({length: 256}, (_, i) => i);
    let j = 0;
    
    // KSA
    for (let i = 0; i < 256; i++) {
        j = (j + S[i] + key[i % key.length]) % 256;
        let temp = S[i];
        S[i] = S[j];
        S[j] = temp;
    }
    
    // PRGA
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
    const binString = atob(base64Str);
    return Uint8Array.from(binString, (m) => m.codePointAt(0));
}

async function decryptData(password, encryptedBase64) {
    const key = await sha256(password);
    const encryptedBytes = base64ToBytes(encryptedBase64);
    const decryptedBytes = rc4(key, encryptedBytes);
    return new TextDecoder().decode(decryptedBytes);
}

// --- Flujo Principal de la Interfaz ---

document.addEventListener('DOMContentLoaded', () => {
    // Base de datos de participantes descifrada en memoria
    let participantes = null;
    let isDbLoading = true;
    let dbErrorMsg = null;

    // Elementos del buscador de constancias
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

    // SVGs para las alertas
    const icons = {
        error: `
            <div class="p-1 bg-red-100 text-red-600 rounded-md border border-red-200">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
            </div>
        `,
        success: `
            <div class="p-1 bg-green-100 text-green-600 rounded-md border border-green-200">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
            </div>
        `,
        loading: `
            <div class="p-1 bg-blue-100 text-blue-600 rounded-md border border-blue-200">
                <svg class="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        `
    };

    /**
     * Carga y desencripta automáticamente la base de datos de participantes
     */
    async function initDatabase() {
        try {
            const response = await fetch(`participantes.enc?t=${Date.now()}`);
            if (!response.ok) {
                throw new Error('No se pudo descargar la base de datos protegida.');
            }
            const encryptedBase64 = await response.text();
            const decryptedJson = await decryptData(DB_PASSWORD, encryptedBase64);
            const data = JSON.parse(decryptedJson);
            
            if (Array.isArray(data)) {
                participantes = data;
                isDbLoading = false;
                console.log('Base de datos cargada y descifrada exitosamente.');
            } else {
                throw new Error('Formato de base de datos incorrecto.');
            }
        } catch (err) {
            console.error('Error al inicializar la base de datos protegida:', err);
            dbErrorMsg = 'Error al inicializar base de datos de participantes. Por favor reporta esto al administrador.';
            isDbLoading = false;
        }
    }

    // Iniciar carga en segundo plano
    initDatabase();

    /**
     * Muestra una alerta visual en la interfaz con animación de entrada suave.
     */
    function showAlert(type, title, message) {
        alertBox.className = "flex items-start gap-3 p-4 rounded-md border transition-all duration-300 ";
        
        if (type === 'error') {
            alertBox.classList.add('bg-red-50', 'border-red-200', 'text-red-900');
            alertIconWrapper.innerHTML = icons.error;
        } else if (type === 'success') {
            alertBox.classList.add('bg-green-50', 'border-green-200', 'text-green-900');
            alertIconWrapper.innerHTML = icons.success;
        } else if (type === 'loading') {
            alertBox.classList.add('bg-blue-50', 'border-blue-200', 'text-blue-900');
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
        alertContainer.classList.add('animate-fade-in');
    }

    function hideAlert() {
        alertContainer.classList.add('hidden');
    }

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

    // --- Buscador de Constancia ---

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();
        
        const emailValue = emailInput.value.trim().toLowerCase();
        
        if (!emailValue) {
            showAlert('error', 'Campo Requerido', 'Por favor ingresa tu correo electrónico.');
            return;
        }

        // Si aún se está cargando o hubo un error al inicializar
        if (isDbLoading) {
            setLoading(true);
            showAlert('loading', 'Cargando Base de Datos', 'Inicializando la base de datos segura de asistencia, por favor espera un momento...');
            // Esperar un momento y reintentar recursivamente
            setTimeout(() => {
                setLoading(false);
                form.dispatchEvent(new Event('submit'));
            }, 1000);
            return;
        }

        if (dbErrorMsg) {
            showAlert('error', 'Error del Sistema', dbErrorMsg);
            return;
        }

        if (!participantes) {
            showAlert('error', 'Error del Sistema', 'La base de datos de participantes no está disponible.');
            return;
        }

        setLoading(true);
        showAlert('loading', 'Buscando Correo', 'Validando tu correo en la base de datos segura...');

        try {
            // Buscar coincidencia de correo
            const rowCoincidente = participantes.find(p =>
                p.email && p.email.trim().toLowerCase() === emailValue
            );
            
            if (!rowCoincidente) {
                showAlert('error', 'Registro No Encontrado', 'El correo ingresado no se encuentra registrado en el evento. Verifica tu ortografía e intenta de nuevo.');
                setLoading(false);
                return;
            }

            // Construir nombre completo
            const participante = {
                correo: rowCoincidente.email.trim(),
                nombre: `${rowCoincidente.first_name} ${rowCoincidente.last_name}`.trim()
            };

            showAlert('loading', 'Generando Certificado', 'Constancia encontrada. Procesando la plantilla de alta resolución...');
            
            // Cargar la plantilla
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = `constancia_base.png?t=${Date.now()}`;

            img.onload = async () => {
                try {
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    const nameAreaX = canvas.width / 2;
                    const nameAreaY = 750; // Posición vertical óptima calculada (entre "a:" en Y=689 y la línea en Y=807)
                    const clearWidth = 1200;
                    const clearHeight = 80;
                    
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(nameAreaX - (clearWidth / 2), nameAreaY - (clearHeight / 2), clearWidth, clearHeight);
                    
                    try {
                        await document.fonts.load('bold 64px Montserrat');
                    } catch (fontError) {
                        console.warn('Usando fuente alternativa del sistema.', fontError);
                    }
                    
                    ctx.fillStyle = '#000000';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    let fontSize = 64; // Tamaño óptimo escalado proporcionalmente a la resolución 1999x1545
                    ctx.font = `bold ${fontSize}px "Montserrat", "Arial", sans-serif`;
                    
                    const maxTextWidth = 1200; // Ancho máximo ajustado a las nuevas dimensiones
                    let textWidth = ctx.measureText(participante.nombre).width;
                    while (textWidth > maxTextWidth && fontSize > 36) {
                        fontSize -= 2;
                        ctx.font = `bold ${fontSize}px "Montserrat", "Arial", sans-serif`;
                        textWidth = ctx.measureText(participante.nombre).width;
                    }
                    
                    ctx.fillText(participante.nombre, nameAreaX, nameAreaY);
                    
                    const { jsPDF } = window.jspdf;
                    
                    const pdf = new jsPDF({
                        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
                        unit: 'px',
                        format: [canvas.width, canvas.height]
                    });
                    
                    const imgData = canvas.toDataURL('image/png');
                    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                    
                    const sanitizedName = participante.nombre.replace(/[^a-zA-Z0-9]/g, '_');
                    pdf.save(`Constancia_BWAI_${sanitizedName}.pdf`);
                    
                    showAlert('success', '¡Descarga Iniciada!', `Constancia generada exitosamente para ${participante.nombre}. Se ha iniciado la descarga del PDF.`);
                    setLoading(false);
                } catch (canvasError) {
                    console.error('Error al procesar el Canvas o jsPDF:', canvasError);
                    showAlert('error', 'Error de Procesamiento', 'Ocurrió un error al renderizar la constancia. Contacta al soporte técnico del evento.');
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

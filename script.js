/**
 * Sistema de Constancias - Build With AI (BWAI)
 * Lógica del Cliente y Renderizado de Certificados en PDF
 */

document.addEventListener('DOMContentLoaded', () => {
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
     * Muestra una alerta visual en la interfaz con animación de entrada suave.
     */
    function showAlert(type, title, message) {
        // Limpiar estilos previos
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
        
        alertContainer.classList.remove('hidden');
        alertContainer.classList.add('animate-fade-in');
    }

    /**
     * Oculta el contenedor de alertas.
     */
    function hideAlert() {
        alertContainer.classList.add('hidden');
    }

    /**
     * Activa o desactiva el estado de carga en el formulario.
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

    // Escuchador de envío del formulario
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();
        
        const emailValue = emailInput.value.trim().toLowerCase();
        
        if (!emailValue) {
            showAlert('error', 'Campo Requerido', 'Por favor ingresa tu correo electrónico.');
            return;
        }

        setLoading(true);
        showAlert('loading', 'Buscando Correo', 'Estamos validando tu asistencia al evento en la base de datos...');

        try {
            // Realizar fetch a participantes.json
            // Usamos un query timestamp para evitar almacenamiento en caché en GitHub Pages
            const response = await fetch(`participantes.json?t=${Date.now()}`);
            if (!response.ok) {
                throw new Error('No se pudo cargar la base de datos de participantes.');
            }
            
            const participantes = await response.json();
            
            // Buscar coincidencia exacta
            const participante = participantes.find(p => p.correo.trim().toLowerCase() === emailValue);
            
            if (!participante) {
                showAlert('error', 'Registro No Encontrado', 'El correo ingresado no se encuentra registrado en el evento. Verifica tu ortografía e intenta de nuevo.');
                setLoading(false);
                return;
            }

            // Si se encuentra, proceder a generar la constancia
            showAlert('loading', 'Generando Certificado', 'Constancia encontrada. Procesando la plantilla de alta resolución...');
            
            // Cargar la imagen de la constancia base
            const img = new Image();
            img.crossOrigin = "anonymous"; // Prevenir problemas de Canvas contaminado
            img.src = 'constancia_base.png';

            img.onload = async () => {
                try {
                    // Configurar el Canvas con las dimensiones nativas de la imagen (925x654)
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    
                    // Dibujar la plantilla oficial
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    /**
                     * NOTA IMPORTANTE:
                     * La imagen 'constancia_base.png' provista por el usuario ya contiene impreso
                     * el nombre de "Luis Jeronimo Loera Moreno". Para hacer esta aplicación dinámica
                     * y que funcione con otros participantes, cubriremos el área del nombre con un
                     * rectángulo blanco antes de escribir el nombre detectado en participantes.json.
                     * Si se cambia por una plantilla vacía en producción, este parche no afectará visualmente.
                     */
                    const nameAreaX = canvas.width / 2;
                    const nameAreaY = 322; // Centro estimado del campo de nombre en la plantilla
                    const clearWidth = 620; // Ancho para cubrir el nombre original
                    const clearHeight = 55;  // Alto para cubrir el nombre original
                    
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(nameAreaX - (clearWidth / 2), nameAreaY - (clearHeight / 2), clearWidth, clearHeight);
                    
                    // Esperar a que la tipografía "Montserrat" esté lista
                    try {
                        await document.fonts.load('bold 32px Montserrat');
                    } catch (fontError) {
                        console.warn('No se pudo cargar la tipografía Montserrat, usando fuente del sistema.', fontError);
                    }
                    
                    // Configuración del texto del participante
                    ctx.fillStyle = '#000000'; // Color negro como lo solicita el usuario
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    // Calcular tamaño de fuente adaptativo por si el nombre es demasiado largo
                    let fontSize = 32;
                    ctx.font = `bold ${fontSize}px "Montserrat", "Arial", sans-serif`;
                    
                    // Si el nombre es muy largo, reducimos el tamaño para evitar desbordes
                    const maxTextWidth = 600;
                    let textWidth = ctx.measureText(participante.nombre).width;
                    while (textWidth > maxTextWidth && fontSize > 20) {
                        fontSize -= 1;
                        ctx.font = `bold ${fontSize}px "Montserrat", "Arial", sans-serif`;
                        textWidth = ctx.measureText(participante.nombre).width;
                    }
                    
                    // Escribir el nombre del participante
                    ctx.fillText(participante.nombre, nameAreaX, nameAreaY);
                    
                    // Generar PDF usando jsPDF
                    const { jsPDF } = window.jspdf;
                    
                    // Crear el PDF con las dimensiones exactas del Canvas
                    const pdf = new jsPDF({
                        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
                        unit: 'px',
                        format: [canvas.width, canvas.height]
                    });
                    
                    // Convertir Canvas a datos de imagen
                    const imgData = canvas.toDataURL('image/png');
                    
                    // Agregar imagen al PDF ocupando todo el lienzo
                    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                    
                    // Iniciar descarga del archivo PDF
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

        } catch (fetchError) {
            console.error('Error al realizar fetch:', fetchError);
            showAlert('error', 'Error de Servidor', 'No se pudo conectar con la base de datos de participantes. Por favor intenta más tarde.');
            setLoading(false);
        }
    });
});

// Configuración de tu proyecto Supabase con tus credenciales reales
const SUPABASE_URL = "https://igzwopivsuoytovokmmn.supabase.co";
const SUPABASE_KEY = "Tsb_publishable_AN-fZr6XIAeB0DoYJeCbLQ_dIIHDMV_";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Arreglo local para almacenar los medicamentos cargados
let listaMedicamentos = [];

// Ejecutar automáticamente al iniciar la página
document.addEventListener("DOMContentLoaded", () => {
    cargarInventario();
});

// Cambiar la etiqueta de unidades de medida según la presentación del fármaco
function actualizarUnidadesMedida() {
    const presentacion = document.getElementById("reg-presentacion").value;
    const lblUnidad = document.getElementById("lbl-unidad");
    lblUnidad.innerText = (presentacion === 'jarabe') ? 'ml' : 'unidades';
}

// 1. CARGAR MEDICAMENTOS AL DESPLEGABLE DESDE TU TABLA med_inventario
async function cargarInventario() {
    const select = document.getElementById("select-medicamentos");
    select.innerHTML = '<option value="">-- Selecciona --</option>';

    const { data, error } = await supabase
        .from('med_inventario')
        .select('*')
        .order('nombre', { ascending: true });

    if (error) {
        console.error("Error cargando inventario:", error);
        return;
    }

    listaMedicamentos = data;
    
    data.forEach(med => {
        const option = document.createElement("option");
        option.value = med.id;
        option.text = `${med.nombre} (${med.gramaje_volumen})`;
        select.appendChild(option);
    });
}

// 2. DETECTAR PRESENTACIÓN Y PREPARAR CÁLCULOS EN PANTALLA
function cargarDetallesMedicamento() {
    const medId = document.getElementById("select-medicamentos").value;
    const cuadro = document.getElementById("cuadro-calculo");
    const lblMedida = document.getElementById("ingesta-lbl-medida");
    const alerta = document.getElementById("alerta-seguridad");
    
    alerta.classList.add("hidden"); 

    if (!medId) {
        cuadro.classList.add("hidden");
        return;
    }

    const med = listaMedicamentos.find(m => m.id === medId);
    if (med) {
        lblMedida.innerText = med.unidad_medida || (med.tipo_presentacion === 'jarabe' ? 'ml' : 'unidades');
        cuadro.classList.remove("hidden");
        document.getElementById("calc-stock-actual").innerText = `${med.stock_actual} ${lblMedida.innerText}`;
        
        // Calcular dosis aproximadas
        calcularDosisRestantes(med.stock_actual, 1);
        
        // Validar regla de seguridad de tiempo transcurrido
        verificarReglaTiempo(med.id);
    }
}

function calcularDosisRestantes(stock, cantidadToma) {
    const dosis = cantidadToma > 0 ? Math.floor(stock / cantidadToma) : 0;
    document.getElementById("calc-dosis-disponibles").innerText = dosis;
}

// 3. REGLA DE SEGURIDAD (Control estricto de tiempo entre tomas)
async function verificarReglaTiempo(medicamentoId) {
    const alerta = document.getElementById("alerta-seguridad");
    
    const { data, error } = await supabase
        .from('med_historial_ingestas')
        .select('*')
        .eq('medicamento_id', medicamentoId)
        .order('fecha_hora_ingesta', { ascending: false })
        .limit(1);

    if (error || !data || data.length === 0) return;

    const ultimaIngesta = data[0];
    const fechaUltima = new Date(ultimaIngesta.fecha_hora_ingesta);
    const ahora = new Date();
    
    const diferenciaHoras = (ahora - fechaUltima) / (1000 * 60 * 60);
    const horasConfiguradas = ultimaIngesta.tiempo_entre_tomas_horas;

    if (diferenciaHoras < horasConfiguradas) {
        const tiempoRestante = (horasConfiguradas - diferenciaHoras).toFixed(1);
        document.getElementById("alerta-mensaje").innerText = `🚨 Medida de seguridad: No ha cumplido el tiempo mínimo. Faltan aproximadamente ${tiempoRestante} horas para la siguiente dosis.`;
        alerta.classList.remove("hidden");
    }
}

// 4. REGISTRAR NUEVO MEDICAMENTO (Añadir o surtir stock)
async function registrarMedicamento() {
    const nombre = document.getElementById("reg-nombre").value;
    const presentacion = document.getElementById("reg-presentacion").value;
    const gramaje = document.getElementById("reg-gramaje").value;
    const stock = parseFloat(document.getElementById("reg-stock").value);
    const unidad = (presentacion === 'jarabe') ? 'ml' : 'unidades';

    if (!nombre || !gramaje || isNaN(stock)) {
        alert("Por favor completa todos los campos correctamente.");
        return;
    }

    const { error } = await supabase
        .from('med_inventario')
        .insert([{
            nombre: nombre,
            tipo_presentacion: presentacion,
            gramaje_volumen: gramaje,
            unidad_medida: unidad,
            stock_actual: stock
        }]);

    if (error) {
        alert("Error al guardar en Supabase: " + error.message);
    } else {
        alert("¡Medicamento guardado con éxito en el inventario!");
        document.getElementById("reg-nombre").value = "";
        document.getElementById("reg-gramaje").value = "";
        document.getElementById("reg-stock").value = "";
        cargarInventario();
    }
}

// 5. EFECTUAR INGESTA (Descontar inventario y generar recordatorio ICS móvil)
async function ejecutarIngesta() {
    const medId = document.getElementById("select-medicamentos").value;
    const cantidad = parseFloat(document.getElementById("ingesta-cantidad").value);
    const intervalo = parseFloat(document.getElementById("ingesta-intervalo").value);

    if (!medId || isNaN(cantidad) || isNaN(intervalo)) {
        alert("Selecciona un medicamento e ingresa la cantidad y el intervalo de tiempo.");
        return;
    }

    const med = listaMedicamentos.find(m => m.id === medId);
    if (med.stock_actual < cantidad) {
        alert("Inventario insuficiente para realizar la ingesta.");
        return;
    }

    const nuevoStock = med.stock_actual - cantidad;

    // Actualizar Stock en med_inventario
    const { error: errorStock } = await supabase
        .from('med_inventario')
        .update({ stock_actual: nuevoStock })
        .eq('id', medId);

    if (errorStock) {
        alert("Error al actualizar inventario: " + errorStock.message);
        return;
    }

    // Insertar registro en tu tabla med_historial_ingestas
    const { error: errorIngesta } = await supabase
        .from('med_historial_ingestas')
        .insert([{
            medicamento_id: medId,
            cantidad_toma: cantidad,
            tiempo_entre_tomas_horas: intervalo,
            fecha_hora_ingesta: new Date().toISOString()
        }]);

    if (errorIngesta) {
        alert("Error al guardar historial de toma: " + errorIngesta.message);
        return;
    }

    alert("¡Ingesta registrada! El inventario ha sido actualizado.");
    
    // Generar y descargar el recordatorio de calendario ICS de forma nativa e inmediata
    generarArchivoICS(med.nombre, intervalo);

    cargarInventario();
}

// 6. GENERADOR AUTOMÁTICO DE ARCHIVO .ICS PARA DISPOSITIVOS MÓVILES
function generarArchivoICS(nombreMedicamento, horasIntervalo) {
    const ahora = new Date();
    const proximaToma = new Date(ahora.getTime() + (horasIntervalo * 60 * 60 * 1000));
    
    const formatearFechaICS = (date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    
    const fechaInicio = formatearFechaICS(proximaToma);
    const fechaFin = formatearFechaICS(new Date(proximaToma.getTime() + (30 * 60 * 1000))); 

    const contenidoICS = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//MULTISAAS//Control Medicamentos//ES",
        "BEGIN:VEVENT",
        `UID:${Date.now()}@multisaas.com`,
        `DTSTAMP:${formatearFechaICS(ahora)}`,
        `DTSTART:${fechaInicio}`,
        `DTEND:${fechaFin}`,
        `SUMMARY:🚨 TOMA DE MEDICAMENTO: ${nombreMedicamento.toUpperCase()}`,
        `DESCRIPTION:Es hora de tomar tu dosis de ${nombreMedicamento}.`,
        "BEGIN:VALARM",
        "TRIGGER:-PT15M", 
        "ACTION:DISPLAY",
        "DESCRIPTION:Recordatorio de Medicamento",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([contenidoICS], { type: "text/calendar;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `recordatorio_${nombreMedicamento.replace(/\s+/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

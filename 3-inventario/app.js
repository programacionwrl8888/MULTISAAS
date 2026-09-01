// Configuración de Supabase (Sustituye por tus llaves reales del Paso 1)
const SUPABASE_URL = "https://igzwopivsuoytovokmmn.supabase.co/rest/v1/";
const SUPABASE_KEY = "Tsb_publishable_AN-fZr6XIAeB0DoYJeCbLQ_dIIHDMV_";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let activoActual = null;
let canvas, ctx, dibujando = false;

document.addEventListener("DOMContentLoaded", () => {
    inicializarCanvasFirma();
});

// 1. MOTOR DE BÚSQUEDA EN TABLA act_inventario
async function buscarActivo() {
    const busqueda = document.getElementById("txt-busqueda").value.trim();
    if (!busqueda) return alert("Ingresa un término de búsqueda.");

    // Consulta flexible por placa, nombre o ID
    const { data, error } = await supabase
        .from('act_inventario')
        .select('*')
        .or(`placa.eq.${busqueda},nombre.ilike.%${busqueda}%`)
        .limit(1);

    if (error || !data || data.length === 0) {
        alert("Elemento no encontrado en el inventario.");
        document.getElementById("card-activo").classList.add("hidden");
        return;
    }

    activoActual = data[0];
    desplegarInformacionActivo();
}

function desplegarInformacionActivo() {
    document.getElementById("card-activo").classList.remove("hidden");
    document.getElementById("panel-traslado").classList.add("hidden"); // Resetear formulario de firmas

    document.getElementById("act-nombre").innerText = activoActual.nombre;
    document.getElementById("act-placa").innerText = activoActual.placa;
    document.getElementById("act-custodio").innerText = activoActual.custodio_actual || "Sin asignar";

    const badge = document.getElementById("badge-estado");
    const alerta = document.getElementById("alerta-activo");

    // Manejo de estados configurados en tu sistema
    if (activoActual.estado === 'mantenimiento' || activoActual.estado === 'prestamo') {
        badge.innerText = activoActual.estado;
        badge.className = "text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800";
        alerta.classList.remove("hidden");
    } else if (activoActual.estado === 'baja') {
        badge.innerText = "De Baja";
        badge.className = "text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800";
        alerta.classList.add("hidden");
    } else {
        badge.innerText = "En Sitio";
        badge.className = "text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800";
        alerta.classList.add("hidden");
    }
}

// 2. CONFIGURACIÓN DEL CANVAS PARA CAPTURA DE FIRMA TÁCTIL O RATÓN
function inicializarCanvasFirma() {
    canvas = document.getElementById("canvas-firma");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#1E293B"; // Color pizarra oscuro para el trazo
    ctx.lineWidth = 2;

    // Eventos Mouse
    canvas.addEventListener("mousedown", (e) => { dibujando = true; ctx.beginPath(); moverTrazo(e); });
    canvas.addEventListener("mousemove", (e) => { if(dibujando) moverTrazo(e); });
    window.addEventListener("mouseup", () => dibujando = false);

    // Eventos Táctiles (Móviles / Tablets)
    canvas.addEventListener("touchstart", (e) => { dibujando = true; ctx.beginPath(); moverTrazoTacto(e); e.preventDefault(); });
    canvas.addEventListener("touchmove", (e) => { if(dibujando) moverTrazoTacto(e); e.preventDefault(); });
    window.addEventListener("touchend", () => dibujando = false);
}

function moverTrazo(e) {
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
}

function moverTrazoTacto(e) {
    const rect = canvas.getBoundingClientRect();
    const toque = e.touches[0];
    ctx.lineTo(toque.clientX - rect.left, toque.clientY - rect.top);
    ctx.stroke();
}

function limpiarFirma() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// 3. FLUJO DE TRASLADO CON SUPERVISIÓN
function abrirModalTraslado() {
    document.getElementById("panel-traslado").classList.remove("hidden");
    limpiarFirma();
}

async function guardarTrasladoProceso() {
    const receptor = document.getElementById("traslado-receptor").value.trim();
    const ubicacion = document.getElementById("traslado-ubicacion").value.trim();
    
    if (!receptor || !ubicacion) return alert("Por favor asigna el receptor y la nueva ubicación.");

    // Convertir el trazo del canvas a formato Base64 para guardarlo de forma segura
    const stringFirmaB64 = canvas.toDataURL();

    // 1. Insertar registro histórico en act_historial_traslados
    const { error: errorHistorial } = await supabase
        .from('act_historial_traslados')
        .insert([{
            activo_id: activoActual.id,
            placa: activoActual.placa,
            custodio_anterior: activoActual.custodio_actual,
            custodio_nuevo: receptor,
            nueva_posicion: ubicacion,
            firma_recibido_b64: stringFirmaB64, // Registro e integridad biométrica manual
            aprobacion_jefe: false, // Requiere inicio de sesión del jefe de área para el visto bueno definitivo
            fecha_traslado: new Date().toISOString()
        }]);

    if (errorHistorial) return alert("Error registrando la transferencia: " + errorHistorial.message);

    // 2. Actualizar la tabla principal de activos con la nueva posición provisional
    const { error: errorActivo } = await supabase
        .from('act_inventario')
        .update({
            custodio_actual: receptor,
            ubicacion: ubicacion
        })
        .eq('id', activoActual.id);

    if (errorActivo) {
        alert("Error actualizando activo: " + errorActivo.message);
    } else {
        alert("¡Proceso de traslado enviado con éxito! Queda en espera de la validación del jefe de área.");
        document.getElementById("panel-traslado").classList.add("hidden");
        buscarActivo(); // Refrescar los datos en pantalla
    }
}

async function marcarNovedadSede() {
    const novedad = prompt("Escribe la novedad (mantenimiento, prestamo, baja):").toLowerCase();
    if (!['mantenimiento', 'prestamo', 'baja'].includes(novedad)) return alert("Estado no válido.");

    const { error } = await supabase
        .from('act_inventario')
        .update({ estado: novedad })
        .eq('id', activoActual.id);

    if (error) alert("Error: " + error.message);
    else {
        alert("Estado del activo modificado correctamente.");
        buscarActivo();
    }
}

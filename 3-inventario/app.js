const SUPABASE_URL = "https://supabase.co";
const SUPABASE_KEY = "Tsb_publishable_AN-fZr6XIAeB0DoYJeCbLQ_dIIHDMV_";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let activoActual = null;
let canvas, ctx, dibujando = false;

document.addEventListener("DOMContentLoaded", () => {
    inicializarCanvasFirma();
});

async function buscarActivo() {
    const busqueda = document.getElementById("txt-busqueda").value.trim();
    if (!busqueda) return alert("Ingresa un término de búsqueda.");

    const { data, error } = await supabase
        .from('act_inventario')
        .select('*')
        .or(`placa.eq.${busqueda},nombre.ilike.%${busqueda}%`)
        .limit(1);

    if (error || !data || data.length === 0) {
        alert("Elemento no encontrado.");
        document.getElementById("card-activo").classList.add("hidden");
        return;
    }

    activoActual = data[0];
    desplegarInformacionActivo();
}

function desplegarInformacionActivo() {
    document.getElementById("card-activo").classList.remove("hidden");
    document.getElementById("panel-traslado").classList.add("hidden");

    document.getElementById("act-nombre").innerText = activoActual.nombre;
    document.getElementById("act-placa").innerText = activoActual.placa;
    document.getElementById("act-custodio").innerText = activoActual.custodio_actual || "Sin asignar";

    const badge = document.getElementById("badge-estado");
    const alerta = document.getElementById("alerta-activo");

    if (['mantenimiento', 'prestamo'].includes(activoActual.estado)) {
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

function inicializarCanvasFirma() {
    canvas = document.getElementById("canvas-firma");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#1E293B";
    ctx.lineWidth = 2;

    canvas.addEventListener("mousedown", (e) => { dibujando = true; ctx.beginPath(); moverTrazo(e); });
    canvas.addEventListener("mousemove", (e) => { if(dibujando) moverTrazo(e); });
    window.addEventListener("mouseup", () => dibujando = false);

    canvas.addEventListener("touchstart", (e) => { dibujando = true; ctx.beginPath(); moverTrazoTacto(e); e.preventDefault(); });
    canvas.addEventListener("touchmove", (e) => { if(dibujando) moverTrazoTacto(e); e.preventDefault(); });
    window.addEventListener("touchend", () => dibujando = false);
}

function obtenerPosicion(e, isTouch = false) {
    const rect = canvas.getBoundingClientRect();
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

function moverTrazo(e) {
    const pos = obtenerPosicion(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
}

function moverTrazoTacto(e) {
    const pos = obtenerPosicion(e, true);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
}

function limpiarFirma() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function abrirModalTraslado() {
    document.getElementById("panel-traslado").classList.remove("hidden");
    limpiarFirma();
}

async function guardarTrasladoProceso() {
    const receptor = document.getElementById("traslado-receptor").value.trim();
    const ubicacion = document.getElementById("traslado-ubicacion").value.trim();
    
    if (!receptor || !ubicacion) return alert("Completa los datos solicitados.");

    const stringFirmaB64 = canvas.toDataURL();

    const { error: errorHistorial } = await supabase
        .from('act_historial_traslados')
        .insert([{
            activo_id: activoActual.id,
            placa: activoActual.placa,
            custodio_anterior: activoActual.custodio_actual,
            custodio_nuevo: receptor,
            nueva_posicion: ubicacion,
            firma_recibido_b64: stringFirmaB64,
            aprobacion_jefe: false,
            fecha_traslado: new Date().toISOString()
        }]);

    if (errorHistorial) return alert("Error en transferencia: " + errorHistorial.message);

    const { error: errorActivo } = await supabase
        .from('act_inventario')
        .update({ custodio_actual: receptor, ubicacion: ubicacion })
        .eq('id', activoActual.id);

    if (errorActivo) {
        alert("Error: " + errorActivo.message);
    } else {
        alert("¡Traslado registrado! En espera de aprobación del jefe.");
        document.getElementById("panel-traslado").classList.add("hidden");
        buscarActivo();
    }
}

async function marcarNovedadSede() {
    const novedad = prompt("Escribe el estado (mantenimiento, prestamo, baja):").toLowerCase();
    if (!['mantenimiento', 'prestamo', 'baja'].includes(novedad)) return alert("Estado no válido.");

    const { error } = await supabase
        .from('act_inventario')
        .update({ estado: novedad })
        .eq('id', activoActual.id);

    if (error) alert("Error: " + error.message);
    else {
        alert("Estado modificado.");
        buscarActivo();
    }
}

// Configuración de Supabase
const SUPABASE_URL = "https://igzwopivsuoytovokmmn.supabase.co/rest/v1/";
const SUPABASE_KEY = "Tsb_publishable_AN-fZr6XIAeB0DoYJeCbLQ_dIIHDMV"; // Reemplázala con tu llave Publishable de la imagen
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let listaCuentas = [];
let carritoGastos = [];

document.addEventListener("DOMContentLoaded", () => {
    cargarParametrosIniciales();
});

// 1. CARGAR CUENTAS Y ESTABLECIMIENTOS DESDE SUPABASE
async function cargarParametrosIniciales() {
    // Cargar Cuentas
    const { data: cuentas } = await supabase.from('fin_cuentas').select('*');
    if (cuentas) {
        listaCuentas = cuentas;
        const selectC = document.getElementById("select-cuenta-balance");
        selectC.innerHTML = "";
        cuentas.forEach(c => {
            selectC.appendChild(new Option(`${c.nombre_cuenta}`, c.id));
        });
        actualizarSaldoPantalla();
    }

    // Cargar Establecimientos
    const { data: locales } = await supabase.from('fin_establecimientos').select('*');
    if (locales) {
        const selectE = document.getElementById("select-establecimiento-compra");
        selectE.innerHTML = "";
        locales.forEach(e => {
            selectE.appendChild(new Option(e.nombre_establecimiento, e.id));
        });
    }
}

function actualizarSaldoPantalla() {
    const cuentaId = document.getElementById("select-cuenta-balance").value;
    const cuenta = listaCuentas.find(c => c.id == cuentaId);
    if (cuenta) {
        document.getElementById("lbl-saldo-total").innerText = `$${parseFloat(cuenta.saldo).toFixed(2)}`;
    }
}

// 2. AGREGAR ELEMENTOS AL CARRITO DE COMPRAS MÚLTIPLES
function agregarAlCarritoFinanzas() {
    const nombre = document.getElementById("compra-articulo").value.trim();
    const cantidad = parseFloat(document.getElementById("compra-cantidad").value);
    const precio = parseFloat(document.getElementById("compra-precio").value);

    if (!nombre || isNaN(cantidad) || isNaN(precio)) return alert("Ingresa datos válidos.");

    carritoGastos.push({ nombre, cantidad, precio });
    renderizarCarrito();

    // Limpiar campos manuales
    document.getElementById("compra-articulo").value = "";
    document.getElementById("compra-precio").value = "";
}

function renderizarCarrito() {
    const contenedor = document.getElementById("lista-carrito-finanzas");
    contenedor.innerHTML = "";
    let total = 0;

    if (carritoGastos.length === 0) {
        contenedor.innerHTML = `<p class="text-slate-400 text-center py-2">El carrito está vacío</p>`;
        document.getElementById("lbl-total-carrito").innerText = "$0.00";
        return;
    }

    carritoGastos.forEach((item, index) => {
        const subtotal = item.cantidad * item.precio;
        total += subtotal;
        const div = document.createElement("div");
        div.className = "flex justify-between items-center bg-slate-50 p-2 rounded-lg border";
        div.innerHTML = `
            <div>
                <p class="font-bold text-slate-800">${item.nombre}</p>
                <p class="text-[10px] text-slate-400">$${item.precio.toFixed(2)} x ${item.cantidad}</p>
            </div>
            <div class="flex items-center gap-3">
                <span class="font-mono font-bold">$${subtotal.toFixed(2)}</span>
                <button onclick="removerDelCarrito(${index})" class="text-rose-500 font-bold text-xs">✕</button>
            </div>
        `;
        contenedor.appendChild(div);
    });

    document.getElementById("lbl-total-carrito").innerText = `$${total.toFixed(2)}`;
}

function removerDelCarrito(index) {
    carritoGastos.splice(index, 1);
    renderizarCarrito();
}

// 3. MOTOR OCR: TEXT-RECOGNITION DE FOTO A ARTÍCULOS AUTOMÁTICOS
async function procesarFotoFactura() {
    const fileInput = document.getElementById("input-foto-factura");
    const statusOcr = document.getElementById("status-ocr");
    
    if (fileInput.files.length === 0) return;
    
    statusOcr.classList.remove("hidden");
    statusOcr.innerText = "Leyendo líneas de la factura... ⏳";

    try {
        const archivoImagen = fileInput.files[0];
        // Ejecución nativa de reconocimiento óptico de caracteres
        const resultado = await Tesseract.recognize(archivoImagen, 'spa');
        const lineasTexto = resultado.data.text.split('\n');

        lineasTexto.forEach(linea => {
            // Intentar buscar patrones de precios o artículos en la factura por línea (Filtro simple)
            const partes = linea.match(/([a-zA-Z\s]{3,})\s+(\d+[\.,]?\d*)/);
            if (partes && partes.length >= 3) {
                const nombreArticulo = partes[1].trim();
                const precioProcesado = parseFloat(partes[2].replace(',', '.'));
                
                if (nombreArticulo.length > 2 && !isNaN(precioProcesado) && precioProcesado > 0) {
                    carritoGastos.push({
                        nombre: nombreArticulo,
                        cantidad: 1,
                        precio: precioProcesado
                    });
                }
            }
        });

        renderizarCarrito();
        statusOcr.innerText = "¡Factura escaneada correctamente! 🎯";
    } catch (err) {
        console.error(err);
        statusOcr.innerText = "No se pudo leer la imagen de forma automática.";
    }
}

// 4. GUARDAR COMPRA MAESTRO-DETALLE Y DESCONTAR SALDO DE CUENTA
async function guardarCompraMaestro() {
    if (carritoGastos.length === 0) return alert("Tu carrito está vacío.");

    const cuentaId = document.getElementById("select-cuenta-balance").value;
    const establecimientoId = document.getElementById("select-establecimiento-compra").value;
    const totalCompra = carritoGastos.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);

    const cuentaSel = listaCuentas.find(c => c.id == cuentaId);
    if (cuentaSel.saldo < totalCompra) return alert("Saldo insuficiente en la cuenta seleccionada.");

    // A. Insertar en fin_compras_maestro
    const { data: maestro, error: errMaestro } = await supabase
        .from('fin_compras_maestro')
        .insert([{
            cuenta_id: cuentaId,
            establecimiento_id: establecimientoId,
            total: totalCompra,
            fecha_compra: new Date().toISOString()
        }])
        .select()
        .single();

    if (errMaestro || !maestro) return alert("Error al registrar maestro de compra: " + errMaestro?.message);

    // B. Insertar todos los artículos en fin_compras_detalle
    const payloadDetalle = carritoGastos.map(item => ({
        compra_maestro_id: maestro.id,
        descripcion_articulo: item.nombre,
        cantidad: item.cantidad,
        precio_unitario: item.precio
    }));

    const { error: errDetalle } = await supabase.from('fin_compras_detalle').insert(payloadDetalle);
    if (errDetalle) return alert("Error al guardar el detalle de los artículos.");

    // C. Descontar dinero actualizando fin_cuentas
    const nuevoSaldo = cuentaSel.saldo - totalCompra;
    const { error: errSaldo } = await supabase
        .from('fin_cuentas')
        .update({ saldo: nuevoSaldo })
        .eq('id', cuentaId);

    if (!errSaldo) {
        alert("¡Compra procesada con éxito y saldo descontado!");
        carritoGastos = [];
        renderizarCarrito();
        cargarParametrosIniciales(); // Refrescar los saldos locales
    }
}

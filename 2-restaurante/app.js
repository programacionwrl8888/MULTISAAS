// Configuración de Supabase
const SUPABASE_URL = "https://igzwopivsuoytovokmmn.supabase.co/rest/v1/";
const SUPABASE_KEY = "sb_publishable_AN-fZr6XIAeB0DoYJeCbLQ_dIIHDMV_";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Estados del POS
let memoriaProductos = [];
let carritoOrden = [];
let cajaAbierta = false;

document.addEventListener("DOMContentLoaded", () => {
    inicializarApp();
    escucharConexion();
});

function inicializarApp() {
    configurarCargaDatos();
    sincronizarVentasPendientes();
}

// Alternar pantallas del Administrador y Cajero
function cambiarVista(vista) {
    const pos = document.getElementById("vista-pos");
    const admin = document.getElementById("vista-admin");
    const btnPos = document.getElementById("btn-nav-pos");
    const btnAdmin = document.getElementById("btn-nav-admin");

    if(vista === 'pos') {
        pos.classList.remove("hidden");
        admin.classList.add("hidden");
        btnPos.classList.add("bg-white", "text-emerald-800");
        btnAdmin.classList.remove("bg-white", "text-emerald-800");
    } else {
        pos.classList.add("hidden");
        admin.classList.remove("hidden");
        btnAdmin.classList.add("bg-white", "text-emerald-800");
        btnPos.classList.remove("bg-white", "text-emerald-800");
    }
}

// Monitoreo de conectividad en tiempo real
function escucharConexion() {
    const indicador = document.getElementById("status-conexion");
    const actualizarStatus = () => {
        if(navigator.onLine) {
            indicador.innerText = "Sincronizado ✨";
            indicador.className = "text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold";
            sincronizarVentasPendientes();
        } else {
            indicador.innerText = "Modo Offline Activo 📦";
            indicador.className = "text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold";
        }
    };
    window.addEventListener('online', actualizarStatus);
    window.addEventListener('offline', actualizarStatus);
    actualizarStatus();
}

// Carga Inicial (Estrategia: Caché local primero, luego actualiza desde Supabase)
async function configurarCargaDatos() {
    const localData = localStorage.getItem("rest_menu_cache");
    if(localData) {
        memoriaProductos = JSON.parse(localData);
        renderizarProductosPOS();
    }

    if(navigator.onLine) {
        const { data, error } = await supabase.from('rest_productos_menu').select('*');
        if(!error && data) {
            memoriaProductos = data;
            localStorage.setItem("rest_menu_cache", JSON.stringify(data));
            renderizarProductosPOS();
        }
    }
}

function renderizarProductosPOS() {
    const grid = document.getElementById("grid-productos-pos");
    grid.innerHTML = "";
    memoriaProductos.forEach(p => {
        const div = document.createElement("div");
        div.className = "bg-slate-50 border p-3 rounded-lg text-center cursor-pointer hover:border-emerald-500 transition";
        div.onclick = () => agregarAlCarrito(p);
        div.innerHTML = `
            <p class="text-xs font-bold text-slate-700">${p.nombre}</p>
            <p class="text-xs text-emerald-600 font-semibold">$${p.precio}</p>
        `;
        grid.appendChild(div);
    });
}

// Operaciones del Carrito
function agregarAlCarrito(producto) {
    const existe = carritoOrden.find(item => item.id === producto.id);
    if(existe) {
        existe.cantidad++;
    } else {
        carritoOrden.push({ ...producto, cantidad: 1 });
    }
    actualizarInterfazCarrito();
}

function actualizarInterfazCarrito() {
    const contenedor = document.getElementById("items-carrito");
    contenedor.innerHTML = "";
    let total = 0;

    if(carritoOrden.length === 0) {
        contenedor.innerHTML = `<p class="text-slate-400 text-center py-4">No hay productos en la orden</p>`;
        document.getElementById("pos-total-orden").innerText = "$0";
        return;
    }

    carritoOrden.forEach(item => {
        total += item.precio * item.cantidad;
        const div = document.createElement("div");
        div.className = "flex justify-between items-center bg-slate-50 p-2 rounded";
        div.innerHTML = `
            <div>
                <p class="font-bold">${item.nombre}</p>
                <p class="text-[10px] text-slate-400">$${item.precio} x ${item.cantidad}</p>
            </div>
            <span class="font-semibold text-slate-700">$${item.precio * item.cantidad}</span>
        `;
        contenedor.appendChild(div);
    });

    document.getElementById("pos-total-orden").innerText = `$${total}`;
}

// Procesar Venta con Lógica Offline Integrada
async function procesarVenta() {
    if(carritoOrden.length === 0) return alert("El carrito está vacío");

    const totalVenta = carritoOrden.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const idLocal = 'venta_' + Date.now();

    const payloadVenta = {
        id_local: idLocal,
        total: totalVenta,
        detalles: carritoOrden,
        fecha: new Date().toISOString(),
        sincronizado: false
    };

    // Guardado en cola local
    let cola = JSON.parse(localStorage.getItem("cola_ventas_pendientes") || "[]");
    cola.push(payloadVenta);
    localStorage.setItem("cola_ventas_pendientes", JSON.stringify(cola));

    // Intento de guardado inmediato en Supabase si hay red
    if(navigator.onLine) {
        await sincronizarVentasPendientes();
    }

    alert(`¡Orden procesada! Total cobrado: $${totalVenta}. Listo para enviar por canales digitales.`);
    carritoOrden = [];
    actualizarInterfazCarrito();
}

// Motor de Sincronización Automática
async function sincronizarVentasPendientes() {
    if(!navigator.onLine) return;
    
    let cola = JSON.parse(localStorage.getItem("cola_ventas_pendientes") || "[]");
    if(cola.length === 0) return;

    for(let i = 0; i < cola.length; i++) {
        const venta = cola[i];
        if(!venta.sincronizado) {
            const { error } = await supabase.from('rest_ventas_historial').insert([{
                total_venta: venta.total,
                created_at: venta.fecha
                // Aquí puedes mapear campos adicionales de tu tabla
            }]);

            if(!error) {
                venta.sincronizado = true;
            }
        }
    }

    // Filtrar y remover de la cola las ya procesadas con éxito
    const pendientes = cola.filter(v => !v.sincronizado);
    localStorage.setItem("cola_ventas_pendientes", JSON.stringify(pendientes));
}

// Métodos de Administración de Catálogos (Tablas de Control)
async function guardarMateriaPrima() {
    const nombre = document.getElementById("admin-mp-nombre").value;
    const cantidad = parseFloat(document.getElementById("admin-mp-cantidad").value);
    const unidad = document.getElementById("admin-mp-unidad").value;
    const costo = parseFloat(document.getElementById("admin-mp-costo").value);

    if(!nombre || isNaN(cantidad) || isNaN(costo)) return alert("Completa los datos de insumo");

    const { error } = await supabase.from('rest_materia_prima').insert([{
        nombre_insumo: nombre,
        stock_cantidad: cantidad,
        unidad_medida: unidad,
        costo_factura: costo
    }]);

    if(error) alert("Error: " + error.message);
    else {
        alert("Insumo de materia prima ingresado con éxito.");
        document.getElementById("admin-mp-nombre").value = "";
        document.getElementById("admin-mp-cantidad").value = "";
        document.getElementById("admin-mp-costo").value = "";
    }
}

async function guardarProductoMenu() {
    const nombre = document.getElementById("admin-prod-nombre").value;
    const precio = parseFloat(document.getElementById("admin-prod-precio").value);

    if(!nombre || isNaN(precio)) return alert("Ingresa nombre y precio de venta");

    const { error } = await supabase.from('rest_productos_menu').insert([{
        nombre: nombre,
        precio: precio
    }]);

    if(error) alert("Error: " + error.message);
    else {
        alert("Producto agregado al catálogo del restaurante.");
        document.getElementById("admin-prod-nombre").value = "";
        document.getElementById("admin-prod-precio").value = "";
        configurarCargaDatos(); // Recargar el POS
    }
}

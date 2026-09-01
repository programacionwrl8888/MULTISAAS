const SUPABASE_URL = "https://igzwopivsuoytovokmmn.supabase.co/rest/v1/";
const SUPABASE_KEY = "Tsb_publishable_AN-fZr6XIAeB0DoYJeCbLQ_dIIHDMV_"; // Tu clave Publishable de la imagen
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let listaMedicos = [];

document.addEventListener("DOMContentLoaded", () => {
    cargarProfesionalesSalud();
});

async function cargarProfesionalesSalud() {
    const { data, error } = await supabase.from('amate_perfiles_profesionales').select('*');
    if (data) {
        listaMedicos = data;
        const select = document.getElementById("select-medicos");
        select.innerHTML = '<option value="">-- Elige un Profesional --</option>';
        data.forEach(m => {
            select.appendChild(new Option(`${m.nombre} - ${m.especialidad}`, m.id));
        });
    }
}

function cargarEspecialidad() {
    const id = document.getElementById("select-medicos").value;
    const med = listaMedicos.find(m => m.id == id);
    const box = document.getElementById("info-perfil");
    if(med) {
        box.classList.remove("hidden");
        document.getElementById("lbl-medico-nombre").innerText = med.nombre;
        document.getElementById("lbl-medico-tarifa").innerText = `Consulta: $${med.tarifa_hora} (Moneda Local / USD)`;
    } else {
        box.classList.add("hidden");
    }
}

async function solicitarCitaMedica() {
    const medicoId = document.getElementById("select-medicos").value;
    const fecha = document.getElementById("cita-fecha").value;
    const plataforma = document.getElementById("cita-plataforma").value;

    if (!medicoId || !fecha) return alert("Completa los datos de la cita médica.");

    // Registro de la cita con estatus bloqueado hasta verificar pago
    const { error } = await supabase.from('amate_citas').insert([{
        profesional_id: medicoId,
        fecha_hora: fecha,
        canal_enlace: plataforma,
        estado_pago: 'pendiente_validacion'
    }]);

    if (!error) {
        alert("¡Solicitud enviada! Una vez verifiquemos el comprobante adjunto, se desbloqueará tu enlace de videollamada.");
    }
}

async function guardarHistoriaClinica() {
    const pacienteId = document.getElementById("hc-paciente-id").value.trim();
    const notas = document.getElementById("hc-diagnostico").value.trim();
    const medicoId = document.getElementById("select-medicos").value;

    if(!pacienteId || !notas || !medicoId) return alert("Llena los campos del expediente clínico.");

    const { error } = await supabase.from('amate_historias_clinicas').insert([{
        paciente_documento: pacienteId,
        profesional_id: medicoId,
        registro_clinico: notas,
        fecha_registro: new Date().toISOString()
    }]);

    if(!error) alert("Historia clínica guardada y custodiada bajo cifrado de ley.");
}

function exportarHistoriaPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const pacienteId = document.getElementById("hc-paciente-id").value;
    const notas = document.getElementById("hc-diagnostico").value;

    doc.setFont("helvetica", "bold");
    doc.text("ÁMATE PLATAFORMA DE SALUD S.A.S", 20, 20);
    doc.setFont("helvetica", "normal");
    doc.text(`Documento del Paciente: ${pacienteId}`, 20, 35);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 20, 45);
    doc.text("Evolución y Concepto Médico:", 20, 60);
    doc.rect(20, 65, 170, 60);
    doc.text(notas, 25, 75, { maxWidth: 160 });

    doc.save(`Historia_Clinica_${pacienteId}.pdf`);
}

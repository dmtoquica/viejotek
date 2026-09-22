import { supabase } from "./supabase.js";

const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n||0);
let session=null;

function saveSession(s){sessionStorage.setItem("viejotek_seller",JSON.stringify(s));session=s;}
function clearSession(){sessionStorage.removeItem("viejotek_seller");session=null;}

async function loadNames(){
  const {data,error}=await supabase.rpc("seller_names");
  if(error){
    $("loginMsg").textContent="Aún no están preparados los vendedores. La administración debe preparar la lista primero.";
    return;
  }
  $("sellerName").innerHTML='<option value="">Selecciona tu nombre</option>'+(data||[]).map(x=>'<option>'+x.name+'</option>').join("");
}

async function login(name,pin){
  const {data,error}=await supabase.rpc("seller_login",{p_name:name,p_pin:pin});
  if(error)return $("loginMsg").textContent=error.message;
  if(!data?.ok)return $("loginMsg").textContent=data?.message||"Nombre o PIN incorrecto.";
  saveSession({seller_id:data.seller_id,name:data.name,pin});
  showApp();
}

async function loadTickets(){
  const {data,error}=await supabase.rpc("seller_get_tickets",{p_seller_id:session.seller_id,p_pin:session.pin});
  if(error)return $("msg").textContent=error.message;
  const rows=data||[];
  $("assigned").textContent=rows.length;
  $("sold").textContent=rows.filter(x=>["vendida","pagada","ingresada"].includes(x.status)).length;
  $("paid").textContent=rows.filter(x=>["pagada","ingresada"].includes(x.status)).length;
  $("tickets").innerHTML=rows.map(x=>{
    const share=encodeURIComponent("🎟️ VEJOTEK "+x.ticket_number+"\nEntrada "+(x.ticket_type==="pareja"?"Pareja":"Individual")+"\nValor: "+money(x.price)+"\nConserva este mensaje y presenta el QR al ingresar.");
    const status=x.status;
    const sold=status==="vendida";
    const available=["disponible","reservada"].includes(status);
    return '<article class="ticket">'+
      '<div class="ticket-number">'+x.ticket_number+'</div>'+
      '<span class="badge">'+status+'</span>'+
      '<p><b>'+ (x.ticket_type==="pareja"?"Pareja":"Individual")+'</b> · '+money(x.price)+'</p>'+
      '<img alt="QR '+x.ticket_number+'" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data='+encodeURIComponent(x.qr_token)+'">'+
      (available?
        '<button class="btn primary full sell" data-id="'+x.id+'">Registrar venta</button>':
        '<div class="muted">'+(x.buyer_name||"Sin comprador")+(x.buyer_phone?" · "+x.buyer_phone:"")+'</div>'+
        '<a class="btn full" target="_blank" href="https://wa.me/?text='+share+'">📲 Compartir por WhatsApp</a>'+
        (sold?'<button class="btn primary full paidBtn" data-id="'+x.id+'">💰 Marcar pagada</button>':'')
      )+
      (available?'<a class="btn full" target="_blank" href="https://wa.me/?text='+share+'">📲 Compartir por WhatsApp</a>':'')+
      '</article>';
  }).join("");

  document.querySelectorAll(".sell").forEach(b=>b.onclick=()=>openSale(b.dataset.id));
  document.querySelectorAll(".paidBtn").forEach(b=>b.onclick=()=>markPaid(b.dataset.id));
}

function openSale(id){
  const card=document.querySelector('.sell[data-id="'+id+'"]').closest(".ticket");
  const form=document.createElement("div");
  form.className="sale-form";
  form.innerHTML='<label>Nombre comprador<input id="buyerName" required></label><label>Celular<input id="buyerPhone" inputmode="tel"></label><label>Tipo<select id="ticketType"><option value="individual">Individual · $30.000</option><option value="pareja">Pareja · $50.000</option></select></label><button class="btn primary full" id="saveSale">Guardar venta</button><button class="btn full" id="cancelSale">Cancelar</button>';
  card.querySelector(".sell").replaceWith(form);
  $("saveSale").onclick=async()=>{
    const {error}=await supabase.rpc("seller_save_ticket",{p_seller_id:session.seller_id,p_pin:session.pin,p_ticket_id:id,p_type:$("ticketType").value,p_buyer_name:$("buyerName").value,p_buyer_phone:$("buyerPhone").value});
    if(error)return $("msg").textContent=error.message;
    $("msg").textContent="Venta registrada correctamente.";
    loadTickets();
  };
  $("cancelSale").onclick=loadTickets;
}

async function markPaid(id){
  if(!confirm("¿Confirmas que esta boleta ya fue pagada?"))return;
  const {error}=await supabase.rpc("seller_mark_paid",{p_seller_id:session.seller_id,p_pin:session.pin,p_ticket_id:id});
  if(error)return $("msg").textContent=error.message;
  $("msg").textContent="Pago registrado.";
  loadTickets();
}

async function showApp(){
  $("loginBox").hidden=true;
  $("app").hidden=false;
  $("welcome").textContent="Hola, "+session.name+" 👋";
  loadTickets();
}

$("sellerLogin").addEventListener("submit",e=>{e.preventDefault();login($("sellerName").value,$("sellerPin").value.trim());});
$("exit").onclick=()=>{clearSession();location.reload();};

await loadNames();
const old=sessionStorage.getItem("viejotek_seller");
if(old){try{session=JSON.parse(old);showApp();}catch{clearSession();}}
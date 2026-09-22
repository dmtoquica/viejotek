import { supabase } from "./supabase.js";
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n||0);

async function guard(){
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return location.href="login.html";
  const {data:p}=await supabase.from("profiles").select("*").eq("id",user.id).single();
  if(p?.role!=="admin")return location.href="socio.html";
  $("userLabel").textContent=p.name||user.email;
  load();
}

async function load(){
  const {data,error}=await supabase.from("tickets").select("*,seller_access(name,pin)").order("ticket_number");
  if(error)return $("msg").textContent=error.message;
  const rows=data||[];
  $("total").textContent=rows.length;
  $("sold").textContent=rows.filter(x=>["reservada","vendida","pagada","ingresada"].includes(x.status)).length;
  $("paid").textContent=rows.filter(x=>["pagada","ingresada"].includes(x.status)).length;
  $("entered").textContent=rows.filter(x=>x.entered_at).length;
  $("income").textContent=money(rows.filter(x=>["pagada","ingresada"].includes(x.status)).reduce((a,x)=>a+x.price,0));
  render(rows);

  const {data:s,error:se}=await supabase.from("seller_access").select("*").order("name");
  if(se)return $("msg").textContent=se.message;
  $("socios").innerHTML=(s||[]).map(x=>{
    const count=rows.filter(t=>t.seller_id===x.id).length;
    return '<div class="card"><b>'+x.name+'</b><div class="muted">PIN: <strong>'+x.pin+'</strong></div><div>Entradas asignadas: '+count+'/5</div></div>';
  }).join("");
}

function render(rows){
  const q=$("search").value.toLowerCase(),st=$("status").value;
  rows=rows.filter(x=>(!st||x.status===st)&&((x.ticket_number+" "+(x.buyer_name||"")+" "+(x.buyer_phone||"")+" "+(x.seller_access?.name||"")).toLowerCase().includes(q)));
  $("tickets").innerHTML=rows.map(x=>'<tr><td><b>'+x.ticket_number+'</b></td><td>'+x.ticket_type+'</td><td>'+money(x.price)+'</td><td>'+((x.seller_access?.name)||"Sin asignar")+'</td><td>'+(x.buyer_name||"—")+'</td><td>'+x.status+'</td><td>'+(x.entered_at?"Sí":"No")+'</td></tr>').join("");
}

$("search").addEventListener("input",load);
$("status").addEventListener("change",load);
$("logout").onclick=async()=>{await supabase.auth.signOut();location.href="login.html"};

$("seed").onclick=async()=>{
  const {data,error}=await supabase.rpc("seed_tickets");
  $("msg").textContent=error?error.message:"Se prepararon "+data+" entradas.";
  load();
};

$("seedSellers").onclick=async()=>{
  const {data,error}=await supabase.rpc("seed_sellers");
  $("msg").textContent=error?error.message:"Listo: "+data+" vendedores preparados y 5 entradas asignadas a cada uno.";
  load();
};

$("export").onclick=async()=>{
  const {data}=await supabase.from("tickets").select("ticket_number,ticket_type,price,status,buyer_name,buyer_phone,seller_id,paid_at,entered_at").order("ticket_number");
  const csv=[Object.keys(data?.[0]||{}).join(","),...(data||[]).map(r=>Object.values(r).map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(","))].join("\n");
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download="viejotek-entradas.csv";
  a.click();
};

guard();
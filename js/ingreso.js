import { supabase } from "./supabase.js";
const $=id=>document.getElementById(id);
let scanner=null;
let busy=false;

async function validate(){
  if(busy)return;
  const code=$("code").value.trim();
  if(!code)return;
  busy=true;
  const {data,error}=await supabase.rpc("validate_entry",{p_code:code});
  const box=$("result");
  box.className="scan-result "+(error||!data?.ok?"bad":"ok");
  box.textContent=error?error.message:(data?.message||"Entrada procesada");
  busy=false;
}

async function startCamera(){
  const reader=$("reader");
  const button=$("startCamera");
  reader.style.display="block";
  button.textContent="⏹️ Detener cámara";
  if(scanner){
    try{await scanner.stop();}catch{}
    scanner=null;
    reader.style.display="none";
    button.textContent="📷 Abrir cámara y escanear QR";
    return;
  }
  if(!window.Html5Qrcode){
    $("result").className="scan-result bad";
    $("result").textContent="No se pudo cargar el lector QR. Revisa tu conexión a internet.";
    return;
  }
  scanner=new Html5Qrcode("reader");
  try{
    await scanner.start(
      {facingMode:"environment"},
      {fps:10,qrbox:{width:250,height:250}},
      async(decodedText)=>{
        $("code").value=decodedText;
        try{await scanner.stop();}catch{}
        scanner=null;
        reader.style.display="none";
        button.textContent="📷 Abrir cámara y escanear QR";
        await validate();
      },
      ()=>{}
    );
    $("result").className="scan-result";
    $("result").textContent="Apunta la cámara al QR de la boleta.";
  }catch(e){
    scanner=null;
    reader.style.display="none";
    button.textContent="📷 Abrir cámara y escanear QR";
    $("result").className="scan-result bad";
    $("result").textContent="No se pudo abrir la cámara. Verifica que el navegador tenga permiso para usar la cámara.";
  }
}

$("startCamera").onclick=startCamera;
$("validate").onclick=validate;
$("code").addEventListener("keydown",e=>{if(e.key==="Enter")validate();});

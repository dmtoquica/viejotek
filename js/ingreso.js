import { supabase } from "./supabase.js";
const $=id=>document.getElementById(id);
async function validate(){const code=$("code").value.trim();if(!code)return;const {data,error}=await supabase.rpc("validate_entry",{p_code:code});const box=$("result");box.className="scan-result "+(error||!data?.ok?"bad":"ok");box.textContent=error?error.message:(data?.message||"Entrada procesada");}
$("validate").onclick=validate;$("code").addEventListener("keydown",e=>{if(e.key==="Enter")validate();});
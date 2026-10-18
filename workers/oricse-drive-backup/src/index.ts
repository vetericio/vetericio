/**
 * ORICSE backup worker. Deploy as a SEPARATE Cloudflare Worker with a cron trigger.
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN,
 * ORICSE_DRIVE_ROOT_FOLDER_ID. No secrets belong in GitHub.
 */
export interface Env {
 SUPABASE_URL:string; SUPABASE_SERVICE_ROLE_KEY:string;
 GOOGLE_DRIVE_CLIENT_ID:string; GOOGLE_DRIVE_CLIENT_SECRET:string;
 GOOGLE_DRIVE_REFRESH_TOKEN:string; ORICSE_DRIVE_ROOT_FOLDER_ID:string;
}
type Event = {id:string;clinica_id:string|null;origem_tabela:string;registro_chave:string;operacao:string;dados:unknown;criado_em:string;tentativas:number};
async function rpc<T>(env:Env,fn:string,args:object):Promise<T>{
 const response=await fetch(env.SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/rpc/"+fn,{
 method:"POST",headers:{"apikey":env.SUPABASE_SERVICE_ROLE_KEY,"authorization":"Bearer "+env.SUPABASE_SERVICE_ROLE_KEY,"content-type":"application/json"},
 body:JSON.stringify(args)});
 if(!response.ok)throw new Error("Supabase RPC "+fn+": "+response.status+" "+(await response.text()).slice(0,300));
 return await response.json() as T;
}
async function token(env:Env):Promise<string>{
 const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
 body:new URLSearchParams({client_id:env.GOOGLE_DRIVE_CLIENT_ID,client_secret:env.GOOGLE_DRIVE_CLIENT_SECRET,refresh_token:env.GOOGLE_DRIVE_REFRESH_TOKEN,grant_type:"refresh_token"})});
 const j=await r.json() as {access_token?:string};
 if(!r.ok||!j.access_token)throw new Error("Google OAuth token: "+r.status);
 return j.access_token;
}
async function drive(t:string,url:string,init:RequestInit={}):Promise<Response>{
 const h=new Headers(init.headers);h.set("authorization","Bearer "+t);
 const r=await fetch(url,{...init,headers:h});
 if(!r.ok)throw new Error("Drive HTTP "+r.status+": "+(await r.text()).slice(0,300));
 return r;
}
async function ensureFolder(t:string,parent:string,name:string):Promise<string>{
 const escaped=name.replace(/'/g,"\\'");
 const q=encodeURIComponent("'"+parent+"' in parents and name='"+escaped+"' and mimeType='application/vnd.google-apps.folder' and trashed=false");
 const list=await drive(t,"https://www.googleapis.com/drive/v3/files?q="+q+"&fields=files(id)&pageSize=10");
 const found=await list.json() as {files?:{id:string}[]};if(found.files?.[0])return found.files[0].id;
 const made=await drive(t,"https://www.googleapis.com/drive/v3/files?fields=id",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name,mimeType:"application/vnd.google-apps.folder",parents:[parent]})});
 return ((await made.json()) as {id:string}).id;
}
async function putEvent(t:string,parent:string,e:Event):Promise<void>{
 // Immutable event names make retries idempotent. Never overwrite or remove past backups.
 const name=e.id+".json";
 const q=encodeURIComponent("'"+parent+"' in parents and name='"+name+"' and trashed=false");
 const list=await drive(t,"https://www.googleapis.com/drive/v3/files?q="+q+"&fields=files(id)&pageSize=1");
 if(((await list.json()) as {files?:unknown[]}).files?.length)return;
 const meta={name,parents:[parent],mimeType:"application/json",appProperties:{oricseBackup:"true",sourceEventId:e.id,clinicId:e.clinica_id||"global",table:e.origem_tabela}};
 const data=JSON.stringify({format:"oricse-backup-v1",event_id:e.id,clinic_id:e.clinica_id,table:e.origem_tabela,record_id:e.registro_chave,operation:e.operacao,occurred_at:e.criado_em,data:e.dados});
 const boundary="oricse"+crypto.randomUUID().replaceAll("-","");
 const body="--"+boundary+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"+JSON.stringify(meta)+"\r\n--"+boundary+"\r\nContent-Type: application/json\r\n\r\n"+data+"\r\n--"+boundary+"--";
 await drive(t,"https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",{method:"POST",headers:{"content-type":"multipart/related; boundary="+boundary},body});
}
async function run(env:Env):Promise<void>{
 const events=await rpc<Event[]>(env,"oricse_backup_claim",{p_limit:25});
 if(!events.length)return;
 const t=await token(env);
 const base=await ensureFolder(t,env.ORICSE_DRIVE_ROOT_FOLDER_ID,".oricse-supabase-backups");
 for(const e of events){
  try{
   const clinic=await ensureFolder(t,base,e.clinica_id||"_platform");
   const table=await ensureFolder(t,clinic,e.origem_tabela);
   await putEvent(t,table,e);
   await rpc(env,"oricse_backup_ack",{p_id:e.id,p_success:true,p_error:null});
  }catch(err){
   try{await rpc(env,"oricse_backup_ack",{p_id:e.id,p_success:false,p_error:String(err)});}catch(e2){console.error("Backup ack failed",e.id,String(e2));}
   console.error("Backup pending retry",e.id,String(err));
  }
 }
}
export default {
 async scheduled(_event:ScheduledEvent,env:Env,ctx:ExecutionContext){ctx.waitUntil(run(env));},
 async fetch(_request:Request){return new Response("ORICSE backup worker",{status:200});}
};

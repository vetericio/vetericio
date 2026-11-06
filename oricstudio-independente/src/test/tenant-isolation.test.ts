import {describe,it,expect,vi,beforeEach,afterEach} from "vitest";
import {tenantScopedAdmin,tenantForUser} from "@/lib/server/tenant-admin.server";
const A="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
function fakeAdmin() {
  const operations:any[]=[];
  const api:any={
    from:(table:string)=>{
      const eq=(key:string,value:unknown)=>{operations.push({table,eq:[key,value]});return q;};
      const q:any={
        eq,maybeSingle:async()=>({data:null,error:null}),
        select:(...fields:any[])=>{operations.push({table,select:fields});return q;},
        update:(values:any)=>{operations.push({table,update:values});return q;},
        insert:(values:any)=>{operations.push({table,insert:values});return q;},
        upsert:(values:any)=>{operations.push({table,upsert:values});return q;},
        delete:()=>{operations.push({table,delete:true});return q;},
      };
      return q;
    },
    rpc:(name:string,args:unknown)=>{operations.push({rpc:name,args});return {data:[],error:null};},
  };
  return {api,operations};
}
beforeEach(()=>{
  vi.stubEnv("ORICSTUDIO_INSTANCE_ID","oricstudio");
  vi.stubEnv("SUPABASE_URL","https://oricstudio-teste.example.invalid");
  vi.stubEnv("APP_BASE_URL","https://oricstudio-teste.example.invalid");
});
afterEach(()=>vi.unstubAllEnvs());

describe("limites de clínica no OricStudio",()=>{
  it("adiciona o filtro de clínica às consultas e mutações privilegiadas",()=>{
    const {api,operations}=fakeAdmin();
    const scoped=tenantScopedAdmin(api,A) as any;
    scoped.from("posts").select("id").eq("id","post1");
    scoped.from("posts").update({status:"rascunho"}).eq("id","post1");
    scoped.from("comments").delete().eq("id","comentario1");
    for(const action of ["posts","comments"]){
      expect(operations.filter(op=>op.table===action&&op.eq?.[0]==="clinica_id"))
        .toEqual(expect.arrayContaining([{table:action,eq:["clinica_id",A]}]));
    }
    expect(operations.find(op=>op.update)?.update.clinica_id).toBe(A);
  });
  it("impede inserir ou atualizar registro que declara clínica diferente",()=>{
    const {api}=fakeAdmin();
    const scoped=tenantScopedAdmin(api,A) as any;
    expect(()=>scoped.from("posts").insert({clinica_id:B,id:"p"})).toThrow(/clínicas/);
    expect(()=>scoped.from("brands").upsert({clinica_id:B})).toThrow(/clínicas/);
  });
  it("injeta id da clínica em vários registros e no RPC de publicação",()=>{
    const {api,operations}=fakeAdmin();
    const scoped=tenantScopedAdmin(api,A) as any;
    scoped.from("posts").insert([{id:"p1"},{id:"p2"}]);
    scoped.rpc("claim_due_posts",{_limit:3});
    expect(operations.find(x=>x.insert)?.insert).toEqual([
      {id:"p1",clinica_id:A},{id:"p2",clinica_id:A},
    ]);
    expect(operations.find(x=>x.rpc)?.args).toMatchObject({_clinica_id:A,_limit:3});
  });
  it("bloqueia função SQL não reconhecida e tabela de autorização",()=>{
    const {api}=fakeAdmin();
    const scoped=tenantScopedAdmin(api,A) as any;
    expect(()=>scoped.rpc("verify_jobs_token",{_token:"x"})).toThrow(/RPC sem escopo/);
    expect(()=>scoped.from("user_roles")).toThrow(/autorização/);
  });
  it("rejeita acesso quando a licença é negada mesmo com seleção ativa",async()=>{
    const q:any={eq:()=>q,select:()=>q,maybeSingle:async()=>({data:{clinica_id:A},error:null})};
    const client:any={from:()=>q,rpc:async()=>({data:false,error:null})};
    await expect(tenantForUser({supabase:client,userId:"u"})).rejects.toThrow(/Licença/);
  });
  it("exige papel de administrador da clínica ativa",async()=>{
    let calls=0;
    const selection:any={eq:()=>selection,select:()=>selection,maybeSingle:async()=>{
      calls++; return {data:calls===1?{clinica_id:A}:{papel:"editor",ativo:true},error:null};}};
    const client:any={from:()=>selection,rpc:async()=>({data:true,error:null})};
    await expect(tenantForUser({supabase:client,userId:"u"},"admin")).rejects.toThrow(/administradores/);
  });
});

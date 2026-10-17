import { executarDriveDb } from "@/lib/drive-db.functions";
import { toast } from "sonner";

type TokenProvider=()=>Promise<string|null>;
type Operation="select"|"insert"|"update"|"delete"|"upsert";
type Filter={kind:string;column?:string;value?:unknown;operator?:string};

class DriveQuery implements PromiseLike<any>{
  private operation:Operation="select";
  private payload:unknown;
  private columns="*";
  private filters:Filter[]=[];
  private orders:Array<{column:string;ascending:boolean}>=[];
  private max?:number;
  private faixa?:[number,number];
  private singular:"none"|"single"|"maybeSingle"="none";
  private head=false;
  private count:string|null=null;
  private onConflict?:string;
  private shouldThrow=false;
  constructor(private table:string,private getToken:TokenProvider){}
  select(columns="*",options?:{count?:string;head?:boolean}){this.columns=columns||"*";if(options?.count)this.count=options.count;if(options?.head)this.head=true;return this}
  insert(values:unknown,options?:{count?:string}){this.operation="insert";this.payload=values;if(options?.count)this.count=options.count;return this}
  update(values:unknown,options?:{count?:string}){this.operation="update";this.payload=values;if(options?.count)this.count=options.count;return this}
  delete(options?:{count?:string}){this.operation="delete";if(options?.count)this.count=options.count;return this}
  upsert(values:unknown,options?:{onConflict?:string;count?:string}){this.operation="upsert";this.payload=values;this.onConflict=options?.onConflict;if(options?.count)this.count=options.count;return this}
  eq(column:string,value:unknown){this.filters.push({kind:"eq",column,value});return this}
  neq(column:string,value:unknown){this.filters.push({kind:"neq",column,value});return this}
  gt(column:string,value:unknown){this.filters.push({kind:"gt",column,value});return this}
  gte(column:string,value:unknown){this.filters.push({kind:"gte",column,value});return this}
  lt(column:string,value:unknown){this.filters.push({kind:"lt",column,value});return this}
  lte(column:string,value:unknown){this.filters.push({kind:"lte",column,value});return this}
  like(column:string,value:string){this.filters.push({kind:"like",column,value});return this}
  ilike(column:string,value:string){this.filters.push({kind:"ilike",column,value});return this}
  is(column:string,value:unknown){this.filters.push({kind:"is",column,value});return this}
  in(column:string,values:unknown[]){this.filters.push({kind:"in",column,value:values});return this}
  contains(column:string,value:unknown){this.filters.push({kind:"contains",column,value});return this}
  containedBy(column:string,value:unknown){this.filters.push({kind:"containedBy",column,value});return this}
  match(query:Record<string,unknown>){for(const [column,value] of Object.entries(query||{}))this.eq(column,value);return this}
  filter(column:string,operator:string,value:unknown){const mapa:Record<string,string>={eq:"eq",neq:"neq",gt:"gt",gte:"gte",lt:"lt",lte:"lte",like:"like",ilike:"ilike",is:"is",in:"in",cs:"contains"};this.filters.push({kind:mapa[operator]||operator,column,value,operator});return this}
  not(column:string,operator:string,value:unknown){if(operator==="is"&&value===null)this.filters.push({kind:"neq",column,value:null});else this.filters.push({kind:"not",column,value,operator});return this}
  or(expression:string){this.filters.push({kind:"or",value:expression});return this}
  order(column:string,options?:{ascending?:boolean;nullsFirst?:boolean;foreignTable?:string;referencedTable?:string}){this.orders.push({column,ascending:options?.ascending!==false});return this}
  limit(count:number){this.max=count;return this}
  range(from:number,to:number){this.faixa=[from,to];return this}
  single(){this.singular="single";return this}
  maybeSingle(){this.singular="maybeSingle";return this}
  throwOnError(){this.shouldThrow=true;return this}
  abortSignal(_signal:AbortSignal){return this}
  returns<T>(){return this as unknown as PromiseLike<{data:T;error:any;count?:number|null}>}
  overrideTypes<T>(){return this as unknown as PromiseLike<{data:T;error:any;count?:number|null}>}
  async execute(){try{const accessToken=await this.getToken();const result=await executarDriveDb({data:{accessToken,table:this.table,operation:this.operation,payload:this.payload,columns:this.columns,filters:this.filters,order:this.orders,limit:this.max,range:this.faixa,single:this.singular,head:this.head,count:this.count,onConflict:this.onConflict}} as never) as any;if(this.shouldThrow&&result?.error)throw Object.assign(new Error(result.error.message),result.error);return result}catch(error:any){if(error?.code==="DRIVE_CONFLICT"&&typeof window!=="undefined"){
    toast.error("Conflito de edição",{
      description:"Outro profissional alterou este campo. Recarregue para visualizar a versão mais recente antes de tentar novamente.",
      duration:Infinity,
      action:{label:"Recarregar",onClick:()=>window.location.reload()},
    });
  }
  if(this.shouldThrow)throw error;return{data:null,error:{message:error?.message||String(error),code:error?.code||"DRIVE_DB"},count:null}}}
  then<TResult1=any,TResult2=never>(onfulfilled?:((value:any)=>TResult1|PromiseLike<TResult1>)|null,onrejected?:((reason:any)=>TResult2|PromiseLike<TResult2>)|null):PromiseLike<TResult1|TResult2>{return this.execute().then(onfulfilled,onrejected)}
}

export function createDriveFrom(getToken:TokenProvider){return(table:string)=>new DriveQuery(table,getToken)}

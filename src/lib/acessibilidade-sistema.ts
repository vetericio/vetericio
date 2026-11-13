export const CHAVE_ACESSIBILIDADE="oricse-acessibilidade-pessoal-v1";
export type PreferenciasAcessibilidade = {
  textoAmpliado:boolean;
  contrasteReforcado:boolean;
  focoDestacado:boolean;
  reduzirMovimento:boolean;
};
export const PADRAO_ACESSIBILIDADE:PreferenciasAcessibilidade={
  textoAmpliado:false,contrasteReforcado:false,focoDestacado:false,reduzirMovimento:false,
};
const CLASSES:Record<keyof PreferenciasAcessibilidade,string>={
  textoAmpliado:"oricse-a11y-texto",
  contrasteReforcado:"oricse-a11y-contraste",
  focoDestacado:"oricse-a11y-foco",
  reduzirMovimento:"oricse-a11y-movimento",
};
export function lerAcessibilidade():PreferenciasAcessibilidade{
  if(typeof window==="undefined")return {...PADRAO_ACESSIBILIDADE};
  try{
    const bruto=window.localStorage.getItem(CHAVE_ACESSIBILIDADE);
    if(!bruto)return {...PADRAO_ACESSIBILIDADE};
    const dados=JSON.parse(bruto) as Record<string,unknown>;
    return Object.fromEntries(Object.keys(CLASSES).map(k=>[k,dados?.[k]===true])) as PreferenciasAcessibilidade;
  }catch{return {...PADRAO_ACESSIBILIDADE};}
}
export function aplicarAcessibilidade(permitir:boolean){
  if(typeof document==="undefined")return;
  const dados=lerAcessibilidade();
  for(const [chave,classe] of Object.entries(CLASSES)){
    document.documentElement.classList.toggle(classe,permitir&&dados[chave as keyof PreferenciasAcessibilidade]);
  }
}
export function salvarAcessibilidade(dados:PreferenciasAcessibilidade){
  if(typeof window==="undefined")return;
  window.localStorage.setItem(CHAVE_ACESSIBILIDADE,JSON.stringify(dados));
  aplicarAcessibilidade(true);
}

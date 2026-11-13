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
let preferenciasDaSessao:PreferenciasAcessibilidade={...PADRAO_ACESSIBILIDADE};
export function lerAcessibilidade():PreferenciasAcessibilidade{
  return {...preferenciasDaSessao};
}
export function aplicarAcessibilidade(permitir:boolean){
  if(typeof document==="undefined")return;
  const dados=lerAcessibilidade();
  for(const [chave,classe] of Object.entries(CLASSES)){
    document.documentElement.classList.toggle(classe,permitir&&dados[chave as keyof PreferenciasAcessibilidade]);
  }
}
export function salvarAcessibilidade(dados:PreferenciasAcessibilidade){
  preferenciasDaSessao={...dados};
  aplicarAcessibilidade(true);
}

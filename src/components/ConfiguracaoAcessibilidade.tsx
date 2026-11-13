import { useEffect, useState } from "react";
import { Eye, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { lerAcessibilidade, salvarAcessibilidade, PADRAO_ACESSIBILIDADE, type PreferenciasAcessibilidade } from "@/lib/acessibilidade-sistema";

const OPCOES:Array<[keyof PreferenciasAcessibilidade,string,string]>=[
  ["textoAmpliado","Texto levemente ampliado","Melhora a leitura dos controles sem alterar as fontes dos documentos impressos."],
  ["contrasteReforcado","Contraste reforçado","Destaca bordas e textos auxiliares nas telas internas."],
  ["focoDestacado","Foco visível no teclado","Realça o elemento selecionado por Tab e pelos atalhos de teclado."],
  ["reduzirMovimento","Reduzir animações","Diminui transições e efeitos de movimento nas telas internas."],
];
export function ConfiguracaoAcessibilidade(){
  const [valor,setValor]=useState<PreferenciasAcessibilidade>({...PADRAO_ACESSIBILIDADE});
  useEffect(()=>{setValor(lerAcessibilidade());},[]);
  function mudar(k:keyof PreferenciasAcessibilidade,selecionado:boolean){
    const proximo={...valor,[k]:selecionado};
    try{salvarAcessibilidade(proximo);setValor(proximo);}
    catch{toast.error("Este navegador não permitiu salvar sua preferência.");}
  }
  function restaurar(){
    if(!window.confirm("Restaurar as preferências visuais deste navegador?"))return;
    try{salvarAcessibilidade({...PADRAO_ACESSIBILIDADE});setValor({...PADRAO_ACESSIBILIDADE});toast.success("Preferências restauradas.");}
    catch{toast.error("Não foi possível restaurar as preferências.");}
  }
  return <section className="mt-5 rounded-xl border bg-background p-4 sm:p-5">
    <div className="mb-3 flex items-center gap-2"><Eye size={18} className="text-primary"/><div>
      <h3 className="text-sm font-semibold">Leitura e acessibilidade</h3>
      <p className="mt-1 text-xs text-muted-foreground">Preferências pessoais temporárias, aplicadas imediatamente nas áreas internas. Não mudam o site público ou o tema da clínica.</p>
    </div></div>
    <div className="grid gap-2 sm:grid-cols-2">{OPCOES.map(([chave,nome,descricao])=><label key={chave} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
      <input type="checkbox" checked={valor[chave]} onChange={e=>mudar(chave,e.target.checked)} className="mt-1 h-4 w-4 accent-primary"/>
      <span><span className="block text-sm font-semibold">{nome}</span><span className="mt-1 block text-xs text-muted-foreground">{descricao}</span></span>
    </label>)}</div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
      <p className="text-xs text-muted-foreground">Aplicação imediata nesta sessão. Por segurança, não persistem após recarregar o aplicativo.</p>
      <button type="button" onClick={restaurar} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold"><RotateCcw size={15}/> Restaurar padrões</button>
    </div>
  </section>;
}

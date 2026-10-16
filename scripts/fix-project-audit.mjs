import fs from 'node:fs';

function patch(path, edits) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [from, to, label] of edits) {
    if (!s.includes(from)) throw new Error(`${path}: trecho não encontrado (${label})`);
    s = s.replace(from, to);
  }
  fs.writeFileSync(path, s);
}

patch('src/routes/index.tsx', [[
  '<a href="#" aria-label={`${marca} — início`} className="flex min-h-11 items-center">\n          <img src="/oricse-logo-full.svg" alt="Oricse — sistema veterinário e petshop" className="h-36 w-auto max-w-[300px] object-contain object-left sm:h-44 sm:max-w-[360px]" />\n        </a>',
  '<Link to="/" aria-label={`${marca} — início`} className="flex min-h-11 items-center">\n          <img src="/oricse-logo-full.svg" alt="Oricse — sistema veterinário e petshop" className="h-36 w-auto max-w-[300px] object-contain object-left sm:h-44 sm:max-w-[360px]" />\n        </Link>',
  'logo da home'
]]);

patch('src/routes/admin-conteudo.tsx', [[
  '<button className="mt-4 min-h-9 rounded-lg bg-primary px-3 text-xs font-bold text-white">{index === 0 ? (cfg.teste_gratis_botao || "Começar 7 dias grátis") : cfg.cta_plano}</button>',
  '<div aria-disabled="true" className="mt-4 flex min-h-9 cursor-default items-center justify-center rounded-lg bg-primary px-3 text-xs font-bold text-white">{index === 0 ? (cfg.teste_gratis_botao || "Começar 7 dias grátis") : cfg.cta_plano}</div>',
  'CTA da prévia do admin'
]]);

{
  const path = 'src/routes/estoque.tsx';
  let s = fs.readFileSync(path, 'utf8');
  const from = '<button className="inline-flex h-10 items-center justify-center gap-1 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"><Plus size={15} /> Salvar</button>';
  const to = '<button type="submit" className="inline-flex h-10 items-center justify-center gap-1 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"><Plus size={15} /> Salvar</button>';
  const count = s.split(from).length - 1;
  if (count !== 2) throw new Error(`${path}: esperava 2 botões Salvar, encontrei ${count}`);
  s = s.split(from).join(to);
  fs.writeFileSync(path, s);
}

patch('src/routes/financeiro.tsx', [[
  '<button className="mt-5 w-full rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground">\n              {editandoId ? "Salvar alterações" : "Salvar lançamento"}\n            </button>',
  '<button type="submit" className="mt-5 w-full rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground">\n              {editandoId ? "Salvar alterações" : "Salvar lançamento"}\n            </button>',
  'submit financeiro'
]]);

patch('src/components/agenda/AgendaDayBoard.tsx', [[
  'if(!evento)return <button key={hora} onClick={()=>abrirHorario(agenda,hora)} className="flex min-h-9 w-full items-center gap-2 rounded-lg border border-dashed bg-white px-2.5 text-left text-[11px] hover:bg-secondary/40">',
  'if(!evento)return <button key={hora} type="button" data-oricse-agendar-livre="true" onClick={()=>abrirHorario(agenda,hora)} className="flex min-h-9 w-full items-center gap-2 rounded-lg border border-dashed bg-white px-2.5 text-left text-[11px] hover:bg-secondary/40">',
  'slot livre da agenda'
]]);

patch('src/routes/recepcao.tsx', [
  [
    'import { useEffect, useMemo, useRef, useState } from "react";\nimport { AgendaDayBoard } from "@/components/agenda/AgendaDayBoard";',
    'import { useEffect, useMemo, useRef, useState } from "react";\nimport { toast } from "sonner";\nimport { AgendaDayBoard } from "@/components/agenda/AgendaDayBoard";',
    'import toast'
  ],
  [
    '<div className="flex flex-wrap gap-2"><a href="/comandas?origem=Recepção" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/20 bg-white px-4 font-semibold text-primary shadow-sm transition hover:bg-primary/5"><ReceiptText size={17}/> Abrir comanda</a><button type="button" className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground">+ Novo agendamento</button></div>',
    '<div className="flex flex-wrap gap-2"><a href="/comandas?origem=Recepção" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/20 bg-white px-4 font-semibold text-primary shadow-sm transition hover:bg-primary/5"><ReceiptText size={17}/> Abrir comanda</a><button type="button" onClick={() => { const livre = document.querySelector<HTMLButtonElement>(\'[data-oricse-agendar-livre="true"]\'); if (livre) { livre.click(); livre.scrollIntoView({ behavior: "smooth", block: "center" }); } else { document.getElementById("agenda-recepcao")?.scrollIntoView({ behavior: "smooth", block: "start" }); toast.info("Não há horário livre visível nesta data. Escolha outra data ou agenda."); } }} className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground">+ Novo agendamento</button></div>',
    'novo agendamento'
  ],
  [
    '<section className="min-w-0 rounded-2xl border-2 border-primary/15 bg-primary/[0.015] p-2 sm:p-3">',
    '<section id="agenda-recepcao" className="min-w-0 scroll-mt-4 rounded-2xl border-2 border-primary/15 bg-primary/[0.015] p-2 sm:p-3">',
    'âncora agenda'
  ],
  [
    'return destino ? <Link key={titulo} to={destino} className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md">{conteudo}</Link> : <button key={titulo} type="button" className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md">{conteudo}</button>;',
    'return destino ? <Link key={titulo} to={destino} className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md">{conteudo}</Link> : <div key={titulo} aria-disabled="true" className="rounded-2xl border bg-card p-4 text-left opacity-70 shadow-sm">{conteudo}</div>;',
    'fallback card'
  ]
]);

console.log('Correções da auditoria aplicadas.');

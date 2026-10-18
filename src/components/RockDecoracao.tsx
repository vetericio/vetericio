/** Elementos de palco exclusivamente visuais, sempre atrás dos controles. */
export function RockDecoracao() {
  return <div className="rock-decoracao" aria-hidden="true">
    <img className="rock-equipamento rock-equipamento--esquerdo" src="/temas/rock-guitarra-amplificador.webp" alt="" />
    <img className="rock-equipamento rock-equipamento--direito" src="/temas/rock-guitarra-amplificador.webp" alt="" />
  </div>;
}

/** Camadas apenas visuais do tema Natal Vivo. Nunca recebem foco ou clique. */
export function NatalVivoDecoracao() {
  return (
    <div className="natal-vivo-decoracao" aria-hidden="true">
      <img className="natal-vivo-guirlanda natal-vivo-guirlanda--topo" src="/natal/guirlanda-superior.webp" alt="" />
      <img className="natal-vivo-guirlanda natal-vivo-guirlanda--esquerda" src="/natal/guirlanda-superior.webp" alt="" />
      <img className="natal-vivo-guirlanda natal-vivo-guirlanda--direita" src="/natal/guirlanda-superior.webp" alt="" />
      <img className="natal-vivo-canto natal-vivo-canto--esquerdo" src="/natal/canto-lanterna-presentes.webp" alt="" />
      <img className="natal-vivo-canto natal-vivo-canto--direito" src="/natal/canto-lanterna-presentes.webp" alt="" />
      <div className="natal-vivo-luzes natal-vivo-luzes--topo" />
      <div className="natal-vivo-luzes natal-vivo-luzes--lateral" />
    </div>
  );
}

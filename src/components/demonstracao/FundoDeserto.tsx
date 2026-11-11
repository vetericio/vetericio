/** Fundo exclusivo desta página: pôr do sol em dunas, SEM órix e SEM imagem externa. */
export function FundoDeserto() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(120deg,#fff2e6 0%,#f9d7c9 26%,#edb8b6 58%,#dca2ad 100%)" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 78%,rgba(255,228,137,.94) 0%,rgba(255,184,110,.53) 30%,rgba(255,190,112,0) 63%)" }} />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="oricse-demo-sol"><stop offset="0" stopColor="#fffbe4"/><stop offset=".25" stopColor="#fff0aa"/><stop offset="1" stopColor="#ffda82" stopOpacity="0"/></radialGradient>
          <linearGradient id="oricse-demo-areia" x1="0" x2=".35" y1="0" y2="1"><stop offset="0" stopColor="#ffd27b"/><stop offset=".4" stopColor="#f2a04d"/><stop offset="1" stopColor="#b85d31"/></linearGradient>
          <linearGradient id="oricse-demo-frente" x1="0" x2=".4" y1="0" y2="1"><stop offset="0" stopColor="#f9bb58"/><stop offset=".6" stopColor="#e68637"/><stop offset="1" stopColor="#b56331"/></linearGradient>
        </defs>
        <ellipse cx="520" cy="840" rx="460" ry="310" fill="url(#oricse-demo-sol)"/>
        <circle cx="520" cy="859" r="18" fill="#fff8dc"/>
        <path d="M0 833 C190 805 343 856 535 824 C760 787 940 830 1142 806 C1344 780 1470 799 1600 780 L1600 1000 L0 1000Z" fill="#f0a968" opacity=".45"/>
        <path d="M0 893 C225 870 331 911 540 883 C785 847 1007 891 1218 850 C1400 823 1510 856 1600 842 L1600 1000 L0 1000Z" fill="#e7a057" opacity=".7"/>
        <path d="M0 948 C192 920 350 952 545 929 C774 900 1009 950 1250 919 C1440 893 1535 911 1600 911 L1600 1000 L0 1000Z" fill="url(#oricse-demo-areia)"/>
        <path d="M0 978 C210 944 393 993 595 959 C829 929 1145 952 1325 936 C1450 925 1525 937 1600 930 L1600 1000 L0 1000Z" fill="url(#oricse-demo-frente)"/>
        <path d="M0 977 C203 944 396 989 595 957 C826 927 1150 953 1325 935 C1460 922 1528 939 1600 927" fill="none" stroke="#ffe49a" strokeWidth="2.5" opacity=".7"/>
      </svg>
    </div>
  );
}

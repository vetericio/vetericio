export function FundoDeserto() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,#6F293B 0%,#A8475A 28%,#E08A6A 52%,#F2B77C 66%,#F4EBDD 100%)" }} />
      <div className="absolute left-1/2 top-[54%] h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(circle,#FFE6B8 0%,#F6C27E 45%,rgba(246,194,126,0) 72%)" }} />
      <svg className="absolute bottom-0 left-0 h-[46%] w-full" viewBox="0 0 1440 400" preserveAspectRatio="none">
        <path d="M0 170 C220 110 380 200 620 150 C860 100 1080 190 1440 130 L1440 400 L0 400Z" fill="#D9925F" opacity=".75" />
        <path d="M0 250 C260 180 470 280 760 220 C1020 170 1220 250 1440 210 L1440 400 L0 400Z" fill="#C59A5C" opacity=".85" />
        <path d="M0 320 C300 270 560 350 860 300 C1100 262 1290 320 1440 300 L1440 400 L0 400Z" fill="#E9CFA6" />
      </svg>
    </div>
  );
}

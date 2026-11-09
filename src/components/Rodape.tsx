import { Backup } from "@/components/Backup";
import { PortalFooter } from "@/components/PortalFooter";

export function Rodape() {
  return (
    <>
      <div className="mx-auto w-full max-w-5xl px-4">
        <Backup mostrarBotao={false} />
      </div>
      <PortalFooter />
    </>
  );
}

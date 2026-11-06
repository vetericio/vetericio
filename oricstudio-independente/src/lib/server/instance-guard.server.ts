// Trava de segurança para a cópia independente do OricStudio.
// Este módulo não consulta nem usa o aplicativo Gestor Instagram 2.0.
export function assertIndependentOricStudio(): void {
  if (process.env['ORICSTUDIO_INSTANCE_ID'] !== 'oricstudio') {
    throw new Error('Instância OricStudio não configurada. Configure ORICSTUDIO_INSTANCE_ID=oricstudio no servidor.');
  }
  const supabaseUrl = process.env['SUPABASE_URL'] || '';
  if (!supabaseUrl || supabaseUrl.includes('ytuhblegzqppcwqkdovg')) {
    throw new Error('O OricStudio exige um projeto Supabase próprio, diferente do Gestor Instagram 2.0.');
  }
  const baseUrl = process.env['APP_BASE_URL'] || '';
  if (!baseUrl || baseUrl.includes('gestor-insta-vetericio.lovable.app')) {
    throw new Error('O OricStudio precisa de URL de aplicação própria, sem apontar ao Gestor 2.0.');
  }
}

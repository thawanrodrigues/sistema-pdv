// ============================================================
// Validações de campos para o Sistema PDV
// ============================================================

/** Valida e-mail com regex padrão */
export function validarEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/** Valida CNPJ com dígitos verificadores */
export function validarCNPJ(cnpj: string): boolean {
  const numeros = cnpj.replace(/\D/g, '');
  if (numeros.length !== 14) return false;
  if (/^(\d)\1+$/.test(numeros)) return false; // todos iguais

  const calc = (arr: number[], pesos: number[]) =>
    arr.reduce((acc, n, i) => acc + n * pesos[i], 0);

  const d = numeros.split('').map(Number);
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const r1 = calc(d.slice(0, 12), p1) % 11;
  const v1 = r1 < 2 ? 0 : 11 - r1;
  if (d[12] !== v1) return false;

  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const r2 = calc(d.slice(0, 13), p2) % 11;
  const v2 = r2 < 2 ? 0 : 11 - r2;
  return d[13] === v2;
}

/** Formata CNPJ enquanto o usuário digita */
export function formatarCNPJ(valor: string): string {
  const n = valor.replace(/\D/g, '').slice(0, 14);
  return n
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/** Formata telefone enquanto o usuário digita */
export function formatarTelefone(valor: string): string {
  const n = valor.replace(/\D/g, '').slice(0, 11);
  if (n.length <= 10) {
    return n
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return n
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

/** Valida nome de usuário: mínimo 3 chars, sem espaços, letras/números/ponto */
export function validarUsuario(usuario: string): { ok: boolean; msg: string } {
  const u = usuario.trim();
  if (u.length < 3) return { ok: false, msg: 'Mínimo 3 caracteres.' };
  if (/\s/.test(u)) return { ok: false, msg: 'Sem espaços permitidos.' };
  if (!/^[a-zA-Z0-9._]+$/.test(u))
    return { ok: false, msg: 'Apenas letras, números, ponto e underscore.' };
  return { ok: true, msg: '' };
}

/** Valida senha: mínimo 6 caracteres */
export function validarSenha(senha: string): { ok: boolean; msg: string } {
  if (senha.length < 6) return { ok: false, msg: 'Mínimo 6 caracteres.' };
  return { ok: true, msg: '' };
}

/** Valida preço: número positivo */
export function validarPreco(valor: string): boolean {
  const n = parseFloat(valor.replace(',', '.'));
  return !isNaN(n) && n > 0;
}

/** Valida estoque: número >= 0 */
export function validarEstoque(valor: string): boolean {
  const n = parseFloat(valor.replace(',', '.'));
  return !isNaN(n) && n >= 0;
}

/** Normaliza string para busca (remove acentos, lowercase) */
export function normalizar(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/** Formata moeda BRL */
export function formatMoney(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

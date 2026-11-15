// ============================================================
// Repository de Autenticação e Usuários
// ============================================================
import { getDB } from './db';
import { hashSenha, verificarSenha } from '../utils/crypto';

export type Perfil = 'admin' | 'funcionario';

export type Usuario = {
  id: number;
  nome: string;
  usuario: string;
  email: string;
  perfil: Perfil;
  ativo: number;
  criadoEm: string;
};

/** Busca um usuário pelo login e valida a senha */
export async function autenticar(
  usuario: string,
  senha: string
): Promise<Usuario | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<{
    id: number;
    nome: string;
    usuario: string;
    email: string;
    senha_hash: string;
    perfil: string;
    ativo: number;
    criado_em: string;
  }>(
    'SELECT * FROM usuarios WHERE usuario = ? COLLATE NOCASE AND ativo = 1',
    [usuario.trim()]
  );

  if (!row) return null;

  const senhaOk = await verificarSenha(senha, row.senha_hash);
  if (!senhaOk) return null;

  return {
    id: row.id,
    nome: row.nome,
    usuario: row.usuario,
    email: row.email,
    perfil: row.perfil as Perfil,
    ativo: row.ativo,
    criadoEm: row.criado_em,
  };
}

/** Lista todos os funcionários (exceto o admin principal id=1) */
export async function listarFuncionarios(): Promise<Usuario[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<{
    id: number;
    nome: string;
    usuario: string;
    email: string;
    perfil: string;
    ativo: number;
    criado_em: string;
  }>('SELECT id, nome, usuario, email, perfil, ativo, criado_em FROM usuarios ORDER BY nome');

  return rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    usuario: r.usuario,
    email: r.email,
    perfil: r.perfil as Perfil,
    ativo: r.ativo,
    criadoEm: r.criado_em,
  }));
}

/** Cria um novo usuário */
export async function criarUsuario(params: {
  nome: string;
  usuario: string;
  email?: string;
  senha: string;
  perfil: Perfil;
}): Promise<{ ok: boolean; msg: string }> {
  try {
    const db = await getDB();

    // Verificar se usuário já existe
    const existe = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM usuarios WHERE usuario = ? COLLATE NOCASE',
      [params.usuario.trim()]
    );
    if (existe) return { ok: false, msg: `Usuário "${params.usuario}" já existe.` };

    const hash = await hashSenha(params.senha);
    await db.runAsync(
      `INSERT INTO usuarios (nome, usuario, email, senha_hash, perfil)
       VALUES (?, ?, ?, ?, ?)`,
      [
        params.nome.trim(),
        params.usuario.trim().toLowerCase(),
        (params.email || '').trim(),
        hash,
        params.perfil,
      ]
    );
    return { ok: true, msg: 'Usuário criado com sucesso.' };
  } catch (e: any) {
    return { ok: false, msg: e.message || 'Erro ao criar usuário.' };
  }
}

/** Ativa ou desativa um usuário */
export async function toggleUsuario(id: number, ativo: boolean): Promise<void> {
  const db = await getDB();
  await db.runAsync('UPDATE usuarios SET ativo = ? WHERE id = ?', [ativo ? 1 : 0, id]);
}

/** Remove um usuário definitivamente */
export async function removerUsuario(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM usuarios WHERE id = ?', [id]);
}

/** Altera a senha de um usuário */
export async function alterarSenha(id: number, novaSenha: string): Promise<void> {
  const db = await getDB();
  const hash = await hashSenha(novaSenha);
  await db.runAsync('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [hash, id]);
}

/** Cria usuário admin + empresa no primeiro acesso (registro) */
export async function primeiroAcesso(params: {
  nomeEmpresa: string;
  cnpj: string;
  telefone?: string;
  endereco?: string;
  nome: string;
  usuario: string;
  email: string;
  senha: string;
}): Promise<{ ok: boolean; msg: string }> {
  try {
    const db = await getDB();

    // Verificar se já existe um admin
    const admins = await db.getFirstAsync<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM usuarios WHERE perfil = ?',
      ['admin']
    );

    // Salvar empresa
    await db.runAsync(
      `UPDATE empresa SET
         razao_social = ?,
         cnpj = ?,
         telefone = ?,
         endereco = ?
       WHERE id = 1`,
      [
        params.nomeEmpresa.trim(),
        params.cnpj.trim(),
        (params.telefone || '').trim(),
        (params.endereco || '').trim(),
      ]
    );

    // Criar usuário admin (substituir o padrão se necessário)
    const hash = await hashSenha(params.senha);
    const usuarioExiste = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM usuarios WHERE usuario = ? COLLATE NOCASE',
      [params.usuario.trim()]
    );

    if (usuarioExiste) {
      await db.runAsync(
        `UPDATE usuarios SET nome = ?, email = ?, senha_hash = ?, perfil = 'admin'
         WHERE id = ?`,
        [params.nome.trim(), params.email.trim(), hash, usuarioExiste.id]
      );
    } else {
      await db.runAsync(
        `INSERT INTO usuarios (nome, usuario, email, senha_hash, perfil)
         VALUES (?, ?, ?, ?, 'admin')`,
        [
          params.nome.trim(),
          params.usuario.trim().toLowerCase(),
          params.email.trim(),
          hash,
        ]
      );
    }

    return { ok: true, msg: 'Empresa cadastrada com sucesso!' };
  } catch (e: any) {
    return { ok: false, msg: e.message || 'Erro ao cadastrar empresa.' };
  }
}

/** Busca dados da empresa */
export async function getEmpresa() {
  const db = await getDB();
  return db.getFirstAsync<{
    id: number;
    razao_social: string;
    cnpj: string;
    telefone: string;
    endereco: string;
    pix_chave: string;
    pix_titular: string;
    api_provedor: string;
    api_token: string;
    api_secret: string;
  }>('SELECT * FROM empresa WHERE id = 1');
}

/** Atualiza dados da empresa */
export async function salvarEmpresa(params: {
  razaoSocial: string;
  cnpj: string;
  telefone: string;
  endereco: string;
  pixChave: string;
  pixTitular: string;
  apiProvedor: string;
  apiToken: string;
  apiSecret: string;
}): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE empresa SET
       razao_social = ?, cnpj = ?, telefone = ?, endereco = ?,
       pix_chave = ?, pix_titular = ?,
       api_provedor = ?, api_token = ?, api_secret = ?
     WHERE id = 1`,
    [
      params.razaoSocial, params.cnpj, params.telefone, params.endereco,
      params.pixChave, params.pixTitular,
      params.apiProvedor, params.apiToken, params.apiSecret,
    ]
  );
}

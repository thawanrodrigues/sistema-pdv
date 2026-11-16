// ============================================================
// Repository de Autenticação e Usuários - Multi-Tenant PostgreSQL
// ============================================================
import { getDB } from './db';
import { hashSenha, verificarSenha } from '../utils/crypto';
import { requestApi, setToken, setSavedUser } from '../services/api';

export type Perfil = 'admin' | 'funcionario';

export type Usuario = {
  id: number;
  nome: string;
  usuario: string;
  email: string;
  perfil: Perfil;
  ativo: number;
  criadoEm: string;
  empresaId?: number;
  nomeEmpresa?: string;
};

/** Busca um usuário pelo login e valida a senha */
export async function autenticar(
  usuario: string,
  senha: string
): Promise<Usuario | null> {
  const usuarioTrim = usuario.trim();

  // 1. Tentar autenticação no Backend PostgreSQL Multi-Tenant
  const apiRes = await requestApi<{ ok: boolean; token: string; user: any }>('/auth/login', {
    method: 'POST',
    body: { usuario: usuarioTrim, senha },
  });

  if (apiRes.ok && apiRes.data?.user) {
    const u = apiRes.data.user;
    setToken(apiRes.data.token);
    setSavedUser(u);
    return {
      id: u.id,
      nome: u.nome,
      usuario: u.usuario,
      email: u.email || '',
      perfil: u.perfil as Perfil,
      ativo: u.ativo !== undefined ? Number(u.ativo) : 1,
      criadoEm: u.criadoEm || '',
      empresaId: u.empresaId,
      nomeEmpresa: u.nomeEmpresa,
    };
  }

  // Se o servidor respondeu com erro de validação (ex: senha incorreta ou usuário desativado)
  if (apiRes.status === 401 || apiRes.status === 403) {
    throw new Error(apiRes.erro || 'Usuário ou senha incorretos.');
  }

  // 2. Fallback local (SQLite / localStorage) caso offline
  try {
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
      'SELECT * FROM usuarios WHERE usuario = ? COLLATE NOCASE',
      [usuarioTrim]
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
      ativo: row.ativo === undefined ? 1 : Number(row.ativo),
      criadoEm: row.criado_em,
    };
  } catch {
    return null;
  }
}

/** Lista todos os funcionários */
export async function listarFuncionarios(): Promise<Usuario[]> {
  // 1. Tentar buscar do Backend PostgreSQL Multi-Tenant
  const apiRes = await requestApi<any[]>('/usuarios');
  if (apiRes.ok && Array.isArray(apiRes.data)) {
    return apiRes.data.map((r) => ({
      id: r.id,
      nome: r.nome,
      usuario: r.usuario,
      email: r.email || '',
      perfil: r.perfil as Perfil,
      ativo: r.ativo ? 1 : 0,
      criadoEm: r.criadoEm || '',
    }));
  }

  // Fallback local
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
    ativo: r.ativo === undefined ? 1 : Number(r.ativo),
    criadoEm: r.criado_em,
  }));
}

/** Cria um novo usuário colaborador */
export async function criarUsuario(params: {
  nome: string;
  usuario: string;
  email?: string;
  senha: string;
  perfil: Perfil;
}): Promise<{ ok: boolean; msg: string }> {
  try {
    // 1. Tentar criar no Backend PostgreSQL Multi-Tenant
    const apiRes = await requestApi('/usuarios', {
      method: 'POST',
      body: params,
    });

    if (apiRes.ok) {
      return { ok: true, msg: 'Colaborador cadastrado com sucesso!' };
    } else if (apiRes.status > 0) {
      return { ok: false, msg: apiRes.erro || 'Erro ao criar colaborador.' };
    }

    // Fallback local
    const db = await getDB();
    const hash = await hashSenha(params.senha);
    await db.runAsync(
      `INSERT INTO usuarios (nome, usuario, email, senha_hash, perfil, ativo)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [
        params.nome.trim(),
        params.usuario.trim().toLowerCase(),
        params.email?.trim() || '',
        hash,
        params.perfil,
      ]
    );

    return { ok: true, msg: 'Colaborador cadastrado com sucesso!' };
  } catch (e: any) {
    return { ok: false, msg: e.message || 'Erro ao criar colaborador.' };
  }
}

/** Atualiza um usuário */
export async function atualizarUsuario(params: {
  id: number;
  nome: string;
  email?: string;
  perfil: Perfil;
  ativo?: number;
  senha?: string;
}): Promise<{ ok: boolean; msg: string }> {
  try {
    const apiRes = await requestApi(`/usuarios/${params.id}`, {
      method: 'PUT',
      body: params,
    });
    if (apiRes.ok) {
      return { ok: true, msg: 'Colaborador atualizado com sucesso!' };
    }

    const db = await getDB();
    if (params.senha && params.senha.trim()) {
      const hash = await hashSenha(params.senha);
      await db.runAsync(
        'UPDATE usuarios SET nome = ?, email = ?, perfil = ?, senha_hash = ? WHERE id = ?',
        [params.nome.trim(), params.email?.trim() || '', params.perfil, hash, params.id]
      );
    } else {
      await db.runAsync(
        'UPDATE usuarios SET nome = ?, email = ?, perfil = ? WHERE id = ?',
        [params.nome.trim(), params.email?.trim() || '', params.perfil, params.id]
      );
    }
    return { ok: true, msg: 'Colaborador atualizado com sucesso!' };
  } catch (e: any) {
    return { ok: false, msg: e.message || 'Erro ao atualizar colaborador.' };
  }
}

/** Desativa um colaborador */
export async function desativarUsuario(id: number): Promise<{ ok: boolean; msg: string }> {
  try {
    await requestApi(`/usuarios/${id}`, { method: 'DELETE' });
    const db = await getDB();
    await db.runAsync('UPDATE usuarios SET ativo = 0 WHERE id = ?', [id]);
    return { ok: true, msg: 'Colaborador desativado.' };
  } catch (e: any) {
    return { ok: false, msg: e.message || 'Erro ao desativar colaborador.' };
  }
}

export async function toggleUsuario(id: number, ativoAtual: number): Promise<void> {
  const novoAtivo = ativoAtual === 1 ? 0 : 1;
  const db = await getDB();
  const u = await db.getFirstAsync<any>('SELECT nome, email, perfil FROM usuarios WHERE id = ?', [id]);
  await atualizarUsuario({
    id,
    nome: u?.nome || '',
    email: u?.email || '',
    perfil: (u?.perfil || 'funcionario') as Perfil,
    ativo: novoAtivo,
  });
}

export async function removerUsuario(id: number): Promise<void> {
  await desativarUsuario(id);
}

/** Cria usuário admin + empresa no primeiro acesso (registro SaaS) */
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
    // 1. Chamar o endpoint SaaS PostgreSQL
    const apiRes = await requestApi<{ ok: boolean; token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: params,
    });

    if (apiRes.ok && apiRes.data?.user) {
      setToken(apiRes.data.token);
      setSavedUser(apiRes.data.user);
    } else if (apiRes.status > 0) {
      return { ok: false, msg: apiRes.erro || 'Erro ao cadastrar empresa no servidor.' };
    }

    // 2. Salvar também no banco local (offline support)
    try {
      const db = await getDB();
      await db.runAsync(
        `UPDATE empresa SET razao_social = ?, cnpj = ?, telefone = ?, endereco = ? WHERE id = 1`,
        [params.nomeEmpresa.trim(), params.cnpj.trim(), (params.telefone || '').trim(), (params.endereco || '').trim()]
      );

      const hash = await hashSenha(params.senha);
      const usuarioExiste = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM usuarios WHERE usuario = ? COLLATE NOCASE',
        [params.usuario.trim()]
      );

      if (usuarioExiste) {
        await db.runAsync(
          `UPDATE usuarios SET nome = ?, email = ?, senha_hash = ?, perfil = 'admin', ativo = 1 WHERE id = ?`,
          [params.nome.trim(), params.email.trim(), hash, usuarioExiste.id]
        );
      } else {
        await db.runAsync(
          `INSERT INTO usuarios (nome, usuario, email, senha_hash, perfil, ativo) VALUES (?, ?, ?, ?, 'admin', 1)`,
          [params.nome.trim(), params.usuario.trim().toLowerCase(), params.email.trim(), hash]
        );
      }
    } catch {}

    return { ok: true, msg: 'Empresa cadastrada com sucesso!' };
  } catch (e: any) {
    return { ok: false, msg: e.message || 'Erro ao cadastrar empresa.' };
  }
}

/** Busca dados da empresa */
export async function getEmpresa() {
  const apiRes = await requestApi('/empresa');
  if (apiRes.ok && apiRes.data) {
    return {
      id: apiRes.data.id,
      razao_social: apiRes.data.razaoSocial || '',
      cnpj: apiRes.data.cnpj || '',
      telefone: apiRes.data.telefone || '',
      endereco: apiRes.data.endereco || '',
      pix_chave: apiRes.data.pixChave || '',
      pix_titular: apiRes.data.pixTitular || '',
      api_provedor: '',
      api_token: '',
      api_secret: '',
    };
  }

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
  telefone?: string;
  endereco?: string;
  pixChave?: string;
  pixTitular?: string;
}): Promise<void> {
  await requestApi('/empresa', {
    method: 'PUT',
    body: params,
  });

  const db = await getDB();
  await db.runAsync(
    `UPDATE empresa SET
       razao_social = ?,
       cnpj = ?,
       telefone = ?,
       endereco = ?,
       pix_chave = ?,
       pix_titular = ?
     WHERE id = 1`,
    [
      params.razaoSocial.trim(),
      params.cnpj.trim(),
      (params.telefone || '').trim(),
      (params.endereco || '').trim(),
      (params.pixChave || '').trim(),
      (params.pixTitular || '').trim(),
    ]
  );
}

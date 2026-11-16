import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../config/database.js';
import { generateToken, authMiddleware } from '../middlewares/authMiddleware.js';

export const authRouter = Router();

/**
 * 1. Cadastro de Nova Empresa (Tenant SaaS) + Usuário Administrador
 */
authRouter.post('/register', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const {
      nomeEmpresa,
      cnpj,
      telefone,
      endereco,
      nome,
      usuario,
      email,
      senha,
    } = req.body;

    if (!nomeEmpresa || !nome || !usuario || !senha) {
      res.status(400).json({ erro: 'Nome da empresa, nome completo, usuário e senha são obrigatórios.' });
      return;
    }

    const usuarioClean = usuario.trim().toLowerCase();

    await client.query('BEGIN');

    // Verificar se CNPJ já existe (se informado)
    if (cnpj && cnpj.trim()) {
      const cnpjExist = await client.query('SELECT id FROM empresas WHERE cnpj = $1', [cnpj.trim()]);
      if (cnpjExist.rows.length > 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ erro: 'Este CNPJ já está cadastrado em outra empresa.' });
        return;
      }
    }

    // Criar a Empresa (Tenant)
    const empResult = await client.query(
      `INSERT INTO empresas (razao_social, nome_fantasia, cnpj, telefone, endereco, email)
       VALUES ($1, $1, $2, $3, $4, $5)
       RETURNING id, razao_social`,
      [
        nomeEmpresa.trim(),
        (cnpj || '').trim(),
        (telefone || '').trim(),
        (endereco || '').trim(),
        (email || '').trim(),
      ]
    );
    const novaEmpresa = empResult.rows[0];

    // Criar Hash da Senha
    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);

    // Criar Usuário Administrador
    const userResult = await client.query(
      `INSERT INTO usuarios (empresa_id, nome, usuario, email, senha_hash, perfil, ativo)
       VALUES ($1, $2, $3, $4, $5, 'admin', TRUE)
       RETURNING id, nome, usuario, email, perfil, ativo, criado_em`,
      [
        novaEmpresa.id,
        nome.trim(),
        usuarioClean,
        (email || '').trim(),
        senhaHash,
      ]
    );
    const novoUsuario = userResult.rows[0];

    // Criar Config Fiscal inicial da Empresa
    await client.query(
      `INSERT INTO config_fiscal (empresa_id, ambiente, serie, proximo_numero, razao_social, cnpj)
       VALUES ($1, 'homologacao', 1, 1, $2, $3)`,
      [novaEmpresa.id, novaEmpresa.razao_social, (cnpj || '').trim()]
    );

    // Inserir produtos padrão para a nova empresa
    await client.query(
      `INSERT INTO produtos (empresa_id, codigo, nome, preco_venda, preco_custo, unidade, estoque, categoria) VALUES
        ($1, '7894900011517', 'Refrigerante 2L', 9.90, 5.00, 'UN', 100, 'Bebidas'),
        ($1, '7896004000035', 'Pão francês (un.)', 0.85, 0.40, 'UN', 200, 'Padaria'),
        ($1, '7896089020034', 'Café 500g', 24.50, 14.00, 'UN', 50, 'Mercearia'),
        ($1, '7891020137515', 'Leite integral 1L', 5.49, 3.50, 'UN', 80, 'Mercearia'),
        ($1, '7893889311016', 'Açúcar 1kg', 4.20, 2.80, 'UN', 60, 'Mercearia'),
        ($1, 'SEMGTIN', 'Diversos (balcão)', 10.00, 0.00, 'UN', 999, 'Geral')`,
      [novaEmpresa.id]
    );

    await client.query('COMMIT');

    const token = generateToken({
      usuarioId: novoUsuario.id,
      empresaId: novaEmpresa.id,
      perfil: 'admin',
      nomeEmpresa: novaEmpresa.razao_social,
      nome: novoUsuario.nome,
    });

    res.status(201).json({
      ok: true,
      token,
      user: {
        id: novoUsuario.id,
        nome: novoUsuario.nome,
        usuario: novoUsuario.usuario,
        email: novoUsuario.email,
        perfil: novoUsuario.perfil,
        ativo: novoUsuario.ativo ? 1 : 0,
        empresaId: novaEmpresa.id,
        nomeEmpresa: novaEmpresa.razao_social,
        criadoEm: novoUsuario.criado_em,
      },
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Erro no cadastro de empresa:', err);
    res.status(500).json({ erro: err.message || 'Erro ao registrar empresa.' });
  } finally {
    client.release();
  }
});

/**
 * 2. Login de Usuário (Validação de credenciais e escopo da Empresa)
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { usuario, senha } = req.body;

    if (!usuario || !senha) {
      res.status(400).json({ erro: 'Usuário e senha são obrigatórios.' });
      return;
    }

    const usuarioClean = usuario.trim().toLowerCase();

    const query = `
      SELECT 
        u.id, u.empresa_id, u.nome, u.usuario, u.email, u.senha_hash, u.perfil, u.ativo, u.criado_em,
        e.razao_social as nome_empresa, e.ativo as empresa_ativa
      FROM usuarios u
      JOIN empresas e ON e.id = u.empresa_id
      WHERE LOWER(u.usuario) = $1 OR LOWER(u.email) = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [usuarioClean]);
    if (result.rows.length === 0) {
      res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
      return;
    }

    const row = result.rows[0];

    // Verificar se empresa está ativa
    if (!row.empresa_ativa) {
      res.status(403).json({ erro: 'Acesso suspenso para esta empresa. Contate o suporte.' });
      return;
    }

    // Verificar se usuário está ativo
    if (!row.ativo) {
      res.status(403).json({ erro: 'Usuário desativado. Contate o administrador da sua empresa.' });
      return;
    }

    // Verificar senha
    let senhaValida = false;
    if (row.senha_hash.startsWith('$2')) {
      // bcrypt
      senhaValida = await bcrypt.compare(senha, row.senha_hash);
    } else {
      // sha256 fallback
      const hashSha = crypto.createHash('sha256').update(senha).digest('hex');
      senhaValida = (hashSha === row.senha_hash);
    }

    if (!senhaValida) {
      res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
      return;
    }

    const token = generateToken({
      usuarioId: row.id,
      empresaId: row.empresa_id,
      perfil: row.perfil,
      nomeEmpresa: row.nome_empresa,
      nome: row.nome,
    });

    res.json({
      ok: true,
      token,
      user: {
        id: row.id,
        nome: row.nome,
        usuario: row.usuario,
        email: row.email,
        perfil: row.perfil,
        ativo: row.ativo ? 1 : 0,
        empresaId: row.empresa_id,
        nomeEmpresa: row.nome_empresa,
        criadoEm: row.criado_em,
      },
    });
  } catch (err: any) {
    console.error('Erro no login:', err);
    res.status(500).json({ erro: err.message || 'Erro ao realizar login.' });
  }
});

/**
 * 3. Dados do Usuário Logado
 */
authRouter.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenant = req.tenant!;
    const result = await pool.query(
      `SELECT u.id, u.nome, u.usuario, u.email, u.perfil, u.ativo, u.criado_em,
              e.id as empresa_id, e.razao_social, e.cnpj, e.telefone, e.endereco
       FROM usuarios u
       JOIN empresas e ON e.id = u.empresa_id
       WHERE u.id = $1 AND u.empresa_id = $2`,
      [tenant.usuarioId, tenant.empresaId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ erro: 'Usuário não encontrado.' });
      return;
    }

    const r = result.rows[0];
    res.json({
      id: r.id,
      nome: r.nome,
      usuario: r.usuario,
      email: r.email,
      perfil: r.perfil,
      ativo: r.ativo ? 1 : 0,
      empresa: {
        id: r.empresa_id,
        razaoSocial: r.razao_social,
        cnpj: r.cnpj,
        telefone: r.telefone,
        endereco: r.endereco,
      },
    });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

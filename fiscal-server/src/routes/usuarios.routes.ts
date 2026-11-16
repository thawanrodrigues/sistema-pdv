import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

export const usuariosRouter = Router();
usuariosRouter.use(authMiddleware);

// Listar colaboradores da empresa
usuariosRouter.get('/', async (req: Request, res: Response) => {
  try {
    const empresaId = req.tenant!.empresaId;
    const result = await pool.query(
      `SELECT id, nome, usuario, email, perfil, ativo, criado_em as "criadoEm"
       FROM usuarios 
       WHERE empresa_id = $1 AND ativo = TRUE 
       ORDER BY nome ASC`,
      [empresaId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// Cadastrar novo colaborador (apenas admin)
usuariosRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { empresaId, perfil: meuPerfil } = req.tenant!;
    if (meuPerfil !== 'admin') {
      res.status(403).json({ erro: 'Apenas administradores podem cadastrar colaboradores.' });
      return;
    }

    const { nome, usuario, email, senha, perfil } = req.body;
    if (!nome || !usuario || !senha) {
      res.status(400).json({ erro: 'Nome, usuário e senha são obrigatórios.' });
      return;
    }

    const usuarioClean = usuario.trim().toLowerCase();

    // Verificar se já existe esse login nessa empresa
    const exist = await pool.query(
      'SELECT id FROM usuarios WHERE empresa_id = $1 AND LOWER(usuario) = $2',
      [empresaId, usuarioClean]
    );
    if (exist.rows.length > 0) {
      res.status(400).json({ erro: 'Já existe um colaborador com este nome de usuário.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);

    const result = await pool.query(
      `INSERT INTO usuarios (empresa_id, nome, usuario, email, senha_hash, perfil, ativo)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id, nome, usuario, email, perfil, ativo, criado_em as "criadoEm"`,
      [
        empresaId,
        nome.trim(),
        usuarioClean,
        (email || '').trim(),
        senhaHash,
        perfil === 'admin' ? 'admin' : 'funcionario',
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// Atualizar colaborador
usuariosRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { empresaId, perfil: meuPerfil } = req.tenant!;
    if (meuPerfil !== 'admin') {
      res.status(403).json({ erro: 'Apenas administradores podem editar colaboradores.' });
      return;
    }

    const id = parseInt(req.params.id, 10);
    const { nome, email, senha, perfil, ativo } = req.body;

    let senhaUpdate = '';
    const params: any[] = [nome, email, perfil, id, empresaId];

    if (senha && senha.trim()) {
      const salt = await bcrypt.genSalt(10);
      const senhaHash = await bcrypt.hash(senha, salt);
      params.push(senhaHash);
      senhaUpdate = `, senha_hash = $${params.length}`;
    }

    if (ativo !== undefined) {
      params.push(ativo);
      senhaUpdate += `, ativo = $${params.length}`;
    }

    const result = await pool.query(
      `UPDATE usuarios SET 
         nome = COALESCE($1, nome),
         email = COALESCE($2, email),
         perfil = COALESCE($3, perfil)
         ${senhaUpdate}
       WHERE id = $4 AND empresa_id = $5
       RETURNING id, nome, usuario, email, perfil, ativo, criado_em as "criadoEm"`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ erro: 'Colaborador não encontrado.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// Desativar colaborador
usuariosRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { empresaId, perfil: meuPerfil } = req.tenant!;
    if (meuPerfil !== 'admin') {
      res.status(403).json({ erro: 'Apenas administradores podem desativar colaboradores.' });
      return;
    }

    const id = parseInt(req.params.id, 10);
    const result = await pool.query(
      `UPDATE usuarios SET ativo = FALSE WHERE id = $1 AND empresa_id = $2 RETURNING id`,
      [id, empresaId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ erro: 'Colaborador não encontrado.' });
      return;
    }

    res.json({ sucesso: true, id });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

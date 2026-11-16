import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

export const clientesRouter = Router();
clientesRouter.use(authMiddleware);

// Listar clientes da empresa
clientesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const empresaId = req.tenant!.empresaId;
    const result = await pool.query(
      `SELECT id, nome, documento, telefone, email, cep, endereco, cidade, uf, observacoes, 
              ativo, criado_em as "criadoEm"
       FROM clientes 
       WHERE empresa_id = $1 AND ativo = TRUE 
       ORDER BY nome ASC`,
      [empresaId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// Cadastrar cliente
clientesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const empresaId = req.tenant!.empresaId;
    const { nome, documento, telefone, email, cep, endereco, cidade, uf, observacoes } = req.body;

    if (!nome) {
      res.status(400).json({ erro: 'Nome do cliente é obrigatório.' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO clientes (empresa_id, nome, documento, telefone, email, cep, endereco, cidade, uf, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, nome, documento, telefone, email, cep, endereco, cidade, uf, observacoes, 
                 ativo, criado_em as "criadoEm"`,
      [
        empresaId,
        nome.trim(),
        (documento || '').trim(),
        (telefone || '').trim(),
        (email || '').trim(),
        (cep || '').trim(),
        (endereco || '').trim(),
        (cidade || '').trim(),
        (uf || '').trim().toUpperCase(),
        (observacoes || '').trim(),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// Atualizar cliente
clientesRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const empresaId = req.tenant!.empresaId;
    const id = parseInt(req.params.id, 10);
    const { nome, documento, telefone, email, cep, endereco, cidade, uf, observacoes } = req.body;

    const result = await pool.query(
      `UPDATE clientes SET 
         nome = COALESCE($1, nome),
         documento = COALESCE($2, documento),
         telefone = COALESCE($3, telefone),
         email = COALESCE($4, email),
         cep = COALESCE($5, cep),
         endereco = COALESCE($6, endereco),
         cidade = COALESCE($7, cidade),
         uf = COALESCE($8, uf),
         observacoes = COALESCE($9, observacoes)
       WHERE id = $10 AND empresa_id = $11
       RETURNING id, nome, documento, telefone, email, cep, endereco, cidade, uf, observacoes, 
                 ativo, criado_em as "criadoEm"`,
      [nome, documento, telefone, email, cep, endereco, cidade, uf, observacoes, id, empresaId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ erro: 'Cliente não encontrado.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// Excluir cliente
clientesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const empresaId = req.tenant!.empresaId;
    const id = parseInt(req.params.id, 10);

    const result = await pool.query(
      `UPDATE clientes SET ativo = FALSE WHERE id = $1 AND empresa_id = $2 RETURNING id`,
      [id, empresaId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ erro: 'Cliente não encontrado.' });
      return;
    }

    res.json({ sucesso: true, id });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

export const produtosRouter = Router();
produtosRouter.use(authMiddleware);

// Listar produtos da empresa
produtosRouter.get('/', async (req: Request, res: Response) => {
  try {
    const empresaId = req.tenant!.empresaId;
    const result = await pool.query(
      `SELECT id, codigo, nome, preco_venda as "precoVenda", preco_custo as "precoCusto", 
              unidade, estoque, categoria, observacoes, ativo, criado_em as "criadoEm"
       FROM produtos 
       WHERE empresa_id = $1 AND ativo = TRUE 
       ORDER BY nome ASC`,
      [empresaId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// Cadastrar produto na empresa
produtosRouter.post('/', async (req: Request, res: Response) => {
  try {
    const empresaId = req.tenant!.empresaId;
    const { codigo, nome, precoVenda, precoCusto, unidade, estoque, categoria, observacoes } = req.body;

    if (!nome) {
      res.status(400).json({ erro: 'Nome do produto é obrigatório.' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO produtos (empresa_id, codigo, nome, preco_venda, preco_custo, unidade, estoque, categoria, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, codigo, nome, preco_venda as "precoVenda", preco_custo as "precoCusto", 
                 unidade, estoque, categoria, observacoes, ativo, criado_em as "criadoEm"`,
      [
        empresaId,
        codigo || '',
        nome.trim(),
        precoVenda || 0,
        precoCusto || 0,
        unidade || 'UN',
        estoque || 0,
        categoria || 'Geral',
        observacoes || '',
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// Atualizar produto
produtosRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const empresaId = req.tenant!.empresaId;
    const id = parseInt(req.params.id, 10);
    const { codigo, nome, precoVenda, precoCusto, unidade, estoque, categoria, observacoes } = req.body;

    const result = await pool.query(
      `UPDATE produtos SET 
         codigo = COALESCE($1, codigo),
         nome = COALESCE($2, nome),
         preco_venda = COALESCE($3, preco_venda),
         preco_custo = COALESCE($4, preco_custo),
         unidade = COALESCE($5, unidade),
         estoque = COALESCE($6, estoque),
         categoria = COALESCE($7, categoria),
         observacoes = COALESCE($8, observacoes)
       WHERE id = $9 AND empresa_id = $10
       RETURNING id, codigo, nome, preco_venda as "precoVenda", preco_custo as "precoCusto", 
                 unidade, estoque, categoria, observacoes, ativo, criado_em as "criadoEm"`,
      [codigo, nome, precoVenda, precoCusto, unidade, estoque, categoria, observacoes, id, empresaId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ erro: 'Produto não encontrado.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// Desativar produto (soft delete)
produtosRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const empresaId = req.tenant!.empresaId;
    const id = parseInt(req.params.id, 10);

    const result = await pool.query(
      `UPDATE produtos SET ativo = FALSE WHERE id = $1 AND empresa_id = $2 RETURNING id`,
      [id, empresaId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ erro: 'Produto não encontrado.' });
      return;
    }

    res.json({ sucesso: true, id });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

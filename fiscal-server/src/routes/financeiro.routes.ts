import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

export const financeiroRouter = Router();
financeiroRouter.use(authMiddleware);

// Listar títulos financeiros (pagar / receber)
financeiroRouter.get('/titulos', async (req: Request, res: Response) => {
  try {
    const empresaId = req.tenant!.empresaId;
    const { tipo } = req.query;

    let query = `
      SELECT id, tipo, descricao, pessoa_nome as "pessoaNome", valor, 
             TO_CHAR(vencimento, 'DD/MM/YYYY') as vencimento,
             status, categoria, pago_em as "pagoEm", criado_em as "criadoEm"
      FROM titulos_financeiro
      WHERE empresa_id = $1
    `;
    const params: any[] = [empresaId];

    if (tipo) {
      params.push(tipo);
      query += ` AND tipo = $${params.length}`;
    }

    query += ' ORDER BY id DESC LIMIT 100';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// Cadastrar título
financeiroRouter.post('/titulos', async (req: Request, res: Response) => {
  try {
    const empresaId = req.tenant!.empresaId;
    const { tipo, descricao, pessoaNome, cliente, fornecedor, valor, vencimento, categoria } = req.body;

    if (!tipo || !descricao || !valor || !vencimento) {
      res.status(400).json({ erro: 'Tipo, descrição, valor e data de vencimento são obrigatórios.' });
      return;
    }

    // Converter DD/MM/YYYY para YYYY-MM-DD se necessário
    let dataVenc = vencimento;
    if (vencimento.includes('/')) {
      const [d, m, y] = vencimento.split('/');
      dataVenc = `${y}-${m}-${d}`;
    }

    const result = await pool.query(
      `INSERT INTO titulos_financeiro (empresa_id, tipo, descricao, pessoa_nome, valor, vencimento, status, categoria)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendente', $7)
       RETURNING id, tipo, descricao, pessoa_nome as "pessoaNome", valor, 
                 TO_CHAR(vencimento, 'DD/MM/YYYY') as vencimento, status, categoria`,
      [
        empresaId,
        tipo,
        descricao.trim(),
        (pessoaNome || cliente || fornecedor || '').trim(),
        Number(valor) || 0,
        dataVenc,
        categoria || 'Geral',
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// Marcar como pago / recebido
financeiroRouter.put('/titulos/:id/pagar', async (req: Request, res: Response) => {
  try {
    const empresaId = req.tenant!.empresaId;
    const id = parseInt(req.params.id, 10);

    const result = await pool.query(
      `UPDATE titulos_financeiro 
       SET status = 'pago', pago_em = CURRENT_TIMESTAMP 
       WHERE id = $1 AND empresa_id = $2
       RETURNING id, status, pago_em as "pagoEm"`,
      [id, empresaId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ erro: 'Título não encontrado.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// Excluir título
financeiroRouter.delete('/titulos/:id', async (req: Request, res: Response) => {
  try {
    const empresaId = req.tenant!.empresaId;
    const id = parseInt(req.params.id, 10);

    const result = await pool.query(
      `DELETE FROM titulos_financeiro WHERE id = $1 AND empresa_id = $2 RETURNING id`,
      [id, empresaId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ erro: 'Título não encontrado.' });
      return;
    }

    res.json({ sucesso: true, id });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

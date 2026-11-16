import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

export const caixaRouter = Router();
caixaRouter.use(authMiddleware);

// Obter status do caixa atual da empresa
caixaRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const empresaId = req.tenant!.empresaId;
    const result = await pool.query(
      `SELECT c.id, c.status, c.saldo_abertura as "saldoAbertura", c.saldo_fechamento as "saldoFechamento",
              c.usuario_id as "usuarioId", c.aberto_em as "abertoEm", c.fechado_em as "fechadoEm",
              u.nome as "usuarioNome"
       FROM caixas c
       LEFT JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.empresa_id = $1 AND c.status = 'aberto'
       ORDER BY c.id DESC LIMIT 1`,
      [empresaId]
    );

    if (result.rows.length === 0) {
      res.json({ aberto: false, caixa: null });
      return;
    }

    res.json({ aberto: true, caixa: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// Abrir caixa
caixaRouter.post('/abrir', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { empresaId, usuarioId } = req.tenant!;
    const { saldoAbertura } = req.body;

    await client.query('BEGIN');

    // Verificar se já existe um caixa aberto
    const check = await client.query(
      "SELECT id FROM caixas WHERE empresa_id = $1 AND status = 'aberto' LIMIT 1",
      [empresaId]
    );
    if (check.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ erro: 'Já existe um caixa aberto nesta empresa.' });
      return;
    }

    const valorAbertura = Number(saldoAbertura) || 0;
    const result = await client.query(
      `INSERT INTO caixas (empresa_id, usuario_id, status, saldo_abertura, aberto_em)
       VALUES ($1, $2, 'aberto', $3, CURRENT_TIMESTAMP)
       RETURNING id, status, saldo_abertura as "saldoAbertura", aberto_em as "abertoEm"`,
      [empresaId, usuarioId, valorAbertura]
    );
    const novoCaixa = result.rows[0];

    // Registrar movimentação de abertura
    await client.query(
      `INSERT INTO movimentacoes (empresa_id, caixa_id, tipo, descricao, valor)
       VALUES ($1, $2, 'abertura', 'Abertura de Caixa', $3)`,
      [empresaId, novoCaixa.id, valorAbertura]
    );

    await client.query('COMMIT');
    res.status(201).json(novoCaixa);
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: err.message });
  } finally {
    client.release();
  }
});

// Fechar caixa
caixaRouter.post('/fechar', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { empresaId } = req.tenant!;
    const { saldoFechamento } = req.body;

    await client.query('BEGIN');

    const check = await client.query(
      "SELECT id FROM caixas WHERE empresa_id = $1 AND status = 'aberto' ORDER BY id DESC LIMIT 1",
      [empresaId]
    );
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ erro: 'Não há caixa aberto para fechar.' });
      return;
    }

    const caixaId = check.rows[0].id;
    const valorFechamento = Number(saldoFechamento) || 0;

    await client.query(
      `UPDATE caixas SET status = 'fechado', saldo_fechamento = $1, fechado_em = CURRENT_TIMESTAMP
       WHERE id = $2 AND empresa_id = $3`,
      [valorFechamento, caixaId, empresaId]
    );

    // Registrar movimentação de fechamento
    await client.query(
      `INSERT INTO movimentacoes (empresa_id, caixa_id, tipo, descricao, valor)
       VALUES ($1, $2, 'fechamento', 'Fechamento de Caixa', $3)`,
      [empresaId, caixaId, valorFechamento]
    );

    await client.query('COMMIT');
    res.json({ sucesso: true, caixaId, saldoFechamento: valorFechamento });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: err.message });
  } finally {
    client.release();
  }
});

// Listar movimentações do caixa atual ou geral
caixaRouter.get('/movimentacoes', async (req: Request, res: Response) => {
  try {
    const empresaId = req.tenant!.empresaId;
    const result = await pool.query(
      `SELECT m.id, m.caixa_id as "caixaId", m.tipo, m.descricao, m.valor, m.hora
       FROM movimentacoes m
       WHERE m.empresa_id = $1
       ORDER BY m.id DESC LIMIT 100`,
      [empresaId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// Adicionar movimentação (Sangria / Suprimento)
caixaRouter.post('/movimentacoes', async (req: Request, res: Response) => {
  try {
    const empresaId = req.tenant!.empresaId;
    const { tipo, descricao, valor } = req.body;

    const check = await pool.query(
      "SELECT id FROM caixas WHERE empresa_id = $1 AND status = 'aberto' ORDER BY id DESC LIMIT 1",
      [empresaId]
    );
    if (check.rows.length === 0) {
      res.status(400).json({ erro: 'É necessário abrir o caixa antes de realizar movimentações.' });
      return;
    }

    const caixaId = check.rows[0].id;
    const result = await pool.query(
      `INSERT INTO movimentacoes (empresa_id, caixa_id, tipo, descricao, valor)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, caixa_id as "caixaId", tipo, descricao, valor, hora`,
      [empresaId, caixaId, tipo, descricao || '', Number(valor) || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

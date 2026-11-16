import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

export const vendasRouter = Router();
vendasRouter.use(authMiddleware);

// Listar vendas da empresa
vendasRouter.get('/', async (req: Request, res: Response) => {
  try {
    const empresaId = req.tenant!.empresaId;
    const result = await pool.query(
      `SELECT v.id, v.total, v.desconto, v.metodo_pagamento as "metodoPagamento", 
              v.status, v.criado_em as "criadoEm",
              u.nome as "usuarioNome", c.nome as "clienteNome"
       FROM vendas v
       LEFT JOIN usuarios u ON u.id = v.usuario_id
       LEFT JOIN clientes c ON c.id = v.cliente_id
       WHERE v.empresa_id = $1
       ORDER BY v.id DESC LIMIT 100`,
      [empresaId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// Finalizar Venda (cria venda, insere itens, abate estoque, registra caixa se houver)
vendasRouter.post('/', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { empresaId, usuarioId } = req.tenant!;
    const { total, desconto, metodoPagamento, clienteId, itens } = req.body;

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      res.status(400).json({ erro: 'A venda deve conter ao menos um item.' });
      return;
    }

    await client.query('BEGIN');

    // 1. Criar a venda
    const vendaResult = await client.query(
      `INSERT INTO vendas (empresa_id, usuario_id, cliente_id, total, desconto, metodo_pagamento, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'concluida')
       RETURNING id, total, criado_em as "criadoEm"`,
      [
        empresaId,
        usuarioId,
        clienteId || null,
        Number(total) || 0,
        Number(desconto) || 0,
        metodoPagamento || 'Dinheiro',
      ]
    );
    const venda = vendaResult.rows[0];

    // 2. Inserir itens e abater estoque
    for (const item of itens) {
      const qtd = Number(item.qtd) || 1;
      const precoUnit = Number(item.precoUnit || item.preco_unit || item.precoVenda || 0);
      const subtotal = qtd * precoUnit;

      await client.query(
        `INSERT INTO itens_venda (empresa_id, venda_id, produto_id, nome, qtd, preco_unit, total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [empresaId, venda.id, item.produtoId || item.id || null, item.nome, qtd, precoUnit, subtotal]
      );

      // Abater estoque do produto se produtoId válido
      if (item.produtoId || item.id) {
        await client.query(
          `UPDATE produtos SET estoque = estoque - $1 WHERE id = $2 AND empresa_id = $3`,
          [qtd, item.produtoId || item.id, empresaId]
        );
      }
    }

    // 3. Registrar no caixa aberto (se houver)
    const caixaCheck = await client.query(
      "SELECT id FROM caixas WHERE empresa_id = $1 AND status = 'aberto' ORDER BY id DESC LIMIT 1",
      [empresaId]
    );
    if (caixaCheck.rows.length > 0) {
      const caixaId = caixaCheck.rows[0].id;
      await client.query(
        `INSERT INTO movimentacoes (empresa_id, caixa_id, tipo, descricao, valor)
         VALUES ($1, $2, 'venda', $3, $4)`,
        [empresaId, caixaId, `Venda #${venda.id} (${metodoPagamento || 'Dinheiro'})`, Number(total) || 0]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ sucesso: true, vendaId: venda.id, total: venda.total, criadoEm: venda.criadoEm });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: err.message });
  } finally {
    client.release();
  }
});

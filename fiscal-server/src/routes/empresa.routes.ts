import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

export const empresaRouter = Router();
empresaRouter.use(authMiddleware);

// Obter dados da empresa logada
empresaRouter.get('/', async (req: Request, res: Response) => {
  try {
    const empresaId = req.tenant!.empresaId;
    const result = await pool.query(
      `SELECT id, razao_social as "razaoSocial", nome_fantasia as "nomeFantasia", 
              cnpj, telefone, endereco, email, pix_chave as "pixChave", pix_titular as "pixTitular",
              criado_em as "criadoEm"
       FROM empresas
       WHERE id = $1`,
      [empresaId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ erro: 'Empresa não encontrada.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// Atualizar dados da empresa (apenas admin)
empresaRouter.put('/', async (req: Request, res: Response) => {
  try {
    const { empresaId, perfil } = req.tenant!;
    if (perfil !== 'admin') {
      res.status(403).json({ erro: 'Apenas administradores podem alterar os dados da empresa.' });
      return;
    }

    const { razaoSocial, nomeFantasia, cnpj, telefone, endereco, email, pixChave, pixTitular } = req.body;

    const result = await pool.query(
      `UPDATE empresas SET
         razao_social = COALESCE($1, razao_social),
         nome_fantasia = COALESCE($2, nome_fantasia),
         cnpj = COALESCE($3, cnpj),
         telefone = COALESCE($4, telefone),
         endereco = COALESCE($5, endereco),
         email = COALESCE($6, email),
         pix_chave = COALESCE($7, pix_chave),
         pix_titular = COALESCE($8, pix_titular),
         atualizado_em = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING id, razao_social as "razaoSocial", nome_fantasia as "nomeFantasia", 
                 cnpj, telefone, endereco, email, pix_chave as "pixChave", pix_titular as "pixTitular"`,
      [razaoSocial, nomeFantasia, cnpj, telefone, endereco, email, pixChave, pixTitular, empresaId]
    );

    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

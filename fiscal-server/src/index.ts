// ============================================================
// Servidor Backend SaaS & Fiscal (Node.js / Express / TypeScript)
// ConectaPDV Cloud - Multi-Tenant SaaS com PostgreSQL
// ============================================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fiscalRouter } from './routes/fiscal.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { produtosRouter } from './routes/produtos.routes.js';
import { clientesRouter } from './routes/clientes.routes.js';
import { usuariosRouter } from './routes/usuarios.routes.js';
import { caixaRouter } from './routes/caixa.routes.js';
import { vendasRouter } from './routes/vendas.routes.js';
import { financeiroRouter } from './routes/financeiro.routes.js';
import { empresaRouter } from './routes/empresa.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3333;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '25mb' })); // Suporte para certificados .pfx em base64 e lotes
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Health Check
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'online',
    servico: 'ConectaPDV SaaS API Server',
    versao: '2.0.0',
    banco: 'PostgreSQL Multi-Tenant (sistemapdv_db)',
    timestamp: new Date().toISOString(),
  });
});

// Rotas da API Multi-Tenant SaaS
app.use('/api/auth', authRouter);
app.use('/api/produtos', produtosRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/caixa', caixaRouter);
app.use('/api/vendas', vendasRouter);
app.use('/api/financeiro', financeiroRouter);
app.use('/api/empresa', empresaRouter);

// Rotas da API Fiscal Direta (SEFAZ)
app.use('/api/fiscal', fiscalRouter);

// Inicialização
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 ConectaPDV SaaS API Server rodando na porta ${PORT}`);
  console.log(`📍 Endpoint de Saúde: http://localhost:${PORT}/api/health`);
  console.log(`📍 Autenticação SaaS: http://localhost:${PORT}/api/auth/login`);
  console.log(`📍 Emissão NFC-e:     http://localhost:${PORT}/api/fiscal/nfce/emitir`);
  console.log(`=======================================================`);
});

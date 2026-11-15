// ============================================================
// Servidor Backend Fiscal (Node.js / Express / TypeScript)
// ConectaPDV Cloud - Emissão Direta com a SEFAZ
// ============================================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fiscalRouter } from './routes/fiscal.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3333;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '15mb' })); // Suporte para certificados .pfx em base64
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    servico: 'ConectaPDV Fiscal Server',
    versao: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Rotas da API Fiscal
app.use('/api/fiscal', fiscalRouter);

// Inicialização
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 ConectaPDV Fiscal Server rodando na porta ${PORT}`);
  console.log(`📍 Endpoint de Saúde: http://localhost:${PORT}/health`);
  console.log(`📍 Emissão NFC-e:    http://localhost:${PORT}/api/fiscal/nfce/emitir`);
  console.log(`📍 Status SEFAZ:     http://localhost:${PORT}/api/fiscal/status`);
  console.log(`=======================================================`);
});

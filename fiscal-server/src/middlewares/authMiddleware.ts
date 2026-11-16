import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'conecta_pdv_saas_secret_key_2026_xyz';

export interface TenantContext {
  usuarioId: number;
  empresaId: number;
  perfil: string;
  nomeEmpresa: string;
  nome: string;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ erro: 'Token de autenticação não fornecido.' });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({ erro: 'Formato de token inválido. Esperado Bearer <token>.' });
    return;
  }

  const token = parts[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TenantContext;
    req.tenant = decoded;
    next();
  } catch (err) {
    res.status(401).json({ erro: 'Sessão expirada ou token inválido. Faça login novamente.' });
  }
}

export function generateToken(payload: TenantContext): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

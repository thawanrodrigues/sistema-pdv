// ============================================================
// Utilitário de hash de senha usando expo-crypto (SHA-256)
// ============================================================
import * as Crypto from 'expo-crypto';

/** Gera hash SHA-256 da senha concatenada com salt fixo */
export async function hashSenha(senha: string): Promise<string> {
  const salt = 'pdv-sistema-salt-v1';
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${senha}`
  );
  return digest;
}

/** Verifica se senha bate com o hash armazenado */
export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  const novoHash = await hashSenha(senha);
  return novoHash === hash;
}

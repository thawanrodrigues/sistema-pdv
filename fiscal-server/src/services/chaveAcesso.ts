// ============================================================
// Gerador Oficial de Chave de Acesso (44 dígitos) e Dígito Verificador (Módulo 11)
// ============================================================

import { CODIGOS_IBGE_UF, UF } from '../config/sefazEndpoints.js';

export interface DadosChaveAcesso {
  uf: UF;
  dataEmissao: Date;
  cnpj: string;
  modelo: '65' | '55'; // 65 = NFC-e, 55 = NF-e
  serie: number;
  numero: number;
  tipoEmissao?: number; // 1 = Normal
  codigoNumerico?: number; // cNF (8 dígitos aleatórios)
}

/**
 * Calcula o Dígito Verificador da Chave de Acesso (Módulo 11 - pesos 2 a 9)
 */
export function calcularDigitoVerificador(chaveSemDV: string): number {
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  let pesoIdx = 0;

  for (let i = chaveSemDV.length - 1; i >= 0; i--) {
    const digito = parseInt(chaveSemDV[i], 10);
    soma += digito * pesos[pesoIdx];
    pesoIdx = (pesoIdx + 1) % pesos.length;
  }

  const resto = soma % 11;
  const dv = 11 - resto;
  return dv === 0 || dv === 1 || dv >= 10 ? 0 : dv;
}

/**
 * Gera a Chave de Acesso completa de 44 dígitos
 */
export function gerarChaveAcesso(dados: DadosChaveAcesso): {
  chaveAcesso: string;
  codigoNumerico: string;
  digitoVerificador: number;
} {
  const codigoUf = CODIGOS_IBGE_UF[dados.uf] || '35';
  
  const ano = dados.dataEmissao.getFullYear().toString().slice(-2);
  const mes = (dados.dataEmissao.getMonth() + 1).toString().padStart(2, '0');
  const aamm = `${ano}${mes}`;

  const cleanCnpj = dados.cnpj.replace(/\D/g, '').padStart(14, '0');
  const modelo = dados.modelo;
  const serie = dados.serie.toString().padStart(3, '0');
  const nNF = dados.numero.toString().padStart(9, '0');
  const tpEmis = (dados.tipoEmissao || 1).toString();

  // Código numérico aleatório de 8 dígitos (cNF) para segurança
  const cNF = (dados.codigoNumerico || Math.floor(10000000 + Math.random() * 90000000))
    .toString()
    .padStart(8, '0');

  const chave43 = `${codigoUf}${aamm}${cleanCnpj}${modelo}${serie}${nNF}${tpEmis}${cNF}`;
  const dv = calcularDigitoVerificador(chave43);
  const chaveCompleta = `${chave43}${dv}`;

  return {
    chaveAcesso: chaveCompleta,
    codigoNumerico: cNF,
    digitoVerificador: dv,
  };
}

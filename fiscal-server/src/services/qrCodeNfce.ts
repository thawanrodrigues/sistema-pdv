// ============================================================
// Gerador Oficial de QR Code para NFC-e (Manual de Padrões Técnicos v5.0 / v6.0)
// ============================================================

import crypto from 'node:crypto';
import { obterEndpointsSefaz, TipoAmbiente, UF } from '../config/sefazEndpoints.js';

export interface ParametrosQRCodeNfce {
  uf: UF;
  ambiente: TipoAmbiente;
  chaveAcesso: string;
  dataEmissao: Date;
  valorTotal: number;
  digestValue: string;
  idCsc: string; // Ex: '000001' ou '1'
  csc: string;   // Código de Segurança do Contribuinte fornecido pela SEFAZ
  cpfCnpjDestinatario?: string;
}

/**
 * Converte string para representação hexadecimal
 */
function stringParaHex(str: string): string {
  return Buffer.from(str, 'utf8').toString('hex');
}

/**
 * Converte data para formato ISO com fuso horário e depois para Hex
 */
function formatarDataHex(date: Date): string {
  const iso = date.toISOString();
  return stringParaHex(iso);
}

/**
 * Gera a URL completa do QR Code e a tag <infNFeSupl>
 */
export function gerarQrCodeNfce(params: ParametrosQRCodeNfce): {
  urlQrCode: string;
  tagInfNFeSupl: string;
} {
  const {
    uf,
    ambiente,
    chaveAcesso,
    dataEmissao,
    valorTotal,
    digestValue,
    idCsc,
    csc,
    cpfCnpjDestinatario,
  } = params;

  const endpoints = obterEndpointsSefaz(uf, ambiente);
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const cIdToken = idCsc.padStart(6, '0');
  
  // Parâmetros para versão 2 do QR Code:
  // p = chNFe|2|tpAmb|cDest|dhEmi|vNF|vICMS|digValHex|cIdToken
  const dhEmiHex = formatarDataHex(dataEmissao);
  const vNF = valorTotal.toFixed(2);
  const digValHex = stringParaHex(digestValue);
  const cDest = (cpfCnpjDestinatario || '').replace(/\D/g, '');

  const sequenciaParaHash = `${chaveAcesso}|2|${tpAmb}|${cDest ? cDest + '|' : ''}${dhEmiHex}|${vNF}||${digValHex}|${cIdToken}${csc.trim()}`;
  
  // Hash SHA-1 em hexadecimal da sequência com o CSC
  const cHashQRCode = crypto.createHash('sha1').update(sequenciaParaHash, 'utf8').digest('hex');

  const dadosConcatenados = `${chaveAcesso}|2|${tpAmb}|${cDest ? cDest + '|' : ''}${dhEmiHex}|${vNF}||${digValHex}|${cIdToken}`;
  const urlQrCode = `${endpoints.qrCodeUrl}?p=${dadosConcatenados}|${cHashQRCode}`;

  const tagInfNFeSupl = `
    <infNFeSupl>
      <qrCode><![CDATA[${urlQrCode}]]></qrCode>
      <urlChave>${endpoints.qrCodeUrl}</urlChave>
    </infNFeSupl>
  `.trim();

  return {
    urlQrCode,
    tagInfNFeSupl,
  };
}

// ============================================================
// Rotas da API Fiscal REST (NFC-e / NF-e / NFS-e)
// ============================================================

import { Router, Request, Response } from 'express';
import { processarCertificadoA1 } from '../services/certificadoService.js';
import { consultarStatusServico, transmitirLoteNfceSincrono } from '../services/sefazTransmissor.js';
import { gerarChaveAcesso } from '../services/chaveAcesso.js';
import { construirXmlNfce, DadosNfceEnvio } from '../services/nfceBuilder.js';
import { assinarXmlSefaz } from '../services/assinadorXml.js';
import { gerarQrCodeNfce } from '../services/qrCodeNfce.js';
import { UF, TipoAmbiente } from '../config/sefazEndpoints.js';

export const fiscalRouter = Router();

/**
 * 1. Validação de Certificado Digital A1 (.pfx)
 */
fiscalRouter.post('/certificado/validar', (req: Request, res: Response) => {
  try {
    const { pfxBase64, senha } = req.body;

    if (!pfxBase64 || !senha) {
      res.status(400).json({ erro: 'Arquivo PFX (base64) e senha são obrigatórios.' });
      return;
    }

    const info = processarCertificadoA1(pfxBase64, senha);

    res.json({
      sucesso: true,
      razaoSocial: info.razaoSocial,
      cnpj: info.cnpj,
      dataValidade: info.dataValidade,
      diasParaVencer: info.diasParaVencer,
      expirado: info.expirado,
    });
  } catch (err: any) {
    res.status(400).json({ sucesso: false, erro: err.message });
  }
});

/**
 * 2. Consulta Status do Serviço da SEFAZ
 */
fiscalRouter.post('/status', async (req: Request, res: Response) => {
  try {
    const { uf, ambiente, pfxBase64, senha } = req.body;

    if (!uf || !ambiente || !pfxBase64 || !senha) {
      res.status(400).json({ erro: 'Parâmetros uf, ambiente, pfxBase64 e senha são obrigatórios.' });
      return;
    }

    const resultado = await consultarStatusServico({
      uf: uf.toUpperCase() as UF,
      ambiente: ambiente as TipoAmbiente,
      pfxBase64,
      senhaCertificado: senha,
    });

    res.json(resultado);
  } catch (err: any) {
    res.status(500).json({ online: false, erro: err.message });
  }
});

/**
 * 3. Emissão Direta de NFC-e (Modelo 65)
 */
fiscalRouter.post('/nfce/emitir', async (req: Request, res: Response) => {
  try {
    const {
      uf,
      ambiente,
      serie,
      numero,
      cnpjEmitente,
      razaoSocialEmitente,
      inscricaoEstadualEmitente,
      regimeTributario,
      itens,
      valorTotal,
      metodoPagamento,
      valorTroco,
      cpfCnpjDestinatario,
      idCsc,
      csc,
      pfxBase64,
      senhaCertificado,
    } = req.body;

    // Validações básicas
    if (!uf || !pfxBase64 || !senhaCertificado || !cnpjEmitente || !itens || !valorTotal) {
      res.status(400).json({ erro: 'Dados fiscais incompletos para emissão.' });
      return;
    }

    const ufUpper = uf.toUpperCase() as UF;
    const amb = (ambiente || 'homologacao') as TipoAmbiente;
    const dataEmissao = new Date();

    // 1. Processar certificado A1
    const certInfo = processarCertificadoA1(pfxBase64, senhaCertificado);
    if (certInfo.expirado) {
      res.status(400).json({ erro: 'Certificado digital A1 está expirado.' });
      return;
    }

    // 2. Gerar Chave de Acesso Oficial (44 dígitos)
    const chaveObj = gerarChaveAcesso({
      uf: ufUpper,
      dataEmissao,
      cnpj: cnpjEmitente,
      modelo: '65',
      serie: Number(serie || 1),
      numero: Number(numero || 1),
    });

    // 3. Montar XML inicial da NFC-e
    const dadosNfce: DadosNfceEnvio = {
      chaveAcesso: chaveObj.chaveAcesso,
      codigoNumerico: chaveObj.codigoNumerico,
      digitoVerificador: chaveObj.digitoVerificador,
      serie: Number(serie || 1),
      numero: Number(numero || 1),
      dataEmissao,
      uf: ufUpper,
      ambiente: amb,
      cnpjEmitente,
      razaoSocialEmitente,
      inscricaoEstadualEmitente: inscricaoEstadualEmitente || 'ISENTO',
      regimeTributario: regimeTributario || '1',
      itens,
      valorTotal: Number(valorTotal),
      metodoPagamento: metodoPagamento || 'Dinheiro',
      valorTroco: valorTroco ? Number(valorTroco) : undefined,
      cpfCnpjDestinatario,
    };

    const xmlInicial = construirXmlNfce(dadosNfce);

    // 4. Assinar XML com o Certificado Digital A1
    const xmlAssinado = assinarXmlSefaz(xmlInicial, 'infNFe', certInfo);

    // 5. Gerar e Injetar o QR Code Oficial (<infNFeSupl>)
    // Extrai o DigestValue da assinatura gerada
    const matchDigest = xmlAssinado.match(/<DigestValue>([^<]+)<\/DigestValue>/i);
    const digestValue = matchDigest ? matchDigest[1] : '';

    const qrResult = gerarQrCodeNfce({
      uf: ufUpper,
      ambiente: amb,
      chaveAcesso: chaveObj.chaveAcesso,
      dataEmissao,
      valorTotal: Number(valorTotal),
      digestValue,
      idCsc: idCsc || '000001',
      csc: csc || '00000000000000000000000000000000',
      cpfCnpjDestinatario,
    });

    // Inserir tag <infNFeSupl> antes da tag <Signature>
    const xmlComQrCode = xmlAssinado.replace(
      '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">',
      `${qrResult.tagInfNFeSupl}<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">`
    );

    // 6. Transmitir direto para a SEFAZ
    const retornoSefaz = await transmitirLoteNfceSincrono({
      uf: ufUpper,
      ambiente: amb,
      xmlNFeAssinado: xmlComQrCode,
      pfxBase64,
      senhaCertificado,
    });

    res.json({
      sucesso: retornoSefaz.autorizada,
      status: retornoSefaz.autorizada ? 'autorizada' : 'erro',
      cStat: retornoSefaz.cStat,
      xMotivo: retornoSefaz.xMotivo,
      chaveAcesso: chaveObj.chaveAcesso,
      protocolo: retornoSefaz.nProt || '',
      numero: Number(numero || 1),
      serie: Number(serie || 1),
      qrCodeUrl: qrResult.urlQrCode,
      xmlAutorizado: retornoSefaz.xmlProtocolado || xmlComQrCode,
      dataRecebimento: retornoSefaz.dhRecbto || dataEmissao.toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      sucesso: false,
      status: 'erro',
      erro: err.message || 'Erro interno no processamento fiscal.',
    });
  }
});

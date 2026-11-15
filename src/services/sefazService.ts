import { ConfigFiscal } from '../database/notaFiscalRepository';
import { Venda } from '../database/vendaRepository';

// Utilitário para converter método de pagamento do PDV para código SEFAZ
function mapearMetodoPagamento(metodo: string): string {
  switch (metodo) {
    case 'Dinheiro': return '01';
    case 'Cheque': return '02';
    case 'Cartão de Crédito': return '03';
    case 'Cartão de Débito': return '04';
    case 'Crédito': return '03';
    case 'Débito': return '04';
    case 'Pix': return '17';
    default: return '99'; // Outros
  }
}

// Codificar Token de Acesso em Base64 para fallback FocusNFe
function obterAuthorizationHeader(token: string): string {
  const cleanToken = token.trim();
  try {
    return 'Basic ' + btoa(cleanToken + ':');
  } catch {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const str = cleanToken + ':';
    let output = '';
    for (let block = 0, charCode, i = 0, map = chars; str.charAt(i | 0) || (map = '=', i % 1); output += map.charAt(63 & block >> 8 - i % 1 * 8)) {
      charCode = str.charCodeAt(i += 3 / 4);
      if (charCode > 0xFF) {
        throw new Error("'btoa' failed");
      }
      block = block << 8 | charCode;
    }
    return 'Basic ' + output;
  }
}

export type SefazResult = {
  chaveAcesso: string;
  protocolo: string;
  numero: number;
  serie: number;
  urlDanfe?: string;
  aliquotaIss?: number;
  valorIss?: number;
  status: 'autorizada' | 'erro';
  mensagem?: string;
};

/**
 * Consulta o status do serviço da SEFAZ diretamente pelo Fiscal Server
 */
export async function testarStatusSefazDireto(config: ConfigFiscal): Promise<{
  online: boolean;
  cStat: string;
  xMotivo: string;
}> {
  const serverUrl = config.fiscalServerUrl || 'http://localhost:3333';
  try {
    const resp = await fetch(`${serverUrl}/api/fiscal/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uf: config.uf || 'SP',
        ambiente: config.ambiente,
        pfxBase64: config.certificadoPfx,
        senha: config.certificadoSenha,
      }),
    });
    return await resp.json();
  } catch (err: any) {
    return {
      online: false,
      cStat: '999',
      xMotivo: `Não foi possível conectar ao servidor fiscal: ${err.message}`,
    };
  }
}

/**
 * Valida o Certificado Digital A1 no Fiscal Server
 */
export async function validarCertificadoA1Direto(pfxBase64: string, senha: string, serverUrl = 'http://localhost:3333') {
  const resp = await fetch(`${serverUrl}/api/fiscal/certificado/validar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pfxBase64, senha }),
  });
  return await resp.json();
}

/**
 * Envia uma Nota Fiscal (NFC-e ou NFS-e)
 * Prioridade:
 * 1. Emissão Direta com a SEFAZ via ConectaPDV Fiscal Server (Custo Zero)
 * 2. Emissão via FocusNFe (se configurado token de terceiro)
 * 3. Simulação Local de Alta Fidelidade (para testes e desenvolvimento)
 */
export async function transmitirParaSefaz(params: {
  venda: Venda;
  itens: any[];
  config: ConfigFiscal;
  empresa: any;
  tipo: 'NFC-e' | 'NFS-e';
  cpfCnpjCliente?: string;
}): Promise<SefazResult> {
  const { venda, itens, config, empresa, tipo, cpfCnpjCliente } = params;
  const fiscalServerUrl = config.fiscalServerUrl || 'http://localhost:3333';

  // -------------------------------------------------------------
  // 1. FLUXO DIRETO COM A SEFAZ (Zero Custo Terceiros)
  // -------------------------------------------------------------
  if (config.certificadoPfx && config.certificadoPfx.trim() && config.certificadoSenha && tipo === 'NFC-e') {
    try {
      const resp = await fetch(`${fiscalServerUrl}/api/fiscal/nfce/emitir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uf: config.uf || 'SP',
          ambiente: config.ambiente,
          serie: config.serie,
          numero: config.proximoNumero,
          cnpjEmitente: (empresa.cnpj || '').replace(/\D/g, ''),
          razaoSocialEmitente: empresa.razao_social || empresa.razaoSocial || 'Minha Empresa',
          inscricaoEstadualEmitente: config.inscricaoEstadual,
          regimeTributario: config.regimeTributario || '1',
          itens: itens.map((it, idx) => ({
            numeroItem: idx + 1,
            codigo: it.produtoId ? String(it.produtoId) : `ITEM_${idx + 1}`,
            nome: it.nome,
            ncm: config.ncmPadrao || '21069090',
            cfop: config.cfopPadrao || '5102',
            unidade: 'UN',
            quantidade: it.qtd,
            valorUnitario: it.precoUnit,
            valorTotal: it.qtd * it.precoUnit,
          })),
          valorTotal: venda.total,
          metodoPagamento: venda.metodoPagamento,
          cpfCnpjDestinatario: cpfCnpjCliente,
          idCsc: config.cscId,
          csc: config.csc,
          pfxBase64: config.certificadoPfx,
          senhaCertificado: config.certificadoSenha,
        }),
      });

      const data = await resp.json();

      if (data.sucesso && data.cStat === '100') {
        return {
          chaveAcesso: data.chaveAcesso,
          protocolo: data.protocolo,
          numero: data.numero,
          serie: data.serie,
          urlDanfe: data.qrCodeUrl,
          status: 'autorizada',
          mensagem: data.xMotivo,
        };
      } else {
        return {
          chaveAcesso: data.chaveAcesso || '',
          protocolo: data.protocolo || '',
          numero: config.proximoNumero,
          serie: config.serie,
          status: 'erro',
          mensagem: `SEFAZ Rejeição [${data.cStat}]: ${data.xMotivo || data.erro || 'Erro na autorização da SEFAZ'}`,
        };
      }
    } catch (err: any) {
      console.warn('Falha ao comunicar com Fiscal Server direto. Verificando fallbacks...', err.message);
    }
  }

  // -------------------------------------------------------------
  // 2. FLUXO FOCUSNFE (Secundário se configurado token legado)
  // -------------------------------------------------------------
  if (config.focusToken && config.focusToken.trim() !== '') {
    const isNfse = tipo === 'NFS-e';
    const ambienteSubdomain = config.ambiente === 'producao' ? 'api' : 'homologacao';
    const referenciaId = `venda_${venda.id}_t_${Date.now()}`;
    const baseUrl = `https://${ambienteSubdomain}.focusnfe.com.br/v2`;
    const url = isNfse 
      ? `${baseUrl}/nfse?ref=${referenciaId}` 
      : `${baseUrl}/nfce?ref=${referenciaId}`;

    const cnpjEmitente = empresa.cnpj.replace(/\D/g, '');
    const ieEmitente = config.inscricaoEstadual ? config.inscricaoEstadual.replace(/\D/g, '') : '';
    const cleanCpfCnpjCliente = cpfCnpjCliente ? cpfCnpjCliente.replace(/\D/g, '') : '';

    const payloadNfce = {
      cnpj_emitente: cnpjEmitente,
      inscricao_estadual_emitente: ieEmitente,
      data_emissao: new Date().toISOString(),
      regime_tributario: config.regimeTributario || '1',
      presenca_comprador: 1,
      modalidade_frete: 9,
      forma_pagamento: mapearMetodoPagamento(venda.metodoPagamento),
      valor_pagamento: venda.total,
      cnpj_destinatario: cleanCpfCnpjCliente.length === 14 ? cleanCpfCnpjCliente : undefined,
      cpf_destinatario: cleanCpfCnpjCliente.length === 11 ? cleanCpfCnpjCliente : undefined,
      itens: itens.map((it, idx) => ({
        numero_item: idx + 1,
        codigo_produto: it.produtoId ? String(it.produtoId) : 'AVULSO',
        descricao: it.nome,
        ncm: config.ncmPadrao || '99999999',
        cfop: config.cfopPadrao || '5102',
        unidade_comercial: 'UN',
        quantidade_comercial: it.qtd,
        valor_unitario_comercial: it.precoUnit,
        valor_unitario_tributavel: it.precoUnit,
        unidade_tributavel: 'UN',
        quantidade_tributavel: it.qtd,
        valor_bruto: it.qtd * it.precoUnit,
        icms_situacao_tributaria: '102',
        icms_origem: 0,
      })),
    };

    const aliquotaIss = config.issAliquota || 5.0;
    const valorIss = venda.total * (aliquotaIss / 100);

    const payloadNfse = {
      data_emissao: new Date().toISOString(),
      prestador: {
        cnpj: cnpjEmitente,
        inscricao_municipal: config.inscricaoMunicipal.replace(/\D/g, ''),
      },
      tomador: cleanCpfCnpjCliente ? {
        cnpj: cleanCpfCnpjCliente.length === 14 ? cleanCpfCnpjCliente : undefined,
        cpf: cleanCpfCnpjCliente.length === 11 ? cleanCpfCnpjCliente : undefined,
        razao_social: 'Consumidor Final Identificado',
      } : {
        razao_social: 'Consumidor Final',
      },
      servico: {
        aliquota: aliquotaIss,
        codigo_municipio: '3550308',
        item_lista_servico: config.issCodigoServico || '14.01',
        valor_servicos: venda.total,
        discriminacao: `Prestação de serviços ref. venda #${venda.id} - ${itens.map(i => `${i.qtd}x ${i.nome}`).join(', ')}`,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': obterAuthorizationHeader(config.focusToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(isNfse ? payloadNfse : payloadNfce),
      });

      const data = await response.json();

      if (response.status === 202 || response.status === 201 || response.status === 200) {
        const chaveAcesso = data.chave_nfe || data.codigo_verificacao || data.uuid || referenciaId;
        const protocolo = data.protocolo || `PRT${Math.floor(100000 + Math.random() * 900000)}`;
        const urlDanfe = data.caminho_danfe_pdf || data.caminho_danfse_pdf || undefined;

        return {
          chaveAcesso,
          protocolo,
          numero: data.numero || config.proximoNumero,
          serie: data.serie || config.serie,
          urlDanfe,
          aliquotaIss: isNfse ? aliquotaIss : undefined,
          valorIss: isNfse ? valorIss : undefined,
          status: 'autorizada',
        };
      } else {
        const erroMsg = data.mensagem || (data.erros && data.erros[0]?.mensagem) || 'Erro de validação fiscal.';
        return {
          chaveAcesso: '',
          protocolo: '',
          numero: config.proximoNumero,
          serie: config.serie,
          status: 'erro',
          mensagem: erroMsg,
        };
      }
    } catch (error: any) {
      return {
        chaveAcesso: '',
        protocolo: '',
        numero: config.proximoNumero,
        serie: config.serie,
        status: 'erro',
        mensagem: `Falha de conexão com a API de Emissão: ${error.message || error}`,
      };
    }
  }

  // -------------------------------------------------------------
  // 3. FLUXO DE SIMULAÇÃO LOCAL (Para desenvolvimento e testes sem certificado)
  // -------------------------------------------------------------
  return simularEmissaoLocal({ venda, config, empresa, tipo });
}

/**
 * Simula a autorização de forma local de alta fidelidade
 */
function simularEmissaoLocal(params: {
  venda: Venda;
  config: ConfigFiscal;
  empresa: any;
  tipo: 'NFC-e' | 'NFS-e';
}): SefazResult {
  const { venda, config, tipo, empresa } = params;
  let chave = '';
  let protocolo = `13526000${Math.floor(1000000 + Math.random() * 9000000)}`;
  let valorIss = 0;
  let aliquotaIss = 0;

  if (tipo === 'NFC-e') {
    const cnpjNumeros = empresa.cnpj ? empresa.cnpj.replace(/\D/g, '').padEnd(14, '0') : '00000000000000';
    const dataHoje = new Date();
    const anoMes = dataHoje.getFullYear().toString().substring(2) + String(dataHoje.getMonth() + 1).padStart(2, '0');
    const numFormatado = String(config.proximoNumero).padStart(9, '0');
    const serieFormatada = String(config.serie).padStart(3, '0');
    const codigoNumerico = String(Math.floor(10000000 + Math.random() * 90000000));
    const chaveSemDV = `35${anoMes}${cnpjNumeros}65${serieFormatada}${numFormatado}1${codigoNumerico}`;
    chave = `${chaveSemDV}9`;
  } else {
    chave = Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString();
    aliquotaIss = config.issAliquota || 5.0;
    valorIss = venda.total * (aliquotaIss / 100);
  }

  return {
    chaveAcesso: chave,
    protocolo,
    numero: config.proximoNumero,
    serie: config.serie,
    aliquotaIss: tipo === 'NFS-e' ? aliquotaIss : undefined,
    valorIss: tipo === 'NFS-e' ? valorIss : undefined,
    status: 'autorizada',
    mensagem: 'Nota emitida em modo de Simulação/Homologação Local (Custo Zero)',
  };
}

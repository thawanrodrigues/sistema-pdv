// ============================================================
// Construtor Oficial de XML para NFC-e (Modelo 65 - MOC 4.00)
// ============================================================

import { CODIGOS_IBGE_UF, UF } from '../config/sefazEndpoints.js';

export interface ItemVendaFiscal {
  numeroItem: number;
  codigo: string;
  nome: string;
  ncm?: string;
  cfop?: string;
  unidade?: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface DadosNfceEnvio {
  chaveAcesso: string;
  codigoNumerico: string;
  digitoVerificador: number;
  serie: number;
  numero: number;
  dataEmissao: Date;
  uf: UF;
  codigoMunicipioIbge?: string;
  ambiente: 'producao' | 'homologacao';
  
  // Emitente
  cnpjEmitente: string;
  razaoSocialEmitente: string;
  nomeFantasiaEmitente?: string;
  inscricaoEstadualEmitente: string;
  regimeTributario?: string; // 1 = Simples Nacional, 3 = Normal
  logradouroEmitente?: string;
  numeroEmitente?: string;
  bairroEmitente?: string;
  municipioEmitente?: string;
  cepEmitente?: string;

  // Destinatário (opcional para consumidor final no PDV)
  cpfCnpjDestinatario?: string;
  nomeDestinatario?: string;

  // Itens e Totais
  itens: ItemVendaFiscal[];
  valorTotal: number;
  metodoPagamento: string; // Dinheiro, Cartao, Pix, etc.
  valorTroco?: number;
}

function mapearCodigoPagamentoSefaz(metodo: string): string {
  const norm = metodo.toLowerCase();
  if (norm.includes('dinheiro')) return '01';
  if (norm.includes('cheque')) return '02';
  if (norm.includes('crédito') || norm.includes('credito')) return '03';
  if (norm.includes('débito') || norm.includes('debito')) return '04';
  if (norm.includes('pix')) return '17';
  return '99'; // Outros
}

/**
 * Constrói a string XML da <NFe> completa antes da assinatura
 */
export function construirXmlNfce(dados: DadosNfceEnvio): string {
  const cUF = CODIGOS_IBGE_UF[dados.uf] || '35';
  const tpAmb = dados.ambiente === 'producao' ? '1' : '2';
  const dhEmi = dados.dataEmissao.toISOString();
  const cMunFG = dados.codigoMunicipioIbge || `${cUF}00000`; // Fallback IBGE
  const tPag = mapearCodigoPagamentoSefaz(dados.metodoPagamento);

  const cleanCnpj = dados.cnpjEmitente.replace(/\D/g, '');
  const cleanIe = dados.inscricaoEstadualEmitente.replace(/\D/g, '') || 'ISENTO';
  const crt = dados.regimeTributario || '1'; // 1 = Simples Nacional

  // Bloco Destinatário (se informado CPF ou CNPJ)
  let blocoDest = '';
  if (dados.cpfCnpjDestinatario && dados.cpfCnpjDestinatario.trim()) {
    const docClean = dados.cpfCnpjDestinatario.replace(/\D/g, '');
    const tagDoc = docClean.length === 11 ? `<CPF>${docClean}</CPF>` : `<CNPJ>${docClean}</CNPJ>`;
    const tagNome = dados.nomeDestinatario ? `<xNome>${dados.nomeDestinatario}</xNome>` : '';
    blocoDest = `
      <dest>
        ${tagDoc}
        ${tagNome}
        <indIEDest>9</indIEDest>
      </dest>
    `.trim();
  }

  // Bloco de Itens
  let itensXml = '';
  let totalTributosAprox = 0;

  dados.itens.forEach((it, idx) => {
    const nItem = idx + 1;
    const ncm = (it.ncm || '21069090').replace(/\D/g, '').padEnd(8, '0');
    const cfop = it.cfop || '5102';
    const uCom = it.unidade || 'UN';
    const qCom = it.quantidade.toFixed(4);
    const vUnCom = it.valorUnitario.toFixed(2);
    const vProd = it.valorTotal.toFixed(2);
    
    // Estimativa de tributos aproximados (Lei da Transparência)
    const vTotTribItem = it.valorTotal * 0.1345;
    totalTributosAprox += vTotTribItem;

    itensXml += `
      <det nItem="${nItem}">
        <prod>
          <cProd>${it.codigo || nItem}</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>${it.nome}</xProd>
          <NCM>${ncm}</NCM>
          <CFOP>${cfop}</CFOP>
          <uCom>${uCom}</uCom>
          <qCom>${qCom}</qCom>
          <vUnCom>${vUnCom}</vUnCom>
          <vProd>${vProd}</vProd>
          <cEANTrib>SEM GTIN</cEANTrib>
          <uTrib>${uCom}</uTrib>
          <qTrib>${qCom}</qCom>
          <vUnTrib>${vUnCom}</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <vTotTrib>${vTotTribItem.toFixed(2)}</vTotTrib>
          <ICMS>
            <ICMSSN102>
              <orig>0</orig>
              <CSOSN>102</CSOSN>
            </ICMSSN102>
          </ICMS>
          <PIS>
            <PISNT>
              <CST>07</CST>
            </PISNT>
          </PIS>
          <COFINS>
            <COFINSNT>
              <CST>07</CST>
            </COFINSNT>
          </COFINS>
        </imposto>
      </det>
    `.trim();
  });

  const vNF = dados.valorTotal.toFixed(2);
  const vTroco = (dados.valorTroco || 0).toFixed(2);

  const xml = `
    <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
      <infNFe Id="NFe${dados.chaveAcesso}" versao="4.00">
        <ide>
          <cUF>${cUF}</cUF>
          <cNF>${dados.codigoNumerico}</cNF>
          <natOp>VENDA DE MERCADORIA</natOp>
          <mod>65</mod>
          <serie>${dados.serie}</serie>
          <nNF>${dados.numero}</nNF>
          <dhEmi>${dhEmi}</dhEmi>
          <tpNF>1</tpNF>
          <idDest>1</idDest>
          <cMunFG>${cMunFG}</cMunFG>
          <tpImp>4</tpImp>
          <tpEmis>1</tpEmis>
          <cDV>${dados.digitoVerificador}</cDV>
          <tpAmb>${tpAmb}</tpAmb>
          <finNFe>1</finNFe>
          <indFinal>1</indFinal>
          <indPres>1</indPres>
          <procEmi>0</procEmi>
          <verProc>ConectaPDV_1.0</verProc>
        </ide>
        <emit>
          <CNPJ>${cleanCnpj}</CNPJ>
          <xNome>${dados.razaoSocialEmitente}</xNome>
          ${dados.nomeFantasiaEmitente ? `<xFant>${dados.nomeFantasiaEmitente}</xFant>` : ''}
          <enderEmit>
            <xLgr>${dados.logradouroEmitente || 'Rua Principal'}</xLgr>
            <nro>${dados.numeroEmitente || 'S/N'}</nro>
            <xBairro>${dados.bairroEmitente || 'Centro'}</xBairro>
            <cMun>${cMunFG}</cMun>
            <xMun>${dados.municipioEmitente || 'Sao Paulo'}</xMun>
            <UF>${dados.uf}</UF>
            <CEP>${(dados.cepEmitente || '01001000').replace(/\D/g, '')}</CEP>
            <cPais>1058</cPais>
            <xPais>BRASIL</xPais>
          </enderEmit>
          <IE>${cleanIe}</IE>
          <CRT>${crt}</CRT>
        </emit>
        ${blocoDest}
        ${itensXml}
        <total>
          <ICMSTot>
            <vBC>0.00</vBC>
            <vICMS>0.00</vICMS>
            <vICMSDeson>0.00</vICMSDeson>
            <vFCP>0.00</vFCP>
            <vBCST>0.00</vBCST>
            <vST>0.00</vST>
            <vFCPST>0.00</vFCPST>
            <vFCPSTRet>0.00</vFCPSTRet>
            <vProd>${vNF}</vProd>
            <vFrete>0.00</vFrete>
            <vSeg>0.00</vSeg>
            <vDesc>0.00</vDesc>
            <vII>0.00</vII>
            <vIPI>0.00</vIPI>
            <vIPIDevol>0.00</vIPIDevol>
            <vPIS>0.00</vPIS>
            <vCOFINS>0.00</vCOFINS>
            <vOutro>0.00</vOutro>
            <vNF>${vNF}</vNF>
            <vTotTrib>${totalTributosAprox.toFixed(2)}</vTotTrib>
          </ICMSTot>
        </total>
        <transp>
          <modFrete>9</modFrete>
        </transp>
        <pag>
          <detPag>
            <tPag>${tPag}</tPag>
            <vPag>${vNF}</vPag>
          </detPag>
          ${dados.valorTroco && dados.valorTroco > 0 ? `<vTroco>${vTroco}</vTroco>` : ''}
        </pag>
        <infAdic>
          <infCpl>Trib aprox R$ ${totalTributosAprox.toFixed(2)} Fed/Est (Lei 12741/12). Emitido por ConectaPDV Cloud.</infCpl>
        </infAdic>
      </infNFe>
    </NFe>
  `.trim();

  return xml;
}

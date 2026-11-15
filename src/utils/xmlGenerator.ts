import { Venda, ItemVenda } from '../database/vendaRepository';

export function gerarXMLNFCe(params: {
  venda: Venda;
  itens: ItemVenda[];
  chaveAcesso: string;
  numero: number;
  serie: number;
  protocolo: string;
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  cpfCliente?: string;
  ambiente: 'homologacao' | 'producao';
}): string {
  const {
    venda,
    itens,
    chaveAcesso,
    numero,
    serie,
    protocolo,
    razaoSocial,
    cnpj,
    endereco,
    cpfCliente,
    ambiente,
  } = params;

  const dataEmi = new Date(venda.criadoEm || Date.now()).toISOString();
  const tpAmb = ambiente === 'producao' ? '1' : '2';

  let detXml = '';
  itens.forEach((it, idx) => {
    const itemNum = idx + 1;
    detXml += `
    <det nItem="${itemNum}">
      <prod>
        <cProd>${it.produtoId || 'AVULSO'}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>${it.nome}</xProd>
        <NCM>21069090</NCM>
        <CFOP>5102</CFOP>
        <uCom>UN</uCom>
        <qCom>${it.qtd.toFixed(4)}</qCom>
        <vUnCom>${it.precoUnit.toFixed(2)}</vUnCom>
        <vProd>${(it.qtd * it.precoUnit).toFixed(2)}</vProd>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <vTotTrib>${((it.qtd * it.precoUnit) * 0.1345).toFixed(2)}</vTotTrib>
        <ICMS>
          <ICMS00>
            <orig>0</orig>
            <CST>00</CST>
            <modBC>3</modBC>
            <vBC>${(it.qtd * it.precoUnit).toFixed(2)}</vBC>
            <pICMS>18.00</pICMS>
            <vICMS>${((it.qtd * it.precoUnit) * 0.18).toFixed(2)}</vICMS>
          </ICMS00>
        </ICMS>
      </imposto>
    </det>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${chaveAcesso}" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <cNF>${String(venda.id).padStart(8, '0')}</cNF>
        <natOp>Venda de mercadoria</natOp>
        <mod>65</mod>
        <serie>${serie}</serie>
        <nNF>${numero}</nNF>
        <dhEmi>${dataEmi}</dhEmi>
        <tpImp>4</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>9</cDV>
        <tpAmb>${tpAmb}</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>1</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
        <verProc>ConectaPDV_v2.1</verProc>
      </ide>
      <emit>
        <CNPJ>${cnpj.replace(/\D/g, '') || '00000000000100'}</CNPJ>
        <xNome>${razaoSocial}</xNome>
        <enderEmit>
          <xLgr>${endereco || 'Av. Principal'}</xLgr>
          <nro>1000</nro>
          <xBairro>Centro</xBairro>
          <cMun>3550308</cMun>
          <xMun>São Paulo</xMun>
          <UF>SP</UF>
          <CEP>01001000</CEP>
          <cPais>1058</cPais>
          <xPais>BRASIL</xPais>
        </enderEmit>
        <IE>111222333444</IE>
        <CRT>1</CRT>
      </emit>
      <dest>
        ${cpfCliente ? `<CPF>${cpfCliente.replace(/\D/g, '')}</CPF>` : ''}
        <xNome>${cpfCliente ? 'CONSUMIDOR IDENTIFICADO' : 'CONSUMIDOR NAO IDENTIFICADO'}</xNome>
        <indIEDest>9</indIEDest>
      </dest>
      ${detXml}
      <total>
        <ICMSTot>
          <vBC>${venda.total.toFixed(2)}</vBC>
          <vICMS>${(venda.total * 0.18).toFixed(2)}</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>${venda.total.toFixed(2)}</vProd>
          <vFrete>0.00</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>0.00</vDesc>
          <vII>0.00</vII>
          <vIPI>0.00</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>${(venda.total * 0.0065).toFixed(2)}</vPIS>
          <vCOFINS>${(venda.total * 0.03).toFixed(2)}</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>${venda.total.toFixed(2)}</vNF>
          <vTotTrib>${(venda.total * 0.1345).toFixed(2)}</vTotTrib>
        </ICMSTot>
      </total>
      <pag>
        <detPag>
          <tPag>${venda.metodoPagamento === 'Cartão' ? '03' : venda.metodoPagamento === 'Pix' ? '17' : '01'}</tPag>
          <vPag>${venda.total.toFixed(2)}</vPag>
        </detPag>
      </pag>
      <infAdic>
        <infCpl>Tributos estimados (Lei 12741/12): R$ ${(venda.total * 0.1345).toFixed(2)} | NFC-e emitida via ConectaPDV</infCpl>
      </infAdic>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>${tpAmb}</tpAmb>
      <verAplic>SP_NFe_PL_009</verAplic>
      <chNFe>${chaveAcesso}</chNFe>
      <dhRecb>${dataEmi}</dhRecb>
      <nProt>${protocolo}</nProt>
      <digVal>z7Xm13R8oK9+H8pS7F6uB3D6gH4=</digVal>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;

  return xml.trim();
}

// ============================================================
// Transmissor SOAP 1.2 com TLS Mútuo (mTLS) para Web Services SEFAZ
// ============================================================

import https from 'node:https';
import { XMLParser } from 'fast-xml-parser';
import { criarAgenteHttpsSefaz } from './certificadoService.js';
import { obterEndpointsSefaz, CODIGOS_IBGE_UF, TipoAmbiente, UF } from '../config/sefazEndpoints.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true, // Remove prefixos como soap12: e nfe: para facilitar o acesso aos dados
});

/**
 * Dispara requisição HTTP POST SOAP 1.2 para a SEFAZ
 */
export async function enviarRequisicaoSoap(
  urlEndpoint: string,
  soapXml: string,
  agenteHttps: https.Agent,
  timeoutMs = 15000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlEndpoint);

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      agent: agenteHttps,
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(soapXml, 'utf8'),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout ao conectar com a SEFAZ (${timeoutMs}ms)`));
    });

    req.on('error', (err) => {
      reject(new Error(`Erro de rede/TLS na conexão com a SEFAZ: ${err.message}`));
    });

    req.write(soapXml);
    req.end();
  });
}

/**
 * Consulta o status do serviço da SEFAZ para a UF informada
 */
export async function consultarStatusServico(params: {
  uf: UF;
  ambiente: TipoAmbiente;
  pfxBase64: string;
  senhaCertificado: string;
}): Promise<{
  online: boolean;
  cStat: string;
  xMotivo: string;
  tempoMedio?: string;
}> {
  const { uf, ambiente, pfxBase64, senhaCertificado } = params;
  const endpoints = obterEndpointsSefaz(uf, ambiente);
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const cUF = CODIGOS_IBGE_UF[uf] || '35';

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
      <consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
        <tpAmb>${tpAmb}</tpAmb>
        <cUF>${cUF}</cUF>
        <xServ>STATUS</xServ>
      </consStatServ>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`.trim();

  const agente = criarAgenteHttpsSefaz(pfxBase64, senhaCertificado);
  const respostaXml = await enviarRequisicaoSoap(endpoints.statusServico, envelope, agente);

  const json = parser.parse(respostaXml);
  const retConsStatServ = json?.Envelope?.Body?.nfeResultMsg?.retConsStatServ ||
                          json?.Envelope?.Body?.retConsStatServ;

  const cStat = String(retConsStatServ?.cStat || '999');
  const xMotivo = String(retConsStatServ?.xMotivo || 'Sem resposta legível da SEFAZ');
  const tempoMedio = retConsStatServ?.tMed ? String(retConsStatServ.tMed) : undefined;

  return {
    online: cStat === '107', // 107 = Serviço em Operação
    cStat,
    xMotivo,
    tempoMedio,
  };
}

/**
 * Transmite lote de NFC-e de forma síncrona (indSinc=1) para a SEFAZ
 */
export async function transmitirLoteNfceSincrono(params: {
  uf: UF;
  ambiente: TipoAmbiente;
  xmlNFeAssinado: string;
  idLote?: string;
  pfxBase64: string;
  senhaCertificado: string;
}): Promise<{
  autorizada: boolean;
  cStat: string;
  xMotivo: string;
  nProt?: string;
  dhRecbto?: string;
  xmlProtocolado?: string;
  xmlRespostaSefaz: string;
}> {
  const { uf, ambiente, xmlNFeAssinado, idLote = '1', pfxBase64, senhaCertificado } = params;
  const endpoints = obterEndpointsSefaz(uf, ambiente);

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
        <idLote>${idLote}</idLote>
        <indSinc>1</indSinc>
        ${xmlNFeAssinado}
      </enviNFe>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`.trim();

  const agente = criarAgenteHttpsSefaz(pfxBase64, senhaCertificado);
  const respostaXml = await enviarRequisicaoSoap(endpoints.autorizacao, envelope, agente);

  const json = parser.parse(respostaXml);
  const retEnviNFe = json?.Envelope?.Body?.nfeResultMsg?.retEnviNFe ||
                     json?.Envelope?.Body?.retEnviNFe;

  const protNFe = retEnviNFe?.protNFe?.infProt;
  const cStat = String(protNFe?.cStat || retEnviNFe?.cStat || '999');
  const xMotivo = String(protNFe?.xMotivo || retEnviNFe?.xMotivo || 'Erro desconhecido na autorização');
  const nProt = protNFe?.nProt ? String(protNFe.nProt) : undefined;
  const dhRecbto = protNFe?.dhRecbto ? String(protNFe.dhRecbto) : undefined;

  const autorizada = cStat === '100'; // 100 = Autorizado o uso da NF-e

  let xmlProtocolado: string | undefined;
  if (autorizada && protNFe) {
    // Monta o nfeProc final com a NFe assinada + protNFe oficial
    const blocoProtNfeXml = `
      <protNFe versao="4.00">
        <infProt>
          <tpAmb>${protNFe.tpAmb}</tpAmb>
          <verAplic>${protNFe.verAplic}</verAplic>
          <chNFe>${protNFe.chNFe}</chNFe>
          <dhRecb>${protNFe.dhRecbto}</dhRecb>
          <nProt>${protNFe.nProt}</nProt>
          <digVal>${protNFe.digVal}</digVal>
          <cStat>${protNFe.cStat}</cStat>
          <xMotivo>${protNFe.xMotivo}</xMotivo>
        </infProt>
      </protNFe>
    `.trim();

    xmlProtocolado = `<?xml version="1.0" encoding="utf-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  ${xmlNFeAssinado}
  ${blocoProtNfeXml}
</nfeProc>`.trim();
  }

  return {
    autorizada,
    cStat,
    xMotivo,
    nProt,
    dhRecbto,
    xmlProtocolado,
    xmlRespostaSefaz: respostaXml,
  };
}

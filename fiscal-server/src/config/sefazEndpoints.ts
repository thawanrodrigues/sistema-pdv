// ============================================================
// Mapeamento Oficial de Web Services da SEFAZ (NFC-e / NF-e 4.00)
// e Códigos IBGE de Estados
// ============================================================

export type UF =
  | 'AC' | 'AL' | 'AM' | 'AP' | 'BA' | 'CE' | 'DF' | 'ES' | 'GO'
  | 'MA' | 'MG' | 'MS' | 'MT' | 'PA' | 'PB' | 'PE' | 'PI' | 'PR'
  | 'RJ' | 'RN' | 'RO' | 'RR' | 'RS' | 'SC' | 'SE' | 'SP' | 'TO';

export const CODIGOS_IBGE_UF: Record<UF, string> = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27',
  SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41',
  SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53'
};

export type TipoAmbiente = 'producao' | 'homologacao';

export interface SefazEndpoints {
  autorizacao: string;
  retAutorizacao: string;
  inutilizacao: string;
  consultaProtocolo: string;
  statusServico: string;
  recepcaoEvento: string;
  qrCodeUrl: string;
}

// Endpoints oficiais da SEFAZ Virtual RS (SVRS) - Utilizada por maioria dos estados para NFC-e
const SVRS_HOMOLOGACAO: SefazEndpoints = {
  autorizacao: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
  retAutorizacao: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
  inutilizacao: 'https://nfce-homologacao.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
  consultaProtocolo: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  statusServico: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
  recepcaoEvento: 'https://nfce-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
  qrCodeUrl: 'https://dfe-portal.svrs.rs.gov.br/nfce/qrCode',
};

const SVRS_PRODUCAO: SefazEndpoints = {
  autorizacao: 'https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
  retAutorizacao: 'https://nfce.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
  inutilizacao: 'https://nfce.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
  consultaProtocolo: 'https://nfce.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  statusServico: 'https://nfce.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
  recepcaoEvento: 'https://nfce.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
  qrCodeUrl: 'https://dfe-portal.svrs.rs.gov.br/nfce/qrCode',
};

// Endpoints SEFAZ São Paulo (SP)
const SP_HOMOLOGACAO: SefazEndpoints = {
  autorizacao: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
  retAutorizacao: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx',
  inutilizacao: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeInutilizacao4.asmx',
  consultaProtocolo: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx',
  statusServico: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
  recepcaoEvento: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeRecepcaoEvento4.asmx',
  qrCodeUrl: 'https://www.homologacao.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx',
};

const SP_PRODUCAO: SefazEndpoints = {
  autorizacao: 'https://nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
  retAutorizacao: 'https://nfce.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx',
  inutilizacao: 'https://nfce.fazenda.sp.gov.br/ws/NFeInutilizacao4.asmx',
  consultaProtocolo: 'https://nfce.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx',
  statusServico: 'https://nfce.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
  recepcaoEvento: 'https://nfce.fazenda.sp.gov.br/ws/NFeRecepcaoEvento4.asmx',
  qrCodeUrl: 'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx',
};

// Endpoints SEFAZ Minas Gerais (MG)
const MG_HOMOLOGACAO: SefazEndpoints = {
  autorizacao: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeAutorizacao4',
  retAutorizacao: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeRetAutorizacao4',
  inutilizacao: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeInutilizacao4',
  consultaProtocolo: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeConsultaProtocolo4',
  statusServico: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeStatusServico4',
  recepcaoEvento: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeRecepcaoEvento4',
  qrCodeUrl: 'https://hportalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml',
};

const MG_PRODUCAO: SefazEndpoints = {
  autorizacao: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeAutorizacao4',
  retAutorizacao: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeRetAutorizacao4',
  inutilizacao: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeInutilizacao4',
  consultaProtocolo: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeConsultaProtocolo4',
  statusServico: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeStatusServico4',
  recepcaoEvento: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeRecepcaoEvento4',
  qrCodeUrl: 'https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml',
};

/**
 * Retorna os endpoints da SEFAZ para a UF informada e ambiente desejado
 */
export function obterEndpointsSefaz(uf: UF, ambiente: TipoAmbiente): SefazEndpoints {
  const isProd = ambiente === 'producao';

  switch (uf) {
    case 'SP':
      return isProd ? SP_PRODUCAO : SP_HOMOLOGACAO;
    case 'MG':
      return isProd ? MG_PRODUCAO : MG_HOMOLOGACAO;
    // Demais UFs usam a SEFAZ Virtual do RS (SVRS) para NFC-e
    default:
      return isProd ? SVRS_PRODUCAO : SVRS_HOMOLOGACAO;
  }
}

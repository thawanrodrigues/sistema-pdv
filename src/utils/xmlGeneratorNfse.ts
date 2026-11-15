import { Venda, ItemVenda } from '../database/vendaRepository';

export function gerarXMLNfse(params: {
  venda: Venda;
  itens: ItemVenda[];
  chaveAcesso: string;
  numero: number;
  serie: number;
  protocolo: string;
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  inscricaoMunicipal: string;
  cpfCliente?: string;
  codigoServico: string;
  aliquotaIss: number;
  valorIss: number;
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
    inscricaoMunicipal,
    cpfCliente,
    codigoServico,
    aliquotaIss,
    valorIss,
    ambiente,
  } = params;

  const dataEmi = new Date(venda.criadoEm || Date.now()).toISOString();
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const discriminacaoServicos = itens.map((it) => `${it.qtd}x ${it.nome} (R$ ${it.precoUnit.toFixed(2)})`).join(', ');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd" versao="2.03">
  <LoteRps Id="LOTE${numero}">
    <NumeroLote>${numero}</NumeroLote>
    <CpfCnpj>
      <Cnpj>${cnpj.replace(/\D/g, '') || '00000000000100'}</Cnpj>
    </CpfCnpj>
    <InscricaoMunicipal>${inscricaoMunicipal || '123456-7'}</InscricaoMunicipal>
    <QuantidadeRps>1</QuantidadeRps>
    <ListaRps>
      <Rps>
        <InfDeclaracaoPrestacaoServico Id="RPS${numero}SERIE${serie}">
          <Rps>
            <IdentificacaoRps>
              <Numero>${numero}</Numero>
              <Serie>${serie}</Serie>
              <Tipo>1</Tipo>
            </IdentificacaoRps>
            <DataEmissao>${dataEmi.substring(0, 10)}</DataEmissao>
            <Status>1</Status>
          </Rps>
          <Competencia>${dataEmi.substring(0, 10)}</Competencia>
          <Servico>
            <Valores>
              <ValorServicos>${venda.total.toFixed(2)}</ValorServicos>
              <ValorDeducoes>0.00</ValorDeducoes>
              <ValorPis>0.00</ValorPis>
              <ValorCofins>0.00</ValorCofins>
              <ValorInss>0.00</ValorInss>
              <ValorIr>0.00</ValorIr>
              <ValorCsll>0.00</ValorCsll>
              <Aliquota>${(aliquotaIss / 100).toFixed(4)}</Aliquota>
              <ValorIss>${valorIss.toFixed(2)}</ValorIss>
              <IssRetido>2</IssRetido>
            </Valores>
            <ItemListaServico>${codigoServico || '14.01'}</ItemListaServico>
            <CodigoTributacaoMunicipio>9999</CodigoTributacaoMunicipio>
            <Discriminacao>${discriminacaoServicos || 'Prestacao de servicos diversos'}</Discriminacao>
            <CodigoMunicipio>3550308</CodigoMunicipio>
            <ExigibilidadeISS>1</ExigibilidadeISS>
            <MunicipioIncidencia>3550308</MunicipioIncidencia>
          </Servico>
          <Prestador>
            <CpfCnpj>
              <Cnpj>${cnpj.replace(/\D/g, '') || '00000000000100'}</Cnpj>
            </CpfCnpj>
            <InscricaoMunicipal>${inscricaoMunicipal || '123456-7'}</InscricaoMunicipal>
          </Prestador>
          <Tomador>
            <IdentificacaoTomador>
              <CpfCnpj>
                ${cpfCliente ? (cpfCliente.replace(/\D/g, '').length > 11 ? `<Cnpj>${cpfCliente.replace(/\D/g, '')}</Cnpj>` : `<Cpf>${cpfCliente.replace(/\D/g, '')}</Cpf>`) : '<Cpf>00000000000</Cpf>'}
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>${cpfCliente ? 'CONSUMIDOR IDENTIFICADO' : 'CONSUMIDOR NAO IDENTIFICADO'}</RazaoSocial>
            <Endereco>
              <Endereco>Rua do Tomador, 100</Endereco>
              <Numero>100</Numero>
              <Bairro>Centro</Bairro>
              <CodigoMunicipio>3550308</CodigoMunicipio>
              <Uf>SP</Uf>
              <Cep>01001000</Cep>
            </Endereco>
          </Tomador>
          <RegimeEspecialTributacao>${tpAmb === '1' ? '1' : '6'}</RegimeEspecialTributacao>
          <OptanteSimplesNacional>1</OptanteSimplesNacional>
          <IncentivadorFiscal>2</IncentivadorFiscal>
        </InfDeclaracaoPrestacaoServico>
      </Rps>
    </ListaRps>
  </LoteRps>
  <Cabecalho versao="2.03">
    <VersaoDados>2.03</VersaoDados>
  </Cabecalho>
  <CompNfse>
    <Nfse versao="2.03">
      <InfNfse Id="NFSE${numero}">
        <Numero>${numero + 5000}</Numero>
        <CodigoVerificacao>${chaveAcesso.substring(0, 8).toUpperCase()}</CodigoVerificacao>
        <DataEmissao>${dataEmi}</DataEmissao>
        <NfseSubstituida>0</NfseSubstituida>
        <OutrasInformacoes>NFS-e emitida em ambiente de homologacao/simulacao. Codigo de Seguranca: ${chaveAcesso}</OutrasInformacoes>
        <ValoresNfse>
          <BaseCalculo>${venda.total.toFixed(2)}</BaseCalculo>
          <Aliquota>${aliquotaIss.toFixed(2)}</Aliquota>
          <ValorIss>${valorIss.toFixed(2)}</ValorIss>
          <ValorLiquidoNfse>${(venda.total - valorIss).toFixed(2)}</ValorLiquidoNfse>
        </ValoresNfse>
      </InfNfse>
    </Nfse>
  </CompNfse>
</EnviarLoteRpsEnvio>`;

  return xml.trim();
}

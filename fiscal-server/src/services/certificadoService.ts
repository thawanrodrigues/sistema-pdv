// ============================================================
// Serviço de Gerenciamento e Validação de Certificado Digital A1 (PKCS#12 / .pfx)
// ============================================================

import forge from 'node-forge';
import https from 'node:https';

export interface InfoCertificado {
  valido: boolean;
  razaoSocial: string;
  cnpj?: string;
  dataEmissao: Date;
  dataValidade: Date;
  diasParaVencer: number;
  expirado: boolean;
  pemCertificado: string;
  pemChavePrivada: string;
  base64CertificadoDer: string;
}

/**
 * Decodifica e valida um certificado digital A1 (.pfx)
 */
export function processarCertificadoA1(pfxBase64: string, senha: string): InfoCertificado {
  try {
    const pfxDer = forge.util.decode64(pfxBase64.trim());
    const pfxAsn1 = forge.asn1.fromDer(pfxDer);
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, senha);

    // Buscar a chave privada e o certificado principal
    let certBag: forge.pkcs12.Bag | undefined;
    let keyBag: forge.pkcs12.Bag | undefined;

    for (const safeContent of pfx.safeContents) {
      for (const bag of safeContent.safeBags) {
        if (bag.type === forge.pki.oids.certBag && !certBag) {
          certBag = bag;
        } else if (
          (bag.type === forge.pki.oids.pkcs8ShroudedKeyBag || bag.type === forge.pki.oids.keyBag) &&
          !keyBag
        ) {
          keyBag = bag;
        }
      }
    }

    if (!certBag || !certBag.cert) {
      throw new Error('Certificado X.509 não encontrado dentro do arquivo PFX.');
    }

    if (!keyBag || !keyBag.key) {
      throw new Error('Chave privada não encontrada no arquivo PFX ou senha incorreta.');
    }

    const cert = certBag.cert;
    const privateKey = keyBag.key;

    // Metadados
    const validadeFim = cert.validity.notAfter;
    const validadeInicio = cert.validity.notBefore;
    const agora = new Date();
    const expirado = agora > validadeFim;
    const diffMs = validadeFim.getTime() - agora.getTime();
    const diasParaVencer = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Extrair CN e CNPJ dos atributos do subject
    let razaoSocial = '';
    let cnpj = '';

    for (const attr of cert.subject.attributes) {
      if (attr.name === 'commonName') {
        razaoSocial = String(attr.value);
        // Em certificados e-CNPJ brasileiros, o CN costuma vir como: RAZAO SOCIAL:00000000000100
        const matchCnpj = razaoSocial.match(/(\d{14})/);
        if (matchCnpj) {
          cnpj = matchCnpj[1];
        }
      }
    }

    const pemCertificado = forge.pki.certificateToPem(cert);
    const pemChavePrivada = forge.pki.privateKeyToPem(privateKey);

    // Certificado limpo em DER Base64 (necessário para a tag <X509Certificate> do XML-DSig da SEFAZ)
    const certAsn1 = forge.pki.certificateToAsn1(cert);
    const certDer = forge.asn1.toDer(certAsn1).getBytes();
    const base64CertificadoDer = forge.util.encode64(certDer);

    return {
      valido: true,
      razaoSocial,
      cnpj,
      dataEmissao: validadeInicio,
      dataValidade: validadeFim,
      diasParaVencer,
      expirado,
      pemCertificado,
      pemChavePrivada,
      base64CertificadoDer,
    };
  } catch (err: any) {
    throw new Error(`Falha ao ler o certificado digital: ${err.message || 'Senha incorreta ou arquivo inválido'}`);
  }
}

/**
 * Cria o agente HTTPS com TLS mútuo (mTLS) para comunicação com a SEFAZ
 */
export function criarAgenteHttpsSefaz(pfxBase64: string, senha: string): https.Agent {
  const pfxBuffer = Buffer.from(pfxBase64.trim(), 'base64');
  return new https.Agent({
    pfx: pfxBuffer,
    passphrase: senha,
    rejectUnauthorized: false, // Permite as cadeias da ICP-Brasil mesmo se não estiverem no truststore padrão do Node
    keepAlive: true,
  });
}

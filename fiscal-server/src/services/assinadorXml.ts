// ============================================================
// Assinador Digital Oficial XML-DSig (W3C / SEFAZ MOC 4.00)
// Algoritmo: RSA-SHA1 com Canonização C14N
// ============================================================

import crypto from 'node:crypto';
import { InfoCertificado } from './certificadoService.js';

/**
 * Canonização simplificada C14N para blocos XML da SEFAZ
 */
function canonizarXml(xml: string): string {
  return xml
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/>\s+</g, '><')
    .trim();
}

/**
 * Assina um XML no padrão XML-DSig exigido pela SEFAZ
 * @param xmlString O XML completo da nota (sem assinatura)
 * @param tagAlvo Nome da tag que contém o atributo Id (ex: 'infNFe' ou 'infEvento')
 * @param certInfo Informações do certificado A1 extraídas pelo certificadoService
 */
export function assinarXmlSefaz(
  xmlString: string,
  tagAlvo: 'infNFe' | 'infEvento',
  certInfo: InfoCertificado
): string {
  // 1. Localizar a tag com Id
  const regex = new RegExp(`(<${tagAlvo}[^>]*Id="([^"]+)"[^>]*>[\\s\\S]*?<\\/${tagAlvo}>)`, 'i');
  const match = xmlString.match(regex);

  if (!match) {
    throw new Error(`Tag <${tagAlvo}> com atributo Id não encontrada para assinatura.`);
  }

  const blocoAlvo = match[1];
  const uriId = match[2];

  // 2. Canonizar o bloco alvo e calcular o DigestValue (SHA-1)
  const blocoCanonizado = canonizarXml(blocoAlvo);
  const hashSha1 = crypto.createHash('sha1').update(blocoCanonizado, 'utf8').digest('base64');

  // 3. Montar o bloco SignedInfo canonizado
  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="#${uriId}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${hashSha1}</DigestValue></Reference></SignedInfo>`;

  // 4. Assinar o SignedInfo com a chave privada RSA-SHA1
  const sign = crypto.createSign('RSA-SHA1');
  sign.update(signedInfo, 'utf8');
  const signatureValue = sign.sign(certInfo.pemChavePrivada, 'base64');

  // 5. Montar a tag <Signature>
  const signatureXml = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certInfo.base64CertificadoDer}</X509Certificate></X509Data></KeyInfo></Signature>`;

  // 6. Inserir a assinatura antes do fechamento do elemento pai
  if (tagAlvo === 'infNFe') {
    return xmlString.replace('</NFe>', `${signatureXml}</NFe>`);
  } else {
    return xmlString.replace('</evento>', `${signatureXml}</evento>`);
  }
}

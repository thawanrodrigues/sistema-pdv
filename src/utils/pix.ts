export function generatePixPayload(
  chave: string,
  nome: string,
  cidade: string,
  valor: number,
  identificador: string = 'PDV01'
) {
  if (!chave) return '';

  const format = (id: string, value: string) => {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
  };

  const payloadFormatIndicator = format('00', '01');
  const merchantAccountInformation = format('26', 
    format('00', 'BR.GOV.BCB.PIX') +
    format('01', chave)
  );
  const merchantCategoryCode = format('52', '0000');
  const transactionCurrency = format('53', '986');
  const transactionAmount = format('54', valor.toFixed(2));
  const countryCode = format('58', 'BR');
  const merchantName = format('59', nome.substring(0, 25) || 'Loja');
  const merchantCity = format('60', cidade.substring(0, 15) || 'Cidade');
  const additionalDataFieldTemplate = format('62', 
    format('05', identificador)
  );

  const payload = payloadFormatIndicator +
    merchantAccountInformation +
    merchantCategoryCode +
    transactionCurrency +
    transactionAmount +
    countryCode +
    merchantName +
    merchantCity +
    additionalDataFieldTemplate;

  const payloadToHash = payload + '6304';
  let crc = 0xFFFF;
  for (let i = 0; i < payloadToHash.length; i++) {
    crc ^= payloadToHash.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
    crc &= 0xFFFF;
  }
  const crcHex = crc.toString(16).toUpperCase().padStart(4, '0');

  return payloadToHash + crcHex;
}

// ============================================================
// Repository de Notas Fiscais (NFC-e / NF-e / NFS-e)
// ============================================================
import { getDB } from './db';

export type NotaFiscal = {
  id: number;
  vendaId: number;
  chaveAcesso: string;
  numero: number;
  serie: number;
  protocolo: string;
  status: 'autorizada' | 'cancelada';
  justificativaCancelamento?: string;
  tipo: 'NFC-e' | 'NFS-e';
  codigoServico?: string;
  aliquotaIss?: number;
  valorIss?: number;
  criadoEm: string;
  total?: number;
  metodoPagamento?: string;
};

export type ConfigFiscal = {
  id: number;
  ambiente: 'homologacao' | 'producao';
  serie: number;
  proximoNumero: number;
  csc: string;
  cscId: string;
  certificadoNome?: string;
  certificadoValidade?: string;
  certificadoPfx?: string;
  certificadoSenha?: string;
  fiscalServerUrl?: string;
  uf?: string;
  issAliquota: number;
  issCodigoServico: string;
  inscricaoMunicipal: string;
  focusToken: string;
  inscricaoEstadual: string;
  regimeTributario: string;
  cfopPadrao: string;
  ncmPadrao: string;
};

/** Busca as configurações fiscais */
export async function obterConfigFiscal(): Promise<ConfigFiscal> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>('SELECT * FROM config_fiscal WHERE id = ?', [1]);
  if (!row) {
    return {
      id: 1,
      ambiente: 'homologacao',
      serie: 1,
      proximoNumero: 1,
      csc: '',
      cscId: '',
      fiscalServerUrl: 'http://localhost:3333',
      uf: 'SP',
      issAliquota: 5.0,
      issCodigoServico: '14.01',
      inscricaoMunicipal: '',
      focusToken: '',
      inscricaoEstadual: '',
      regimeTributario: '1',
      cfopPadrao: '5102',
      ncmPadrao: '99999999',
    };
  }
  return {
    id: row.id,
    ambiente: row.ambiente as 'homologacao' | 'producao',
    serie: Number(row.serie),
    proximoNumero: Number(row.proximo_numero),
    csc: row.csc || '',
    cscId: row.csc_id || '',
    certificadoNome: row.certificado_nome || '',
    certificadoValidade: row.certificado_validade || '',
    certificadoPfx: row.certificado_pfx || '',
    certificadoSenha: row.certificado_senha || '',
    fiscalServerUrl: row.fiscal_server_url || 'http://localhost:3333',
    uf: row.uf || 'SP',
    issAliquota: Number(row.iss_aliquota ?? 5.0),
    issCodigoServico: row.iss_codigo_servico || '14.01',
    inscricaoMunicipal: row.inscricao_municipal || '',
    focusToken: row.focus_token || '',
    inscricaoEstadual: row.inscricao_estadual || '',
    regimeTributario: row.regime_tributario || '1',
    cfopPadrao: row.cfop_padrao || '5102',
    ncmPadrao: row.ncm_padrao || '99999999',
  };
}

/** Salva/Atualiza as configurações fiscais */
export async function salvarConfigFiscal(params: Partial<ConfigFiscal>): Promise<void> {
  const db = await getDB();
  const current = await obterConfigFiscal();
  const novo = { ...current, ...params };
  await db.runAsync(
    `UPDATE config_fiscal SET
       ambiente = ?,
       serie = ?,
       proximo_numero = ?,
       csc = ?,
       csc_id = ?,
       certificado_nome = ?,
       certificado_validade = ?,
       certificado_pfx = ?,
       certificado_senha = ?,
       fiscal_server_url = ?,
       uf = ?,
       iss_aliquota = ?,
       iss_codigo_servico = ?,
       inscricao_municipal = ?,
       focus_token = ?,
       inscricao_estadual = ?,
       regime_tributario = ?,
       cfop_padrao = ?,
       ncm_padrao = ?
     WHERE id = ?`,
    [
      novo.ambiente,
      novo.serie,
      novo.proximoNumero,
      novo.csc,
      novo.cscId,
      novo.certificadoNome,
      novo.certificadoValidade,
      novo.certificadoPfx,
      novo.certificadoSenha,
      novo.fiscalServerUrl,
      novo.uf,
      novo.issAliquota,
      novo.issCodigoServico,
      novo.inscricaoMunicipal,
      novo.focusToken,
      novo.inscricaoEstadual,
      novo.regimeTributario,
      novo.cfopPadrao,
      novo.ncmPadrao,
      1,
    ]
  );
}

/** Registra uma nova nota fiscal autorizada (NFC-e ou NFS-e) e incrementa o contador */
export async function registrarNotaFiscal(params: {
  vendaId: number;
  chaveAcesso: string;
  numero: number;
  serie: number;
  protocolo: string;
  status?: 'autorizada' | 'cancelada';
  tipo?: 'NFC-e' | 'NFS-e';
  codigoServico?: string;
  aliquotaIss?: number;
  valorIss?: number;
}): Promise<number> {
  const db = await getDB();
  const status = params.status || 'autorizada';
  const tipo = params.tipo || 'NFC-e';
  const result = await db.runAsync(
    `INSERT INTO notas_fiscais (venda_id, chave_acesso, numero, serie, protocolo, status, tipo, codigo_servico, aliquota_iss, valor_iss)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.vendaId,
      params.chaveAcesso,
      params.numero,
      params.serie,
      params.protocolo,
      status,
      tipo,
      params.codigoServico || null,
      params.aliquotaIss !== undefined ? params.aliquotaIss : null,
      params.valorIss !== undefined ? params.valorIss : null,
    ]
  );

  // Incrementa automaticamente o próximo número de emissão
  const config = await obterConfigFiscal();
  await salvarConfigFiscal({ proximoNumero: config.proximoNumero + 1 });

  return result.lastInsertRowId;
}

/** Lista notas fiscais emitidas juntamente com o total e método de pagamento da venda */
export async function listarNotasFiscais(limite = 100): Promise<NotaFiscal[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT n.*, v.total, v.metodo_pagamento
     FROM notas_fiscais n
     LEFT JOIN vendas v ON v.id = n.venda_id
     ORDER BY n.id DESC LIMIT ?`,
    [limite]
  );
  return rows.map((r) => ({
    id: r.id,
    vendaId: r.venda_id,
    chaveAcesso: r.chave_acesso,
    numero: Number(r.numero),
    serie: Number(r.serie),
    protocolo: r.protocolo,
    status: r.status as 'autorizada' | 'cancelada',
    justificativaCancelamento: r.justificativa_cancelamento || '',
    tipo: (r.tipo || 'NFC-e') as 'NFC-e' | 'NFS-e',
    codigoServico: r.codigo_servico || '',
    aliquotaIss: r.aliquota_iss !== null ? Number(r.aliquota_iss) : undefined,
    valorIss: r.valor_iss !== null ? Number(r.valor_iss) : undefined,
    criadoEm: r.criado_em,
    total: r.total || 0,
    metodoPagamento: r.metodo_pagamento || '',
  }));
}

/** Busca nota fiscal associada a uma determinada venda */
export async function buscarNotaPorVendaId(vendaId: number): Promise<NotaFiscal | null> {
  const db = await getDB();
  const r = await db.getFirstAsync<any>(
    `SELECT * FROM notas_fiscais WHERE venda_id = ?`,
    [vendaId]
  );
  if (!r) return null;
  return {
    id: r.id,
    vendaId: r.venda_id,
    chaveAcesso: r.chave_acesso,
    numero: Number(r.numero),
    serie: Number(r.serie),
    protocolo: r.protocolo,
    status: r.status as 'autorizada' | 'cancelada',
    justificativaCancelamento: r.justificativa_cancelamento || '',
    tipo: (r.tipo || 'NFC-e') as 'NFC-e' | 'NFS-e',
    codigoServico: r.codigo_servico || '',
    aliquotaIss: r.aliquota_iss !== null ? Number(r.aliquota_iss) : undefined,
    valorIss: r.valor_iss !== null ? Number(r.valor_iss) : undefined,
    criadoEm: r.criado_em,
  };
}

/** Cancela uma nota fiscal registrando a justificativa */
export async function cancelarNotaFiscal(id: number, justificativa: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE notas_fiscais SET status = ?, justificativa_cancelamento = ? WHERE id = ?`,
    ['cancelada', justificativa, id]
  );
}

/** Obtém itens de uma venda específica */
export async function obterItensVenda(vendaId: number): Promise<{ produto_id: number; nome: string; qtd: number; preco_unit: number }[]> {
  const db = await getDB();
  return db.getAllAsync<any>(
    `SELECT produto_id, nome, qtd, preco_unit FROM itens_venda WHERE venda_id = ?`,
    [vendaId]
  );
}

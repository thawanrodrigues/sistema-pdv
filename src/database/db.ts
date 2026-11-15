// ============================================================
// Inicialização do banco de dados SQLite — NATIVO (expo-sqlite)
// Para web, Metro resolve automaticamente db.web.ts
// ============================================================
import * as SQLite from 'expo-sqlite';
import { hashSenha } from '../utils/crypto';

/** Tipo genérico do DB compatível com expo-sqlite e o adapter web */
export type DBInstance = {
  execAsync: (sql: string) => Promise<void>;
  runAsync: (sql: string, params?: any[]) => Promise<{ lastInsertRowId: number; changes: number }>;
  getFirstAsync: <T>(sql: string, params?: any[]) => Promise<T | null>;
  getAllAsync: <T>(sql: string, params?: any[]) => Promise<T[]>;
};

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<DBInstance> {
  if (_db) return _db as unknown as DBInstance;
  _db = await SQLite.openDatabaseAsync('pdv_sistema.db');
  await initDB(_db);
  return _db as unknown as DBInstance;
}

async function initDB(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- Empresa
    CREATE TABLE IF NOT EXISTS empresa (
      id INTEGER PRIMARY KEY DEFAULT 1,
      razao_social TEXT NOT NULL DEFAULT 'Minha Empresa',
      cnpj TEXT DEFAULT '',
      telefone TEXT DEFAULT '',
      endereco TEXT DEFAULT '',
      pix_chave TEXT DEFAULT '',
      pix_titular TEXT DEFAULT '',
      api_provedor TEXT DEFAULT '',
      api_token TEXT DEFAULT '',
      api_secret TEXT DEFAULT '',
      criado_em TEXT DEFAULT (datetime('now','localtime'))
    );

    -- Usuários (admin + funcionários)
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      usuario TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email TEXT DEFAULT '',
      senha_hash TEXT NOT NULL,
      perfil TEXT NOT NULL DEFAULT 'funcionario' CHECK(perfil IN ('admin','funcionario')),
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now','localtime'))
    );

    -- Produtos
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT DEFAULT '',
      nome TEXT NOT NULL,
      preco_venda REAL NOT NULL DEFAULT 0,
      preco_custo REAL DEFAULT 0,
      unidade TEXT DEFAULT 'UN',
      estoque REAL DEFAULT 0,
      categoria TEXT DEFAULT 'Geral',
      observacoes TEXT DEFAULT '',
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now','localtime'))
    );

    -- Vendas
    CREATE TABLE IF NOT EXISTS vendas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      total REAL NOT NULL DEFAULT 0,
      metodo_pagamento TEXT NOT NULL DEFAULT 'Dinheiro',
      status TEXT DEFAULT 'concluida',
      criado_em TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    );

    -- Itens da venda
    CREATE TABLE IF NOT EXISTS itens_venda (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venda_id INTEGER NOT NULL,
      produto_id INTEGER DEFAULT 0,
      nome TEXT NOT NULL,
      qtd REAL NOT NULL DEFAULT 1,
      preco_unit REAL NOT NULL DEFAULT 0,
      FOREIGN KEY(venda_id) REFERENCES vendas(id) ON DELETE CASCADE
    );

    -- Caixa
    CREATE TABLE IF NOT EXISTS caixa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL DEFAULT 'fechado' CHECK(status IN ('aberto','fechado')),
      saldo_abertura REAL DEFAULT 0,
      saldo_fechamento REAL DEFAULT 0,
      usuario_id INTEGER,
      aberto_em TEXT,
      fechado_em TEXT,
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    );

    -- Movimentações de caixa
    CREATE TABLE IF NOT EXISTS movimentacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caixa_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('abertura','fechamento','entrada','saida','venda')),
      descricao TEXT DEFAULT '',
      valor REAL NOT NULL DEFAULT 0,
      hora TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY(caixa_id) REFERENCES caixa(id) ON DELETE CASCADE
    );

    -- Notas Fiscais
    CREATE TABLE IF NOT EXISTS notas_fiscais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venda_id INTEGER UNIQUE,
      chave_acesso TEXT NOT NULL,
      numero INTEGER NOT NULL,
      serie INTEGER NOT NULL,
      protocolo TEXT NOT NULL,
      status TEXT DEFAULT 'autorizada' CHECK(status IN ('autorizada','cancelada')),
      justificativa_cancelamento TEXT,
      tipo TEXT NOT NULL DEFAULT 'NFC-e' CHECK(tipo IN ('NFC-e','NFS-e')),
      codigo_servico TEXT,
      aliquota_iss REAL,
      valor_iss REAL,
      criado_em TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY(venda_id) REFERENCES vendas(id) ON DELETE CASCADE
    );

    -- Configurações Fiscais
    CREATE TABLE IF NOT EXISTS config_fiscal (
      id INTEGER PRIMARY KEY DEFAULT 1,
      ambiente TEXT DEFAULT 'homologacao',
      serie INTEGER DEFAULT 1,
      proximo_numero INTEGER DEFAULT 1,
      csc TEXT DEFAULT '',
      csc_id TEXT DEFAULT '',
      certificado_nome TEXT DEFAULT '',
      certificado_validade TEXT DEFAULT '',
      iss_aliquota REAL DEFAULT 5.0,
      iss_codigo_servico TEXT DEFAULT '14.01',
      inscricao_municipal TEXT DEFAULT '',
      focus_token TEXT DEFAULT '',
      inscricao_estadual TEXT DEFAULT '',
      regime_tributario TEXT DEFAULT '1',
      cfop_padrao TEXT DEFAULT '5102',
      ncm_padrao TEXT DEFAULT '99999999'
    );
  `);

  // Criar admin padrão se não existir nenhum usuário
  const count = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM usuarios WHERE perfil = ?',
    ['admin']
  );

  if (!count || count.cnt === 0) {
    const hash = await hashSenha('admin123');
    await db.runAsync(
      `INSERT OR IGNORE INTO usuarios (nome, usuario, email, senha_hash, perfil)
       VALUES (?, ?, ?, ?, ?)`,
      ['Administrador', 'admin', 'admin@sistema.com', hash, 'admin']
    );
    console.log('✅ Admin padrão criado: usuário=admin, senha=admin123');
  }

  // Inserir empresa padrão se não existir
  const empresa = await db.getFirstAsync('SELECT id FROM empresa WHERE id = 1');
  if (!empresa) {
    await db.runAsync(
      `INSERT INTO empresa (id, razao_social) VALUES (1, 'Minha Empresa')`
    );
  }

  // Inserir config fiscal padrão se não existir
  const confFiscal = await db.getFirstAsync('SELECT id FROM config_fiscal WHERE id = 1');
  if (!confFiscal) {
    await db.runAsync(
      `INSERT INTO config_fiscal (id, ambiente, serie, proximo_numero) VALUES (1, 'homologacao', 1, 1)`
    );
  }

  // Inserir produtos iniciais se não houver nenhum
  const prods = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM produtos WHERE ativo = 1'
  );
  if (!prods || prods.cnt === 0) {
    await db.execAsync(`
      INSERT INTO produtos (codigo, nome, preco_venda, preco_custo, unidade, estoque, categoria) VALUES
        ('7894900011517','Refrigerante 2L',9.9,5.0,'UN',100,'Bebidas'),
        ('7896004000035','Pão francês (un.)',0.85,0.4,'UN',200,'Padaria'),
        ('7896089020034','Café 500g',24.5,14.0,'UN',50,'Mercearia'),
        ('7891020137515','Leite integral 1L',5.49,3.5,'UN',80,'Mercearia'),
        ('7893889311016','Açúcar 1kg',4.2,2.8,'UN',60,'Mercearia'),
        ('SEMGTIN','Diversos (balcão)',10.0,0,'UN',999,'Geral');
    `);
  }

  // Migrações dinâmicas para adicionar colunas de NFS-e caso a tabela já existisse
  try {
    await db.execAsync(`ALTER TABLE notas_fiscais ADD COLUMN tipo TEXT NOT NULL DEFAULT 'NFC-e';`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE notas_fiscais ADD COLUMN codigo_servico TEXT;`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE notas_fiscais ADD COLUMN aliquota_iss REAL;`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE notas_fiscais ADD COLUMN valor_iss REAL;`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE config_fiscal ADD COLUMN iss_aliquota REAL DEFAULT 5.0;`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE config_fiscal ADD COLUMN iss_codigo_servico TEXT DEFAULT '14.01';`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE config_fiscal ADD COLUMN inscricao_municipal TEXT DEFAULT '';`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE config_fiscal ADD COLUMN focus_token TEXT DEFAULT '';`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE config_fiscal ADD COLUMN inscricao_estadual TEXT DEFAULT '';`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE config_fiscal ADD COLUMN regime_tributario TEXT DEFAULT '1';`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE config_fiscal ADD COLUMN cfop_padrao TEXT DEFAULT '5102';`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE config_fiscal ADD COLUMN ncm_padrao TEXT DEFAULT '99999999';`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE config_fiscal ADD COLUMN certificado_pfx TEXT DEFAULT '';`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE config_fiscal ADD COLUMN certificado_senha TEXT DEFAULT '';`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE config_fiscal ADD COLUMN fiscal_server_url TEXT DEFAULT 'http://localhost:3333';`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE config_fiscal ADD COLUMN uf TEXT DEFAULT 'SP';`);
  } catch {}

  console.log('✅ Banco de dados SQLite inicializado com sucesso.');
}

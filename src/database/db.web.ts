// ============================================================
// Banco de Dados para WEB — usando localStorage (sem WASM)
// Metro resolve automaticamente db.web.ts para builds web
// ============================================================

/** Tipo genérico do DB compatível com expo-sqlite e o adapter web */
export type DBInstance = {
  execAsync: (sql: string) => Promise<void>;
  runAsync: (sql: string, params?: any[]) => Promise<{ lastInsertRowId: number; changes: number }>;
  getFirstAsync: <T>(sql: string, params?: any[]) => Promise<T | null>;
  getAllAsync: <T>(sql: string, params?: any[]) => Promise<T[]>;
};

type Row = Record<string, any>;
type Table = { rows: Row[]; nextId: number };
type Schema = Record<string, Table>;

const DB_KEY = 'pdv_sistema_db_v1';
const SCHEMA_KEY = 'pdv_sistema_schema_v1';

// ─── Persistência no localStorage ──────────────────────────
function loadSchema(): Schema {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(DB_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSchema(schema: Schema): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(DB_KEY, JSON.stringify(schema));
  } catch {
    // storage full — ignorar silenciosamente
  }
}

let _schema: Schema = loadSchema();

function getTable(name: string): Table {
  if (!_schema[name]) {
    _schema[name] = { rows: [], nextId: 1 };
  }
  return _schema[name];
}

function persist() {
  saveSchema(_schema);
}

// ─── Parser SQL mínimo ─────────────────────────────────────
function parseSql(sql: string, params: any[] = []): any {
  const s = sql.trim().replace(/\s+/g, ' ');
  let paramIdx = 0;

  function nextParam(): any {
    return params[paramIdx++];
  }

  // INSERT
  if (/^INSERT/i.test(s)) {
    const tableMatch = s.match(/INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (!tableMatch) return { changes: 0, lastInsertRowId: 0 };
    const tableName = tableMatch[1];
    const cols = tableMatch[2].split(',').map((c: string) => c.trim());
    const valPlaceholders = tableMatch[3].split(',').map((v: string) => v.trim());
    const table = getTable(tableName);
    const row: Row = { id: table.nextId++ };
    cols.forEach((col: string, i: number) => {
      const ph = valPlaceholders[i];
      if (ph === '?') {
        row[col] = nextParam();
      } else if (/^datetime\('now'/i.test(ph)) {
        row[col] = new Date().toLocaleString('pt-BR');
      } else {
        row[col] = ph.replace(/^'|'$/g, '');
      }
    });
    table.rows.push(row);
    persist();
    return { changes: 1, lastInsertRowId: row.id };
  }

  // UPDATE
  if (/^UPDATE/i.test(s)) {
    const tableMatch = s.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i);
    if (!tableMatch) return { changes: 0 };
    const tableName = tableMatch[1];
    const setClauses = tableMatch[2];
    const whereClause = tableMatch[3];
    const table = getTable(tableName);
    const updates: Row = {};
    setClauses.split(',').forEach((clause: string) => {
      const [col, _] = clause.trim().split('=');
      updates[col.trim()] = nextParam();
    });
    const whereMatch = whereClause.match(/(\w+)\s*=\s*\?/i);
    let changes = 0;
    if (whereMatch) {
      const whereCol = whereMatch[1];
      const whereVal = nextParam();
      table.rows = table.rows.map((row: Row) => {
        if (String(row[whereCol]) === String(whereVal)) {
          changes++;
          return { ...row, ...updates };
        }
        return row;
      });
    } else {
      // UPDATE all
      table.rows = table.rows.map((row: Row) => ({ ...row, ...updates }));
      changes = table.rows.length;
    }
    persist();
    return { changes };
  }

  // DELETE
  if (/^DELETE/i.test(s)) {
    const tableMatch = s.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\?/i);
    if (!tableMatch) return { changes: 0 };
    const tableName = tableMatch[1];
    const whereCol = tableMatch[2];
    const whereVal = nextParam();
    const table = getTable(tableName);
    const before = table.rows.length;
    table.rows = table.rows.filter((row: Row) => String(row[whereCol]) !== String(whereVal));
    persist();
    return { changes: before - table.rows.length };
  }

  // SELECT
  if (/^SELECT/i.test(s)) {
    const tableMatch = s.match(/FROM\s+(\w+)/i);
    if (!tableMatch) return [];
    const tableName = tableMatch[1];
    const table = getTable(tableName);
    let rows = [...table.rows];

    // JOIN (simples)
    const joinMatch = s.match(/LEFT JOIN\s+(\w+)\s+\w+\s+ON\s+\w+\.id\s*=\s*\w+\.(\w+)/i);
    if (joinMatch) {
      const joinTable = getTable(joinMatch[1]);
      const joinCol = joinMatch[2];
      rows = rows.map((row: Row) => {
        const joined = joinTable.rows.find((j: Row) => j.id === row[joinCol]);
        return joined ? { ...row, nome: joined.nome } : row;
      });
    }

    // WHERE
    const whereMatch = s.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/i);
    if (whereMatch) {
      const where = whereMatch[1];
      const conditions = where.split(/\s+AND\s+/i);
      conditions.forEach((cond: string) => {
        const eqMatch = cond.match(/(\w+)\s*=\s*\?/i);
        const collateMatch = cond.match(/(\w+)\s*=\s*\?\s+COLLATE\s+NOCASE/i);
        const likeMatch = cond.match(/(\w+)\s+LIKE\s+\?/i);
        const countMatch = cond.match(/COUNT\(\*\)/i);

        if (collateMatch) {
          const col = collateMatch[1];
          const val = String(nextParam()).toLowerCase();
          rows = rows.filter((row: Row) => String(row[col] || '').toLowerCase() === val);
        } else if (eqMatch) {
          const col = eqMatch[1];
          const val = nextParam();
          rows = rows.filter((row: Row) => String(row[col]) === String(val));
        } else if (likeMatch) {
          const col = likeMatch[1];
          const val = String(nextParam()).replace(/%/g, '');
          rows = rows.filter((row: Row) => String(row[col] || '').toLowerCase().includes(val.toLowerCase()));
        }
      });
    }

    // ORDER BY
    const orderMatch = s.match(/ORDER\s+BY\s+(\w+\.)?(\w+)(?:\s+(ASC|DESC))?/i);
    if (orderMatch) {
      const col = orderMatch[2];
      const desc = orderMatch[3]?.toUpperCase() === 'DESC';
      rows.sort((a: Row, b: Row) => {
        const av = a[col]; const bv = b[col];
        if (av == null) return 1; if (bv == null) return -1;
        return desc ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
      });
    }

    // LIMIT
    const limitMatch = s.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) rows = rows.slice(0, parseInt(limitMatch[1]));

    // SELECT COUNT(*)
    if (/SELECT\s+COUNT\(\*\)\s+as\s+\w+/i.test(s)) {
      return [{ cnt: rows.length, qtd: rows.length }];
    }

    // Aggregations (SUM, COALESCE)
    if (/SUM\s*\(/i.test(s)) {
      let total = 0, dinheiro = 0, cartao = 0, pix = 0;
      let entradas = 0, saidas = 0, vendas = 0;
      rows.forEach((row: Row) => {
        total += row.total || 0;
        if (row.metodo_pagamento === 'Dinheiro') dinheiro += row.total || 0;
        if (row.metodo_pagamento === 'Cartão') cartao += row.total || 0;
        if (row.metodo_pagamento === 'Pix') pix += row.total || 0;
        if (['entrada', 'abertura'].includes(row.tipo)) entradas += row.valor || 0;
        if (row.tipo === 'saida') saidas += row.valor || 0;
        if (row.tipo === 'venda') vendas += row.valor || 0;
      });
      return [{ total, dinheiro, cartao, pix, entradas, saidas, vendas, qtd: rows.length, cnt: rows.length }];
    }

    return rows;
  }

  // PRAGMA / CREATE TABLE — ignorar silenciosamente na web
  return [];
}

const webDB: DBInstance = {
  execAsync: async (sql: string) => {
    const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      if (/^(CREATE|PRAGMA|ALTER)/i.test(stmt)) continue;
      try { parseSql(stmt, []); } catch { /* ignorar */ }
    }
  },

  runAsync: async (sql: string, params: any[] = []) => {
    const result = parseSql(sql, [...params]);
    return {
      lastInsertRowId: result?.lastInsertRowId ?? 0,
      changes: result?.changes ?? 0,
    };
  },

  getFirstAsync: async <T>(sql: string, params: any[] = []): Promise<T | null> => {
    const rows = parseSql(sql, [...params]);
    if (Array.isArray(rows) && rows.length > 0) return rows[0] as T;
    return null;
  },

  getAllAsync: async <T>(sql: string, params: any[] = []): Promise<T[]> => {
    const rows = parseSql(sql, [...params]);
    return Array.isArray(rows) ? (rows as T[]) : [];
  },
};

// ─── Inicialização das tabelas padrão ──────────────────────
import { hashSenha } from '../utils/crypto';

async function initWebDB() {
  // Admin padrão
  const usuariosTable = getTable('usuarios');
  if (usuariosTable.rows.length === 0) {
    const hash = await hashSenha('admin123');
    usuariosTable.rows.push({
      id: usuariosTable.nextId++,
      nome: 'Administrador',
      usuario: 'admin',
      email: 'admin@sistema.com',
      senha_hash: hash,
      perfil: 'admin',
      ativo: 1,
      criado_em: new Date().toLocaleString('pt-BR'),
    });
    persist();
    console.log('✅ Admin padrão criado (web): admin / admin123');
  }

  // Empresa padrão
  const empresaTable = getTable('empresa');
  if (empresaTable.rows.length === 0) {
    empresaTable.rows.push({
      id: 1,
      razao_social: 'Minha Empresa',
      cnpj: '',
      telefone: '',
      endereco: '',
      pix_chave: '',
      pix_titular: '',
      api_provedor: '',
      api_token: '',
      api_secret: '',
    });
    persist();
  }

  // Produtos iniciais
  const produtosTable = getTable('produtos');
  if (produtosTable.rows.filter((p: Row) => p.ativo === 1).length === 0) {
    const produtos = [
      { codigo: '7894900011517', nome: 'Refrigerante 2L', preco_venda: 9.9, preco_custo: 5.0, unidade: 'UN', estoque: 100, categoria: 'Bebidas' },
      { codigo: '7896004000035', nome: 'Pão francês (un.)', preco_venda: 0.85, preco_custo: 0.4, unidade: 'UN', estoque: 200, categoria: 'Padaria' },
      { codigo: '7896089020034', nome: 'Café 500g', preco_venda: 24.5, preco_custo: 14.0, unidade: 'UN', estoque: 50, categoria: 'Mercearia' },
      { codigo: '7891020137515', nome: 'Leite integral 1L', preco_venda: 5.49, preco_custo: 3.5, unidade: 'UN', estoque: 80, categoria: 'Mercearia' },
      { codigo: '7893889311016', nome: 'Açúcar 1kg', preco_venda: 4.2, preco_custo: 2.8, unidade: 'UN', estoque: 60, categoria: 'Mercearia' },
      { codigo: 'SEMGTIN', nome: 'Diversos (balcão)', preco_venda: 10.0, preco_custo: 0, unidade: 'UN', estoque: 999, categoria: 'Geral' },
    ];
    produtos.forEach((p) => {
      produtosTable.rows.push({
        id: produtosTable.nextId++,
        ...p,
        observacoes: '',
        ativo: 1,
        criado_em: new Date().toLocaleString('pt-BR'),
      });
    });
    persist();
  }

  // Config fiscal padrão
  const configFiscalTable = getTable('config_fiscal');
  if (configFiscalTable.rows.length === 0) {
    configFiscalTable.rows.push({
      id: 1,
      ambiente: 'homologacao',
      serie: 1,
      proximo_numero: 1,
      csc: '',
      csc_id: '',
      certificado_nome: '',
      certificado_validade: '',
      iss_aliquota: 5.0,
      iss_codigo_servico: '14.01',
      inscricao_municipal: '',
      focus_token: '',
      inscricao_estadual: '',
      regime_tributario: '1',
      cfop_padrao: '5102',
      ncm_padrao: '99999999',
    });
    persist();
  }

  // Migrações dinâmicas para dados pré-existentes na web
  configFiscalTable.rows.forEach((row) => {
    if (row.iss_aliquota === undefined) row.iss_aliquota = 5.0;
    if (row.iss_codigo_servico === undefined) row.iss_codigo_servico = '14.01';
    if (row.inscricao_municipal === undefined) row.inscricao_municipal = '';
    if (row.focus_token === undefined) row.focus_token = '';
    if (row.inscricao_estadual === undefined) row.inscricao_estadual = '';
    if (row.regime_tributario === undefined) row.regime_tributario = '1';
    if (row.cfop_padrao === undefined) row.cfop_padrao = '5102';
    if (row.ncm_padrao === undefined) row.ncm_padrao = '99999999';
    if (row.certificado_pfx === undefined) row.certificado_pfx = '';
    if (row.certificado_senha === undefined) row.certificado_senha = '';
    if (row.fiscal_server_url === undefined) row.fiscal_server_url = 'http://localhost:3333';
    if (row.uf === undefined) row.uf = 'SP';
  });

  const notasFiscaisTable = getTable('notas_fiscais');
  notasFiscaisTable.rows.forEach((row) => {
    if (row.tipo === undefined) row.tipo = 'NFC-e';
  });

  // Garantir tabelas vazias existam
  ['caixa', 'movimentacoes', 'vendas', 'itens_venda', 'notas_fiscais'].forEach((t) => getTable(t));
  persist();

  console.log('✅ Banco de dados WEB (localStorage) inicializado.');
}

let _initialized = false;
let _initPromise: Promise<void> | null = null;

export async function getDB(): Promise<DBInstance> {
  if (_initialized) return webDB;
  if (_initPromise) { await _initPromise; return webDB; }
  _initPromise = initWebDB();
  await _initPromise;
  _initialized = true;
  return webDB;
}

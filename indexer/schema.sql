-- Advisory event-index schema. Contract calls and finalized logs remain the source of truth.
PRAGMA foreign_keys = ON;

CREATE TABLE chain_cursor (
    chain_id INTEGER PRIMARY KEY,
    next_block INTEGER NOT NULL CHECK (next_block >= 0),
    finalized_block INTEGER NOT NULL CHECK (finalized_block >= 0),
    finalized_block_hash TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE contract_log (
    chain_id INTEGER NOT NULL,
    block_number INTEGER NOT NULL CHECK (block_number >= 0),
    block_hash TEXT NOT NULL,
    transaction_hash TEXT NOT NULL,
    log_index INTEGER NOT NULL CHECK (log_index >= 0),
    contract_address TEXT NOT NULL,
    topic0 TEXT NOT NULL,
    event_name TEXT NOT NULL,
    decoded_json TEXT NOT NULL,
    PRIMARY KEY (chain_id, transaction_hash, log_index)
);

CREATE INDEX contract_log_by_block ON contract_log (chain_id, block_number, log_index);
CREATE INDEX contract_log_by_event ON contract_log (chain_id, event_name, block_number);

CREATE TABLE auction_projection (
    chain_id INTEGER NOT NULL,
    auction_address TEXT NOT NULL,
    auction_id TEXT NOT NULL,
    pool_id TEXT NOT NULL,
    commit_start INTEGER NOT NULL,
    commit_end INTEGER NOT NULL,
    reveal_end INTEGER NOT NULL,
    activation INTEGER NOT NULL,
    expiry INTEGER NOT NULL,
    winner TEXT,
    winning_bid TEXT,
    finalized INTEGER NOT NULL DEFAULT 0 CHECK (finalized IN (0, 1)),
    cancelled INTEGER NOT NULL DEFAULT 0 CHECK (cancelled IN (0, 1)),
    PRIMARY KEY (chain_id, auction_address, auction_id)
);

CREATE TABLE lease_projection (
    chain_id INTEGER NOT NULL,
    lease_address TEXT NOT NULL,
    pool_id TEXT NOT NULL,
    holder TEXT,
    valuation TEXT,
    collateral TEXT,
    arrears TEXT,
    insolvent_at INTEGER,
    last_event_block INTEGER NOT NULL,
    PRIMARY KEY (chain_id, lease_address, pool_id)
);

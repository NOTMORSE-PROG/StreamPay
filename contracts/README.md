# StreamPay contract

The StreamPay Soroban contract (Rust + soroban-sdk). One crate, `streampay`, exposing
exactly four verbs (create_stream, accrued, withdraw, cancel) plus reads, with no admin
key, pause, drain, or upgrade hook by design. All money math is integer (stroops), and
accrual uses floor division so tokens are never created.

```
cargo test                                         # unit + property + scenario suites
cargo build --target wasm32v1-none --release       # the deployable wasm
```

Deployed on Stellar testnet:
`CCN6BBCA5PGRXWWYGAEQ4ZLF2QZ3VORKOAGQSETURZINRILNCETB5P3U`

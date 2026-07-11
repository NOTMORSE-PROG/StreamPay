//! Decision 17 enforcement: the deployed wasm exports exactly the party verbs
//! and reads. No admin function, no pause, no drain, no upgrade hook can slip
//! in without this test failing. The test builds the real wasm and reads its
//! export section, so it checks the artifact judges can verify on-chain, not
//! the source.

use std::collections::BTreeSet;
use std::path::Path;
use std::process::Command;

#[test]
fn exported_surface_is_exactly_the_party_verbs_and_reads() {
    let crate_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let workspace = crate_dir.parent().expect("crate lives in the workspace");

    let status = Command::new("cargo")
        .args([
            "build",
            "--package",
            "streampay",
            "--target",
            "wasm32v1-none",
            "--release",
        ])
        .current_dir(workspace)
        .status()
        .expect("cargo is on PATH");
    assert!(status.success(), "wasm build failed");

    let wasm_path = workspace.join("target/wasm32v1-none/release/streampay.wasm");
    let bytes = std::fs::read(&wasm_path).expect("wasm artifact exists after build");

    let mut exported: BTreeSet<String> = BTreeSet::new();
    for payload in wasmparser::Parser::new(0).parse_all(&bytes) {
        if let wasmparser::Payload::ExportSection(reader) = payload.expect("valid wasm") {
            for export in reader {
                let export = export.expect("valid export entry");
                if matches!(export.kind, wasmparser::ExternalKind::Func) {
                    exported.insert(export.name.to_string());
                }
            }
        }
    }
    // Runtime-internal exports (leading underscore) are not contract surface.
    let surface: BTreeSet<String> = exported
        .into_iter()
        .filter(|name| !name.starts_with('_'))
        .collect();

    let expected: BTreeSet<String> = [
        "create_stream",
        "accrued",
        "withdraw",
        "cancel",
        "get_stream",
        "streams_by_employer",
        "streams_by_worker",
    ]
    .into_iter()
    .map(String::from)
    .collect();
    assert_eq!(
        surface, expected,
        "contract export surface changed; decision 17 allows only party verbs and reads"
    );
}

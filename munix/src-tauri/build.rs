fn main() {
    if std::env::var_os("CARGO_FEATURE_NATIVE_LIBGHOSTTY").is_some() {
        println!("cargo:rustc-cfg=munix_native_libghostty");
        #[cfg(target_os = "macos")]
        build_macos_terminal_bridge();
        println!("cargo:rerun-if-env-changed=GHOSTTY_LIB_DIR");
        if let Some(lib_dir) = std::env::var_os("GHOSTTY_LIB_DIR") {
            println!(
                "cargo:rustc-link-search=native={}",
                lib_dir.to_string_lossy()
            );
            println!("cargo:rustc-link-lib=static=ghostty");
            println!("cargo:rustc-link-lib=framework=AppKit");
            println!("cargo:rustc-link-lib=framework=Metal");
            println!("cargo:rustc-link-lib=framework=QuartzCore");
            println!("cargo:rustc-link-lib=framework=CoreText");
            println!("cargo:rustc-link-lib=framework=CoreGraphics");
            println!("cargo:rustc-link-lib=c++");
        } else {
            println!(
                "cargo:warning=native-libghostty feature is enabled but GHOSTTY_LIB_DIR is not set"
            );
        }
    }
    tauri_build::build()
}

#[cfg(target_os = "macos")]
fn build_macos_terminal_bridge() {
    use std::fs;
    use std::path::PathBuf;
    use std::process::Command;

    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let out_dir = PathBuf::from(std::env::var("OUT_DIR").unwrap());
    let source = manifest_dir.join("native/macos/MunixTerminalBridge.swift");
    let output = out_dir.join("libmunix_terminal_bridge.a");
    let ghostty_include_dir = std::env::var_os("GHOSTTY_INCLUDE_DIR").map(PathBuf::from);
    let ghostty_lib_dir = std::env::var_os("GHOSTTY_LIB_DIR");

    println!("cargo:rerun-if-changed={}", source.display());
    println!("cargo:rerun-if-env-changed=GHOSTTY_INCLUDE_DIR");

    let mut command = Command::new("swiftc");
    command
        .arg("-parse-as-library")
        .arg("-emit-library")
        .arg("-static")
        .arg("-module-name")
        .arg("MunixTerminalBridge")
        .arg("-o")
        .arg(&output);

    if let (Some(include_dir), Some(_)) = (&ghostty_include_dir, &ghostty_lib_dir) {
        let header = include_dir.join("ghostty.h");
        if header.exists() {
            let module_dir = out_dir.join("CGhostty");
            fs::create_dir_all(&module_dir).expect("failed to create CGhostty module directory");
            fs::write(
                module_dir.join("module.modulemap"),
                format!(
                    "module CGhostty [system] {{\n  header \"{}\"\n  export *\n}}\n",
                    header.display()
                ),
            )
            .expect("failed to write CGhostty module map");

            command
                .arg("-D")
                .arg("MUNIX_HAS_GHOSTTY")
                .arg("-I")
                .arg(&out_dir)
                .arg("-Xcc")
                .arg("-DGHOSTTY_STATIC");
        } else {
            println!(
                "cargo:warning=GHOSTTY_INCLUDE_DIR is set but ghostty.h was not found at {}",
                header.display()
            );
        }
    } else if ghostty_lib_dir.is_some() {
        println!(
            "cargo:warning=GHOSTTY_LIB_DIR is set but GHOSTTY_INCLUDE_DIR is missing; Swift bridge will use placeholder surface"
        );
    }

    let status = command
        .arg(&source)
        .status()
        .expect("failed to run swiftc for Munix terminal bridge");

    if !status.success() {
        panic!("swiftc failed while building Munix terminal bridge");
    }

    println!("cargo:rustc-link-search=native={}", out_dir.display());
    println!("cargo:rustc-link-lib=static=munix_terminal_bridge");
    println!("cargo:rustc-link-lib=framework=AppKit");
    println!("cargo:rustc-link-lib=framework=QuartzCore");
}
